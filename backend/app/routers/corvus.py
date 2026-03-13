"""Corvus screen-watcher endpoints — integrated into Yggdrasil."""

import json
import re
import asyncio
import base64
from datetime import datetime

from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import Response
from sqlalchemy import select, func, text as sql_text

from app.database import async_session
from app.models_corvus import (
    CorvusCapture, CorvusInterpretation, CorvusKnownApp, CorvusSession,
    CorvusAlertRule, CorvusEntity, CorvusCustomApp, CorvusAttentionItem,
)
from app.corvus.capture import (
    process_frame, latest_frame_bytes, crop_regions, interpretation_mode,
    get_pending_token_count, get_pending_image_count,
    get_novelty_state, load_custom_apps,
)
from app.corvus.interpreter import (
    run_interpretation, generate_digest, init_session, new_session,
    resume_session, list_sessions, set_attention, get_attention,
    get_interrupt_status, add_chat_message, get_chat_messages,
    clear_chat_messages, run_file_interpretation,
)
from app.corvus.transcriber import (
    transcribe_audio, add_transcript, get_total_transcript_count,
)
from app.corvus.computer_use import plan_action, MAX_ACTIONS
from app.corvus.classifier import set_custom_apps
from app.corvus.entities import get_recent_entities, get_recent_cross_app_entities
import app.corvus.interpreter as interpreter_mod
import app.corvus.capture as capture_mod

router = APIRouter(prefix="/corvus", tags=["corvus"])


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "corvus", "version": "0.3.0"}


@router.get("/status")
async def get_status():
    async with async_session() as db:
        result = await db.execute(sql_text(
            "SELECT COUNT(*) FROM corvus_captures WHERE is_duplicate = false"
        ))
        capture_count = result.scalar() or 0

        result = await db.execute(sql_text("SELECT COUNT(*) FROM corvus_interpretations"))
        interp_count = result.scalar() or 0

        result = await db.execute(sql_text(
            "SELECT COALESCE(SUM(LENGTH(ocr_text)), 0) FROM corvus_captures "
            "WHERE is_duplicate = false AND ocr_text IS NOT NULL"
        ))
        total_chars = result.scalar() or 0
        total_tokens = int(total_chars / 4)

    mode = capture_mod.interpretation_mode
    if mode == "vision":
        pending = get_pending_image_count() * 1600
    else:
        pending = get_pending_token_count()
    from app.corvus.interpreter import current_interpretation_tokens
    current_tokens = current_interpretation_tokens if current_interpretation_tokens > 0 else pending

    return {
        "status": "running",
        "captures_stored": capture_count,
        "interpretations": interp_count,
        "total_tokens": total_tokens,
        "current_tokens": current_tokens,
        "interpretation_mode": mode,
        "audio_transcripts": get_total_transcript_count(),
        "active_session_id": interpreter_mod._active_session_id,
        "interrupt_status": get_interrupt_status(),
    }


@router.post("/capture")
async def receive_capture(
    frame: UploadFile,
    timestamp: str = Form(...),
    width: str = Form("0"),
    height: str = Form("0"),
):
    frame_bytes = await frame.read()
    result = await process_frame(
        frame_bytes=frame_bytes,
        timestamp=timestamp,
        width=int(width),
        height=int(height),
    )
    return result


@router.post("/audio-chunk")
async def receive_audio_chunk(
    audio: UploadFile,
    timestamp: str = Form(...),
    chat: str = Form(""),
):
    audio_bytes = await audio.read()
    mime_type = audio.content_type or "audio/webm"
    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, transcribe_audio, audio_bytes, mime_type)
    if text:
        if chat:
            ts = timestamp if timestamp else datetime.now().isoformat()
            add_chat_message(text, ts)
            result = await run_interpretation(f"User voice message: {text[:80]}")
            return {"status": "chat", "text": text, "summary": result, "timestamp": ts}
        else:
            add_transcript(text, timestamp)
            return {"status": "transcribed", "text": text, "length": len(text)}
    return {"status": "silent", "text": None}


@router.get("/recent")
async def recent_captures():
    async with async_session() as db:
        result = await db.execute(
            select(CorvusCapture).where(
                CorvusCapture.is_duplicate == False,
                CorvusCapture.app_id.isnot(None),
            ).order_by(CorvusCapture.id.desc()).limit(50)
        )
        rows = result.scalars().all()
        return [
            {
                "id": r.id, "timestamp": r.timestamp, "app_id": r.app_id,
                "ocr_text": r.ocr_text or "", "has_frame": r.frame_path is not None,
            }
            for r in rows
        ]


