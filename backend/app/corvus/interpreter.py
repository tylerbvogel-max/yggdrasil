import asyncio
import base64
import datetime
import json
import time
import anthropic
from dataclasses import dataclass, field
from datetime import timedelta
from sqlalchemy import select, text as sql_text, func
from app.database import async_session
from app.models_corvus import CorvusInterpretation, CorvusSession, CorvusCapture, CorvusAttentionItem
from .capture import (
    get_pending_diffs, get_pending_images,
    get_pending_token_count, get_pending_image_count,
    get_last_app_id, get_frames_since_interpretation,
    get_adaptive_multiplier, get_time_in_current_app,
)
from .transcriber import get_pending_transcripts, get_pending_transcript_count
from .entities import get_recent_cross_app_entities, get_recent_entity_summary
import app.corvus.capture as capture_mod

client = anthropic.AsyncAnthropic()

# Trigger thresholds
TOKEN_THRESHOLD = 500       # Fire when this many text tokens are buffered
IMAGE_THRESHOLD = 5         # Fire when this many images are buffered
CHECK_INTERVAL_SECONDS = 5  # How often the loop checks triggers
PRIOR_CONTEXT_COUNT = 8     # Recent interpretations for immediate detail

MAX_ATTENTION_ITEMS = 100
MAX_CHAT_HISTORY = 20

EFFORT_PRESETS = {
    "low":    {"max_tokens": 120, "temperature": 0.3},
    "normal": {"max_tokens": 300, "temperature": 0.7},
    "high":   {"max_tokens": 600, "temperature": 0.9},
}

EFFORT_SYSTEM_SUFFIX = {
    "low":    "\n\nOne sentence max. Only speak up if something is urgent or clearly worth flagging.",
    "normal": "",
    "high":   "\n\nThink deeply. Explore multiple angles, suggest concrete next steps, and connect dots across what you've seen.",
}


TEXT_SYSTEM_PROMPT = """You are Corvus, a thinking partner who works alongside a user by watching
their screen. You receive text extracted from their shared screen — they choose what you see.

You have your prior thoughts for continuity. Build on them, don't repeat them.

Your job is to THINK WITH the user, not describe what you see. Based on what's on screen:
1. Offer ideas, suggestions, or angles they might not be considering
2. Spot connections, patterns, or risks worth raising
3. Ask a pointed question if something looks off or worth exploring
4. Flag anything time-sensitive they might miss while heads-down

Be a sharp coworker glancing at their screen and saying something useful.
2-3 sentences max. Never narrate what's on screen — they can see it. Add value or stay quiet.

If something is time-sensitive, urgent, or needs immediate attention, start your response with [!].
Only use [!] for things that genuinely warrant interrupting the user's focus.

When you detect actionable items, you may append structured actions on separate lines:
[ACTION:url:https://...] — link to open
[ACTION:remind:30m:Check build status] — set a reminder
These help the user act on your suggestions directly.

If there's nothing worth saying, respond with: "Nothing to add right now."
"""


VISION_SYSTEM_PROMPT = """You are Corvus, a thinking partner who works alongside a user by watching
their screen. You receive screenshots from their shared screen — they choose what you see.
Each image has OCR text as supplementary context.

You have your prior thoughts for continuity. Build on them, don't repeat them.

Your job is to THINK WITH the user, not describe what you see. Based on what's on screen:
1. Offer ideas, suggestions, or angles they might not be considering
2. Spot connections, patterns, or risks worth raising
3. Ask a pointed question if something looks off or worth exploring
4. Flag anything time-sensitive they might miss while heads-down

Be a sharp coworker glancing at their screen and saying something useful.
2-3 sentences max. Never narrate what's on screen — they can see it. Add value or stay quiet.

If something is time-sensitive, urgent, or needs immediate attention, start your response with [!].
Only use [!] for things that genuinely warrant interrupting the user's focus.

When you detect actionable items, you may append structured actions on separate lines:
[ACTION:url:https://...] — link to open
[ACTION:remind:30m:Check build status] — set a reminder
These help the user act on your suggestions directly.

If there's nothing worth saying, respond with: "Nothing to add right now."
"""


