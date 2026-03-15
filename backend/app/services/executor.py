"""Full pipeline orchestration: classify → score → assemble → execute → record."""

import asyncio
import json
import time
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Callable, Awaitable

# Optional callback for streaming pipeline progress
StageCallback = Callable[[str, dict], Awaitable[None]] | None

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.config import settings
from app.models import Neuron, Query, NeuronEdge
from app.services.classifier import classify_query
from app.services.claude_cli import claude_chat
from app.services.neuron_service import (
    get_neurons_by_filter,
    get_system_state,
    score_candidates,
    spread_activation,
    record_firing,
    apply_diversity_floor,
)
from app.services.prompt_assembler import assemble_prompt
from app.services.propagation import propagate_activation
from app.services.neuron_service import NeuronCandidate
from app.services.scoring_engine import NeuronScoreBreakdown


@dataclass
class PreparedContext:
    """Result of the classify → score → spread → inhibit → assemble pipeline."""
    system_prompt: str
    intent: str
    departments: list[str]
    role_keys: list[str]
    keywords: list[str]
    neuron_scores: list[dict] = field(default_factory=list)
    neurons_activated: int = 0
    neuron_map: dict[int, Neuron] = field(default_factory=dict)
    all_scored: list[NeuronScoreBreakdown] = field(default_factory=list)
    classify_cost_usd: float = 0.0
    classify_input_tokens: int = 0
    classify_output_tokens: int = 0


async def _embed_query_async(user_message: str):
    import concurrent.futures
    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        from app.services.embedding_service import embed_text
        return await loop.run_in_executor(pool, embed_text, user_message)


async def _embed_and_classify(user_message: str) -> tuple[dict, object, str, list, list, list]:
    embed_task = asyncio.create_task(_embed_query_async(user_message))
    classify_task = asyncio.create_task(classify_query(user_message))

    classify_result = await classify_task
    query_embedding = None
    try:
        query_embedding = await embed_task
    except Exception as e:
        print(f"Query embedding failed, falling back to keywords: {e}")

    classification = classify_result["classification"]
    intent = classification.get("intent", "general_query")
    departments = classification.get("departments", [])
    role_keys = classification.get("role_keys", [])
    keywords = classification.get("keywords", [])

    assert isinstance(classify_result, dict), "classify_result must be a dict"
    assert isinstance(intent, str), "intent must be a string"
    return classify_result, query_embedding, intent, departments, role_keys, keywords


async def _select_and_score_candidates(
    db: AsyncSession,
    query_embedding,
    effective_pool: int,
    keywords: list[str],
    departments: list[str],
    role_keys: list[str],
    total_queries: int,
) -> list[NeuronScoreBreakdown]:
    assert isinstance(effective_pool, int) and effective_pool > 0, \
        "effective_pool must be a positive integer"

    semantic_candidates: list[tuple[int, float]] | None = None
    if settings.semantic_prefilter_enabled and query_embedding is not None:
        from app.services.semantic_prefilter import semantic_prefilter
        semantic_candidates = await semantic_prefilter(db, query_embedding, top_n_override=effective_pool)

    if semantic_candidates:
        sem_ids = [nid for nid, _ in semantic_candidates]
        sem_sim_map = {nid: sim for nid, sim in semantic_candidates}
        candidates = await _load_candidates_by_ids(db, sem_ids, keywords)
        scored = await score_candidates(
            db, candidates, total_queries, keywords,
            departments, role_keys,
            query_embedding=query_embedding,
            precomputed_similarities=sem_sim_map,
        )
    else:
        candidates = await get_neurons_by_filter(db, departments, role_keys, keywords)
        if not candidates:
            candidates = await get_neurons_by_filter(db)
        scored = await score_candidates(
            db, candidates, total_queries, keywords, departments, role_keys,
            query_embedding=query_embedding,
        )

    assert isinstance(scored, list), "scored must be a list"
    return scored


