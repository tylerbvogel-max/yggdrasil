"""System banner evidence provider — verify AC-8 system use notification."""

import time
from datetime import datetime, timezone

import httpx

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

BASE_URL = "http://localhost:8002"


async def _test_system_banner_active() -> EvidenceResult:
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/admin/system-banner", timeout=10)
    elapsed = int((time.monotonic() - start) * 1000)

    data = resp.json() if resp.status_code == 200 else {}
    enabled = data.get("enabled", False)
    banner_text = data.get("banner_text", "")
    passed = enabled and len(banner_text) > 10

    return EvidenceResult(
        provider_id="system-banner-active",
        passed=passed,
        detail={
            "enabled": enabled,
            "banner_text_length": len(banner_text),
            "banner_preview": banner_text[:100] if banner_text else "",
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


registry.register_provider(EvidenceProvider(
    id="system-banner-active",
    title="System use banner is active",
    description="Verify GET /admin/system-banner returns enabled=True with non-empty text",
    evidence_type=EvidenceType.automated_test,
    test_fn=_test_system_banner_active,
    code_refs=["backend/app/routers/compliance.py:25-38"],
    controls={
        "fedramp": ["AC-8"],
        "cmmc": ["3.1.9"],
    },
))
