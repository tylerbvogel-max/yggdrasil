"""Git and repo inspection evidence providers — NASA NPR 7150.2D controls."""

import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent  # providers -> compliance -> app -> backend -> yggdrasil/
BACKEND_DIR = PROJECT_ROOT / "backend"
DOCS_DIR = PROJECT_ROOT / "docs"


async def _test_git_traceability() -> EvidenceResult:
    """NPR-2: Configuration management — git commit traceability."""
    start = time.monotonic()
    violations: list[dict] = []
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-50"],
            capture_output=True, text=True, timeout=10,
            cwd=str(PROJECT_ROOT),
        )
        if result.returncode != 0:
            elapsed = int((time.monotonic() - start) * 1000)
            return EvidenceResult(
                provider_id="nasa-git-traceability",
                passed=False,
                detail={"error": "git log failed", "stderr": result.stderr},
                collected_at=datetime.now(timezone.utc),
                duration_ms=elapsed,
            )
        lines = [ln.strip() for ln in result.stdout.strip().split("\n") if ln.strip()]
        bad_patterns = re.compile(r"\b(fixup|wip|temp|xxx|todo)\b", re.IGNORECASE)
        for line in lines:
            # format: "abcdef1 commit message"
            parts = line.split(" ", 1)
            sha = parts[0]
            msg = parts[1] if len(parts) > 1 else ""
            if len(msg) < 10:
                violations.append({"sha": sha, "message": msg, "reason": "message too short (<10 chars)"})
            elif bad_patterns.search(msg):
                violations.append({"sha": sha, "message": msg, "reason": "contains fixup/wip/temp pattern"})
    except Exception as e:
        elapsed = int((time.monotonic() - start) * 1000)
        return EvidenceResult(
            provider_id="nasa-git-traceability",
            passed=False,
            detail={"error": str(e)},
            collected_at=datetime.now(timezone.utc),
            duration_ms=elapsed,
        )

    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-git-traceability",
        passed=len(violations) == 0,
        detail={
            "commits_checked": len(lines),
            "violations": len(violations),
            "samples": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_formal_inspection() -> EvidenceResult:
    """NPR-4: Formal inspection — review policy documentation exists."""
    start = time.monotonic()
    checks: dict[str, bool] = {}

    # Check for CLAUDE.md or review policy file at repo root
    review_policy_files = ["CLAUDE.md", "REVIEW.md", "CONTRIBUTING.md"]
    has_policy = any((PROJECT_ROOT / f).exists() for f in review_policy_files)
    checks["review_policy_file_exists"] = has_policy

    # Check governance.md for review/inspection section
    gov_path = DOCS_DIR / "governance.md"
    has_inspection_section = False
    if gov_path.exists():
        content = gov_path.read_text().lower()
        has_inspection_section = "review" in content or "inspection" in content
    checks["governance_has_review_section"] = has_inspection_section

    passed = has_policy and has_inspection_section
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-formal-inspection",
        passed=passed,
        detail=checks,
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_test_coverage() -> EvidenceResult:
    """NPR-5: Testing and verification — sufficient test coverage."""
    start = time.monotonic()
    tests_dir = BACKEND_DIR / "tests"

    test_files: list[str] = []
    test_function_count = 0

    if tests_dir.exists():
        for f in tests_dir.rglob("test_*.py"):
            test_files.append(str(f.relative_to(BACKEND_DIR)))
            content = f.read_text()
            test_function_count += content.count("\ndef test_")
            test_function_count += content.count("\n    def test_")

    passed = len(test_files) >= 5 and test_function_count >= 30
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-test-coverage",
        passed=passed,
        detail={
            "test_files": len(test_files),
            "test_functions": test_function_count,
            "min_files_required": 5,
            "min_functions_required": 30,
            "file_list": test_files,
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_software_classification() -> EvidenceResult:
    """NPR-6: Software classification — system card with classification info."""
    start = time.monotonic()
    sys_card = DOCS_DIR / "system-card.md"
    exists = sys_card.exists()
    has_classification = False
    if exists:
        content = sys_card.read_text().lower()
        has_classification = "classification" in content or "criticality" in content

    passed = exists and has_classification
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-software-classification",
        passed=passed,
        detail={
            "system_card_exists": exists,
            "has_classification_content": has_classification,
            "path": str(sys_card),
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_dependency_pinning() -> EvidenceResult:
    """NPR-8: Third-party software management — all deps pinned with ==."""
    start = time.monotonic()
    req_path = BACKEND_DIR / "requirements.txt"
    unpinned: list[dict] = []
    total_deps = 0

    if req_path.exists():
        for line in req_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue
            total_deps += 1
            if "==" not in line:
                unpinned.append({"dependency": line, "reason": "not pinned with =="})

    passed = req_path.exists() and len(unpinned) == 0 and total_deps > 0
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-dependency-pinning",
        passed=passed,
        detail={
            "requirements_exists": req_path.exists(),
            "total_dependencies": total_deps,
            "unpinned_count": len(unpinned),
            "unpinned": unpinned[:20],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_power_of_ten_coverage() -> EvidenceResult:
    """NPR-10: Safety-critical coding standards — all JPL rules have providers."""
    start = time.monotonic()
    jpl_controls = [f"JPL-{i}" for i in range(1, 11)]
    covered: list[str] = []
    uncovered: list[str] = []

    for cid in jpl_controls:
        providers = registry.get_providers_for_control("nasa", cid)
        if providers:
            covered.append(cid)
        else:
            uncovered.append(cid)

    passed = len(uncovered) == 0
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-power-of-ten-coverage",
        passed=passed,
        detail={
            "total_jpl_controls": len(jpl_controls),
            "covered": len(covered),
            "uncovered_controls": uncovered,
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


_PROVIDERS = [
    ("nasa-git-traceability", "Git commit traceability", "NPR-2: descriptive commits, no fixup/wip", _test_git_traceability, EvidenceType.config_check, {"nasa": ["NPR-2"]}),
    ("nasa-formal-inspection", "Formal inspection policy", "NPR-4: review policy docs exist", _test_formal_inspection, EvidenceType.doc_artifact, {"nasa": ["NPR-4"]}),
    ("nasa-test-coverage", "Test coverage verification", "NPR-5: sufficient test files and functions", _test_test_coverage, EvidenceType.config_check, {"nasa": ["NPR-5"]}),
    ("nasa-software-classification", "Software classification docs", "NPR-6: system card with classification", _test_software_classification, EvidenceType.doc_artifact, {"nasa": ["NPR-6"]}),
    ("nasa-dependency-pinning", "Dependencies pinned", "NPR-8: all deps use == pinning", _test_dependency_pinning, EvidenceType.config_check, {"nasa": ["NPR-8"]}),
    ("nasa-power-of-ten-coverage", "Power of Ten full coverage", "NPR-10: all JPL-1 through JPL-10 have providers", _test_power_of_ten_coverage, EvidenceType.config_check, {"nasa": ["NPR-10"]}),
]

for pid, title, desc, fn, etype, controls in _PROVIDERS:
    registry.register_provider(EvidenceProvider(
        id=pid, title=title, description=desc,
        evidence_type=etype,
        test_fn=fn,
        code_refs=["backend/app/compliance/providers/git_checks.py"],
        controls=controls,
    ))