async def _apply_inhibition_and_boost(
    db: AsyncSession,
    scored: list[NeuronScoreBreakdown],
    effective_top_k: int,
    project_path: str | None,
) -> tuple[list[NeuronScoreBreakdown], int]:
    if settings.inhibition_enabled:
        from app.services.inhibitory_service import apply_inhibition
        all_scored, effective_top_k = await apply_inhibition(db, scored, effective_top_k)
    else:
        all_scored = await apply_diversity_floor(db, scored, effective_top_k)

    if project_path and getattr(settings, 'project_cache_enabled', False):
        from app.services.project_cache import get_project_boost
        candidate_ids = [s.neuron_id for s in all_scored[:effective_top_k]]
        boosts = await get_project_boost(db, project_path, candidate_ids)
        if boosts:
            for s in all_scored[:effective_top_k]:
                s.combined *= boosts.get(s.neuron_id, 1.0)
            all_scored[:effective_top_k] = sorted(
                all_scored[:effective_top_k], key=lambda s: s.combined, reverse=True
            )

    assert len(all_scored) >= 0, "all_scored must not be negative length"
    assert effective_top_k >= 0, f"effective_top_k must be non-negative, got {effective_top_k}"
    return all_scored, effective_top_k


async def _load_neuron_map(db: AsyncSession, neuron_ids: list[int]) -> dict[int, Neuron]:
    neuron_map: dict[int, Neuron] = {}
    if neuron_ids:
        result = await db.execute(select(Neuron).where(Neuron.id.in_(neuron_ids)))
        for neuron in result.scalars().all():
            neuron_map[neuron.id] = neuron
    assert isinstance(neuron_map, dict), "neuron_map must be a dict"
    assert len(neuron_map) <= len(neuron_ids), "neuron_map cannot exceed requested IDs"
    return neuron_map


def _build_neuron_score_dicts(
    scored: list[NeuronScoreBreakdown],
    neuron_map: dict[int, Neuron],
) -> list[dict]:
    assert isinstance(scored, list), "scored must be a list"
    assert isinstance(neuron_map, dict), "neuron_map must be a dict"
    return [
        {"neuron_id": s.neuron_id, "combined": s.combined, "burst": s.burst,
         "impact": s.impact, "precision": s.precision, "novelty": s.novelty,
         "recency": s.recency, "relevance": s.relevance, "spread_boost": s.spread_boost,
         "label": neuron_map[s.neuron_id].label if s.neuron_id in neuron_map else None,
         "department": neuron_map[s.neuron_id].department if s.neuron_id in neuron_map else None,
         "layer": neuron_map[s.neuron_id].layer if s.neuron_id in neuron_map else 0}
        for s in scored
    ]


async def prepare_context(
    db: AsyncSession, user_message: str, token_budget: int | None = None,
    top_k: int | None = None, candidate_pool: int | None = None,
    project_path: str | None = None, on_stage: StageCallback = None,
) -> PreparedContext:
    """Run classify → score → spread → inhibit → assemble without LLM execution.

    This is the core neuron graph pipeline extracted for reuse by MCP and the REST API.
    """
    assert isinstance(user_message, str) and len(user_message.strip()) > 0, \
        "user_message must be a non-empty string"
    async def _emit(stage: str, data: dict | None = None):
        if on_stage:
            await on_stage(stage, data or {"status": "done"})

    from app.services.structural_resolver import try_structural_resolve
    structural = await try_structural_resolve(db, user_message)
    if structural is not None:
        await _emit("structural_resolve", {"status": "done", "detail": "fast-path match"})
        return structural
    await _emit("structural_resolve", {"status": "skipped"})

    effective_top_k = top_k or settings.top_k_neurons
    effective_pool = candidate_pool or settings.semantic_prefilter_top_n
    effective_budget = token_budget or settings.token_budget
    classify_result, query_embedding, intent, departments, role_keys, keywords = \
        await _embed_and_classify(user_message)
    await _emit("embed_query")
    await _emit("classify", {"status": "done", "detail": {"intent": intent, "departments": departments}})

    state = await get_system_state(db)
    scored = await _select_and_score_candidates(
        db, query_embedding, effective_pool, keywords, departments, role_keys, state.total_queries,
    )
    await _emit("semantic_prefilter", {"status": "done", "detail": {"candidates": len(scored)}})
    await _emit("score_neurons", {"status": "done", "detail": {"scored": len(scored)}})
    scored = await spread_activation(db, scored, effective_top_k)
    await _emit("spread_activation", {"status": "done", "detail": {"propagated": len(scored)}})
    all_scored, effective_top_k = await _apply_inhibition_and_boost(
        db, scored, effective_top_k, project_path,
    )
    top_slice = all_scored[:effective_top_k]
    neuron_map = await _load_neuron_map(db, [s.neuron_id for s in top_slice])
    system_prompt = assemble_prompt(intent, top_slice, neuron_map, budget_tokens=effective_budget)
    await _emit("assemble_prompt", {"status": "done", "detail": {"neurons_activated": min(len(all_scored), effective_top_k)}})

    if project_path and getattr(settings, 'project_cache_enabled', False):
        from app.services.project_cache import record_project_firings
        await record_project_firings(db, project_path, top_slice)

    result = PreparedContext(
        system_prompt=system_prompt, intent=intent, departments=departments,
        role_keys=role_keys, keywords=keywords,
        neuron_scores=_build_neuron_score_dicts(top_slice, neuron_map),
        neurons_activated=min(len(all_scored), effective_top_k),
        neuron_map=neuron_map, all_scored=top_slice,
        classify_cost_usd=classify_result.get("cost_usd", 0),
        classify_input_tokens=classify_result["input_tokens"],
        classify_output_tokens=classify_result["output_tokens"],
    )
    assert isinstance(result.system_prompt, str) and len(result.system_prompt) > 0, \
        "PreparedContext.system_prompt must be a non-empty string"
    assert result.neurons_activated >= 0, \
        f"neurons_activated must be non-negative, got {result.neurons_activated}"
    return result