BRIEF_SYSTEM_PROMPT = """You maintain a running context brief for a thinking partner system. Condense the existing brief and the new thought into an updated brief (max 400 words). Preserve:
- What the user is working on and key decisions in play
- Open questions, risks, or ideas that were raised
- Important people, threads, or connections spotted
- Time-sensitive items

Drop anything resolved or no longer relevant. Write in compact bullet style."""


DIGEST_SYSTEM_PROMPT = """You are Corvus, generating an end-of-day digest. Synthesize all observations and conversations into a structured summary using this format:

## What You Worked On
- Key activities and focus areas

## Key Decisions & Outcomes
- Decisions made, conclusions reached

## Open Threads
- Unresolved questions, pending items, things to follow up on

## Notable Observations
- Patterns, risks, or insights worth remembering

Be concise and actionable. Use bullet points. Skip sections if empty."""


@dataclass
class InterpreterState:
    """Encapsulates all mutable interpreter state with an asyncio lock."""
    time_cap_seconds: int = 300
    effort_level: str = "normal"
    user_context: str = ""
    session_brief: str = ""
    _active_session_id: int | None = None
    _watch_items: list[str] = field(default_factory=list)
    _ignore_items: list[str] = field(default_factory=list)
    _chat_messages: list[dict] = field(default_factory=list)
    ygg_enabled: bool = False
    ygg_enrich_mode: str = "entities"
    ygg_project_path: str = ""
    current_interpretation_tokens: int = 0
    _last_interpretation_time: float = 0.0
    _last_app_id: str | None = None
    _last_interrupt_decision: str = "active"
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


interpreter_state = InterpreterState()


async def add_chat_message(text: str, timestamp: str):
    """Add a user chat message to the context."""
    async with interpreter_state.lock:
        interpreter_state._chat_messages.append({"text": text, "timestamp": timestamp})
        # Trim old messages
        while len(interpreter_state._chat_messages) > MAX_CHAT_HISTORY:
            interpreter_state._chat_messages.pop(0)


def get_chat_messages() -> list[dict]:
    return interpreter_state._chat_messages[:]


async def clear_chat_messages():
    async with interpreter_state.lock:
        interpreter_state._chat_messages.clear()


def get_interrupt_status() -> str:
    """Return current interrupt decision for dashboard display."""
    return interpreter_state._last_interrupt_decision


async def _should_fetch_ygg_context(ocr_text: str) -> bool:
    """Decide whether to query Yggdrasil based on enrich_mode and content heuristics."""
    if not interpreter_state.ygg_enabled:
        return False

    mode = interpreter_state.ygg_enrich_mode
    if mode == "never":
        return False
    if mode == "always":
        return True

    # "entities" mode: only query when domain-relevant entities are detected
    if mode == "entities":
        import re
        # Regulatory references, technical standards, ticket IDs
        domain_patterns = [
            r"\bFAR\s+\d",              # FAR clauses
            r"\bDFARS\b",               # Defense FAR Supplement
            r"\bMIL-STD-\d",            # Military standards
            r"\bAS\d{4}",               # AS quality standards
            r"\bSAE\s+\w",             # SAE standards
            r"\bISO\s+\d",             # ISO standards
            r"\bNIST\b",               # NIST frameworks
            r"\bITAR\b",               # Export controls
            r"\bCFR\b",                # Code of Federal Regulations
            r"\b[A-Z]{2,10}-\d{2,}",   # Ticket/reference patterns (PROJ-123)
        ]
        for pattern in domain_patterns:
            if re.search(pattern, ocr_text):
                return True
        return False

    return False


