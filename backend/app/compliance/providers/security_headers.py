"""Security header evidence providers — one per header, HTTP GETs /health."""

import time
from datetime import datetime, timezone

import httpx

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

BASE_URL = "http://localhost:8002"


def _make_header_provider(
    provider_id: str,
    header_name: str,
    expected_substring: str,
    title: str,
    controls: dict[str, list[str]],
) -> EvidenceProvider:

    async def test_fn() -> EvidenceResult:
        start = time.monotonic()
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BASE_URL}/health", timeout=10)
        elapsed = int((time.monotonic() - start) * 1000)
        header_val = resp.headers.get(header_name, "")
        passed = expected_substring.lower() in header_val.lower()
        return EvidenceResult(
            provider_id=provider_id,
            passed=passed,
            detail={
                "header": header_name,
                "expected": expected_substring,
                "actual": header_val or "(missing)",
                "status_code": resp.status_code,
            },
            collected_at=datetime.now(timezone.utc),
            duration_ms=elapsed,
        )

    return EvidenceProvider(
        id=provider_id,
        title=title,
        description=f"Verify {header_name} header contains '{expected_substring}'",
        evidence_type=EvidenceType.automated_test,
        test_fn=test_fn,
        code_refs=["backend/app/middleware/security_headers.py"],
        controls=controls,
    )


async def _test_session_timeout() -> EvidenceResult:
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/health", timeout=10)
    elapsed = int((time.monotonic() - start) * 1000)
    val = resp.headers.get("X-Session-Timeout", "0")
    try:
        passed = int(val) > 0
    except ValueError:
        passed = False
    return EvidenceResult(
        provider_id="sec-header-x-session-timeout",
        passed=passed,
        detail={"header": "X-Session-Timeout", "expected": "> 0", "actual": val},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


_HEADERS = [
    ("sec-header-x-frame-options", "X-Frame-Options", "SAMEORIGIN", "X-Frame-Options set to SAMEORIGIN",
     {"fedramp": ["SC-10"], "cmmc": ["3.13.9"], "soc2": ["CC6.1"]}),
    ("sec-header-hsts", "Strict-Transport-Security", "max-age=", "HSTS header present",
     {"fedramp": ["SC-8"], "cmmc": ["3.13.8"]}),
    ("sec-header-csp", "Content-Security-Policy", "default-src", "CSP header with default-src",
     {"fedramp": ["SC-18"], "soc2": ["CC6.7"]}),
    ("sec-header-x-content-type-options", "X-Content-Type-Options", "nosniff", "X-Content-Type-Options nosniff",
     {"fedramp": ["SC-28"]}),
    ("sec-header-cache-control", "Cache-Control", "no-store", "Cache-Control no-store",
     {"fedramp": ["SC-28"]}),
    ("sec-header-x-xss-protection", "X-XSS-Protection", "1; mode=block", "X-XSS-Protection enabled",
     {"fedramp": ["SC-18"]}),
    ("sec-header-referrer-policy", "Referrer-Policy", "strict-origin", "Referrer-Policy set",
     {"fedramp": ["SC-7"]}),
    ("sec-header-permissions-policy", "Permissions-Policy", "camera=()", "Permissions-Policy restrictive",
     {"fedramp": ["SC-7"]}),
]

for pid, header, expected, title, controls in _HEADERS:
    registry.register_provider(_make_header_provider(pid, header, expected, title, controls))

# Session timeout has custom logic (checks > 0, not just substring)
registry.register_provider(EvidenceProvider(
    id="sec-header-x-session-timeout",
    title="X-Session-Timeout present (> 0)",
    description="Verify X-Session-Timeout header value > 0",
    evidence_type=EvidenceType.automated_test,
    test_fn=_test_session_timeout,
    code_refs=["backend/app/middleware/security_headers.py"],
    controls={"fedramp": ["AC-12"], "cmmc": ["3.1.11"]},
))
