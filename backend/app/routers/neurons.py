"""Neuron inspection endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Neuron
from app.schemas import NeuronDetail, NeuronScoreDetail
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
    scored = await score_candidates(db, [neuron], state.global_token_counter)

    if not scored:
        raise HTTPException(status_code=500, detail="Scoring failed")

    s = scored[0]
    return NeuronScoreDetail(
        neuron_id=s.neuron_id,
        burst=s.burst,
        impact=s.impact,
        practice=s.practice,
        novelty=s.novelty,
        recency=s.recency,
        combined=s.combined,
    )
