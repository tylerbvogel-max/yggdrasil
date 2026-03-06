"""Full pipeline orchestration: classify → score → assemble → execute → record."""

import asyncio
import json

from sqlalchemy.ext.asyncio import AsyncSession

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


# Each slot is a dict: {mode, model, neurons, response, input_tokens, output_tokens, cost_usd}
# Modes: "haiku_neuron", "haiku_raw", "sonnet_neuron", "sonnet_raw", "opus_raw"

MODEL_MAP = {
    "haiku_neuron": "haiku",
    "haiku_raw": "haiku",
    "sonnet_neuron": "sonnet",
    "sonnet_raw": "sonnet",
    "opus_neuron": None,  # default model (opus on personal sub)
    "opus_raw": None,  # default model (opus on personal sub)
}

NEURON_MODES = {"haiku_neuron", "sonnet_neuron", "opus_neuron"}

RAW_BASELINE_PROMPT = "I am an employee at an aerospace manufacturing and prototype design company."

SONNET_EFFICIENCY_PREFIX = "Be precise and concise. Prioritize accuracy over elaboration. Do not repeat the question or restate what is already known — lead with the answer.\n\n"


async def execute_query(
    db: AsyncSession,
    user_message: str,
    modes: list[str],
    token_budget: int | None = None,
    slots_v2: list[dict] | None = None,
) -> dict:
    """Run the pipeline for all requested slots.

    Supports two calling conventions:
    - Legacy: modes=["haiku_neuron", "opus_raw"], token_budget=4000
    - v2: slots_v2=[{mode, token_budget, top_k, label}, ...]

    Classification and scoring happen once (with max top_k).
    Assembly happens per (budget, top_k) pair.
    """

    # Normalize to slot list
    if slots_v2:
        slot_specs = slots_v2
    else:
        slot_specs = [{"mode": m, "token_budget": token_budget or settings.token_budget, "top_k": settings.top_k_neurons, "label": None} for m in modes]

    all_modes = [s["mode"] for s in slot_specs]
    needs_neurons = any(m in NEURON_MODES for m in all_modes)

    # Determine max top_k across all neuron slots (score once with the widest net)
    max_top_k = max(
        (s.get("top_k", settings.top_k_neurons) for s in slot_specs if s["mode"] in NEURON_MODES),
        default=settings.top_k_neurons,
    )

    # Stage 1: Classify + score (shared across all neuron slots)
    classify_result = {"classification": {}, "input_tokens": 0, "output_tokens": 0}
    intent = "general_query"
    departments: list[str] = []
    role_keys: list[str] = []
    keywords: list[str] = []
    all_scored = []  # Full scored list up to max_top_k
    neuron_map: dict[int, Neuron] = {}

    if needs_neurons:
        classify_result = await classify_query(user_message)
        classification = classify_result["classification"]
        intent = classification.get("intent", "general_query")
        departments = classification.get("departments", [])
        role_keys = classification.get("role_keys", [])
        keywords = classification.get("keywords", [])

        state = await get_system_state(db)
        candidates = await get_neurons_by_filter(db, departments, role_keys, keywords)
        if not candidates:
            candidates = await get_neurons_by_filter(db)
        scored = await score_candidates(db, candidates, state.total_queries, keywords, departments, role_keys)
        scored = await spread_activation(db, scored, max_top_k)
        all_scored = await apply_diversity_floor(db, scored, max_top_k)

        for s in all_scored:
            neuron = await db.get(Neuron, s.neuron_id)
            if neuron:
                neuron_map[s.neuron_id] = neuron

    # Stage 2: Assemble prompts per unique (budget, top_k) pair, then execute all slots
    # Cache assembled prompts to avoid redundant assembly
    prompt_cache: dict[tuple[int, int], str] = {}

    def get_prompt(budget: int, slot_top_k: int) -> str:
        key = (budget, slot_top_k)
        if key not in prompt_cache:
            # Slice the scored list to this slot's top_k
            slot_neurons = all_scored[:slot_top_k]
            prompt_cache[key] = assemble_prompt(intent, slot_neurons, neuron_map, budget_tokens=budget)
        return prompt_cache[key]

    # Store the primary prompt (highest budget among neuron slots, or default)
    primary_budget = max(
        (s["token_budget"] for s in slot_specs if s["mode"] in NEURON_MODES),
        default=settings.token_budget,
    )
    primary_top_k = max(
        (s.get("top_k", settings.top_k_neurons) for s in slot_specs if s["mode"] in NEURON_MODES),
        default=settings.top_k_neurons,
    )

    # Create query record (use all_scored for the record, since that's the full candidate set)
    selected_ids = [s.neuron_id for s in all_scored]
    primary_prompt = get_prompt(primary_budget, primary_top_k) if needs_neurons else ""
    query = Query(
        user_message=user_message,
        classified_intent=intent if needs_neurons else None,
        classified_departments=json.dumps(departments),
        classified_role_keys=json.dumps(role_keys),
        classified_keywords=json.dumps(keywords),
        selected_neuron_ids=json.dumps(selected_ids),
        assembled_prompt=primary_prompt if needs_neurons else None,
        classify_input_tokens=classify_result["input_tokens"],
        classify_output_tokens=classify_result["output_tokens"],
        run_neuron=needs_neurons,
        run_opus=any(s["mode"] == "opus_raw" for s in slot_specs),
    )
    db.add(query)
    await db.flush()

    # Launch all slots in parallel
    tasks: list[asyncio.Task] = []
    for i, spec in enumerate(slot_specs):
        mode = spec["mode"]
        budget = spec.get("token_budget", settings.token_budget)
        slot_top_k = spec.get("top_k", settings.top_k_neurons)
        model = MODEL_MAP.get(mode)
        is_sonnet = model == "sonnet"

        if mode in NEURON_MODES:
            sys_prompt = get_prompt(budget, slot_top_k)
            prompt = (SONNET_EFFICIENCY_PREFIX + sys_prompt) if is_sonnet else sys_prompt
            tasks.append(asyncio.create_task(
                claude_chat(prompt, user_message, max_tokens=2048, model=model)
            ))
        else:
            prompt = (SONNET_EFFICIENCY_PREFIX + RAW_BASELINE_PROMPT) if is_sonnet else RAW_BASELINE_PROMPT
            tasks.append(asyncio.create_task(
                claude_chat(prompt, user_message, max_tokens=4096, model=model)
            ))

    # Collect results
    slot_results = []
    for i, spec in enumerate(slot_specs):
        result = await tasks[i]
        mode = spec["mode"]
        budget = spec.get("token_budget", settings.token_budget)
        slot_top_k = spec.get("top_k", settings.top_k_neurons)
        slot_results.append({
            "mode": mode,
            "model": MODEL_MAP.get(mode) or "opus",
            "neurons": mode in NEURON_MODES,
            "response": result["text"],
            "input_tokens": result["input_tokens"],
            "output_tokens": result["output_tokens"],
            "cost_usd": result["cost_usd"],
            "token_budget": budget if mode in NEURON_MODES else None,
            "top_k": slot_top_k if mode in NEURON_MODES else None,
            "label": spec.get("label"),
        })

    query.results_json = json.dumps(slot_results)
    if all_scored:
        query.neuron_scores_json = json.dumps([
            {"neuron_id": s.neuron_id, "combined": s.combined, "burst": s.burst,
             "impact": s.impact, "precision": s.precision, "novelty": s.novelty,
             "recency": s.recency, "relevance": s.relevance, "spread_boost": s.spread_boost}
            for s in all_scored
        ])

    # Back-compat: populate legacy columns from first neuron and opus slots
    for slot in slot_results:
        if slot["mode"] == "haiku_neuron" and not query.response_text:
            query.response_text = slot["response"]
            query.execute_input_tokens = slot["input_tokens"]
            query.execute_output_tokens = slot["output_tokens"]
        elif slot["mode"] == "opus_raw" and not query.opus_response_text:
            query.opus_response_text = slot["response"]
            query.opus_input_tokens = slot["input_tokens"]
            query.opus_output_tokens = slot["output_tokens"]

    # Cost — sum of all slots + classify
    total_cost = sum(s["cost_usd"] for s in slot_results) + classify_result.get("cost_usd", 0)
    query.cost_usd = total_cost

    # Update global counters + fire neurons
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
        for i, s1 in enumerate(all_scored):
            for s2 in all_scored[i + 1:]:
                await _update_edge(db, s1.neuron_id, s2.neuron_id)

    await db.commit()

    # Build neuron scores for response
    neuron_scores = [
        {"neuron_id": s.neuron_id, "combined": s.combined, "burst": s.burst,
         "impact": s.impact, "precision": s.precision, "novelty": s.novelty, "recency": s.recency,
         "relevance": s.relevance, "spread_boost": s.spread_boost}
        for s in all_scored[:10]
    ]

    return {
        "query_id": query.id,
        "intent": intent if needs_neurons else None,
        "departments": departments,
        "role_keys": role_keys,
        "keywords": keywords,
        "neurons_activated": len(all_scored),
        "neuron_scores": neuron_scores,
        "classify_cost": classify_result.get("cost_usd", 0),
        "classify_input_tokens": classify_result["input_tokens"],
        "classify_output_tokens": classify_result["output_tokens"],
        "slots": slot_results,
        "total_cost": total_cost,
    }


async def _update_edge(db: AsyncSession, id_a: int, id_b: int):
    """Update co-firing edge between two neurons."""
    src, tgt = min(id_a, id_b), max(id_a, id_b)
    from sqlalchemy import select

    result = await db.execute(
        select(NeuronEdge).where(
            NeuronEdge.source_id == src, NeuronEdge.target_id == tgt
        )
    )
    edge = result.scalar_one_or_none()
    if edge:
        edge.co_fire_count += 1
        edge.weight = min(1.0, edge.co_fire_count / 20.0)
    else:
        db.add(NeuronEdge(source_id=src, target_id=tgt, co_fire_count=1, weight=0.05))
