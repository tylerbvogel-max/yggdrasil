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


def _build_filter_conditions(
    departments: list[str] | None,
    role_keys: list[str] | None,
    params: dict,
) -> list[str]:
    conditions = ["is_active = true"]

    if role_keys:
        role_placeholders = ", ".join(f":role_{i}" for i in range(len(role_keys)))
        for i, r in enumerate(role_keys):
            params[f"role_{i}"] = r
        if departments:
            dept_placeholders = ", ".join(f":dept_{i}" for i in range(len(departments)))
            for i, d in enumerate(departments):
                params[f"dept_{i}"] = d
            conditions.append(
                f"(role_key IN ({role_placeholders}) "
                f"OR (department IN ({dept_placeholders}) AND layer <= 1))"
            )
        else:
            conditions.append(f"role_key IN ({role_placeholders})")
    elif departments:
        placeholders = ", ".join(f":dept_{i}" for i in range(len(departments)))
        conditions.append(f"department IN ({placeholders})")
        for i, d in enumerate(departments):
            params[f"dept_{i}"] = d

    return conditions


def _build_keyword_expr(keywords: list[str] | None, params: dict) -> str:
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
    return " + ".join(kw_parts) if kw_parts else "0"


def _build_candidate_sql(where_clause: str, kw_expr: str) -> str:
    return f"""
        SELECT id, label, summary, department, role_key, avg_utility,
               invocations, created_at_query_count, ({kw_expr}) AS keyword_hits
        FROM neurons
        WHERE {where_clause}
        ORDER BY keyword_hits DESC, avg_utility DESC
        LIMIT :lim
    """


def _rows_to_candidates(rows: list) -> list[NeuronCandidate]:
    return [
        NeuronCandidate(
            id=r[0], label=r[1], summary=r[2], department=r[3], role_key=r[4],
            avg_utility=r[5] or 0.5, invocations=r[6] or 0,
            created_at_query_count=r[7] or 0, keyword_hits=r[8] or 0,
        )
        for r in rows
    ]


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
    params: dict = {}
    conditions = _build_filter_conditions(departments, role_keys, params)
    kw_expr = _build_keyword_expr(keywords, params)
    params["lim"] = settings.candidate_limit

    where_clause = " AND ".join(conditions)
    sql = _build_candidate_sql(where_clause, kw_expr)

    result = await db.execute(text(sql), params)
    rows = result.all()

    if not rows and (departments or role_keys):
        fallback_sql = _build_candidate_sql("is_active = true", kw_expr)
        result = await db.execute(text(fallback_sql), params)
        rows = result.all()

    return _rows_to_candidates(rows)


