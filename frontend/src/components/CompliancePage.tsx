import { useState } from 'react';

export default function CompliancePage() {
  type Status = 'addressed' | 'partial' | 'missing' | 'not-applicable';

  interface ComplianceItem {
    id: string;
    title: string;
    status: Status;
    detail: string;
    group: string;
    frameworks: { nist?: string; iso?: string; aiuc?: string };
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

  const fwColor: Record<string, string> = { nist: '#3b82f6', iso: '#8b5cf6', aiuc: '#f59e0b' };
  const fwLabel: Record<string, string> = { nist: 'NIST', iso: 'ISO', aiuc: 'AIUC-1' };

  return (
    <div className="security-page">
      <h2>Unified Compliance View</h2>
      <p className="security-intro">
        Consolidated requirements from <strong>NIST AI RMF</strong>, <strong>ISO/IEC 42001</strong>,
        and <strong>AIUC-1</strong> in a single filterable table. Click any row for details.
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
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem',
};
