"""Tests for the 5-signal scoring engine."""

import math
from app.services.scoring_engine import (
    calc_burst,
    calc_impact,
    calc_practice,
    calc_novelty,
    calc_recency,
    compute_score,
    update_impact_ema,
)


def test_burst_zero_fires():
    assert calc_burst(0) == 0.0


def test_burst_max():
    assert calc_burst(10) == 1.0


def test_burst_partial():
    assert calc_burst(3) == 0.6


def test_impact_clamps():
    assert calc_impact(-0.5) == 0.0
    assert calc_impact(1.5) == 1.0
    assert calc_impact(0.7) == 0.7


def test_practice_insufficient_data():
    assert calc_practice([]) == 0.0
    assert calc_practice([100]) == 0.0


def test_practice_perfect_regularity():
    # All equal gaps → CV = 0 → practice = 1.0
    assert calc_practice([100, 100, 100, 100]) == 1.0


def test_practice_high_variance():
    # High variance → low practice score
    gaps = [10, 1000, 50, 500]
    score = calc_practice(gaps)
    assert 0.0 <= score <= 1.0
    assert score < 0.5  # Should be low due to high CV


def test_novelty_brand_new():
    assert calc_novelty(0) == 1.0


def test_novelty_old():
    assert calc_novelty(50000) == 0.0


def test_novelty_half():
    assert calc_novelty(25000) == 0.5


def test_recency_just_fired():
    assert calc_recency(0) == 1.0


def test_recency_decays():
    score = calc_recency(100000)
    assert abs(score - math.exp(-1)) < 0.001


def test_compute_score_returns_breakdown():
    score = compute_score(
        fires_in_window=3,
        avg_utility=0.8,
        firing_gap_tokens=[100, 100, 100],
        age_tokens=10000,
        tokens_since_last_fire=5000,
        neuron_id=42,
    )
    assert score.neuron_id == 42
    assert 0.0 <= score.combined <= 1.0
    assert score.burst == 0.6
    assert score.impact == 0.8


def test_update_impact_ema():
    # α=0.3: new = 0.3 * 1.0 + 0.7 * 0.5 = 0.65
    result = update_impact_ema(0.5, 1.0)
    assert abs(result - 0.65) < 0.001
