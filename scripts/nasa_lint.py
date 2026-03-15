#!/usr/bin/env python3
"""NASA JPL/NPR coding standards linter.

Two enforcement tiers:
  --strict   Block on: recursion, unbounded loops, mutable globals, bare excepts
  --warn     Report:   function length >60 (block at >100)

Exit codes:
  0  All checks passed
  1  Strict violations found (blocks commit)
  2  Warnings only (used by Claude Code hook for feedback)

Can lint specific files (arguments) or read file paths from stdin (one per line).
"""

import ast
import sys
from pathlib import Path

MAX_LINES_WARN = 60
MAX_LINES_BLOCK = 100

# --- AST analysis -------------------------------------------------------

def _has_break(body: list[ast.stmt]) -> bool:
    for node in ast.walk(ast.Module(body=body, type_ignores=[])):
        if isinstance(node, ast.Break):
            return True
    return False

def _is_bounded_while(node: ast.While) -> bool:
    test = node.test
    if isinstance(test, (ast.Compare, ast.BoolOp)):
        return True
    if isinstance(test, ast.Name):
        return True
    if _has_break(node.body):
        return True
    return False

def _is_mutable_global(node: ast.Assign) -> bool:
    if isinstance(node.value, (ast.Dict, ast.List)):
        return True
    return False


class FileAnalyzer:
    def __init__(self, filepath: str, source: str):
        self.filepath = filepath
        self.source = source
        self.tree = ast.parse(source)
        self.strict_violations: list[str] = []
        self.warnings: list[str] = []

    def analyze(self) -> None:
        self._check_module_level()
        self._check_functions()

    def _check_module_level(self) -> None:
        for node in ast.iter_child_nodes(self.tree):
            if isinstance(node, ast.Assign) and _is_mutable_global(node):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        name = target.id
                        if name.startswith("_") or not name.isupper():
                            continue
                        self.strict_violations.append(
                            f"  {self.filepath}:{node.lineno} JPL-6 mutable global: {name} "
                            f"(use MappingProxyType or tuple)"
                        )

    def _check_functions(self) -> None:
        for node in ast.walk(self.tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            name = node.name
            lines = node.end_lineno - node.lineno + 1
            loc = f"{self.filepath}:{node.lineno}"

            # JPL-4: function length
            if lines > MAX_LINES_BLOCK:
                self.strict_violations.append(
                    f"  {loc} JPL-4 function too long: {name} ({lines} lines, max {MAX_LINES_BLOCK})"
                )
            elif lines > MAX_LINES_WARN:
                self.warnings.append(
                    f"  {loc} JPL-4 function length: {name} ({lines} lines, guideline {MAX_LINES_WARN})"
                )

            # JPL-1: recursion
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    func = child.func
                    if isinstance(func, ast.Name) and func.id == name:
                        self.strict_violations.append(
                            f"  {loc} JPL-1 recursion: {name} calls itself"
                        )
                        break

            # JPL-2: unbounded loops
            for child in ast.walk(node):
                if isinstance(child, ast.While) and not _is_bounded_while(child):
                    self.strict_violations.append(
                        f"  {loc} JPL-2 unbounded loop in {name} "
                        f"(line {child.lineno})"
                    )

            # NPR-3: bare except
            for child in ast.walk(node):
                if isinstance(child, ast.ExceptHandler) and child.type is None:
                    self.strict_violations.append(
                        f"  {loc} NPR-3 bare except in {name} "
                        f"(line {child.lineno})"
                    )


def lint_file(filepath: str) -> tuple[list[str], list[str]]:
    """Returns (strict_violations, warnings) for a single file."""
    try:
        source = Path(filepath).read_text()
    except (OSError, UnicodeDecodeError):
        return [], []

    try:
        analyzer = FileAnalyzer(filepath, source)
        analyzer.analyze()
        return analyzer.strict_violations, analyzer.warnings
    except SyntaxError:
        return [], []


# --- CLI entry point -----------------------------------------------------

def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="NASA JPL/NPR coding standards linter")
    parser.add_argument("files", nargs="*", help="Python files to lint")
    parser.add_argument("--strict", action="store_true", help="Exit 1 on strict violations")
    parser.add_argument("--warn", action="store_true", help="Exit 2 on warnings (for hook feedback)")
    parser.add_argument("--stdin", action="store_true", help="Read file paths from stdin")
    args = parser.parse_args()

    files = list(args.files)
    if args.stdin:
        files.extend(line.strip() for line in sys.stdin if line.strip())

    if not files:
        print("No files to lint.", file=sys.stderr)
        return 0

    files = [f for f in files if f.endswith(".py")]
    if not files:
        return 0

    all_strict: list[str] = []
    all_warnings: list[str] = []

    for f in files:
        strict, warnings = lint_file(f)
        all_strict.extend(strict)
        all_warnings.extend(warnings)

    exit_code = 0

    if all_strict:
        print("BLOCKED — NASA strict violations:", file=sys.stderr)
        for v in all_strict:
            print(v, file=sys.stderr)
        exit_code = 1

    if all_warnings:
        print("NASA guideline warnings:", file=sys.stderr)
        for w in all_warnings:
            print(w, file=sys.stderr)
        if exit_code == 0 and args.warn:
            exit_code = 2

    if exit_code == 0:
        print("NASA lint: all checks passed.", file=sys.stderr)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