# Each slot is a dict: {mode, model, neurons, response, input_tokens, output_tokens, cost_usd}
# Modes: "haiku_neuron", "haiku_raw", "sonnet_neuron", "sonnet_raw", "opus_raw"

MODEL_MAP = MappingProxyType({
    "haiku_neuron": "haiku",
    "haiku_raw": "haiku",
    "sonnet_neuron": "sonnet",
    "sonnet_raw": "sonnet",
    "opus_neuron": None,  # default model (opus on personal sub)
    "opus_raw": None,  # default model (opus on personal sub)
})

NEURON_MODES = {"haiku_neuron", "sonnet_neuron", "opus_neuron"}

# LLM PROMPT INTENT: Minimal baseline system prompt for raw (non-neuron) comparison slots.
#   Provides only the organizational context without neuron-assembled knowledge, serving as
#   a control condition to measure the value added by the neuron graph.
# INPUT: User's natural-language query sent as user message. No neuron context is injected.
# OUTPUT FORMAT: Free-form natural-language response (no structured format required).
# FAILURE MODES: None specific to this prompt. LLM may produce generic or less domain-specific
#   answers compared to neuron-enhanced slots, which is the expected baseline behavior.
RAW_BASELINE_PROMPT = "I am an employee at an aerospace manufacturing and prototype design company."

# LLM PROMPT INTENT: Efficiency prefix prepended to system prompts when using the Sonnet model,
#   reducing verbosity and token waste since Sonnet tends toward longer, more elaborate responses.
# INPUT: Prepended before either the neuron-assembled prompt or RAW_BASELINE_PROMPT.
#   The user query is sent separately as the user message.
# OUTPUT FORMAT: No change to expected format — this is a behavioral modifier, not a format constraint.
# FAILURE MODES: If prepended to a non-Sonnet model by mistake, may cause unnecessarily terse
#   responses but is otherwise harmless. The prefix is only applied when is_sonnet is True.
SONNET_EFFICIENCY_PREFIX = "Be precise and concise. Prioritize accuracy over elaboration. Do not repeat the question or restate what is already known — lead with the answer.\n\n"


def _build_neuron_score_dicts(
    scored: list[NeuronScoreBreakdown],
    neuron_map: dict[int, Neuron],
) -> list[dict]:
    assert isinstance(scored, list), "scored must be a list"
    assert isinstance(neuron_map, dict), "neuron_map must be a dict"
    return [
        {"neuron_id": s.neuron_id, "combined": s.combined, "burst": s.burst,
         "impact": s.impact, "precision": s.precision, "novelty": s.novelty,
         "recency": s.recency, "relevance": s.relevance, "spread_boost": s.spread_boost,
         "label": neuron_map[s.neuron_id].label if s.neuron_id in neuron_map else None,
         "department": neuron_map[s.neuron_id].department if s.neuron_id in neuron_map else None,
         "layer": neuron_map[s.neuron_id].layer if s.neuron_id in neuron_map else 0}
        for s in scored
    ]