@router.get("/interpretations")
async def recent_interpretations():
    async with async_session() as db:
        result = await db.execute(
            select(CorvusInterpretation)
            .order_by(CorvusInterpretation.id.desc()).limit(20)
        )
        rows = result.scalars().all()
        return [
            {"id": r.id, "timestamp": r.timestamp, "summary": r.summary}
            for r in rows
        ]


@router.get("/latest-frame")
async def latest_frame():
    from app.corvus.capture import latest_frame_bytes
    if latest_frame_bytes:
        return Response(content=latest_frame_bytes, media_type="image/jpeg")
    return Response(status_code=204)


@router.get("/queued-images")
async def queued_images():
    from PIL import Image
    from io import BytesIO
    from app.corvus.capture import _pending_images
    results = []
    for img in _pending_images:
        pil = Image.open(BytesIO(img["image_bytes"]))
        pil.thumbnail((200, 120), Image.LANCZOS)
        buf = BytesIO()
        pil.save(buf, format="JPEG", quality=60)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        results.append({"thumbnail": b64, "app_id": img["app_id"], "timestamp": img["timestamp"]})
    return results


@router.post("/settings/interpretation-cadence")
async def set_interpretation_cadence(seconds: int = Form(...)):
    seconds = max(0, min(3600, seconds))
    interpreter_mod.time_cap_seconds = seconds
    return {"time_cap_seconds": seconds}


@router.get("/settings/interpretation-cadence")
async def get_interpretation_cadence():
    return {"time_cap_seconds": interpreter_mod.time_cap_seconds}


@router.post("/settings/effort")
async def set_effort(level: str = Form(...)):
    if level not in ("low", "normal", "high"):
        level = "normal"
    interpreter_mod.effort_level = level
    return {"effort_level": level}


@router.get("/settings/effort")
async def get_effort():
    return {"effort_level": interpreter_mod.effort_level}


@router.post("/settings/context")
async def set_context(context: str = Form("")):
    interpreter_mod.user_context = context
    return {"context": context}


@router.get("/settings/context")
async def get_context():
    return {"context": interpreter_mod.user_context}


@router.post("/chat")
async def post_chat(message: str = Form(...), timestamp: str = Form("")):
    ts = timestamp if timestamp else datetime.now().isoformat()
    add_chat_message(message, ts)
    result = await run_interpretation(f"User message: {message[:80]}")
    return {"status": "ok", "timestamp": ts, "summary": result}


@router.get("/chat")
async def get_chat():
    return get_chat_messages()


