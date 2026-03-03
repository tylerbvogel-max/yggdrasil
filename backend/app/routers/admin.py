"""Admin endpoints: seed, reset, cost report, checkpoint, bolster."""

import asyncio
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Neuron, Query, NeuronFiring, NeuronEdge, PropagationLog, IntentNeuronMap, SystemState, NeuronRefinement
from app.schemas import (
    SeedResponse, ResetResponse, CostReportResponse, CheckpointResponse,
    BolsterRequest, BolsterResponse, ApplyBolsterRequest, ApplyRefineResponse,
    NeuronUpdateSuggestion, NewNeuronSuggestion,
)
from app.seed.loader import load_seed
from app.services.claude_cli import claude_chat
from app.services.neuron_service import get_system_state
from app.services.bolster_store import create_session, get_session

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/seed", response_model=SeedResponse)
async def seed_database(force: bool = False, db: AsyncSession = Depends(get_db)):
    result = await load_seed(db, force=force)
    return SeedResponse(**result)


@router.post("/reset", response_model=ResetResponse)
async def reset_firings(db: AsyncSession = Depends(get_db)):
    """Clear firing history, co-firing edges, and query data. Keep neuron definitions."""
    await db.execute(delete(PropagationLog))
    await db.execute(delete(NeuronFiring))
    await db.execute(delete(NeuronEdge))
    await db.execute(delete(IntentNeuronMap))
    await db.execute(delete(Query))

    # Reset system state
    state = (await db.execute(select(SystemState).where(SystemState.id == 1))).scalar_one_or_none()
    if state:
        state.global_token_counter = 0
        state.total_queries = 0

    # Reset neuron invocations and utility
    neurons = await db.execute(select(Neuron))
    for neuron in neurons.scalars():
        neuron.invocations = 0
        neuron.avg_utility = 0.5
        neuron.is_active = True

    await db.commit()
    return ResetResponse(status="reset_complete")


