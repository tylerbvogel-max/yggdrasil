"""POST /ingest/observation — Corvus observation ingestion pipeline."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Neuron, NeuronEdge, NeuronRefinement, ObservationQueue
from app.services.claude_cli import claude_chat
from app.schemas import ObservationEvalRequest, ObservationBatchEvalRequest, ObservationApplyRequest
from app.services.reference_hooks import populate_external_references

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


@router.get("/observations/{obs_id}")
async def get_observation_detail(obs_id: int, db: AsyncSession = Depends(get_db)):
    """Get full observation detail including eval proposals and nearby neurons."""
    obs = await db.get(ObservationQueue, obs_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")

    # Load similar neuron details
    similar_neuron_data = None
    if obs.similar_neuron_id:
        sn = await db.get(Neuron, obs.similar_neuron_id)
        if sn:
            similar_neuron_data = {
                "id": sn.id, "label": sn.label, "layer": sn.layer,
                "node_type": sn.node_type, "department": sn.department,
                "role_key": sn.role_key, "summary": sn.summary,
                "content": sn.content, "invocations": sn.invocations,
                "avg_utility": float(sn.avg_utility or 0),
            }

    # Load nearby neurons in same department/role
    nearby = []
    if obs.proposed_department:
        q = select(Neuron).where(
            Neuron.is_active == True,
            Neuron.department == obs.proposed_department,
        ).order_by(Neuron.layer, Neuron.invocations.desc()).limit(10)
        if obs.similar_neuron_id:
            q = q.where(Neuron.id != obs.similar_neuron_id)
        result = await db.execute(q)
        for n in result.scalars().all():
            nearby.append({
                "id": n.id, "label": n.label, "layer": n.layer,
                "node_type": n.node_type, "summary": (n.summary or "")[:200],
                "invocations": n.invocations,
                "avg_utility": float(n.avg_utility or 0),
            })

    eval_data = None
    if obs.eval_json:
        try:
            eval_data = json.loads(obs.eval_json)
        except Exception:
            pass

    return {
        "id": obs.id,
        "source": obs.source,
        "user_id": obs.user_id,
        "observation_type": obs.observation_type,
        "text": obs.text,
        "entities": json.loads(obs.entities_json) if obs.entities_json else [],
        "app_context": obs.app_context,
        "project_path": obs.project_path,
        "proposed_department": obs.proposed_department,
        "proposed_role_key": obs.proposed_role_key,
        "proposed_layer": obs.proposed_layer,
        "similar_neuron_id": obs.similar_neuron_id,
        "similarity_score": obs.similarity_score,
        "similar_neuron": similar_neuron_data,
        "nearby_neurons": nearby,
        "status": obs.status,
        "eval_json": eval_data,
        "eval_model": obs.eval_model,
        "eval_input_tokens": obs.eval_input_tokens,
        "eval_output_tokens": obs.eval_output_tokens,
        "created_neuron_id": obs.created_neuron_id,
        "created_at": obs.created_at.isoformat() if obs.created_at else None,
    }


@router.post("/observations/{obs_id}/evaluate")
async def evaluate_observation(
    obs_id: int, req: ObservationEvalRequest, db: AsyncSession = Depends(get_db)
):
    """LLM-evaluate an observation and propose neuron actions."""
    obs = await db.get(ObservationQueue, obs_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    if obs.status not in ("queued", "evaluated"):
        raise HTTPException(status_code=400, detail=f"Observation is {obs.status}, must be queued or evaluated")
    # JPL Rule 5: observation must have text content to evaluate
    assert obs.text and len(obs.text.strip()) > 0, "Observation text must be non-empty for evaluation"

    # Gather context: similar neuron + parent chain
    similar_context = ""
    if obs.similar_neuron_id:
        sn = await db.get(Neuron, obs.similar_neuron_id)
        if sn:
            similar_context = (
                f"\n## Most Similar Neuron (similarity: {obs.similarity_score:.2f})\n"
                f"ID: {sn.id} | Layer: L{sn.layer} | Type: {sn.node_type}\n"
                f"Label: {sn.label}\n"
                f"Department: {sn.department} | Role: {sn.role_key}\n"
                f"Invocations: {sn.invocations} | Utility: {sn.avg_utility:.2f}\n"
                f"Summary: {sn.summary or '(none)'}\n"
                f"Content: {(sn.content or '(none)')[:1000]}\n"
            )
            # Parent chain (up 2 levels)
            parent = await db.get(Neuron, sn.parent_id) if sn.parent_id else None
            if parent:
                similar_context += f"\nParent: [{parent.id}] L{parent.layer} {parent.label}\n"
                grandparent = await db.get(Neuron, parent.parent_id) if parent.parent_id else None
                if grandparent:
                    similar_context += f"Grandparent: [{grandparent.id}] L{grandparent.layer} {grandparent.label}\n"

            # Siblings
            sibling_result = await db.execute(
                select(Neuron.id, Neuron.label, Neuron.layer).where(
                    Neuron.parent_id == sn.parent_id,
                    Neuron.id != sn.id,
                    Neuron.is_active == True,
                ).limit(5)
            )
            siblings = sibling_result.all()
            if siblings:
                similar_context += "\nSiblings:\n"
                for sid, slabel, slayer in siblings:
                    similar_context += f"  [{sid}] L{slayer} {slabel}\n"

    # Nearby neurons in same department
    nearby_context = ""
    if obs.proposed_department:
        q = select(Neuron).where(
            Neuron.is_active == True,
            Neuron.department == obs.proposed_department,
        ).order_by(Neuron.layer, Neuron.invocations.desc()).limit(10)
        if obs.similar_neuron_id:
            q = q.where(Neuron.id != obs.similar_neuron_id)
        result = await db.execute(q)
        nearby_neurons = result.scalars().all()
        if nearby_neurons:
            nearby_context = "\n## Nearby Neurons in Department\n"
            for n in nearby_neurons:
                nearby_context += (
                    f"  [{n.id}] L{n.layer} {n.label} "
                    f"(inv:{n.invocations}, util:{n.avg_utility:.2f}) "
                    f"— {(n.summary or '')[:100]}\n"
                )

    # Entities
    entities_text = ""
    try:
        entities = json.loads(obs.entities_json) if obs.entities_json else []
        if entities:
            entities_text = "\nEntities: " + ", ".join(
                f"{e.get('type','?')}:{e.get('value','?')}" for e in entities[:10]
            )
    except Exception:
        pass

    # LLM PROMPT INTENT: Evaluate a Corvus screen-capture observation and propose a single action
    #   (create, update, merge, or dismiss) to integrate the observation into the neuron knowledge
    #   graph. The LLM acts as a graph architect deciding how new operational knowledge should be
    #   incorporated relative to existing neurons.
    # INPUT: User message contains the observation text, type, app context, proposed department/role,
    #   extracted entities, the most similar existing neuron with its parent chain and siblings, and
    #   nearby neurons in the same department. All formatted as labeled markdown sections.
    # OUTPUT FORMAT: Raw JSON object (no markdown fences):
    #   {"reasoning": str, "action": "create|update|merge|dismiss",
    #    "updates": [{"neuron_id": int, "field": str, "old_value": str, "new_value": str, "reason": str}],
    #    "new_neurons": [{"parent_id": int, "layer": int, "node_type": str, "label": str,
    #     "content": str, "summary": str, "department": str, "role_key": str, "reason": str}],
    #    "merge_target_id": int|null, "merge_content_delta": str|null}
    #   Only the fields relevant to the chosen action should be populated.
    # FAILURE MODES: If the LLM returns non-JSON, a regex fallback attempts to extract the outermost
    #   JSON object. If that also fails, a 500 HTTP error is raised. If the LLM returns an invalid
    #   action value, the assertion on line 478 will raise an AssertionError (caught as 500). If the
    #   LLM proposes a nonexistent parent_id for new neurons, the neuron is created with a dangling
    #   parent reference. Proposals are stored but NOT applied until explicit human approval via
    #   the /apply endpoint — this is a safety gate per Corvus development rules.
    system_prompt = """You are a neuron graph architect reviewing a screen-capture observation for potential ingestion into a knowledge graph.