def _normalize_slot_specs(
    modes: list[str],
    token_budget: int | None,
    slots_v2: list[dict] | None,
) -> list[dict]:
    assert (modes and len(modes) > 0) or (slots_v2 and len(slots_v2) > 0), \
        "Either modes or slots_v2 must be provided and non-empty"
    if slots_v2:
        slot_specs = slots_v2
    else:
        slot_specs = [
            {"mode": m, "token_budget": token_budget or settings.token_budget,
             "top_k": settings.top_k_neurons, "label": None}
            for m in modes
        ]
    assert len(slot_specs) > 0, "slot_specs must be non-empty after normalization"
    return slot_specs


def _compute_neuron_slot_max(slot_specs: list[dict], attr: str, default_val: int) -> int:
    assert isinstance(slot_specs, list), "slot_specs must be a list"
    assert isinstance(attr, str), "attr must be a string"
    return max(
        (s.get(attr, default_val) for s in slot_specs if s["mode"] in NEURON_MODES),
        default=default_val,
    )


async def _run_neuron_pipeline(
    db: AsyncSession,
    user_message: str,
    slot_specs: list[dict],
    max_top_k: int,
    max_candidate_pool: int,
    on_stage: StageCallback,
) -> tuple[PreparedContext | None, dict]:
    assert isinstance(user_message, str) and len(user_message.strip()) > 0, \
        "user_message must be non-empty"
    needs_neurons = any(s["mode"] in NEURON_MODES for s in slot_specs)
    default_classify = {"classification": {}, "input_tokens": 0, "output_tokens": 0}
    if not needs_neurons:
        return None, default_classify
    neuron_budget = max(s["token_budget"] for s in slot_specs if s["mode"] in NEURON_MODES)
    ctx = await prepare_context(
        db, user_message,
        token_budget=neuron_budget,
        top_k=max_top_k,
        candidate_pool=max_candidate_pool,
        on_stage=on_stage,
    )
    classify_result = {
        "classification": {},
        "input_tokens": ctx.classify_input_tokens,
        "output_tokens": ctx.classify_output_tokens,
        "cost_usd": ctx.classify_cost_usd,
    }
    return ctx, classify_result


def _get_cached_prompt(
    prompt_cache: dict[tuple[int, int], str],
    budget: int,
    slot_top_k: int,
    intent: str,
    all_scored: list[NeuronScoreBreakdown],
    neuron_map: dict[int, Neuron],
) -> str:
    assert isinstance(budget, int) and budget > 0, "budget must be a positive int"
    assert isinstance(slot_top_k, int) and slot_top_k > 0, "slot_top_k must be a positive int"
    key = (budget, slot_top_k)
    if key not in prompt_cache:
        prompt_cache[key] = assemble_prompt(intent, all_scored[:slot_top_k], neuron_map, budget_tokens=budget)
    return prompt_cache[key]


def _create_query_record(
    user_message: str,
    ctx: PreparedContext | None,
    needs_neurons: bool,
    slot_specs: list[dict],
    primary_prompt: str,
    classify_result: dict,
) -> Query:
    assert isinstance(user_message, str), "user_message must be a string"
    assert isinstance(slot_specs, list) and len(slot_specs) > 0, \
        "slot_specs must be non-empty"
    selected_ids = [s.neuron_id for s in ctx.all_scored] if ctx else []
    return Query(
        user_message=user_message,
        classified_intent=ctx.intent if needs_neurons else None,
        classified_departments=json.dumps(ctx.departments if ctx else []),
        classified_role_keys=json.dumps(ctx.role_keys if ctx else []),
        classified_keywords=json.dumps(ctx.keywords if ctx else []),
        selected_neuron_ids=json.dumps(selected_ids),
        assembled_prompt=primary_prompt if needs_neurons else None,
        classify_input_tokens=classify_result["input_tokens"],
        classify_output_tokens=classify_result["output_tokens"],
        run_neuron=needs_neurons,
        run_opus=any(s["mode"] == "opus_raw" for s in slot_specs),
    )


def _build_slot_system_prompt(mode: str, neuron_prompt: str) -> tuple[str, int]:
    assert mode in MODEL_MAP, f"Unknown mode: {mode}"
    model = MODEL_MAP.get(mode)
    is_sonnet = model == "sonnet"
    if mode in NEURON_MODES:
        prompt = (SONNET_EFFICIENCY_PREFIX + neuron_prompt) if is_sonnet else neuron_prompt
        return prompt, 2048
    raw = (SONNET_EFFICIENCY_PREFIX + RAW_BASELINE_PROMPT) if is_sonnet else RAW_BASELINE_PROMPT
    return raw, 4096


