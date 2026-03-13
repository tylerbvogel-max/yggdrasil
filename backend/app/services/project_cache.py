"""Per-project neuron subgraph caching.

Remembers which neurons are useful for a specific project context and
boosts them on future queries. Requires project_cache_enabled in settings.
"""

import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ProjectProfile
from app.services.scoring_engine import NeuronScoreBreakdown


async def get_or_create_profile(db: AsyncSession, project_path: str) -> ProjectProfile:
    """Get or create a project profile for the given path."""
    result = await db.execute(
        select(ProjectProfile).where(ProjectProfile.project_path == project_path)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        # Extract project name from path
        name = project_path.rstrip("/").split("/")[-1] if "/" in project_path else project_path
        profile = ProjectProfile(
            project_path=project_path,
            project_name=name,
            neuron_relevance="{}",
            query_count=0,
        )
        db.add(profile)
        await db.flush()
    return profile


async def get_project_boost(
    db: AsyncSession,
    project_path: str,
    candidate_ids: list[int],
) -> dict[int, float]:
    """Return boost multiplier (1.0-1.3) per neuron based on historical project relevance.

    Returns empty dict if profile has fewer than min_queries queries (cold-start guard).
    """
    min_queries = getattr(settings, 'project_cache_min_queries', 3)
    max_boost = getattr(settings, 'project_cache_boost_max', 1.3)

    result = await db.execute(
        select(ProjectProfile).where(ProjectProfile.project_path == project_path)
    )
    profile = result.scalar_one_or_none()
    if profile is None or profile.query_count < min_queries:
        return {}

    try:
        relevance = json.loads(profile.neuron_relevance or "{}")
    except (json.JSONDecodeError, TypeError):
        return {}

    if not relevance:
        return {}

    # Normalize scores to [1.0, max_boost] range
    max_score = max(relevance.values()) if relevance else 1.0
    if max_score <= 0:
        return {}

    boosts = {}
    for nid in candidate_ids:
        nid_str = str(nid)
        if nid_str in relevance:
            # Linear scale from 1.0 to max_boost
            ratio = relevance[nid_str] / max_score
            boosts[nid] = 1.0 + (max_boost - 1.0) * ratio

    return boosts


async def record_project_firings(
    db: AsyncSession,
    project_path: str,
    neuron_scores: list[NeuronScoreBreakdown],
) -> None:
    """After a query, update the project profile with fired neurons and their scores."""
    profile = await get_or_create_profile(db, project_path)

    try:
        relevance = json.loads(profile.neuron_relevance or "{}")
    except (json.JSONDecodeError, TypeError):
        relevance = {}

    # Accumulate scores (EMA-style to favor recent queries)
    alpha = 0.3
    for score in neuron_scores:
        nid_str = str(score.neuron_id)
        old = relevance.get(nid_str, 0.0)
        relevance[nid_str] = old * (1 - alpha) + score.combined * alpha

    profile.neuron_relevance = json.dumps(relevance)
    profile.query_count += 1
    profile.last_query_at = datetime.utcnow()
    await db.flush()
