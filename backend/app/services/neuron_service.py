"""Neuron CRUD, candidate pre-filtering, and firing record management."""

import json
from dataclasses import dataclass

from sqlalchemy import select, func, and_, or_, text, literal_column, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Neuron, NeuronEdge, NeuronFiring, SystemState
from app.services.scoring_engine import compute_score, NeuronScoreBreakdown


@dataclass
class NeuronCandidate:
    """Lightweight neuron representation for scoring (no content blob)."""
    id: int
    label: str
    summary: str | None
    department: str | None
    role_key: str | None
    avg_utility: float
    invocations: int
    created_at_query_count: int
    keyword_hits: int = 0


async def get_neuron(db: AsyncSession, neuron_id: int) -> Neuron | None:
    return await db.get(Neuron, neuron_id)


async def get_neurons_by_filter(
    db: AsyncSession,
    departments: list[str] | None = None,
    role_keys: list[str] | None = None,
    keywords: list[str] | None = None,
) -> list[NeuronCandidate]:
    """Pre-filter candidate neurons by classification results.

    Returns lightweight NeuronCandidate objects (no content blob) ranked by
    SQL-side keyword hits, limited to candidate_limit. Full content is only
    loaded later for the final top-K during prompt assembly.
    """
    conditions = ["is_active = true"]
    params: dict = {}

    # OR between dept and role_key
    match_parts = []
    if departments:
        placeholders = ", ".join(f":dept_{i}" for i in range(len(departments)))
        match_parts.append(f"department IN ({placeholders})")
        for i, d in enumerate(departments):
            params[f"dept_{i}"] = d
    if role_keys:
        placeholders = ", ".join(f":role_{i}" for i in range(len(role_keys)))
        match_parts.append(f"role_key IN ({placeholders})")
        for i, r in enumerate(role_keys):
            params[f"role_{i}"] = r
    if match_parts:
        conditions.append(f"({' OR '.join(match_parts)})")

    # Build keyword hit count expression for SQL-side ranking
    kw_parts = []
    if keywords:
        for i, kw in enumerate(keywords):
            param_name = f"kw_{i}"
            params[param_name] = f"%{kw.lower()}%"
            kw_parts.append(
                f"(CASE WHEN lower(label) LIKE :{param_name} THEN 1 ELSE 0 END + "
                f"CASE WHEN lower(summary) LIKE :{param_name} THEN 1 ELSE 0 END + "
                f"CASE WHEN lower(content) LIKE :{param_name} THEN 1 ELSE 0 END)"
            )

    kw_expr = " + ".join(kw_parts) if kw_parts else "0"
    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT id, label, summary, department, role_key, avg_utility,
               invocations, created_at_query_count, ({kw_expr}) AS keyword_hits
        FROM neurons
        WHERE {where_clause}
        ORDER BY keyword_hits DESC, avg_utility DESC
        LIMIT :lim
    """
    params["lim"] = settings.candidate_limit

    result = await db.execute(text(sql), params)
    rows = result.all()

    if not rows and (departments or role_keys):
        # Fallback: no matches with dept/role filter — try without
        sql_fallback = f"""
            SELECT id, label, summary, department, role_key, avg_utility,
                   invocations, created_at_query_count, ({kw_expr}) AS keyword_hits
            FROM neurons
            WHERE is_active = true
            ORDER BY keyword_hits DESC, avg_utility DESC
            LIMIT :lim
        """
        result = await db.execute(text(sql_fallback), params)
        rows = result.all()

    return [
        NeuronCandidate(
            id=r[0], label=r[1], summary=r[2], department=r[3], role_key=r[4],
            avg_utility=r[5] or 0.5, invocations=r[6] or 0,
            created_at_query_count=r[7] or 0, keyword_hits=r[8] or 0,
        )
        for r in rows
    ]


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
    candidates: list[Neuron] | list[NeuronCandidate],
    total_queries: int,
    keywords: list[str],
    classified_departments: list[str] | None = None,
    classified_role_keys: list[str] | None = None,
) -> list[NeuronScoreBreakdown]:
    """Score all candidate neurons using 6 biomimetic signals.

    Accepts either full Neuron ORM objects or lightweight NeuronCandidate.
    Batches all DB lookups into 3 aggregate queries instead of 4 per candidate.
    """
    if not candidates:
        return []

    candidate_ids = [n.id for n in candidates]
    query_window = max(0, total_queries - settings.burst_window_queries)

    # --- Batch query 1: burst counts (firings in recent window, per neuron) ---
    burst_result = await db.execute(
        select(
            NeuronFiring.neuron_id,
            func.count(NeuronFiring.id),
        )
        .where(
            and_(
                NeuronFiring.neuron_id.in_(candidate_ids),
                NeuronFiring.global_query_offset >= query_window,
            )
        )
        .group_by(NeuronFiring.neuron_id)
    )
    burst_map = dict(burst_result.all())  # {neuron_id: count}

    # --- Batch query 2: per-neuron distinct query fires + last offset ---
    neuron_stats_result = await db.execute(
        select(
            NeuronFiring.neuron_id,
            func.count(func.distinct(NeuronFiring.query_id)),
            func.max(NeuronFiring.global_query_offset),
        )
        .where(NeuronFiring.neuron_id.in_(candidate_ids))
        .group_by(NeuronFiring.neuron_id)
    )
    neuron_fires_map = {}  # {neuron_id: distinct_query_count}
    last_offset_map = {}   # {neuron_id: max_global_query_offset}
    for nid, fires, last_off in neuron_stats_result.all():
        neuron_fires_map[nid] = fires
        last_offset_map[nid] = last_off

    # --- Batch query 3: dept-level total distinct query fires ---
    candidate_depts = list({n.department for n in candidates if n.department})
    dept_total_map = {}  # {department: distinct_query_count}
    if candidate_depts:
        dept_total_result = await db.execute(
            select(
                Neuron.department,
                func.count(func.distinct(NeuronFiring.query_id)),
            )
            .join(NeuronFiring, NeuronFiring.neuron_id == Neuron.id)
            .where(Neuron.department.in_(candidate_depts))
            .group_by(Neuron.department)
        )
        dept_total_map = dict(dept_total_result.all())

    # --- Score each candidate using pre-fetched data ---
    scores = []
    for neuron in candidates:
        fires_in_window = burst_map.get(neuron.id, 0)
        dept_fires = neuron_fires_map.get(neuron.id, 0)
        dept_total = dept_total_map.get(neuron.department, 0)
        age_queries = total_queries - (neuron.created_at_query_count or 0)

        last_offset = last_offset_map.get(neuron.id)
        queries_since_last = total_queries - last_offset if last_offset is not None else total_queries

        content = getattr(neuron, 'content', None) or ''
        neuron_text = f"{neuron.label} {neuron.summary or ''} {content}"
        dept_match = bool(classified_departments and neuron.department in classified_departments)
        role_match = bool(classified_role_keys and neuron.role_key in classified_role_keys)

        score = compute_score(
            fires_in_window=fires_in_window,
            avg_utility=neuron.avg_utility,
            dept_fires=dept_fires,
            dept_total_queries=dept_total,
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


async def spread_activation(
    db: AsyncSession,
    scored: list[NeuronScoreBreakdown],
    top_k_count: int,
) -> list[NeuronScoreBreakdown]:
    """Multi-hop spread activation through NeuronEdge co-firing graph.

    Propagates activation from top-K neurons through high-weight edges to discover
    associatively-linked neurons, including "bridge" entities not directly connected
    to the query but reachable via intermediate nodes. Based on spreading activation
    theory from cognitive science (Collins & Loftus 1975) and adapted for KG-based
    RAG per SA-RAG (Pavlovic et al., arXiv:2512.15922, Dec 2025).

    Each hop compounds decay: hop-N activation = source_activation * edge_weight * decay.
    Uses max (not sum) across paths to prevent hub bias.
    """
    if not settings.spread_enabled or not scored:
        return scored

    top_k = scored[:top_k_count]
    below_cutoff = scored[top_k_count:]
    top_k_ids = {s.neuron_id for s in top_k}
    score_by_id = {s.neuron_id: s for s in scored}

    # Track best activation seen for each neighbor across all hops
    neighbor_activation: dict[int, float] = {}  # neighbor_id → max activation

    # Frontier starts as top-K neurons with their combined scores
    frontier: dict[int, float] = {s.neuron_id: s.combined for s in top_k}
    visited: set[int] = set(top_k_ids)

    for hop in range(settings.spread_max_hops):
        frontier_ids = list(frontier.keys())
        if not frontier_ids:
            break

        # Fetch only edges touching the current frontier (not the entire table)
        edge_result = await db.execute(
            select(NeuronEdge).where(
                and_(
                    NeuronEdge.weight >= settings.spread_min_edge_weight,
                    or_(
                        NeuronEdge.source_id.in_(frontier_ids),
                        NeuronEdge.target_id.in_(frontier_ids),
                    ),
                )
            )
        )
        hop_edges = list(edge_result.scalars().all())

        if not hop_edges:
            break

        # Build adjacency for this hop only
        adjacency: dict[int, list[tuple[int, float]]] = {}
        for edge in hop_edges:
            adjacency.setdefault(edge.source_id, []).append((edge.target_id, edge.weight))
            adjacency.setdefault(edge.target_id, []).append((edge.source_id, edge.weight))

        next_frontier: dict[int, float] = {}

        for source_id, source_activation in frontier.items():
            for neighbor_id, edge_weight in adjacency.get(source_id, []):
                activation = source_activation * edge_weight * settings.spread_decay

                if activation < settings.spread_min_activation:
                    continue

                # Skip neurons already in top-K (no self-reinforcement)
                if neighbor_id in top_k_ids:
                    continue

                # Max across all paths to this neighbor (prevents hub bias)
                if neighbor_id not in neighbor_activation or activation > neighbor_activation[neighbor_id]:
                    neighbor_activation[neighbor_id] = activation

                # Add to next frontier if not already visited (prevents cycles)
                if neighbor_id not in visited:
                    if neighbor_id not in next_frontier or activation > next_frontier[neighbor_id]:
                        next_frontier[neighbor_id] = activation

        if not next_frontier:
            break  # No more reachable nodes above threshold

        # Mark frontier nodes as visited, advance
        visited.update(next_frontier.keys())
        frontier = next_frontier

    if not neighbor_activation:
        return scored

    # Check which neighbors are active neurons
    neighbor_ids = list(neighbor_activation.keys())
    active_result = await db.execute(
        select(Neuron.id).where(
            and_(
                Neuron.id.in_(neighbor_ids),
                Neuron.is_active == True,
            )
        )
    )
    active_ids = {row[0] for row in active_result.all()}

    # Build list of neurons to promote, sorted by activation
    promotions: list[tuple[int, float]] = []
    for nid, activation in sorted(neighbor_activation.items(), key=lambda x: x[1], reverse=True):
        if nid not in active_ids:
            continue
        promotions.append((nid, activation))
        if len(promotions) >= settings.spread_max_neurons:
            break

    if not promotions:
        return scored

    # Apply boosts and create entries for unscored neighbors
    promoted_scores: list[NeuronScoreBreakdown] = []
    for nid, activation in promotions:
        if nid in score_by_id:
            # Already scored (below cutoff) — additive boost
            existing = score_by_id[nid]
            existing.spread_boost = round(activation, 4)
            existing.combined = round(existing.combined + activation, 4)
            promoted_scores.append(existing)
        else:
            # Never in candidate pool — create entry with pure activation
            promoted_scores.append(NeuronScoreBreakdown(
                neuron_id=nid,
                burst=0.0,
                impact=0.0,
                precision=0.0,
                novelty=0.0,
                recency=0.0,
                relevance=0.0,
                combined=round(activation, 4),
                spread_boost=round(activation, 4),
            ))

    # Displace lowest-scoring top-K neurons with promoted ones
    promoted_scores.sort(key=lambda s: s.combined, reverse=True)

    # Remove promoted neurons from below_cutoff if they were there
    promoted_ids = {s.neuron_id for s in promoted_scores}
    below_cutoff = [s for s in below_cutoff if s.neuron_id not in promoted_ids]

    # Merge: top-K + promotions, re-sort, take top_k_count
    merged = list(top_k) + promoted_scores
    merged.sort(key=lambda s: s.combined, reverse=True)
    new_top_k = merged[:top_k_count]

    # Displaced neurons go back to below_cutoff
    displaced = merged[top_k_count:]
    result = new_top_k + displaced + below_cutoff
    return result


async def apply_diversity_floor(
    db: AsyncSession,
    all_scored: list[NeuronScoreBreakdown],
    top_k_count: int,
) -> list[NeuronScoreBreakdown]:
    """Ensure department diversity when regulatory neurons with cross_ref_departments fire.

    1. Take top-K from scored list
    2. Check which top-K neurons have cross_ref_departments set
    3. If none, return top-K unchanged
    4. Collect union of cross-referenced department names
    5. For underrepresented departments, pull in highest-scoring candidates from full list
    6. Displace lowest-scoring non-regulatory, non-underrepresented neurons
    """
    top_k = all_scored[:top_k_count]
    if not top_k:
        return top_k

    # Gather neuron IDs in top-K that have cross_ref_departments
    top_k_ids = [s.neuron_id for s in top_k]
    result = await db.execute(
        select(Neuron.id, Neuron.cross_ref_departments)
        .where(
            Neuron.id.in_(top_k_ids),
            Neuron.cross_ref_departments.isnot(None),
        )
    )
    cross_ref_rows = result.all()
    if not cross_ref_rows:
        return top_k

    # Collect union of all cross-referenced departments
    cross_ref_depts: set[str] = set()
    for _, cross_ref_json in cross_ref_rows:
        try:
            depts = json.loads(cross_ref_json)
            cross_ref_depts.update(depts)
        except (json.JSONDecodeError, TypeError):
            pass

    if not cross_ref_depts:
        return top_k

    # Build department→neuron_ids map for current top-K
    top_k_neuron_ids = set(top_k_ids)
    dept_result = await db.execute(
        select(Neuron.id, Neuron.department).where(Neuron.id.in_(top_k_ids))
    )
    neuron_dept_map: dict[int, str] = {}
    dept_counts: dict[str, int] = {}
    for nid, dept in dept_result.all():
        neuron_dept_map[nid] = dept or ""
        dept_counts[dept or ""] = dept_counts.get(dept or "", 0) + 1

    # Calculate floor per cross-referenced department
    floor = max(settings.diversity_floor_min, top_k_count // len(cross_ref_depts))

    # Find underrepresented departments
    underrepresented: dict[str, int] = {}  # dept → how many more needed
    for dept in cross_ref_depts:
        current = dept_counts.get(dept, 0)
        if current < floor:
            underrepresented[dept] = floor - current

    if not underrepresented:
        return top_k

    # Build score lookup and department lookup for ALL scored neurons
    all_neuron_ids = [s.neuron_id for s in all_scored]
    all_dept_result = await db.execute(
        select(Neuron.id, Neuron.department).where(Neuron.id.in_(all_neuron_ids))
    )
    all_neuron_dept: dict[int, str] = {nid: (dept or "") for nid, dept in all_dept_result.all()}

    # Collect candidates from underrepresented depts (not already in top-K)
    candidates_to_add: list[NeuronScoreBreakdown] = []
    for score in all_scored:
        if score.neuron_id in top_k_neuron_ids:
            continue
        dept = all_neuron_dept.get(score.neuron_id, "")
        if dept in underrepresented and underrepresented[dept] > 0:
            candidates_to_add.append(score)
            underrepresented[dept] -= 1

    if not candidates_to_add:
        return top_k

    # Regulatory neuron IDs (don't displace these)
    regulatory_ids = {nid for nid, _ in cross_ref_rows}

    # Departments we're boosting (don't displace neurons from these depts)
    boosted_depts = set(cross_ref_depts)

    # Find displacement targets: lowest-scoring neurons that aren't regulatory or from boosted depts
    displacement_candidates = []
    for s in reversed(top_k):
        dept = neuron_dept_map.get(s.neuron_id, "")
        if s.neuron_id not in regulatory_ids and dept not in boosted_depts:
            displacement_candidates.append(s)
        if len(displacement_candidates) >= len(candidates_to_add):
            break

    # If not enough displacement targets, displace any non-regulatory lowest scorers
    if len(displacement_candidates) < len(candidates_to_add):
        for s in reversed(top_k):
            if s in displacement_candidates:
                continue
            if s.neuron_id not in regulatory_ids:
                displacement_candidates.append(s)
            if len(displacement_candidates) >= len(candidates_to_add):
                break

    # Perform displacement
    displace_ids = {s.neuron_id for s in displacement_candidates[:len(candidates_to_add)]}
    result_list = [s for s in top_k if s.neuron_id not in displace_ids]
    result_list.extend(candidates_to_add)
    result_list.sort(key=lambda s: s.combined, reverse=True)

    return result_list


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
    max_depth: int | None = None,
) -> list[dict]:
    """Build nested tree structure for neurons.

    If max_depth is set, only builds tree to that depth (0=roots only, 2=roots+children+grandchildren).
    At 200K neurons, callers should use max_depth=2 or the /neurons/children endpoint.
    """
    conditions = []
    if department:
        conditions.append(Neuron.department == department)
    if role_key:
        conditions.append(Neuron.role_key == role_key)
    if max_depth is not None:
        conditions.append(Neuron.layer <= max_depth)

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
