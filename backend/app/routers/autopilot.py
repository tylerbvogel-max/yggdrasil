"""Autopilot — autonomous neuron training loop.

External cron calls POST /admin/autopilot/tick on an interval.
Each tick: generate query → execute → self-evaluate → refine → auto-apply all.
"""

import json
import traceback
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models import (
    AutopilotConfig, AutopilotRun, Query, Neuron, EvalScore, NeuronRefinement,
)
from app.schemas import (
    AutopilotConfigOut, AutopilotConfigUpdate, AutopilotRunOut, AutopilotTickResponse,
    NeuronUpdateSuggestion, NewNeuronSuggestion,
)
from app.services.executor import execute_query
from app.services.claude_cli import claude_chat
from app.services.neuron_service import get_system_state

router = APIRouter(prefix="/admin/autopilot", tags=["autopilot"])

# In-memory cancellation flag
_cancel_requested = False
_tick_running = False
_current_step = ""  # Current step label for progress tracking
_current_detail = ""  # Substep detail message for UI

TICK_STEPS = ["generate", "execute", "evaluate", "refine", "apply", "record"]


def _set_step(step: str, detail: str = ""):
    global _current_step, _current_detail
    _current_step = step
    _current_detail = detail


async def _get_or_create_config(db: AsyncSession) -> AutopilotConfig:
    result = await db.execute(select(AutopilotConfig).where(AutopilotConfig.id == 1))
    config = result.scalar_one_or_none()
    if not config:
        config = AutopilotConfig(id=1)
        db.add(config)
        await db.flush()
    return config


def _build_focus_context(neuron: Neuron) -> str:
    """Build context string describing the focus area from a neuron."""
    parts = []
    if neuron.department:
        parts.append(f"Department: {neuron.department}")
    if neuron.role_key:
        parts.append(f"Role: {neuron.role_key}")
    parts.append(f"Focus area: {neuron.label}")
    if neuron.summary:
        parts.append(f"Description: {neuron.summary}")
    return "\n".join(parts)


async def _get_subtree_context(db: AsyncSession, neuron_id: int) -> tuple[str, str]:
    """Get the focus neuron label and a context description of the subtree."""
    neuron = await db.get(Neuron, neuron_id)
    if not neuron:
        return "", ""

    # Walk up to build full path
    path_parts = [neuron.label]
    current = neuron
    while current.parent_id:
        parent = await db.get(Neuron, current.parent_id)
        if not parent:
            break
        path_parts.insert(0, parent.label)
        current = parent

    # Get direct children for richer context
    children_result = await db.execute(
        select(Neuron.label).where(Neuron.parent_id == neuron_id, Neuron.is_active == True).limit(20)
    )
    child_labels = [r[0] for r in children_result.all()]

    focus_label = " > ".join(path_parts)
    context = _build_focus_context(neuron)
    if child_labels:
        context += f"\nExisting subtopics: {', '.join(child_labels)}"

    return focus_label, context


# ── Endpoints ──────────────────────────────────────────────────────────

@router.get("/config", response_model=AutopilotConfigOut)
async def get_config(db: AsyncSession = Depends(get_db)):
    config = await _get_or_create_config(db)
    focus_label = None
    if config.focus_neuron_id:
        neuron = await db.get(Neuron, config.focus_neuron_id)
        if neuron:
            focus_label = neuron.label
    return AutopilotConfigOut(
        enabled=config.enabled,
        directive=config.directive,
        interval_minutes=config.interval_minutes,
        focus_neuron_id=config.focus_neuron_id,
        focus_neuron_label=focus_label,
        max_layer=config.max_layer,
        eval_model=config.eval_model,
        last_tick_at=config.last_tick_at.isoformat() if config.last_tick_at else None,
    )


