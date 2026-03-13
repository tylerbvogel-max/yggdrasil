"""Entity extraction and cross-app linking for Corvus (PostgreSQL)."""

import re
from sqlalchemy import select, text as sql_text, func
from app.database import async_session
from app.models_corvus import CorvusEntity

# Regex patterns for entity extraction
ENTITY_PATTERNS = {
    "ticket": r"\b(?!ERR|ERROR|WARN|FATAL)[A-Z][A-Z0-9]{1,9}-\d+\b",
    "email": r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b",
    "url": r"https?://[^\s<>\"']+",
    "mention": r"(?<!\w)@[\w][\w.-]*(?![\w@.])",
    "error_code": r"\b(?:ERR|ERROR|WARN|FATAL)[-_]?\d{3,}\b",
}


def extract_entities(text: str) -> list[dict]:
    """Extract structured entities from OCR text."""
    if not text:
        return []
    entities = []
    seen = set()
    for entity_type, pattern in ENTITY_PATTERNS.items():
        for match in re.finditer(pattern, text, re.IGNORECASE if entity_type == "error_code" else 0):
            value = match.group(0)
            if entity_type == "ticket":
                value = value.upper()
            elif entity_type == "mention":
                value = value.lower()
            key = (entity_type, value)
            if key not in seen:
                seen.add(key)
                entities.append({"entity_type": entity_type, "value": value})
    return entities


async def store_entities(entities: list[dict], app_id: str, timestamp: str, capture_id: int | None = None):
    """Store extracted entities in the database."""
    if not entities:
        return
    async with async_session() as db:
        for e in entities:
            db.add(CorvusEntity(
                entity_type=e["entity_type"],
                value=e["value"],
                app_id=app_id,
                timestamp=timestamp,
                capture_id=capture_id,
            ))
        await db.commit()


async def get_recent_cross_app_entities(minutes: int = 30, limit: int = 20) -> list[dict]:
    """Find entities that appeared in multiple apps recently."""
    async with async_session() as db:
        result = await db.execute(sql_text("""
            SELECT value, entity_type,
                   STRING_AGG(DISTINCT app_id, ',') as apps,
                   COUNT(DISTINCT app_id) as app_count,
                   MAX(timestamp) as last_seen
            FROM corvus_entities
            WHERE created_at >= NOW() - make_interval(mins => :mins)
            GROUP BY value, entity_type
            HAVING COUNT(DISTINCT app_id) > 1
            ORDER BY MAX(timestamp) DESC
            LIMIT :lim
        """), {"mins": minutes, "lim": limit})
        rows = result.fetchall()
        return [
            {
                "value": r.value,
                "entity_type": r.entity_type,
                "apps": r.apps.split(",") if r.apps else [],
                "app_count": r.app_count,
                "last_seen": r.last_seen,
            }
            for r in rows
        ]


async def get_recent_entity_summary(minutes: int = 15, limit: int = 15) -> str:
    """Build a concise query string from recent entities for context lookup."""
    entities = await get_recent_entities(minutes=minutes, limit=limit)
    if not entities:
        return ""
    seen = set()
    values = []
    for e in entities:
        val = e["value"]
        if val not in seen:
            seen.add(val)
            values.append(val)
    return " ".join(values)


async def get_recent_entities(minutes: int = 15, limit: int = 30) -> list[dict]:
    """Get recently seen entities with their app context."""
    async with async_session() as db:
        result = await db.execute(sql_text("""
            SELECT value, entity_type, app_id, timestamp
            FROM corvus_entities
            WHERE created_at >= NOW() - make_interval(mins => :mins)
            ORDER BY timestamp DESC
            LIMIT :lim
        """), {"mins": minutes, "lim": limit})
        rows = result.fetchall()
        return [
            {
                "value": r.value,
                "entity_type": r.entity_type,
                "app_id": r.app_id,
                "timestamp": r.timestamp,
            }
            for r in rows
        ]
