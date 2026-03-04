"""Neuron CRUD, candidate pre-filtering, and firing record management."""

from sqlalchemy import select, func, and_, or_
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
    """Pre-filter candidate neurons by classification results.

    Uses OR between department and role_key filters so that a neuron matching
    either the classified departments or role_keys is included. This prevents
    misclassified departments from excluding neurons with correct role_keys.
    """
    base = [Neuron.is_active == True]

    # OR between dept and role_key: match either classification signal
    match_conditions = []
    if departments:
        match_conditions.append(Neuron.department.in_(departments))
    if role_keys:
        match_conditions.append(Neuron.role_key.in_(role_keys))

    if match_conditions:
        base.append(or_(*match_conditions))

    stmt = select(Neuron).where(and_(*base))
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
    total_queries: int,
    keywords: list[str],
    classified_departments: list[str] | None = None,
    classified_role_keys: list[str] | None = None,
) -> list[NeuronScoreBreakdown]:
    """Score all candidate neurons using 6 biomimetic signals."""
    scores = []
    query_window = max(0, total_queries - settings.burst_window_queries)

    for neuron in candidates:
        # Burst: count firings in recent query window
        burst_count_result = await db.execute(
            select(func.count(NeuronFiring.id)).where(
                and_(
                    NeuronFiring.neuron_id == neuron.id,
                    NeuronFiring.global_query_offset >= query_window,
                )
            )
        )
        fires_in_window = burst_count_result.scalar() or 0

        # Precision: neuron's distinct query firings / department's total distinct query firings
        dept_fires_result = await db.execute(
            select(func.count(func.distinct(NeuronFiring.query_id))).where(
                NeuronFiring.neuron_id == neuron.id
            )
        )
        dept_fires = dept_fires_result.scalar() or 0

        dept_total_result = await db.execute(
            select(func.count(func.distinct(NeuronFiring.query_id))).where(
                NeuronFiring.neuron_id.in_(
                    select(Neuron.id).where(Neuron.department == neuron.department)
                )
            )
        )
        dept_total_queries = dept_total_result.scalar() or 0

        # Novelty: age in queries
        age_queries = total_queries - (neuron.created_at_query_count or 0)

        # Recency: queries since last firing
        last_offset_result = await db.execute(
            select(func.max(NeuronFiring.global_query_offset)).where(
                NeuronFiring.neuron_id == neuron.id
            )
        )
        last_offset = last_offset_result.scalar()
        queries_since_last = total_queries - last_offset if last_offset is not None else total_queries

        # Relevance: keyword overlap with neuron text
        neuron_text = f"{neuron.label} {neuron.summary or ''} {neuron.content or ''}"

        # Classification match: does this neuron's dept/role match what the classifier said?
        dept_match = bool(classified_departments and neuron.department in classified_departments)
        role_match = bool(classified_role_keys and neuron.role_key in classified_role_keys)

        score = compute_score(
            fires_in_window=fires_in_window,
            avg_utility=neuron.avg_utility,
            dept_fires=dept_fires,
            dept_total_queries=dept_total_queries,
            age_queries=age_queries,
            queries_since_last=queries_since_last,
            keywords=keywords,
            neuron_text=neuron_text,
            neuron_id=neuron.id,
            dept_match=dept_match,
            role_match=role_match,
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
    global_query_offset: int = 0,
) -> NeuronFiring:
    """Record a neuron firing event."""
    firing = NeuronFiring(
        neuron_id=neuron_id,
        query_id=query_id,
        context_type=context_type,
        global_token_offset=global_token_offset,
        global_query_offset=global_query_offset,
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

    # Per-department role breakdown: { dept: { role_label: count } }
    # Get L1 role neurons and count all descendants per role
    from sqlalchemy import text
    role_breakdown_result = await db.execute(text("""
        SELECT r.department, r.label, COUNT(n.id)
        FROM neurons r
        JOIN neurons n ON n.department = r.department
            AND n.role_key = r.role_key
        WHERE r.layer = 1
            AND r.department IS NOT NULL
        GROUP BY r.department, r.label
        ORDER BY r.department, COUNT(n.id) DESC
    """))
    by_dept_roles: dict[str, dict[str, int]] = {}
    for dept, role_label, count in role_breakdown_result.all():
        by_dept_roles.setdefault(dept, {})[role_label] = count

    total_firings = (await db.execute(select(func.count(NeuronFiring.id)))).scalar() or 0

    # Role bubble data: neuron_count, total_invocations, avg_utility per L1 role
    bubble_result = await db.execute(text("""
        SELECT r.label, r.department,
               COUNT(n.id) AS neuron_count,
               SUM(n.invocations) AS total_invocations,
               AVG(n.avg_utility) AS avg_utility
        FROM neurons r
        JOIN neurons n ON n.department = r.department
            AND n.role_key = r.role_key
        WHERE r.layer = 1
            AND r.department IS NOT NULL
        GROUP BY r.label, r.department
        ORDER BY COUNT(n.id) DESC
    """))
    role_bubbles = [
        {
            "role": role, "department": dept,
            "neuron_count": count,
            "total_invocations": int(invoc or 0),
            "avg_utility": round(float(util or 0.5), 3),
        }
        for role, dept, count, invoc, util in bubble_result.all()
    ]

    return {
        "total_neurons": total,
        "by_layer": by_layer,
        "by_type": by_type,
        "by_department": by_dept,
        "by_department_roles": by_dept_roles,
        "role_bubbles": role_bubbles,
        "total_firings": total_firings,
    }
