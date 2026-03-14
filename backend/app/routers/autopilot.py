"""Autopilot — gap-driven autonomous neuron growth loop.

Each tick: detect gap -> generate targeted query -> execute -> evaluate -> refine -> apply.
Falls back to directive-based random queries when no gaps are found.
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
    EmergentQueue,
)
from app.schemas import (
    AutopilotConfigOut, AutopilotConfigUpdate, AutopilotRunOut, AutopilotTickResponse,
)
from app.services.executor import execute_query
from app.services.claude_cli import claude_chat
from app.services.neuron_service import get_system_state
from app.services.gap_detector import detect_gap, GapTarget

router = APIRouter(prefix="/admin/autopilot", tags=["autopilot"])

# In-memory cancellation flag
_cancel_requested = False
_tick_running = False
_current_step = ""
_current_detail = ""

TICK_STEPS = ["detect", "generate", "execute", "evaluate", "refine", "apply", "record"]


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
    """Return the current autopilot configuration."""
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
    """Update autopilot configuration fields."""
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
    """Return the current autopilot tick execution status."""
    return {
        "running": _tick_running,
        "step": _current_step if _tick_running else "",
        "detail": _current_detail if _tick_running else "",
    }


@router.post("/cancel", response_model=AutopilotTickResponse)
async def cancel():
    """Request cancellation of the currently running autopilot tick."""
    global _cancel_requested
    if not _tick_running:
        return AutopilotTickResponse(status="skipped", message="No tick is running")
    _cancel_requested = True
    return AutopilotTickResponse(status="cancelled", message="Cancel requested — will stop after current step")


@router.post("/tick", response_model=AutopilotTickResponse)
async def tick(db: AsyncSession = Depends(get_db)):
    """Execute one autopilot tick if enabled and interval has elapsed."""
    if _tick_running:
        return AutopilotTickResponse(status="skipped", message="A tick is already running")
    config = await _get_or_create_config(db)
    if not config.enabled:
        return AutopilotTickResponse(status="skipped", message="Autopilot is disabled")
    # Respect interval
    if config.last_tick_at:
        elapsed = datetime.now(timezone.utc) - config.last_tick_at.replace(tzinfo=timezone.utc)
        if elapsed < timedelta(minutes=config.interval_minutes):
            remaining = timedelta(minutes=config.interval_minutes) - elapsed
            mins = int(remaining.total_seconds() // 60)
            return AutopilotTickResponse(status="skipped", message=f"Too soon — {mins}m remaining")
    return await _run_tick(db, config)


@router.post("/run-now", response_model=AutopilotTickResponse)
async def run_now(db: AsyncSession = Depends(get_db)):
    """Force-execute one autopilot tick immediately, bypassing the interval check."""
    if _tick_running:
        return AutopilotTickResponse(status="skipped", message="A tick is already running")
    config = await _get_or_create_config(db)
    return await _run_tick(db, config)


@router.get("/runs", response_model=list[AutopilotRunOut])
async def list_runs(db: AsyncSession = Depends(get_db)):
    """List the 50 most recent autopilot runs with their outcomes."""
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
            gap_source=r.gap_source,
            gap_target=r.gap_target,
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
    """Run one gap-driven autopilot cycle."""
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
    gap_source = None
    gap_target_desc = None
    gap: GapTarget | None = None

    def _check_cancel():
        if _cancel_requested:
            raise _CancelledError("Autopilot tick cancelled by user")

    try:
        # Step 0: Detect gap
        _set_step("detect", "Scanning for knowledge gaps...")
        async with async_session() as s0:
            gap = await detect_gap(s0, focus_neuron_id)

            # Also gather focus context
            if focus_neuron_id:
                focus_label, focus_context = await _get_subtree_context(s0, focus_neuron_id)

            recent_result = await s0.execute(
                select(AutopilotRun.generated_query)
                .order_by(AutopilotRun.id.desc())
                .limit(10)
            )
            recent_queries = [r[0] for r in recent_result.all()]

        if gap:
            gap_source = gap.source
            gap_target_desc = gap.description
            _set_step("detect", f"Found gap: {gap.source} — {gap.description[:80]}...")
        else:
            gap_source = "directive"
            gap_target_desc = "No structural gaps found — using directive for exploration"
            _set_step("detect", "No gaps found — falling back to directive-based query")

        _check_cancel()

        # Step 1: Generate targeted query
        _set_step("generate", "Generating targeted query from gap analysis...")
        generated_query, gen_cost = await _generate_query(
            directive, recent_queries, focus_context, gap
        )
        total_cost += gen_cost

        _check_cancel()

        # Step 2: Execute through pipeline
        _set_step("execute", "Scoring and selecting candidate neurons...")
        async with async_session() as s2:
            exec_result = await execute_query(s2, generated_query, modes=["haiku_neuron"])
            query_id = exec_result["query_id"]
            neurons_activated = exec_result["neurons_activated"]
            total_cost += exec_result["total_cost"]

        _check_cancel()

        # Step 3: Self-evaluate
        _set_step("evaluate", f"Calling {eval_model} to evaluate response quality...")
        async with async_session() as s3:
            query = await s3.get(Query, query_id)
            eval_overall, eval_text, eval_cost = await _self_evaluate(s3, query, model=eval_model)
            await s3.commit()
            total_cost += eval_cost

        _check_cancel()

        # Step 4: Refine
        _set_step("refine", f"Calling {eval_model} to analyze gaps and suggest improvements...")
        async with async_session() as s4:
            query = await s4.get(Query, query_id)
            reasoning, updates, new_neurons, refine_cost = await _refine(
                s4, query, max_layer=max_layer, focus_neuron_id=focus_neuron_id,
                model=eval_model, gap=gap,
            )
            await s4.commit()
            total_cost += refine_cost

        _check_cancel()

        # Step 5: Apply all suggestions
        n_updates = len(updates) if updates else 0
        n_new = len(new_neurons) if new_neurons else 0
        _set_step("apply", f"Applying {n_updates} updates and {n_new} new neurons...")
        async with async_session() as s5:
            query = await s5.get(Query, query_id)
            updates_applied, neurons_created = await _apply_all(s5, query, updates, new_neurons)

            # If gap was from emergent queue and we created neurons, mark it resolved
            if gap and gap.source == "emergent_queue" and gap.emergent_queue_id and neurons_created > 0:
                eq_entry = await s5.get(EmergentQueue, gap.emergent_queue_id)
                if eq_entry:
                    eq_entry.status = "resolved"
                    eq_entry.resolved_at = datetime.now(timezone.utc)
                    eq_entry.notes = f"Resolved by autopilot run (query #{query_id})"

            await s5.commit()

        # Step 6: Record run
        _set_step("record", "Saving run metrics...")
        async with async_session() as s6:
            cfg = await _get_or_create_config(s6)
            cfg.last_tick_at = func.now()
            run = AutopilotRun(
                query_id=query_id,
                generated_query=generated_query,
                directive=directive,
                focus_neuron_label=focus_label,
                gap_source=gap_source,
                gap_target=gap_target_desc,
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
        try:
            async with async_session() as sc:
                run = AutopilotRun(
                    query_id=query_id,
                    generated_query=generated_query,
                    directive=directive,
                    focus_neuron_label=focus_label,
                    gap_source=gap_source,
                    gap_target=gap_target_desc,
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
        try:
            async with async_session() as se:
                run = AutopilotRun(
                    generated_query=generated_query,
                    directive=directive,
                    focus_neuron_label=focus_label,
                    gap_source=gap_source,
                    gap_target=gap_target_desc,
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
    directive: str, recent_queries: list[str], focus_context: str,
    gap: GapTarget | None,
) -> tuple[str, float]:
    """Generate a targeted query based on gap analysis, or fall back to directive."""
    recent_section = ""
    if recent_queries:
        recent_section = (
            "\n\nRecent queries already generated (do NOT repeat or closely paraphrase these):\n"
            + "\n".join(f"- {q}" for q in recent_queries)
        )

    focus_section = ""
    if focus_context:
        focus_section = f"\n\nFocus area (generate queries specifically about this domain):\n{focus_context}"

    if gap and gap.source != "directive":
        # LLM PROMPT INTENT: Generate a targeted test query that exposes a detected knowledge gap
        #   in the neuron graph. The gap was identified by the gap detector (thin_neuron, emergent_queue,
        #   low_coverage, etc.) and the generated query will be executed through the full pipeline to
        #   trigger neuron creation/refinement in subsequent steps.
        # INPUT: User message contains the training directive, optional focus area context, gap
        #   description, and recent queries to avoid repetition. No structured data — all text.
        # OUTPUT FORMAT: Plain text — a single natural-language question with no quotes, numbering,
        #   or explanation. The caller strips leading/trailing quotes as a safety measure.
        # FAILURE MODES: If the LLM ignores the gap description and generates a generic query,
        #   the subsequent pipeline execution may not activate gap-relevant neurons, reducing training
        #   effectiveness. If the LLM includes explanation text around the query, the extra text
        #   becomes part of the query sent to the pipeline (degraded but functional).
        system_prompt = (
            "You generate targeted test queries for a knowledge management system. "
            "A gap has been detected in the knowledge graph. Generate ONE specific, "
            "detailed query that would expose this gap and require the system to have "
            "knowledge it currently lacks. "
            "The query should sound like a natural question from a domain expert. "
            "Respond with ONLY the query text — no explanation, no quotes, no numbering."
        )
        gap_section = f"\n\nDetected gap:\n{gap.description}"
        user_prompt = f"Training directive: {directive or 'general knowledge improvement'}{focus_section}{gap_section}{recent_section}"
    else:
        # LLM PROMPT INTENT: Generate a directive-based exploratory query when no structural gaps
        #   are detected. Acts as a fallback to keep the autopilot training loop productive even
        #   when the gap detector finds no specific deficiencies.
        # INPUT: User message contains the training directive, optional focus area context, and
        #   recent queries to avoid repetition. No gap description is included.
        # OUTPUT FORMAT: Plain text — a single natural-language question with no quotes, numbering,
        #   or explanation. The caller strips leading/trailing quotes as a safety measure.
        # FAILURE MODES: If the LLM repeats a recent query despite the dedup list, the pipeline
        #   will still execute but may not produce novel training signal. If the LLM generates
        #   an off-topic query, the pipeline execution will activate unrelated neurons.
        system_prompt = (
            "You generate realistic test queries for a knowledge management system. "
            "Generate ONE novel, specific query that someone working in this domain would ask. "
            "The query should test the system's knowledge and require detailed, practical answers. "
            "Respond with ONLY the query text — no explanation, no quotes, no numbering."
        )
        user_prompt = f"Training directive: {directive or 'general knowledge improvement'}{focus_section}{recent_section}"

    result = await claude_chat(system_prompt, user_prompt, max_tokens=256, model="haiku")
    query_text = result["text"].strip().strip('"').strip("'")
    return query_text, result["cost_usd"]


def _extract_neuron_response(query: Query) -> str:
    """Extract the neuron-enhanced response text from query results. Returns str or empty."""
    if query.results_json:
        try:
            for s in json.loads(query.results_json):
                if s.get("neurons"):
                    return s["response"]
        except json.JSONDecodeError:
            pass
    return ""


def _parse_eval_response(raw_text: str) -> tuple[int, int, int, int, int, str]:
    """Parse JSON from eval LLM response. Returns (accuracy, completeness, clarity, faithfulness, overall, verdict)."""
    accuracy = completeness = clarity = faithfulness = overall = 3
    verdict = raw_text
    try:
        json_str = raw_text
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
        verdict = parsed.get("verdict", raw_text)
    except (json.JSONDecodeError, Exception):
        pass
    return accuracy, completeness, clarity, faithfulness, overall, verdict


async def _self_evaluate(
    db: AsyncSession, query: Query, model: str = "haiku"
) -> tuple[int, str, float]:
    """Single-response self-evaluation. Returns (overall, verdict, cost)."""
    response_text = _extract_neuron_response(query) or query.response_text or ""

    # LLM PROMPT INTENT: Self-evaluate the quality of a neuron-enhanced pipeline response across
    #   five dimensions (accuracy, completeness, clarity, faithfulness, overall). The scores drive
    #   neuron utility updates and inform the subsequent refine step about response weaknesses.
    # INPUT: User message contains the original question and the neuron-enhanced response text,
    #   formatted as "Question:\n...\n\nResponse:\n...".
    # OUTPUT FORMAT: JSON inside a ```json``` code fence:
    #   {"accuracy": 1-5, "completeness": 1-5, "clarity": 1-5, "faithfulness": 1-5,
    #    "overall": 1-5, "verdict": "2-3 sentence assessment"}
    # FAILURE MODES: If the LLM returns non-JSON, _parse_eval_response falls back to all scores=3
    #   and uses the raw text as the verdict. This is safe but inflates mid-range scores. If the
    #   LLM returns scores outside 1-5, they are clamped by _clamp(). Markdown-wrapped JSON
    #   (with ```) is handled by the parser's code-fence extraction logic.
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
    accuracy, completeness, clarity, faithfulness, overall, verdict = _parse_eval_response(raw)

    # Delete old eval scores
    old_scores = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query.id)
    )
    for old in old_scores.scalars():
        await db.delete(old)

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


async def _load_refine_neurons(
    db: AsyncSession, query: Query,
    focus_neuron_id: int | None, gap: GapTarget | None,
) -> tuple[list[Neuron], bool]:
    """Load activated, gap-context, and anchor neurons. Returns (all_neurons, coverage_gap)."""
    neuron_ids = json.loads(query.selected_neuron_ids) if query.selected_neuron_ids else []
    neurons = []
    for nid in neuron_ids:
        neuron = await db.get(Neuron, nid)
        if neuron:
            neurons.append(neuron)

    # If gap provided context neurons, add those too
    gap_context_neurons = []
    if gap and gap.context_neuron_ids:
        for nid in gap.context_neuron_ids:
            if nid not in neuron_ids:
                neuron = await db.get(Neuron, nid)
                if neuron:
                    gap_context_neurons.append(neuron)

    # If no neurons were activated, load the focus neuron + ancestors as anchor points
    anchor_neurons = []
    if not neurons and not gap_context_neurons and focus_neuron_id:
        focus = await db.get(Neuron, focus_neuron_id)
        if focus:
            anchor_neurons.append(focus)
            current = focus
            while current.parent_id:
                parent = await db.get(Neuron, current.parent_id)
                if not parent:
                    break
                anchor_neurons.insert(0, parent)
                current = parent
            children_result = await db.execute(
                select(Neuron).where(
                    Neuron.parent_id == focus_neuron_id,
                    Neuron.is_active == True,
                ).limit(20)
            )
            anchor_neurons.extend(children_result.scalars().all())

    all_neurons = neurons + gap_context_neurons if (neurons or gap_context_neurons) else anchor_neurons
    coverage_gap = not neurons
    return all_neurons, coverage_gap


async def _build_neuron_sections(db: AsyncSession, all_neurons: list[Neuron]) -> list[str]:
    """Build neuron detail strings with child/sibling counts. Returns list[str]."""
    child_counts: dict[int, int] = {}
    sibling_counts: dict[int, int] = {}
    for n in all_neurons:
        cc_result = await db.execute(
            select(func.count(Neuron.id)).where(
                Neuron.parent_id == n.id, Neuron.is_active == True
            )
        )
        child_counts[n.id] = cc_result.scalar() or 0
        if n.parent_id:
            sc_result = await db.execute(
                select(func.count(Neuron.id)).where(
                    Neuron.parent_id == n.parent_id, Neuron.is_active == True
                )
            )
            sibling_counts[n.id] = (sc_result.scalar() or 1) - 1  # exclude self
        else:
            sibling_counts[n.id] = 0

    sections = []
    for n in all_neurons:
        sections.append(
            f"Neuron #{n.id} (L{n.layer} {n.node_type})\n"
            f"  Label: {n.label}\n"
            f"  Department: {n.department or 'none'}\n"
            f"  Role Key: {n.role_key or 'none'}\n"
            f"  Summary: {n.summary or 'none'}\n"
            f"  Content:\n{n.content or '(empty)'}\n"
            f"  Children: {child_counts.get(n.id, 0)}, Siblings: {sibling_counts.get(n.id, 0)}\n"
            f"  Invocations: {n.invocations}, Avg Utility: {n.avg_utility:.3f}, Active: {n.is_active}"
        )
    return sections


def _get_gap_instruction(gap: GapTarget | None, coverage_gap: bool) -> str:
    """Select the gap-aware instruction block for the refine prompt. Returns str."""
    if gap and gap.source == "emergent_queue":
        return (
            f"CRITICAL: This query was generated to fill a specific knowledge gap. "
            f"The system references '{gap.description.split(chr(39))[1] if chr(39) in gap.description else 'an external reference'}' "
            f"but has no dedicated neuron for it. You MUST create at least one new neuron "
            f"with authoritative content covering this reference. Attach it under the most "
            f"relevant existing neuron.\n"
        )
    if gap and gap.source == "thin_neuron":
        return (
            f"CRITICAL: This query targets a thin neuron with minimal content. "
            f"Prioritize UPDATING existing neurons with richer, more detailed content "
            f"over creating new ones. If the neuron's content is empty or stub-like, "
            f"fill it with substantive, actionable knowledge.\n"
        )
    if coverage_gap:
        return (
            "CRITICAL: The knowledge graph had NO neurons covering this topic. The neurons listed below "
            "are anchor points (the focus area and its parent/child hierarchy). You MUST create new neurons "
            "to fill this knowledge gap. Create 2-5 new neurons with substantive content that would help "
            "answer this type of question in the future. Attach them under the most relevant anchor neuron.\n"
        )
    return (
        "This is an autopilot training run. Be proactive about improvements:\n"
        "- If the response had gaps, create new neurons to fill missing knowledge\n"
        "- If existing neurons have thin or generic content, update them with specifics\n"
        "- If a topic area is underrepresented, create 1-3 new neurons\n"
        "- Do NOT assume other neurons cover the gaps — if you don't see it, it likely doesn't exist\n"
    )


# LLM PROMPT INTENT: Instruct the LLM to act as a neuron graph architect, analyzing eval scores
#   and activated neurons to propose concrete graph mutations (updates to existing neurons and
#   creation of new neurons). This is the core growth mechanism of the autopilot training loop.
# INPUT: User message (built by _build_refine_user_prompt) contains the original question, eval
#   scores/verdict, and detailed neuron listings with child/sibling counts, content, and metadata.
#   The system prompt includes gap-specific instructions and structural rules (max_layer, breadth
#   preference, content guidelines).
# OUTPUT FORMAT: JSON inside a ```json``` code fence:
#   {"reasoning": str, "updates": [{"neuron_id": int, "field": str, "old_value": str,
#    "new_value": str, "reason": str}], "new_neurons": [{"parent_id": int, "layer": int,
#    "node_type": str, "label": str, "content": str, "summary": str, "department": str|null,
#    "role_key": str|null, "reason": str}]}
# FAILURE MODES: If the LLM returns non-JSON, _parse_refine_response sets reasoning to the raw
#   text and returns empty updates/new_neurons lists — the tick completes with 0 changes applied.
#   If the LLM proposes neurons at layer > max_layer, _apply_all will still create them (the
#   constraint is advisory in the prompt, not enforced in code). If the LLM references a
#   nonexistent neuron_id in updates, that update is silently skipped. Chain-depth guard in
#   _apply_all redirects single-child chain extensions to sibling placement.
def _build_refine_prompt(
    gap: GapTarget | None, coverage_gap: bool, max_layer: int,
) -> str:
    """Build the system prompt for the refine LLM call. Returns str."""
    gap_instruction = _get_gap_instruction(gap, coverage_gap)
    return (
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
        "- BREADTH OVER DEPTH: Prefer adding sibling neurons under an existing parent over "
        "creating deeper chains. If a neuron has 0 children, consider adding multiple siblings "
        "under its PARENT rather than adding a child under it. Never create a chain of single-child "
        "neurons — if you need to add to a branch that already has only 1 child at each level, "
        "add siblings at an existing level instead. Check the Children/Siblings counts below.\n"
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


def _parse_refine_response(raw_text: str) -> tuple[str, list[dict], list[dict]]:
    """Parse JSON from refine LLM response. Returns (reasoning, updates, new_neurons)."""
    reasoning = ""
    updates_raw: list[dict] = []
    new_neurons_raw: list[dict] = []
    try:
        json_str = raw_text
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
        reasoning = raw_text
    return reasoning, updates_raw, new_neurons_raw


def _build_refine_user_prompt(
    query: Query, eval_scores: list, neuron_sections: list[str],
    all_neurons: list[Neuron], coverage_gap: bool,
) -> str:
    """Assemble the user prompt for the refine LLM call. Returns str."""
    eval_lines = [
        f"  {es.answer_label} ({es.answer_mode}): "
        f"accuracy={es.accuracy} completeness={es.completeness} "
        f"clarity={es.clarity} faithfulness={es.faithfulness} overall={es.overall}"
        for es in eval_scores
    ]
    eval_summary = "\n".join(eval_lines)
    verdict = query.eval_text or "No verdict"

    activated_ids = json.loads(query.selected_neuron_ids) if query.selected_neuron_ids else []
    gap_context_count = len(all_neurons) - len([n for n in all_neurons if n.id in activated_ids])
    if coverage_gap and gap_context_count == 0:
        neuron_header = "## Anchor Neurons (focus area hierarchy — attach new neurons here)\n"
    elif gap_context_count > 0 and activated_ids:
        neuron_header = f"## Context Neurons ({len(activated_ids)} activated + {gap_context_count} gap context)\n"
    else:
        neuron_header = f"## Activated Neurons ({len(all_neurons)} total)\n"

    prompt = (
        f"## User Question\n{query.user_message}\n\n"
        f"## Eval Scores\n{eval_summary}\n\n"
        f"## Eval Verdict\n{verdict}\n\n"
        + neuron_header
        + "\n---\n".join(neuron_sections)
    )
    neuron_response = _extract_neuron_response(query)
    if neuron_response:
        prompt += f"\n\n## Neuron-Enhanced Response\n{neuron_response}"
    return prompt


async def _refine(
    db: AsyncSession, query: Query, max_layer: int = 5,
    focus_neuron_id: int | None = None, model: str = "haiku",
    gap: GapTarget | None = None,
) -> tuple[str, list[dict], list[dict], float]:
    """Refine neurons based on eval + gap context. Returns (reasoning, updates, new_neurons, cost)."""
    eval_result = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query.id)
    )
    eval_scores = eval_result.scalars().all()

    all_neurons, coverage_gap = await _load_refine_neurons(db, query, focus_neuron_id, gap)
    if not all_neurons:
        return "No neurons activated and no focus area set — nothing to refine.", [], [], 0.0

    neuron_sections = await _build_neuron_sections(db, all_neurons)
    system_prompt = _build_refine_prompt(gap, coverage_gap, max_layer)
    user_prompt = _build_refine_user_prompt(query, eval_scores, neuron_sections, all_neurons, coverage_gap)

    result = await claude_chat(system_prompt, user_prompt, max_tokens=4096, model=model)
    reasoning, updates_raw, new_neurons_raw = _parse_refine_response(result["text"].strip())

    query.refine_json = json.dumps({
        "reasoning": reasoning, "updates": updates_raw, "new_neurons": new_neurons_raw,
    })
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
    created_parent_ids: set[int] = set()  # Track parents we've already added children to this tick
    state = await get_system_state(db)
    for n in new_neurons:
        parent_id = n.get("parent_id")

        # Chain-depth guard: don't extend single-child chains
        if parent_id:
            # Check if parent already has exactly 0 children AND its grandparent
            # also has exactly 1 child (the parent) — this would create a thin chain
            parent_child_count = (await db.execute(
                select(func.count(Neuron.id)).where(
                    Neuron.parent_id == parent_id, Neuron.is_active == True
                )
            )).scalar() or 0
            # Also count children we're creating this tick under the same parent
            tick_siblings = sum(1 for pid in created_parent_ids if pid == parent_id)
            effective_children = parent_child_count + tick_siblings

            if effective_children == 0:
                # Parent has no children — check if parent itself is a lone child
                parent_neuron = await db.get(Neuron, parent_id)
                if parent_neuron and parent_neuron.parent_id:
                    grandparent_child_count = (await db.execute(
                        select(func.count(Neuron.id)).where(
                            Neuron.parent_id == parent_neuron.parent_id, Neuron.is_active == True
                        )
                    )).scalar() or 0
                    if grandparent_child_count == 1:
                        # This would extend a single-child chain — redirect to be a sibling instead
                        import logging
                        logging.getLogger(__name__).info(
                            f"AUTOPILOT: Redirecting neuron from parent #{parent_id} to "
                            f"#{parent_neuron.parent_id} to avoid single-child chain"
                        )
                        parent_id = parent_neuron.parent_id
                        n["layer"] = parent_neuron.layer  # Same layer as would-be parent

        created_parent_ids.add(parent_id or 0)
        neuron = Neuron(
            parent_id=parent_id,
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
