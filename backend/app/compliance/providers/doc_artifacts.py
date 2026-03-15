"""Document artifact evidence providers — verify governance docs exist."""

import time
from datetime import datetime, timezone
from pathlib import Path

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent  # yggdrasil/backend -> yggdrasil/
DOCS_DIR = PROJECT_ROOT / "docs"


def _make_doc_provider(pid: str, title: str, filename: str, controls: dict[str, list[str]]) -> EvidenceProvider:
    async def test_fn() -> EvidenceResult:
        start = time.monotonic()
        path = DOCS_DIR / filename
        exists = path.exists()
        size = path.stat().st_size if exists else 0
        elapsed = int((time.monotonic() - start) * 1000)
        return EvidenceResult(
            provider_id=pid,
            passed=exists and size > 0,
            detail={"file_exists": exists, "size_bytes": size, "path": str(path)},
            collected_at=datetime.now(timezone.utc),
            duration_ms=elapsed,
        )

    return EvidenceProvider(
        id=pid, title=title,
        description=f"Verify {filename} exists in docs/",
        evidence_type=EvidenceType.doc_artifact,
        test_fn=test_fn,
        code_refs=[f"docs/{filename}"],
        controls=controls,
    )


registry.register_provider(_make_doc_provider(
    "doc-governance", "Governance documentation exists", "governance.md",
    {"soc2": ["CC1.3", "CC5.3"], "iso42001": ["CL5.2"]},
))

registry.register_provider(_make_doc_provider(
    "doc-risk-map", "Risk map documentation exists", "risk-map.md",
    {"fedramp": ["RA-3"], "soc2": ["CC3.2"], "cmmc": ["3.11.1"]},
))

registry.register_provider(_make_doc_provider(
    "doc-system-card", "System card documentation exists", "system-card.md",
    {"eu_ai_act": ["Art11.1", "Art13.2"], "iso42001": ["A.9.2"]},
))


def _make_content_doc_provider(
    pid: str, title: str, filename: str, keywords: list[str], controls: dict[str, list[str]],
) -> EvidenceProvider:
    """Provider that checks a doc exists AND contains specific keywords."""
    async def test_fn() -> EvidenceResult:
        start = time.monotonic()
        path = DOCS_DIR / filename
        exists = path.exists()
        has_content = False
        found_keywords: list[str] = []
        if exists:
            content = path.read_text().lower()
            found_keywords = [kw for kw in keywords if kw.lower() in content]
            has_content = len(found_keywords) > 0
        elapsed = int((time.monotonic() - start) * 1000)
        return EvidenceResult(
            provider_id=pid,
            passed=exists and has_content,
            detail={
                "file_exists": exists,
                "required_keywords": keywords,
                "found_keywords": found_keywords,
                "path": str(path),
            },
            collected_at=datetime.now(timezone.utc),
            duration_ms=elapsed,
        )

    return EvidenceProvider(
        id=pid, title=title,
        description=f"Verify {filename} exists and contains safety analysis content",
        evidence_type=EvidenceType.doc_artifact,
        test_fn=test_fn,
        code_refs=[f"docs/{filename}"],
        controls=controls,
    )


registry.register_provider(_make_content_doc_provider(
    "nasa-safety-analysis",
    "Software safety analysis documentation",
    "risk-map.md",
    ["hazard", "failure mode", "mitigation"],
    {"nasa": ["NPR-1"]},
))
