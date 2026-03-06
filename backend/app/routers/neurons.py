"""Neuron inspection endpoints."""

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, func as sa_func, text, or_, and_

from app.database import get_db
from app.models import Neuron, NeuronEdge, NeuronRefinement, Query as QueryModel
from app.schemas import NeuronDetail, NeuronScoreDetail, NeuronRefinementOut
from app.services.neuron_service import (
    get_neuron,
    get_neuron_tree,
    get_graph_stats,
    get_system_state,
    score_candidates,
)

router = APIRouter(prefix="/neurons", tags=["neurons"])


@router.get("/tree")
async def neurons_tree(
    department: str | None = None,
    role_key: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    return await get_neuron_tree(db, department, role_key)


@router.get("/stats")
async def neurons_stats(db: AsyncSession = Depends(get_db)):
    return await get_graph_stats(db)


@router.get("/capacity")
async def neurons_capacity(db: AsyncSession = Depends(get_db)):
    """Total token capacity of the active neuron graph."""
    # Total chars of content in active neurons (content + summary)
    content_chars = (await db.execute(
        select(sa_func.coalesce(sa_func.sum(sa_func.length(Neuron.content)), 0))
        .where(Neuron.is_active == True, Neuron.content.isnot(None))
    )).scalar()
    summary_chars = (await db.execute(
        select(sa_func.coalesce(sa_func.sum(sa_func.length(Neuron.summary)), 0))
        .where(Neuron.is_active == True, Neuron.summary.isnot(None))
    )).scalar()
    active_count = (await db.execute(
        select(sa_func.count(Neuron.id)).where(Neuron.is_active == True)
    )).scalar()
    # ~4 chars per token
    return {
        "active_neurons": active_count,
        "total_content_tokens": content_chars // 4,
        "total_summary_tokens": summary_chars // 4,
        "total_tokens": (content_chars + summary_chars) // 4,
    }


@router.get("/refinements", response_model=list[NeuronRefinementOut])
async def list_refinements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NeuronRefinement)
        .order_by(NeuronRefinement.created_at.desc())
        .limit(200)
    )
    rows = result.scalars().all()
    out = []
    for r in rows:
        neuron = await db.get(Neuron, r.neuron_id)
        query = await db.get(QueryModel, r.query_id)
        out.append(NeuronRefinementOut(
            id=r.id,
            query_id=r.query_id,
            neuron_id=r.neuron_id,
            action=r.action,
            field=r.field,
            old_value=r.old_value,
            new_value=r.new_value,
            reason=r.reason,
            created_at=r.created_at.isoformat() if r.created_at else None,
            neuron_label=neuron.label if neuron else None,
            query_snippet=(query.user_message[:80] + "...") if query and len(query.user_message) > 80 else (query.user_message if query else None),
        ))
    return out


@router.get("/edges/department-chord")
async def department_chord(layer: int = 1, min_weight: float = 0.15, db: AsyncSession = Depends(get_db)):
    """Aggregate co-firing edges grouped at a specific neuron layer."""
    if layer < 1 or layer > 5:
        raise HTTPException(status_code=400, detail="Layer must be 1-5")
    if min_weight < 0 or min_weight > 1:
        raise HTTPException(status_code=400, detail="min_weight must be 0-1")

    if layer == 1:
        # Group by role_key, join to L1 neuron for human label
        stmt = text("""
            SELECT r1.label AS source_label, r2.label AS target_label,
                   n1.role_key AS source_role, n2.role_key AS target_role,
                   n1.department AS source_dept, n2.department AS target_dept,
                   SUM(e.weight) AS total_weight, COUNT(*) AS edge_count
            FROM neuron_edges e
            JOIN neurons n1 ON e.source_id = n1.id
            JOIN neurons n2 ON e.target_id = n2.id
            LEFT JOIN neurons r1 ON r1.role_key = n1.role_key AND r1.layer = 1
            LEFT JOIN neurons r2 ON r2.role_key = n2.role_key AND r2.layer = 1
            WHERE e.weight >= :min_weight
              AND n1.role_key IS NOT NULL
              AND n2.role_key IS NOT NULL
            GROUP BY n1.role_key, n2.role_key, n1.department, n2.department,
                     r1.label, r2.label
        """)
        result = await db.execute(stmt, {"min_weight": min_weight})
        return [
            {
                "source_dept": r.source_label or r.source_role,
                "target_dept": r.target_label or r.target_role,
                "source_department": r.source_dept,
                "target_department": r.target_dept,
                "total_weight": r.total_weight,
                "edge_count": r.edge_count,
            }
            for r in result.fetchall()
        ]
    else:
        # For L2-L5: edges where both neurons are at the requested layer
        stmt = text("""
            SELECT n1.label AS source_label, n2.label AS target_label,
                   n1.department AS source_dept, n2.department AS target_dept,
                   SUM(e.weight) AS total_weight, COUNT(*) AS edge_count
            FROM neuron_edges e
            JOIN neurons n1 ON e.source_id = n1.id
            JOIN neurons n2 ON e.target_id = n2.id
            WHERE e.weight >= :min_weight
              AND n1.layer = :layer AND n2.layer = :layer
            GROUP BY n1.id, n2.id, n1.label, n2.label,
                     n1.department, n2.department
        """)
        result = await db.execute(stmt, {"layer": layer, "min_weight": min_weight})
        return [
            {
                "source_dept": r.source_label,
                "target_dept": r.target_label,
                "source_department": r.source_dept,
                "target_department": r.target_dept,
                "total_weight": r.total_weight,
                "edge_count": r.edge_count,
            }
            for r in result.fetchall()
        ]


