"""POST /query — Main pipeline. POST /query/{id}/rate — User feedback."""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Query, NeuronFiring, Neuron, EvalScore, NeuronRefinement
from app.schemas import (
    QueryRequest, QueryResponse, QuerySummary, QueryDetail, NeuronHit, SlotResult,
    EvalRequest, EvalResponse, EvalScoreOut, EvalScoreSummary,
    RatingRequest, RatingResponse,
    RefineRequest, RefineResponse, NeuronUpdateSuggestion, NewNeuronSuggestion,
    ApplyRefineRequest, ApplyRefineResponse, RefinementOut,
)
from app.services.executor import execute_query
from app.services.claude_cli import claude_chat, estimate_cost
from app.services.neuron_service import get_system_state, score_candidates
from app.services.scoring_engine import update_impact_ema
from app.services.input_guard import check_input, check_output_risk, check_output_grounding
from sqlalchemy import select, func

router = APIRouter(tags=["query"])

VALID_MODES = {"haiku_neuron", "haiku_raw", "sonnet_neuron", "sonnet_raw", "opus_neuron", "opus_raw"}


def _parse_slots(query: Query) -> list[SlotResult]:
    """Parse slots from results_json, falling back to legacy columns."""
    if query.results_json:
        try:
            return [SlotResult(**s) for s in json.loads(query.results_json)]
        except (json.JSONDecodeError, Exception):
            pass
    # Legacy fallback
    slots = []
    if query.response_text:
        slots.append(SlotResult(
            mode="haiku_neuron", model="haiku", neurons=True,
            response=query.response_text,
            input_tokens=query.execute_input_tokens,
            output_tokens=query.execute_output_tokens,
            cost_usd=0,
        ))
    if query.opus_response_text:
        slots.append(SlotResult(
            mode="opus_raw", model="opus", neurons=False,
            response=query.opus_response_text,
            input_tokens=query.opus_input_tokens,
            output_tokens=query.opus_output_tokens,
            cost_usd=0,
        ))
    return slots


def _parse_modes(query: Query) -> list[str]:
    if query.results_json:
        try:
            return [s["mode"] for s in json.loads(query.results_json)]
        except (json.JSONDecodeError, Exception):
            pass
    modes = []
    if query.run_neuron:
        modes.append("haiku_neuron")
    if query.run_opus:
        modes.append("opus_raw")
    return modes


@router.post("/queries/run-counts")
async def query_run_counts(texts: list[str], db: AsyncSession = Depends(get_db)):
    """Return {text: count} for each provided query text."""
    if not texts:
        return {}
    result = await db.execute(
        select(Query.user_message, func.count())
        .where(Query.user_message.in_(texts))
        .group_by(Query.user_message)
    )
    counts = {row[0]: row[1] for row in result.all()}
    return {t: counts.get(t, 0) for t in texts}


@router.get("/queries", response_model=list[QuerySummary])
async def list_queries(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Query).order_by(Query.id.desc()).limit(50))
    queries = result.scalars().all()
    return [
        QuerySummary(
            id=q.id,
            user_message=q.user_message,
            classified_intent=q.classified_intent,
            modes=_parse_modes(q),
            cost_usd=q.cost_usd,
            user_rating=q.user_rating,
            created_at=q.created_at.isoformat() if q.created_at else None,
        )
        for q in queries
    ]