@router.put("/config", response_model=AutopilotConfigOut)
async def update_config(req: AutopilotConfigUpdate, db: AsyncSession = Depends(get_db)):
    config = await _get_or_create_config(db)
    if req.enabled is not None:
        config.enabled = req.enabled
    if req.directive is not None:
        config.directive = req.directive
    if req.interval_minutes is not None:
        config.interval_minutes = req.interval_minutes
    if req.focus_neuron_id is not None:
        config.focus_neuron_id = req.focus_neuron_id if req.focus_neuron_id != 0 else None
    if req.max_layer is not None:
        config.max_layer = req.max_layer
    if req.eval_model is not None:
        config.eval_model = req.eval_model
    await db.commit()

    focus_label = None
    if config.focus_neuron_id:
        neuron = await db.get(Neuron, config.focus_neuron_id)
        if neuron:
            focus_label = neuron.label
    return AutopilotConfigOut(
        enabled=config.enabled,
        directive=config.directive,
        interval_minutes=config.interval_minutes,
        focus_neuron_id=config.focus_neuron_id,
        focus_neuron_label=focus_label,
        max_layer=config.max_layer,
        eval_model=config.eval_model,
        last_tick_at=config.last_tick_at.isoformat() if config.last_tick_at else None,
    )


@router.get("/status")
async def get_status():
    return {
        "running": _tick_running,
        "step": _current_step if _tick_running else "",
        "detail": _current_detail if _tick_running else "",
    }


@router.post("/cancel", response_model=AutopilotTickResponse)
async def cancel():
    global _cancel_requested
    if not _tick_running:
        return AutopilotTickResponse(status="skipped", message="No tick is running")
    _cancel_requested = True
    return AutopilotTickResponse(status="cancelled", message="Cancel requested — will stop after current step")