def _format_slot_result(spec: dict, result: dict) -> dict:
    assert "mode" in spec, "spec must contain 'mode'"
    assert "text" in result, "result must contain 'text'"
    mode = spec["mode"]
    budget = spec.get("token_budget", settings.token_budget)
    slot_top_k = spec.get("top_k", settings.top_k_neurons)
    return {
        "mode": mode,
        "model": MODEL_MAP.get(mode) or "opus",
        "neurons": mode in NEURON_MODES,
        "response": result["text"],
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
        "cost_usd": result["cost_usd"],
        "duration_ms": result.get("duration_ms", 0),
        "token_budget": budget if mode in NEURON_MODES else None,
        "top_k": slot_top_k if mode in NEURON_MODES else None,
        "label": spec.get("label"),
        "model_version": result.get("model_version"),
    }


async def _execute_and_collect_slots(
    slot_specs: list[dict],
    user_message: str,
    prompt_cache: dict[tuple[int, int], str],
    intent: str,
    all_scored: list[NeuronScoreBreakdown],
    neuron_map: dict[int, Neuron],
    on_stage: StageCallback,
) -> list[dict]:
    assert len(slot_specs) > 0, "slot_specs must be non-empty"

    async def _timed_chat(*args, **kwargs):
        t0 = time.monotonic()
        result = await claude_chat(*args, **kwargs)
        result["duration_ms"] = round((time.monotonic() - t0) * 1000)
        return result

    tasks: list[asyncio.Task] = []
    for spec in slot_specs:
        mode = spec["mode"]
        budget = spec.get("token_budget", settings.token_budget)
        slot_top_k = spec.get("top_k", settings.top_k_neurons)
        model = MODEL_MAP.get(mode)
        if mode in NEURON_MODES:
            neuron_prompt = _get_cached_prompt(prompt_cache, budget, slot_top_k, intent, all_scored, neuron_map)
        else:
            neuron_prompt = ""
        prompt, max_tokens = _build_slot_system_prompt(mode, neuron_prompt)
        tasks.append(asyncio.create_task(
            _timed_chat(prompt, user_message, max_tokens=max_tokens, model=model)
        ))

    slot_results: list[dict | None] = [None] * len(slot_specs)

    async def _collect_slot(i: int, spec: dict, task: asyncio.Task):
        result = await task
        slot_results[i] = _format_slot_result(spec, result)
        if on_stage:
            await on_stage("execute_llm", {"status": "done", "detail": {
                "slot_index": i, "mode": spec["mode"],
                "model": MODEL_MAP.get(spec["mode"]) or "opus",
                "duration_ms": result.get("duration_ms", 0),
            }})

    collect_tasks = [
        asyncio.create_task(_collect_slot(i, spec, tasks[i]))
        for i, spec in enumerate(slot_specs)
    ]
    await asyncio.gather(*collect_tasks)
    assert all(s is not None for s in slot_results), "All slot results must be populated"
    return slot_results


def _populate_query_from_results(
    query: Query,
    slot_results: list[dict],
    all_scored: list[NeuronScoreBreakdown],
    neuron_map: dict[int, Neuron],
    classify_result: dict,
) -> float:
    assert len(slot_results) > 0, "slot_results must be non-empty"
    query.results_json = json.dumps(slot_results)
    if all_scored:
        query.neuron_scores_json = json.dumps(
            _build_neuron_score_dicts(all_scored, neuron_map)
        )
    for slot in slot_results:
        if slot["mode"] == "haiku_neuron" and not query.response_text:
            query.response_text = slot["response"]
            query.execute_input_tokens = slot["input_tokens"]
            query.execute_output_tokens = slot["output_tokens"]
        elif slot["mode"] == "opus_raw" and not query.opus_response_text:
            query.opus_response_text = slot["response"]
            query.opus_input_tokens = slot["input_tokens"]
            query.opus_output_tokens = slot["output_tokens"]
    total_cost = sum(s["cost_usd"] for s in slot_results) + classify_result.get("cost_usd", 0)
    query.cost_usd = total_cost
    for slot in slot_results:
        mv = slot.get("model_version")
        if mv:
            query.model_version = mv
            break
    assert total_cost >= 0, f"total_cost must be non-negative, got {total_cost}"
    return total_cost


