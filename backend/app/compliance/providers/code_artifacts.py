"""Code artifact evidence providers — verify code files exist and contain expected patterns."""

import time
from datetime import datetime, timezone
from pathlib import Path

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

APP_DIR = Path(__file__).parent.parent.parent  # backend/app/
BACKEND_DIR = APP_DIR.parent  # backend/


async def _test_code_audit_middleware() -> EvidenceResult:
    start = time.monotonic()
    audit_path = APP_DIR / "middleware" / "audit.py"
    main_path = APP_DIR / "main.py"
    audit_exists = audit_path.exists()
    imported = False
    if main_path.exists():
        content = main_path.read_text()
        imported = "AuditMiddleware" in content
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="code-audit-middleware",
        passed=audit_exists and imported,
        detail={"file_exists": audit_exists, "imported_in_main": imported},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_code_security_headers() -> EvidenceResult:
    start = time.monotonic()
    path = APP_DIR / "middleware" / "security_headers.py"
    main_path = APP_DIR / "main.py"
    exists = path.exists()
    imported = False
    if main_path.exists():
        content = main_path.read_text()
        imported = "SecurityHeadersMiddleware" in content
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="code-security-headers",
        passed=exists and imported,
        detail={"file_exists": exists, "imported_in_main": imported},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_code_exception_handler() -> EvidenceResult:
    start = time.monotonic()
    main_path = APP_DIR / "main.py"
    has_handler = False
    if main_path.exists():
        content = main_path.read_text()
        has_handler = "@app.exception_handler(Exception)" in content or "global_exception_handler" in content
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="code-exception-handler",
        passed=has_handler,
        detail={"global_exception_handler": has_handler},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_code_input_guard() -> EvidenceResult:
    start = time.monotonic()
    path = APP_DIR / "services" / "input_guard.py"
    exists = path.exists()
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="code-input-guard",
        passed=exists,
        detail={"file_exists": exists, "path": str(path)},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


_PROVIDERS = [
    ("code-audit-middleware", "Audit middleware present and imported",
     "Verify audit.py exists and is imported in main.py",
     _test_code_audit_middleware,
     {"fedramp": ["AU-2"], "cmmc": ["3.3.1"], "soc2": ["CC7.2"]},
     ["backend/app/middleware/audit.py", "backend/app/main.py:11"]),
    ("code-security-headers", "Security headers middleware present",
     "Verify security_headers.py exists and is imported",
     _test_code_security_headers,
     {"fedramp": ["SC-10"], "soc2": ["CC6.1"]},
     ["backend/app/middleware/security_headers.py", "backend/app/main.py:12"]),
    ("code-exception-handler", "Global exception handler registered",
     "Verify global exception handler in main.py",
     _test_code_exception_handler,
     {"fedramp": ["SI-11"]},
     ["backend/app/main.py:456-470"]),
    ("code-input-guard", "Input guard service present",
     "Verify input_guard.py exists",
     _test_code_input_guard,
     {"fedramp": ["SC-18", "SI-10"], "cmmc": ["3.13.1"]},
     ["backend/app/services/input_guard.py"]),
]

for pid, title, desc, fn, controls, refs in _PROVIDERS:
    registry.register_provider(EvidenceProvider(
        id=pid, title=title, description=desc,
        evidence_type=EvidenceType.code_artifact,
        test_fn=fn,
        code_refs=refs,
        controls=controls,
    ))
