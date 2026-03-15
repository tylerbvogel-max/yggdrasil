"""Tests for the Unified Compliance Audit Suite."""

import ast
import json
import tempfile
import os
from datetime import datetime, timezone

import pytest

from app.compliance.types import ControlDefinition, EvidenceProvider, EvidenceResult, EvidenceType
from app.compliance.registry import ControlRegistry


class TestControlRegistry:
    """Test registry register/lookup/derive logic."""

    def setup_method(self):
        self.reg = ControlRegistry()

    def test_register_framework(self):
        controls = [
            ControlDefinition("test_fw", "C-1", "Control One", "Family A", "Description"),
            ControlDefinition("test_fw", "C-2", "Control Two", "Family A", "Description"),
        ]
        self.reg.register_framework("test_fw", controls)
        assert len(self.reg.get_controls("test_fw")) == 2
        assert self.reg.control_count == 2

    def test_register_provider(self):
        controls = [ControlDefinition("fw", "C-1", "Ctrl", "Fam", "Desc")]
        self.reg.register_framework("fw", controls)

        provider = EvidenceProvider(
            id="p-1", title="Provider 1", description="Test",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"fw": ["C-1"]},
        )
        self.reg.register_provider(provider)
        assert self.reg.provider_count == 1
        assert len(self.reg.get_providers_for_control("fw", "C-1")) == 1

    def test_duplicate_provider_raises(self):
        provider = EvidenceProvider(
            id="p-dup", title="P", description="",
            evidence_type=EvidenceType.config_check,
            test_fn=None, code_refs=[], controls={},
        )
        self.reg.register_provider(provider)
        with pytest.raises(AssertionError, match="Duplicate"):
            self.reg.register_provider(provider)

    def test_derive_control_status_all_passed(self):
        controls = [ControlDefinition("fw", "C-1", "Ctrl", "Fam", "")]
        self.reg.register_framework("fw", controls)
        for i in range(3):
            self.reg.register_provider(EvidenceProvider(
                id=f"p-{i}", title="", description="",
                evidence_type=EvidenceType.automated_test,
                test_fn=None, code_refs=[], controls={"fw": ["C-1"]},
            ))
        results = {"p-0": True, "p-1": True, "p-2": True}
        assert self.reg.derive_control_status("fw", "C-1", results) == "passed"

    def test_derive_control_status_any_failed(self):
        controls = [ControlDefinition("fw", "C-1", "Ctrl", "Fam", "")]
        self.reg.register_framework("fw", controls)
        self.reg.register_provider(EvidenceProvider(
            id="p-ok", title="", description="",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"fw": ["C-1"]},
        ))
        self.reg.register_provider(EvidenceProvider(
            id="p-fail", title="", description="",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"fw": ["C-1"]},
        ))
        results = {"p-ok": True, "p-fail": False}
        assert self.reg.derive_control_status("fw", "C-1", results) == "partial"

    def test_derive_control_status_untested(self):
        controls = [ControlDefinition("fw", "C-1", "Ctrl", "Fam", "")]
        self.reg.register_framework("fw", controls)
        assert self.reg.derive_control_status("fw", "C-1", {}) == "untested"

    def test_derive_control_status_failed_only(self):
        controls = [ControlDefinition("fw", "C-1", "Ctrl", "Fam", "")]
        self.reg.register_framework("fw", controls)
        self.reg.register_provider(EvidenceProvider(
            id="p-f", title="", description="",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"fw": ["C-1"]},
        ))
        assert self.reg.derive_control_status("fw", "C-1", {"p-f": False}) == "failed"

    def test_get_providers_by_framework(self):
        controls = [ControlDefinition("fw1", "C-1", "Ctrl", "Fam", "")]
        self.reg.register_framework("fw1", controls)
        controls2 = [ControlDefinition("fw2", "C-1", "Ctrl", "Fam", "")]
        self.reg.register_framework("fw2", controls2)

        self.reg.register_provider(EvidenceProvider(
            id="p-fw1", title="", description="",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"fw1": ["C-1"]},
        ))
        self.reg.register_provider(EvidenceProvider(
            id="p-fw2", title="", description="",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"fw2": ["C-1"]},
        ))

        assert len(self.reg.get_providers("fw1")) == 1
        assert len(self.reg.get_providers("fw2")) == 1
        assert len(self.reg.get_providers()) == 2