@router.get("/queries/{query_id}", response_model=QueryDetail)
async def get_query_detail(query_id: int, db: AsyncSession = Depends(get_db)):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    neuron_ids = json.loads(query.selected_neuron_ids) if query.selected_neuron_ids else []

    neurons = []
    for nid in neuron_ids:
        neuron = await db.get(Neuron, nid)
        if neuron:
            neurons.append(neuron)

    # Use cached scores from execution time; fall back to re-scoring for old queries
    score_map: dict[int, dict] = {}
    if query.neuron_scores_json:
        for s in json.loads(query.neuron_scores_json):
            score_map[s["neuron_id"]] = s
    elif neurons:
        state = await get_system_state(db)
        keywords_list = json.loads(query.classified_keywords) if query.classified_keywords else []
        scored = await score_candidates(db, neurons, state.total_queries, keywords_list)
        score_map = {s.neuron_id: {"combined": s.combined, "burst": s.burst,
                     "impact": s.impact, "precision": s.precision, "novelty": s.novelty,
                     "recency": s.recency, "relevance": s.relevance} for s in scored}

    hits = []
    for neuron in neurons:
        s = score_map.get(neuron.id, {})
        hits.append(NeuronHit(
            neuron_id=neuron.id, label=neuron.label, layer=neuron.layer,
            department=neuron.department,
            combined=s.get("combined", 0), burst=s.get("burst", 0),
            impact=s.get("impact", 0), precision=s.get("precision", 0),
            novelty=s.get("novelty", 0), recency=s.get("recency", 0),
            relevance=s.get("relevance", 0), spread_boost=s.get("spread_boost", 0),
        ))

    slots = _parse_slots(query)

    # Load eval scores
    eval_scores_result = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query_id).order_by(EvalScore.answer_label)
    )
    eval_scores = [
        EvalScoreOut(
            answer_label=es.answer_label,
            answer_mode=es.answer_mode,
            accuracy=es.accuracy,
            completeness=es.completeness,
            clarity=es.clarity,
            faithfulness=es.faithfulness,
            overall=es.overall,
        )
        for es in eval_scores_result.scalars()
    ]
    # Determine winner from verdict text
    eval_winner = None
    if eval_scores and query.eval_text:
        # Try to find winner from stored scores
        best = max(eval_scores, key=lambda s: s.overall)
        if eval_scores.count(best) == 1:
            eval_winner = best.answer_label

    # Load refinements for this query
    refinement_result = await db.execute(
        select(NeuronRefinement).where(NeuronRefinement.query_id == query_id).order_by(NeuronRefinement.id)
    )
    refinement_rows = refinement_result.scalars().all()
    refinements = []
    for r in refinement_rows:
        neuron = await db.get(Neuron, r.neuron_id)
        refinements.append(RefinementOut(
            id=r.id,
            neuron_id=r.neuron_id,
            action=r.action,
            field=r.field,
            old_value=r.old_value,
            new_value=r.new_value,
            reason=r.reason,
            neuron_label=neuron.label if neuron else None,
        ))

    # Parse pending (unapplied) refine suggestions if present
    pending_refine = None
    if query.refine_json:
        try:
            pending_refine = json.loads(query.refine_json)
        except json.JSONDecodeError:
            pass

    return QueryDetail(
        id=query.id,
        user_message=query.user_message,
        classified_intent=query.classified_intent,
        departments=json.loads(query.classified_departments) if query.classified_departments else [],
        role_keys=json.loads(query.classified_role_keys) if query.classified_role_keys else [],
        keywords=json.loads(query.classified_keywords) if query.classified_keywords else [],
        assembled_prompt=query.assembled_prompt,
        classify_input_tokens=query.classify_input_tokens,
        classify_output_tokens=query.classify_output_tokens,
        classify_cost=estimate_cost("haiku", query.classify_input_tokens, query.classify_output_tokens),
        slots=slots,
        total_cost=query.cost_usd or 0,
        user_rating=query.user_rating,
        eval_text=query.eval_text,
        eval_model=query.eval_model,
        eval_input_tokens=query.eval_input_tokens,
        eval_output_tokens=query.eval_output_tokens,
        eval_scores=eval_scores,
        eval_winner=eval_winner,
        neuron_hits=hits,
        refinements=refinements,
        pending_refine=pending_refine,
        created_at=query.created_at.isoformat() if query.created_at else None,
    )


