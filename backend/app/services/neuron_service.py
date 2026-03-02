"""Neuron CRUD, candidate pre-filtering, and firing record management."""

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Neuron, NeuronFiring, SystemState
from app.services.scoring_engine import compute_score, NeuronScoreBreakdown


async def get_neuron(db: AsyncSession, neuron_id: int) -> Neuron | None:
    return await db.get(Neuron, neuron_id)


async def get_neurons_by_filter(
    db: AsyncSession,
    departments: list[str] | None = None,
    role_keys: list[str] | None = None,
    keywords: list[str] | None = None,
) -> list[Neuron]:
    """Pre-filter candidate neurons by classification results."""
    conditions = [Neuron.is_active == True]

    if departments:
        conditions.append(Neuron.department.in_(departments))
    if role_keys:
        conditions.append(Neuron.role_key.in_(role_keys))

    stmt = select(Neuron).where(and_(*conditions))
    result = await db.execute(stmt)
    neurons = list(result.scalars().all())

    if keywords:
        keyword_lower = [k.lower() for k in keywords]
        filtered = []
        for n in neurons:
            text = f"{n.label} {n.content or ''} {n.summary or ''}".lower()
            if any(kw in text for kw in keyword_lower):
                filtered.append(n)
        # If keyword filter is too aggressive, fall back to all candidates
        if filtered:
            neurons = filtered

    return neurons


async def get_system_state(db: AsyncSession) -> SystemState:
    result = await db.execute(select(SystemState).where(SystemState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        state = SystemState(id=1, global_token_counter=0, total_queries=0)
        db.add(state)
        await db.flush()
    return state


async def score_candidates(
    db: AsyncSession,
    candidates: list[Neuron],
    global_token_counter: int,
) -> list[NeuronScoreBreakdown]:
    """Score all candidate neurons using 5 biomimetic signals."""
    scores = []
    token_window = max(0, global_token_counter - settings.burst_window_tokens)

    for neuron in candidates:
        # Burst: count firings in recent token window
        burst_count_result = await db.execute(
            select(func.count(NeuronFiring.id)).where(
                and_(
                    NeuronFiring.neuron_id == neuron.id,
                    NeuronFiring.global_token_offset >= token_window,
                )
            )
        )
        fires_in_window = burst_count_result.scalar() or 0

        # Practice: get firing gap tokens
        firings_result = await db.execute(
            select(NeuronFiring.global_token_offset)
            .where(NeuronFiring.neuron_id == neuron.id)
            .order_by(NeuronFiring.global_token_offset)
        )
        offsets = [r[0] for r in firings_result.all()]
        gaps = [offsets[i + 1] - offsets[i] for i in range(len(offsets) - 1)] if len(offsets) > 1 else []

        # Novelty: age in tokens (approximate from created_at vs current counter)
        # For neurons that have never fired, use a default age based on creation
        age_tokens = global_token_counter  # max age for unfired neurons

        # Recency: tokens since last firing
        if offsets:
            tokens_since_last = global_token_counter - offsets[-1]
        else:
            tokens_since_last = global_token_counter  # never fired = maximally old

        score = compute_score(
            fires_in_window=fires_in_window,
            avg_utility=neuron.avg_utility,
            firing_gap_tokens=gaps,
            age_tokens=age_tokens,
            tokens_since_last_fire=tokens_since_last,
            neuron_id=neuron.id,
        )
        scores.append(score)

    scores.sort(key=lambda s: s.combined, reverse=True)
    return scores


async def record_firing(
    db: AsyncSession,
    neuron_id: int,
    query_id: int,
    global_token_offset: int,
    context_type: str = "direct",
) -> NeuronFiring:
    """Record a neuron firing event."""
    firing = NeuronFiring(
        neuron_id=neuron_id,
        query_id=query_id,
        context_type=context_type,
        global_token_offset=global_token_offset,
    )
    db.add(firing)

    neuron = await db.get(Neuron, neuron_id)
    if neuron:
        neuron.invocations = (neuron.invocations or 0) + 1

    return firing


async def get_neuron_tree(
    db: AsyncSession,
    department: str | None = None,
    role_key: str | None = None,
) -> list[dict]:
    """Build nested tree structure for neurons."""
    conditions = []
    if department:
        conditions.append(Neuron.department == department)
    if role_key:
        conditions.append(Neuron.role_key == role_key)

    stmt = select(Neuron).where(*conditions) if conditions else select(Neuron)
    stmt = stmt.order_by(Neuron.layer, Neuron.id)
    result = await db.execute(stmt)
    all_neurons = list(result.scalars().all())

    # Build parent→children map
    children_map: dict[int | None, list[Neuron]] = {}
    for n in all_neurons:
        children_map.setdefault(n.parent_id, []).append(n)

    def build_node(neuron: Neuron) -> dict:
        node = {
            "id": neuron.id,
            "layer": neuron.layer,
            "node_type": neuron.node_type,
            "label": neuron.label,
            "department": neuron.department,
            "role_key": neuron.role_key,
            "invocations": neuron.invocations,
            "avg_utility": neuron.avg_utility,
        }
        kids = children_map.get(neuron.id, [])
        if kids:
            node["children"] = [build_node(c) for c in kids]
        return node

    roots = children_map.get(None, [])
    return [build_node(r) for r in roots]


async def get_graph_stats(db: AsyncSession) -> dict:
    """Get neuron graph statistics."""
    total = (await db.execute(select(func.count(Neuron.id)))).scalar() or 0

    by_layer = {}
    for layer in range(6):
        count = (await db.execute(
            select(func.count(Neuron.id)).where(Neuron.layer == layer)
        )).scalar() or 0
        by_layer[f"layer_{layer}"] = count

    by_type = {}
    type_result = await db.execute(
        select(Neuron.node_type, func.count(Neuron.id)).group_by(Neuron.node_type)
    )
    for node_type, count in type_result.all():
        by_type[node_type] = count

    dept_result = await db.execute(
        select(Neuron.department, func.count(Neuron.id))
        .where(Neuron.department.isnot(None))
        .group_by(Neuron.department)
    )
    by_dept = {dept: count for dept, count in dept_result.all()}

    total_firings = (await db.execute(select(func.count(NeuronFiring.id)))).scalar() or 0

    return {
        "total_neurons": total,
        "by_layer": by_layer,
        "by_type": by_type,
        "by_department": by_dept,
        "total_firings": total_firings,
    }