@router.post("/tick", response_model=AutopilotTickResponse)
async def tick(db: AsyncSession = Depends(get_db)):
    if _tick_running:
        return AutopilotTickResponse(status="skipped", message="A tick is already running")
    config = await _get_or_create_config(db)
    if not config.enabled:
        return AutopilotTickResponse(status="skipped", message="Autopilot is disabled")
    if not config.directive.strip():
        return AutopilotTickResponse(status="skipped", message="No directive set")
    # Respect interval — skip if too soon since last tick
    if config.last_tick_at:
        elapsed = datetime.now(timezone.utc) - config.last_tick_at.replace(tzinfo=timezone.utc)
        if elapsed < timedelta(minutes=config.interval_minutes):
            remaining = timedelta(minutes=config.interval_minutes) - elapsed
            mins = int(remaining.total_seconds() // 60)
            return AutopilotTickResponse(status="skipped", message=f"Too soon — {mins}m remaining")
    return await _run_tick(db, config)


@router.post("/run-now", response_model=AutopilotTickResponse)
async def run_now(db: AsyncSession = Depends(get_db)):
    if _tick_running:
        return AutopilotTickResponse(status="skipped", message="A tick is already running")
    config = await _get_or_create_config(db)
    if not config.directive.strip():
        return AutopilotTickResponse(status="skipped", message="No directive set")
    return await _run_tick(db, config)


@router.get("/runs", response_model=list[AutopilotRunOut])
async def list_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AutopilotRun).order_by(AutopilotRun.id.desc()).limit(50)
    )
    runs = result.scalars().all()
    return [
        AutopilotRunOut(
            id=r.id,
            query_id=r.query_id,
            generated_query=r.generated_query,
            directive=r.directive,
            focus_neuron_label=r.focus_neuron_label,
            neurons_activated=r.neurons_activated,
            updates_applied=r.updates_applied,
            neurons_created=r.neurons_created,
            eval_overall=r.eval_overall,
            eval_text=r.eval_text,
            refine_reasoning=r.refine_reasoning,
            cost_usd=r.cost_usd,
            status=r.status,
            error_message=r.error_message,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in runs
    ]


@router.get("/runs/{run_id}/changes")
async def get_run_changes(run_id: int, db: AsyncSession = Depends(get_db)):
    """Get neuron changes (refinements) made by a specific autopilot run."""
    run = await db.get(AutopilotRun, run_id)
    if not run or not run.query_id:
        return []
    result = await db.execute(
        select(NeuronRefinement).where(NeuronRefinement.query_id == run.query_id)
        .order_by(NeuronRefinement.id)
    )
    refinements = result.scalars().all()
    changes = []
    for r in refinements:
        neuron = await db.get(Neuron, r.neuron_id)
        entry = {
            "id": r.id,
            "neuron_id": r.neuron_id,
            "neuron_label": neuron.label if neuron else f"#{r.neuron_id}",
            "action": r.action,
            "field": r.field,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "reason": r.reason,
        }
        # For creates, include the full neuron details
        if r.action == "create" and neuron:
            entry["neuron_detail"] = {
                "layer": neuron.layer,
                "node_type": neuron.node_type,
                "department": neuron.department,
                "role_key": neuron.role_key,
                "summary": neuron.summary,
                "content": neuron.content,
            }
        changes.append(entry)
    return changes


# ── Tick Orchestration ─────────────────────────────────────────────────

async def _run_tick(db: AsyncSession, config: AutopilotConfig) -> AutopilotTickResponse:
    """Run one autopilot cycle. Uses separate DB sessions per step to avoid
    holding a long SQLite lock across multiple Haiku calls."""
    global _cancel_requested, _tick_running, _current_step
    _cancel_requested = False
    _tick_running = True
    _current_step = ""

    total_cost = 0.0
    focus_label = None
    focus_context = ""
    generated_query = "(generation failed)"
    directive = config.directive
    focus_neuron_id = config.focus_neuron_id
    max_layer = config.max_layer
    eval_model = config.eval_model
    query_id = None
    neurons_activated = 0
    eval_overall = 0
    eval_text = ""
    reasoning = ""
    updates_applied = 0
    neurons_created = 0

    def _check_cancel():
        if _cancel_requested:
            raise _CancelledError("Autopilot tick cancelled by user")

    try:
        # Step 0: Read-only — gather context, then release DB
        _set_step("generate", "Loading focus context and recent queries...")
        async with async_session() as s0:
            if focus_neuron_id:
                focus_label, focus_context = await _get_subtree_context(s0, focus_neuron_id)
            recent_result = await s0.execute(
                select(AutopilotRun.generated_query)
                .order_by(AutopilotRun.id.desc())
                .limit(10)
            )
            recent_queries = [r[0] for r in recent_result.all()]

        _check_cancel()

        # Step 1: Generate query (Haiku call — no DB needed)
        _set_step("generate", "Calling Haiku to generate test query...")
        generated_query, gen_cost = await _generate_query(
            directive, recent_queries, focus_context
        )
        total_cost += gen_cost

        _check_cancel()

        # Step 2: Execute through pipeline (owns its own session/commit)
        _set_step("execute", "Scoring and selecting candidate neurons...")
        async with async_session() as s2:
            exec_result = await execute_query(s2, generated_query, modes=["haiku_neuron"])
            query_id = exec_result["query_id"]
            neurons_activated = exec_result["neurons_activated"]
            total_cost += exec_result["total_cost"]

        _check_cancel()

        # Step 3: Self-evaluate (Haiku/Sonnet/Opus call + short DB write)
        _set_step("evaluate", f"Calling {eval_model} to evaluate response quality...")
        async with async_session() as s3:
            query = await s3.get(Query, query_id)
            eval_overall, eval_text, eval_cost = await _self_evaluate(s3, query, model=eval_model)
            await s3.commit()
            total_cost += eval_cost

        _check_cancel()

        # Step 4: Refine (Haiku/Sonnet/Opus call + short DB write)
        _set_step("refine", f"Calling {eval_model} to analyze gaps and suggest improvements...")
        async with async_session() as s4:
            query = await s4.get(Query, query_id)
            reasoning, updates, new_neurons, refine_cost = await _refine(
                s4, query, max_layer=max_layer, focus_neuron_id=focus_neuron_id,
                model=eval_model,
            )
            await s4.commit()
            total_cost += refine_cost

        _check_cancel()

        # Step 5: Apply all suggestions (short DB writes)
        n_updates = len(updates) if updates else 0
        n_new = len(new_neurons) if new_neurons else 0
        _set_step("apply", f"Applying {n_updates} updates and {n_new} new neurons...")
        async with async_session() as s5:
            query = await s5.get(Query, query_id)
            updates_applied, neurons_created = await _apply_all(s5, query, updates, new_neurons)
            await s5.commit()

        # Step 6: Record run + update last_tick_at
        _set_step("record", "Saving run metrics...")
        async with async_session() as s6:
            cfg = await _get_or_create_config(s6)
            cfg.last_tick_at = func.now()
            run = AutopilotRun(
                query_id=query_id,
                generated_query=generated_query,
                directive=directive,
                focus_neuron_label=focus_label,
                neurons_activated=neurons_activated,
                updates_applied=updates_applied,
                neurons_created=neurons_created,
                eval_overall=eval_overall,
                eval_text=eval_text,
                refine_reasoning=reasoning,
                cost_usd=total_cost,
                status="completed",
            )
            s6.add(run)
            await s6.commit()

        _tick_running = False
        _current_step = ""
        _current_detail = ""
        return AutopilotTickResponse(status="completed", run_id=run.id)

    except _CancelledError:
        _tick_running = False
        _current_step = ""
        _current_detail = ""
        # Record partial run as cancelled
        try:
            async with async_session() as sc:
                run = AutopilotRun(
                    query_id=query_id,
                    generated_query=generated_query,
                    directive=directive,
                    focus_neuron_label=focus_label,
                    neurons_activated=neurons_activated,
                    updates_applied=updates_applied,
                    neurons_created=neurons_created,
                    eval_overall=eval_overall,
                    eval_text=eval_text or None,
                    refine_reasoning=reasoning or None,
                    cost_usd=total_cost,
                    status="cancelled",
                )
                sc.add(run)
                await sc.commit()
        except Exception:
            pass
        return AutopilotTickResponse(status="cancelled", message="Tick cancelled by user")

    except Exception as e:
        _tick_running = False
        _current_step = ""
        _current_detail = ""
        # Record error in a fresh session
        try:
            async with async_session() as se:
                run = AutopilotRun(
                    generated_query=generated_query,
                    directive=directive,
                    focus_neuron_label=focus_label,
                    neurons_activated=0,
                    updates_applied=0,
                    neurons_created=0,
                    eval_overall=0,
                    cost_usd=total_cost,
                    status="error",
                    error_message=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-500:]}",
                )
                se.add(run)
                await se.commit()
        except Exception:
            pass
        return AutopilotTickResponse(status="error", message=str(e))


