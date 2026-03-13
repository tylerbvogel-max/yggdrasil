"""Computer Use — Haiku-powered browser action planning.

Receives a screenshot + user command + action history, returns a single structured action.
The extension executes the action via Chrome DevTools Protocol, then loops back.
"""

import base64
import json
import anthropic

client = anthropic.AsyncAnthropic()

MAX_ACTIONS = 15  # Safety cap per command

COMPUTER_USE_SYSTEM = """You are Corvus, an AI assistant controlling a web browser to complete tasks for the user.

You receive:
- A screenshot of the current browser tab
- The user's command (what they want done)
- History of actions you've already taken

You must respond with EXACTLY ONE JSON action object. Choose from:

{"action": "navigate", "url": "https://..."}
  → Navigate to a URL

{"action": "click", "x": 450, "y": 300}
  → Click at pixel coordinates on the screenshot

{"action": "type", "text": "hello world"}
  → Type text (assumes a text field is focused — click first if needed)

{"action": "scroll", "direction": "down", "amount": 300}
  → Scroll the page. direction: "up" or "down". amount: pixels.

{"action": "key", "key": "Enter"}
  → Press a special key (Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, etc.)

{"action": "done", "summary": "Completed the task: ..."}
  → Task is complete. Summarize what you did.

{"action": "fail", "reason": "Cannot complete because..."}
  → Task cannot be completed. Explain why.

Rules:
- Always include a "reasoning" field explaining WHY you chose this action
- Look at the screenshot carefully to identify interactive elements
- Click on the CENTER of buttons/links, not edges
- After typing, you may need to press Enter or click a submit button
- If a page is loading, use {"action": "wait"} to pause briefly
- Be precise with coordinates — the screenshot dimensions match the actual page
- ONE action per response. No arrays, no multiple actions.

Respond with ONLY the JSON object, no markdown formatting."""


async def plan_action(
    screenshot_b64: str,
    command: str,
    history: list[dict],
    viewport_width: int = 0,
    viewport_height: int = 0,
) -> dict:
    """Send screenshot + command to Haiku, get back a single action."""
    content_parts = []

    # Build text context
    text = f"COMMAND: {command}\n"
    if viewport_width and viewport_height:
        text += f"VIEWPORT: {viewport_width}x{viewport_height}\n"
    if history:
        text += "\nACTION HISTORY:\n"
        for i, h in enumerate(history, 1):
            text += f"  {i}. {h.get('action', '?')}"
            if h.get("reasoning"):
                text += f" — {h['reasoning']}"
            text += "\n"
    text += f"\nActions taken: {len(history)}/{MAX_ACTIONS}"

    content_parts.append({"type": "text", "text": text})

    # Add screenshot
    content_parts.append({
        "type": "image",
        "source": {"type": "base64", "media_type": "image/jpeg", "data": screenshot_b64},
    })

    content_parts.append({"type": "text", "text": "What is your next action? Respond with JSON only."})

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        temperature=0.2,
        system=COMPUTER_USE_SYSTEM,
        messages=[{"role": "user", "content": content_parts}],
    )

    raw = response.content[0].text.strip()

    # Parse JSON — strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        action = json.loads(raw)
    except json.JSONDecodeError:
        action = {"action": "fail", "reason": f"Could not parse response: {raw[:200]}"}

    return action
