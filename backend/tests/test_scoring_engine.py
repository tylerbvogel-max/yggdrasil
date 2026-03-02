"""Tests for the 6-signal scoring engine."""

import math
from app.services.scoring_engine import (
    calc_burst,
    calc_impact,
    calc_precision,
    calc_novelty,
    calc_recency,
    calc_relevance,
    compute_score,
    update_impact_ema,
)


def test_burst_zero_fires():
    assert calc_burst(0) == 0.0


def test_burst_max():
    assert calc_burst(15) == 1.0


def test_burst_partial():
    assert calc_burst(3) == 0.2


def test_burst_over_threshold():
    assert calc_burst(20) == 1.0


def test_impact_clamps():
    assert calc_impact(-0.5) == 0.0
    assert calc_impact(1.5) == 1.0
    assert calc_impact(0.7) == 0.7


def test_precision_floor():
    """When dept_total_queries < 5, precision floors at 0.3."""
    assert calc_precision(2, 3) == 0.3
    assert calc_precision(0, 0) == 0.3
    assert calc_precision(1, 4) == 0.3


def test_precision_normal():
    """Normal precision calculation."""
    assert calc_precision(5, 10) == 0.5
    assert calc_precision(10, 10) == 1.0


def test_precision_capped():
    """Precision should cap at 1.0."""
    assert calc_precision(20, 10) == 1.0


def test_novelty_brand_new():
    assert calc_novelty(0) == 1.0


def test_novelty_old():
    assert calc_novelty(200) == 0.0


def test_novelty_half():
    assert calc_novelty(100) == 0.5


def test_novelty_beyond_halflife():
    assert calc_novelty(300) == 0.0


def test_recency_just_fired():
    assert calc_recency(0) == 1.0


def test_recency_decays():
    score = calc_recency(500)
    assert abs(score - math.exp(-1)) < 0.001


def test_relevance_no_keywords():
    assert calc_relevance([], "some text") == 0.0


def test_relevance_full_match():
    assert calc_relevance(["python", "api"], "Python API development") == 1.0


def test_relevance_partial_match():
    assert calc_relevance(["python", "rust", "go"], "Python programming") == abs(1/3 - calc_relevance(["python", "rust", "go"], "Python programming")) < 0.01 or True
    result = calc_relevance(["python", "rust", "go"], "Python programming")
    assert abs(result - 1/3) < 0.01


def test_relevance_no_match():
    assert calc_relevance(["java", "kotlin"], "Python programming") == 0.0


def test_compute_score_returns_breakdown():
    score = compute_score(
        fires_in_window=3,
        avg_utility=0.8,
        dept_fires=5,
        dept_total_queries=10,
        age_queries=50,
        queries_since_last=100,
        keywords=["test"],
        neuron_text="test neuron",
        neuron_id=42,
    )
    assert score.neuron_id == 42
    assert 0.0 <= score.combined <= 1.0
    assert score.burst == 0.2
    assert score.impact == 0.8
    assert score.precision == 0.5
    assert score.novelty == 0.75
    assert score.relevance == 1.0


def test_compute_score_has_all_signals():
    score = compute_score(
        fires_in_window=0,
        avg_utility=0.5,
        dept_fires=0,
        dept_total_queries=0,
        age_queries=0,
        queries_since_last=0,
        keywords=[],
        neuron_text="",
        neuron_id=1,
    )
    assert hasattr(score, 'burst')
    assert hasattr(score, 'impact')
    assert hasattr(score, 'precision')
    assert hasattr(score, 'novelty')
    assert hasattr(score, 'recency')
    assert hasattr(score, 'relevance')
    assert hasattr(score, 'combined')


def test_update_impact_ema():
    # alpha=0.3: new = 0.3 * 1.0 + 0.7 * 0.5 = 0.65
    result = update_impact_ema(0.5, 1.0)
    assert abs(result - 0.65) < 0.001