class _CancelledError(Exception):
    pass


async def _generate_query(
    directive: str, recent_queries: list[str], focus_context: str
) -> tuple[str, float]:
    """Generate a novel test query via Haiku."""
    recent_section = ""
    if recent_queries:
        recent_section = (
            "\n\nRecent queries already generated (do NOT repeat or closely paraphrase these):\n"
            + "\n".join(f"- {q}" for q in recent_queries)
        )

    focus_section = ""
    if focus_context:
        focus_section = f"\n\nFocus area (generate queries specifically about this domain):\n{focus_context}"

    system_prompt = (
        "You generate realistic test queries for a knowledge management system. "
        "Generate ONE novel, specific query that someone working in this domain would ask. "
        "The query should test the system's knowledge and require detailed, practical answers. "
        "Respond with ONLY the query text — no explanation, no quotes, no numbering."
    )

    user_prompt = f"Training directive: {directive}{focus_section}{recent_section}"

    result = await claude_chat(system_prompt, user_prompt, max_tokens=256, model="haiku")
    query_text = result["text"].strip().strip('"').strip("'")
    return query_text, result["cost_usd"]


async def _self_evaluate(
    db: AsyncSession, query: Query, model: str = "haiku"
) -> tuple[int, str, float]:
    """Single-response self-evaluation via Haiku. Returns (overall, verdict, cost)."""
    # Get the neuron-enhanced response
    response_text = ""
    if query.results_json:
        try:
            slots = json.loads(query.results_json)
            for s in slots:
                if s.get("neurons"):
                    response_text = s["response"]
                    break
        except json.JSONDecodeError:
            pass
    if not response_text:
        response_text = query.response_text or ""

    system_prompt = (
        "You evaluate AI responses for quality. Score this response on these dimensions "
        "(1=poor, 5=excellent):\n"
        "- Accuracy: factual correctness\n"
        "- Completeness: covers the full question\n"
        "- Clarity: well-structured, easy to understand\n"
        "- Faithfulness: no hallucinations (5=fully faithful)\n"
        "- Overall: holistic quality\n\n"
        "Respond with EXACTLY this JSON format:\n"
        '```json\n'
        '{"accuracy": <1-5>, "completeness": <1-5>, "clarity": <1-5>, '
        '"faithfulness": <1-5>, "overall": <1-5>, '
        '"verdict": "<2-3 sentence assessment>"}\n'
        '```\n'
        "No text outside the JSON block."
    )

    user_prompt = f"Question:\n{query.user_message}\n\nResponse:\n{response_text}"

    result = await claude_chat(system_prompt, user_prompt, max_tokens=512, model=model)
    raw = result["text"].strip()

    # Parse
    accuracy = completeness = clarity = faithfulness = overall = 3
    verdict = raw
    try:
        json_str = raw
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()
        parsed = json.loads(json_str)
        accuracy = _clamp(parsed.get("accuracy", 3))
        completeness = _clamp(parsed.get("completeness", 3))
        clarity = _clamp(parsed.get("clarity", 3))
        faithfulness = _clamp(parsed.get("faithfulness", 3))
        overall = _clamp(parsed.get("overall", 3))
        verdict = parsed.get("verdict", raw)
    except (json.JSONDecodeError, Exception):
        pass

    # Delete old eval scores for this query
    old_scores = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query.id)
    )
    for old in old_scores.scalars():
        await db.delete(old)

    # Write EvalScore row
    db.add(EvalScore(
        query_id=query.id,
        eval_model=model,
        answer_mode="haiku_neuron",
        answer_label="A",
        accuracy=accuracy,
        completeness=completeness,
        clarity=clarity,
        faithfulness=faithfulness,
        overall=overall,
        verdict=verdict,
    ))
    query.eval_text = verdict
    query.eval_model = model
    query.eval_input_tokens = result["input_tokens"]
    query.eval_output_tokens = result["output_tokens"]
    await db.flush()

    return overall, verdict, result["cost_usd"]


