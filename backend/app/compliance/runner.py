"""Suite runner — executes evidence providers and persists results."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable

from app.compliance.models import ComplianceSuiteRun, ComplianceProviderResult
from app.compliance.registry import registry
from app.compliance.types import EvidenceProvider, EvidenceResult, EvidenceType
from app.database import async_session

logger = logging.getLogger(__name__)

PROVIDER_TIMEOUT_S = 30
HTTP_BATCH_SIZE = 5


def _bucket_providers(providers: list[EvidenceProvider]) -> dict[str, list[EvidenceProvider]]:
    """Group providers by execution category for ordered execution."""
    buckets: dict[str, list[EvidenceProvider]] = {
        "http": [],
        "config": [],
        "artifact": [],
        "static": [],
        "manual": [],
    }
    for p in providers:
        if p.evidence_type == EvidenceType.automated_test:
            buckets["http"].append(p)
        elif p.evidence_type == EvidenceType.config_check:
            buckets["config"].append(p)
        elif p.evidence_type in (EvidenceType.code_artifact, EvidenceType.doc_artifact):
            buckets["artifact"].append(p)
        elif p.evidence_type == EvidenceType.static_analysis:
            buckets["static"].append(p)
        elif p.evidence_type == EvidenceType.manual_attestation:
            buckets["manual"].append(p)
        else:
            buckets["config"].append(p)
    return buckets


async def _run_provider(provider: EvidenceProvider) -> EvidenceResult:
    """Execute a single provider with timeout and error isolation."""
    if provider.test_fn is None:
        return EvidenceResult(
            provider_id=provider.id,
            passed=False,
            detail={"skipped": True, "reason": "manual_attestation"},
            collected_at=datetime.now(timezone.utc),
            duration_ms=0,
        )
    start = time.monotonic()
    try:
        result = await asyncio.wait_for(provider.test_fn(), timeout=PROVIDER_TIMEOUT_S)
        return result
    except asyncio.TimeoutError:
        elapsed = int((time.monotonic() - start) * 1000)
        return EvidenceResult(
            provider_id=provider.id,
            passed=False,
            detail={"error": f"Timeout after {PROVIDER_TIMEOUT_S}s"},
            collected_at=datetime.now(timezone.utc),
            duration_ms=elapsed,
        )
    except Exception as e:
        elapsed = int((time.monotonic() - start) * 1000)
        logger.warning("Provider %s failed: %s", provider.id, e)
        return EvidenceResult(
            provider_id=provider.id,
            passed=False,
            detail={"error": str(e)},
            collected_at=datetime.now(timezone.utc),
            duration_ms=elapsed,
        )


async def _emit_progress(
    on_progress: Callable[[dict[str, Any]], Any] | None,
    msg: dict[str, Any],
) -> None:
    if on_progress:
        try:
            await on_progress(msg) if asyncio.iscoroutinefunction(on_progress) else on_progress(msg)
        except Exception:
            pass


async def _execute_buckets(
    buckets: dict[str, list[EvidenceProvider]],
    total: int,
    on_progress: Callable[[dict[str, Any]], Any] | None,
) -> list[EvidenceResult]:
    results: list[EvidenceResult] = []
    completed = 0

    for bucket_name in ("http", "config", "artifact", "static", "manual"):
        bucket = buckets[bucket_name]
        if not bucket:
            continue

        await _emit_progress(on_progress, {"stage": bucket_name, "count": len(bucket), "completed": completed, "total": total})

        if bucket_name == "http":
            # Run HTTP tests in batches for concurrency
            for i in range(0, len(bucket), HTTP_BATCH_SIZE):
                batch = bucket[i:i + HTTP_BATCH_SIZE]
                batch_results = await asyncio.gather(*[_run_provider(p) for p in batch])
                results.extend(batch_results)
                completed += len(batch_results)
                await _emit_progress(on_progress, {"stage": bucket_name, "completed": completed, "total": total})
        elif bucket_name == "static":
            for p in bucket:
                r = await _run_provider(p)
                results.append(r)
                completed += 1
                await _emit_progress(on_progress, {"stage": bucket_name, "completed": completed, "total": total})
        else:
            for p in bucket:
                r = await _run_provider(p)
                results.append(r)
                completed += 1

    return results


def _finalize_run_record(
    run_record: ComplianceSuiteRun,
    results: list[EvidenceResult],
    started_at: datetime,
) -> None:
    elapsed_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed and not r.detail.get("skipped"))
    skipped = sum(1 for r in results if r.detail.get("skipped"))

    run_record.completed_at = datetime.now(timezone.utc)
    run_record.passed = passed
    run_record.failed = failed
    run_record.skipped = skipped
    run_record.duration_ms = elapsed_ms


async def _persist_run(
    run_record: ComplianceSuiteRun,
    results: list[EvidenceResult],
) -> None:
    async with async_session() as db:
        db.add(run_record)
        await db.flush()

        for r in results:
            db.add(ComplianceProviderResult(
                run_id=run_record.id,
                provider_id=r.provider_id,
                passed=r.passed,
                detail=json.dumps(r.detail),
                duration_ms=r.duration_ms,
                collected_at=r.collected_at,
            ))
        await db.commit()
        await db.refresh(run_record)


class SuiteRunner:
    async def run(
        self,
        framework: str | None = None,
        on_progress: Callable[[dict[str, Any]], Any] | None = None,
        triggered_by: str = "manual",
        provider_ids: list[str] | None = None,
    ) -> ComplianceSuiteRun:
        providers = registry.get_providers(framework)
        if provider_ids:
            id_set = set(provider_ids)
            providers = [p for p in providers if p.id in id_set]
        buckets = _bucket_providers(providers)
        total = len(providers)
        started_at = datetime.now(timezone.utc)

        run_record = ComplianceSuiteRun(
            started_at=started_at,
            framework_filter=framework,
            provider_filter=json.dumps(provider_ids) if provider_ids else None,
            total_providers=total,
            triggered_by=triggered_by,
        )

        results = await _execute_buckets(buckets, total, on_progress)
        _finalize_run_record(run_record, results, started_at)
        await _persist_run(run_record, results)

        await _emit_progress(on_progress, {"stage": "complete", "completed": total, "total": total, "run_id": run_record.id})
        return run_record
