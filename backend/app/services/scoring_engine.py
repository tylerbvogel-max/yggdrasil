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


_STOP_WORDS = frozenset({
    "the", "and", "for", "with", "from", "that", "this", "into", "also",
    "are", "was", "were", "been", "has", "have", "had", "not", "but",
    "all", "can", "will", "may", "use", "per", "via", "its", "our",
    "any", "each", "more", "most", "such", "than", "when", "how",
    "new", "based", "using", "used", "general", "process", "system",
    "management", "plan", "data", "review", "standard", "control",
    "report", "analysis", "list", "level", "type", "set", "model",
    "support", "service", "design", "test", "requirements",
    "documentation", "procedure", "configuration",
})


def calc_relevance(keywords: list[str], neuron_text: str) -> float:
    """Relevance: two-tier keyword matching with stop-word filtering.

    Tier 1 — exact phrase match (full keyword string found in neuron text).
             Strong stimulus-response: the neuron directly encodes this concept.
    Tier 2 — token-level match, excluding domain stop words.
             Partial stimulus: individual distinctive terms overlap.

    Domain stop words (management, data, process, etc.) are filtered from
    token matching because they appear in nearly every neuron and provide
    no discriminative signal — analogous to tonic background firing that
    carries no information about the stimulus.
    """
    if not keywords:
        return 0.0
    text_lower = neuron_text.lower()

    # Tier 1: exact phrase matches (strong stimulus response)
    phrase_hits = sum(1 for kw in keywords if kw.lower() in text_lower)
    phrase_score = phrase_hits / len(keywords)

    # Tier 2: token-level matches, excluding stop words
    tokens = set()
    for kw in keywords:
        for token in kw.lower().split():
            if len(token) >= 3 and token not in _STOP_WORDS:
                tokens.add(token)
    if tokens:
        token_hits = sum(1 for t in tokens if t in text_lower)
        token_score = token_hits / len(tokens)
    else:
        token_score = 0.0

    return min(1.0, max(phrase_score, token_score))


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
    semantic_similarity: float | None = None,
) -> NeuronScoreBreakdown:
    """Compute combined activation score using gated modulatory scoring.

    Biological analogue:
    - Relevance = stimulus (glutamate depolarization). Without stimulus,
      the neuron cannot reach activation threshold.
    - Burst/Impact/Precision/Novelty/Recency = neuromodulatory signals
      (dopamine, norepinephrine, serotonin). They adjust sensitivity and
      gain but cannot cause firing on their own.

    The modulatory component is gated by relevance: full modulation at
    relevance >= threshold (default 0.2), with a small floor for
    spontaneous background activity.
    """
    burst = calc_burst(fires_in_window)
    impact = calc_impact(avg_utility)
    precision = calc_precision(dept_fires, dept_total_queries)
    novelty = calc_novelty(age_queries)
    recency = calc_recency(queries_since_last)

    # Relevance: prefer semantic similarity (cortical topography) over keyword matching
    if semantic_similarity is not None:
        relevance = max(0.0, min(1.0, semantic_similarity))
    else:
        relevance = calc_relevance(keywords, neuron_text)

    # Stimulus component: direct relevance contribution
    stimulus = settings.weight_relevance * relevance

    # Modulatory component: burst, impact, precision, novelty, recency
    modulatory = (
        settings.weight_burst * burst
        + settings.weight_impact * impact
        + settings.weight_precision * precision
        + settings.weight_novelty * novelty
        + settings.weight_recency * recency
    )

    # Relevance gate: without stimulus, modulatory signals are attenuated
    # Soft gate ramps from floor (spontaneous rate) to 1.0 at threshold
    threshold = settings.relevance_gate_threshold
    floor = settings.relevance_gate_floor
    if relevance >= threshold:
        gate = 1.0
    elif relevance > 0:
        gate = floor + (1.0 - floor) * (relevance / threshold)
    else:
        gate = floor

    combined = stimulus + modulatory * gate

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
