"""Audit logging middleware for state-changing API requests.

Logs all POST, PUT, DELETE, PATCH requests to the audit_log table.
GET requests are not logged (read-only, no state change).

Addresses: NIST 800-53 AU-2, AU-3, AU-4, AU-8, AU-12
           CMMC 3.3.1, 3.3.5, 3.3.6
           SOC 2 CC7.2, CC7.3
           FedRAMP Moderate AU family
"""

import json
import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.database import async_session
from app.models import AuditLog

logger = logging.getLogger(__name__)

# Endpoints to skip (high-frequency, non-security-relevant)
SKIP_ENDPOINTS = {
    "/corvus/frame",       # Screen captures — too frequent, logged separately
    "/health",             # Health check
    "/corvus/latest-frame", # Frame retrieval
}

# Max bytes of request body to store (prevent bloat from image uploads etc.)
MAX_BODY_SUMMARY = 2000

# Fields to redact from request body summaries
REDACT_FIELDS = {"password", "secret", "token", "api_key", "apikey", "authorization"}


def _redact_body(body_bytes: bytes) -> str:
    """Parse and redact sensitive fields from request body. Returns truncated string."""
    if not body_bytes:
        return ""
    try:
        text = body_bytes.decode("utf-8", errors="replace")
        # Try to parse as JSON and redact sensitive fields
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                for key in list(data.keys()):
                    if key.lower() in REDACT_FIELDS:
                        data[key] = "[REDACTED]"
                text = json.dumps(data, default=str)
        except (json.JSONDecodeError, TypeError):
            pass
        if len(text) > MAX_BODY_SUMMARY:
            return text[:MAX_BODY_SUMMARY] + f"... (truncated, {len(text)} bytes total)"
        return text
    except Exception:
        return f"[binary, {len(body_bytes)} bytes]"


class AuditMiddleware(BaseHTTPMiddleware):
    """Log state-changing requests to the audit_log table."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Only log state-changing methods
        if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
            return await call_next(request)

        # Skip high-frequency endpoints
        path = request.url.path
        if path in SKIP_ENDPOINTS:
            return await call_next(request)

        # Read request body for summary (must cache for downstream handlers)
        body_bytes = await request.body()
        body_summary = _redact_body(body_bytes)

        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")[:500]

        start = time.monotonic()
        response = await call_next(request)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        status_code = response.status_code
        error_detail = None
        if status_code >= 400:
            error_detail = f"HTTP {status_code}"

        # Write audit record asynchronously (don't block the response)
        try:
            async with async_session() as db:
                record = AuditLog(
                    action=request.method,
                    endpoint=path[:500],
                    status_code=status_code,
                    user_agent=user_agent,
                    client_ip=client_ip,
                    request_body_summary=body_summary if body_summary else None,
                    response_time_ms=elapsed_ms,
                    error_detail=error_detail,
                )
                db.add(record)
                await db.commit()
        except Exception as e:
            # AU-5: Log audit failures — but never block the response
            logger.error("Audit log write failed: %s", e)

        return response
