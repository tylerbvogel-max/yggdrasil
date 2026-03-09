"""Admin endpoints: seed, reset, cost report, checkpoint, scoring health, health check, compliance audit."""

import asyncio
import json
import math
import os
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Neuron, Query, NeuronFiring, NeuronEdge, PropagationLog, IntentNeuronMap, SystemState, NeuronRefinement, EmergentQueue, SystemAlert, EvalScore, AutopilotRun
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


# ── Health Check: automated drift alerting + circuit breaker + quality monitoring ──

# Go/no-go thresholds (configurable)
CIRCUIT_BREAKER_THRESHOLDS = {
    "min_avg_eval_overall": 2.5,       # Below this → circuit breaker trips
    "min_avg_user_rating": 0.3,        # Below this → circuit breaker trips
    "max_zero_hit_pct": 0.40,          # >40% zero-hit queries → warning
    "drift_z_threshold": 2.0,          # Z-score threshold for drift alerts
    "eval_window": 20,                 # Number of recent queries to evaluate
}


@router.get("/health-check")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Production health check: drift detection, quality monitoring, circuit breaker.

    Runs the scoring drift computation, checks eval quality and user ratings,
    detects API model version changes, and persists alerts to system_alerts.
    Returns go/no-go status.
    """
    alerts_created: list[dict] = []
    window = CIRCUIT_BREAKER_THRESHOLDS["eval_window"]
    circuit_breaker_tripped = False
    reasons: list[str] = []

    # 1. Drift detection — reuse scoring-health logic
    drift_result = await scoring_health(db=db)
    if drift_result.get("status") == "ok" and drift_result.get("drift_alerts"):
        for da in drift_result["drift_alerts"]:
            # Check if we already have an unacknowledged alert for this signal
            existing = await db.execute(
                select(SystemAlert).where(
                    SystemAlert.alert_type == "drift",
                    SystemAlert.signal == da["signal"],
                    SystemAlert.acknowledged == False,
                )
            )
            if not existing.scalar_one_or_none():
                alert = SystemAlert(
                    alert_type="drift",
                    severity="warning",
                    signal=da["signal"],
                    message=da["message"],
                    detail_json=json.dumps(da),
                )
                db.add(alert)
                alerts_created.append({"type": "drift", "signal": da["signal"], "message": da["message"]})

    # 2. Quality check — recent eval scores
    eval_result = await db.execute(
        select(EvalScore.overall)
        .order_by(EvalScore.id.desc())
        .limit(int(window))
    )
    eval_scores = [row[0] for row in eval_result.all()]
    avg_eval = sum(eval_scores) / len(eval_scores) if eval_scores else None

    if avg_eval is not None and avg_eval < CIRCUIT_BREAKER_THRESHOLDS["min_avg_eval_overall"]:
        circuit_breaker_tripped = True
        reasons.append(f"avg eval overall {avg_eval:.2f} < {CIRCUIT_BREAKER_THRESHOLDS['min_avg_eval_overall']}")
        existing = await db.execute(
            select(SystemAlert).where(
                SystemAlert.alert_type == "quality_drop",
                SystemAlert.acknowledged == False,
            )
        )
        if not existing.scalar_one_or_none():
            alert = SystemAlert(
                alert_type="quality_drop",
                severity="critical",
                message=f"Average eval overall dropped to {avg_eval:.2f} (threshold: {CIRCUIT_BREAKER_THRESHOLDS['min_avg_eval_overall']})",
                detail_json=json.dumps({"avg_eval": avg_eval, "window": len(eval_scores)}),
            )
            db.add(alert)
            alerts_created.append({"type": "quality_drop", "message": alert.message})

    # 3. User rating check
    rating_result = await db.execute(
        select(Query.user_rating)
        .where(Query.user_rating.isnot(None))
        .order_by(Query.id.desc())
        .limit(int(window))
    )
    ratings = [row[0] for row in rating_result.all()]
    avg_rating = sum(ratings) / len(ratings) if ratings else None

    if avg_rating is not None and avg_rating < CIRCUIT_BREAKER_THRESHOLDS["min_avg_user_rating"]:
        circuit_breaker_tripped = True
        reasons.append(f"avg user rating {avg_rating:.2f} < {CIRCUIT_BREAKER_THRESHOLDS['min_avg_user_rating']}")

    # 4. Zero-hit query detection
    recent_queries = await db.execute(
        select(Query.selected_neuron_ids)
        .order_by(Query.id.desc())
        .limit(int(window))
    )
    rows = recent_queries.all()
    if rows:
        zero_hits = sum(1 for (ids,) in rows if not ids or ids == "[]")
        zero_pct = zero_hits / len(rows)
        if zero_pct > CIRCUIT_BREAKER_THRESHOLDS["max_zero_hit_pct"]:
            reasons.append(f"zero-hit rate {zero_pct:.0%} > {CIRCUIT_BREAKER_THRESHOLDS['max_zero_hit_pct']:.0%}")

    # 5. API model version change detection
    version_result = await db.execute(
        select(Query.model_version)
        .where(Query.model_version.isnot(None))
        .order_by(Query.id.desc())
        .limit(int(window))
    )
    versions = [row[0] for row in version_result.all()]
    unique_versions = list(set(versions)) if versions else []
    model_version_changed = len(unique_versions) > 1

    if model_version_changed:
        existing = await db.execute(
            select(SystemAlert).where(
                SystemAlert.alert_type == "api_change",
                SystemAlert.acknowledged == False,
            )
        )
        if not existing.scalar_one_or_none():
            alert = SystemAlert(
                alert_type="api_change",
                severity="info",
                message=f"Multiple model versions detected in recent queries: {', '.join(unique_versions)}",
                detail_json=json.dumps({"versions": unique_versions}),
            )
            db.add(alert)
            alerts_created.append({"type": "api_change", "message": alert.message})

    # 6. Circuit breaker alert
    if circuit_breaker_tripped:
        existing = await db.execute(
            select(SystemAlert).where(
                SystemAlert.alert_type == "circuit_breaker",
                SystemAlert.acknowledged == False,
            )
        )
        if not existing.scalar_one_or_none():
            alert = SystemAlert(
                alert_type="circuit_breaker",
                severity="critical",
                message=f"Circuit breaker tripped: {'; '.join(reasons)}",
                detail_json=json.dumps({"reasons": reasons}),
            )
            db.add(alert)
            alerts_created.append({"type": "circuit_breaker", "message": alert.message})

    await db.commit()

    # Fetch all active (unacknowledged) alerts
    active_alerts_result = await db.execute(
        select(SystemAlert)
        .where(SystemAlert.acknowledged == False)
        .order_by(SystemAlert.created_at.desc())
    )
    active_alerts = [
        {
            "id": a.id,
            "type": a.alert_type,
            "severity": a.severity,
            "signal": a.signal,
            "message": a.message,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in active_alerts_result.scalars().all()
    ]

    return {
        "status": "tripped" if circuit_breaker_tripped else "ok",
        "circuit_breaker_tripped": circuit_breaker_tripped,
        "reasons": reasons,
        "avg_eval_overall": round(avg_eval, 3) if avg_eval is not None else None,
        "avg_user_rating": round(avg_rating, 3) if avg_rating is not None else None,
        "eval_count": len(eval_scores),
        "rating_count": len(ratings),
        "model_versions": unique_versions,
        "model_version_changed": model_version_changed,
        "drift_alerts_count": len(drift_result.get("drift_alerts", [])),
        "active_alerts": active_alerts,
        "new_alerts": alerts_created,
        "thresholds": CIRCUIT_BREAKER_THRESHOLDS,
    }


@router.get("/alerts")
async def get_alerts(
    include_acknowledged: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get system alerts, optionally including acknowledged ones."""
    q = select(SystemAlert).order_by(SystemAlert.created_at.desc())
    if not include_acknowledged:
        q = q.where(SystemAlert.acknowledged == False)
    result = await db.execute(q.limit(100))
    return [
        {
            "id": a.id,
            "type": a.alert_type,
            "severity": a.severity,
            "signal": a.signal,
            "message": a.message,
            "detail": json.loads(a.detail_json) if a.detail_json else None,
            "acknowledged": a.acknowledged,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in result.scalars().all()
    ]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Acknowledge (dismiss) a system alert."""
    alert = await db.get(SystemAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    await db.commit()
    return {"status": "acknowledged", "alert_id": alert_id}


@router.post("/alerts/acknowledge-all")
async def acknowledge_all_alerts(db: AsyncSession = Depends(get_db)):
    """Acknowledge all active alerts."""
    result = await db.execute(
        select(SystemAlert).where(SystemAlert.acknowledged == False)
    )
    count = 0
    for alert in result.scalars().all():
        alert.acknowledged = True
        alert.acknowledged_at = datetime.utcnow()
        count += 1
    await db.commit()
    return {"status": "acknowledged", "count": count}


# ── Compliance Audit: PII scan, bias assessment, scoring baselines, provenance audit ──

# PII patterns for neuron content scanning.
# Aerospace content has FAR/DFARS clause numbers (e.g. 52.246-2, 252.204-7012)
# and example/placeholder emails in technical neurons — these are excluded.
_DFARS_PATTERN = re.compile(r"\b\d{2,3}\.\d{3}-\d{4}\b")  # matches 52.246-2102, 252.204-7012
_EXAMPLE_EMAIL = re.compile(r"@(example|placeholder|test|acme)\.", re.I)
_PII_PATTERNS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "SSN"),  # SSN requires dashes (123-45-6789)
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "email"),
    (re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"), "credit_card"),
    (re.compile(r"(?<!\d\.)\b\d{3}[-\s]\d{3}[-\s]\d{4}\b"), "phone"),  # phone, not preceded by digit.
]


def _is_false_positive(text: str, match_str: str, pii_type: str) -> bool:
    """Filter out known false positives in aerospace content."""
    if pii_type == "phone" and _DFARS_PATTERN.search(match_str):
        return True
    if pii_type == "phone":
        # Check if this match is part of a DFARS/FAR clause number
        idx = text.find(match_str)
        if idx > 0 and text[idx - 1] == '.':
            return True  # preceded by dot = clause number like 252.204-7012
    if pii_type == "email" and _EXAMPLE_EMAIL.search(match_str):
        return True
    return False


@router.get("/compliance-audit")
async def compliance_audit(db: AsyncSession = Depends(get_db)):
    """Comprehensive compliance audit covering MET-1 through MET-5, A007.

    Returns:
    - pii_scan: PII detected in neuron content/summary fields
    - bias_assessment: department coverage stats, eval score disaggregation
    - scoring_baselines: per-signal distribution baselines with percentiles
    - provenance_audit: source_type coverage, missing citations, stale neurons
    """

    result = await db.execute(select(Neuron).where(Neuron.is_active == True))
    neurons = result.scalars().all()
    total_neurons = len(neurons)

    # ── 1. PII Scan (MET-3) ──
    pii_findings: list[dict] = []
    for neuron in neurons:
        for field_name, text_val in [("content", neuron.content), ("summary", neuron.summary), ("label", neuron.label)]:
            if not text_val:
                continue
            for pattern, pii_type in _PII_PATTERNS:
                matches = pattern.findall(text_val)
                # Filter out false positives (DFARS clauses, example emails)
                real_matches = [m for m in matches if not _is_false_positive(text_val, m, pii_type)]
                if real_matches:
                    pii_findings.append({
                        "neuron_id": neuron.id,
                        "neuron_label": neuron.label[:80],
                        "department": neuron.department,
                        "field": field_name,
                        "pii_type": pii_type,
                        "match_count": len(real_matches),
                        "excerpt": real_matches[0][:20] + "..." if len(real_matches[0]) > 20 else real_matches[0],
                    })

    # ── 2. Bias / Coverage Assessment (MET-4) ──
    dept_counts: dict[str, int] = {}
    dept_invocations: dict[str, int] = {}
    dept_utility: dict[str, list[float]] = {}
    layer_counts: dict[int, int] = {}
    source_type_counts: dict[str, int] = {}

    for neuron in neurons:
        dept = neuron.department or "(none)"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
        dept_invocations[dept] = dept_invocations.get(dept, 0) + neuron.invocations
        dept_utility.setdefault(dept, []).append(neuron.avg_utility)
        layer_counts[neuron.layer] = layer_counts.get(neuron.layer, 0) + 1
        st = neuron.source_type or "unknown"
        source_type_counts[st] = source_type_counts.get(st, 0) + 1

    # Coverage imbalance: coefficient of variation
    dept_values = list(dept_counts.values())
    dept_mean = sum(dept_values) / len(dept_values) if dept_values else 0
    dept_variance = sum((v - dept_mean) ** 2 for v in dept_values) / max(1, len(dept_values) - 1) if len(dept_values) > 1 else 0
    dept_cv = math.sqrt(dept_variance) / dept_mean if dept_mean > 0 else 0

    # Eval score disaggregation by answer_mode
    eval_by_mode = await db.execute(
        select(
            EvalScore.answer_mode,
            func.count(EvalScore.id),
            func.avg(EvalScore.accuracy),
            func.avg(EvalScore.completeness),
            func.avg(EvalScore.clarity),
            func.avg(EvalScore.faithfulness),
            func.avg(EvalScore.overall),
        ).group_by(EvalScore.answer_mode)
    )
    eval_disaggregation = [
        {
            "mode": row[0],
            "count": row[1],
            "avg_accuracy": round(float(row[2] or 0), 2),
            "avg_completeness": round(float(row[3] or 0), 2),
            "avg_clarity": round(float(row[4] or 0), 2),
            "avg_faithfulness": round(float(row[5] or 0), 2),
            "avg_overall": round(float(row[6] or 0), 2),
        }
        for row in eval_by_mode.all()
    ]

    # Department coverage detail
    dept_coverage = sorted([
        {
            "department": dept,
            "neuron_count": count,
            "pct_of_total": round(count / total_neurons * 100, 1) if total_neurons else 0,
            "total_invocations": dept_invocations.get(dept, 0),
            "avg_utility": round(sum(dept_utility.get(dept, [0.5])) / len(dept_utility.get(dept, [0.5])), 3),
        }
        for dept, count in dept_counts.items()
    ], key=lambda x: -x["neuron_count"])

    # ── 3. Scoring Baselines (MET-1) ──
    SIGNALS = ["burst", "impact", "precision", "novelty", "recency", "relevance"]

    scores_result = await db.execute(
        select(Query.neuron_scores_json)
        .where(Query.neuron_scores_json.isnot(None))
        .order_by(Query.id.desc())
        .limit(200)
    )
    all_signal_values: dict[str, list[float]] = {s: [] for s in SIGNALS}
    queries_parsed = 0
    for (scores_json,) in scores_result.all():
        try:
            scores = json.loads(scores_json) if scores_json else []
        except json.JSONDecodeError:
            continue
        if not scores:
            continue
        queries_parsed += 1
        for ns in scores:
            for s in SIGNALS:
                val = ns.get(s)
                if val is not None:
                    all_signal_values[s].append(float(val))

    def _percentile(vals: list[float], p: float) -> float:
        if not vals:
            return 0.0
        sorted_vals = sorted(vals)
        k = (len(sorted_vals) - 1) * (p / 100)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_vals[int(k)]
        return sorted_vals[f] * (c - k) + sorted_vals[c] * (k - f)

    scoring_baselines: dict[str, dict] = {}
    for sig in SIGNALS:
        vals = all_signal_values[sig]
        n = len(vals)
        if n == 0:
            scoring_baselines[sig] = {"count": 0, "mean": 0, "stddev": 0, "min": 0, "max": 0, "p25": 0, "p50": 0, "p75": 0, "p95": 0}
            continue
        mean = sum(vals) / n
        variance = sum((v - mean) ** 2 for v in vals) / max(1, n - 1)
        scoring_baselines[sig] = {
            "count": n,
            "mean": round(mean, 4),
            "stddev": round(math.sqrt(variance), 4),
            "min": round(min(vals), 4),
            "max": round(max(vals), 4),
            "p25": round(_percentile(vals, 25), 4),
            "p50": round(_percentile(vals, 50), 4),
            "p75": round(_percentile(vals, 75), 4),
            "p95": round(_percentile(vals, 95), 4),
        }

    # ── 4. Provenance Audit (A007) ──
    missing_citation = []
    missing_source_url = []
    stale_neurons = []  # regulatory/technical neurons with no last_verified
    now = datetime.utcnow()

    for neuron in neurons:
        is_primary = neuron.source_type in ("regulatory_primary", "technical_primary")

        if is_primary and not neuron.citation:
            missing_citation.append({
                "neuron_id": neuron.id,
                "label": neuron.label[:80],
                "department": neuron.department,
                "source_type": neuron.source_type,
            })

        if is_primary and not neuron.source_url:
            missing_source_url.append({
                "neuron_id": neuron.id,
                "label": neuron.label[:80],
                "department": neuron.department,
                "source_type": neuron.source_type,
            })

        if is_primary and neuron.last_verified:
            days_since = (now - neuron.last_verified).days
            if days_since > 365:
                stale_neurons.append({
                    "neuron_id": neuron.id,
                    "label": neuron.label[:80],
                    "department": neuron.department,
                    "source_type": neuron.source_type,
                    "last_verified": neuron.last_verified.isoformat(),
                    "days_since_verified": days_since,
                })

    return {  # compliance-audit response
        "total_neurons": total_neurons,
        "pii_scan": {
            "findings": pii_findings,
            "total_findings": len(pii_findings),
            "neurons_with_pii": len(set(f["neuron_id"] for f in pii_findings)),
            "clean": len(pii_findings) == 0,
        },
        "bias_assessment": {
            "department_coverage": dept_coverage,
            "department_count": len(dept_counts),
            "coverage_cv": round(dept_cv, 3),
            "coverage_imbalanced": dept_cv > 0.5,
            "layer_distribution": {f"L{k}": v for k, v in sorted(layer_counts.items())},
            "eval_disaggregation": eval_disaggregation,
        },
        "scoring_baselines": {
            "queries_analyzed": queries_parsed,
            "signals": scoring_baselines,
            "metric_rationale": {
                "burst": "Recency-weighted firing frequency. Higher = neuron is trending. Prevents stale content from dominating.",
                "impact": "EMA of user feedback ratings. Reflects demonstrated usefulness in past queries.",
                "precision": "Keyword overlap between query and neuron content. Direct relevance signal.",
                "novelty": "Inverse of invocation frequency. Promotes under-used neurons to prevent echo chambers.",
                "recency": "Temporal decay since last firing. Newer content gets a natural boost.",
                "relevance": "LLM-assessed semantic similarity (when available). Highest-fidelity signal but most expensive.",
            },
        },
        "provenance_audit": {
            "source_type_distribution": source_type_counts,
            "missing_citations": missing_citation,
            "missing_citations_count": len(missing_citation),
            "missing_source_urls": missing_source_url,
            "missing_source_urls_count": len(missing_source_url),
            "stale_neurons": stale_neurons,
            "stale_neurons_count": len(stale_neurons),
        },
    }


# ── Governance Dashboard: live metrics for AI objectives, change log, system health ──

@router.get("/governance-dashboard")
async def governance_dashboard(db: AsyncSession = Depends(get_db)):
    """Aggregate live governance metrics: AI objectives progress, change activity, quality trends.

    Feeds the Governance page with computed KPI status against defined targets.
    """
    # ── Total counts ──
    total_neurons = (await db.execute(select(func.count(Neuron.id)).where(Neuron.is_active == True))).scalar() or 0
    total_queries = (await db.execute(select(func.count(Query.id)))).scalar() or 0
    total_evals = (await db.execute(select(func.count(EvalScore.id)))).scalar() or 0
    total_refinements = (await db.execute(select(func.count(NeuronRefinement.id)))).scalar() or 0

    # ── Quality KPIs ──
    # Avg eval overall (all time)
    avg_eval = (await db.execute(select(func.avg(EvalScore.overall)))).scalar()
    avg_eval = round(float(avg_eval), 2) if avg_eval else None

    # Avg faithfulness (hallucination prevention)
    avg_faith = (await db.execute(select(func.avg(EvalScore.faithfulness)))).scalar()
    avg_faith = round(float(avg_faith), 2) if avg_faith else None

    # Avg user rating
    avg_rating_result = await db.execute(
        select(func.avg(Query.user_rating)).where(Query.user_rating.isnot(None))
    )
    avg_rating = avg_rating_result.scalar()
    avg_rating = round(float(avg_rating), 2) if avg_rating else None
    rated_count = (await db.execute(
        select(func.count(Query.id)).where(Query.user_rating.isnot(None))
    )).scalar() or 0

    # ── Cost KPIs (two views: total training cost vs production-only run cost) ──
    total_cost = (await db.execute(select(func.sum(Query.cost_usd)))).scalar() or 0.0
    avg_cost = round(total_cost / total_queries, 6) if total_queries > 0 else 0.0
    total_tokens_result = await db.execute(select(
        func.sum(Query.classify_input_tokens + Query.execute_input_tokens
                 + Query.classify_output_tokens + Query.execute_output_tokens)
    ))
    total_tokens = total_tokens_result.scalar() or 0
    cost_per_1m = round(total_cost / total_tokens * 1_000_000, 2) if total_tokens > 0 else None

    # Slot-level cost breakdown by tier
    slot_cost_result = await db.execute(text("""
        SELECT
            SUM(CASE WHEN (slot->>'mode') LIKE '%opus%' THEN (slot->>'cost_usd')::float ELSE 0 END) as opus_cost,
            SUM(CASE WHEN (slot->>'mode') LIKE '%opus%'
                THEN (slot->>'input_tokens')::float + (slot->>'output_tokens')::float ELSE 0 END) as opus_tokens,
            SUM(CASE WHEN (slot->>'mode') NOT LIKE '%opus%' THEN (slot->>'cost_usd')::float ELSE 0 END) as run_slot_cost,
            SUM(CASE WHEN (slot->>'mode') NOT LIKE '%opus%'
                THEN (slot->>'input_tokens')::float + (slot->>'output_tokens')::float ELSE 0 END) as run_slot_tokens
        FROM queries, jsonb_array_elements(queries.results_json::jsonb) AS slot
        WHERE queries.results_json IS NOT NULL
    """))
    opus_cost_total, opus_token_total, run_slot_cost, run_slot_tokens = slot_cost_result.one()

    # Opus benchmark: cost per 1M tokens for opus-tier slots only
    opus_cost_1m = round(float(opus_cost_total) / float(opus_token_total) * 1_000_000, 2) if opus_token_total and opus_token_total > 0 else None

    # Run cost: haiku/sonnet slots + classify overhead (always Haiku, always needed in production)
    classify_cost_result = await db.execute(text("""
        SELECT COALESCE(SUM(classify_input_tokens + classify_output_tokens), 0)
        FROM queries
    """))
    classify_tokens = float(classify_cost_result.scalar() or 0)
    # Classify is always Haiku — estimate cost at Haiku rate ($0.25/1M in, $1.25/1M out)
    # Use a blended classify rate: total classify cost / total classify tokens
    classify_cost_est_result = await db.execute(text("""
        SELECT COALESCE(SUM(
            classify_input_tokens * 0.25 / 1000000.0 +
            classify_output_tokens * 1.25 / 1000000.0
        ), 0)
        FROM queries
    """))
    classify_cost_est = float(classify_cost_est_result.scalar() or 0)

    run_total_cost = (run_slot_cost or 0) + classify_cost_est
    run_total_tokens = (run_slot_tokens or 0) + classify_tokens
    run_cost_per_1m = round(run_total_cost / run_total_tokens * 1_000_000, 2) if run_total_tokens > 0 else None

    # ── Synthesized KPIs: Parity Index & Value Score ──
    # Parity Index = avg neuron eval / avg opus eval (quality parity)
    # Value Score = (neuron_eval / 5) / (run_cost / opus_cost) (quality-per-dollar in production)
    opus_eval_result = await db.execute(
        select(func.avg(EvalScore.overall))
        .where(EvalScore.answer_mode.like("opus_%"))
    )
    avg_opus_eval = opus_eval_result.scalar()

    neuron_eval_result = await db.execute(
        select(func.avg(EvalScore.overall))
        .where(EvalScore.answer_mode.like("%_neuron"))
    )
    avg_neuron_eval = neuron_eval_result.scalar()

    parity_index = round(float(avg_neuron_eval) / float(avg_opus_eval), 3) if avg_neuron_eval and avg_opus_eval else None
    value_score = None
    if avg_neuron_eval and run_cost_per_1m and opus_cost_1m and opus_cost_1m > 0:
        value_score = round((float(avg_neuron_eval) / 5.0) / (run_cost_per_1m / opus_cost_1m), 2)

    # ── Coverage KPIs ──
    # Departments with neurons
    dept_count = (await db.execute(
        select(func.count(func.distinct(Neuron.department)))
        .where(Neuron.department.isnot(None), Neuron.is_active == True)
    )).scalar() or 0

    # Zero-hit rate (last 50 queries)
    recent_q = await db.execute(
        select(Query.selected_neuron_ids).order_by(Query.id.desc()).limit(50)
    )
    recent_rows = recent_q.all()
    zero_hits = sum(1 for (ids,) in recent_rows if not ids or ids == "[]") if recent_rows else 0
    zero_hit_pct = round(zero_hits / len(recent_rows) * 100, 1) if recent_rows else 0

    # ── Change activity (last 30 days) ──
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_refinements = (await db.execute(
        select(func.count(NeuronRefinement.id))
        .where(NeuronRefinement.created_at >= thirty_days_ago)
    )).scalar() or 0

    recent_autopilot = (await db.execute(
        select(func.count(AutopilotRun.id))
        .where(AutopilotRun.created_at >= thirty_days_ago)
    )).scalar() or 0

    # Recent change details (last 10)
    recent_changes_q = await db.execute(
        select(
            NeuronRefinement.id,
            NeuronRefinement.action,
            NeuronRefinement.field,
            NeuronRefinement.reason,
            NeuronRefinement.neuron_id,
            NeuronRefinement.created_at,
        )
        .order_by(NeuronRefinement.created_at.desc())
        .limit(10)
    )
    recent_changes = [
        {
            "id": r[0],
            "action": r[1],
            "field": r[2],
            "reason": (r[3] or "")[:120],
            "neuron_id": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
        }
        for r in recent_changes_q.all()
    ]

    # ── Active alerts ──
    active_alert_count = (await db.execute(
        select(func.count(SystemAlert.id)).where(SystemAlert.acknowledged == False)
    )).scalar() or 0

    return {
        "totals": {
            "neurons": total_neurons,
            "queries": total_queries,
            "evaluations": total_evals,
            "refinements": total_refinements,
            "departments": dept_count,
            "rated_queries": rated_count,
        },
        "kpis": {
            "avg_eval_overall": avg_eval,
            "avg_faithfulness": avg_faith,
            "avg_user_rating": avg_rating,
            "avg_cost_per_query": avg_cost,
            "total_cost_usd": round(total_cost, 4),
            "cost_per_1m_tokens": cost_per_1m,
            "run_cost_per_1m": run_cost_per_1m,
            "zero_hit_pct": zero_hit_pct,
            "parity_index": parity_index,
            "value_score": value_score,
            "avg_opus_eval": round(float(avg_opus_eval), 2) if avg_opus_eval else None,
            "avg_neuron_eval": round(float(avg_neuron_eval), 2) if avg_neuron_eval else None,
            "opus_cost_per_1m": round(opus_cost_1m, 2) if opus_cost_1m else None,
        },
        "change_activity": {
            "refinements_30d": recent_refinements,
            "autopilot_runs_30d": recent_autopilot,
            "recent_changes": recent_changes,
        },
        "active_alerts": active_alert_count,
    }
