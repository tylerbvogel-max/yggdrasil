"""Gap detector — identifies knowledge gaps in the neuron graph.

Priority order:
1. Emergent queue (unresolved external references detected in neurons)
2. Low-eval queries (past queries where overall eval scored poorly)
3. Thin neurons (active neurons with minimal content)
4. Sparse subtrees (roles/tasks with fewer children than peers)

Returns a GapTarget that autopilot uses to generate a targeted query.
"""

import json
from dataclasses import dataclass

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EmergentQueue, Neuron, Query, EvalScore, AutopilotRun


@dataclass
class GapTarget:
    source: str  # "emergent_queue" | "low_eval" | "thin_neuron" | "sparse_subtree" | "emergent_cluster"
    description: str  # Human-readable gap description for query generation
    context_neuron_ids: list[int]  # Nearby neurons for context
    emergent_queue_id: int | None = None
    query_id: int | None = None  # For low_eval source


async def detect_gap(
    db: AsyncSession,
    focus_neuron_id: int | None = None,
) -> GapTarget | None:
    """Find the highest-priority gap to fill. Returns None if no gaps found."""

    # 1. Emergent queue — unresolved references
    target = await _check_emergent_queue(db, focus_neuron_id)
    if target:
        return target

    # 2. Low-eval queries — past queries that scored poorly
    target = await _check_low_eval_queries(db, focus_neuron_id)
    if target:
        return target

    # 3. Thin neurons — active neurons with minimal content
    target = await _check_thin_neurons(db, focus_neuron_id)
    if target:
        return target

    # 4. Sparse subtrees — roles/tasks with few children
    target = await _check_sparse_subtrees(db, focus_neuron_id)
    if target:
        return target

    # 5. Emergent clusters — cross-department clusters without corresponding Task neuron
    target = await _check_emergent_clusters(db, focus_neuron_id)
    if target:
        return target

    return None


