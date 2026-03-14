"""Static analysis evidence providers — NASA/JPL rules via Python AST."""

import ast
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

APP_DIR = Path(__file__).parent.parent.parent  # backend/app/

# Cache by git hash
_cache: dict[str, dict] = {}


def _get_git_hash() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
            cwd=str(APP_DIR.parent),
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


class FunctionAnalyzer(ast.NodeVisitor):
    """Collect per-function stats: name, file, lineno, line_count, assertion_count, has_recursion, has_bare_except."""

    def __init__(self, filepath: str) -> None:
        self.filepath = filepath
        self.functions: list[dict] = []
        self._current_func: str | None = None

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._analyze_func(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._analyze_func(node)

    def _analyze_func(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        end_line = getattr(node, "end_lineno", node.lineno + 1) or node.lineno + 1
        line_count = end_line - node.lineno

        assertion_count = 0
        has_recursion = False
        has_bare_except = False

        for child in ast.walk(node):
            if isinstance(child, ast.Assert):
                assertion_count += 1
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id == node.name:
                    has_recursion = True
            if isinstance(child, ast.ExceptHandler):
                if child.type is None:
                    has_bare_except = True

        self.functions.append({
            "name": node.name,
            "file": self.filepath,
            "lineno": node.lineno,
            "line_count": line_count,
            "assertion_count": assertion_count,
            "has_recursion": has_recursion,
            "has_bare_except": has_bare_except,
        })

        self.generic_visit(node)


def _scan_all_functions() -> list[dict]:
    """Scan all .py files under backend/app/, return function stats."""
    git_hash = _get_git_hash()
    if git_hash in _cache:
        return _cache[git_hash]

    all_functions: list[dict] = []
    for root, _dirs, files in os.walk(APP_DIR):
        for f in files:
            if not f.endswith(".py"):
                continue
            filepath = os.path.join(root, f)
            rel_path = os.path.relpath(filepath, APP_DIR.parent)
            try:
                source = open(filepath).read()
                tree = ast.parse(source, filename=filepath)
                analyzer = FunctionAnalyzer(rel_path)
                analyzer.visit(tree)
                all_functions.extend(analyzer.functions)
            except (SyntaxError, UnicodeDecodeError):
                continue

    _cache[git_hash] = all_functions
    return all_functions


def _check_mutable_globals() -> list[dict]:
    """Heuristic: find module-level mutable dicts/lists (not in functions/classes)."""
    violations: list[dict] = []
    for root, _dirs, files in os.walk(APP_DIR):
        for f in files:
            if not f.endswith(".py"):
                continue
            filepath = os.path.join(root, f)
            rel_path = os.path.relpath(filepath, APP_DIR.parent)
            try:
                source = open(filepath).read()
                tree = ast.parse(source, filename=filepath)
            except (SyntaxError, UnicodeDecodeError):
                continue

            for node in ast.iter_child_nodes(tree):
                if isinstance(node, ast.Assign):
                    if isinstance(node.value, (ast.Dict, ast.List)):
                        for target in node.targets:
                            if isinstance(target, ast.Name) and not target.id.startswith("_"):
                                violations.append({
                                    "file": rel_path,
                                    "lineno": node.lineno,
                                    "name": target.id,
                                    "type": "dict" if isinstance(node.value, ast.Dict) else "list",
                                })
    return violations


async def _test_function_length() -> EvidenceResult:
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["line_count"] > 60]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-function-length",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "violations": len(violations),
            "max_allowed": 60,
            "worst_offenders": sorted(violations, key=lambda x: -x["line_count"])[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_assertion_density() -> EvidenceResult:
    start = time.monotonic()
    functions = _scan_all_functions()
    # Only check non-trivial functions (> 5 lines)
    nontrivial = [f for f in functions if f["line_count"] > 5]
    violations = [f for f in nontrivial if f["assertion_count"] < 2]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-assertion-density",
        passed=len(violations) == 0,
        detail={
            "total_nontrivial_functions": len(nontrivial),
            "violations": len(violations),
            "min_assertions": 2,
            "sample_violations": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_no_recursion() -> EvidenceResult:
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["has_recursion"]]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-no-recursion",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "recursive_functions": len(violations),
            "violations": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_no_bare_except() -> EvidenceResult:
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["has_bare_except"]]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-no-bare-except",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "bare_except_functions": len(violations),
            "violations": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_no_mutable_globals() -> EvidenceResult:
    start = time.monotonic()
    violations = _check_mutable_globals()
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-no-mutable-globals",
        passed=len(violations) == 0,
        detail={
            "violations": len(violations),
            "samples": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


_PROVIDERS = [
    ("nasa-function-length", "No function exceeds 60 lines", "JPL Rule 4: functions must be short", _test_function_length, {"nasa": ["JPL-4"]}),
    ("nasa-assertion-density", "Assertion density >= 2 per function", "JPL Rule 5: minimum assertion density", _test_assertion_density, {"nasa": ["JPL-5"]}),
    ("nasa-no-recursion", "No recursive function calls", "JPL Rule 1: no direct recursion", _test_no_recursion, {"nasa": ["JPL-1"]}),
    ("nasa-no-bare-except", "No bare except clauses", "NPR 7150.2D Req 3: secure coding", _test_no_bare_except, {"nasa": ["NPR-3"]}),
    ("nasa-no-mutable-globals", "No public mutable globals", "JPL Rule 6: smallest scope for data", _test_no_mutable_globals, {"nasa": ["JPL-6"]}),
]

for pid, title, desc, fn, controls in _PROVIDERS:
    registry.register_provider(EvidenceProvider(
        id=pid, title=title, description=desc,
        evidence_type=EvidenceType.static_analysis,
        test_fn=fn,
        code_refs=["backend/app/"],
        controls=controls,
    ))