async def get_system_state(db: AsyncSession) -> SystemState:
    result = await db.execute(select(SystemState).where(SystemState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        state = SystemState(id=1, global_token_counter=0, total_queries=0)
        db.add(state)
        await db.flush()
    return state


async def _fetch_burst_counts(
    db: AsyncSession,
    candidate_ids: list[int],
    query_window: int,
) -> dict[int, int]:
    """Batch query: firings in recent window per neuron."""
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
    assert burst_result is not None, "Burst count query returned None"
    return dict(burst_result.all())


async def _fetch_neuron_fire_stats(
    db: AsyncSession,
    candidate_ids: list[int],
) -> tuple[dict[int, int], dict[int, int]]:
    """Batch query: per-neuron distinct query fires and last offset."""
    neuron_stats_result = await db.execute(
        select(
            NeuronFiring.neuron_id,
            func.count(func.distinct(NeuronFiring.query_id)),
            func.max(NeuronFiring.global_query_offset),
        )
        .where(NeuronFiring.neuron_id.in_(candidate_ids))
        .group_by(NeuronFiring.neuron_id)
    )
    neuron_fires_map: dict[int, int] = {}
    last_offset_map: dict[int, int] = {}
    for nid, fires, last_off in neuron_stats_result.all():
        neuron_fires_map[nid] = fires
        last_offset_map[nid] = last_off
    assert isinstance(neuron_fires_map, dict), "neuron_fires_map must be a dict"
    return neuron_fires_map, last_offset_map


async def _fetch_dept_fire_totals(
    db: AsyncSession,
    candidates: list[Neuron] | list[NeuronCandidate],
) -> dict[str, int]:
    """Batch query: dept-level total distinct query fires."""
    candidate_depts = list({n.department for n in candidates if n.department})
    if not candidate_depts:
        return {}
    dept_total_result = await db.execute(
        select(
            Neuron.department,
            func.count(func.distinct(NeuronFiring.query_id)),
        )
        .join(NeuronFiring, NeuronFiring.neuron_id == Neuron.id)
        .where(Neuron.department.in_(candidate_depts))
        .group_by(Neuron.department)
    )
    assert dept_total_result is not None, "Dept fire totals query returned None"
    return dict(dept_total_result.all())


async def _resolve_semantic_map(
    db: AsyncSession,
    candidate_ids: list[int],
    query_embedding: list[float] | None,
    precomputed_similarities: dict[int, float] | None,
) -> dict[int, float]:
    """Resolve semantic similarity scores from precomputed values or embeddings."""
    if precomputed_similarities is not None:
        return precomputed_similarities
    if query_embedding is None:
        return {}
    emb_result = await db.execute(
        text("SELECT id, embedding FROM neurons WHERE id IN :ids AND embedding IS NOT NULL"),
        {"ids": tuple(candidate_ids) if candidate_ids else (0,)},
    )
    neuron_vecs = []
    neuron_ids_with_emb = []
    for nid, emb_json in emb_result.all():
        neuron_ids_with_emb.append(nid)
        neuron_vecs.append(json.loads(emb_json))
    if not neuron_vecs:
        return {}
    from app.services.embedding_service import batch_cosine_similarity
    similarities = batch_cosine_similarity(query_embedding, neuron_vecs)
    assert len(similarities) == len(neuron_ids_with_emb), "Similarity count mismatch"
    return dict(zip(neuron_ids_with_emb, similarities))


def _score_single_candidate(
    neuron: Neuron | NeuronCandidate,
    total_queries: int,
    keywords: list[str],
    burst_map: dict[int, int],
    neuron_fires_map: dict[int, int],
    dept_total_map: dict[str, int],
    last_offset_map: dict[int, int],
    semantic_map: dict[int, float],
    classified_departments: list[str] | None,
    classified_role_keys: list[str] | None,
) -> NeuronScoreBreakdown:
    """Compute score breakdown for a single candidate neuron."""
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
        semantic_similarity=semantic_map.get(neuron.id),
    )
    assert score.combined >= 0, f"Score for neuron {neuron.id} is negative: {score.combined}"
    return score


async def score_candidates(
    db: AsyncSession,
    candidates: list[Neuron] | list[NeuronCandidate],
    total_queries: int,
    keywords: list[str],
    classified_departments: list[str] | None = None,
    classified_role_keys: list[str] | None = None,
    query_embedding: list[float] | None = None,
    precomputed_similarities: dict[int, float] | None = None,
) -> list[NeuronScoreBreakdown]:
    """Score all candidate neurons using 6 biomimetic signals.

    Accepts either full Neuron ORM objects or lightweight NeuronCandidate.
    Batches all DB lookups into 3 aggregate queries instead of 4 per candidate.

    If precomputed_similarities is provided (from semantic prefilter), uses those
    directly instead of loading embeddings from DB. Otherwise falls back to
    query_embedding-based lookup or keyword matching.
    """
    if not candidates:
        return []

    input_count = len(candidates)
    candidate_ids = [n.id for n in candidates]
    query_window = max(0, total_queries - settings.burst_window_queries)

    burst_map = await _fetch_burst_counts(db, candidate_ids, query_window)
    neuron_fires_map, last_offset_map = await _fetch_neuron_fire_stats(db, candidate_ids)
    dept_total_map = await _fetch_dept_fire_totals(db, candidates)
    semantic_map = await _resolve_semantic_map(
        db, candidate_ids, query_embedding, precomputed_similarities,
    )

    scores = [
        _score_single_candidate(
            neuron, total_queries, keywords,
            burst_map, neuron_fires_map, dept_total_map,
            last_offset_map, semantic_map,
            classified_departments, classified_role_keys,
        )
        for neuron in candidates
    ]
    scores.sort(key=lambda s: s.combined, reverse=True)

    assert all(s.combined >= 0 for s in scores), "All combined scores must be non-negative"
    assert len(scores) <= input_count, f"Output length {len(scores)} exceeds input length {input_count}"
    return scores


def _compute_edge_activation(
    source_activation: float,
    edge_weight: float,
    edge_type: str,
) -> float | None:
    """Return activation for an edge, or None if the edge should be skipped."""
    if edge_type == "stellate":
        decay = settings.spread_stellate_decay
    elif edge_type == "instantiates":
        decay = settings.spread_instantiate_decay
        if edge_weight < settings.spread_instantiate_min_weight:
            return None
    else:
        decay = settings.spread_decay
        if edge_weight < settings.spread_pyramidal_min_weight:
            return None
    activation = source_activation * edge_weight * decay
    if activation < settings.spread_min_activation:
        return None
    return activation


def _build_adjacency(
    hop_edges: list,
) -> dict[int, list[tuple[int, float, str]]]:
    """Build bidirectional adjacency list from edge objects."""
    adjacency: dict[int, list[tuple[int, float, str]]] = {}
    for edge in hop_edges:
        etype = edge.edge_type or "pyramidal"
        adjacency.setdefault(edge.source_id, []).append((edge.target_id, edge.weight, etype))
        adjacency.setdefault(edge.target_id, []).append((edge.source_id, edge.weight, etype))
    return adjacency


def _propagate_frontier(
    frontier: dict[int, float],
    adjacency: dict[int, list[tuple[int, float, str]]],
    top_k_ids: set[int],
    visited: set[int],
    neighbor_activation: dict[int, float],
) -> dict[int, float]:
    """Propagate activation from frontier through adjacency, return next frontier."""
    next_frontier: dict[int, float] = {}
    for source_id, source_act in frontier.items():
        for neighbor_id, edge_weight, edge_type in adjacency.get(source_id, []):
            activation = _compute_edge_activation(source_act, edge_weight, edge_type)
            if activation is None:
                continue
            if neighbor_id in top_k_ids:
                continue
            if neighbor_id not in neighbor_activation or activation > neighbor_activation[neighbor_id]:
                neighbor_activation[neighbor_id] = activation
            if neighbor_id not in visited:
                if neighbor_id not in next_frontier or activation > next_frontier[neighbor_id]:
                    next_frontier[neighbor_id] = activation
    return next_frontier


async def _fetch_frontier_edges(
    db: AsyncSession,
    frontier_ids: list[int],
) -> list:
    """Fetch edges touching the current frontier above minimum weight."""
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
    return list(edge_result.scalars().all())


def _build_promoted_scores(
    promotions: list[tuple[int, float]],
    score_by_id: dict[int, NeuronScoreBreakdown],
) -> list[NeuronScoreBreakdown]:
    """Apply boosts to existing scores or create new entries for unscored neighbors."""
    promoted: list[NeuronScoreBreakdown] = []
    for nid, activation in promotions:
        if nid in score_by_id:
            existing = score_by_id[nid]
            existing.spread_boost = round(activation, 4)
            existing.combined = round(existing.combined + activation, 4)
            promoted.append(existing)
        else:
            promoted.append(NeuronScoreBreakdown(
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
    return promoted


def _merge_promoted_into_scored(
    top_k: list[NeuronScoreBreakdown],
    below_cutoff: list[NeuronScoreBreakdown],
    promoted_scores: list[NeuronScoreBreakdown],
    top_k_count: int,
) -> list[NeuronScoreBreakdown]:
    """Merge promoted neurons into scored list, displacing lowest top-K as needed."""
    promoted_scores.sort(key=lambda s: s.combined, reverse=True)
    promoted_ids = {s.neuron_id for s in promoted_scores}
    below_cutoff = [s for s in below_cutoff if s.neuron_id not in promoted_ids]
    merged = list(top_k) + promoted_scores
    merged.sort(key=lambda s: s.combined, reverse=True)
    new_top_k = merged[:top_k_count]
    displaced = merged[top_k_count:]
    return new_top_k + displaced + below_cutoff


async def _select_promotion_targets(
    db: AsyncSession,
    neighbor_activation: dict[int, float],
) -> list[tuple[int, float]]:
    """Filter neighbors to active neurons, return top candidates sorted by activation."""
    neighbor_ids = list(neighbor_activation.keys())
    active_result = await db.execute(
        select(Neuron.id).where(
            and_(Neuron.id.in_(neighbor_ids), Neuron.is_active == True)
        )
    )
    active_ids = {row[0] for row in active_result.all()}

    promotions: list[tuple[int, float]] = []
    for nid, activation in sorted(neighbor_activation.items(), key=lambda x: x[1], reverse=True):
        if nid not in active_ids:
            continue
        promotions.append((nid, activation))
        if len(promotions) >= settings.spread_max_neurons:
            break
    return promotions


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
    assert top_k_count > 0, f"top_k_count must be positive, got {top_k_count}"
    input_length = len(scored)

    if not settings.spread_enabled or not scored:
        return scored

    top_k = scored[:top_k_count]
    below_cutoff = scored[top_k_count:]
    top_k_ids = {s.neuron_id for s in top_k}
    score_by_id = {s.neuron_id: s for s in scored}

    neighbor_activation: dict[int, float] = {}
    frontier: dict[int, float] = {s.neuron_id: s.combined for s in top_k}
    visited: set[int] = set(top_k_ids)

    for hop in range(settings.spread_max_hops):
        frontier_ids = list(frontier.keys())
        if not frontier_ids:
            break
        hop_edges = await _fetch_frontier_edges(db, frontier_ids)
        if not hop_edges:
            break
        adjacency = _build_adjacency(hop_edges)
        next_frontier = _propagate_frontier(
            frontier, adjacency, top_k_ids, visited, neighbor_activation,
        )
        if not next_frontier:
            break
        visited.update(next_frontier.keys())
        frontier = next_frontier

    if not neighbor_activation:
        return scored

    promotions = await _select_promotion_targets(db, neighbor_activation)
    if not promotions:
        return scored

    promoted_scores = _build_promoted_scores(promotions, score_by_id)
    result = _merge_promoted_into_scored(top_k, below_cutoff, promoted_scores, top_k_count)
    assert len(result) >= input_length, f"Spread activation lost neurons: {len(result)} < {input_length}"
    return result


def _parse_cross_ref_departments(cross_ref_rows: list) -> set[str]:
    """Extract union of department names from cross_ref_departments JSON rows."""
    cross_ref_depts: set[str] = set()
    for _, cross_ref_json in cross_ref_rows:
        try:
            depts = json.loads(cross_ref_json)
            cross_ref_depts.update(depts)
        except (json.JSONDecodeError, TypeError):
            pass
    return cross_ref_depts


def _find_underrepresented_depts(
    cross_ref_depts: set[str],
    dept_counts: dict[str, int],
    top_k_count: int,
) -> dict[str, int]:
    """Return {dept: slots_needed} for departments below the diversity floor."""
    assert len(cross_ref_depts) > 0, "cross_ref_depts must not be empty"
    floor = max(settings.diversity_floor_min, top_k_count // len(cross_ref_depts))
    underrepresented: dict[str, int] = {}
    for dept in cross_ref_depts:
        current = dept_counts.get(dept, 0)
        if current < floor:
            underrepresented[dept] = floor - current
    return underrepresented


def _collect_diversity_candidates(
    all_scored: list[NeuronScoreBreakdown],
    top_k_neuron_ids: set[int],
    all_neuron_dept: dict[int, str],
    underrepresented: dict[str, int],
) -> list[NeuronScoreBreakdown]:
    """Pick highest-scoring neurons from underrepresented depts not already in top-K."""
    candidates: list[NeuronScoreBreakdown] = []
    remaining = dict(underrepresented)
    for score in all_scored:
        if score.neuron_id in top_k_neuron_ids:
            continue
        dept = all_neuron_dept.get(score.neuron_id, "")
        if dept in remaining and remaining[dept] > 0:
            candidates.append(score)
            remaining[dept] -= 1
    return candidates


def _find_displacement_targets(
    top_k: list[NeuronScoreBreakdown],
    needed: int,
    regulatory_ids: set[int],
    boosted_depts: set[str],
    neuron_dept_map: dict[int, str],
) -> set[int]:
    """Select lowest-scoring top-K neurons to displace, avoiding regulatory and boosted."""
    assert needed > 0, "needed must be positive"
    displacement_candidates: list[NeuronScoreBreakdown] = []
    for s in reversed(top_k):
        dept = neuron_dept_map.get(s.neuron_id, "")
        if s.neuron_id not in regulatory_ids and dept not in boosted_depts:
            displacement_candidates.append(s)
        if len(displacement_candidates) >= needed:
            break

    if len(displacement_candidates) < needed:
        existing = set(id(s) for s in displacement_candidates)
        for s in reversed(top_k):
            if id(s) in existing:
                continue
            if s.neuron_id not in regulatory_ids:
                displacement_candidates.append(s)
            if len(displacement_candidates) >= needed:
                break

    return {s.neuron_id for s in displacement_candidates[:needed]}


async def _fetch_cross_ref_depts(
    db: AsyncSession,
    top_k_ids: list[int],
) -> tuple[list, set[str]]:
    """Fetch cross_ref_departments rows for top-K and return (rows, dept_union)."""
    result = await db.execute(
        select(Neuron.id, Neuron.cross_ref_departments)
        .where(
            Neuron.id.in_(top_k_ids),
            Neuron.cross_ref_departments.isnot(None),
        )
    )
    cross_ref_rows = result.all()
    cross_ref_depts = _parse_cross_ref_departments(cross_ref_rows) if cross_ref_rows else set()
    return cross_ref_rows, cross_ref_depts


async def _build_dept_maps(
    db: AsyncSession,
    neuron_ids: list[int],
) -> tuple[dict[int, str], dict[str, int]]:
    """Fetch department for each neuron_id, return (id->dept, dept->count)."""
    dept_result = await db.execute(
        select(Neuron.id, Neuron.department).where(Neuron.id.in_(neuron_ids))
    )
    neuron_dept_map: dict[int, str] = {}
    dept_counts: dict[str, int] = {}
    for nid, dept in dept_result.all():
        neuron_dept_map[nid] = dept or ""
        dept_counts[dept or ""] = dept_counts.get(dept or "", 0) + 1
    return neuron_dept_map, dept_counts


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
    assert top_k_count > 0, f"top_k_count must be positive, got {top_k_count}"
    top_k = all_scored[:top_k_count]
    if not top_k:
        return top_k

    top_k_ids = [s.neuron_id for s in top_k]
    cross_ref_rows, cross_ref_depts = await _fetch_cross_ref_depts(db, top_k_ids)
    if not cross_ref_depts:
        return top_k

    neuron_dept_map, dept_counts = await _build_dept_maps(db, top_k_ids)

    underrepresented = _find_underrepresented_depts(cross_ref_depts, dept_counts, top_k_count)
    if not underrepresented:
        return top_k

    all_neuron_ids = [s.neuron_id for s in all_scored]
    all_dept_result = await db.execute(
        select(Neuron.id, Neuron.department).where(Neuron.id.in_(all_neuron_ids))
    )
    all_neuron_dept: dict[int, str] = {nid: (dept or "") for nid, dept in all_dept_result.all()}

    top_k_neuron_ids = set(top_k_ids)
    candidates_to_add = _collect_diversity_candidates(
        all_scored, top_k_neuron_ids, all_neuron_dept, underrepresented,
    )
    if not candidates_to_add:
        return top_k

    regulatory_ids = {nid for nid, _ in cross_ref_rows}
    displace_ids = _find_displacement_targets(
        top_k, len(candidates_to_add), regulatory_ids, set(cross_ref_depts), neuron_dept_map,
    )
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
    assert neuron_id > 0, f"neuron_id must be positive, got {neuron_id}"
    assert query_id > 0, f"query_id must be positive, got {query_id}"
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
    if max_depth is not None:
        assert 0 <= max_depth <= 20, f"max_depth must be in [0, 20], got {max_depth}"

    conditions = [Neuron.layer >= 0]  # Exclude concept neurons (layer=-1); shown separately
    if department:
        conditions.append(Neuron.department == department)
    if role_key:
        conditions.append(Neuron.role_key == role_key)
    if max_depth is not None:
        conditions.append(Neuron.layer <= max_depth)

    stmt = select(Neuron).where(*conditions)
    stmt = stmt.order_by(Neuron.layer, Neuron.id)
    result = await db.execute(stmt)
    all_neurons = list(result.scalars().all())

    # Build parent→children map
    children_map: dict[int | None, list[Neuron]] = {}
    for n in all_neurons:
        children_map.setdefault(n.parent_id, []).append(n)

    def build_node(neuron: Neuron) -> dict:
        """Iterative tree builder — no recursion (JPL-1)."""
        max_depth = 10
        root_node: dict = {}
        # Stack: (neuron, depth, parent_dict) — build nodes breadth-first via stack
        stack: list[tuple[Neuron, int, dict | None]] = [(neuron, 0, None)]
        while stack:
            cur, depth, parent = stack.pop()
            assert depth <= max_depth, f"build_node exceeded max depth {max_depth}"
            node = {
                "id": cur.id,
                "layer": cur.layer,
                "node_type": cur.node_type,
                "label": cur.label,
                "department": cur.department,
                "role_key": cur.role_key,
                "invocations": cur.invocations,
                "avg_utility": cur.avg_utility,
            }
            if parent is None:
                root_node = node
            else:
                parent.setdefault("children", []).append(node)
            kids = children_map.get(cur.id, [])
            if kids and depth < max_depth:
                for child in reversed(kids):
                    stack.append((child, depth + 1, node))
        return root_node

    roots = children_map.get(None, [])
    return [build_node(r) for r in roots]


async def get_graph_stats(db: AsyncSession) -> dict:
    """Get neuron graph statistics."""
    total = (await db.execute(select(func.count(Neuron.id)))).scalar() or 0

    by_layer = {}
    for layer in range(-1, 6):
        count = (await db.execute(
            select(func.count(Neuron.id)).where(Neuron.layer == layer)
        )).scalar() or 0
        if count > 0 or layer >= 0:
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