@router.post("/checkpoint", response_model=CheckpointResponse)
async def create_checkpoint(db: AsyncSession = Depends(get_db)):
    """Export all neurons to a JSON checkpoint file and commit it."""
    result = await db.execute(select(Neuron).order_by(Neuron.id))
    neurons = result.scalars().all()

    data = [
        {
            "id": n.id,
            "parent_id": n.parent_id,
            "layer": n.layer,
            "node_type": n.node_type,
            "label": n.label,
            "content": n.content,
            "summary": n.summary,
            "department": n.department,
            "role_key": n.role_key,
            "invocations": n.invocations,
            "avg_utility": n.avg_utility,
            "is_active": n.is_active,
            "created_at_query_count": n.created_at_query_count,
        }
        for n in neurons
    ]

    # Write checkpoint file
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    checkpoint_dir = os.path.join(backend_dir, "checkpoints")
    os.makedirs(checkpoint_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"neurons_{timestamp}.json"
    filepath = os.path.join(checkpoint_dir, filename)

    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

    # Git add + commit from the backend directory
    proc = await asyncio.create_subprocess_exec(
        "git", "add", "checkpoints/",
        cwd=backend_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()

    proc = await asyncio.create_subprocess_exec(
        "git", "commit", "-m", f"checkpoint: {filename} ({len(data)} neurons)",
        cwd=backend_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()

    # Get commit SHA
    proc = await asyncio.create_subprocess_exec(
        "git", "rev-parse", "HEAD",
        cwd=backend_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    commit_sha = stdout.decode().strip()

    return CheckpointResponse(
        status="ok",
        filename=filename,
        neuron_count=len(data),
        commit_sha=commit_sha,
    )


@router.get("/cost-report", response_model=CostReportResponse)
async def cost_report(db: AsyncSession = Depends(get_db)):
    total_queries = (await db.execute(select(func.count(Query.id)))).scalar() or 0
    total_cost = (await db.execute(select(func.sum(Query.cost_usd)))).scalar() or 0.0
    total_input = (await db.execute(
        select(
            func.sum(Query.classify_input_tokens) + func.sum(Query.execute_input_tokens)
        )
    )).scalar() or 0
    total_output = (await db.execute(
        select(
            func.sum(Query.classify_output_tokens) + func.sum(Query.execute_output_tokens)
        )
    )).scalar() or 0

    return CostReportResponse(
        total_queries=total_queries,
        total_cost_usd=round(total_cost, 6),
        avg_cost_per_query=round(total_cost / total_queries, 6) if total_queries > 0 else 0.0,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
    )


@router.post("/bolster", response_model=BolsterResponse)
async def bolster_neurons(req: BolsterRequest, db: AsyncSession = Depends(get_db)):
    """Standalone neuron editor: analyze neurons and suggest changes based on a natural language request."""
    # Load active neurons, optionally filtered by department
    stmt = select(Neuron).where(Neuron.is_active == True)
    if req.department:
        stmt = stmt.where(Neuron.department == req.department)
    result = await db.execute(stmt.order_by(Neuron.layer, Neuron.id))
    neurons = result.scalars().all()

    if not neurons:
        raise HTTPException(status_code=400, detail="No active neurons found" + (f" for department '{req.department}'" if req.department else ""))

    # Build neuron context (same format as refine endpoint)
    neuron_sections = []
    for n in neurons:
        neuron_sections.append(
            f"Neuron #{n.id} (L{n.layer} {n.node_type})\n"
            f"  Label: {n.label}\n"
            f"  Department: {n.department or 'none'}\n"
            f"  Role Key: {n.role_key or 'none'}\n"
            f"  Summary: {n.summary or 'none'}\n"
            f"  Content:\n{n.content or '(empty)'}\n"
            f"  Invocations: {n.invocations}, Avg Utility: {n.avg_utility:.3f}, Active: {n.is_active}"
        )

    system_prompt = (
        "You are a neuron graph architect. Act on the user's editorial request "
        "about the neuron knowledge graph below.\n\n"
        "You may suggest updates to existing neurons (content, summary, label, or is_active fields) "
        "and/or propose entirely new neurons to fill knowledge gaps.\n\n"
        "Rules:\n"
        "- Only suggest changes that are relevant to the user's request\n"
        "- For updates: specify the exact field (content, summary, label, or is_active), "
        "the old value, and the new value\n"
        "- For new neurons: specify parent_id (an existing neuron ID to attach under), "
        "layer (0-5), node_type, label, content, summary, and optionally department/role_key\n"
        "- New neurons MUST have a valid parent_id from the neuron list below — do NOT create orphaned neurons with parent_id null\n"
        "- Do NOT create new departments (L0) unless explicitly requested — attach under existing structure\n"
        "- Keep content concise and factual — neurons are context snippets, not essays\n"
        "- If the request is vague (e.g. 'review X'), identify concrete improvements\n"
        "- Don't trust that neurons are entirely accurate, you can double check their accuracy\n\n"
        "You MUST respond with EXACTLY a JSON block:\n"
        "```json\n"
        '{\n'
        '  "reasoning": "<1-3 sentences explaining your analysis>",\n'
        '  "updates": [\n'
        '    {"neuron_id": <id>, "field": "<content|summary|label|is_active>", '
        '"old_value": "<current>", "new_value": "<improved>", "reason": "<why>"}\n'
        '  ],\n'
        '  "new_neurons": [\n'
        '    {"parent_id": <id|null>, "layer": <0-5>, "node_type": "<type>", '
        '"label": "<label>", "content": "<content>", "summary": "<summary>", '
        '"department": "<dept|null>", "role_key": "<key|null>", "reason": "<why>"}\n'
        '  ]\n'
        '}\n'
        "```\n"
        "No text outside the JSON block."
    )

    user_prompt = (
        f"## Editorial Request\n{req.message}\n\n"
        f"## Neuron Graph ({len(neurons)} neurons"
        + (f", department: {req.department}" if req.department else "") + ")\n"
        + "\n---\n".join(neuron_sections)
    )

    result = await claude_chat(system_prompt, user_prompt, max_tokens=8192, model=req.model)

    raw_text = result["text"].strip()

    # Parse JSON response
    reasoning = ""
    updates = []
    new_neurons = []
    try:
        json_str = raw_text
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()
        parsed = json.loads(json_str)
        reasoning = parsed.get("reasoning", "")
        for u in parsed.get("updates", []):
            updates.append(NeuronUpdateSuggestion(
                neuron_id=u["neuron_id"],
                field=u["field"],
                old_value=str(u.get("old_value", "")),
                new_value=str(u.get("new_value", "")),
                reason=u.get("reason", ""),
            ))
        for n in parsed.get("new_neurons", []):
            new_neurons.append(NewNeuronSuggestion(
                parent_id=n.get("parent_id"),
                layer=n.get("layer", 3),
                node_type=n.get("node_type", "knowledge"),
                label=n.get("label", ""),
                content=n.get("content", ""),
                summary=n.get("summary", ""),
                department=n.get("department"),
                role_key=n.get("role_key"),
                reason=n.get("reason", ""),
            ))
    except (json.JSONDecodeError, KeyError, TypeError):
        reasoning = raw_text

    # Store in session for later apply
    session_data = {
        "updates": [u.model_dump() for u in updates],
        "new_neurons": [n.model_dump() for n in new_neurons],
    }
    session_id = create_session(session_data)

    return BolsterResponse(
        session_id=session_id,
        model=req.model,
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
        neurons_scanned=len(neurons),
        reasoning=reasoning,
        updates=updates,
        new_neurons=new_neurons,
    )


@router.post("/bolster/apply", response_model=ApplyRefineResponse)
async def apply_bolster(req: ApplyBolsterRequest, db: AsyncSession = Depends(get_db)):
    """Apply selected bolster suggestions to the neuron graph."""
    session_data = get_session(req.session_id)
    if session_data is None:
        raise HTTPException(status_code=404, detail="Bolster session expired or not found")

    updates_list = session_data.get("updates", [])
    new_neurons_list = session_data.get("new_neurons", [])

    updated_count = 0
    for idx in req.update_ids:
        if idx < 0 or idx >= len(updates_list):
            continue
        u = updates_list[idx]
        neuron = await db.get(Neuron, u["neuron_id"])
        if not neuron:
            continue
        field = u["field"]
        old_val = u.get("old_value", "")
        new_val = u["new_value"]
        if field == "content":
            neuron.content = new_val
        elif field == "summary":
            neuron.summary = new_val
        elif field == "label":
            neuron.label = new_val
        elif field == "is_active":
            neuron.is_active = str(new_val).lower() in ("true", "1", "yes")
        db.add(NeuronRefinement(
            query_id=None,
            neuron_id=u["neuron_id"],
            action="update",
            field=field,
            old_value=str(old_val),
            new_value=str(new_val),
            reason=u.get("reason", ""),
        ))
        updated_count += 1

    created_count = 0
    state = await get_system_state(db)
    for idx in req.new_neuron_ids:
        if idx < 0 or idx >= len(new_neurons_list):
            continue
        n = new_neurons_list[idx]
        neuron = Neuron(
            parent_id=n.get("parent_id"),
            layer=n.get("layer", 3),
            node_type=n.get("node_type", "knowledge"),
            label=n.get("label", ""),
            content=n.get("content", ""),
            summary=n.get("summary", ""),
            department=n.get("department"),
            role_key=n.get("role_key"),
            is_active=True,
            created_at_query_count=state.total_queries,
        )
        db.add(neuron)
        await db.flush()
        db.add(NeuronRefinement(
            query_id=None,
            neuron_id=neuron.id,
            action="create",
            field=None,
            old_value=None,
            new_value=n.get("label", ""),
            reason=n.get("reason", ""),
        ))
        created_count += 1

    await db.commit()
    return ApplyRefineResponse(updated=updated_count, created=created_count)
