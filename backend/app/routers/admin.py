"""Admin endpoints: seed, reset, cost report, checkpoint, scoring health."""

import asyncio
import json
import math
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Neuron, Query, NeuronFiring, NeuronEdge, PropagationLog, IntentNeuronMap, SystemState, NeuronRefinement, EmergentQueue
from app.schemas import (
    SeedResponse, ResetResponse, CostReportResponse, CheckpointResponse,
)
from app.seed.loader import load_seed

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


@router.get("/emergent-queue")
async def get_emergent_queue(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get emergent queue entries, optionally filtered by status."""
    stmt = select(EmergentQueue).order_by(EmergentQueue.detection_count.desc())
    if status:
        stmt = stmt.where(EmergentQueue.status == status)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    return {
        "total": len(entries),
        "entries": [
            {
                "id": e.id,
                "citation_pattern": e.citation_pattern,
                "domain": e.domain,
                "family": e.family,
                "detection_count": e.detection_count,
                "first_detected_at": e.first_detected_at.isoformat() if e.first_detected_at else None,
                "last_detected_at": e.last_detected_at.isoformat() if e.last_detected_at else None,
                "detected_in_neuron_ids": json.loads(e.detected_in_neuron_ids or "[]"),
                "detected_in_query_ids": json.loads(e.detected_in_query_ids or "[]"),
                "status": e.status,
                "resolved_neuron_id": e.resolved_neuron_id,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                "notes": e.notes,
            }
            for e in entries
        ],
    }


@router.post("/emergent-queue/{entry_id}/dismiss")
async def dismiss_queue_entry(
    entry_id: int,
    notes: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Dismiss an emergent queue entry with a reason."""
    entry = await db.get(EmergentQueue, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    entry.status = "dismissed"
    entry.notes = notes
    await db.commit()
    return {"status": "dismissed", "id": entry_id}


@router.post("/scan-references")
async def scan_references(db: AsyncSession = Depends(get_db)):
    """Retroactive scan: detect external references in all neurons and seed the emergent queue."""
    from app.services.reference_detector import detect_neuron_references

    result = await db.execute(select(Neuron).where(Neuron.is_active == True))
    neurons = result.scalars().all()

    neurons_scanned = 0
    neurons_with_refs = 0
    total_refs = 0
    resolved = 0
    unresolved = 0
    new_queue = 0
    incremented_queue = 0
    family_counts: dict[str, int] = {}

    # Build a lookup of existing citations -> neuron IDs for resolution
    citation_lookup: dict[str, int] = {}
    for n in neurons:
        if n.citation and n.source_type in ("regulatory_primary", "technical_primary"):
            citation_lookup[n.citation] = n.id

    for neuron in neurons:
        neurons_scanned += 1
        refs = detect_neuron_references(neuron.content, neuron.summary)
        if not refs:
            neuron.external_references = None
            continue

        neurons_with_refs += 1
        total_refs += len(refs)

        # Check resolution for each reference
        for ref in refs:
            # Try to match against known citations
            matched_id = None
            for cit, nid in citation_lookup.items():
                if ref["pattern"] in cit or cit in ref["pattern"]:
                    matched_id = nid
                    break

            if matched_id:
                ref["resolved_neuron_id"] = matched_id
                ref["resolved_at"] = datetime.now().isoformat()
                resolved += 1
            else:
                unresolved += 1
                family_counts[ref["family"]] = family_counts.get(ref["family"], 0) + 1

                # Check emergent queue
                existing = (await db.execute(
                    select(EmergentQueue).where(EmergentQueue.citation_pattern == ref["pattern"])
                )).scalar_one_or_none()

                if existing:
                    if existing.status != "resolved":
                        existing.detection_count += 1
                        existing.last_detected_at = datetime.now()
                        # Add neuron ID to tracking
                        ids = json.loads(existing.detected_in_neuron_ids or "[]")
                        if neuron.id not in ids:
                            ids.append(neuron.id)
                            existing.detected_in_neuron_ids = json.dumps(ids)
                        incremented_queue += 1
                else:
                    db.add(EmergentQueue(
                        citation_pattern=ref["pattern"],
                        domain=ref["domain"],
                        family=ref["family"],
                        detection_count=1,
                        detected_in_neuron_ids=json.dumps([neuron.id]),
                    ))
                    new_queue += 1

        neuron.external_references = json.dumps(refs)

    await db.commit()

    top_families = sorted(family_counts.items(), key=lambda x: -x[1])[:10]

    return {
        "neurons_scanned": neurons_scanned,
        "neurons_with_references": neurons_with_refs,
        "total_references_found": total_refs,
        "resolved": resolved,
        "unresolved": unresolved,
        "new_queue_entries": new_queue,
        "existing_queue_entries_incremented": incremented_queue,
        "top_unresolved_families": [
            {"family": f, "count": c} for f, c in top_families
        ],
    }


@router.post("/prune-edges")
async def prune_edges(db: AsyncSession = Depends(get_db)):
    """Prune stale low-weight co-firing edges to control graph density."""
    from app.config import settings

    # Count before
    before = (await db.execute(select(func.count()).select_from(NeuronEdge))).scalar() or 0

    # Get current query count for staleness check
    state = (await db.execute(select(SystemState).where(SystemState.id == 1))).scalar_one_or_none()
    total_queries = state.total_queries if state else 0
    stale_threshold = total_queries - settings.edge_prune_stale_queries

    # Delete edges that have fired only once and are stale
    await db.execute(text(
        "DELETE FROM neuron_edges "
        "WHERE co_fire_count < :min_cofires AND last_updated_query < :stale"
    ), {"min_cofires": settings.edge_prune_min_cofires, "stale": max(0, stale_threshold)})

    await db.commit()

    after = (await db.execute(select(func.count()).select_from(NeuronEdge))).scalar() or 0

    return {
        "status": "pruned",
        "edges_before": before,
        "edges_after": after,
        "edges_removed": before - after,
    }


@router.get("/scoring-health")
async def scoring_health(
    baseline_window: int = 50,
    recent_window: int = 20,
    drift_threshold: float = 2.0,
    db: AsyncSession = Depends(get_db),
):
    """Compute per-signal scoring distribution stats and detect drift.

    Compares the most recent `recent_window` queries against a trailing
    `baseline_window` (the queries just before the recent window).
    Drift is flagged when the recent mean deviates by more than
    `drift_threshold` standard deviations from the baseline mean.
    """
    SIGNALS = ["burst", "impact", "precision", "novelty", "recency", "relevance"]

    # Fetch queries that have neuron_scores_json, ordered newest-first
    needed = baseline_window + recent_window
    result = await db.execute(
        select(Query.id, Query.neuron_scores_json, Query.created_at)
        .where(Query.neuron_scores_json.isnot(None))
        .order_by(Query.id.desc())
        .limit(needed)
    )
    rows = result.all()

    if len(rows) < 5:
        return {
            "status": "insufficient_data",
            "queries_available": len(rows),
            "minimum_required": 5,
            "signals": {},
            "drift_alerts": [],
            "per_query_timeline": [],
        }

    # Parse scores: each query -> list of neuron score dicts
    query_scores: list[dict] = []  # [{query_id, created_at, signals: {signal: [values]}}]
    for qid, scores_json, created_at in rows:
        try:
            scores = json.loads(scores_json) if scores_json else []
        except json.JSONDecodeError:
            continue
        if not scores:
            continue
        signal_values: dict[str, list[float]] = {s: [] for s in SIGNALS}
        for neuron_score in scores:
            for s in SIGNALS:
                val = neuron_score.get(s)
                if val is not None:
                    signal_values[s].append(float(val))
        query_scores.append({
            "query_id": qid,
            "created_at": created_at.isoformat() if created_at else None,
            "signals": signal_values,
        })

    # Reverse to chronological order (oldest first)
    query_scores.reverse()
    total = len(query_scores)

    # Split into baseline and recent windows
    if total <= recent_window:
        # Not enough for a proper split — use all as baseline, no drift detection
        baseline_qs = query_scores
        recent_qs = query_scores
        can_detect_drift = False
    else:
        recent_qs = query_scores[-recent_window:]
        baseline_start = max(0, total - recent_window - baseline_window)
        baseline_qs = query_scores[baseline_start:total - recent_window]
        can_detect_drift = len(baseline_qs) >= 5

    def _stats(values: list[float]) -> dict:
        if not values:
            return {"mean": 0, "stddev": 0, "min": 0, "max": 0, "count": 0}
        n = len(values)
        mean = sum(values) / n
        variance = sum((v - mean) ** 2 for v in values) / max(1, n - 1)
        return {
            "mean": round(mean, 4),
            "stddev": round(math.sqrt(variance), 4),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
            "count": n,
        }

    def _aggregate_signal(queries: list[dict], signal: str) -> list[float]:
        """Collect all neuron-level values for a signal across queries."""
        vals: list[float] = []
        for q in queries:
            vals.extend(q["signals"].get(signal, []))
        return vals

    def _query_means(queries: list[dict], signal: str) -> list[float]:
        """Per-query mean for a signal."""
        means: list[float] = []
        for q in queries:
            vals = q["signals"].get(signal, [])
            if vals:
                means.append(sum(vals) / len(vals))
        return means

    # Build per-signal stats
    signals_report: dict = {}
    drift_alerts: list[dict] = []

    for sig in SIGNALS:
        baseline_vals = _aggregate_signal(baseline_qs, sig)
        recent_vals = _aggregate_signal(recent_qs, sig)
        baseline_means = _query_means(baseline_qs, sig)
        recent_means = _query_means(recent_qs, sig)

        b_stats = _stats(baseline_vals)
        r_stats = _stats(recent_vals)
        bm_stats = _stats(baseline_means)
        rm_stats = _stats(recent_means)

        # Drift detection: compare per-query means
        drifted = False
        z_score = 0.0
        if can_detect_drift and bm_stats["stddev"] > 0.001 and len(recent_means) >= 3:
            z_score = (rm_stats["mean"] - bm_stats["mean"]) / bm_stats["stddev"]
            drifted = abs(z_score) > drift_threshold

        signals_report[sig] = {
            "baseline": b_stats,
            "recent": r_stats,
            "baseline_query_means": bm_stats,
            "recent_query_means": rm_stats,
            "z_score": round(z_score, 3),
            "drifted": drifted,
        }

        if drifted:
            direction = "increased" if z_score > 0 else "decreased"
            drift_alerts.append({
                "signal": sig,
                "direction": direction,
                "z_score": round(z_score, 3),
                "baseline_mean": bm_stats["mean"],
                "recent_mean": rm_stats["mean"],
                "message": f"{sig} has {direction} significantly (z={z_score:.1f}): "
                           f"baseline μ={bm_stats['mean']:.3f} → recent μ={rm_stats['mean']:.3f}",
            })

    # Per-query timeline for charting (last 50 queries)
    timeline_qs = query_scores[-50:]
    per_query_timeline: list[dict] = []
    for q in timeline_qs:
        entry: dict = {"query_id": q["query_id"], "created_at": q["created_at"]}
        for sig in SIGNALS:
            vals = q["signals"].get(sig, [])
            entry[sig] = round(sum(vals) / len(vals), 4) if vals else 0
        per_query_timeline.append(entry)

    return {
        "status": "ok",
        "queries_analyzed": total,
        "baseline_window": len(baseline_qs),
        "recent_window": len(recent_qs),
        "can_detect_drift": can_detect_drift,
        "drift_threshold": drift_threshold,
        "signals": signals_report,
        "drift_alerts": drift_alerts,
        "per_query_timeline": per_query_timeline,
    }