def _build_response(
    query: Query,
    ctx: PreparedContext | None,
    needs_neurons: bool,
    all_scored: list[NeuronScoreBreakdown],
    max_top_k: int,
    neuron_map: dict[int, Neuron],
    classify_result: dict,
    slot_results: list[dict],
    total_cost: float,
) -> dict:
    assert isinstance(slot_results, list) and len(slot_results) > 0, \
        "slot_results must be non-empty"
    assert total_cost >= 0, f"total_cost must be non-negative, got {total_cost}"
    return {
        "query_id": query.id,
        "intent": ctx.intent if needs_neurons and ctx else None,
        "departments": ctx.departments if ctx else [],
        "role_keys": ctx.role_keys if ctx else [],
        "keywords": ctx.keywords if ctx else [],
        "neurons_activated": min(len(all_scored), max_top_k),
        "neurons_candidates": len(all_scored),
        "neuron_scores": _build_neuron_score_dicts(all_scored, neuron_map),
        "classify_cost": classify_result.get("cost_usd", 0),
        "classify_input_tokens": classify_result["input_tokens"],
        "classify_output_tokens": classify_result["output_tokens"],
        "slots": slot_results,
        "total_cost": total_cost,
    }


async def _update_counters_and_fire(
    db: AsyncSession,
    query: Query,
    slot_results: list[dict],
    classify_result: dict,
    needs_neurons: bool,
    all_scored: list[NeuronScoreBreakdown],
):
    assert isinstance(slot_results, list), "slot_results must be a list"
    assert isinstance(classify_result, dict), "classify_result must be a dict"
    state = await get_system_state(db)
    total_tokens = classify_result["input_tokens"] + classify_result["output_tokens"]
    for slot in slot_results:
        total_tokens += slot["input_tokens"] + slot["output_tokens"]
    state.global_token_counter += total_tokens
    state.total_queries += 1

    if needs_neurons:
        for score in all_scored:
            await record_firing(db, score.neuron_id, query.id, state.global_token_counter, global_query_offset=state.total_queries)
            await propagate_activation(db, score.neuron_id, score.combined, query.id)
        cofire_neurons = [s for s in all_scored if s.combined >= settings.min_cofire_score]
        cofire_ids = [s.neuron_id for s in cofire_neurons]
        if len(cofire_ids) >= 2:
            await _batch_update_edges(db, cofire_ids, state.total_queries)
        from app.services.concept_service import cofire_concept_neurons
        await cofire_concept_neurons(db, cofire_ids, state.total_queries)

    await db.commit()


async def execute_query(
    db: AsyncSession,
    user_message: str,
    modes: list[str],
    token_budget: int | None = None,
    slots_v2: list[dict] | None = None,
    on_stage: StageCallback = None,
) -> dict:
    """Run the pipeline for all requested slots.

    Supports two calling conventions:
    - Legacy: modes=["haiku_neuron", "opus_raw"], token_budget=4000
    - v2: slots_v2=[{mode, token_budget, top_k, label}, ...]

    Classification and scoring happen once (with max top_k).
    Assembly happens per (budget, top_k) pair.
    """
    slot_specs = _normalize_slot_specs(modes, token_budget, slots_v2)
    needs_neurons = any(s["mode"] in NEURON_MODES for s in slot_specs)
    max_top_k = _compute_neuron_slot_max(slot_specs, "top_k", settings.top_k_neurons)
    max_candidate_pool = _compute_neuron_slot_max(slot_specs, "candidate_pool", settings.semantic_prefilter_top_n)

    ctx, classify_result = await _run_neuron_pipeline(
        db, user_message, slot_specs, max_top_k, max_candidate_pool, on_stage,
    )
    intent = ctx.intent if ctx else "general_query"
    all_scored = ctx.all_scored if ctx else []
    neuron_map = ctx.neuron_map if ctx else {}
    max_top_k = ctx.neurons_activated if ctx else max_top_k

    prompt_cache: dict[tuple[int, int], str] = {}
    primary_budget = _compute_neuron_slot_max(slot_specs, "token_budget", settings.token_budget)
    primary_top_k = _compute_neuron_slot_max(slot_specs, "top_k", settings.top_k_neurons)
    primary_prompt = _get_cached_prompt(
        prompt_cache, primary_budget, primary_top_k, intent, all_scored, neuron_map,
    ) if needs_neurons else ""

    query = _create_query_record(user_message, ctx, needs_neurons, slot_specs, primary_prompt, classify_result)
    db.add(query)
    await db.flush()

    slot_results = await _execute_and_collect_slots(
        slot_specs, user_message, prompt_cache, intent, all_scored, neuron_map, on_stage,
    )
    total_cost = _populate_query_from_results(query, slot_results, all_scored, neuron_map, classify_result)
    await _update_counters_and_fire(db, query, slot_results, classify_result, needs_neurons, all_scored)

    # Postconditions (JPL Power of Ten Rule 5)
    assert all(s is not None for s in slot_results), \
        "All slot results must be populated after execution"
    assert total_cost >= 0, f"total_cost must be non-negative, got {total_cost}"

    return _build_response(
        query, ctx, needs_neurons, all_scored, max_top_k,
        neuron_map, classify_result, slot_results, total_cost,
    )