@router.post("/chat-file")
async def chat_with_file(
    file: UploadFile,
    message: str = Form(""),
    timestamp: str = Form(""),
):
    ts = timestamp if timestamp else datetime.now().isoformat()
    file_bytes = await file.read()
    filename = file.filename or "file"
    content_type = file.content_type or ""
    user_text = message.strip() if message.strip() else f"Here's a file: {filename}"
    add_chat_message(f"[Attached: {filename}] {user_text}", ts)

    is_image = content_type.startswith("image/") or filename.lower().endswith(
        (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")
    )
    if is_image:
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        media = content_type if content_type.startswith("image/") else "image/jpeg"
        result = await run_file_interpretation(user_text=user_text, image_b64=b64, media_type=media)
    else:
        try:
            text_content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text_content = file_bytes.decode("latin-1")
        if len(text_content) > 20000:
            text_content = text_content[:20000] + "\n\n... (truncated)"
        result = await run_file_interpretation(user_text=f"{user_text}\n\n=== FILE: {filename} ===\n{text_content}")

    return {"status": "ok", "filename": filename, "summary": result, "timestamp": ts}


@router.post("/pin/{interp_id}")
async def toggle_pin(interp_id: int):
    async with async_session() as db:
        interp = await db.get(CorvusInterpretation, interp_id)
        if not interp:
            return {"error": "not found"}
        interp.is_pinned = not interp.is_pinned
        await db.commit()
        return {"id": interp_id, "is_pinned": interp.is_pinned}


@router.get("/pinned")
async def get_pinned():
    async with async_session() as db:
        result = await db.execute(
            select(CorvusInterpretation).where(CorvusInterpretation.is_pinned == True)
            .order_by(CorvusInterpretation.id.desc())
        )
        rows = result.scalars().all()
        return [{"id": r.id, "timestamp": r.timestamp, "summary": r.summary} for r in rows]


@router.post("/digest")
async def create_digest(hours: float = Form(8.0)):
    result = await generate_digest(hours)
    if result:
        return {"digest": result}
    return {"digest": None, "reason": "no interpretations in time range"}


@router.post("/interpret-now")
async def interpret_now():
    result = await run_interpretation("Manual trigger")
    if result:
        return {"summary": result}
    return {"summary": None, "reason": "no pending content"}


@router.get("/session-brief")
async def get_session_brief():
    return {"brief": interpreter_mod.session_brief}


@router.post("/session-brief")
async def set_session_brief(brief: str = Form("")):
    interpreter_mod.session_brief = brief
    return {"brief": brief}


@router.post("/clear-log")
async def clear_log():
    async with async_session() as db:
        await db.execute(sql_text("DELETE FROM corvus_captures"))
        await db.execute(sql_text("DELETE FROM corvus_interpretations"))
        await db.commit()
    interpreter_mod.session_brief = ""
    clear_chat_messages()
    return {"cleared": True}


@router.post("/soft-reset")
async def soft_reset():
    async with async_session() as db:
        await db.execute(sql_text("DELETE FROM corvus_captures"))
        await db.execute(sql_text("DELETE FROM corvus_interpretations"))
        await db.commit()
    clear_chat_messages()
    return {"cleared": True, "brief_kept": True}


@router.post("/settings/interpretation-mode")
async def set_interpretation_mode(mode: str = Form(...)):
    if mode not in ("vision", "text"):
        mode = "vision"
    capture_mod.interpretation_mode = mode
    return {"interpretation_mode": mode}


@router.get("/settings/interpretation-mode")
async def get_interpretation_mode():
    return {"interpretation_mode": capture_mod.interpretation_mode}


@router.post("/settings/crop-region")
async def set_crop_region(
    app_id: str = Form(...),
    left: float = Form(0.0),
    top: float = Form(0.0),
    right: float = Form(1.0),
    bottom: float = Form(1.0),
):
    region = {
        "left": max(0.0, min(1.0, left)),
        "top": max(0.0, min(1.0, top)),
        "right": max(0.0, min(1.0, right)),
        "bottom": max(0.0, min(1.0, bottom)),
    }
    if region["left"] <= 0.01 and region["top"] <= 0.01 and region["right"] >= 0.99 and region["bottom"] >= 0.99:
        capture_mod.crop_regions.pop(app_id, None)
    else:
        capture_mod.crop_regions[app_id] = region
    return {"app_id": app_id, "region": region}


@router.get("/settings/crop-regions")
async def get_crop_regions():
    return capture_mod.crop_regions


@router.delete("/settings/crop-region/{app_id}")
async def delete_crop_region(app_id: str):
    capture_mod.crop_regions.pop(app_id, None)
    return {"deleted": app_id}


@router.get("/history")
async def get_history(limit: int = 100, search: str = ""):
    async with async_session() as db:
        q = select(CorvusInterpretation).order_by(CorvusInterpretation.id.desc()).limit(limit)
        if search:
            q = q.where(CorvusInterpretation.summary.ilike(f"%{search}%"))
        result = await db.execute(q)
        rows = result.scalars().all()
        return [{"id": r.id, "timestamp": r.timestamp, "summary": r.summary} for r in rows]


@router.post("/alert-rules")
async def create_alert_rule(pattern: str = Form(...), app_filter: str = Form("")):
    async with async_session() as db:
        rule = CorvusAlertRule(pattern=pattern, app_filter=app_filter or None)
        db.add(rule)
        await db.commit()
        return {"status": "created"}


@router.get("/alert-rules")
async def list_alert_rules():
    async with async_session() as db:
        result = await db.execute(select(CorvusAlertRule).order_by(CorvusAlertRule.id))
        rows = result.scalars().all()
        return [
            {"id": r.id, "pattern": r.pattern, "app_filter": r.app_filter, "enabled": r.enabled}
            for r in rows
        ]


@router.patch("/alert-rules/{rule_id}")
async def update_alert_rule(rule_id: int, enabled: str = Form(...)):
    async with async_session() as db:
        rule = await db.get(CorvusAlertRule, rule_id)
        if rule:
            rule.enabled = enabled in ("1", "true", "True")
            await db.commit()
        return {"id": rule_id, "enabled": bool(rule.enabled) if rule else False}


@router.delete("/alert-rules/{rule_id}")
async def delete_alert_rule(rule_id: int):
    async with async_session() as db:
        rule = await db.get(CorvusAlertRule, rule_id)
        if rule:
            await db.delete(rule)
            await db.commit()
        return {"deleted": rule_id}


@router.get("/settings/adaptive-cadence")
async def get_adaptive_cadence():
    return get_novelty_state()


@router.post("/sessions/new")
async def create_new_session(label: str = Form("")):
    result = await new_session(label=label or None)
    return result


@router.get("/sessions")
async def get_sessions():
    return await list_sessions()


@router.post("/sessions/{session_id}/resume")
async def resume_session_endpoint(session_id: int):
    result = await resume_session(session_id)
    if result:
        return result
    return {"error": "session not found"}


@router.patch("/sessions/{session_id}/label")
async def update_session_label(session_id: int, label: str = Form(...)):
    async with async_session() as db:
        session = await db.get(CorvusSession, session_id)
        if session:
            session.label = label
            await db.commit()
        return {"id": session_id, "label": label}


@router.get("/settings/attention")
async def get_attention_settings():
    return get_attention()


@router.post("/settings/attention")
async def set_attention_settings(watch: str = Form("[]"), ignore: str = Form("[]")):
    try:
        watch_list = json.loads(watch)
        ignore_list = json.loads(ignore)
    except json.JSONDecodeError:
        watch_list, ignore_list = [], []
    await set_attention(watch_list, ignore_list)
    return {"watch": watch_list, "ignore": ignore_list}


@router.post("/apps/teach")
async def teach_app(label: str = Form(...), ocr_snapshot: str = Form("")):
    url_patterns = []
    text_patterns = []
    if ocr_snapshot:
        urls = re.findall(r'([\w.-]+\.[\w.-]+(?:/[\w.-]*)*)', ocr_snapshot)
        seen = set()
        for url in urls:
            parts = url.split(".")
            if len(parts) >= 2:
                domain = ".".join(parts[-2:]).lower()
                if domain not in seen and domain not in ("co.uk", "com.au"):
                    seen.add(domain)
                    url_patterns.append(re.escape(domain))
        text_patterns.append(re.escape(label.lower()))
    label_clean = label.strip().lower().replace(" ", "_")
    async with async_session() as db:
        existing = await db.execute(
            select(CorvusCustomApp).where(CorvusCustomApp.label == label_clean)
        )
        app = existing.scalar_one_or_none()
        if app:
            app.url_patterns = json.dumps(url_patterns[:5])
            app.text_patterns = json.dumps(text_patterns[:5])
        else:
            db.add(CorvusCustomApp(
                label=label_clean,
                url_patterns=json.dumps(url_patterns[:5]),
                text_patterns=json.dumps(text_patterns[:5]),
            ))
        await db.commit()
    await load_custom_apps()
    return {"label": label_clean, "url_patterns": url_patterns[:5], "text_patterns": text_patterns[:5]}


@router.get("/apps")
async def list_apps():
    async with async_session() as db:
        result = await db.execute(select(CorvusKnownApp).order_by(CorvusKnownApp.id))
        known = result.scalars().all()
        result = await db.execute(select(CorvusCustomApp).order_by(CorvusCustomApp.id))
        custom = result.scalars().all()
        return {
            "known": [{"id": r.id, "name": r.name, "description": r.description} for r in known],
            "custom": [{"id": r.id, "label": r.label, "url_patterns": r.url_patterns, "text_patterns": r.text_patterns} for r in custom],
        }


@router.delete("/apps/{app_id}")
async def delete_custom_app(app_id: int):
    async with async_session() as db:
        app = await db.get(CorvusCustomApp, app_id)
        if app:
            await db.delete(app)
            await db.commit()
    await load_custom_apps()
    return {"deleted": app_id}


@router.get("/entities")
async def get_entities(minutes: int = 30):
    return await get_recent_entities(minutes=minutes)


@router.get("/entities/cross-app")
async def get_cross_app_entities(minutes: int = 30):
    return await get_recent_cross_app_entities(minutes=minutes)


@router.get("/timeline")
async def get_timeline(date: str = ""):
    async with async_session() as db:
        if date:
            result = await db.execute(sql_text("""
                SELECT app_id, MIN(timestamp) as start_time, MAX(timestamp) as end_time,
                       COUNT(*) as frame_count
                FROM corvus_captures
                WHERE DATE(created_at) = :dt
                  AND app_id IS NOT NULL AND is_duplicate = false
                GROUP BY app_id, EXTRACT(HOUR FROM created_at),
                         FLOOR(EXTRACT(MINUTE FROM created_at) / 15)
                ORDER BY start_time
            """), {"dt": date})
        else:
            result = await db.execute(sql_text("""
                SELECT app_id, MIN(timestamp) as start_time, MAX(timestamp) as end_time,
                       COUNT(*) as frame_count
                FROM corvus_captures
                WHERE DATE(created_at) = CURRENT_DATE
                  AND app_id IS NOT NULL AND is_duplicate = false
                GROUP BY app_id, EXTRACT(HOUR FROM created_at),
                         FLOOR(EXTRACT(MINUTE FROM created_at) / 15)
                ORDER BY start_time
            """))
        blocks = result.fetchall()

        if date:
            result = await db.execute(sql_text("""
                SELECT id, timestamp, summary FROM corvus_interpretations
                WHERE DATE(created_at) = :dt ORDER BY timestamp
            """), {"dt": date})
        else:
            result = await db.execute(sql_text("""
                SELECT id, timestamp, summary FROM corvus_interpretations
                WHERE DATE(created_at) = CURRENT_DATE ORDER BY timestamp
            """))
        interps = result.fetchall()

        return {
            "blocks": [
                {"app_id": b.app_id, "start": b.start_time, "end": b.end_time, "frames": b.frame_count}
                for b in blocks
            ],
            "interpretations": [
                {"id": i.id, "timestamp": i.timestamp, "summary": i.summary}
                for i in interps
            ],
        }


@router.get("/interrupt-status")
async def interrupt_status():
    return {"status": get_interrupt_status()}


@router.post("/computer-use/action")
async def computer_use_action(
    screenshot: UploadFile = None,
    command: str = Form(...),
    history: str = Form("[]"),
    viewport_width: int = Form(0),
    viewport_height: int = Form(0),
):
    action_history = json.loads(history) if history else []
    if len(action_history) >= MAX_ACTIONS:
        return {"action": "fail", "reason": f"Safety limit: max {MAX_ACTIONS} actions reached"}
    screenshot_b64 = ""
    if screenshot:
        raw = await screenshot.read()
        screenshot_b64 = base64.b64encode(raw).decode("utf-8")
    result = await plan_action(
        screenshot_b64=screenshot_b64,
        command=command,
        history=action_history,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
    )
    return result


@router.get("/settings/yggdrasil")
async def get_yggdrasil_settings():
    return {
        "enabled": interpreter_mod.ygg_enabled,
        "url": "http://localhost:8002",
        "project_path": interpreter_mod.ygg_project_path,
        "enrich_mode": interpreter_mod.ygg_enrich_mode,
    }


@router.post("/settings/yggdrasil")
async def set_yggdrasil_settings(
    enabled: str = Form(""),
    url: str = Form(""),
    project_path: str = Form(""),
    enrich_mode: str = Form(""),
):
    if enabled:
        interpreter_mod.ygg_enabled = enabled.lower() in ("true", "1", "yes")
    if project_path:
        interpreter_mod.ygg_project_path = project_path
    if enrich_mode and enrich_mode in ("always", "entities", "never"):
        interpreter_mod.ygg_enrich_mode = enrich_mode
    return {
        "enabled": interpreter_mod.ygg_enabled,
        "url": "http://localhost:8002",
        "project_path": interpreter_mod.ygg_project_path,
        "enrich_mode": interpreter_mod.ygg_enrich_mode,
    }


@router.post("/test-ygg-context")
async def test_ygg_context(text: str = Form("reviewing FAR 52.219 subcontracting plan")):
    from app.corvus.interpreter import _fetch_ygg_context
    result = await _fetch_ygg_context(text)
    if result:
        return {"status": "ok", "context_length": len(result), "context_preview": result[:500]}
    return {"status": "no_result", "reason": "No context returned"}
