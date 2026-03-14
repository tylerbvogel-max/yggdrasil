import { useState, useEffect } from 'react';
import { fetchFrameworksSummary, fetchFedRAMPControls, fetchSOC2Criteria, fetchCMMCPractices, type FrameworkSummary, type FrameworkControl } from '../api';

type Tab = 'unified' | 'fedramp' | 'soc2' | 'cmmc';

function FrameworkDetailTable({ controls, statusColor, statusLabel }: {
  controls: FrameworkControl[];
  statusColor: (s: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterFamily, setFilterFamily] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const families = [...new Set(controls.map(c => c.family || c.category || ''))].filter(Boolean);
  const filtered = controls.filter(c =>
    (!filterFamily || (c.family || c.category) === filterFamily) &&
    (!filterStatus || c.status === filterStatus)
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)} style={selectStyle}>
          <option value="">All Families</option>
          {families.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="addressed">Addressed</option>
          <option value="partial">Partial</option>
          <option value="gap">Gap</option>
          <option value="inherited">Inherited</option>
          <option value="not_applicable">N/A</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center' }}>
          {filtered.length} of {controls.length} controls
        </span>
      </div>
      <table className="about-table" style={{ fontSize: '0.8rem' }}>
        <thead>
          <tr>
            <th style={{ width: 80 }}>ID</th>
            <th>Control</th>
            <th style={{ width: 80 }}>Status</th>
            <th style={{ width: 80 }}>Family</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(ctrl => (
            <>{/* eslint-disable-next-line react/jsx-key */}
              <tr key={ctrl.id} onClick={() => setExpanded(expanded === ctrl.id ? null : ctrl.id)}
                style={{ cursor: 'pointer' }}>
                <td><code>{ctrl.id}</code></td>
                <td style={{ fontWeight: 500 }}>{ctrl.title}</td>
                <td>
                  <span style={{
                    display: 'inline-block', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3,
                    background: statusColor(ctrl.status) + '22', color: statusColor(ctrl.status),
                    border: `1px solid ${statusColor(ctrl.status)}44`, fontWeight: 600,
                  }}>
                    {statusLabel(ctrl.status)}
                  </span>
                </td>
                <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{ctrl.family || ctrl.category}</td>
              </tr>
              {expanded === ctrl.id && (
                <tr key={ctrl.id + '-d'}>
                  <td colSpan={4} style={{ padding: '8px 16px', background: 'var(--bg-input)', fontSize: '0.78rem', color: '#c8d0dc', lineHeight: 1.5 }}>
                    {ctrl.detail}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </>
  );
}

function FrameworkSummaryCards({ summary }: { summary: FrameworkSummary }) {
  const sc = summary.status_counts;
  return (
    <div className="stat-cards" style={{ marginBottom: 16 }}>
      <div className="stat-card">
        <div className="card-value" style={{ color: '#22c55e' }}>{sc.addressed || 0}</div>
        <div className="card-label">Addressed</div>
      </div>
      <div className="stat-card">
        <div className="card-value" style={{ color: '#fb923c' }}>{sc.partial || 0}</div>
        <div className="card-label">Partial</div>
      </div>
      <div className="stat-card">
        <div className="card-value" style={{ color: '#ef4444' }}>{sc.gap || 0}</div>
        <div className="card-label">Gaps</div>
      </div>
      <div className="stat-card">
        <div className="card-value" style={{ color: '#64748b' }}>{(sc.inherited || 0) + (sc.not_applicable || 0)}</div>
        <div className="card-label">Inherited/N/A</div>
      </div>
      <div className="stat-card">
        <div className="card-value">{summary.total_controls || summary.total_criteria || summary.total_practices || 0}</div>
        <div className="card-label">Total</div>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  type Status = 'addressed' | 'partial' | 'missing' | 'not-applicable';

  interface ComplianceItem {
    id: string;
    title: string;
    status: Status;
    detail: string;
    group: string;
    frameworks: { nist?: string; iso?: string; aiuc?: string; fedramp?: string; soc2?: string; cmmc?: string };
  }

  const items: ComplianceItem[] = [
    // Security & Adversarial Testing
    { id: 'SEC-1', title: 'Security & Resilience', status: 'partial', group: 'Security',
      detail: 'Input guard: 16 regex patterns, 24 adversarial tests passing. Missing: external red-teaming.',
      frameworks: { nist: 'MEA 2.7', iso: 'A.6.2.4', aiuc: 'B001, B004, B005' } },
    { id: 'SEC-2', title: 'Safety Risk Evaluation', status: 'partial', group: 'Security',
      detail: '24-test adversarial suite. Missing: formal stress testing, chaos engineering.',
      frameworks: { nist: 'MEA 2.6', iso: 'A.6.2.4', aiuc: 'C002, C010' } },
    { id: 'SEC-3', title: 'Critical Thinking & Safety Culture', status: 'addressed', group: 'Security',
      detail: 'Human review before commit. Input guard pre-classification. Output risk tagging.',
      frameworks: { nist: 'GOV 4.1', iso: 'A.5.2' } },
    { id: 'SEC-4', title: 'TEVV Considerations', status: 'addressed', group: 'Security',
      detail: 'Blind A/B evaluation. 24-test adversarial suite. Output grounding check.',
      frameworks: { nist: 'MAP 2.3', iso: 'A.6.2.4, A.6.2.5' } },
    { id: 'SEC-5', title: 'Detect Adversarial Input', status: 'addressed', group: 'Security',
      detail: 'Input guard: 16 regex patterns, verdicts pass/warn/block, 422 on block.',
      frameworks: { nist: 'GOV 1.5, MEA 2.4, 2.7, 3.1', aiuc: 'B002' } },
    { id: 'SEC-6', title: 'Real-Time Input Filtering', status: 'addressed', group: 'Security',
      detail: 'Length limits, empty/repetition rejection, injection patterns, PII detection.',
      frameworks: { nist: 'MEA 2.7', aiuc: 'B005' } },
    { id: 'SEC-7', title: 'Prevent Harmful Outputs', status: 'addressed', group: 'Security',
      detail: 'Output risk tagging + grounding check. Flags safety-critical, dual-use, speculative.',
      frameworks: { nist: 'MEA 2.11', iso: 'A.6.2.4', aiuc: 'C003' } },
    { id: 'SEC-8', title: 'Flag High Risk Outputs', status: 'addressed', group: 'Security',
      detail: 'Risk categories: safety_critical, dual_use, speculative. Grounding 0-1 score.',
      frameworks: { nist: 'GOV 3.2, MAP 3.5', iso: 'A.6.1.2, A.9.2, A.9.3', aiuc: 'C007' } },
    { id: 'SEC-9', title: 'Customer-Defined Risk Outputs', status: 'partial', group: 'Security',
      detail: 'Configurable RISK_CATEGORIES dict. Missing: UI for custom risk categories.',
      frameworks: { nist: 'MAN 1.4', aiuc: 'C005' } },
    { id: 'F001', title: 'Prevent AI Cyber Misuse', status: 'addressed', group: 'Security',
      detail: 'Domain-scoped graph. No code execution. Exfiltration blocking. Dual-use flagging.',
      frameworks: { nist: 'MEA 2.7', iso: 'A.5.5', aiuc: 'F001' } },

    // Production Monitoring
    { id: 'MON-1', title: 'Production Monitoring & Alerting', status: 'addressed', group: 'Monitoring',
      detail: 'Health check endpoint with drift detection, quality monitoring, API version tracking.',
      frameworks: { nist: 'MEA 2.4', iso: '9.1, A.6.2.6', aiuc: 'C008' } },
    { id: 'MON-2', title: 'Post-Deployment Feedback', status: 'addressed', group: 'Monitoring',
      detail: 'Thumbs up/down + 0-1 slider. Ratings feed into neuron scoring via EMA.',
      frameworks: { nist: 'MAN 4.1', iso: 'A.8.3', aiuc: 'C009' } },
    { id: 'MON-3', title: 'Continuous Improvement Triggers', status: 'addressed', group: 'Monitoring',
      detail: 'Circuit breaker on eval <2.5 or rating <0.3. Zero-hit warnings >40%.',
      frameworks: { nist: 'MAN 4.2', iso: '10.1, 10.2', aiuc: 'E013' } },
    { id: 'MON-4', title: 'Third-Party API Monitoring', status: 'addressed', group: 'Monitoring',
      detail: 'Model version tracking per query. Alerts on version changes.',
      frameworks: { nist: 'MAN 3.1', iso: 'A.5.5', aiuc: 'E009' } },
    { id: 'MON-5', title: 'System Viability Assessment', status: 'addressed', group: 'Monitoring',
      detail: 'Configurable go/no-go thresholds. Health check returns explicit status.',
      frameworks: { nist: 'MAN 1.1', iso: '6.2' } },
    { id: 'MON-6', title: 'Real-Time Intervention', status: 'addressed', group: 'Monitoring',
      detail: 'Circuit breaker + alert acknowledge/dismiss workflow.',
      frameworks: { nist: 'GOV 3.2, MAP 3.5, MEA 3.3', iso: 'A.8.3', aiuc: 'C009' } },

    // Metrics & Evaluation
    { id: 'MET-1', title: 'Metrics Selection & Documentation', status: 'addressed', group: 'Metrics',
      detail: 'Per-signal baselines (P25/P50/P75/P95). Metric rationale documented for 6 signals.',
      frameworks: { nist: 'MEA 1.1', iso: '9.1' } },
    { id: 'MET-2', title: 'Validity & Reliability', status: 'addressed', group: 'Metrics',
      detail: '95% CI per eval dimension. 5-fold cross-validation. Signal robustness via CV.',
      frameworks: { nist: 'MEA 2.5', iso: 'A.6.2.4, A.6.2.5', aiuc: 'D001' } },
    { id: 'MET-3', title: 'Privacy Risk & PII Scanning', status: 'addressed', group: 'Metrics',
      detail: 'PII detection in queries + neuron content (SSN, email, CC, phone).',
      frameworks: { nist: 'MEA 2.10', iso: 'A.7.5', aiuc: 'A006' } },
    { id: 'MET-4', title: 'Fairness & Bias Assessment', status: 'addressed', group: 'Metrics',
      detail: 'Coverage CV, per-dept eval quality, invocation disparity, remediation plan.',
      frameworks: { nist: 'MEA 2.11', iso: 'A.5' } },
    { id: 'MET-5', title: 'Prevent Hallucinations', status: 'addressed', group: 'Metrics',
      detail: 'Neuron grounding + faithfulness eval + output grounding check (0-1 score).',
      frameworks: { nist: 'MEA 2.5', aiuc: 'D001' } },
    { id: 'A007', title: 'Prevent IP Violations', status: 'addressed', group: 'Metrics',
      detail: 'Source tracking (citation, URL, effective date). Provenance audit in compliance scan.',
      frameworks: { nist: 'GOV 6.1, MAP 4.1', iso: 'A.7.5', aiuc: 'A007' } },

    // Governance & Process
    { id: 'GOV-1', title: 'Change Management Process', status: 'addressed', group: 'Governance',
      detail: '4-step: Proposal, Review, Approval, Audit Trail. All changes tracked.',
      frameworks: { nist: 'MAN 4.2', iso: '6.3, A.6.2.2', aiuc: 'E007' } },
    { id: 'GOV-2', title: 'Risk Register & Treatment Plan', status: 'addressed', group: 'Governance',
      detail: '15 risks with likelihood x impact scoring, treatment decisions, quarterly reassessment.',
      frameworks: { nist: 'MAP 3.2, GOV 1.3', iso: '6.1, 8.2, 8.3, A.5' } },
    { id: 'GOV-3', title: 'Document Control & Retention', status: 'addressed', group: 'Governance',
      detail: 'Document registry with version, status, review cycle. Neuron checkpoints.',
      frameworks: { iso: '7.5', aiuc: 'E011, E012, E013' } },
    { id: 'GOV-4', title: 'AI Objectives & Measurement', status: 'addressed', group: 'Governance',
      detail: '8 KPIs with targets and live progress. Green/amber status.',
      frameworks: { iso: '6.2, 9.1' } },
    { id: 'GOV-5', title: 'Communication & Reporting', status: 'addressed', group: 'Governance',
      detail: '6 report types: daily health to quarterly compliance audit.',
      frameworks: { nist: 'MAN 4.3', iso: '7.4', aiuc: 'E014' } },
    { id: 'GOV-6', title: 'Impact Assessment', status: 'addressed', group: 'Governance',
      detail: 'Stakeholder analysis: end users, organization, customers, regulators.',
      frameworks: { nist: 'MAP 3.2', iso: '8.4', aiuc: 'E001, E002, E003' } },
    { id: 'GOV-7', title: 'Nonconformity & Corrective Action', status: 'addressed', group: 'Governance',
      detail: '5-step: Detection, Documentation, Root Cause, Corrective Action, Verification.',
      frameworks: { iso: '10.1, 10.2', aiuc: 'E013' } },
    { id: 'GOV-8', title: 'Review Internal Processes', status: 'addressed', group: 'Governance',
      detail: '9 review activities (daily to semi-annual). Management review with cadence tracking.',
      frameworks: { nist: 'GOV 1.5, MAN 4.1', iso: '9.2, 9.3, A.6.2.6, A.9.3, A.9.4', aiuc: 'E008' } },
    { id: 'GOV-9', title: 'Concern Reporting Channel', status: 'addressed', group: 'Governance',
      detail: 'User feedback, system alerts, issue tracker.',
      frameworks: { iso: 'A.4.4', aiuc: 'E012' } },
    { id: 'E001', title: 'Failure Plan: Security Breaches', status: 'addressed', group: 'Governance',
      detail: 'P1 playbook: 7-step response procedure.',
      frameworks: { nist: 'GOV 4.3, MAN 1.3, 4.3', iso: 'A.8.4, A.8.5', aiuc: 'E001' } },
    { id: 'E002', title: 'Failure Plan: Harmful Outputs', status: 'addressed', group: 'Governance',
      detail: 'P1 playbook: trigger >10% risk-flagged, 7-step procedure.',
      frameworks: { nist: 'GOV 4.3, MAN 1.3, 4.3', iso: 'A.8.4', aiuc: 'E002' } },
    { id: 'E003', title: 'Failure Plan: Hallucinations', status: 'addressed', group: 'Governance',
      detail: 'P2 playbook: grounding <0.3 or faithfulness <3.0, 7-step procedure.',
      frameworks: { nist: 'GOV 4.3, MAN 1.3, 4.3', iso: 'A.8.4', aiuc: 'E003' } },

    // Independent Assessment & Audit
    { id: 'AUD-1', title: 'Independent Assessment', status: 'missing', group: 'Audit',
      detail: 'All testing by sole developer. No external review.',
      frameworks: { nist: 'MEA 1.3', iso: '9.2, A.9.3' } },
    { id: 'AUD-2', title: '3rd-Party Adversarial Testing', status: 'missing', group: 'Audit',
      detail: 'External auditor requirement. Cannot be self-certified.',
      frameworks: { nist: 'GOV 4.3, MEA 2.1, 2.6, 2.7', aiuc: 'B001' } },
    { id: 'AUD-3', title: '3rd-Party Harmful/OOS Testing', status: 'missing', group: 'Audit',
      detail: 'External auditor requirement. Depends on output filtering.',
      frameworks: { nist: 'MEA 2.6, 2.7, 2.11', iso: 'A.6.2.4', aiuc: 'C010, C011, C012' } },
    { id: 'AUD-4', title: '3rd-Party Hallucination Testing', status: 'missing', group: 'Audit',
      detail: 'External auditor requirement. Infrastructure exists, independent verification not done.',
      frameworks: { nist: 'MEA 2.5, 2.6, 2.7', iso: 'A.6.2.4', aiuc: 'D002' } },
    { id: 'AUD-5', title: 'Management Review', status: 'addressed', group: 'Audit',
      detail: '7 review types with cadence enforcement. Snapshots + evidence map.',
      frameworks: { iso: '9.3, A.9.4', aiuc: 'C008, E008' } },

    // Personnel Training
    { id: 'TRN-1', title: 'Personnel Training', status: 'partial', group: 'Training',
      detail: 'Getting Started page + walkthrough. Missing: role-based paths, assessment.',
      frameworks: { nist: 'GOV 2.2', iso: 'A.4.6', aiuc: 'E004' } },

    // Addressed: Policy & Context
    { id: 'GOV-1.3', title: 'Risk Tolerance & Prioritization', status: 'addressed', group: 'Policy',
      detail: 'Escalation thresholds: A/B drop >15% = investigate, >30% = stop.',
      frameworks: { nist: 'GOV 1.3', iso: '5.2, A.5' } },
    { id: 'GOV-1.4', title: 'Transparent Documentation', status: 'addressed', group: 'Policy',
      detail: 'Full query provenance logged and visible in UI.',
      frameworks: { nist: 'GOV 1.4', iso: '7.5' } },
    { id: 'GOV-1.5', title: 'Ongoing Monitoring & Review', status: 'addressed', group: 'Policy',
      detail: 'Scoring Health Monitor + z-score drift detection + mgmt review cadence.',
      frameworks: { nist: 'GOV 1.5', iso: '9.1, A.5.5, A.6.2.6' } },
    { id: 'GOV-1.6', title: 'AI System Inventory', status: 'addressed', group: 'Policy',
      detail: 'System card documents components, models, data flows, dependencies.',
      frameworks: { nist: 'GOV 1.6', iso: 'A.6.1.2' } },
    { id: 'GOV-1.7', title: 'Decommissioning Procedures', status: 'addressed', group: 'Policy',
      detail: 'Model deprecation plan. Model-agnostic architecture.',
      frameworks: { nist: 'GOV 1.7' } },
    { id: 'GOV-2.1', title: 'Roles & Responsibilities', status: 'addressed', group: 'Policy',
      detail: 'System Owner, Content Author, Query Reviewer with separation of concerns.',
      frameworks: { nist: 'GOV 2.1', iso: '5.1, 5.3, A.3.2', aiuc: 'E004' } },
    { id: 'GOV-4.3', title: 'Incident Response', status: 'addressed', group: 'Policy',
      detail: 'P1-P4 severity levels with response procedures.',
      frameworks: { nist: 'GOV 4.3', iso: 'A.8.4', aiuc: 'E001, E002, E003' } },
    { id: 'GOV-6.1', title: 'Third-Party Risk Management', status: 'addressed', group: 'Policy',
      detail: 'Anthropic API risks documented with mitigation.',
      frameworks: { nist: 'GOV 6.1', iso: 'A.5.4' } },
    { id: 'MAP-1.1', title: 'Intended Purpose', status: 'addressed', group: 'Context',
      detail: 'Purpose, scope, deployment context, out-of-scope uses documented.',
      frameworks: { nist: 'MAP 1.1', iso: '4.1, 4.2', aiuc: 'E010, E012' } },
    { id: 'MAP-2.1', title: 'Technical Task Definition', status: 'addressed', group: 'Context',
      detail: 'Two-stage pipeline documented. Component dependencies.',
      frameworks: { nist: 'MAP 2.1', iso: 'A.6.1.2' } },
    { id: 'MAP-2.2', title: 'Knowledge Limits', status: 'addressed', group: 'Context',
      detail: 'Coverage gaps and out-of-scope topics listed.',
      frameworks: { nist: 'MAP 2.2', aiuc: 'C004' } },
    { id: 'MAP-3.2', title: 'Negative Impact Analysis', status: 'addressed', group: 'Context',
      detail: '15 failure modes across scoring, assembly, execution, human factors.',
      frameworks: { nist: 'MAP 3.2', iso: '8.2, 8.3' } },
    { id: 'MAP-3.3', title: 'Targeted Application Scope', status: 'addressed', group: 'Context',
      detail: 'Aerospace domain. Unclassified, single-user, local, English-only.',
      frameworks: { nist: 'MAP 3.3', iso: 'A.4.2, A.4.5', aiuc: 'E010' } },
    { id: 'MAP-3.5', title: 'Human Oversight', status: 'addressed', group: 'Context',
      detail: 'Oversight levels per activity: query (advisory), refinement (required).',
      frameworks: { nist: 'MAP 3.5', iso: 'A.8.2' } },
    { id: 'MAP-4.1', title: 'Third-Party Technology Risk', status: 'addressed', group: 'Context',
      detail: 'Anthropic API risks mapped with likelihood, impact, mitigation.',
      frameworks: { nist: 'MAP 4.1', iso: 'A.5.4' } },

    // Transparency & Logging
    { id: 'MEA-2.8', title: 'Transparency & Accountability', status: 'addressed', group: 'Transparency',
      detail: 'Full audit trail: query logs, neuron scores, assembled prompt, response.',
      frameworks: { nist: 'MEA 2.8', iso: 'A.6.2.8', aiuc: 'E015' } },
    { id: 'MEA-2.9', title: 'Model Explainability', status: 'addressed', group: 'Transparency',
      detail: '5-signal scoring is inherently interpretable. Spread activation visible.',
      frameworks: { nist: 'MEA 2.9', iso: 'A.8.2', aiuc: 'E016, E017' } },
    { id: 'MAN-1.4', title: 'Residual Risk Documentation', status: 'addressed', group: 'Transparency',
      detail: 'Known limitations documented in system card.',
      frameworks: { nist: 'MAN 1.4', iso: 'A.5.3' } },
    { id: 'MAN-2.4', title: 'System Disengagement Criteria', status: 'addressed', group: 'Transparency',
      detail: 'Red thresholds: quality drop >30%, zero-hit >40%, bad answers >25%.',
      frameworks: { nist: 'MAN 2.4' } },
    { id: 'MAN-4.3', title: 'Incident Communication', status: 'addressed', group: 'Transparency',
      detail: 'Incident log format. Severity levels with response times.',
      frameworks: { nist: 'MAN 4.3', iso: 'A.8.4, A.8.5' } },

    // Data & Privacy
    { id: 'A001', title: 'Input Data Policy', status: 'addressed', group: 'Data',
      detail: 'Queries stored locally in PostgreSQL only.',
      frameworks: { nist: 'MEA 2.10', iso: 'A.7.2, A.7.3', aiuc: 'A001' } },
    { id: 'A002', title: 'Output Data Policy', status: 'addressed', group: 'Data',
      detail: 'All responses stored locally with full provenance.',
      frameworks: { aiuc: 'A002' } },
    { id: 'A003', title: 'Limit Data Collection', status: 'addressed', group: 'Data',
      detail: 'Only query text and user ratings. No telemetry.',
      frameworks: { nist: 'MAP 2.1', iso: 'A.7.2, A.7.3', aiuc: 'A003' } },
    { id: 'A005', title: 'Prevent Cross-Customer Exposure', status: 'addressed', group: 'Data',
      detail: 'Single-user local deployment. No multi-tenant.',
      frameworks: { nist: 'MEA 2.10', aiuc: 'A005' } },
    { id: 'A007-A', title: 'Data Quality & Provenance', status: 'addressed', group: 'Data',
      detail: 'Every neuron tracks source_type, origin, citation, dates, URL, version.',
      frameworks: { iso: 'A.7.2, A.7.3' } },
    { id: 'A007-B', title: 'Data Sharing & Transfer', status: 'addressed', group: 'Data',
      detail: 'All data local. Only assembled prompt sent to Anthropic API.',
      frameworks: { iso: 'A.7.5', aiuc: 'E011' } },

    // Safety & Reliability
    { id: 'C004', title: 'Prevent Out-of-Scope Outputs', status: 'addressed', group: 'Safety',
      detail: 'Classification stage scopes to known domains. Grounded in neuron context.',
      frameworks: { nist: 'MAP 2.2, 3.4', aiuc: 'C004' } },
    { id: 'C008', title: 'Monitor AI Risk Categories', status: 'addressed', group: 'Safety',
      detail: 'Scoring Health Monitor tracks 6 signals with z-score drift detection.',
      frameworks: { nist: 'GOV 1.5, MAN 3.1, 4.1, MEA 2.4, 4.3', iso: '9.1, 9.3, 10.1, 10.2, A.6.2.6, A.9.4', aiuc: 'C008' } },
    { id: 'B006', title: 'Prevent Unauthorized Agent Actions', status: 'addressed', group: 'Safety',
      detail: 'Retrieval system only. No tool calls or autonomous actions.',
      frameworks: { nist: 'MAP 2.1', aiuc: 'B006' } },
    { id: 'B009', title: 'Limit Output Over-Exposure', status: 'addressed', group: 'Safety',
      detail: 'Token-budgeted assembly (1K-32K). Only top-K neurons included.',
      frameworks: { nist: 'MEA 2.10', aiuc: 'B009' } },
    { id: 'E010', title: 'AI Acceptable Use Policy', status: 'addressed', group: 'Safety',
      detail: 'Deployment constraints: unclassified, single-user, local, English, aerospace.',
      frameworks: { nist: 'GOV 1.3, 2.1, MAP 1.1', iso: '5.2, A.4.2, A.4.5, A.5.3', aiuc: 'E010' } },
    { id: 'E011', title: 'Processing Locations', status: 'addressed', group: 'Safety',
      detail: 'Local PostgreSQL + Anthropic inference (US-based).',
      frameworks: { nist: 'GOV 1.6', iso: 'A.7.5', aiuc: 'E011' } },
    { id: 'E012', title: 'Regulatory Compliance Docs', status: 'addressed', group: 'Safety',
      detail: 'NIST, ISO 42001, AIUC-1 gap analyses. System card.',
      frameworks: { nist: 'GOV 1.1, 1.2, 1.7', iso: '4.1, 4.2, A.2.2, A.4.4', aiuc: 'E012' } },
    { id: 'E015', title: 'Log Model Activity', status: 'addressed', group: 'Safety',
      detail: 'Full provenance: classification, scores, prompt, response, eval, ratings.',
      frameworks: { nist: 'MEA 2.4, 2.8', iso: 'A.6.2.8', aiuc: 'E015' } },
    { id: 'E016', title: 'AI Disclosure', status: 'addressed', group: 'Safety',
      detail: 'UI built around inspecting AI decision-making.',
      frameworks: { nist: 'MAP 2.2, MEA 2.8', iso: 'A.8.2', aiuc: 'E016' } },
    { id: 'E017', title: 'System Transparency', status: 'addressed', group: 'Safety',
      detail: 'Interpretable scoring. Spread activation visible. Neuron content inspectable.',
      frameworks: { nist: 'GOV 1.1, MAP 1.1', iso: '5.2, A.4.2, A.8.2', aiuc: 'E017' } },

    // Accountability
    { id: 'E004', title: 'Assign Accountability', status: 'addressed', group: 'Accountability',
      detail: 'System Owner, Content Author, Query Reviewer with separation of concerns.',
      frameworks: { nist: 'GOV 2.1, MAP 3.5, MEA 2.8', iso: '5.1, 5.3, A.3.2, A.4.6', aiuc: 'E004' } },

    // ISO 42001 specific items not already covered
    { id: '5.1', title: 'Leadership & Commitment', status: 'addressed', group: 'ISO 42001',
      detail: 'System Owner role with decision authority. Risk tolerance thresholds set.',
      frameworks: { iso: '5.1', aiuc: 'E004' } },
    { id: '5.2', title: 'AI Policy', status: 'addressed', group: 'ISO 42001',
      detail: 'Deployment constraints. Acceptable use policy in system card.',
      frameworks: { iso: '5.2', aiuc: 'E010, E017' } },
    { id: '6.1', title: 'Actions for Risks & Opportunities', status: 'partial', group: 'ISO 42001',
      detail: 'Risk map covers 15 failure modes. Missing: formal treatment plan with accept/mitigate/transfer.',
      frameworks: { iso: '6.1', nist: 'MAP 3.2, GOV 1.3' } },
    { id: '6.3', title: 'Planning of Changes', status: 'missing', group: 'ISO 42001',
      detail: 'No formal change advisory board. Neuron refinements require approval; code changes do not.',
      frameworks: { iso: '6.3', nist: 'MAN 4.2', aiuc: 'E007' } },
    { id: '7.4', title: 'Communication', status: 'partial', group: 'ISO 42001',
      detail: 'Incident format defined. Missing: stakeholder communication plan, regular reporting.',
      frameworks: { iso: '7.4', nist: 'MAN 4.3', aiuc: 'E014' } },
    { id: '8.1', title: 'Operational Planning & Control', status: 'partial', group: 'ISO 42001',
      detail: 'Pipeline well-defined. Missing: formal operational procedures document.',
      frameworks: { iso: '8.1', nist: 'MAP 2.1' } },
    { id: '9.3', title: 'Management Review', status: 'addressed', group: 'ISO 42001',
      detail: '7 review types with cadence enforcement, findings, decisions, action items.',
      frameworks: { iso: '9.3', aiuc: 'C008, E014' } },
    { id: 'A.6.2.2', title: 'Development Lifecycle', status: 'missing', group: 'ISO 42001',
      detail: 'No formal stage gates, design reviews, or development standards.',
      frameworks: { iso: 'A.6.2.2', nist: 'MAN 4.2', aiuc: 'E007' } },
    { id: 'A.9.3', title: 'AI System Audit', status: 'addressed', group: 'ISO 42001',
      detail: 'Compliance snapshots, evidence map, self-assessment report generator.',
      frameworks: { iso: 'A.9.3', aiuc: 'C007, E008' } },
    { id: 'A.9.4', title: 'Management Review of AIMS', status: 'addressed', group: 'ISO 42001',
      detail: 'Review page captures inputs (snapshots, health data) and outputs (findings, actions).',
      frameworks: { iso: 'A.9.4', aiuc: 'C008, E008' } },

    // ── FedRAMP Moderate (NIST 800-53 Rev 5 baseline) ──
    { id: 'FR-AC', title: 'Access Control', status: 'partial', group: 'FedRAMP',
      detail: 'PostgreSQL role-based access. API has no authentication layer yet. Missing: RBAC enforcement, session management, account lockout, least privilege enforcement.',
      frameworks: { fedramp: 'AC-1 thru AC-22', cmmc: '3.1.1–3.1.22', soc2: 'CC6.1–CC6.3' } },
    { id: 'FR-AU', title: 'Audit & Accountability', status: 'partial', group: 'FedRAMP',
      detail: 'Query provenance logged. Corvus captures timestamped. Missing: centralized audit log with tamper protection, audit log review, log retention policy, time sync.',
      frameworks: { fedramp: 'AU-1 thru AU-16', cmmc: '3.3.1–3.3.9', soc2: 'CC7.2, CC7.3' } },
    { id: 'FR-AT', title: 'Awareness & Training', status: 'missing', group: 'FedRAMP',
      detail: 'No formal security awareness training program. Getting Started page covers operational use only.',
      frameworks: { fedramp: 'AT-1 thru AT-4', cmmc: '3.2.1–3.2.3' } },
    { id: 'FR-CM', title: 'Configuration Management', status: 'partial', group: 'FedRAMP',
      detail: 'Git-tracked code. Database migrations idempotent. Missing: baseline configuration documentation, change control board, configuration monitoring, software usage restrictions.',
      frameworks: { fedramp: 'CM-1 thru CM-11', cmmc: '3.4.1–3.4.9', soc2: 'CC8.1' } },
    { id: 'FR-CP', title: 'Contingency Planning', status: 'missing', group: 'FedRAMP',
      detail: 'No contingency plan, backup procedures, or disaster recovery documented. Neuron checkpoints exist but are not formalized as backup strategy.',
      frameworks: { fedramp: 'CP-1 thru CP-13', soc2: 'A1.1–A1.3' } },
    { id: 'FR-IA', title: 'Identification & Authentication', status: 'missing', group: 'FedRAMP',
      detail: 'No user authentication. Single-user local deployment. Multi-tenant would require MFA, credential management, authenticator lifecycle.',
      frameworks: { fedramp: 'IA-1 thru IA-11', cmmc: '3.5.1–3.5.11', soc2: 'CC6.1' } },
    { id: 'FR-IR', title: 'Incident Response', status: 'partial', group: 'FedRAMP',
      detail: 'P1-P4 severity levels defined in governance.md. Circuit breaker + alert workflow. Missing: incident response plan, incident handling procedures, incident reporting to authorities, incident response testing.',
      frameworks: { fedramp: 'IR-1 thru IR-10', cmmc: '3.6.1–3.6.3', soc2: 'CC7.3, CC7.4, CC7.5' } },
    { id: 'FR-MA', title: 'Maintenance', status: 'partial', group: 'FedRAMP',
      detail: 'Dependency versions pinned. Missing: controlled maintenance windows, maintenance tools audit, remote maintenance controls.',
      frameworks: { fedramp: 'MA-1 thru MA-6', cmmc: '3.7.1–3.7.6' } },
    { id: 'FR-MP', title: 'Media Protection', status: 'partial', group: 'FedRAMP',
      detail: 'Corvus screen data ephemeral (never persisted to disk). Missing: media access policy, media sanitization, media transport protection.',
      frameworks: { fedramp: 'MP-1 thru MP-8', cmmc: '3.8.1–3.8.9' } },
    { id: 'FR-PE', title: 'Physical & Environmental Protection', status: 'not-applicable', group: 'FedRAMP',
      detail: 'Software-only product. Physical controls are the responsibility of the hosting environment (cloud provider or on-prem facility).',
      frameworks: { fedramp: 'PE-1 thru PE-20', cmmc: '3.10.1–3.10.6' } },
    { id: 'FR-PL', title: 'Planning', status: 'partial', group: 'FedRAMP',
      detail: 'CLAUDE.md defines development standards. Governance docs cover operational rules. Missing: formal System Security Plan (SSP), rules of behavior document.',
      frameworks: { fedramp: 'PL-1 thru PL-8' } },
    { id: 'FR-PS', title: 'Personnel Security', status: 'not-applicable', group: 'FedRAMP',
      detail: 'Single developer. Personnel screening, termination procedures, and transfer controls apply at organizational level, not software level.',
      frameworks: { fedramp: 'PS-1 thru PS-8', cmmc: '3.9.1–3.9.2' } },
    { id: 'FR-RA', title: 'Risk Assessment', status: 'addressed', group: 'FedRAMP',
      detail: 'Risk register with 15 failure modes, likelihood x impact scoring, treatment decisions. Risk map documented. Quarterly reassessment cadence.',
      frameworks: { fedramp: 'RA-1 thru RA-7', cmmc: '3.11.1–3.11.3', soc2: 'CC3.1–CC3.4' } },
    { id: 'FR-SA', title: 'System & Services Acquisition', status: 'partial', group: 'FedRAMP',
      detail: 'Anthropic SDK pinned. Third-party risk documented. Missing: supply chain risk management plan, acquisition process controls, developer security testing.',
      frameworks: { fedramp: 'SA-1 thru SA-22' } },
    { id: 'FR-SC', title: 'System & Communications Protection', status: 'partial', group: 'FedRAMP',
      detail: 'Local deployment (localhost only). Input guard blocks injection. Missing: boundary protection for multi-tenant, encryption in transit (TLS), encryption at rest, session authenticity.',
      frameworks: { fedramp: 'SC-1 thru SC-44', cmmc: '3.13.1–3.13.16', soc2: 'CC6.1, CC6.6, CC6.7' } },
    { id: 'FR-SI', title: 'System & Information Integrity', status: 'partial', group: 'FedRAMP',
      detail: 'Input validation (16 patterns). Output risk tagging. PII scanning. Missing: flaw remediation process, malicious code protection, security alerts monitoring, software/firmware integrity verification.',
      frameworks: { fedramp: 'SI-1 thru SI-16', cmmc: '3.14.1–3.14.7', soc2: 'CC7.1, CC7.2' } },
    { id: 'FR-CA', title: 'Security Assessment & Authorization', status: 'missing', group: 'FedRAMP',
      detail: 'No formal security assessment. No ATO (Authority to Operate). No POA&M (Plan of Action & Milestones). Required for FedRAMP authorization.',
      frameworks: { fedramp: 'CA-1 thru CA-9', cmmc: '3.12.1–3.12.4' } },
    { id: 'FR-PM', title: 'Program Management', status: 'missing', group: 'FedRAMP',
      detail: 'No Information Security Program Plan, no risk management strategy document, no enterprise architecture. Required at organizational level.',
      frameworks: { fedramp: 'PM-1 thru PM-16' } },

    // ── SOC 2 Type II (Trust Services Criteria) ──
    { id: 'SOC-CC1', title: 'Control Environment (COSO)', status: 'partial', group: 'SOC 2',
      detail: 'Governance docs define roles and responsibilities. Risk tolerance thresholds set. Missing: formal organizational structure, board oversight, code of conduct, HR policies.',
      frameworks: { soc2: 'CC1.1–CC1.5' } },
    { id: 'SOC-CC2', title: 'Communication & Information', status: 'partial', group: 'SOC 2',
      detail: 'System card documents components, data flows. Query provenance logged. Missing: external communication policies, whistleblower channel.',
      frameworks: { soc2: 'CC2.1–CC2.3' } },
    { id: 'SOC-CC3', title: 'Risk Assessment', status: 'addressed', group: 'SOC 2',
      detail: 'Risk register with 15 failure modes, scoring, treatment plans. Quarterly reassessment. Risk map documented.',
      frameworks: { soc2: 'CC3.1–CC3.4', fedramp: 'RA-1 thru RA-7', nist: 'MAP 3.2, GOV 1.3' } },
    { id: 'SOC-CC4', title: 'Monitoring Activities', status: 'addressed', group: 'SOC 2',
      detail: 'Scoring Health Monitor with z-score drift detection. Circuit breaker on quality drops. Compliance snapshots with trend tracking.',
      frameworks: { soc2: 'CC4.1–CC4.2', nist: 'GOV 1.5, MEA 2.4' } },
    { id: 'SOC-CC5', title: 'Control Activities', status: 'partial', group: 'SOC 2',
      detail: 'Input guard pre-classification. Output risk tagging. Change management process defined. Missing: automated control testing, segregation of duties enforcement.',
      frameworks: { soc2: 'CC5.1–CC5.3' } },
    { id: 'SOC-CC6', title: 'Logical & Physical Access', status: 'missing', group: 'SOC 2',
      detail: 'No authentication/authorization layer. No access provisioning/deprovisioning. No credential management. Critical gap for multi-user deployment.',
      frameworks: { soc2: 'CC6.1–CC6.8', fedramp: 'AC-1 thru AC-22', cmmc: '3.1.1–3.1.22' } },
    { id: 'SOC-CC7', title: 'System Operations', status: 'partial', group: 'SOC 2',
      detail: 'Health check endpoint. Alert acknowledge/dismiss workflow. Corvus monitoring. Missing: vulnerability management, change detection, incident response testing.',
      frameworks: { soc2: 'CC7.1–CC7.5', fedramp: 'IR-1 thru IR-10' } },
    { id: 'SOC-CC8', title: 'Change Management', status: 'partial', group: 'SOC 2',
      detail: 'Git-tracked changes. NASA code review checklist. Database migrations idempotent. Missing: formal change approval workflow, regression testing automation.',
      frameworks: { soc2: 'CC8.1', fedramp: 'CM-1 thru CM-11' } },
    { id: 'SOC-CC9', title: 'Risk Mitigation', status: 'addressed', group: 'SOC 2',
      detail: 'Risk register with treatment decisions. Third-party risk (Anthropic) documented with mitigation strategies. Vendor risk accepted with controls.',
      frameworks: { soc2: 'CC9.1–CC9.2', nist: 'GOV 6.1, MAP 4.1' } },
    { id: 'SOC-A1', title: 'Availability', status: 'partial', group: 'SOC 2',
      detail: 'Health check endpoint returns system status. Missing: SLA definition, capacity planning, backup/recovery procedures, business continuity plan.',
      frameworks: { soc2: 'A1.1–A1.3', fedramp: 'CP-1 thru CP-13' } },
    { id: 'SOC-PI', title: 'Processing Integrity', status: 'addressed', group: 'SOC 2',
      detail: 'Neuron scoring is deterministic and auditable. 5-signal scoring with baselines. Output grounding checks. Compliance audit with validation.',
      frameworks: { soc2: 'PI1.1–PI1.5', nist: 'MEA 2.5' } },
    { id: 'SOC-C1', title: 'Confidentiality', status: 'partial', group: 'SOC 2',
      detail: 'Data stored locally only. Corvus screen data ephemeral. Missing: data classification policy, confidentiality commitments, encryption at rest.',
      frameworks: { soc2: 'C1.1–C1.2', fedramp: 'SC-28' } },
    { id: 'SOC-P1', title: 'Privacy', status: 'partial', group: 'SOC 2',
      detail: 'PII scanning in compliance audit. No telemetry collected. Missing: privacy notice, consent management, data retention/disposal policy, privacy impact assessment.',
      frameworks: { soc2: 'P1.1–P1.8', nist: 'MEA 2.10' } },

    // ── CMMC Level 2 (NIST 800-171r2 — 110 CUI security requirements) ──
    { id: 'CMMC-AC', title: 'Access Control (22 practices)', status: 'missing', group: 'CMMC',
      detail: 'No authentication system. No session management. No remote access controls. No wireless access restrictions. Critical: must implement RBAC, MFA, least privilege, and account management before any CUI handling.',
      frameworks: { cmmc: '3.1.1–3.1.22', fedramp: 'AC-1 thru AC-22', soc2: 'CC6.1–CC6.3' } },
    { id: 'CMMC-AT', title: 'Awareness & Training (3 practices)', status: 'missing', group: 'CMMC',
      detail: 'No security awareness training. No insider threat training. Getting Started page is operational, not security-focused.',
      frameworks: { cmmc: '3.2.1–3.2.3', fedramp: 'AT-1 thru AT-4' } },
    { id: 'CMMC-AU', title: 'Audit & Accountability (9 practices)', status: 'partial', group: 'CMMC',
      detail: 'Query provenance logged with full audit trail. Corvus timestamps all captures. Missing: system-level audit events, audit log protection, audit review/analysis/reporting, timestamp correlation.',
      frameworks: { cmmc: '3.3.1–3.3.9', fedramp: 'AU-1 thru AU-16', soc2: 'CC7.2' } },
    { id: 'CMMC-CM', title: 'Configuration Management (9 practices)', status: 'partial', group: 'CMMC',
      detail: 'Git for code CM. Database migrations tracked. requirements.txt pinned. Missing: baseline configurations documented, configuration change control, security impact analysis of changes, access restrictions for change.',
      frameworks: { cmmc: '3.4.1–3.4.9', fedramp: 'CM-1 thru CM-11', soc2: 'CC8.1' } },
    { id: 'CMMC-IA', title: 'Identification & Authentication (11 practices)', status: 'missing', group: 'CMMC',
      detail: 'No user identification or authentication. No MFA. No password policies. No authenticator management. Must implement before handling CUI.',
      frameworks: { cmmc: '3.5.1–3.5.11', fedramp: 'IA-1 thru IA-11', soc2: 'CC6.1' } },
    { id: 'CMMC-IR', title: 'Incident Response (3 practices)', status: 'partial', group: 'CMMC',
      detail: 'P1-P4 severity levels defined. Circuit breaker for automated response. Missing: operational incident response capability, incident handling procedures documented, incident reporting to designated authorities.',
      frameworks: { cmmc: '3.6.1–3.6.3', fedramp: 'IR-1 thru IR-10', soc2: 'CC7.3–CC7.5' } },
    { id: 'CMMC-MA', title: 'Maintenance (6 practices)', status: 'partial', group: 'CMMC',
      detail: 'System maintenance via git-tracked updates. Missing: controlled maintenance procedures, maintenance personnel authorization, remote maintenance session controls, maintenance tool sanitization.',
      frameworks: { cmmc: '3.7.1–3.7.6', fedramp: 'MA-1 thru MA-6' } },
    { id: 'CMMC-MP', title: 'Media Protection (9 practices)', status: 'partial', group: 'CMMC',
      detail: 'Screen captures ephemeral (in-memory only). No persistent media with CUI. Missing: media access policy, media marking, media storage, media transport, media sanitization.',
      frameworks: { cmmc: '3.8.1–3.8.9', fedramp: 'MP-1 thru MP-8' } },
    { id: 'CMMC-PS', title: 'Personnel Security (2 practices)', status: 'not-applicable', group: 'CMMC',
      detail: 'Organizational control. Personnel screening and access revocation on termination are employer responsibilities, not software features.',
      frameworks: { cmmc: '3.9.1–3.9.2', fedramp: 'PS-1 thru PS-8' } },
    { id: 'CMMC-PE', title: 'Physical Protection (6 practices)', status: 'not-applicable', group: 'CMMC',
      detail: 'Software-only. Physical facility controls are the hosting environment responsibility.',
      frameworks: { cmmc: '3.10.1–3.10.6', fedramp: 'PE-1 thru PE-20' } },
    { id: 'CMMC-RA', title: 'Risk Assessment (3 practices)', status: 'addressed', group: 'CMMC',
      detail: 'Risk register with 15 failure modes, likelihood x impact matrix. Vulnerability scanning via compliance audit. Quarterly reassessment schedule.',
      frameworks: { cmmc: '3.11.1–3.11.3', fedramp: 'RA-1 thru RA-7', soc2: 'CC3.1–CC3.4' } },
    { id: 'CMMC-SA', title: 'Security Assessment (4 practices)', status: 'partial', group: 'CMMC',
      detail: 'Compliance snapshots provide periodic self-assessment. Evidence map tracks requirement-to-artifact links. Missing: plan of action for deficiencies, continuous monitoring program.',
      frameworks: { cmmc: '3.12.1–3.12.4', fedramp: 'CA-1 thru CA-9' } },
    { id: 'CMMC-SC', title: 'System & Comms Protection (16 practices)', status: 'partial', group: 'CMMC',
      detail: 'Input guard provides boundary protection at application layer. Data local-only. Missing: TLS enforcement, session authenticity, CUI encryption at rest, network segmentation, DNS/routing integrity.',
      frameworks: { cmmc: '3.13.1–3.13.16', fedramp: 'SC-1 thru SC-44', soc2: 'CC6.6, CC6.7' } },
    { id: 'CMMC-SI', title: 'System & Info Integrity (7 practices)', status: 'partial', group: 'CMMC',
      detail: 'Input validation (16 regex patterns). Output risk tagging. PII detection. Scoring health monitoring. Missing: flaw remediation tracking, malware protection, security alert monitoring.',
      frameworks: { cmmc: '3.14.1–3.14.7', fedramp: 'SI-1 thru SI-16', soc2: 'CC7.1' } },

    // Not Applicable
    { id: 'D003', title: 'Restrict Unsafe Tool Calls', status: 'not-applicable', group: 'N/A',
      detail: 'Retrieval system. No tool calls or autonomous actions.',
      frameworks: { nist: 'GOV 6.1', aiuc: 'D003' } },
    { id: 'D004', title: '3rd-Party Tool Call Testing', status: 'not-applicable', group: 'N/A',
      detail: 'No tool call capability.',
      frameworks: { nist: 'GOV 6.1, MEA 2.6', aiuc: 'D004' } },
    { id: 'A004', title: 'Protect IP & Trade Secrets', status: 'not-applicable', group: 'N/A',
      detail: 'EU AI Act Art. 72 only. Not in scope.',
      frameworks: {} },
  ];

  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = items.filter(i =>
    (!filterGroup || i.group === filterGroup) &&
    (!filterStatus || i.status === filterStatus)
  );

  const groups = [...new Set(items.map(i => i.group))];
  const addressed = items.filter(i => i.status === 'addressed').length;
  const partial = items.filter(i => i.status === 'partial').length;
  const missing = items.filter(i => i.status === 'missing').length;
  const na = items.filter(i => i.status === 'not-applicable').length;

  const statusColor = (s: Status) =>
    s === 'addressed' ? '#22c55e' : s === 'partial' ? '#fb923c' : s === 'not-applicable' ? '#64748b' : '#ef4444';

  const statusLabel = (s: Status) =>
    s === 'addressed' ? 'Addressed' : s === 'partial' ? 'Partial' : s === 'not-applicable' ? 'N/A' : 'Gap';

  const fwColor: Record<string, string> = { nist: '#3b82f6', iso: '#8b5cf6', aiuc: '#f59e0b', fedramp: '#10b981', soc2: '#ec4899', cmmc: '#f97316' };
  const fwLabel: Record<string, string> = { nist: 'NIST', iso: 'ISO', aiuc: 'AIUC-1', fedramp: 'FedRAMP', soc2: 'SOC 2', cmmc: 'CMMC' };

  return (
    <div className="security-page">
      <h2>Unified Compliance View</h2>
      <p className="security-intro">
        Consolidated requirements from <strong>NIST AI RMF</strong>, <strong>ISO/IEC 42001</strong>,
        <strong>AIUC-1</strong>, <strong>FedRAMP Moderate</strong>, <strong>SOC 2 Type II</strong>,
        and <strong>CMMC Level 2</strong> in a single filterable table. Click any row for details.
      </p>

      {/* Summary */}
      <div className="stat-cards" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#22c55e' }}>{addressed}</div>
          <div className="card-label">Addressed</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#fb923c' }}>{partial}</div>
          <div className="card-label">Partial</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#ef4444' }}>{missing}</div>
          <div className="card-label">Gaps</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#64748b' }}>{na}</div>
          <div className="card-label">N/A</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{items.length}</div>
          <div className="card-label">Total</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
          style={selectStyle}>
          <option value="">All Groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="addressed">Addressed</option>
          <option value="partial">Partial</option>
          <option value="missing">Gap</option>
          <option value="not-applicable">N/A</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center' }}>
          Showing {filtered.length} of {items.length}
        </span>
      </div>

      {/* Table */}
      <table className="about-table" style={{ fontSize: '0.8rem' }}>
        <thead>
          <tr>
            <th style={{ width: 70 }}>ID</th>
            <th>Requirement</th>
            <th style={{ width: 80 }}>Status</th>
            <th style={{ width: 90 }}>Group</th>
            <th style={{ width: 200 }}>Frameworks</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(item => (
            <>
              <tr key={item.id}
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                style={{ cursor: 'pointer' }}
              >
                <td><code>{item.id}</code></td>
                <td style={{ fontWeight: 500 }}>{item.title}</td>
                <td>
                  <span style={{
                    display: 'inline-block', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3,
                    background: statusColor(item.status) + '22', color: statusColor(item.status),
                    border: `1px solid ${statusColor(item.status)}44`, fontWeight: 600,
                  }}>
                    {statusLabel(item.status)}
                  </span>
                </td>
                <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.group}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {Object.entries(item.frameworks).filter(([, v]) => v).map(([k, v]) => (
                      <span key={k} title={v} style={{
                        fontSize: '0.6rem', padding: '0px 4px', borderRadius: 2,
                        background: fwColor[k] + '22', color: fwColor[k],
                        border: `1px solid ${fwColor[k]}33`,
                      }}>
                        {fwLabel[k]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
              {expanded === item.id && (
                <tr key={item.id + '-detail'}>
                  <td colSpan={5} style={{ padding: '8px 16px', background: 'var(--bg-input)', fontSize: '0.78rem', color: '#c8d0dc', lineHeight: 1.5 }}>
                    {item.detail}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {Object.entries(item.frameworks).filter(([, v]) => v).map(([k, v]) => (
                        <span key={k} style={{
                          fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3,
                          background: fwColor[k] + '22', color: fwColor[k],
                          border: `1px solid ${fwColor[k]}44`, fontFamily: 'var(--font-mono, monospace)',
                        }}>
                          {fwLabel[k]}: {v}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {/* ── Detailed Security Framework Catalogs ── */}
      <FrameworkCatalogSection />
    </div>
  );
}

function FrameworkCatalogSection() {
  const [activeTab, setActiveTab] = useState<Tab>('fedramp');
  const [summaries, setSummaries] = useState<FrameworkSummary[]>([]);
  const [fedrampData, setFedrampData] = useState<FrameworkControl[]>([]);
  const [fedrampSummary, setFedrampSummary] = useState<FrameworkSummary | null>(null);
  const [soc2Data, setSoc2Data] = useState<FrameworkControl[]>([]);
  const [soc2Summary, setSoc2Summary] = useState<FrameworkSummary | null>(null);
  const [cmmcData, setCmmcData] = useState<FrameworkControl[]>([]);
  const [cmmcSummary, setCmmcSummary] = useState<FrameworkSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFrameworksSummary().then(r => setSummaries(r.frameworks)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'fedramp' && fedrampData.length === 0) {
      fetchFedRAMPControls().then(r => { setFedrampData(r.controls); setFedrampSummary(r.summary); }).finally(() => setLoading(false));
    } else if (activeTab === 'soc2' && soc2Data.length === 0) {
      fetchSOC2Criteria().then(r => { setSoc2Data(r.criteria); setSoc2Summary(r.summary); }).finally(() => setLoading(false));
    } else if (activeTab === 'cmmc' && cmmcData.length === 0) {
      fetchCMMCPractices().then(r => { setCmmcData(r.practices); setCmmcSummary(r.summary); }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [activeTab]);

  const detailStatusColor = (s: string) =>
    s === 'addressed' ? '#22c55e' : s === 'partial' ? '#fb923c' : s === 'inherited' ? '#60a5fa' : s === 'not_applicable' ? '#64748b' : '#ef4444';
  const detailStatusLabel = (s: string) =>
    s === 'addressed' ? 'Addressed' : s === 'partial' ? 'Partial' : s === 'inherited' ? 'Inherited' : s === 'not_applicable' ? 'N/A' : 'Gap';

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    background: activeTab === t ? 'var(--bg-input)' : 'transparent',
    color: activeTab === t ? 'var(--text)' : '#94a3b8',
    border: '1px solid',
    borderColor: activeTab === t ? 'var(--border)' : 'transparent',
    borderBottom: activeTab === t ? '2px solid #60a5fa' : '1px solid var(--border)',
    borderRadius: '6px 6px 0 0',
    marginBottom: -1,
  });

  // Aggregate summary for the overview cards at the top
  const totalCounts: Record<string, number> = {};
  for (const s of summaries) {
    for (const [status, count] of Object.entries(s.status_counts)) {
      totalCounts[status] = (totalCounts[status] || 0) + (count as number);
    }
  }
  const totalAll = Object.values(totalCounts).reduce((a, b) => a + b, 0);

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ color: '#60a5fa', marginBottom: 4 }}>Security Framework Catalogs</h3>
      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 16 }}>
        Detailed control-level assessment for <strong>FedRAMP Moderate</strong> ({summaries[0]?.total_controls || '...'} controls),{' '}
        <strong>SOC 2 Type II</strong> ({summaries[1]?.total_criteria || '...'} criteria),{' '}
        and <strong>CMMC Level 2</strong> ({summaries[2]?.total_practices || '...'} practices).
        Total: {totalAll || '...'} requirements across all three frameworks.
      </p>

      {/* Aggregate status bar */}
      {totalAll > 0 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16, gap: 1 }}>
          {totalCounts.addressed > 0 && <div style={{ flex: totalCounts.addressed, background: '#22c55e' }} title={`Addressed: ${totalCounts.addressed}`} />}
          {totalCounts.partial > 0 && <div style={{ flex: totalCounts.partial, background: '#fb923c' }} title={`Partial: ${totalCounts.partial}`} />}
          {totalCounts.gap > 0 && <div style={{ flex: totalCounts.gap, background: '#ef4444' }} title={`Gap: ${totalCounts.gap}`} />}
          {(totalCounts.inherited || 0) + (totalCounts.not_applicable || 0) > 0 && (
            <div style={{ flex: (totalCounts.inherited || 0) + (totalCounts.not_applicable || 0), background: '#64748b' }}
              title={`Inherited/N/A: ${(totalCounts.inherited || 0) + (totalCounts.not_applicable || 0)}`} />
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={tabStyle('fedramp')} onClick={() => setActiveTab('fedramp')}>FedRAMP Moderate</div>
        <div style={tabStyle('soc2')} onClick={() => setActiveTab('soc2')}>SOC 2 Type II</div>
        <div style={tabStyle('cmmc')} onClick={() => setActiveTab('cmmc')}>CMMC Level 2</div>
      </div>

      {loading && <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Loading framework data...</p>}

      {activeTab === 'fedramp' && fedrampSummary && (
        <>
          <FrameworkSummaryCards summary={fedrampSummary} />
          <FrameworkDetailTable controls={fedrampData} statusColor={detailStatusColor} statusLabel={detailStatusLabel} />
        </>
      )}
      {activeTab === 'soc2' && soc2Summary && (
        <>
          <FrameworkSummaryCards summary={soc2Summary} />
          <FrameworkDetailTable controls={soc2Data} statusColor={detailStatusColor} statusLabel={detailStatusLabel} />
        </>
      )}
      {activeTab === 'cmmc' && cmmcSummary && (
        <>
          <FrameworkSummaryCards summary={cmmcSummary} />
          <FrameworkDetailTable controls={cmmcData} statusColor={detailStatusColor} statusLabel={detailStatusLabel} />
        </>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem',
};