@router.post("/query", response_model=QueryResponse)
async def post_query(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    # ── Input Guard: run before classification ──
    guard_result = check_input(req.message)
    if guard_result.verdict == "block":
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Input blocked by safety filter",
                "flags": guard_result.flags,
            },
        )

    if req.slots_v2:
        # v2: per-slot budgets
        for s in req.slots_v2:
            if s.mode not in VALID_MODES:
                raise HTTPException(status_code=400, detail=f"Invalid mode: {s.mode}")
        slots_v2 = [s.model_dump() for s in req.slots_v2]
        result = await execute_query(db, req.message, modes=[], slots_v2=slots_v2)
    else:
        # Legacy: shared budget
        for m in req.modes:
            if m not in VALID_MODES:
                raise HTTPException(status_code=400, detail=f"Invalid mode: {m}")
        if not req.modes:
            raise HTTPException(status_code=400, detail="At least one mode required")
        result = await execute_query(db, req.message, modes=req.modes, token_budget=req.token_budget)

    # ── Output Checks: risk tagging + grounding ──
    output_checks: list[dict] = []
    for slot in result.get("slots", []):
        response_text = slot.get("response", "")
        risk_flags = check_output_risk(response_text)
        grounding = check_output_grounding(
            response_text,
            result.get("assembled_prompt"),
        ) if slot.get("neurons") else {"grounded": None, "confidence": None, "reason": "Raw mode — no neuron context"}
        output_checks.append({
            "mode": slot.get("mode"),
            "risk_flags": risk_flags,
            "grounding": grounding,
        })

    # Attach guard and output checks to response
    result["input_guard"] = guard_result.to_dict()
    result["output_checks"] = output_checks

    return QueryResponse(**result)


@router.post("/query/{query_id}/evaluate", response_model=EvalResponse)
async def evaluate_query(
    query_id: int, req: EvalRequest, db: AsyncSession = Depends(get_db)
):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    slots = _parse_slots(query)
    if len(slots) < 2:
        raise HTTPException(status_code=400, detail="Need at least two responses to compare")

    # Build answer labels
    def _slot_label(slot: SlotResult) -> str:
        if slot.label:
            return slot.label
        parts = [slot.model.title()]
        if slot.neurons:
            parts.append("+ Neurons")
        if slot.token_budget is not None and slot.neurons:
            parts.append(f"@ {slot.token_budget // 1000}K")
        return " ".join(parts)

    answer_map: list[tuple[str, SlotResult]] = []  # (letter, slot)
    sections = [f"User's question:\n{query.user_message}"]
    for i, slot in enumerate(slots):
        label = _slot_label(slot)
        letter = chr(65 + i)
        answer_map.append((letter, slot))
        sections.append(f"Answer {letter} ({label}):\n{slot.response}")

    # Build the answer keys for the JSON template
    score_template = []
    for letter, slot in answer_map:
        label = _slot_label(slot)
        score_template.append(
            f'  {{"answer": "{letter}", "label": "{label}", '
            f'"accuracy": <1-5>, "completeness": <1-5>, "clarity": <1-5>, '
            f'"faithfulness": <1-5>, "overall": <1-5>}}'
        )

    eval_prompt = "\n\n---\n\n".join(sections)

    eval_system = (
        "You are a blind evaluator comparing AI responses. You have NO prior context — "
        "only the user's question and the answers provided.\n\n"
        "Score each answer on these dimensions (1=poor, 5=excellent):\n"
        "- Accuracy: factual correctness\n"
        "- Completeness: covers the full question\n"
        "- Clarity: well-structured, easy to understand\n"
        "- Faithfulness: no hallucinations or unsupported claims (5=fully faithful)\n"
        "- Overall: holistic quality\n\n"
        "You MUST respond with EXACTLY this format — a JSON block followed by your verdict:\n\n"
        "```json\n"
        '{"scores": [\n'
        + ",\n".join(score_template) + "\n"
        "],\n"
        '"winner": "<letter or tie>",\n'
        '"verdict": "<2-4 sentence comparison explaining your reasoning>"\n'
        "}\n"
        "```\n\n"
        "No other text outside the JSON block. Use the answer labels (A, B, etc.) in your verdict."
    )

    result = await claude_chat(eval_system, eval_prompt, max_tokens=2048, model=req.model)

    raw_text = result["text"].strip()

    # Parse structured scores
    parsed_scores = []
    verdict_text = raw_text
    winner = None
    try:
        # Extract JSON from code block or raw
        json_str = raw_text
        if "```" in json_str:
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()
        parsed = json.loads(json_str)
        parsed_scores = parsed.get("scores", [])
        verdict_text = parsed.get("verdict", raw_text)
        winner = parsed.get("winner")
    except (json.JSONDecodeError, Exception):
        pass  # Fall back to raw text

    # Delete old eval scores for this query
    old_scores = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query_id)
    )
    for old in old_scores.scalars():
        await db.delete(old)

    # Save new scores
    score_rows = []
    for ps in parsed_scores:
        letter = ps.get("answer", "?")
        # Find the matching slot
        slot_match = None
        for a_letter, a_slot in answer_map:
            if a_letter == letter:
                slot_match = a_slot
                break

        row = EvalScore(
            query_id=query_id,
            eval_model=req.model,
            answer_mode=slot_match.mode if slot_match else letter,
            answer_label=letter,
            accuracy=_clamp(ps.get("accuracy", 3)),
            completeness=_clamp(ps.get("completeness", 3)),
            clarity=_clamp(ps.get("clarity", 3)),
            faithfulness=_clamp(ps.get("faithfulness", 3)),
            overall=_clamp(ps.get("overall", 3)),
            verdict=verdict_text,
        )
        db.add(row)
        score_rows.append(EvalScoreOut(
            answer_label=letter,
            answer_mode=slot_match.mode if slot_match else letter,
            accuracy=row.accuracy,
            completeness=row.completeness,
            clarity=row.clarity,
            faithfulness=row.faithfulness,
            overall=row.overall,
        ))

    query.eval_text = verdict_text
    query.eval_model = req.model
    query.eval_input_tokens = result["input_tokens"]
    query.eval_output_tokens = result["output_tokens"]
    await db.commit()

    return EvalResponse(
        query_id=query_id,
        eval_text=verdict_text,
        eval_model=req.model,
        eval_input_tokens=result["input_tokens"],
        eval_output_tokens=result["output_tokens"],
        scores=score_rows,
        winner=winner,
    )


