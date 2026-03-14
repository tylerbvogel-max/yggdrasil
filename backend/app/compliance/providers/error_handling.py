"""Error handling evidence provider — verify sanitized error responses."""

import time
from datetime import datetime, timezone

import httpx

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

BASE_URL = "http://localhost:8002"


async def _test_error_sanitization() -> EvidenceResult:
    """Request a nonexistent endpoint to trigger error handling, verify no stack trace."""
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/neurons/99999999", timeout=10)
    elapsed = int((time.monotonic() - start) * 1000)

    body_text = resp.text.lower()
    # Should not contain stack trace indicators
    has_traceback = any(kw in body_text for kw in ["traceback", "file \"", "line ", "raise ", "exception"])
    # Should contain generic error message or 404
    is_sanitized = resp.status_code in (404, 500) and not has_traceback

    return EvidenceResult(
        provider_id="error-sanitization",
        passed=is_sanitized,
        detail={
            "status_code": resp.status_code,
            "has_traceback": has_traceback,
            "body_preview": resp.text[:200],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


registry.register_provider(EvidenceProvider(
    id="error-sanitization",
    title="Error responses are sanitized (no stack traces)",
    description="Verify error responses return generic message without implementation details",
    evidence_type=EvidenceType.automated_test,
    test_fn=_test_error_sanitization,
    code_refs=["backend/app/main.py:456-470"],
    controls={
        "fedramp": ["SI-11"],
        "soc2": ["CC7.4"],
    },
))