async def _refine(
    db: AsyncSession, query: Query, max_layer: int = 5,
    focus_neuron_id: int | None = None, model: str = "haiku",
) -> tuple[str, list[dict], list[dict], float]:
    """Refine neurons based on eval. Returns (reasoning, updates, new_neurons, cost)."""
    # Load eval scores
    eval_result = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query.id)
    )
    eval_scores = eval_result.scalars().all()

    # Load activated neurons
    neuron_ids = json.loads(query.selected_neuron_ids) if query.selected_neuron_ids else []
    neurons = []
    for nid in neuron_ids:
        neuron = await db.get(Neuron, nid)
        if neuron:
            neurons.append(neuron)

    # If no neurons were activated, load the focus neuron + its ancestors as anchor points
    # so the refine step can create new neurons under them
    anchor_neurons = []
    if not neurons and focus_neuron_id:
        focus = await db.get(Neuron, focus_neuron_id)
        if focus:
            anchor_neurons.append(focus)
            # Walk up to get parent chain for context
            current = focus
            while current.parent_id:
                parent = await db.get(Neuron, current.parent_id)
                if not parent:
                    break
                anchor_neurons.insert(0, parent)
                current = parent
            # Also grab direct children as potential attach points
            children_result = await db.execute(
                select(Neuron).where(
                    Neuron.parent_id == focus_neuron_id,
                    Neuron.is_active == True,
                ).limit(20)
            )
            anchor_neurons.extend(children_result.scalars().all())

    all_neurons = neurons if neurons else anchor_neurons
    if not all_neurons:
        return "No neurons activated and no focus area set — nothing to refine.", [], [], 0.0

    coverage_gap = not neurons  # True if the topic had no matching neurons

    # Get neuron response
    neuron_response = None
    if query.results_json:
        try:
            for s in json.loads(query.results_json):
                if s.get("neurons"):
                    neuron_response = s["response"]
                    break
        except json.JSONDecodeError:
            pass

    # Build neuron details
    neuron_sections = []
    for n in all_neurons:
        neuron_sections.append(
            f"Neuron #{n.id} (L{n.layer} {n.node_type})\n"
            f"  Label: {n.label}\n"
            f"  Department: {n.department or 'none'}\n"
            f"  Role Key: {n.role_key or 'none'}\n"
            f"  Summary: {n.summary or 'none'}\n"
            f"  Content:\n{n.content or '(empty)'}\n"
            f"  Invocations: {n.invocations}, Avg Utility: {n.avg_utility:.3f}, Active: {n.is_active}"
        )

    # Build eval summary
    eval_lines = []
    for es in eval_scores:
        eval_lines.append(
            f"  {es.answer_label} ({es.answer_mode}): "
            f"accuracy={es.accuracy} completeness={es.completeness} "
            f"clarity={es.clarity} faithfulness={es.faithfulness} overall={es.overall}"
        )
    eval_summary = "\n".join(eval_lines)
    verdict = query.eval_text or "No verdict"

    # Autopilot-specific prompt: aggressive about filling gaps
    if coverage_gap:
        gap_instruction = (
            "CRITICAL: The knowledge graph had NO neurons covering this topic. The neurons listed below "
            "are anchor points (the focus area and its parent/child hierarchy). You MUST create new neurons "
            "to fill this knowledge gap. Create 2-5 new neurons with substantive content that would help "
            "answer this type of question in the future. Attach them under the most relevant anchor neuron.\n"
        )
    else:
        gap_instruction = (
            "This is an autopilot training run. Be proactive about improvements:\n"
            "- If the response had gaps, create new neurons to fill missing knowledge\n"
            "- If existing neurons have thin or generic content, update them with specifics\n"
            "- If a topic area is underrepresented, create 1-3 new neurons\n"
            "- Do NOT assume other neurons cover the gaps — if you don't see it, it likely doesn't exist\n"
        )

    system_prompt = (
        "You are a neuron graph architect building a knowledge base through autonomous training.\n\n"
        "Your goal: grow and improve the neuron knowledge graph by creating new neurons to fill "
        "knowledge gaps and refining existing neurons with better content.\n\n"
        f"{gap_instruction}\n"
        "Rules:\n"
        "- For updates: specify the exact field (content, summary, label, or is_active), "
        "the old value, and the new value\n"
        "- For new neurons: specify parent_id (an existing neuron ID from the list below), "
        "layer (parent's layer + 1), node_type, label, content, summary, and department/role_key "
        "(inherit from parent)\n"
        f"- IMPORTANT: New neurons must have layer <= {max_layer}. Do NOT create neurons at layer {max_layer + 1} or deeper.\n"
        "- Keep content concise and factual — neurons are context snippets, not essays\n"
        "- Content should contain actionable, specific knowledge (definitions, procedures, best practices, "
        "key metrics, common pitfalls) — not vague overviews\n\n"
        "You MUST respond with EXACTLY a JSON block:\n"
        "```json\n"
        '{\n'
        '  "reasoning": "<1-3 sentences explaining what gaps you identified>",\n'
        '  "updates": [\n'
        '    {"neuron_id": <id>, "field": "<content|summary|label|is_active>", '
        '"old_value": "<current>", "new_value": "<improved>", "reason": "<why>"}\n'
        '  ],\n'
        '  "new_neurons": [\n'
        '    {"parent_id": <id>, "layer": <0-5>, "node_type": "<type>", '
        '"label": "<label>", "content": "<content>", "summary": "<summary>", '
        '"department": "<dept|null>", "role_key": "<key|null>", "reason": "<why>"}\n'
        '  ]\n'
        '}\n'
        "```\n"
        "No text outside the JSON block."
    )

    if coverage_gap:
        neuron_header = f"## Anchor Neurons (focus area hierarchy — attach new neurons here)\n"
    else:
        neuron_header = f"## Activated Neurons ({len(neurons)} total)\n"

    user_prompt = (
        f"## User Question\n{query.user_message}\n\n"
        f"## Eval Scores\n{eval_summary}\n\n"
        f"## Eval Verdict\n{verdict}\n\n"
        + neuron_header
        + "\n---\n".join(neuron_sections)
    )
    if neuron_response:
        user_prompt += f"\n\n## Neuron-Enhanced Response\n{neuron_response}"

    result = await claude_chat(system_prompt, user_prompt, max_tokens=4096, model=model)
    raw = result["text"].strip()

    # Parse
    reasoning = ""
    updates_raw = []
    new_neurons_raw = []
    try:
        json_str = raw
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()
        parsed = json.loads(json_str)
        reasoning = parsed.get("reasoning", "")
        updates_raw = parsed.get("updates", [])
        new_neurons_raw = parsed.get("new_neurons", [])
    except (json.JSONDecodeError, KeyError, TypeError):
        reasoning = raw

    # Store refine_json on query for audit trail
    refine_data = {
        "reasoning": reasoning,
        "updates": updates_raw,
        "new_neurons": new_neurons_raw,
    }
    query.refine_json = json.dumps(refine_data)
    await db.flush()

    return reasoning, updates_raw, new_neurons_raw, result["cost_usd"]


