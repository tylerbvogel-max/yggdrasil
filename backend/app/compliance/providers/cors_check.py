"""CORS evidence provider — verify restrictive CORS configuration."""

import time
from datetime import datetime, timezone

import httpx

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

BASE_URL = "http://localhost:8002"


async def _test_cors_restrictive() -> EvidenceResult:
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        resp = await client.options(
            f"{BASE_URL}/health",
            headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "GET"},
            timeout=10,
        )
    elapsed = int((time.monotonic() - start) * 1000)

    # Should NOT have Access-Control-Allow-Origin for unauthorized origin
    acao = resp.headers.get("access-control-allow-origin", "")
    passed = acao != "*" and "evil.example.com" not in acao

    return EvidenceResult(
        provider_id="cors-restrictive",
        passed=passed,
        detail={
            "unauthorized_origin": "https://evil.example.com",
            "acao_header": acao or "(absent)",
            "rejected": passed,
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


registry.register_provider(EvidenceProvider(
    id="cors-restrictive",
    title="CORS rejects unauthorized origins",
    description="Verify OPTIONS with unauthorized Origin is rejected",
    evidence_type=EvidenceType.automated_test,
    test_fn=_test_cors_restrictive,
    code_refs=["backend/app/main.py:440-445"],
    controls={
        "fedramp": ["AC-4"],
        "soc2": ["CC6.1"],
    },
))
