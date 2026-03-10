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
        input_price=1.00,
        output_price=5.00,
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
        input_price=5.00,
        output_price=25.00,
    ),
}

DEFAULT_MODEL = "opus"  # CLI default on personal subscription


CLAUDE_BIN = "/home/tylerbvogel/.config/nvm/versions/node/v20.20.0/bin/claude"


async def claude_chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    model: str | None = None,
) -> dict:
    """Call the Claude CLI and return {"text": ..., "input_tokens": ..., "output_tokens": ...}.

    `model` should be a MODEL_REGISTRY key ("haiku", "sonnet", "opus") or None for default.
    """
    prompt = user_message
    if system_prompt:
        prompt = f"{system_prompt}\n\n---\n\n{user_message}"

    # Must unset CLAUDECODE to avoid nesting guard
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

    # Resolve model info
    model_info = MODEL_REGISTRY.get(model or DEFAULT_MODEL)
    cli_model_arg = model_info.cli_arg if model_info else model

    cmd = [CLAUDE_BIN, "-p", "--output-format", "json"]
    if cli_model_arg:
        cmd.extend(["--model", cli_model_arg])

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
            timeout=120,
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("Claude CLI timed out after 120 seconds")

    if proc.returncode != 0:
        raise RuntimeError(f"Claude CLI failed ({proc.returncode}): {stderr.decode()[:500]}")

    data = json.loads(stdout.decode())

    text = data.get("result", "")
    usage = data.get("usage", {})
    input_tokens = usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0) + usage.get("cache_read_input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)

    # Capture model version string if available
    model_version = data.get("model", None)

    # Calculate cost from token pricing
    cost_usd = estimate_cost(model, input_tokens, output_tokens)

    return {
        "text": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost_usd,
        "model_version": model_version,
    }


def estimate_cost(model: str | None, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost from token counts and model name."""
    info = MODEL_REGISTRY.get(model or DEFAULT_MODEL)
    if not info:
        info = MODEL_REGISTRY[DEFAULT_MODEL]
    return (input_tokens * info.input_price + output_tokens * info.output_price) / 1_000_000
