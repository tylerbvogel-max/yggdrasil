"""Compliance suite API router — run suite, view results, manage attestations."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Query, Body
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, desc

from app.compliance.models import ComplianceSuiteRun, ComplianceProviderResult, ComplianceAttestation
from app.compliance.registry import registry
from app.compliance.runner import SuiteRunner
from app.compliance.report import generate_report
from app.database import async_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/compliance", tags=["compliance-suite"])


class RunSuiteRequest(BaseModel):
    framework: str | None = None
    provider_ids: list[str] | None = None


@router.post("/run-suite")
async def run_suite(
    framework: str | None = Query(None),
    body: RunSuiteRequest | None = Body(None),
):
    """Run the compliance suite and stream progress via SSE.

    Accepts optional framework filter via query param and optional
    provider_ids via JSON body to run only specific providers.
    """
    fw = body.framework if body and body.framework else framework
    pids = body.provider_ids if body else None
    queue: asyncio.Queue = asyncio.Queue()

    async def on_progress(msg: dict) -> None:
        await queue.put(msg)

    async def run_and_signal() -> None:
        try:
            runner = SuiteRunner()
            result = await runner.run(
                framework=fw, on_progress=on_progress,
                triggered_by="manual", provider_ids=pids,
            )
            await queue.put({"event": "result", "data": {
                "run_id": result.id,
                "passed": result.passed,
                "failed": result.failed,
                "skipped": result.skipped,
                "duration_ms": result.duration_ms,
            }})
        except Exception as e:
            logger.error("Suite run failed: %s", e, exc_info=True)
            await queue.put({"event": "error", "data": {"message": str(e)}})
        finally:
            await queue.put(None)  # sentinel

    async def event_stream():
        task = asyncio.create_task(run_and_signal())
        try:
            while True:
                msg = await queue.get()
                if msg is None:
                    break
                if "event" in msg:
                    event_type = msg["event"]
                    data = json.dumps(msg["data"])
                else:
                    event_type = "progress"
                    data = json.dumps(msg)
                yield f"event: {event_type}\ndata: {data}\n\n"
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/runs")
async def list_runs(limit: int = Query(50, le=200)):
    """List historical suite runs."""
    async with async_session() as db:
        result = await db.execute(
            select(ComplianceSuiteRun).order_by(desc(ComplianceSuiteRun.id)).limit(limit)
        )
        runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "framework_filter": r.framework_filter,
            "total_providers": r.total_providers,
            "passed": r.passed,
            "failed": r.failed,
            "skipped": r.skipped,
            "duration_ms": r.duration_ms,
            "triggered_by": r.triggered_by,
        }
        for r in runs
    ]


@router.get("/runs/{run_id}")
async def get_run(run_id: int):
    """Get run detail with all provider results."""
    async with async_session() as db:
        run = (await db.execute(
            select(ComplianceSuiteRun).where(ComplianceSuiteRun.id == run_id)
        )).scalar_one_or_none()
        if not run:
            return {"error": "Run not found"}, 404

        results = (await db.execute(
            select(ComplianceProviderResult).where(ComplianceProviderResult.run_id == run_id)
        )).scalars().all()

    return {
        "id": run.id,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "framework_filter": run.framework_filter,
        "total_providers": run.total_providers,
        "passed": run.passed,
        "failed": run.failed,
        "skipped": run.skipped,
        "duration_ms": run.duration_ms,
        "triggered_by": run.triggered_by,
        "results": [
            {
                "id": r.id,
                "provider_id": r.provider_id,
                "passed": r.passed,
                "detail": json.loads(r.detail) if r.detail else {},
                "duration_ms": r.duration_ms,
                "collected_at": r.collected_at.isoformat() if r.collected_at else None,
            }
            for r in results
        ],
    }


@router.get("/runs/{run_id}/report")
async def get_run_report(run_id: int, framework: str | None = Query(None)):
    """Generate and download HTML report for a suite run."""
    async with async_session() as db:
        run = (await db.execute(
            select(ComplianceSuiteRun).where(ComplianceSuiteRun.id == run_id)
        )).scalar_one_or_none()
        if not run:
            return HTMLResponse("<h1>Run not found</h1>", status_code=404)

        results = (await db.execute(
            select(ComplianceProviderResult).where(ComplianceProviderResult.run_id == run_id)
        )).scalars().all()

        attestations = (await db.execute(
            select(ComplianceAttestation).where(ComplianceAttestation.superseded_at.is_(None))
        )).scalars().all()

        # Get historical runs for trend
        historical = (await db.execute(
            select(ComplianceSuiteRun).order_by(desc(ComplianceSuiteRun.id)).limit(10)
        )).scalars().all()

    html = generate_report(run, results, registry, framework=framework, attestations=attestations, historical_runs=historical)
    return HTMLResponse(html)


@router.get("/controls")
async def list_controls(framework: str | None = Query(None)):
    """List all controls, optionally filtered by framework."""
    controls = registry.get_controls(framework)
    result = []
    for c in controls:
        providers = registry.get_providers_for_control(c.framework, c.control_id)
        evidence_types = sorted(set(p.evidence_type.value for p in providers))
        result.append({
            "framework": c.framework,
            "control_id": c.control_id,
            "title": c.title,
            "family": c.family,
            "description": c.description,
            "external_ref": c.external_ref,
            "provider_count": len(providers),
            "provider_ids": [p.id for p in providers],
            "evidence_types": evidence_types,
        })
    return result


@router.get("/controls/{framework}/{control_id}")
async def get_control_detail(framework: str, control_id: str):
    """Get control detail with provider mapping and result history."""
    controls = registry.get_controls(framework)
    ctrl = next((c for c in controls if c.control_id == control_id), None)
    if not ctrl:
        return {"error": "Control not found"}, 404

    providers = registry.get_providers_for_control(framework, control_id)

    # Get latest results for these providers
    provider_ids = [p.id for p in providers]
    history: list[dict] = []
    async with async_session() as db:
        if provider_ids:
            results = (await db.execute(
                select(ComplianceProviderResult)
                .where(ComplianceProviderResult.provider_id.in_(provider_ids))
                .order_by(desc(ComplianceProviderResult.collected_at))
                .limit(100)
            )).scalars().all()
            history = [
                {
                    "provider_id": r.provider_id,
                    "passed": r.passed,
                    "detail": json.loads(r.detail) if r.detail else {},
                    "duration_ms": r.duration_ms,
                    "collected_at": r.collected_at.isoformat() if r.collected_at else None,
                    "run_id": r.run_id,
                }
                for r in results
            ]

    return {
        "control": {
            "framework": ctrl.framework,
            "control_id": ctrl.control_id,
            "title": ctrl.title,
            "family": ctrl.family,
            "description": ctrl.description,
            "external_ref": ctrl.external_ref,
        },
        "providers": [
            {
                "id": p.id,
                "title": p.title,
                "evidence_type": p.evidence_type.value,
                "code_refs": p.code_refs,
            }
            for p in providers
        ],
        "history": history,
    }


@router.get("/providers")
async def list_providers(framework: str | None = Query(None)):
    """List all providers with latest result."""
    providers = registry.get_providers(framework)

    # Get latest result per provider
    latest: dict[str, dict] = {}
    async with async_session() as db:
        for p in providers:
            result = (await db.execute(
                select(ComplianceProviderResult)
                .where(ComplianceProviderResult.provider_id == p.id)
                .order_by(desc(ComplianceProviderResult.collected_at))
                .limit(1)
            )).scalar_one_or_none()
            if result:
                latest[p.id] = {
                    "passed": result.passed,
                    "collected_at": result.collected_at.isoformat() if result.collected_at else None,
                    "duration_ms": result.duration_ms,
                }

    return [
        {
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "evidence_type": p.evidence_type.value,
            "code_refs": p.code_refs,
            "controls": p.controls,
            "latest_result": latest.get(p.id),
        }
        for p in providers
    ]


@router.get("/providers/{provider_id}")
async def get_provider_detail(provider_id: str):
    """Get provider detail with history."""
    providers = registry.get_providers()
    provider = next((p for p in providers if p.id == provider_id), None)
    if not provider:
        return {"error": "Provider not found"}, 404

    async with async_session() as db:
        results = (await db.execute(
            select(ComplianceProviderResult)
            .where(ComplianceProviderResult.provider_id == provider_id)
            .order_by(desc(ComplianceProviderResult.collected_at))
            .limit(50)
        )).scalars().all()

    return {
        "id": provider.id,
        "title": provider.title,
        "description": provider.description,
        "evidence_type": provider.evidence_type.value,
        "code_refs": provider.code_refs,
        "controls": provider.controls,
        "history": [
            {
                "passed": r.passed,
                "detail": json.loads(r.detail) if r.detail else {},
                "duration_ms": r.duration_ms,
                "collected_at": r.collected_at.isoformat() if r.collected_at else None,
                "run_id": r.run_id,
            }
            for r in results
        ],
    }


@router.get("/dashboard")
async def dashboard():
    """Summary for frontend dashboard."""
    frameworks = registry.framework_names
    summary: dict[str, dict] = {}

    # Get latest run results
    latest_results: dict[str, bool | None] = {}
    latest_attestations: dict[str, bool] = {}

    async with async_session() as db:
        # Latest run
        latest_run = (await db.execute(
            select(ComplianceSuiteRun).order_by(desc(ComplianceSuiteRun.id)).limit(1)
        )).scalar_one_or_none()

        if latest_run:
            results = (await db.execute(
                select(ComplianceProviderResult).where(ComplianceProviderResult.run_id == latest_run.id)
            )).scalars().all()
            for r in results:
                latest_results[r.provider_id] = r.passed

        # Active attestations
        attestation_rows = (await db.execute(
            select(ComplianceAttestation).where(ComplianceAttestation.superseded_at.is_(None))
        )).scalars().all()
        now = datetime.now(timezone.utc)
        for a in attestation_rows:
            if a.re_attestation_due is None or a.re_attestation_due > now:
                latest_attestations[a.provider_id] = True

    for fw in frameworks:
        controls = registry.get_controls(fw)
        statuses = {"passed": 0, "failed": 0, "partial": 0, "attested": 0, "untested": 0}
        for c in controls:
            status = registry.derive_control_status(fw, c.control_id, latest_results, latest_attestations)
            statuses[status] = statuses.get(status, 0) + 1
        total = len(controls)
        compliance_pct = round((statuses["passed"] + statuses["attested"]) / total * 100, 1) if total else 0
        summary[fw] = {
            "total": total,
            **statuses,
            "compliance_pct": compliance_pct,
        }

    expiring_attestations = []
    for a in attestation_rows:
        if a.re_attestation_due and a.re_attestation_due < now:
            expiring_attestations.append({
                "provider_id": a.provider_id,
                "attested_by": a.attested_by,
                "re_attestation_due": a.re_attestation_due.isoformat(),
            })

    return {
        "frameworks": summary,
        "latest_run": {
            "id": latest_run.id,
            "started_at": latest_run.started_at.isoformat() if latest_run.started_at else None,
            "passed": latest_run.passed,
            "failed": latest_run.failed,
            "skipped": latest_run.skipped,
            "duration_ms": latest_run.duration_ms,
        } if latest_run else None,
        "total_providers": registry.provider_count,
        "total_controls": registry.control_count,
        "expiring_attestations": expiring_attestations,
    }


@router.post("/attest")
async def submit_attestation(
    provider_id: str = Query(...),
    attested_by: str = Query(...),
    notes: str = Query(""),
    re_attestation_days: int = Query(90),
):
    """Submit a manual attestation for a provider."""
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    due = now + timedelta(days=re_attestation_days)

    async with async_session() as db:
        # Supersede existing
        existing = (await db.execute(
            select(ComplianceAttestation)
            .where(ComplianceAttestation.provider_id == provider_id)
            .where(ComplianceAttestation.superseded_at.is_(None))
        )).scalars().all()
        for e in existing:
            e.superseded_at = now

        db.add(ComplianceAttestation(
            provider_id=provider_id,
            attested_by=attested_by,
            attested_at=now,
            re_attestation_due=due,
            notes=notes,
        ))
        await db.commit()

    return {"status": "attested", "provider_id": provider_id, "re_attestation_due": due.isoformat()}


@router.get("/attestations")
async def list_attestations(active_only: bool = Query(True)):
    """List attestations."""
    async with async_session() as db:
        q = select(ComplianceAttestation)
        if active_only:
            q = q.where(ComplianceAttestation.superseded_at.is_(None))
        q = q.order_by(desc(ComplianceAttestation.attested_at))
        results = (await db.execute(q)).scalars().all()

    now = datetime.now(timezone.utc)
    return [
        {
            "id": a.id,
            "provider_id": a.provider_id,
            "attested_by": a.attested_by,
            "attested_at": a.attested_at.isoformat() if a.attested_at else None,
            "re_attestation_due": a.re_attestation_due.isoformat() if a.re_attestation_due else None,
            "expired": a.re_attestation_due < now if a.re_attestation_due else False,
            "notes": a.notes,
            "superseded_at": a.superseded_at.isoformat() if a.superseded_at else None,
        }
        for a in results
    ]
