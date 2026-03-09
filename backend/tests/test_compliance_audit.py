"""Tests for compliance audit: PII scanning, bias detection patterns."""

import re

# Import the PII patterns and false positive filter from admin router
from app.routers.admin import _PII_PATTERNS, _is_false_positive


# ── PII Pattern Tests ──

def _scan_text(text: str) -> list[str]:
    """Helper: return list of PII types found in text, with false positive filtering."""
    found = []
    for pattern, pii_type in _PII_PATTERNS:
        matches = pattern.findall(text)
        real = [m for m in matches if not _is_false_positive(text, m, pii_type)]
        if real:
            found.append(pii_type)
    return found


def test_ssn_detected():
    assert "SSN" in _scan_text("Employee 123-45-6789 needs access.")


def test_ssn_requires_dashes():
    # Tightened pattern: SSN must have dashes to avoid false positives on clause numbers
    assert "SSN" not in _scan_text("SSN 123456789 on file.")


def test_email_detected():
    assert "email" in _scan_text("Contact john.doe@boeing.com for details.")


def test_credit_card_detected():
    assert "credit_card" in _scan_text("Card number 4111-1111-1111-1111 on file.")


def test_credit_card_spaces():
    assert "credit_card" in _scan_text("Card 4111 1111 1111 1111 is expired.")


def test_phone_detected():
    assert "phone" in _scan_text("Call 555-123-4567 for support.")


def test_clean_aerospace_content():
    """Normal aerospace neuron content should have no PII."""
    text = (
        "FAR 52.246-2 requires the contractor to maintain an inspection system "
        "covering supplies, services, and manufacturing processes. The system must "
        "detect and segregate nonconforming material per AS9100D clause 8.7."
    )
    assert _scan_text(text) == []


def test_regulatory_reference_not_false_positive():
    """Regulatory references like FAR numbers shouldn't trigger SSN detection."""
    text = "FAR 52.244-2 subcontracting requirements apply to all prime contractors."
    found = _scan_text(text)
    assert "SSN" not in found


def test_dfars_clause_not_phone_false_positive():
    """DFARS clause numbers like 252.204-7012 shouldn't trigger phone detection."""
    text = "DFARS 252.204-7012 requires safeguarding covered defense information."
    found = _scan_text(text)
    assert "phone" not in found


def test_far_clause_not_phone_false_positive():
    """FAR clause numbers like 52.246-2 shouldn't trigger phone detection."""
    text = "Per FAR 52.246-2102, inspection requirements apply."
    found = _scan_text(text)
    assert "phone" not in found


def test_example_email_not_flagged():
    """Example/placeholder emails in technical content shouldn't be flagged."""
    text = "Contact data-eng-oncall@example.com for escalation procedures."
    found = _scan_text(text)
    assert "email" not in found


def test_real_email_still_flagged():
    """Real-looking emails should still be flagged."""
    text = "Send the report to john.doe@boeing.com by Friday."
    found = _scan_text(text)
    assert "email" in found


def test_standard_numbers_not_false_positive():
    """Standard numbers like AS9100 shouldn't trigger PII patterns."""
    text = "AS9100D and ISO 9001:2015 form the quality management framework."
    assert _scan_text(text) == []


def test_multiple_pii_types():
    """Text with multiple PII types should detect all."""
    text = "Employee john@boeing.com SSN 123-45-6789 card 4111111111111111"
    found = _scan_text(text)
    assert "email" in found
    assert "SSN" in found
    assert "credit_card" in found


# ── Bias Assessment Logic Tests ──

def test_coefficient_of_variation():
    """Test CV calculation for department imbalance detection."""
    import math
    values = [242, 50, 30, 45, 38, 60, 55, 42, 35]  # Typical dept distribution
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    cv = math.sqrt(variance) / mean
    # With one outlier dept at 242, CV should indicate imbalance (>0.5)
    assert cv > 0.5


def test_balanced_distribution():
    """Balanced departments should have low CV."""
    import math
    values = [100, 105, 98, 102, 97, 103, 99, 101, 100]
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    cv = math.sqrt(variance) / mean
    assert cv < 0.1


# ── Scoring Baseline Logic Tests ──

def test_percentile_calculation():
    """Test percentile helper logic."""
    import math

    def _percentile(vals: list[float], p: float) -> float:
        if not vals:
            return 0.0
        sorted_vals = sorted(vals)
        k = (len(sorted_vals) - 1) * (p / 100)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_vals[int(k)]
        return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)

    vals = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert _percentile(vals, 0) == 1.0
    assert _percentile(vals, 50) == 3.0
    assert _percentile(vals, 100) == 5.0
    assert _percentile(vals, 25) == 2.0
    assert _percentile(vals, 75) == 4.0


def test_percentile_empty():
    import math

    def _percentile(vals: list[float], p: float) -> float:
        if not vals:
            return 0.0
        sorted_vals = sorted(vals)
        k = (len(sorted_vals) - 1) * (p / 100)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_vals[int(k)]
        return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)

    assert _percentile([], 50) == 0.0


def test_percentile_single_value():
    import math

    def _percentile(vals: list[float], p: float) -> float:
        if not vals:
            return 0.0
        sorted_vals = sorted(vals)
        k = (len(sorted_vals) - 1) * (p / 100)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_vals[int(k)]
        return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)

    assert _percentile([42.0], 50) == 42.0
    assert _percentile([42.0], 0) == 42.0
    assert _percentile([42.0], 100) == 42.0
