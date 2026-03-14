"""Config check evidence providers — direct import of app.config.settings."""

import time
from datetime import datetime, timezone

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType


async def _test_session_timeout() -> EvidenceResult:
    from app.config import settings
    start = time.monotonic()
    passed = settings.session_timeout_minutes <= 30
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="config-session-timeout",
        passed=passed,
        detail={"session_timeout_minutes": settings.session_timeout_minutes, "max_allowed": 30},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_banner_enabled() -> EvidenceResult:
    from app.config import settings
    start = time.monotonic()
    passed = settings.system_use_banner_enabled is True
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="config-banner-enabled",
        passed=passed,
        detail={"system_use_banner_enabled": settings.system_use_banner_enabled},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_no_default_creds() -> EvidenceResult:
    from app.config import settings
    start = time.monotonic()
    db_url = settings.database_url
    bad_creds = ["password", "admin:admin", "postgres:postgres", "root:root"]
    has_default = any(cred in db_url.lower() for cred in bad_creds)
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="config-no-default-creds",
        passed=not has_default,
        detail={"has_default_creds": has_default, "db_url_masked": db_url[:20] + "..."},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_api_key_set() -> EvidenceResult:
    from app.config import settings
    start = time.monotonic()
    passed = bool(settings.anthropic_api_key and len(settings.anthropic_api_key) > 10)
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="config-api-key-set",
        passed=passed,
        detail={"api_key_set": passed, "key_length": len(settings.anthropic_api_key) if settings.anthropic_api_key else 0},
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


registry.register_provider(EvidenceProvider(
    id="config-session-timeout",
    title="Session timeout <= 30 minutes",
    description="Verify session timeout configuration is at most 30 minutes",
    evidence_type=EvidenceType.config_check,
    test_fn=_test_session_timeout,
    code_refs=["backend/app/config.py"],
    controls={"fedramp": ["AC-12"]},
))

registry.register_provider(EvidenceProvider(
    id="config-banner-enabled",
    title="System use banner enabled",
    description="Verify system use banner is enabled in configuration",
    evidence_type=EvidenceType.config_check,
    test_fn=_test_banner_enabled,
    code_refs=["backend/app/config.py"],
    controls={"fedramp": ["AC-8"], "cmmc": ["3.1.9"]},
))

registry.register_provider(EvidenceProvider(
    id="config-no-default-creds",
    title="No default credentials in database URL",
    description="Verify database URL does not contain default credentials",
    evidence_type=EvidenceType.config_check,
    test_fn=_test_no_default_creds,
    code_refs=["backend/app/config.py"],
    controls={"fedramp": ["IA-5"], "cmmc": ["3.5.10"]},
))

registry.register_provider(EvidenceProvider(
    id="config-api-key-set",
    title="Anthropic API key configured",
    description="Verify Anthropic API key is set and non-empty",
    evidence_type=EvidenceType.config_check,
    test_fn=_test_api_key_set,
    code_refs=["backend/app/config.py"],
    controls={"fedramp": ["IA-5"]},
))