async def _load_candidates_by_ids(
    db: AsyncSession,
    neuron_ids: list[int],
    keywords: list[str],
) -> list[NeuronCandidate]:
    """Load lightweight NeuronCandidate objects for a set of neuron IDs.

    Used when the semantic prefilter has already selected the candidate set,
    so we just need to hydrate the scoring-relevant fields.
    """
    # Preconditions (JPL Power of Ten Rule 5)
    assert all(isinstance(nid, int) and nid > 0 for nid in neuron_ids), \
        "All neuron_ids must be positive integers"

    if not neuron_ids:
        return []

    from sqlalchemy import text

    # Build keyword hit expression
    params: dict = {}
    kw_parts = []
    if keywords:
        for i, kw in enumerate(keywords):
            param_name = f"kw_{i}"
            params[param_name] = f"%{kw.lower()}%"
            kw_parts.append(
                f"(CASE WHEN lower(label) LIKE :{param_name} THEN 1 ELSE 0 END + "
                f"CASE WHEN lower(summary) LIKE :{param_name} THEN 1 ELSE 0 END)"
            )
    kw_expr = " + ".join(kw_parts) if kw_parts else "0"

    # Use ANY(ARRAY[...]) for asyncpg compatibility with large ID lists
    params["id_list"] = list(neuron_ids)
    sql = f"""
        SELECT id, label, summary, department, role_key, avg_utility,
               invocations, created_at_query_count, ({kw_expr}) AS keyword_hits
        FROM neurons
        WHERE id = ANY(:id_list) AND is_active = true
    """
    result = await db.execute(text(sql), params)
    rows = result.all()

    candidates = [
        NeuronCandidate(
            id=r[0], label=r[1], summary=r[2], department=r[3], role_key=r[4],
            avg_utility=r[5] or 0.5, invocations=r[6] or 0,
            created_at_query_count=r[7] or 0, keyword_hits=r[8] or 0,
        )
        for r in rows
    ]

    # Postcondition (JPL Power of Ten Rule 5)
    assert len(candidates) <= len(neuron_ids), \
        f"Output length ({len(candidates)}) must not exceed input length ({len(neuron_ids)})"

    return candidates


async def _batch_update_edges(db: AsyncSession, neuron_ids: list[int], query_offset: int):
    """Batch update co-firing edges for a set of neurons."""
    # Precondition (JPL Power of Ten Rule 5)
    assert len(neuron_ids) >= 2, \
        f"_batch_update_edges requires >= 2 neuron_ids, got {len(neuron_ids)}"

    from sqlalchemy import text

    pairs = [(min(a, b), max(a, b))
             for i, a in enumerate(neuron_ids)
             for b in neuron_ids[i + 1:]]

    # Batch insert new edges (ignore if already exist)
    for src, tgt in pairs:
        await db.execute(text(
            "INSERT INTO neuron_edges (source_id, target_id, co_fire_count, weight, last_updated_query, source, last_adjusted) "
            "VALUES (:src, :tgt, 0, 0.0, 0, 'organic', now()) "
            "ON CONFLICT (source_id, target_id) DO NOTHING"
        ), {"src": src, "tgt": tgt})

    # Batch update all pairs in one statement per pair
    for src, tgt in pairs:
        await db.execute(text(
            "UPDATE neuron_edges "
            "SET co_fire_count = co_fire_count + 1, "
            "    weight = LEAST(1.0, (co_fire_count + 1) / 20.0), "
            "    last_updated_query = :qoff, "
            "    source = CASE WHEN source = 'bootstrap' THEN 'organic' ELSE source END, "
            "    last_adjusted = now() "
            "WHERE source_id = :src AND target_id = :tgt"
        ), {"src": src, "tgt": tgt, "qoff": query_offset})