@router.get("/edges/spread-trail")
async def spread_trail(query_id: int, db: AsyncSession = Depends(get_db)):
    """Get spread activation trail for a query."""
    query = await db.get(QueryModel, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    if not query.neuron_scores_json:
        return {"nodes": [], "edges": []}

    scores = json.loads(query.neuron_scores_json)
    if not scores:
        return {"nodes": [], "edges": []}

    neuron_ids = [s["neuron_id"] for s in scores]
    spread_ids = {s["neuron_id"] for s in scores if s.get("spread_boost", 0) > 0}
    non_spread_ids = {s["neuron_id"] for s in scores if s.get("spread_boost", 0) == 0}

    if not spread_ids:
        return {"nodes": [], "edges": []}

    # Fetch edges connecting spread-boosted neurons to any scored neuron
    edge_result = await db.execute(
        select(NeuronEdge).where(
            or_(
                and_(NeuronEdge.source_id.in_(non_spread_ids), NeuronEdge.target_id.in_(spread_ids)),
                and_(NeuronEdge.source_id.in_(spread_ids), NeuronEdge.target_id.in_(non_spread_ids)),
                and_(NeuronEdge.source_id.in_(spread_ids), NeuronEdge.target_id.in_(spread_ids)),
            )
        )
    )
    edges = edge_result.scalars().all()
    if not edges:
        return {"nodes": [], "edges": []}

    # Collect involved neuron IDs
    involved_ids = set()
    for e in edges:
        involved_ids.add(e.source_id)
        involved_ids.add(e.target_id)

    # Fetch neuron details
    neuron_result = await db.execute(select(Neuron).where(Neuron.id.in_(involved_ids)))
    neurons = {n.id: n for n in neuron_result.scalars().all()}

    score_map = {s["neuron_id"]: s for s in scores}

    nodes = []
    for nid in involved_ids:
        n = neurons.get(nid)
        s = score_map.get(nid, {})
        nodes.append({
            "id": nid,
            "label": n.label if n else f"#{nid}",
            "department": n.department if n else None,
            "layer": n.layer if n else 0,
            "combined": s.get("combined", 0),
            "spread_boost": s.get("spread_boost", 0),
        })

    return {
        "nodes": nodes,
        "edges": [
            {"source_id": e.source_id, "target_id": e.target_id, "weight": e.weight}
            for e in edges
        ],
    }


@router.get("/{neuron_id}/edges")
async def neuron_edges(neuron_id: int, limit: int = 15, db: AsyncSession = Depends(get_db)):
    """Top-N neighbors by edge weight for a neuron."""
    neuron = await get_neuron(db, neuron_id)
    if not neuron:
        raise HTTPException(status_code=404, detail="Neuron not found")

    # Get edges where this neuron is source or target, ordered by weight
    result = await db.execute(
        select(NeuronEdge)
        .where(or_(NeuronEdge.source_id == neuron_id, NeuronEdge.target_id == neuron_id))
        .order_by(NeuronEdge.weight.desc())
        .limit(limit)
    )
    edges = result.scalars().all()

    neighbor_ids = set()
    for e in edges:
        neighbor_ids.add(e.source_id if e.target_id == neuron_id else e.target_id)

    # Fetch neighbor neurons
    if neighbor_ids:
        n_result = await db.execute(select(Neuron).where(Neuron.id.in_(neighbor_ids)))
        neighbor_map = {n.id: n for n in n_result.scalars().all()}
    else:
        neighbor_map = {}

    neighbors = []
    for e in edges:
        nid = e.source_id if e.target_id == neuron_id else e.target_id
        n = neighbor_map.get(nid)
        if n:
            neighbors.append({
                "id": n.id,
                "label": n.label,
                "department": n.department,
                "layer": n.layer,
                "node_type": n.node_type,
                "weight": e.weight,
                "co_fire_count": e.co_fire_count,
            })

    return {
        "center": {
            "id": neuron.id,
            "label": neuron.label,
            "department": neuron.department,
            "layer": neuron.layer,
        },
        "neighbors": neighbors,
    }


@router.get("/{neuron_id}", response_model=NeuronDetail)
async def neuron_detail(neuron_id: int, db: AsyncSession = Depends(get_db)):
    neuron = await get_neuron(db, neuron_id)
    if not neuron:
        raise HTTPException(status_code=404, detail="Neuron not found")
    cross_ref = None
    if neuron.cross_ref_departments:
        try:
            cross_ref = json.loads(neuron.cross_ref_departments)
        except (json.JSONDecodeError, TypeError):
            pass
    return NeuronDetail(
        id=neuron.id,
        parent_id=neuron.parent_id,
        layer=neuron.layer,
        node_type=neuron.node_type,
        label=neuron.label,
        content=neuron.content,
        summary=neuron.summary,
        department=neuron.department,
        role_key=neuron.role_key,
        invocations=neuron.invocations,
        avg_utility=neuron.avg_utility,
        is_active=neuron.is_active,
        cross_ref_departments=cross_ref,
        standard_date=neuron.standard_date,
    )


@router.get("/{neuron_id}/scores", response_model=NeuronScoreDetail)
async def neuron_scores(neuron_id: int, db: AsyncSession = Depends(get_db)):
    neuron = await get_neuron(db, neuron_id)
    if not neuron:
        raise HTTPException(status_code=404, detail="Neuron not found")

    state = await get_system_state(db)
    scored = await score_candidates(db, [neuron], state.total_queries, [])

    if not scored:
        raise HTTPException(status_code=500, detail="Scoring failed")

    s = scored[0]
    return NeuronScoreDetail(
        neuron_id=s.neuron_id,
        burst=s.burst,
        impact=s.impact,
        precision=s.precision,
        novelty=s.novelty,
        recency=s.recency,
        relevance=s.relevance,
        combined=s.combined,
    )