async def _fetch_ygg_context(query_text: str) -> str | None:
    """Fetch domain context from Yggdrasil (same process, via internal call)."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as http_client:
            payload = {"message": query_text}
            if interpreter_state.ygg_project_path:
                payload["project_path"] = interpreter_state.ygg_project_path
            resp = await http_client.post("http://127.0.0.1:8002/context", json=payload)
            resp.raise_for_status()
            result = resp.json()

        system_prompt = result.get("system_prompt", "")
        if not system_prompt or len(system_prompt) < 50:
            return None
        neurons_activated = result.get("neurons_activated", 0)
        intent = result.get("intent", "")
        departments = result.get("departments", [])
        context = f"=== DOMAIN KNOWLEDGE (from Yggdrasil — {neurons_activated} neurons) ===\n"
        if intent:
            context += f"Detected intent: {intent}\n"
        if departments:
            context += f"Relevant departments: {', '.join(departments)}\n"
        context += f"\n{system_prompt}"
        return context
    except Exception as e:
        print(f"[Corvus] Yggdrasil context fetch failed: {e}")
        return None


def _build_system_prompt(base_prompt: str, ygg_context: str | None = None) -> str:
    """Assemble system prompt with effort suffix, user context, Yggdrasil context, and attention steering."""
    system = base_prompt + EFFORT_SYSTEM_SUFFIX.get(interpreter_state.effort_level, "")
    if interpreter_state.user_context.strip():
        system += f"\n\n=== WHAT THE USER IS WORKING ON ===\n{interpreter_state.user_context.strip()}\nThink from this perspective. Your suggestions should be relevant to this focus."

    # Yggdrasil domain context injection
    if ygg_context:
        system += f"\n\n{ygg_context}\nUse this domain knowledge to inform your observations. Reference specific standards or concepts when relevant."

    # Attention steering
    if interpreter_state._watch_items:
        system += "\n\n=== PAY SPECIAL ATTENTION TO ===\n" + "\n".join(f"- {item}" for item in interpreter_state._watch_items)
        system += "\nPrioritize observations related to these topics."
    if interpreter_state._ignore_items:
        system += "\n\n=== DEPRIORITIZE / IGNORE ===\n" + "\n".join(f"- {item}" for item in interpreter_state._ignore_items)
        system += "\nDon't comment on these unless something truly urgent."

    return system


def _build_brief_prompt() -> str:
    """Build brief system prompt, including user context if set."""
    prompt = BRIEF_SYSTEM_PROMPT
    if interpreter_state.user_context.strip():
        prompt += f"\n\nThe user is focused on: {interpreter_state.user_context.strip()}\nWeight the brief toward this focus."
    return prompt


async def _save_session_brief():
    """Persist the current session brief to the database."""
    if not interpreter_state._active_session_id:
        return
    try:
        async with async_session() as db:
            session_obj = await db.get(CorvusSession, interpreter_state._active_session_id)
            if session_obj:
                session_obj.brief = interpreter_state.session_brief
                await db.commit()
    except Exception as e:
        print(f"[Corvus] Session save error: {e}")


async def _update_session_brief(new_summary: str):
    """Cheap Haiku call to condense session brief + new observation."""
    try:
        if interpreter_state.session_brief:
            user_msg = f"=== CURRENT BRIEF ===\n{interpreter_state.session_brief}\n\n=== NEW OBSERVATION ===\n{new_summary}"
        else:
            user_msg = f"=== FIRST OBSERVATION ===\n{new_summary}"

        # Include any recent user chat for the brief to absorb
        if interpreter_state._chat_messages:
            chat_text = "\n".join(f"- {m['text']}" for m in interpreter_state._chat_messages[-5:])
            user_msg += f"\n\n=== USER CLARIFICATIONS ===\n{chat_text}"

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=250,
            temperature=0.3,
            system=_build_brief_prompt(),
            messages=[{"role": "user", "content": user_msg}],
        )
        interpreter_state.session_brief = response.content[0].text
        print(f"[Corvus] Brief updated ({len(interpreter_state.session_brief)} chars)")

        # Auto-save to DB
        await _save_session_brief()
    except Exception as e:
        print(f"[Corvus] Brief update error: {e}")


async def _get_prior_context() -> str:
    """Build context from session brief + last few interpretations + entities."""
    parts = []

    if interpreter_state.session_brief:
        parts.append(f"=== RUNNING CONTEXT ===\n{interpreter_state.session_brief}")

    async with async_session() as db:
        result = await db.execute(
            select(CorvusInterpretation.summary, CorvusInterpretation.timestamp)
            .order_by(CorvusInterpretation.id.desc())
            .limit(PRIOR_CONTEXT_COUNT)
        )
        rows = result.all()

        if rows:
            recent = []
            for r in reversed(rows):
                recent.append(f"[{r.timestamp}] {r.summary}")
            parts.append("=== YOUR RECENT THOUGHTS ===\n" + "\n\n".join(recent))

        # Include user chat messages
        if interpreter_state._chat_messages:
            chat_lines = []
            for m in interpreter_state._chat_messages:
                chat_lines.append(f"[{m['timestamp']}] {m['text']}")
            parts.append("=== USER SAID ===\n" + "\n".join(chat_lines))

        # Include cross-app entity sightings
        try:
            cross_entities = await get_recent_cross_app_entities(minutes=30, limit=10)
            if cross_entities:
                entity_lines = []
                for e in cross_entities:
                    entity_lines.append(
                        f"- {e['value']} ({e['entity_type']}) seen in: {', '.join(e['apps'])} (last: {e['last_seen']})"
                    )
                parts.append("=== CROSS-APP ENTITIES ===\n" + "\n".join(entity_lines))
        except Exception:
            pass  # Entity table might not exist yet

        return "\n\n".join(parts)


async def _purge_interpreted_captures():
    """Delete captures that have been interpreted."""
    async with async_session() as db:
        # Delete duplicates
        await db.execute(sql_text("DELETE FROM corvus_captures WHERE is_duplicate = true"))
        # Get the latest interpretation's capture IDs
        result = await db.execute(
            select(CorvusInterpretation.capture_ids)
            .order_by(CorvusInterpretation.id.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row:
            try:
                ids = json.loads(row)
                if ids:
                    max_id = max(ids)
                    await db.execute(sql_text(
                        "DELETE FROM corvus_captures WHERE is_duplicate = false AND id <= :max_id"
                    ), {"max_id": max_id})
            except (json.JSONDecodeError, ValueError):
                pass
        await db.commit()


async def _should_interpret_now(trigger_reason: str) -> str:
    """Interrupt intelligence: decide whether to interrupt, defer, or skip.
    Returns: 'interrupt', 'defer', or 'skip'."""

    # Alert-triggered interpretations always interrupt
    if "alert" in trigger_reason.lower() or "user" in trigger_reason.lower() or "manual" in trigger_reason.lower():
        interpreter_state._last_interrupt_decision = "active"
        return "interrupt"

    # Check if any alert rules just fired (capture.py sets this)
    if capture_mod.capture_state.last_alert_fired:
        capture_mod.capture_state.last_alert_fired = False
        interpreter_state._last_interrupt_decision = "active"
        return "interrupt"

    # Heuristic: if user has been in the same app for >10 min and novelty is low, defer
    time_in_app = get_time_in_current_app()
    novelty = get_adaptive_multiplier()

    if time_in_app > 600 and novelty > 2.0:  # high multiplier = low novelty
        interpreter_state._last_interrupt_decision = "deferred"
        return "defer"

    # App switch always worth interpreting
    if "app switch" in trigger_reason.lower():
        interpreter_state._last_interrupt_decision = "active"
        return "interrupt"

    interpreter_state._last_interrupt_decision = "active"
    return "interrupt"


async def _run_text_interpretation(trigger_reason: str) -> str | None:
    """Text-mode interpretation: send OCR diffs to Haiku."""

    diffs = await get_pending_diffs()
    if not diffs:
        return None

    by_app: dict[str, list[str]] = {}
    all_ocr_text = []
    for d in diffs:
        by_app.setdefault(d["app_id"], []).append(
            f"[{d['timestamp']}]\n{d['diff_text']}"
        )
        all_ocr_text.append(d["diff_text"])

    context_parts = []
    for app_id, entries in by_app.items():
        context_parts.append(f"=== {app_id.upper()} ===\n" + "\n---\n".join(entries))

    prior_context = await _get_prior_context()

    # Fetch Yggdrasil domain context if applicable
    combined_ocr = " ".join(all_ocr_text)[:2000]
    ygg_context = None
    if await _should_fetch_ygg_context(combined_ocr):
        entity_summary = await get_recent_entity_summary()
        query_text = entity_summary + " " + combined_ocr[:500] if entity_summary else combined_ocr[:500]
        ygg_context = await _fetch_ygg_context(query_text)

    # Include audio transcripts if available
    transcripts = get_pending_transcripts()

    user_message = f"Trigger: {trigger_reason}\n\n"
    if prior_context:
        user_message += prior_context + "\n\n"
    if transcripts:
        user_message += "=== WHAT WAS SAID (audio) ===\n"
        for t in transcripts:
            user_message += f"[{t['timestamp']}] {t['text']}\n"
        user_message += "\n"
    user_message += "=== NEW DIFFS ===\n\n" + "\n\n".join(context_parts)

    interpreter_state.current_interpretation_tokens = int(len(user_message) / 4)

    preset = EFFORT_PRESETS.get(interpreter_state.effort_level, EFFORT_PRESETS["normal"])

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=preset["max_tokens"],
        temperature=preset["temperature"],
        system=_build_system_prompt(TEXT_SYSTEM_PROMPT, ygg_context),
        messages=[{"role": "user", "content": user_message}],
    )

    return response.content[0].text


async def _run_vision_interpretation(trigger_reason: str) -> str | None:
    """Vision-mode interpretation: send cropped images + OCR context to Haiku."""

    images = await get_pending_images()
    if not images:
        return None

    # Estimate tokens: ~1600 per image
    interpreter_state.current_interpretation_tokens = len(images) * 1600

    prior_context = await _get_prior_context()

    # Collect OCR text from images for Yggdrasil context check
    ocr_texts = [img.get("ocr_text", "") for img in images if img.get("ocr_text")]
    combined_ocr = " ".join(ocr_texts)[:2000]

    # Fetch Yggdrasil domain context if applicable
    ygg_context = None
    if combined_ocr and await _should_fetch_ygg_context(combined_ocr):
        entity_summary = await get_recent_entity_summary()
        query_text = entity_summary + " " + combined_ocr[:500] if entity_summary else combined_ocr[:500]
        ygg_context = await _fetch_ygg_context(query_text)

    # Build multi-part content
    content_parts = []

    # Include audio transcripts if available
    transcripts = get_pending_transcripts()

    preamble = f"Trigger: {trigger_reason}\n\n"
    if prior_context:
        preamble += prior_context + "\n\n"
    if transcripts:
        preamble += "=== WHAT WAS SAID (audio) ===\n"
        for t in transcripts:
            preamble += f"[{t['timestamp']}] {t['text']}\n"
        preamble += "\n"
    preamble += f"=== {len(images)} NEW SCREENSHOT(S) ==="
    content_parts.append({"type": "text", "text": preamble})

    for img in images:
        b64 = base64.b64encode(img["image_bytes"]).decode("utf-8")
        content_parts.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
        })
        content_parts.append({
            "type": "text",
            "text": f"[{img['app_id'].upper()} @ {img['timestamp']}]",
        })

    preset = EFFORT_PRESETS.get(interpreter_state.effort_level, EFFORT_PRESETS["normal"])

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=preset["max_tokens"],
        temperature=preset["temperature"],
        system=_build_system_prompt(VISION_SYSTEM_PROMPT, ygg_context),
        messages=[{"role": "user", "content": content_parts}],
    )

    return response.content[0].text


async def run_interpretation(trigger_reason: str) -> str | None:
    """Run interpretation in the current mode (vision or text)."""

    try:
        mode = capture_mod.capture_state.interpretation_mode
        if mode == "vision":
            summary = await _run_vision_interpretation(trigger_reason)
        else:
            summary = await _run_text_interpretation(trigger_reason)

        if not summary:
            return None

        interpreter_state._last_interpretation_time = time.time()

        # Store interpretation + purge captures
        async with async_session() as db:
            result = await db.execute(
                select(CorvusCapture.id).where(
                    CorvusCapture.is_duplicate == False,
                    CorvusCapture.app_id.isnot(None),
                ).order_by(CorvusCapture.id)
            )
            capture_ids = [r[0] for r in result.all()]

            interp = CorvusInterpretation(
                timestamp=datetime.datetime.now().isoformat(),
                summary=summary,
                capture_ids=json.dumps(capture_ids),
                session_id=interpreter_state._active_session_id,
            )
            db.add(interp)
            await db.commit()

        await _purge_interpreted_captures()

        # Update session brief with new observation
        await _update_session_brief(summary)

        interpreter_state.current_interpretation_tokens = 0
        return summary

    except Exception as e:
        print(f"[Corvus] Interpretation error: {e}")
        interpreter_state.current_interpretation_tokens = 0
        return None


async def run_file_interpretation(
    user_text: str,
    image_b64: str | None = None,
    media_type: str = "image/jpeg",
) -> str | None:
    """Interpret a user-attached file (image or text)."""

    try:
        prior_context = await _get_prior_context()
        preset = EFFORT_PRESETS.get(interpreter_state.effort_level, EFFORT_PRESETS["normal"])

        if image_b64:
            # Vision: send image + text
            content_parts = []
            if prior_context:
                content_parts.append({"type": "text", "text": prior_context + "\n\n"})
            content_parts.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": image_b64},
            })
            content_parts.append({"type": "text", "text": user_text})

            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=preset["max_tokens"],
                temperature=preset["temperature"],
                system=_build_system_prompt(VISION_SYSTEM_PROMPT),
                messages=[{"role": "user", "content": content_parts}],
            )
        else:
            # Text-only
            user_message = ""
            if prior_context:
                user_message += prior_context + "\n\n"
            user_message += user_text

            response = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=preset["max_tokens"],
                temperature=preset["temperature"],
                system=_build_system_prompt(TEXT_SYSTEM_PROMPT),
                messages=[{"role": "user", "content": user_message}],
            )

        summary = response.content[0].text
        interpreter_state._last_interpretation_time = time.time()

        # Store as interpretation
        async with async_session() as db:
            interp = CorvusInterpretation(
                timestamp=datetime.datetime.now().isoformat(),
                summary=summary,
                capture_ids="[]",
                session_id=interpreter_state._active_session_id,
            )
            db.add(interp)
            await db.commit()

        await _update_session_brief(summary)
        return summary

    except Exception as e:
        print(f"[Corvus] File interpretation error: {e}")
        return None


async def generate_digest(hours: float = 8.0) -> str | None:
    """Generate an end-of-day digest from recent session data."""
    try:
        cutoff = datetime.datetime.now() - timedelta(hours=hours)

        async with async_session() as db:
            result = await db.execute(
                select(CorvusInterpretation.timestamp, CorvusInterpretation.summary)
                .where(CorvusInterpretation.created_at >= cutoff)
                .order_by(CorvusInterpretation.id)
            )
            interps = result.all()

        if not interps:
            return None

        # Build the content for digest
        parts = []
        if interpreter_state.session_brief:
            parts.append(f"=== SESSION BRIEF ===\n{interpreter_state.session_brief}")

        thoughts = []
        for r in interps:
            thoughts.append(f"[{r.timestamp}] {r.summary}")
        parts.append("=== ALL OBSERVATIONS ===\n" + "\n\n".join(thoughts))

        if interpreter_state._chat_messages:
            chat_text = "\n".join(f"[{m['timestamp']}] {m['text']}" for m in interpreter_state._chat_messages)
            parts.append(f"=== USER MESSAGES ===\n{chat_text}")

        user_message = "\n\n".join(parts)

        system = DIGEST_SYSTEM_PROMPT
        if interpreter_state.user_context.strip():
            system += f"\n\nUser was focused on: {interpreter_state.user_context.strip()}"

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            temperature=0.5,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
        digest_text = response.content[0].text

        # Submit digest as observation to Yggdrasil
        if interpreter_state.ygg_enabled and digest_text:
            try:
                from .entities import get_recent_entities
                recent_entities = await get_recent_entities(minutes=int(hours * 60), limit=20)
                entity_list = [{"entity_type": e["entity_type"], "value": e["value"]} for e in recent_entities]
                import httpx
                async with httpx.AsyncClient(timeout=5.0) as http_client:
                    await http_client.post("http://127.0.0.1:8002/ingest/observation", json={
                        "source": "corvus",
                        "user_id": "corvus-local",
                        "observation_type": "digest",
                        "text": digest_text[:10000],
                        "entities": entity_list,
                        "app_context": "corvus_digest",
                    })
            except Exception as e:
                print(f"[Corvus] Yggdrasil digest submission error: {e}")

        return digest_text
    except Exception as e:
        print(f"[Corvus] Digest generation error: {e}")
        return None


async def init_session():
    """Load the most recent active session or create a new one on startup."""
    async with interpreter_state.lock:
        async with async_session() as db:
            try:
                # Try to resume the most recent session that has no ended_at
                result = await db.execute(
                    select(CorvusSession).where(CorvusSession.ended_at.is_(None))
                    .order_by(CorvusSession.id.desc()).limit(1)
                )
                row = result.scalar_one_or_none()

                if row:
                    interpreter_state._active_session_id = row.id
                    interpreter_state.session_brief = row.brief or ""
                    print(f"[Corvus] Resumed session #{interpreter_state._active_session_id} (brief: {len(interpreter_state.session_brief)} chars)")
                else:
                    # Check for any session with a brief (even if ended)
                    result = await db.execute(
                        select(CorvusSession).where(
                            CorvusSession.brief.isnot(None),
                            CorvusSession.brief != "",
                        ).order_by(CorvusSession.id.desc()).limit(1)
                    )
                    prev = result.scalar_one_or_none()
                    if prev:
                        # Create a new session but carry over the brief
                        interpreter_state.session_brief = prev.brief or ""
                        new_sess = CorvusSession(brief=interpreter_state.session_brief)
                        db.add(new_sess)
                        await db.flush()
                        interpreter_state._active_session_id = new_sess.id
                        await db.commit()
                        print(f"[Corvus] New session #{interpreter_state._active_session_id} (carried brief from #{prev.id})")
                    else:
                        # Fresh start
                        new_sess = CorvusSession()
                        db.add(new_sess)
                        await db.flush()
                        interpreter_state._active_session_id = new_sess.id
                        await db.commit()
                        print(f"[Corvus] New session #{interpreter_state._active_session_id} (fresh)")

                # Load attention items
                result = await db.execute(select(CorvusAttentionItem))
                items = result.scalars().all()
                interpreter_state._watch_items = [r.value for r in items if r.list_type == "watch"]
                interpreter_state._ignore_items = [r.value for r in items if r.list_type == "ignore"]
                if interpreter_state._watch_items or interpreter_state._ignore_items:
                    print(f"[Corvus] Attention: {len(interpreter_state._watch_items)} watch, {len(interpreter_state._ignore_items)} ignore")

            except Exception as e:
                print(f"[Corvus] Session init error: {e}")
                # Fallback: create new session
                try:
                    new_sess = CorvusSession()
                    db.add(new_sess)
                    await db.flush()
                    interpreter_state._active_session_id = new_sess.id
                    await db.commit()
                except Exception:
                    pass


async def new_session(label: str | None = None) -> dict:
    """End current session and start a new one."""
    async with interpreter_state.lock:
        async with async_session() as db:
            # End current session
            if interpreter_state._active_session_id:
                session_obj = await db.get(CorvusSession, interpreter_state._active_session_id)
                if session_obj:
                    session_obj.ended_at = func.now()

            # Create new session
            new_sess = CorvusSession(label=label)
            db.add(new_sess)
            await db.flush()
            interpreter_state._active_session_id = new_sess.id
            interpreter_state.session_brief = ""
            await db.commit()
            return {"id": interpreter_state._active_session_id, "label": label}


async def resume_session(session_id: int) -> dict | None:
    """Resume a previous session by loading its brief."""
    async with interpreter_state.lock:
        async with async_session() as db:
            # End current session
            if interpreter_state._active_session_id:
                current = await db.get(CorvusSession, interpreter_state._active_session_id)
                if current:
                    current.ended_at = func.now()

            # Load target session
            target = await db.get(CorvusSession, session_id)
            if not target:
                await db.commit()
                return None

            interpreter_state._active_session_id = target.id
            interpreter_state.session_brief = target.brief or ""

            # Re-open it (clear ended_at)
            target.ended_at = None
            await db.commit()

            return {
                "id": target.id,
                "label": target.label,
                "brief": interpreter_state.session_brief,
                "started_at": str(target.started_at) if target.started_at else None,
            }


async def list_sessions(limit: int = 20) -> list[dict]:
    """List recent sessions."""
    async with async_session() as db:
        result = await db.execute(
            select(
                CorvusSession.id,
                CorvusSession.started_at,
                CorvusSession.ended_at,
                CorvusSession.label,
                func.coalesce(func.length(CorvusSession.brief), 0).label("brief_length"),
            ).order_by(CorvusSession.id.desc()).limit(limit)
        )
        rows = result.all()
        return [
            {
                "id": r.id,
                "started_at": str(r.started_at) if r.started_at else None,
                "ended_at": str(r.ended_at) if r.ended_at else None,
                "label": r.label,
                "brief_length": r.brief_length,
                "active": r.id == interpreter_state._active_session_id,
            }
            for r in rows
        ]


async def set_attention(watch: list[str], ignore: list[str]):
    """Update attention steering lists."""
    interpreter_state._watch_items = watch[:MAX_ATTENTION_ITEMS]
    interpreter_state._ignore_items = ignore[:MAX_ATTENTION_ITEMS]

    async with async_session() as db:
        await db.execute(sql_text("DELETE FROM corvus_attention_items"))
        for item in watch:
            db.add(CorvusAttentionItem(list_type="watch", value=item))
        for item in ignore:
            db.add(CorvusAttentionItem(list_type="ignore", value=item))
        await db.commit()


def get_attention() -> dict:
    """Return current attention lists."""
    return {"watch": interpreter_state._watch_items[:], "ignore": interpreter_state._ignore_items[:]}


async def interpretation_loop():
    """Event-driven interpretation loop. Checks triggers every few seconds."""

    interpreter_state._last_interpretation_time = time.time()

    while True:
        try:
            await asyncio.sleep(CHECK_INTERVAL_SECONDS)

            mode = capture_mod.capture_state.interpretation_mode
            if mode == "vision":
                pending = get_pending_image_count()
            else:
                pending = get_pending_token_count()

            audio_pending = get_pending_transcript_count()
            frames_received = get_frames_since_interpretation()

            # Nothing at all — no frames and no audio
            if pending == 0 and frames_received == 0 and audio_pending == 0:
                continue

            now = time.time()
            time_since_last = now - interpreter_state._last_interpretation_time
            current_app = get_last_app_id()

            # Trigger: app switch (only if we have pending non-dup content)
            if pending > 0 and interpreter_state._last_app_id is not None and current_app != interpreter_state._last_app_id:
                old_app = interpreter_state._last_app_id
                interpreter_state._last_app_id = current_app
                trigger = f"App switch: {old_app} -> {current_app}"

                # Interrupt intelligence check
                decision = await _should_interpret_now(trigger)
                if decision == "defer":
                    continue

                result = await run_interpretation(trigger)
                if result:
                    print(f"[Corvus] App switch: {result[:120]}")
                continue

            interpreter_state._last_app_id = current_app

            # Trigger: threshold (only if we have pending non-dup content)
            if pending > 0:
                threshold = IMAGE_THRESHOLD if mode == "vision" else TOKEN_THRESHOLD
                if pending >= threshold:
                    trigger = f"Threshold ({pending} {'images' if mode == 'vision' else 'tokens'} buffered)"

                    decision = await _should_interpret_now(trigger)
                    if decision == "defer":
                        continue

                    result = await run_interpretation(trigger)
                    if result:
                        print(f"[Corvus] Threshold: {result[:120]}")
                    continue

            # Trigger: time cap with adaptive cadence
            # Skip when time_cap_seconds == 0 (manual mode)
            adaptive_cap = interpreter_state.time_cap_seconds * get_adaptive_multiplier()
            if interpreter_state.time_cap_seconds > 0 and time_since_last >= adaptive_cap and (frames_received > 0 or audio_pending > 0):
                trigger = f"Time cap ({int(time_since_last)}s since last)"

                decision = await _should_interpret_now(trigger)
                if decision == "defer":
                    continue

                result = await run_interpretation(trigger)
                if result:
                    print(f"[Corvus] Time cap: {result[:120]}")
                continue

        except Exception as e:
            print(f"[Corvus] Interpreter loop error: {e}")