The graph has 6 layers:
- L0: Department (organizational unit)
- L1: Role (functional role within department)
- L2: Task (specific responsibility)
- L3: System/Process (procedures, tools, workflows)
- L4: Decision (judgment calls, criteria, thresholds)
- L5: Output/Communication (deliverables, reports, notifications)

You must decide ONE action for this observation:
- **create**: New knowledge not captured by any existing neuron. Specify parent_id, layer, label, content, summary.
- **update**: The observation corrects or enhances a specific field on an existing neuron. Specify neuron_id, field, old_value, new_value.
- **merge**: The observation adds operational detail to an existing neuron's content. Specify merge_target_id and the content to append.
- **dismiss**: The observation is noise, already captured, or too ephemeral for the graph.

Rules:
- New neurons MUST attach under an existing parent (use a nearby neuron's parent_id or a nearby neuron itself as parent).
- Keep content concise and factual — this is operational knowledge from screen observation, not authoritative.
- Prefer merge/update over create when the knowledge overlaps significantly with existing neurons.
- For merge, provide only the NEW content delta to append, not the full existing content.

Respond with ONLY a JSON object (no markdown fences):
{
  "reasoning": "Brief explanation of your decision",
  "action": "create|update|merge|dismiss",
  "updates": [{"neuron_id": N, "field": "content|summary|label", "old_value": "...", "new_value": "...", "reason": "..."}],
  "new_neurons": [{"parent_id": N, "layer": N, "node_type": "system|decision|output", "label": "...", "content": "...", "summary": "...", "department": "...", "role_key": "...", "reason": "..."}],
  "merge_target_id": null,
  "merge_content_delta": null
}

Only populate the relevant array/fields for your chosen action. Leave others empty/null."""

    user_message = (
        f"## Observation\n"
        f"Type: {obs.observation_type}\n"
        f"App: {obs.app_context or 'unknown'}\n"
        f"Department: {obs.proposed_department or 'unclassified'}\n"
        f"Role: {obs.proposed_role_key or 'unclassified'}\n"
        f"{entities_text}\n\n"
        f"Text:\n{obs.text}\n"
        f"{similar_context}"
        f"{nearby_context}"
    )

    # Call LLM
    result = await claude_chat(
        system_prompt=system_prompt,
        user_message=user_message,
        max_tokens=4096,
        model=req.model,
    )

    # Parse response
    try:
        eval_data = json.loads(result["text"])
    except json.JSONDecodeError:
        # Try to extract JSON from response
        import re
        match = re.search(r'\{[\s\S]*\}', result["text"])
        if match:
            eval_data = json.loads(match.group())
        else:
            raise HTTPException(status_code=500, detail="LLM response was not valid JSON")

    # JPL Rule 5: eval_data must have a valid action before persisting
    assert isinstance(eval_data, dict), "LLM eval response must parse to a dict"
    assert eval_data.get("action") in ("create", "update", "merge", "dismiss"), \
        f"eval action must be create/update/merge/dismiss, got {eval_data.get('action')!r}"

    # Store evaluation
    obs.eval_json = json.dumps(eval_data)
    obs.eval_model = req.model
    obs.eval_input_tokens = result.get("input_tokens", 0)
    obs.eval_output_tokens = result.get("output_tokens", 0)
    obs.status = "evaluated"
    await db.commit()

    return {
        "observation_id": obs.id,
        "model": req.model,
        "input_tokens": result.get("input_tokens", 0),
        "output_tokens": result.get("output_tokens", 0),
        "cost_usd": result.get("cost_usd", 0),
        **eval_data,
    }


@router.post("/observations/evaluate-batch")
async def evaluate_observation_batch(
    req: ObservationBatchEvalRequest, db: AsyncSession = Depends(get_db)
):
    """Evaluate multiple observations sequentially."""
    if len(req.observation_ids) > 20:
        raise HTTPException(status_code=400, detail="Max 20 observations per batch")

    results = []
    for obs_id in req.observation_ids:
        try:
            eval_req = ObservationEvalRequest(model=req.model)
            result = await evaluate_observation(obs_id, eval_req, db)
            results.append(result)
        except HTTPException as e:
            results.append({"observation_id": obs_id, "error": e.detail})
        except Exception as e:
            results.append({"observation_id": obs_id, "error": str(e)})

    return results


@router.post("/observations/{obs_id}/apply")
async def apply_observation(
    obs_id: int, req: ObservationApplyRequest, db: AsyncSession = Depends(get_db)
):
    """Apply evaluated proposals: create neurons, update fields, merge content."""
    obs = await db.get(ObservationQueue, obs_id)
    if not obs:
        raise HTTPException(status_code=404, detail="Observation not found")
    if obs.status != "evaluated":
        raise HTTPException(status_code=400, detail=f"Observation is {obs.status}, must be evaluated first")
    if not obs.eval_json:
        raise HTTPException(status_code=400, detail="No evaluation data found")

    eval_data = json.loads(obs.eval_json)
    # JPL Rule 5: eval_data must be a well-formed dict with a valid action
    assert isinstance(eval_data, dict), "Stored eval_json must deserialize to a dict"
    action = eval_data.get("action", "dismiss")
    assert action in ("create", "update", "merge", "dismiss"), \
        f"eval action must be create/update/merge/dismiss, got {action!r}"
    updates_list = eval_data.get("updates", [])
    new_neurons_list = eval_data.get("new_neurons", [])
    merge_target_id = eval_data.get("merge_target_id")
    merge_content_delta = eval_data.get("merge_content_delta")

    updated_count = 0
    created_count = 0
    merged_count = 0
    created_neuron_ids = []

    # Apply selected updates
    for idx in req.update_indices:
        if idx < 0 or idx >= len(updates_list):
            continue
        u = updates_list[idx]
        neuron = await db.get(Neuron, u["neuron_id"])
        if not neuron:
            continue
        field = u["field"]
        new_val = u["new_value"]
        old_val = u.get("old_value", "")
        if field == "content":
            neuron.content = new_val
        elif field == "summary":
            neuron.summary = new_val
        elif field == "label":
            neuron.label = new_val
        if field in ("content", "summary"):
            populate_external_references(neuron)
        db.add(NeuronRefinement(
            neuron_id=u["neuron_id"],
            action="update",
            field=field,
            old_value=str(old_val),
            new_value=str(new_val),
            reason=u.get("reason", f"Corvus observation #{obs.id}"),
        ))
        updated_count += 1

    # Apply selected new neurons
    for idx in req.new_neuron_indices:
        if idx < 0 or idx >= len(new_neurons_list):
            continue
        n = new_neurons_list[idx]
        neuron = Neuron(
            parent_id=n.get("parent_id"),
            layer=n.get("layer", 3),
            node_type=n.get("node_type", "system"),
            label=n.get("label", ""),
            content=n.get("content", ""),
            summary=n.get("summary", ""),
            department=n.get("department") or obs.proposed_department,
            role_key=n.get("role_key") or obs.proposed_role_key,
            is_active=True,
            source_origin="corvus",
        )
        populate_external_references(neuron)
        db.add(neuron)
        await db.flush()
        created_neuron_ids.append(neuron.id)
        db.add(NeuronRefinement(
            neuron_id=neuron.id,
            action="create",
            field=None,
            old_value=None,
            new_value=n.get("label", ""),
            reason=n.get("reason", f"Corvus observation #{obs.id}"),
        ))
        created_count += 1

    # Apply merge if action was merge and no specific indices were selected
    if action == "merge" and merge_target_id and merge_content_delta:
        if not req.update_indices and not req.new_neuron_indices:
            # Default merge behavior when no specific selections made
            target = await db.get(Neuron, merge_target_id)
            if target:
                old_content = target.content or ""
                target.content = old_content + "\n\n" + merge_content_delta
                populate_external_references(target)
                db.add(NeuronRefinement(
                    neuron_id=merge_target_id,
                    action="update",
                    field="content",
                    old_value=old_content[:500],
                    new_value=target.content[:500],
                    reason=f"Merged from Corvus observation #{obs.id}",
                ))
                merged_count += 1

    # Strengthen entity edges
    try:
        entities = json.loads(obs.entities_json) if obs.entities_json else []
        if entities:
            anchor_id = created_neuron_ids[0] if created_neuron_ids else (merge_target_id or obs.similar_neuron_id)
            await _strengthen_entity_edges(db, entities, anchor_id)
    except Exception:
        pass

    obs.status = "approved"
    if created_neuron_ids:
        obs.created_neuron_id = created_neuron_ids[0]
    await db.commit()

    return {
        "observation_id": obs.id,
        "updated": updated_count,
        "created": created_count,
        "merged": merged_count,
        "created_neuron_ids": created_neuron_ids,
    }


async def _classify_observation(
    text: str, observation_type: str, app_context: str | None
) -> tuple[str | None, str | None]:
    """Use Haiku to classify an observation into department + role_key.

    Returns (department, role_key) or (None, None) on failure.
    """
    try:
        import anthropic

        client = anthropic.AsyncAnthropic()

        # LLM PROMPT INTENT: Classify a Corvus observation into an organizational department and
        #   role_key to determine where in the neuron graph hierarchy the observation belongs.
        #   This is a lightweight classification step (Haiku) run before semantic similarity search.
        # INPUT: User message contains the observation type, optional app context, and the first
        #   500 characters of the observation text.
        # OUTPUT FORMAT: Raw JSON object: {"department": str, "role_key": str}. Department is one
        #   of the enumerated valid departments. role_key is snake_case.
        # FAILURE MODES: If the LLM returns non-JSON or the call fails entirely, the except block
        #   returns (None, None), causing the observation to be classified as "unclassified" for
        #   both department and role. This is safe — the observation still proceeds through
        #   similarity search and queuing, just without department-filtered candidate narrowing.
        #   If the LLM returns a department not in the valid set, the downstream neuron filter
        #   query will simply return no matches for that department.
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
