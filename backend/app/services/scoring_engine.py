"""5-signal biomimetic scoring engine for neuron activation."""

import math
import statistics
from dataclasses import dataclass

from app.config import settings


@dataclass
class NeuronScoreBreakdown:
    neuron_id: int
    burst: float
    impact: float
    practice: float
    novelty: float
    recency: float
    combined: float


def calc_burst(fires_in_window: int) -> float:
    """Burst: min(1, fires_in_10K_tokens / 5)"""
    return min(1.0, fires_in_window / settings.burst_threshold)


def calc_impact(avg_utility: float) -> float:
    """Impact: avg_utility (EMA, α=0.3)"""
    return max(0.0, min(1.0, avg_utility))


def calc_practice(firing_gap_tokens: list[int]) -> float:
    """Practice: max(0, 1 - CV/2) where CV = stdev/mean of firing gaps.
    High practice = consistent, regular firing pattern."""
    if len(firing_gap_tokens) < 2:
        return 0.0
    mean_gap = statistics.mean(firing_gap_tokens)
    if mean_gap == 0:
        return 1.0
    stdev_gap = statistics.stdev(firing_gap_tokens)
    cv = stdev_gap / mean_gap
    return max(0.0, 1.0 - cv / 2.0)


def calc_novelty(age_tokens: int) -> float:
    """Novelty: max(0, 1 - age_tokens / 50000). Newer neurons score higher."""
    return max(0.0, 1.0 - age_tokens / settings.novelty_halflife_tokens)


def calc_recency(tokens_since_last_fire: int) -> float:
    """Recency: e^(-tokens_since_last / 100000). Recently-fired neurons score higher."""
    if tokens_since_last_fire < 0:
        return 1.0
    return math.exp(-tokens_since_last_fire / settings.recency_decay_tokens)


def compute_score(
    fires_in_window: int,
    avg_utility: float,
    firing_gap_tokens: list[int],
    age_tokens: int,
    tokens_since_last_fire: int,
    neuron_id: int = 0,
) -> NeuronScoreBreakdown:
    """Compute combined activation score from 5 biomimetic signals."""
    burst = calc_burst(fires_in_window)
    impact = calc_impact(avg_utility)
    practice = calc_practice(firing_gap_tokens)
    novelty = calc_novelty(age_tokens)
    recency = calc_recency(tokens_since_last_fire)

    combined = (
        settings.weight_burst * burst
        + settings.weight_impact * impact
        + settings.weight_practice * practice
        + settings.weight_novelty * novelty
        + settings.weight_recency * recency
    )

    return NeuronScoreBreakdown(
        neuron_id=neuron_id,
        burst=round(burst, 4),
        impact=round(impact, 4),
        practice=round(practice, 4),
        novelty=round(novelty, 4),
        recency=round(recency, 4),
        combined=round(combined, 4),
    )


def update_impact_ema(current_avg: float, new_utility: float) -> float:
    """Update Impact signal using EMA: new_avg = α * new + (1-α) * old"""
    alpha = settings.impact_ema_alpha
    return alpha * new_utility + (1 - alpha) * current_avg
