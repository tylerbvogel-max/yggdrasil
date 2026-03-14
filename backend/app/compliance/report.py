"""HTML report generator for compliance suite runs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.compliance.models import ComplianceAttestation, ComplianceProviderResult, ComplianceSuiteRun
    from app.compliance.registry import ControlRegistry


def generate_report(
    run: ComplianceSuiteRun,
    results: list[ComplianceProviderResult],
    registry: ControlRegistry,
    framework: str | None = None,
    attestations: list[ComplianceAttestation] | None = None,
    historical_runs: list[ComplianceSuiteRun] | None = None,
) -> str:
    """Generate a full HTML compliance report."""

    # Build lookup maps
    result_map: dict[str, dict] = {}
    for r in results:
        result_map[r.provider_id] = {
            "passed": r.passed,
            "detail": json.loads(r.detail) if r.detail else {},
            "duration_ms": r.duration_ms,
        }

    latest_results: dict[str, bool | None] = {r.provider_id: r.passed for r in results}
    attestation_map: dict[str, bool] = {}
    now = datetime.now(timezone.utc)
    if attestations:
        for a in attestations:
            if a.re_attestation_due is None or a.re_attestation_due > now:
                attestation_map[a.provider_id] = True

    # Determine which providers were actually run
    ran_provider_ids = set(result_map.keys())
    is_selective = len(ran_provider_ids) < registry.provider_count

    # Scope controls to only those with providers in this run
    def _relevant_controls(fw: str):
        controls = registry.get_controls(fw)
        if not is_selective:
            return controls
        relevant = []
        for c in controls:
            providers = registry.get_providers_for_control(fw, c.control_id)
            if any(p.id in ran_provider_ids for p in providers):
                relevant.append(c)
        return relevant

    frameworks = [framework] if framework else registry.framework_names
    # Filter to frameworks that have relevant controls
    if is_selective:
        frameworks = [fw for fw in frameworks if _relevant_controls(fw)]

    passed_total = sum(1 for r in results if r.passed)
    failed_total = sum(1 for r in results if not r.passed and not (json.loads(r.detail) if r.detail else {}).get("skipped"))
    skipped_total = sum(1 for r in results if r.detail and json.loads(r.detail).get("skipped"))

    # Per-framework summary
    fw_summaries: list[dict] = []
    for fw in frameworks:
        controls = _relevant_controls(fw)
        statuses = {"passed": 0, "failed": 0, "partial": 0, "attested": 0, "untested": 0}
        for c in controls:
            s = registry.derive_control_status(fw, c.control_id, latest_results, attestation_map)
            statuses[s] = statuses.get(s, 0) + 1
        total = len(controls)
        pct = round((statuses["passed"] + statuses["attested"]) / total * 100, 1) if total else 0
        fw_summaries.append({"name": fw, "total": total, "pct": pct, **statuses})

    # Failed controls detail
    failed_controls: list[dict] = []
    for fw in frameworks:
        for c in _relevant_controls(fw):
            s = registry.derive_control_status(fw, c.control_id, latest_results, attestation_map)
            if s in ("failed", "partial"):
                providers = registry.get_providers_for_control(fw, c.control_id)
                provider_details = []
                for p in providers:
                    rm = result_map.get(p.id)
                    if rm and not rm["passed"]:
                        provider_details.append({"id": p.id, "title": p.title, "detail": rm["detail"]})
                failed_controls.append({
                    "framework": fw, "control_id": c.control_id, "title": c.title,
                    "status": s, "providers": provider_details,
                })

    # Historical trend
    trend_html = ""
    if historical_runs:
        bars = []
        for hr in reversed(historical_runs[:10]):
            total = hr.total_providers or 1
            pct = round((hr.passed / total) * 100) if total else 0
            date_str = hr.started_at.strftime("%m/%d") if hr.started_at else "?"
            bars.append(f'<div class="trend-bar" style="height:{pct}%" title="{date_str}: {pct}%"><span>{pct}%</span></div>')
        trend_html = '<div class="trend-chart">' + ''.join(bars) + '</div>'

    # Build HTML
    if is_selective:
        title = f"Selective Compliance Report — {len(ran_provider_ids)} provider(s)"
    elif framework:
        title = f"Compliance Report — {framework.upper()}"
    else:
        title = "Total Compliance Audit Report"
    generated = now.strftime("%Y-%m-%d %H:%M UTC")

    fw_cards = ""
    for fw in fw_summaries:
        color = "#22c55e" if fw["pct"] >= 80 else "#eab308" if fw["pct"] >= 50 else "#ef4444"
        fw_cards += f'''
        <div class="fw-card">
            <h3>{fw["name"].upper()}</h3>
            <div class="pct" style="color:{color}">{fw["pct"]}%</div>
            <div class="counts">
                <span class="passed">{fw["passed"]} passed</span>
                <span class="failed">{fw["failed"]} failed</span>
                <span class="partial">{fw["partial"]} partial</span>
                <span class="attested">{fw["attested"]} attested</span>
                <span class="untested">{fw["untested"]} untested</span>
            </div>
            <div class="total">{fw["total"]} controls</div>
        </div>'''

    # Per-framework control tables
    control_tables = ""
    for fw in frameworks:
        controls = _relevant_controls(fw)
        families: dict[str, list] = {}
        for c in controls:
            families.setdefault(c.family, []).append(c)

        rows = ""
        for fam, ctrls in sorted(families.items()):
            rows += f'<tr class="family-row"><td colspan="4"><strong>{fam}</strong></td></tr>'
            for c in ctrls:
                s = registry.derive_control_status(fw, c.control_id, latest_results, attestation_map)
                badge = _status_badge(s)
                providers = registry.get_providers_for_control(fw, c.control_id)
                types = ", ".join(sorted(set(p.evidence_type.value for p in providers))) if providers else "—"
                rows += f'<tr><td>{c.control_id}</td><td>{c.title}</td><td>{badge}</td><td>{types}</td></tr>'

        control_tables += f'''
        <div class="fw-section">
            <h3>{fw.upper()}</h3>
            <table>
                <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Evidence Type</th></tr></thead>
                <tbody>{rows}</tbody>
            </table>
        </div>'''

    # Failed controls detail
    failed_html = ""
    for fc in failed_controls[:50]:
        prov_html = ""
        for pd in fc["providers"]:
            detail_str = json.dumps(pd["detail"], indent=2, default=str)[:500]
            prov_html += f'<div class="provider-fail"><strong>{pd["id"]}</strong>: {pd["title"]}<pre>{detail_str}</pre></div>'
        failed_html += f'''
        <div class="failed-control">
            <h4>{fc["framework"].upper()} {fc["control_id"]} — {fc["title"]} <span class="badge badge-{fc["status"]}">{fc["status"]}</span></h4>
            {prov_html}
        </div>'''

    # Attestation status
    attest_html = ""
    if attestations:
        attest_rows = ""
        for a in attestations:
            expired = a.re_attestation_due and a.re_attestation_due < now
            status = '<span class="badge badge-failed">EXPIRED</span>' if expired else '<span class="badge badge-passed">ACTIVE</span>'
            due = a.re_attestation_due.strftime("%Y-%m-%d") if a.re_attestation_due else "—"
            attest_rows += f'<tr><td>{a.provider_id}</td><td>{a.attested_by}</td><td>{a.attested_at.strftime("%Y-%m-%d") if a.attested_at else "—"}</td><td>{due}</td><td>{status}</td></tr>'
        attest_html = f'''
        <h2>Manual Attestation Status</h2>
        <table>
            <thead><tr><th>Provider</th><th>Attested By</th><th>Date</th><th>Re-attestation Due</th><th>Status</th></tr></thead>
            <tbody>{attest_rows}</tbody>
        </table>'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1a1a2e; background: #f8f9fa; line-height: 1.5; }}
    h1 {{ font-size: 24px; margin-bottom: 8px; }}
    h2 {{ font-size: 20px; margin: 32px 0 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }}
    h3 {{ font-size: 16px; margin-bottom: 8px; }}
    .meta {{ color: #64748b; font-size: 14px; margin-bottom: 24px; }}
    .summary-cards {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }}
    .summary-card {{ background: white; border-radius: 8px; padding: 16px 24px; box-shadow: 0 1px 3px rgba(0,0,0,.1); text-align: center; min-width: 120px; }}
    .summary-card .num {{ font-size: 28px; font-weight: 700; }}
    .summary-card .label {{ font-size: 12px; color: #64748b; text-transform: uppercase; }}
    .fw-cards {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }}
    .fw-card {{ background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); min-width: 180px; flex: 1; }}
    .fw-card h3 {{ font-size: 14px; color: #64748b; letter-spacing: 1px; }}
    .fw-card .pct {{ font-size: 32px; font-weight: 700; margin: 4px 0; }}
    .fw-card .counts {{ font-size: 12px; display: flex; flex-wrap: wrap; gap: 6px; }}
    .fw-card .counts span {{ padding: 2px 6px; border-radius: 4px; }}
    .passed {{ background: #dcfce7; color: #166534; }}
    .failed {{ background: #fef2f2; color: #991b1b; }}
    .partial {{ background: #fefce8; color: #854d0e; }}
    .attested {{ background: #dbeafe; color: #1e40af; }}
    .untested {{ background: #f1f5f9; color: #475569; }}
    .total {{ font-size: 12px; color: #94a3b8; margin-top: 4px; }}
    table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }}
    th {{ background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 13px; font-weight: 600; }}
    td {{ padding: 8px 12px; border-top: 1px solid #e2e8f0; font-size: 13px; }}
    .family-row td {{ background: #f8fafc; font-size: 14px; }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }}
    .badge-passed {{ background: #dcfce7; color: #166534; }}
    .badge-failed {{ background: #fef2f2; color: #991b1b; }}
    .badge-partial {{ background: #fefce8; color: #854d0e; }}
    .badge-attested {{ background: #dbeafe; color: #1e40af; }}
    .badge-untested {{ background: #f1f5f9; color: #475569; }}
    .fw-section {{ margin-bottom: 32px; }}
    .failed-control {{ background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }}
    .failed-control h4 {{ font-size: 14px; margin-bottom: 8px; }}
    .provider-fail {{ margin: 8px 0; padding: 8px; background: #fef2f2; border-radius: 4px; }}
    .provider-fail pre {{ font-size: 11px; margin-top: 4px; white-space: pre-wrap; color: #64748b; }}
    .trend-chart {{ display: flex; align-items: flex-end; gap: 4px; height: 80px; margin: 16px 0; }}
    .trend-bar {{ background: #3b82f6; border-radius: 4px 4px 0 0; min-width: 32px; display: flex; align-items: flex-end; justify-content: center; }}
    .trend-bar span {{ font-size: 9px; color: white; padding: 2px; }}
    @media print {{ body {{ padding: 20px; }} .summary-cards, .fw-cards {{ break-inside: avoid; }} }}
</style>
</head>
<body>
<h1>{title}</h1>
<div class="meta">Generated: {generated} | Run #{run.id} | Duration: {run.duration_ms}ms | Triggered by: {run.triggered_by}</div>

<h2>Executive Summary</h2>
<div class="summary-cards">
    <div class="summary-card"><div class="num" style="color:#22c55e">{passed_total}</div><div class="label">Passed</div></div>
    <div class="summary-card"><div class="num" style="color:#ef4444">{failed_total}</div><div class="label">Failed</div></div>
    <div class="summary-card"><div class="num" style="color:#94a3b8">{skipped_total}</div><div class="label">Skipped</div></div>
    <div class="summary-card"><div class="num">{len(results)}</div><div class="label">Total Providers</div></div>
</div>

<h2>Framework Compliance</h2>
<div class="fw-cards">{fw_cards}</div>

{f'<h2>Historical Trend (Last 10 Runs)</h2>{trend_html}' if trend_html else ''}

<h2>Control Details by Framework</h2>
{control_tables}

{f'<h2>Failed / Partial Controls</h2>{failed_html}' if failed_html else '<h2>Failed Controls</h2><p>None — all tested controls passed.</p>'}

{attest_html}

<h2>Appendix: Full Provider Results</h2>
<table>
<thead><tr><th>Provider</th><th>Status</th><th>Duration</th><th>Detail</th></tr></thead>
<tbody>
{''.join(f"""<tr><td>{r.provider_id}</td><td>{_status_badge("passed" if r.passed else "failed")}</td><td>{r.duration_ms}ms</td><td><pre style="font-size:11px;white-space:pre-wrap;max-width:500px">{json.dumps(json.loads(r.detail) if r.detail else {{}}, indent=1, default=str)[:300]}</pre></td></tr>""" for r in results)}
</tbody>
</table>

</body>
</html>'''


def _status_badge(status: str) -> str:
    return f'<span class="badge badge-{status}">{status}</span>'
