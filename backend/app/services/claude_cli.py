"""Wrapper around the local Claude CLI to use personal subscription."""

import asyncio
import json
import os

CLAUDE_BIN = "/home/tylerbvogel/.config/nvm/versions/node/v20.20.0/bin/claude"


async def claude_chat(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    model: str | None = None,
) -> dict:
    """Call the Claude CLI and return {"text": ..., "input_tokens": ..., "output_tokens": ...}."""
    prompt = user_message
    if system_prompt:
        prompt = f"{system_prompt}\n\n---\n\n{user_message}"

    # Must unset CLAUDECODE to avoid nesting guard
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

    cmd = [CLAUDE_BIN, "-p", "--output-format", "json"]
    if model:
        cmd.extend(["--model", model])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
        cwd="/tmp",
    )
    stdout, stderr = await proc.communicate(input=prompt.encode())

    if proc.returncode != 0:
        raise RuntimeError(f"Claude CLI failed ({proc.returncode}): {stderr.decode()}")

    data = json.loads(stdout.decode())

    text = data.get("result", "")
    usage = data.get("usage", {})
    input_tokens = usage.get("input_tokens", 0) + usage.get("cache_creation_input_tokens", 0) + usage.get("cache_read_input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)

    # Capture model version string if available
    model_version = data.get("model", None)

    # Calculate cost from token pricing rather than CLI's total_cost_usd,
    # which doesn't reflect per-model API rates on personal subscription.
    cost_usd = estimate_cost(model, input_tokens, output_tokens)

    return {
        "text": text,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost_usd,
        "model_version": model_version,
    }


# Anthropic API pricing per million tokens (USD)
_PRICING = {
    "haiku":  {"input": 0.80, "output": 4.00},
    "sonnet": {"input": 3.00, "output": 15.00},
    "opus":   {"input": 15.00, "output": 75.00},
}


def estimate_cost(model: str | None, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost from token counts and model name."""
    # None means CLI default, which is opus on personal subscription
    key = model or "opus"
    rates = _PRICING.get(key, _PRICING["opus"])
    return (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000
