"""Wrapper around the local Claude CLI to use personal subscription.

Uses the CLI binary for development (pulls from Claude subscription).
When switching to multi-user with the Anthropic API, replace claude_chat()
with SDK calls — the interface (system_prompt, user_message, model, max_tokens)
stays identical. All callers use MODEL_REGISTRY display names, not raw model IDs.
"""

import asyncio
import json
import os
from dataclasses import dataclass


# ── Model Registry ──
# Centralized mapping from display names to CLI args and API model IDs.
# All callers use the display name (e.g. "haiku"). When switching to the SDK,
# update `api_id` fields to the current model IDs and swap the transport.

@dataclass
class ModelInfo:
    display_name: str       # Short name used throughout the codebase
    cli_arg: str            # Value passed to `claude --model`
    api_id: str             # Anthropic API model ID (for future SDK use)
    input_price: float      # USD per million input tokens
    output_price: float     # USD per million output tokens


MODEL_REGISTRY: dict[str, ModelInfo] = {
    "haiku": ModelInfo(
        display_name="haiku",
        cli_arg="haiku",
        api_id="claude-haiku-4-5-20251001",
        input_price=0.80,
        output_price=4.00,
    ),
    "sonnet": ModelInfo(
        display_name="sonnet",
        cli_arg="sonnet",
        api_id="claude-sonnet-4-5-20250514",
        input_price=3.00,
        output_price=15.00,
    ),
    "opus": ModelInfo(
        display_name="opus",
        cli_arg="opus",
        api_id="claude-opus-4-6",
        input_price=15.00,
        output_price=75.00,
    ),
}

DEFAULT_MODEL = "opus"  # CLI default on personal subscription


CLAUDE_BIN = "/home/tylerbvogel/.config/nvm/versions/node/v20.20.0/bin/claude"


def _build_cli_command(system_prompt: str, model: str | None) -> list[str]:
    model_info = MODEL_REGISTRY.get(model or DEFAULT_MODEL)
    cli_model_arg = model_info.cli_arg if model_info else model

    cmd = [CLAUDE_BIN, "-p", "--output-format", "json"]
    if cli_model_arg:
        cmd.extend(["--model", cli_model_arg])

    # Use --system-prompt to override CLI's built-in system prompt
    # This prevents the CLI's default "software engineering assistant" framing
    if system_prompt:
        cmd.extend(["--system-prompt", system_prompt])

    assert len(cmd) >= 4, "CLI command must have at least base args"
    assert cmd[0] == CLAUDE_BIN, "CLI command must start with claude binary"
    return cmd


async def _run_cli_subprocess(cmd: list[str], prompt: str) -> tuple[bytes, bytes]:
    # Must unset CLAUDECODE to avoid nesting guard
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
        cwd="/tmp",
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=prompt.encode()),
            timeout=180,
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("Claude CLI timed out after 180 seconds")

    if proc.returncode != 0:
        err_msg = stderr.decode()[:500].strip()
        if not err_msg:
            err_msg = stdout.decode()[:500].strip()
        raise RuntimeError(f"Claude CLI failed ({proc.returncode}): {err_msg}")

    assert len(stdout) > 0, "CLI returned empty stdout on success"
    assert proc.returncode == 0, "Expected zero return code"
    return stdout, stderr


def _parse_cli_response(stdout: bytes, model: str | None) -> dict:
    data = json.loads(stdout.decode())

    text = data.get("result", "")
    usage = data.get("usage", {})
    base_input = usage.get("input_tokens", 0)
    cache_create = usage.get("cache_creation_input_tokens", 0)
    cache_read = usage.get("cache_read_input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    input_tokens = base_input + cache_create + cache_read
    model_version = data.get("model", None)
    cost_usd = estimate_cost_with_cache(model, base_input, cache_create, cache_read, output_tokens)

    result = {
        "text": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost_usd,
        "model_version": model_version,
    }

    assert "text" in result and "input_tokens" in result and "output_tokens" in result, \
        "claude_chat result missing required keys"
    assert result["input_tokens"] >= 0, f"input_tokens must be non-negative, got {result['input_tokens']}"
    assert result["output_tokens"] >= 0, f"output_tokens must be non-negative, got {result['output_tokens']}"
    return result


async def claude_chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    model: str | None = None,
) -> dict:
    """Call the Claude CLI and return {"text": ..., "input_tokens": ..., "output_tokens": ...}.

    `model` should be a MODEL_REGISTRY key ("haiku", "sonnet", "opus") or None for default.
    """
    # JPL Rule 5: at least one of system_prompt or user_message must be non-empty
    assert (system_prompt and system_prompt.strip()) or (user_message and user_message.strip()), \
        "claude_chat requires a non-empty system_prompt or user_message"

    cmd = _build_cli_command(system_prompt, model)
    stdout, _stderr = await _run_cli_subprocess(cmd, user_message)
    return _parse_cli_response(stdout, model)


def estimate_cost(model: str | None, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost from token counts and model name (no cache differentiation)."""
    # JPL Rule 5: token counts must be non-negative
    assert input_tokens >= 0, f"input_tokens must be non-negative, got {input_tokens}"
    assert output_tokens >= 0, f"output_tokens must be non-negative, got {output_tokens}"

    info = MODEL_REGISTRY.get(model or DEFAULT_MODEL)
    if not info:
        info = MODEL_REGISTRY[DEFAULT_MODEL]
    result = (input_tokens * info.input_price + output_tokens * info.output_price) / 1_000_000

    # JPL Rule 5: cost must be non-negative
    assert result >= 0, f"estimated cost must be non-negative, got {result}"
    return result


def estimate_cost_with_cache(
    model: str | None,
    base_input: int,
    cache_create: int,
    cache_read: int,
    output_tokens: int,
) -> float:
    """Estimate USD cost with proper prompt caching rates.

    - base_input: charged at full input price
    - cache_create: charged at 1.25x input price
    - cache_read: charged at 0.10x input price
    - output: charged at full output price
    """
    # JPL Rule 5: all token counts must be non-negative
    assert base_input >= 0, f"base_input must be non-negative, got {base_input}"
    assert cache_create >= 0, f"cache_create must be non-negative, got {cache_create}"
    assert cache_read >= 0, f"cache_read must be non-negative, got {cache_read}"
    assert output_tokens >= 0, f"output_tokens must be non-negative, got {output_tokens}"

    info = MODEL_REGISTRY.get(model or DEFAULT_MODEL)
    if not info:
        info = MODEL_REGISTRY[DEFAULT_MODEL]
    input_cost = (
        base_input * info.input_price
        + cache_create * info.input_price * 1.25
        + cache_read * info.input_price * 0.10
    )
    output_cost = output_tokens * info.output_price
    result = (input_cost + output_cost) / 1_000_000

    # JPL Rule 5: cost must be non-negative
    assert result >= 0, f"estimated cost must be non-negative, got {result}"
    return result