async def _check_emergent_queue(
    db: AsyncSession, focus_neuron_id: int | None
) -> GapTarget | None:
    """Find highest-priority unresolved reference from the emergent queue."""
    stmt = (
        select(EmergentQueue)
        .where(EmergentQueue.status == "pending")
        .order_by(EmergentQueue.detection_count.desc())
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    for entry in entries:
        # If focused, only pick entries detected in neurons under the focus subtree
        if focus_neuron_id:
            neuron_ids = json.loads(entry.detected_in_neuron_ids or "[]")
            subtree_ids = await _get_subtree_ids(db, focus_neuron_id)
            if not any(nid in subtree_ids for nid in neuron_ids):
                continue

        # Get context neurons (the ones that reference this citation)
        context_ids = json.loads(entry.detected_in_neuron_ids or "[]")[:5]

        return GapTarget(
            source="emergent_queue",
            description=(
                f"The neuron graph references '{entry.citation_pattern}' "
                f"({entry.domain}/{entry.family}) in {entry.detection_count} location(s), "
                f"but no dedicated neuron covers this reference. "
                f"Generate a question that would require detailed knowledge of {entry.citation_pattern}."
            ),
            context_neuron_ids=context_ids,
            emergent_queue_id=entry.id,
        )

    return None


async def _check_low_eval_queries(
    db: AsyncSession, focus_neuron_id: int | None
) -> GapTarget | None:
    """Find a past query that scored poorly and hasn't been retried by autopilot."""
    # Get query IDs already targeted by autopilot
    already_tried = set()
    runs_result = await db.execute(select(AutopilotRun.query_id).where(AutopilotRun.query_id.isnot(None)))
    for row in runs_result.all():
        already_tried.add(row[0])

    # Find queries with low overall eval (<=2) that haven't been autopilot-retried
    stmt = (
        select(EvalScore.query_id, func.min(EvalScore.overall).label("min_overall"))
        .group_by(EvalScore.query_id)
        .having(func.min(EvalScore.overall) <= 2)
        .order_by(func.min(EvalScore.overall).asc())
    )
    result = await db.execute(stmt)
    candidates = result.all()

    for query_id, min_overall in candidates:
        if query_id in already_tried:
            continue

        query = await db.get(Query, query_id)
        if not query:
            continue

        # If focused, check if the query's activated neurons overlap with focus subtree
        if focus_neuron_id:
            activated_ids = json.loads(query.selected_neuron_ids or "[]")
            subtree_ids = await _get_subtree_ids(db, focus_neuron_id)
            if activated_ids and not any(nid in subtree_ids for nid in activated_ids):
                continue

        context_ids = json.loads(query.selected_neuron_ids or "[]")[:5]

        return GapTarget(
            source="low_eval",
            description=(
                f"A previous query scored {min_overall}/5 on evaluation: "
                f'"{query.user_message[:200]}". '
                f"Generate a similar question in this topic area to test whether "
                f"the knowledge gap has been addressed."
            ),
            context_neuron_ids=context_ids,
            query_id=query_id,
        )

    return None


async def _check_thin_neurons(
    db: AsyncSession, focus_neuron_id: int | None
) -> GapTarget | None:
    """Find active neurons with minimal content that need enrichment."""
    stmt = select(Neuron).where(
        Neuron.is_active == True,
        Neuron.layer >= 2,  # Don't flag departments/roles as thin
    )

    if focus_neuron_id:
        subtree_ids = await _get_subtree_ids(db, focus_neuron_id)
        stmt = stmt.where(Neuron.id.in_(subtree_ids))

    result = await db.execute(stmt.order_by(Neuron.layer, Neuron.id))
    neurons = result.scalars().all()

    # Find neurons with very short or empty content
    for neuron in neurons:
        content_len = len(neuron.content or "")
        summary_len = len(neuron.summary or "")
        if content_len < 50 and summary_len < 30:
            # Get parent chain for context
            context_ids = await _get_ancestor_ids(db, neuron.id)
            context_ids.append(neuron.id)

            return GapTarget(
                source="thin_neuron",
                description=(
                    f"Neuron #{neuron.id} '{neuron.label}' (L{neuron.layer} {neuron.node_type}, "
                    f"dept={neuron.department or 'none'}) has minimal content "
                    f"({content_len} chars). Generate a question that would require "
                    f"detailed knowledge about {neuron.label} to answer well."
                ),
                context_neuron_ids=context_ids,
            )

    return None


async def _check_sparse_subtrees(
    db: AsyncSession, focus_neuron_id: int | None
) -> GapTarget | None:
    """Find nodes that have significantly fewer children than their siblings."""
    # Get child counts per parent
    stmt = (
        select(
            Neuron.parent_id,
            func.count(Neuron.id).label("child_count"),
        )
        .where(Neuron.is_active == True, Neuron.parent_id.isnot(None))
        .group_by(Neuron.parent_id)
    )
    result = await db.execute(stmt)
    child_counts = {row[0]: row[1] for row in result.all()}

    if not child_counts:
        return None

    # Group siblings — find parents that have sparse children compared to peers
    # Look at L1-L2 nodes (roles, tasks) that have few children
    stmt = select(Neuron).where(
        Neuron.is_active == True,
        Neuron.layer.in_([1, 2]),
    )

    if focus_neuron_id:
        subtree_ids = await _get_subtree_ids(db, focus_neuron_id)
        stmt = stmt.where(Neuron.id.in_(subtree_ids))

    result = await db.execute(stmt.order_by(Neuron.layer, Neuron.id))
    candidates = result.scalars().all()

    # Find nodes with fewer children than the median for their layer
    layer_counts: dict[int, list[int]] = {}
    for n in candidates:
        count = child_counts.get(n.id, 0)
        layer_counts.setdefault(n.layer, []).append(count)

    for n in candidates:
        count = child_counts.get(n.id, 0)
        layer_list = layer_counts.get(n.layer, [])
        if not layer_list:
            continue
        median = sorted(layer_list)[len(layer_list) // 2]
        # Sparse = less than half the median and median is at least 4
        if median >= 4 and count < median // 2:
            context_ids = await _get_ancestor_ids(db, n.id)
            context_ids.append(n.id)
            # Add a few children for context
            children_result = await db.execute(
                select(Neuron.id).where(Neuron.parent_id == n.id, Neuron.is_active == True).limit(5)
            )
            context_ids.extend([r[0] for r in children_result.all()])

            return GapTarget(
                source="sparse_subtree",
                description=(
                    f"Neuron '{n.label}' (L{n.layer} {n.node_type}, dept={n.department or 'none'}) "
                    f"has only {count} children while peers average {median}. "
                    f"Generate a question about {n.label} that would expose missing "
                    f"subtopics or knowledge areas."
                ),
                context_neuron_ids=context_ids,
            )

    return None


async def _get_subtree_ids(db: AsyncSession, root_id: int) -> set[int]:
    """Get all neuron IDs in the subtree rooted at root_id (including root)."""
    ids = {root_id}
    frontier = [root_id]
    while frontier:
        result = await db.execute(
            select(Neuron.id).where(
                Neuron.parent_id.in_(frontier),
                Neuron.is_active == True,
            )
        )
        children = [r[0] for r in result.all()]
        if not children:
            break
        ids.update(children)
        frontier = children
    return ids


async def _get_ancestor_ids(db: AsyncSession, neuron_id: int) -> list[int]:
    """Walk up the parent chain and return ancestor IDs (root first)."""
    ancestors = []
    current = await db.get(Neuron, neuron_id)
    while current and current.parent_id:
        ancestors.insert(0, current.parent_id)
        current = await db.get(Neuron, current.parent_id)
    return ancestors


async def _check_emergent_clusters(
    db: AsyncSession, focus_neuron_id: int | None
) -> GapTarget | None:
    """Find cross-department clusters with no corresponding Task-level neuron."""
    from app.services.clustering import find_clusters

    clusters = await find_clusters(db, min_weight=0.3, min_size=3, min_departments=2)
    if not clusters:
        return None

    for cluster in clusters:
        nids = cluster["neuron_ids"]
        depts = cluster["departments"]
        suggested = cluster["suggested_label"]

        # Check if there's already a Task-level neuron (L2) that covers this cluster
        # by looking for neurons whose labels overlap significantly with the cluster keywords
        task_result = await db.execute(
            select(Neuron).where(
                Neuron.is_active == True,
                Neuron.layer == 2,
                Neuron.id.in_(nids),
            )
        )
        existing_tasks = task_result.scalars().all()
        if existing_tasks:
            continue  # Already has Task-level neurons in the cluster

        # If focused, check overlap with focus subtree
        if focus_neuron_id:
            subtree_ids = await _get_subtree_ids(db, focus_neuron_id)
            if not any(nid in subtree_ids for nid in nids):
                continue

        context_ids = nids[:5]

        return GapTarget(
            source="emergent_cluster",
            description=(
                f"A cross-department cluster spanning {', '.join(depts)} "
                f"({len(nids)} neurons, suggested topic: '{suggested}') "
                f"has no Task-level neuron to anchor it. Generate a question that "
                f"would require synthesizing knowledge across these departments "
                f"on the topic of {suggested}."
            ),
            context_neuron_ids=context_ids,
        )

    return None