async def _apply_all(
    db: AsyncSession, query: Query,
    updates: list[dict], new_neurons: list[dict]
) -> tuple[int, int]:
    """Apply all update and new_neuron suggestions. Returns (updated_count, created_count)."""
    updated_count = 0
    for u in updates:
        neuron = await db.get(Neuron, u.get("neuron_id"))
        if not neuron:
            continue
        field = u.get("field", "")
        new_val = str(u.get("new_value", ""))
        old_val = str(u.get("old_value", ""))
        if field == "content":
            neuron.content = new_val
        elif field == "summary":
            neuron.summary = new_val
        elif field == "label":
            neuron.label = new_val
        elif field == "is_active":
            neuron.is_active = new_val.lower() in ("true", "1", "yes")
        else:
            continue
        if field in ("content", "summary"):
            from app.services.reference_hooks import populate_external_references
            populate_external_references(neuron)
        db.add(NeuronRefinement(
            query_id=query.id,
            neuron_id=u["neuron_id"],
            action="update",
            field=field,
            old_value=old_val,
            new_value=new_val,
            reason=u.get("reason", "autopilot"),
        ))
        updated_count += 1

    created_count = 0
    state = await get_system_state(db)
    for n in new_neurons:
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
            source_origin="autopilot",
        )
        from app.services.reference_hooks import populate_external_references
        populate_external_references(neuron)
        db.add(neuron)
        await db.flush()
        db.add(NeuronRefinement(
            query_id=query.id,
            neuron_id=neuron.id,
            action="create",
            field=None,
            old_value=None,
            new_value=n.get("label", ""),
            reason=n.get("reason", "autopilot"),
        ))
        created_count += 1

    await db.flush()
    return updated_count, created_count


def _clamp(val, lo: int = 1, hi: int = 5) -> int:
    try:
        return max(lo, min(hi, int(val)))
    except (TypeError, ValueError):
        return 3
