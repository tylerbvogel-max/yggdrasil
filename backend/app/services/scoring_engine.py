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
    assert fires_in_window >= 0, f"fires_in_window must be non-negative, got {fires_in_window}"
    result = min(1.0, fires_in_window / settings.burst_threshold)
    assert 0.0 <= result <= 1.0, f"calc_burst result out of range: {result}"
    return result


def calc_impact(avg_utility: float) -> float:
    """Impact: avg_utility (EMA, alpha=0.3)"""
    result = max(0.0, min(1.0, avg_utility))
    assert 0.0 <= result <= 1.0, f"calc_impact result out of range: {result}"
    return result


def calc_precision(dept_fires: int, dept_total_queries: int) -> float:
    """Precision: dept_fires / dept_total_queries. Floor 0.3 if dept_total_queries < 5."""
    assert dept_fires >= 0, f"dept_fires must be non-negative, got {dept_fires}"
    if dept_total_queries < 5:
        return 0.3
    result = min(1.0, dept_fires / max(1, dept_total_queries))
    assert 0.0 <= result <= 1.0, f"calc_precision result out of range: {result}"
    return result


def calc_novelty(age_queries: int) -> float:
    """Novelty: max(0, 1 - age_queries / 200). Newer neurons score higher."""
    result = max(0.0, 1.0 - age_queries / settings.novelty_halflife_queries)
    assert 0.0 <= result <= 1.0, f"calc_novelty result out of range: {result}"
    return result


def calc_recency(queries_since_last: int) -> float:
    """Recency: e^(-queries_since / 500). Recently-fired neurons score higher."""
    if queries_since_last < 0:
        return 1.0
    result = math.exp(-queries_since_last / settings.recency_decay_queries)
    assert 0.0 <= result <= 1.0, f"calc_recency result out of range: {result}"
    return result


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

    result = min(1.0, max(phrase_score, token_score))
    assert 0.0 <= result <= 1.0, f"calc_relevance result out of range: {result}"
    return result


def _resolve_relevance(
    semantic_similarity: float | None,
    keywords: list[str],
    neuron_text: str,
) -> float:
    if semantic_similarity is not None:
        return max(0.0, min(1.0, semantic_similarity))
    return calc_relevance(keywords, neuron_text)


def _compute_gated_combined(
    burst: float,
    impact: float,
    precision: float,
    novelty: float,
    recency: float,
    relevance: float,
) -> float:
    stimulus = settings.weight_relevance * relevance

    modulatory = (
        settings.weight_burst * burst
        + settings.weight_impact * impact
        + settings.weight_precision * precision
        + settings.weight_novelty * novelty
        + settings.weight_recency * recency
    )

    threshold = settings.relevance_gate_threshold
    floor = settings.relevance_gate_floor
    if relevance >= threshold:
        gate = 1.0
    elif relevance > 0:
        gate = floor + (1.0 - floor) * (relevance / threshold)
    else:
        gate = floor

    combined = stimulus + modulatory * gate
    assert combined >= 0, f"combined score must be non-negative, got {combined}"
    assert isinstance(combined, float), f"combined must be float, got {type(combined)}"
    return combined


def _apply_classification_boost(
    combined: float, dept_match: bool, role_match: bool
) -> float:
    if role_match:
        combined *= 1.5
    elif dept_match:
        combined *= 1.25
    assert combined >= 0, f"boosted score must be non-negative, got {combined}"
    return combined


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

    assert 0.0 <= burst <= 1.0, f"burst out of range: {burst}"
    assert 0.0 <= impact <= 1.0, f"impact out of range: {impact}"
    assert 0.0 <= precision <= 1.0, f"precision out of range: {precision}"
    assert 0.0 <= novelty <= 1.0, f"novelty out of range: {novelty}"
    assert 0.0 <= recency <= 1.0, f"recency out of range: {recency}"

    relevance = _resolve_relevance(semantic_similarity, keywords, neuron_text)
    combined = _compute_gated_combined(burst, impact, precision, novelty, recency, relevance)
    combined = _apply_classification_boost(combined, dept_match, role_match)

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
    result = alpha * new_utility + (1 - alpha) * current_avg
    assert 0.0 <= result <= 1.0, f"update_impact_ema result out of range: {result}"
    return result
