"""Audit log evidence providers — verify mutation logging and redaction."""

import time
from datetime import datetime, timezone

import httpx

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

BASE_URL = "http://localhost:8002"


async def _test_audit_captures_mutations() -> EvidenceResult:
    """POST to /admin/seed (idempotent), then check audit log for the entry."""
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        # Trigger a POST that creates an audit log entry
        await client.post(f"{BASE_URL}/admin/seed", timeout=15)
        # Check audit log for recent entries
        resp = await client.get(f"{BASE_URL}/admin/audit-log?limit=5", timeout=10)
    elapsed = int((time.monotonic() - start) * 1000)

    entries = resp.json() if resp.status_code == 200 else []
    has_post = any(e.get("action") == "POST" for e in entries)

    return EvidenceResult(
        provider_id="audit-log-captures-mutations",
        passed=has_post,
        detail={
            "recent_entries": len(entries),
            "has_post_entry": has_post,
            "sample": entries[0] if entries else None,
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_audit_redacts_sensitive() -> EvidenceResult:
    """POST with a body containing 'password' field, verify redaction in audit log."""
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        # POST with sensitive field — use a safe endpoint
        await client.post(
            f"{BASE_URL}/admin/seed",
            json={"password": "test123", "api_key": "secret"},
            timeout=15,
        )
        resp = await client.get(f"{BASE_URL}/admin/audit-log?limit=3", timeout=10)
    elapsed = int((time.monotonic() - start) * 1000)

    entries = resp.json() if resp.status_code == 200 else []
    # Check that no entry contains the raw password
    redacted = True
    for e in entries:
        body = e.get("request_body_summary", "") or ""
        if "test123" in body or "secret" in body:
            redacted = False
            break

    return EvidenceResult(
        provider_id="audit-log-redacts-sensitive",
        passed=redacted,
        detail={
            "checked_entries": len(entries),
            "all_redacted": redacted,
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


registry.register_provider(EvidenceProvider(
    id="audit-log-captures-mutations",
    title="Audit log captures POST mutations",
    description="Verify that POST requests create audit log entries",
    evidence_type=EvidenceType.automated_test,
    test_fn=_test_audit_captures_mutations,
    code_refs=["backend/app/middleware/audit.py"],
    controls={
        "fedramp": ["AU-2", "AU-3", "AU-12"],
        "cmmc": ["3.3.1"],
        "soc2": ["CC7.2"],
    },
))

registry.register_provider(EvidenceProvider(
    id="audit-log-redacts-sensitive",
    title="Audit log redacts sensitive fields",
    description="Verify that password/api_key fields are redacted in audit log",
    evidence_type=EvidenceType.automated_test,
    test_fn=_test_audit_redacts_sensitive,
    code_refs=["backend/app/middleware/audit.py:36-59"],
    controls={
        "fedramp": ["AU-3"],
        "cmmc": ["3.3.6"],
    },
))
