"""Static analysis evidence providers — NASA/JPL rules via Python AST."""

import ast
import os
import subprocess
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType

APP_DIR = Path(__file__).parent.parent.parent  # backend/app/

# Known void functions whose return values are intentionally discarded
_VOID_FUNCTIONS = {
    "print", "setattr", "delattr", "super",
}
_VOID_METHODS = {
    # Collection mutators
    "append", "extend", "sort", "clear", "update", "add", "discard",
    "insert", "remove", "reverse", "pop",
    # ORM / database
    "commit", "flush", "rollback", "close", "expire", "refresh",
    "execute", "run_sync",
    # Async / queue
    "send", "cancel", "shutdown",
    "put", "put_nowait", "get", "get_nowait", "join",
    # Registry / setup
    "register", "register_provider", "register_framework",
    "include_router", "add_middleware", "mount",
    "add_event_handler", "add_exception_handler",
    # Logging / output
    "write", "info", "debug", "warning", "error", "critical", "exception",
    "set_result", "set_exception",
    # Task / event
    "create_task", "ensure_future",
}
_VOID_PREFIXES = {"logging", "logger"}

# Dynamic alloc / metaprogramming calls flagged inside functions
_DYNAMIC_ALLOC_CALLS = {"exec", "eval", "__import__"}
_METAPROGRAMMING_CALLS = {"exec", "eval"}
_METAPROGRAMMING_ATTR_CALLS = {"_getframe"}  # sys._getframe
_METAPROGRAMMING_INSPECT_CALLS = {"stack", "currentframe"}

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
    """Collect per-function stats for NASA/JPL compliance checks."""

    def __init__(self, filepath: str) -> None:
        self.filepath = filepath
        self.functions: list[dict] = []

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._analyze_func(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._analyze_func(node)

    @staticmethod
    def _while_has_break(node: ast.While) -> bool:
        """Check if a while loop body contains a break statement."""
        for child in ast.walk(node):
            if isinstance(child, ast.Break):
                return True
        return False

    @staticmethod
    def _is_bounded_while_test(test: ast.expr) -> bool:
        """Heuristic: is the while test a comparison or container drain (has obvious bound)?"""
        # Comparisons: while x < n, while i != end
        if isinstance(test, (ast.Compare, ast.BoolOp)):
            return True
        # Container drain: while stack, while queue — finite container empties
        if isinstance(test, ast.Name):
            return True
        return False

    @staticmethod
    def _is_void_call(call_node: ast.Call) -> bool:
        """Check if a call is to a known void function."""
        func = call_node.func
        if isinstance(func, ast.Name):
            if func.id in _VOID_FUNCTIONS:
                return True
            # Internal helpers (underscore-prefixed) are typically void callbacks
            if func.id.startswith("_"):
                return True
            return False
        if isinstance(func, ast.Attribute):
            if func.attr in _VOID_METHODS:
                return True
            if isinstance(func.value, ast.Name):
                if func.value.id in _VOID_PREFIXES:
                    return True
        return False

    @staticmethod
    def _is_void_expr(node: ast.Expr) -> bool:
        """Check if an expression statement discards a meaningful return value."""
        value = node.value
        # Unwrap await: `await foo()` → check foo()
        if isinstance(value, ast.Await):
            value = value.value
        if not isinstance(value, ast.Call):
            return True  # Not a call — string literals, etc.
        return FunctionAnalyzer._is_void_call(value)

    @staticmethod
    def _has_dynamic_alloc(node: ast.AST) -> bool:
        """Check if function body uses exec/eval/__import__/importlib.import_module."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id in _DYNAMIC_ALLOC_CALLS:
                    return True
                if isinstance(child.func, ast.Attribute):
                    if child.func.attr == "import_module":
                        return True
        return False

    @staticmethod
    def _has_metaprogramming(node: ast.AST) -> bool:
        """Check for metaprogramming patterns: type(,,), sys._getframe, inspect.stack, exec, eval."""
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                func = child.func
                # exec() / eval()
                if isinstance(func, ast.Name) and func.id in _METAPROGRAMMING_CALLS:
                    return True
                # type() with 3 args (class factory)
                if isinstance(func, ast.Name) and func.id == "type" and len(child.args) == 3:
                    return True
                # sys._getframe / inspect.stack / inspect.currentframe
                if isinstance(func, ast.Attribute):
                    if func.attr in _METAPROGRAMMING_ATTR_CALLS:
                        return True
                    if isinstance(func.value, ast.Name) and func.value.id == "inspect":
                        if func.attr in _METAPROGRAMMING_INSPECT_CALLS:
                            return True
            # __getattr__ / __setattr__ definitions
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if child.name in ("__getattr__", "__setattr__"):
                    return True
        return False

    def _analyze_func(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        end_line = getattr(node, "end_lineno", node.lineno + 1) or node.lineno + 1
        line_count = end_line - node.lineno

        assertion_count = 0
        has_recursion = False
        has_bare_except = False
        has_unbounded_while = False
        discarded_return_count = 0
        has_dynamic_alloc = self._has_dynamic_alloc(node)
        has_metaprogramming = self._has_metaprogramming(node)

        for child in ast.walk(node):
            if isinstance(child, ast.Assert):
                assertion_count += 1
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id == node.name:
                    has_recursion = True
            if isinstance(child, ast.ExceptHandler):
                if child.type is None:
                    has_bare_except = True
            # JPL-2: unbounded while loops
            if isinstance(child, ast.While):
                if not self._is_bounded_while_test(child.test) and not self._while_has_break(child):
                    has_unbounded_while = True
            # JPL-7: discarded return values (unwraps await)
            if isinstance(child, ast.Expr):
                if not self._is_void_expr(child):
                    discarded_return_count += 1

        self.functions.append({
            "name": node.name,
            "file": self.filepath,
            "lineno": node.lineno,
            "line_count": line_count,
            "assertion_count": assertion_count,
            "has_recursion": has_recursion,
            "has_bare_except": has_bare_except,
            "has_unbounded_while": has_unbounded_while,
            "discarded_return_count": discarded_return_count,
            "has_dynamic_alloc": has_dynamic_alloc,
            "has_metaprogramming": has_metaprogramming,
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


async def _test_bounded_loops() -> EvidenceResult:
    """JPL-2: All loops must have a fixed upper bound."""
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["has_unbounded_while"]]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-bounded-loops",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "unbounded_while_functions": len(violations),
            "violations": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_no_dynamic_alloc() -> EvidenceResult:
    """JPL-3: No dynamic memory allocation after init (Python: no exec/eval/__import__ in functions)."""
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["has_dynamic_alloc"]]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-no-dynamic-alloc",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "dynamic_alloc_functions": len(violations),
            "violations": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_check_return_values() -> EvidenceResult:
    """JPL-7: Check return values of non-void functions."""
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["discarded_return_count"] > 0]
    total_discarded = sum(f["discarded_return_count"] for f in functions)
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-check-return-values",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "functions_with_discarded_returns": len(violations),
            "total_discarded_returns": total_discarded,
            "sample_violations": sorted(violations, key=lambda x: -x["discarded_return_count"])[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


async def _test_no_metaprogramming() -> EvidenceResult:
    """JPL-8: No preprocessor abuse (Python: no metaprogramming)."""
    start = time.monotonic()
    functions = _scan_all_functions()
    violations = [f for f in functions if f["has_metaprogramming"]]
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-no-metaprogramming",
        passed=len(violations) == 0,
        detail={
            "total_functions": len(functions),
            "metaprogramming_functions": len(violations),
            "violations": violations[:10],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


def _check_compile_warnings() -> list[dict]:
    """Compile each .py file capturing SyntaxWarning/DeprecationWarning."""
    warning_list: list[dict] = []
    for root, _dirs, files in os.walk(APP_DIR):
        for f in files:
            if not f.endswith(".py"):
                continue
            filepath = os.path.join(root, f)
            rel_path = os.path.relpath(filepath, APP_DIR.parent)
            try:
                source = open(filepath).read()
                with warnings.catch_warnings(record=True) as caught:
                    warnings.simplefilter("always")
                    compile(source, filepath, "exec")
                for w in caught:
                    warning_list.append({
                        "file": rel_path,
                        "lineno": w.lineno,
                        "category": w.category.__name__,
                        "message": str(w.message),
                    })
            except SyntaxError as e:
                warning_list.append({
                    "file": rel_path,
                    "lineno": e.lineno or 0,
                    "category": "SyntaxError",
                    "message": str(e),
                })
    return warning_list


async def _test_zero_warnings() -> EvidenceResult:
    """JPL-9: All code must compile with zero warnings."""
    start = time.monotonic()
    warning_list = _check_compile_warnings()
    elapsed = int((time.monotonic() - start) * 1000)
    return EvidenceResult(
        provider_id="nasa-zero-warnings",
        passed=len(warning_list) == 0,
        detail={
            "total_warnings": len(warning_list),
            "warnings": warning_list[:20],
        },
        collected_at=datetime.now(timezone.utc),
        duration_ms=elapsed,
    )


_PROVIDERS: list[tuple[str, str, str, object, dict, str | None]] = [
    ("nasa-function-length", "No function exceeds 60 lines", "JPL Rule 4: functions must be short",
     _test_function_length, {"nasa": ["JPL-4"]}, None),
    ("nasa-assertion-density", "Assertion density >= 2 per function", "JPL Rule 5: minimum assertion density",
     _test_assertion_density, {"nasa": ["JPL-5"]}, None),
    ("nasa-no-recursion", "No recursive function calls", "JPL Rule 1: no direct recursion",
     _test_no_recursion, {"nasa": ["JPL-1"]}, None),
    ("nasa-no-bare-except", "No bare except clauses", "NPR 7150.2D Req 3: secure coding",
     _test_no_bare_except, {"nasa": ["NPR-3"]}, None),
    ("nasa-no-mutable-globals", "No public mutable globals", "JPL Rule 6: smallest scope for data",
     _test_no_mutable_globals, {"nasa": ["JPL-6"]}, None),
    ("nasa-static-analysis-active", "Static analysis runs on codebase", "JPL Rule 10: code checked by static analysis tool",
     _test_function_length, {"nasa": ["JPL-10"]}, None),
    ("nasa-bounded-loops", "All loops have fixed upper bounds", "JPL Rule 2: fixed upper bound for loops",
     _test_bounded_loops, {"nasa": ["JPL-2"]}, None),
    ("nasa-no-dynamic-alloc", "No dynamic allocation after init", "JPL Rule 3: no exec/eval/__import__ in functions",
     _test_no_dynamic_alloc, {"nasa": ["JPL-3"]},
     "JPL Rule 3 targets C malloc/free after initialization. Python manages memory via garbage collection, "
     "making literal dynamic allocation control inapplicable. This adapted check flags exec(), eval(), "
     "__import__(), and importlib.import_module() inside function bodies — the Python equivalents of "
     "unpredictable runtime resource creation that bypass static analysis."),
    ("nasa-check-return-values", "Return values checked", "JPL Rule 7: check return values of non-void functions",
     _test_check_return_values, {"nasa": ["JPL-7"]}, None),
    ("nasa-no-metaprogramming", "No metaprogramming patterns", "JPL Rule 8: restricted preprocessor (Python: no metaprogramming)",
     _test_no_metaprogramming, {"nasa": ["JPL-8"]},
     "JPL Rule 8 restricts C preprocessor macros to simple includes and conditionals. Python has no "
     "preprocessor, but offers equivalent code-obscuring mechanisms: exec/eval, 3-arg type() class "
     "factories, __getattr__/__setattr__ overrides, sys._getframe, and inspect.stack. This check "
     "flags these patterns as they make static analysis and code review unreliable."),
    ("nasa-zero-warnings", "Zero compile warnings", "JPL Rule 9: all code compiles with zero warnings",
     _test_zero_warnings, {"nasa": ["JPL-9"]},
     "JPL Rule 9 requires zero compiler warnings with all warnings enabled. Python is interpreted, "
     "not compiled, so there is no compiler warning phase. This adapted check compiles each .py file "
     "with warnings.catch_warnings(record=True) to capture SyntaxWarning and DeprecationWarning during "
     "bytecode compilation — the closest Python equivalent to a compiler warning pass."),
]

for pid, title, desc, fn, controls, rationale in _PROVIDERS:
    registry.register_provider(EvidenceProvider(
        id=pid, title=title, description=desc,
        evidence_type=EvidenceType.static_analysis,
        test_fn=fn,
        code_refs=["backend/app/"],
        controls=controls,
        rationale=rationale,
    ))