class TestStaticAnalysis:
    """Test AST-based static analysis on temp Python files."""

    def test_detects_long_function(self):
        from app.compliance.providers.static_analysis import FunctionAnalyzer
        source = "def long_func():\n" + "    x = 1\n" * 70
        tree = ast.parse(source)
        analyzer = FunctionAnalyzer("test.py")
        analyzer.visit(tree)
        assert len(analyzer.functions) == 1
        assert analyzer.functions[0]["line_count"] > 60

    def test_detects_recursion(self):
        from app.compliance.providers.static_analysis import FunctionAnalyzer
        source = "def recurse(n):\n    return recurse(n-1)\n"
        tree = ast.parse(source)
        analyzer = FunctionAnalyzer("test.py")
        analyzer.visit(tree)
        assert analyzer.functions[0]["has_recursion"] is True

    def test_detects_bare_except(self):
        from app.compliance.providers.static_analysis import FunctionAnalyzer
        source = "def risky():\n    try:\n        pass\n    except:\n        pass\n"
        tree = ast.parse(source)
        analyzer = FunctionAnalyzer("test.py")
        analyzer.visit(tree)
        assert analyzer.functions[0]["has_bare_except"] is True

    def test_counts_assertions(self):
        from app.compliance.providers.static_analysis import FunctionAnalyzer
        source = "def solid():\n    assert True\n    assert 1 == 1\n    assert 2 > 0\n"
        tree = ast.parse(source)
        analyzer = FunctionAnalyzer("test.py")
        analyzer.visit(tree)
        assert analyzer.functions[0]["assertion_count"] == 3

    def test_no_false_positive_on_clean_code(self):
        from app.compliance.providers.static_analysis import FunctionAnalyzer
        source = "def clean(x: int) -> int:\n    assert x >= 0\n    assert isinstance(x, int)\n    return x + 1\n"
        tree = ast.parse(source)
        analyzer = FunctionAnalyzer("test.py")
        analyzer.visit(tree)
        f = analyzer.functions[0]
        assert f["has_recursion"] is False
        assert f["has_bare_except"] is False
        assert f["assertion_count"] == 2


class TestEvidenceTypes:
    """Test evidence type dataclasses."""

    def test_evidence_result_creation(self):
        r = EvidenceResult(
            provider_id="test-p",
            passed=True,
            detail={"key": "val"},
            collected_at=datetime.now(timezone.utc),
            duration_ms=42,
        )
        assert r.passed is True
        assert r.duration_ms == 42

    def test_control_definition(self):
        c = ControlDefinition("fw", "C-1", "Title", "Family", "Desc", "https://example.com")
        assert c.framework == "fw"
        assert c.external_ref == "https://example.com"


class TestReportGeneration:
    """Test HTML report generation from mock data."""

    def test_generate_report_produces_html(self):
        from app.compliance.report import generate_report
        from unittest.mock import MagicMock

        run = MagicMock()
        run.id = 1
        run.duration_ms = 1234
        run.triggered_by = "test"
        run.started_at = datetime.now(timezone.utc)
        run.total_providers = 2
        run.passed = 1
        run.failed = 1
        run.provider_filter = None  # full run, not selective

        result1 = MagicMock()
        result1.provider_id = "p-1"
        result1.passed = True
        result1.detail = json.dumps({"ok": True})
        result1.duration_ms = 10
        result1.collected_at = datetime.now(timezone.utc)
        result1.run_id = 1

        result2 = MagicMock()
        result2.provider_id = "p-2"
        result2.passed = False
        result2.detail = json.dumps({"error": "timeout"})
        result2.duration_ms = 30000
        result2.collected_at = datetime.now(timezone.utc)
        result2.run_id = 1

        reg = ControlRegistry()
        reg.register_framework("test", [
            ControlDefinition("test", "TC-1", "Test Control", "Test Family", "Desc"),
        ])
        reg.register_provider(EvidenceProvider(
            id="p-1", title="", description="",
            evidence_type=EvidenceType.automated_test,
            test_fn=None, code_refs=[], controls={"test": ["TC-1"]},
        ))

        html = generate_report(run, [result1, result2], reg)
        assert "<!DOCTYPE html>" in html
        assert "Compliance Audit Report" in html
        assert "p-1" in html
        assert "p-2" in html
