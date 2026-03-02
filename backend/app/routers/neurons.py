"""Neuron inspection endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.database import get_db
from app.models import Neuron, NeuronRefinement, Query as QueryModel
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


@router.get("/{neuron_id}", response_model=NeuronDetail)
async def neuron_detail(neuron_id: int, db: AsyncSession = Depends(get_db)):
    neuron = await get_neuron(db, neuron_id)
    if not neuron:
        raise HTTPException(status_code=404, detail="Neuron not found")
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
