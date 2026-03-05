"""6-signal biomimetic scoring engine for neuron activation."""

import math
from dataclasses import dataclass

from app.config import settings


@dataclass
class NeuronScoreBreakdown:
    neuron_id: int
    burst: float
    impact: float
    precision: float
    novelty: float
    recency: float
    relevance: float
    combined: float
    spread_boost: float = 0.0


def calc_burst(fires_in_window: int) -> float:
    """Burst: min(1, fires_in_window / 15)"""
    return min(1.0, fires_in_window / settings.burst_threshold)


def calc_impact(avg_utility: float) -> float:
    """Impact: avg_utility (EMA, alpha=0.3)"""
    return max(0.0, min(1.0, avg_utility))


def calc_precision(dept_fires: int, dept_total_queries: int) -> float:
    """Precision: dept_fires / dept_total_queries. Floor 0.3 if dept_total_queries < 5."""
    if dept_total_queries < 5:
        return 0.3
    return min(1.0, dept_fires / max(1, dept_total_queries))


def calc_novelty(age_queries: int) -> float:
    """Novelty: max(0, 1 - age_queries / 200). Newer neurons score higher."""
    return max(0.0, 1.0 - age_queries / settings.novelty_halflife_queries)


def calc_recency(queries_since_last: int) -> float:
    """Recency: e^(-queries_since / 500). Recently-fired neurons score higher."""
    if queries_since_last < 0:
        return 1.0
    return math.exp(-queries_since_last / settings.recency_decay_queries)


def calc_relevance(keywords: list[str], neuron_text: str) -> float:
    """Relevance: keyword overlap. min(1.0, matches / max(1, len(keywords)))."""
    if not keywords:
        return 0.0
    text_lower = neuron_text.lower()
    matches = sum(1 for kw in keywords if kw.lower() in text_lower)
    return min(1.0, matches / max(1, len(keywords)))


def compute_score(
    fires_in_window: int,
    avg_utility: float,
    dept_fires: int,
    dept_total_queries: int,
    age_queries: int,
    queries_since_last: int,
    keywords: list[str],
    neuron_text: str,
    neuron_id: int = 0,
    dept_match: bool = False,
    role_match: bool = False,
) -> NeuronScoreBreakdown:
    """Compute combined activation score from 6 biomimetic signals.

    Neurons matching the classified department or role_key get a multiplicative
    boost so that classification signals directly influence scoring, not just
    pre-filtering.
    """
    burst = calc_burst(fires_in_window)
    impact = calc_impact(avg_utility)
    precision = calc_precision(dept_fires, dept_total_queries)
    novelty = calc_novelty(age_queries)
    recency = calc_recency(queries_since_last)
    relevance = calc_relevance(keywords, neuron_text)

    combined = (
        settings.weight_burst * burst
        + settings.weight_impact * impact
        + settings.weight_precision * precision
        + settings.weight_novelty * novelty
        + settings.weight_recency * recency
        + settings.weight_relevance * relevance
    )

    # Classification match boost: role match is stronger than dept match
    # since role_keys are more specific (e.g. "data_engineer" vs "Engineering")
    if role_match:
        combined *= 1.5
    elif dept_match:
        combined *= 1.25

    return NeuronScoreBreakdown(
        neuron_id=neuron_id,
        burst=round(burst, 4),
        impact=round(impact, 4),
        precision=round(precision, 4),
        novelty=round(novelty, 4),
        recency=round(recency, 4),
        relevance=round(relevance, 4),
        combined=round(combined, 4),
    )


def update_impact_ema(current_avg: float, new_utility: float) -> float:
    """Update Impact signal using EMA: new_avg = alpha * new + (1-alpha) * old"""
    alpha = settings.impact_ema_alpha
    return alpha * new_utility + (1 - alpha) * current_avg
