"""POST /ingest/observation — Corvus observation ingestion pipeline."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Neuron, NeuronEdge, ObservationQueue

router = APIRouter(prefix="/ingest", tags=["ingest"])


class ObservationRequest(BaseModel):
    source: str = "corvus"
    user_id: str = "anonymous"
    observation_type: str = Field(..., pattern="^(decision|process|entity|pattern|digest)$")
    text: str = Field(..., min_length=10, max_length=10000)
    entities: list[dict] = []
    app_context: str | None = None
    project_path: str | None = None


class ObservationResponse(BaseModel):
    observation_id: int
    status: str  # "queued", "auto_created", "duplicate", "edge_strengthened"
    proposed_department: str | None = None
    proposed_layer: int | None = None
    similar_neuron_id: int | None = None
    similar_neuron_label: str | None = None
    similarity_score: float | None = None
    edges_strengthened: int = 0


# Map observation types to neuron layers
OBSERVATION_LAYER_MAP = {
    "decision": 4,    # L4 = Decision
    "process": 3,     # L3 = System/Process
    "entity": 5,      # L5 = Output/Communication
    "pattern": 3,     # L3 = System/Process
    "digest": 5,      # L5 = Output/Communication
}


@router.post("/observation", response_model=ObservationResponse)
async def ingest_observation(req: ObservationRequest, db: AsyncSession = Depends(get_db)):
    """Ingest an observation from Corvus into the neuron graph.

    Pipeline:
    1. Classify the observation (department, role_key, layer)
    2. Check semantic similarity against existing neurons
    3. If novel: queue for review (or auto-create if high confidence)
    4. If similar: strengthen co-firing edges and update recency
    5. Extract entity references and strengthen entity-linked edges
    """
    proposed_layer = OBSERVATION_LAYER_MAP.get(req.observation_type, 3)

    # Step 1: Classify via Haiku (lightweight)
    department, role_key = await _classify_observation(req.text, req.observation_type, req.app_context)

    # Step 2: Find semantically similar neurons
    similar_neuron, similarity = await _find_similar_neuron(db, req.text, department)

    # Step 3: Decide action based on similarity
    edges_strengthened = 0

    if similar_neuron and similarity and similarity >= 0.85:
        # Duplicate or near-duplicate — strengthen edges, don't create
        edges_strengthened = await _strengthen_entity_edges(db, req.entities, similar_neuron.id)

        # Update recency on the similar neuron
        similar_neuron.invocations = (similar_neuron.invocations or 0) + 1

        # Record in observation queue for audit
        obs = ObservationQueue(
            source=req.source,
            user_id=req.user_id,
            observation_type=req.observation_type,
            text=req.text[:2000],
            entities_json=json.dumps(req.entities[:20]),
            app_context=req.app_context,
            project_path=req.project_path,
            proposed_department=department,
            proposed_role_key=role_key,
            proposed_layer=proposed_layer,
            similar_neuron_id=similar_neuron.id,
            similarity_score=similarity,
            status="duplicate",
        )
        db.add(obs)
        await db.commit()

        return ObservationResponse(
            observation_id=obs.id,
            status="edge_strengthened" if edges_strengthened > 0 else "duplicate",
            proposed_department=department,
            proposed_layer=proposed_layer,
            similar_neuron_id=similar_neuron.id,
            similar_neuron_label=similar_neuron.label,
            similarity_score=similarity,
            edges_strengthened=edges_strengthened,
        )

    # Novel enough — queue for review
    obs = ObservationQueue(
        source=req.source,
        user_id=req.user_id,
        observation_type=req.observation_type,
        text=req.text[:2000],
        entities_json=json.dumps(req.entities[:20]),
        app_context=req.app_context,
        project_path=req.project_path,
        proposed_department=department,
        proposed_role_key=role_key,
        proposed_layer=proposed_layer,
        similar_neuron_id=similar_neuron.id if similar_neuron else None,
        similarity_score=similarity,
        status="queued",
    )
    db.add(obs)
    await db.flush()

    # Strengthen entity edges even for new observations
    if req.entities:
        edges_strengthened = await _strengthen_entity_edges(db, req.entities)

    await db.commit()

    return ObservationResponse(
        observation_id=obs.id,
        status="queued",
        proposed_department=department,
        proposed_layer=proposed_layer,
        similar_neuron_id=similar_neuron.id if similar_neuron else None,
        similar_neuron_label=similar_neuron.label if similar_neuron else None,
        similarity_score=similarity,
        edges_strengthened=edges_strengthened,
    )


@router.get("/observations")
async def list_observations(
    status: str = "",
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List observation queue entries."""
    query = select(ObservationQueue).order_by(ObservationQueue.id.desc()).limit(limit)
    if status:
        query = query.where(ObservationQueue.status == status)
    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        {
            "id": o.id,
            "source": o.source,
            "user_id": o.user_id,
            "observation_type": o.observation_type,
            "text": o.text[:200] + ("..." if len(o.text) > 200 else ""),
            "proposed_department": o.proposed_department,
            "proposed_layer": o.proposed_layer,
            "similar_neuron_id": o.similar_neuron_id,
            "similarity_score": o.similarity_score,
            "status": o.status,
            "created_neuron_id": o.created_neuron_id,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in rows
    ]