def _clamp(val: int | float, lo: int = 1, hi: int = 5) -> int:
    try:
        return max(lo, min(hi, int(val)))
    except (TypeError, ValueError):
        return 3


@router.get("/eval-scores", response_model=list[EvalScoreSummary])
async def list_eval_scores(db: AsyncSession = Depends(get_db)):
    """Get all eval scores for quick querying/comparison across queries."""
    result = await db.execute(
        select(EvalScore).order_by(EvalScore.query_id.desc(), EvalScore.answer_label)
    )
    rows = result.scalars().all()
    return [
        EvalScoreSummary(
            id=r.id,
            query_id=r.query_id,
            eval_model=r.eval_model,
            answer_mode=r.answer_mode,
            answer_label=r.answer_label,
            accuracy=r.accuracy,
            completeness=r.completeness,
            clarity=r.clarity,
            faithfulness=r.faithfulness,
            overall=r.overall,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("/query/{query_id}/rate", response_model=RatingResponse)
async def rate_query(
    query_id: int, req: RatingRequest, db: AsyncSession = Depends(get_db)
):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    query.user_rating = req.utility

    neuron_ids = json.loads(query.selected_neuron_ids) if query.selected_neuron_ids else []
    updated = 0
    for nid in neuron_ids:
        neuron = await db.get(Neuron, nid)
        if neuron:
            neuron.avg_utility = update_impact_ema(neuron.avg_utility, req.utility)
            updated += 1

    firings = await db.execute(
        select(NeuronFiring).where(NeuronFiring.query_id == query_id)
    )
    for firing in firings.scalars():
        firing.outcome = "rated"

    await db.commit()

    return RatingResponse(query_id=query_id, utility=req.utility, neurons_updated=updated)


@router.post("/query/{query_id}/refine", response_model=RefineResponse)
async def refine_query(
    query_id: int, req: RefineRequest, db: AsyncSession = Depends(get_db)
):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    # Need eval scores
    eval_result = await db.execute(
        select(EvalScore).where(EvalScore.query_id == query_id).order_by(EvalScore.answer_label)
    )
    eval_scores = eval_result.scalars().all()
    if not eval_scores:
        raise HTTPException(status_code=400, detail="Run evaluation first before refining neurons")

    # Load activated neurons
    neuron_ids = json.loads(query.selected_neuron_ids) if query.selected_neuron_ids else []
    if not neuron_ids:
        raise HTTPException(status_code=400, detail="No neurons were activated for this query")

    neurons = []
    for nid in neuron_ids:
        neuron = await db.get(Neuron, nid)
        if neuron:
            neurons.append(neuron)

    # Find the neuron-enhanced response from slots
    slots = _parse_slots(query)
    neuron_response = None
    for slot in slots:
        if slot.neurons:
            neuron_response = slot.response
            break

    # Build neuron details section
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

    system_prompt = (
        "You are a neuron graph architect. You analyze evaluation results and suggest "
        "concrete improvements to the neuron knowledge graph.\n\n"
        "Your goal: improve the quality of neuron-enhanced responses by refining neuron content, "
        "summaries, and labels, or by suggesting new neurons to fill knowledge gaps.\n\n"
        "Rules:\n"
        "- Only suggest changes that would meaningfully improve response quality\n"
        "- For updates: specify the exact field (content, summary, label, or is_active), "
        "the old value, and the new value\n"
        "- For new neurons: specify parent_id (an existing neuron ID from the activated list below), "
        "layer (0-5), node_type, label, content, summary, and optionally department/role_key\n"
        "- New neurons MUST attach under an existing activated neuron — do NOT create new departments (L0) or roles (L1)\n"
        "- Keep content concise and factual — neurons are context snippets, not essays\n"
        "- If the neuron-enhanced response performed well, fewer changes are needed\n"
        "- You only see the neurons that were activated for this query, not the full graph. "
        "Assume other relevant neurons may already exist elsewhere — focus on improving what you see.\n\n"
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
        f"## User Question\n{query.user_message}\n\n"
        f"## Eval Scores\n{eval_summary}\n\n"
        f"## Eval Verdict\n{verdict}\n\n"
        f"## Activated Neurons ({len(neurons)} total)\n"
        + "\n---\n".join(neuron_sections)
    )
    if neuron_response:
        user_prompt += f"\n\n## Neuron-Enhanced Response\n{neuron_response}"

    if req.user_context and req.user_context.strip():
        user_prompt += (
            f"\n\n## Additional Context from User\n"
            f"The user has provided the following information to help guide refinement. "
            f"Use this to fill knowledge gaps, correct inaccuracies, or better define "
            f"neuron content:\n\n{req.user_context.strip()}"
        )

    result = await claude_chat(system_prompt, user_prompt, max_tokens=req.max_tokens, model=req.model)

    raw_text = result["text"].strip()

    # Parse JSON
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
        reasoning = raw_text  # Fallback: show raw text as reasoning

    response = RefineResponse(
        query_id=query_id,
        model=req.model,
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
        reasoning=reasoning,
        updates=updates,
        new_neurons=new_neurons,
    )

    # Store for later apply
    query.refine_json = response.model_dump_json()
    await db.commit()

    return response


@router.post("/query/{query_id}/refine/apply", response_model=ApplyRefineResponse)
async def apply_refinements(
    query_id: int, req: ApplyRefineRequest, db: AsyncSession = Depends(get_db)
):
    query = await db.get(Query, query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")
    if not query.refine_json:
        raise HTTPException(status_code=400, detail="No refinement suggestions stored — run /refine first")

    stored = json.loads(query.refine_json)
    updates_list = stored.get("updates", [])
    new_neurons_list = stored.get("new_neurons", [])

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
            neuron.is_active = new_val.lower() in ("true", "1", "yes")
        if field in ("content", "summary"):
            from app.services.reference_hooks import populate_external_references
            populate_external_references(neuron)
        db.add(NeuronRefinement(
            query_id=query_id,
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
            source_origin="manual",
        )
        from app.services.reference_hooks import populate_external_references
        populate_external_references(neuron)
        db.add(neuron)
        await db.flush()  # get neuron.id
        db.add(NeuronRefinement(
            query_id=query_id,
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
