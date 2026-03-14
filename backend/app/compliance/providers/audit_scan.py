"""Audit scan providers — wraps existing compliance audit endpoint."""

import time
from datetime import datetime, timezone

import httpx

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

BASE_URL = "http://localhost:8002"


async def _fetch_compliance_audit() -> dict:
    """Fetch the existing compliance audit data."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/admin/compliance-audit", timeout=60)
    if resp.status_code != 200:
        return {}
    return resp.json()


async def _test_pii_scan() -> EvidenceResult:
    start = time.monotonic()
    data = await _fetch_compliance_audit()
    elapsed = int((time.monotonic() - start) * 1000)
    pii = data.get("pii_scan", {})
    clean = pii.get("clean", False)
    return EvidenceResult(
        provider_id="audit-pii-scan",
        passed=clean,
        detail={
            "clean": clean,
            "total_findings": pii.get("total_findings", -1),
            "neurons_with_pii": pii.get("neurons_with_pii", -1),
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_bias_coverage() -> EvidenceResult:
    start = time.monotonic()
    data = await _fetch_compliance_audit()
    elapsed = int((time.monotonic() - start) * 1000)
    bias = data.get("bias_assessment", {})
    cv = bias.get("coverage_cv", 999)
    passed = cv < 0.5  # Below 0.5 is acceptable
    return EvidenceResult(
        provider_id="audit-bias-coverage",
        passed=passed,
        detail={
            "coverage_cv": cv,
            "threshold": 0.5,
            "imbalanced": bias.get("coverage_imbalanced", True),
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_provenance_citations() -> EvidenceResult:
    start = time.monotonic()
    data = await _fetch_compliance_audit()
    elapsed = int((time.monotonic() - start) * 1000)
    prov = data.get("provenance_audit", {})
    missing = prov.get("missing_citations_count", -1)
    passed = missing == 0
    return EvidenceResult(
        provider_id="audit-provenance-citations",
        passed=passed,
        detail={
            "missing_citations_count": missing,
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_scoring_stability() -> EvidenceResult:
    start = time.monotonic()
    data = await _fetch_compliance_audit()
    elapsed = int((time.monotonic() - start) * 1000)
    validity = data.get("validity_reliability", {})
    cv = validity.get("cross_validation", {})
    all_stable = all(v.get("stable", False) for v in cv.values()) if cv else False
    return EvidenceResult(
        provider_id="audit-scoring-stability",
        passed=all_stable,
        detail={
            "cross_validation_signals": {k: v.get("stable", False) for k, v in cv.items()} if cv else {},
            "total_evals": validity.get("total_evals", 0),
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


_PROVIDERS = [
    ("audit-pii-scan", "PII scan clean",
     "No PII detected in neuron content",
     _test_pii_scan,
     {"fedramp": ["SI-12"], "soc2": ["P1.1"], "cmmc": ["3.1.3"]}),
    ("audit-bias-coverage", "Department coverage balanced",
     "Department coverage CV below threshold",
     _test_bias_coverage,
     {"soc2": ["CC3.2"], "aiuc": ["SOC-1"]}),
    ("audit-provenance-citations", "All citations present",
     "No neurons missing required citations",
     _test_provenance_citations,
     {"nasa": ["NPR-9"], "iso42001": ["A.7.4"]}),
    ("audit-scoring-stability", "Scoring baselines stable",
     "Cross-validation shows stable scoring",
     _test_scoring_stability,
     {"nasa": ["NPR-7"], "aiuc": ["REL-1"]}),
]

for pid, title, desc, fn, controls in _PROVIDERS:
    registry.register_provider(EvidenceProvider(
        id=pid, title=title, description=desc,
        evidence_type=EvidenceType.automated_test,
        test_fn=fn,
        code_refs=["backend/app/routers/admin.py"],
        controls=controls,
    ))