@router.post("/observations/{obs_id}/approve")
async def approve_observation(obs_id: int, db: AsyncSession = Depends(get_db)):
    """Approve a queued observation and create a neuron from it."""
    obs = await db.get(ObservationQueue, obs_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    if obs.status != "queued":
        raise HTTPException(status_code=400, detail=f"Observation is {obs.status}, not queued")

    # Find a suitable parent neuron
    parent_id = None
    if obs.proposed_department and obs.proposed_role_key:
        result = await db.execute(
            select(Neuron).where(
                Neuron.department == obs.proposed_department,
                Neuron.role_key == obs.proposed_role_key,
                Neuron.layer < obs.proposed_layer,
                Neuron.is_active == True,
            ).order_by(Neuron.layer.desc()).limit(1)
        )
        parent = result.scalar_one_or_none()
        if parent:
            parent_id = parent.id

    # Determine node_type from layer
    node_type_map = {3: "system", 4: "decision", 5: "output"}
    node_type = node_type_map.get(obs.proposed_layer, "system")

    # Create the neuron
    label = obs.text[:150].strip()
    if len(obs.text) > 150:
        # Try to find a natural break point
        for sep in [". ", ":", " - ", "; "]:
            idx = obs.text[:150].rfind(sep)
            if idx > 30:
                label = obs.text[:idx].strip()
                break

    neuron = Neuron(
        parent_id=parent_id,
        layer=obs.proposed_layer,
        node_type=node_type,
        label=label,
        content=obs.text,
        summary=obs.text[:300] if len(obs.text) > 300 else obs.text,
        department=obs.proposed_department,
        role_key=obs.proposed_role_key,
        source_type="operational",
        source_origin="corvus",
        is_active=True,
    )
    db.add(neuron)
    await db.flush()

    obs.status = "approved"
    obs.created_neuron_id = neuron.id
    await db.commit()

    return {
        "observation_id": obs.id,
        "neuron_id": neuron.id,
        "label": neuron.label,
        "department": neuron.department,
        "layer": neuron.layer,
    }


@router.post("/observations/{obs_id}/reject")
async def reject_observation(obs_id: int, db: AsyncSession = Depends(get_db)):
    """Reject a queued observation."""
    obs = await db.get(ObservationQueue, obs_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    if obs.status != "queued":
        raise HTTPException(status_code=400, detail=f"Observation is {obs.status}, not queued")

    obs.status = "rejected"
    await db.commit()
    return {"observation_id": obs.id, "status": "rejected"}


async def _classify_observation(
    text: str, observation_type: str, app_context: str | None
) -> tuple[str | None, str | None]:
    """Use Haiku to classify an observation into department + role_key.

    Returns (department, role_key) or (None, None) on failure.
    """
    try:
        import anthropic

        client = anthropic.AsyncAnthropic()

        system = (
            "You classify observations into organizational departments and roles. "
            "Respond with ONLY a JSON object: {\"department\": \"...\", \"role_key\": \"...\"}\n\n"
            "Valid departments: Engineering, Manufacturing, Quality, Contracts, Finance, "
            "Program Management, Executive Leadership, Regulatory, Operations\n\n"
            "Role keys are snake_case like: structures_engineer, process_engineer, "
            "quality_inspector, contracts_analyst, program_manager, etc."
        )

        user_msg = f"Observation type: {observation_type}\n"
        if app_context:
            user_msg += f"App: {app_context}\n"
        user_msg += f"Text: {text[:500]}"

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            temperature=0.0,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )

        import json
        result = json.loads(response.content[0].text)
        return result.get("department"), result.get("role_key")
    except Exception as e:
        print(f"[Yggdrasil] Observation classification failed: {e}")
        return None, None


async def _find_similar_neuron(
    db: AsyncSession, text: str, department: str | None
) -> tuple[Neuron | None, float | None]:
    """Find the most semantically similar existing neuron.

    Uses embedding similarity if available, falls back to keyword overlap.
    """
    try:
        from app.services.embedding_service import embed_text
        import concurrent.futures
        import asyncio
        import json
        import numpy as np

        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            query_embedding = await loop.run_in_executor(pool, embed_text, text[:500])

        if query_embedding is None:
            return None, None

        # Load candidate neurons (filter by department if available)
        query = select(Neuron.id, Neuron.label, Neuron.embedding).where(
            Neuron.is_active == True,
            Neuron.embedding.isnot(None),
            Neuron.layer >= 2,
        )
        if department:
            query = query.where(Neuron.department == department)
        query = query.limit(500)

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return None, None

        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return None, None

        best_id = None
        best_sim = 0.0
        for nid, label, emb_json in rows:
            if not emb_json:
                continue
            emb = np.array(json.loads(emb_json), dtype=np.float32)
            emb_norm = np.linalg.norm(emb)
            if emb_norm == 0:
                continue
            sim = float(np.dot(query_vec, emb) / (query_norm * emb_norm))
            if sim > best_sim:
                best_sim = sim
                best_id = nid

        if best_id is None:
            return None, None

        neuron = await db.get(Neuron, best_id)
        return neuron, best_sim

    except Exception as e:
        print(f"[Yggdrasil] Similarity search failed: {e}")
        return None, None


async def _strengthen_entity_edges(
    db: AsyncSession, entities: list[dict], anchor_neuron_id: int | None = None
) -> int:
    """Strengthen co-firing edges between neurons associated with the observed entities.

    Returns the number of edges strengthened.
    """
    if not entities:
        return 0

    # Extract entity values
    entity_values = [e.get("value", "") for e in entities if e.get("value")]
    if not entity_values:
        return 0

    # Find neurons whose content/label mentions these entities
    from sqlalchemy import text as sql_text

    neuron_ids = set()
    if anchor_neuron_id:
        neuron_ids.add(anchor_neuron_id)

    for val in entity_values[:10]:  # Limit to prevent excessive queries
        result = await db.execute(
            select(Neuron.id).where(
                Neuron.is_active == True,
                (Neuron.label.ilike(f"%{val}%")) | (Neuron.content.ilike(f"%{val}%")),
            ).limit(5)
        )
        for row in result.all():
            neuron_ids.add(row[0])

    if len(neuron_ids) < 2:
        return 0

    # Strengthen edges between all pairs
    id_list = sorted(neuron_ids)
    strengthened = 0
    for i, src in enumerate(id_list):
        for tgt in id_list[i + 1:]:
            from sqlalchemy import text as sql_text
            await db.execute(sql_text(
                "INSERT INTO neuron_edges (source_id, target_id, co_fire_count, weight, source, last_adjusted) "
                "VALUES (:src, :tgt, 1, 0.05, 'corvus', now()) "
                "ON CONFLICT (source_id, target_id) DO UPDATE SET "
                "co_fire_count = neuron_edges.co_fire_count + 1, "
                "weight = LEAST(1.0, (neuron_edges.co_fire_count + 1) / 20.0), "
                "source = CASE WHEN neuron_edges.source = 'bootstrap' THEN 'corvus' ELSE neuron_edges.source END, "
                "last_adjusted = now()"
            ), {"src": src, "tgt": tgt})
            strengthened += 1

    return strengthened
