"""In-memory session store for bolster analyze→apply bridge."""

import time
import uuid

_TTL_SECONDS = 3600  # 1 hour
_store: dict[str, tuple[float, dict]] = {}  # session_id → (expires_at, data)


def _purge_expired() -> None:
    now = time.time()
    expired = [k for k, (exp, _) in _store.items() if exp < now]
    for k in expired:
        del _store[k]


def create_session(data: dict) -> str:
    _purge_expired()
    session_id = uuid.uuid4().hex
    _store[session_id] = (time.time() + _TTL_SECONDS, data)
    return session_id


def get_session(session_id: str) -> dict | None:
    entry = _store.get(session_id)
    if entry is None:
        return None
    expires_at, data = entry
    if time.time() > expires_at:
        del _store[session_id]
        return None
    return data
