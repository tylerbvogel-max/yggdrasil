export default function CompliancePage() {
  type Status = 'addressed' | 'partial' | 'missing' | 'not-applicable';

  interface ComplianceItem {
    id: string;
    title: string;
    status: Status;
    detail: string;
    frameworks: { nist?: string; iso?: string; aiuc?: string };
  }

  // ── Group 1: Security & Adversarial Testing ──
  const securityItems: ComplianceItem[] = [
    { id: 'SEC-1', title: 'Security & Resilience', status: 'partial',
      detail: 'Input guard implements 16 prompt injection regex patterns (instruction override, role hijacking, system prompt extraction, delimiter injection, encoding evasion, data exfiltration). 24 adversarial tests passing. Missing: external red-teaming, formal penetration testing.',
      frameworks: { nist: 'MEASURE 2.7', iso: 'A.6.2.4', aiuc: 'B001, B004, B005' } },
    { id: 'SEC-2', title: 'Safety Risk Evaluation', status: 'partial',
      detail: '24-test adversarial suite covers injection patterns, PII detection, edge cases (empty input, repetition, long input), output risk tagging, and grounding checks. Missing: formal stress testing protocol, chaos engineering, safety statistics dashboard.',
      frameworks: { nist: 'MEASURE 2.6', iso: 'A.6.2.4', aiuc: 'C002, C010' } },
    { id: 'SEC-3', title: 'Critical Thinking & Safety Culture', status: 'addressed',
      detail: 'Refine process requires human review before commit. Input guard with 16 adversarial patterns runs pre-classification. 24-test adversarial suite documents safety expectations. Output risk tagging flags safety-critical, dual-use, and speculative content.',
      frameworks: { nist: 'GOVERN 4.1', iso: 'A.5.2' } },
    { id: 'SEC-4', title: 'TEVV Considerations', status: 'addressed',
      detail: 'Blind A/B evaluation framework validates quality. Input guard provides adversarial testing with 24-test suite (injection detection, PII, edge cases, output risk, grounding). Output grounding check verifies response faithfulness against assembled neuron context.',
      frameworks: { nist: 'MAP 2.3', iso: 'A.6.2.4, A.6.2.5' } },
    { id: 'SEC-5', title: 'Detect Adversarial Input', status: 'addressed',
      detail: 'Input guard (check_input) runs before classification with 16 regex patterns detecting: instruction override, role hijacking, system prompt extraction, delimiter/XML injection, encoding evasion, and data exfiltration. Verdicts: pass/warn/block. Blocked queries return 422 before reaching the LLM.',
      frameworks: { nist: 'GOVERN 1.5, MEASURE 2.4, 2.7, 3.1', aiuc: 'B002' } },
    { id: 'SEC-6', title: 'Implement Real-Time Input Filtering', status: 'addressed',
      detail: 'Real-time input filtering implemented in POST /query. check_input() validates every query: length limits (10K chars), empty input rejection, repetition detection, prompt injection patterns (16 regexes), and PII detection (SSN, email, credit card). Results shown as color-coded banner in QueryLab UI.',
      frameworks: { nist: 'MEASURE 2.7', aiuc: 'B005' } },
    { id: 'SEC-7', title: 'Prevent Harmful Outputs', status: 'addressed',
      detail: 'Domain-scoped neuron graph constrains responses. Output risk tagging (check_output_risk) scans every LLM response for safety-critical content, dual-use/ITAR references, and speculative language. Output grounding check (check_output_grounding) verifies response terms overlap with assembled neuron context and flags ungrounded references. Results shown per-slot in QueryLab UI.',
      frameworks: { nist: 'MEASURE 2.11', iso: 'A.6.2.4', aiuc: 'C003' } },
    { id: 'SEC-8', title: 'Flag High Risk Outputs', status: 'addressed',
      detail: 'Output risk tagging flags 3 risk categories: safety_critical (structural failure, single point of failure), dual_use (ITAR, munitions, weapons), speculative (hedging language, disclaimers). Grounding check provides 0-1 confidence score and lists ungrounded references (standards/regs cited in response but absent from context). Badges shown per-slot in QueryLab.',
      frameworks: { nist: 'GOVERN 3.2, MAP 3.5', iso: 'A.6.1.2, A.9.2, A.9.3', aiuc: 'C007' } },
    { id: 'SEC-9', title: 'Prevent Customer-Defined High Risk Outputs', status: 'partial',
      detail: 'RISK_CATEGORIES dict in input_guard.py provides configurable risk category definitions (regex pattern + description per category). Currently hardcoded for aerospace domain (safety_critical, dual_use, speculative). Missing: UI for customers to define/edit risk categories, policy engine for dynamic rule management.',
      frameworks: { nist: 'MANAGE 1.4', aiuc: 'C005' } },
    { id: 'F001', title: 'Prevent AI Cyber Misuse', status: 'addressed',
      detail: 'Domain-scoped neuron graph limits system to aerospace/defense knowledge retrieval. No code execution capability. Input guard blocks data exfiltration attempts (URL-based send/post patterns). Output risk tagging flags dual-use content (ITAR, munitions, weapons, explosives, targeting). 24 tests validate guard behavior.',
      frameworks: { nist: 'MEASURE 2.7', iso: 'A.5.5', aiuc: 'F001' } },
  ];

  // ── Group 2: Production Monitoring & Feedback Loop ──
  const monitoringItems: ComplianceItem[] = [
    { id: 'MON-1', title: 'Production Monitoring & Alerting', status: 'addressed',
      detail: 'Health check endpoint (/admin/health-check) runs automated drift detection, quality monitoring, and API version tracking. Alerts persisted to system_alerts table with severity levels. Dashboard shows Production Health Check widget with active alerts and dismiss controls.',
      frameworks: { nist: 'MEASURE 2.4', iso: '9.1, A.6.2.6', aiuc: 'C008' } },
    { id: 'MON-2', title: 'Post-Deployment Feedback & TEVV', status: 'addressed',
      detail: 'Thumbs up/down quick-rate buttons added alongside existing 0-1 slider in QueryLab. User ratings feed into neuron avg_utility via EMA, directly influencing future scoring. Feedback drives continuous improvement through the impact signal.',
      frameworks: { nist: 'MANAGE 4.1', iso: 'A.8.3', aiuc: 'C009' } },
    { id: 'MON-3', title: 'Continuous Improvement Triggers', status: 'addressed',
      detail: 'Health check monitors avg eval scores and user ratings against configurable thresholds. When avg eval drops below 2.5/5 or avg rating below 0.3, circuit breaker triggers. Zero-hit rate >40% raises warnings. Alerts drive refinement actions.',
      frameworks: { nist: 'MANAGE 4.2', iso: '10.1, 10.2', aiuc: 'E013' } },
    { id: 'MON-4', title: 'Third-Party API Monitoring', status: 'addressed',
      detail: 'Model version string captured per query from Claude CLI response. Health check detects version changes across recent queries and raises alerts. Multiple model versions in the recent window trigger an api_change alert.',
      frameworks: { nist: 'MANAGE 3.1', iso: 'A.5.5', aiuc: 'E009' } },
    { id: 'MON-5', title: 'System Viability Assessment', status: 'addressed',
      detail: 'Go/no-go criteria defined as configurable thresholds: min avg eval overall (2.5), min avg user rating (0.3), max zero-hit rate (40%), drift z-score threshold (2.0). Health check returns explicit go/no-go status.',
      frameworks: { nist: 'MANAGE 1.1', iso: '6.2' } },
    { id: 'MON-6', title: 'Real-Time Feedback and Intervention', status: 'addressed',
      detail: 'Circuit breaker implemented: health check trips when quality metrics drop below defined thresholds. Dashboard shows circuit breaker status (SYSTEM OK / TRIPPED) with reasons. Alert system with acknowledge/dismiss workflow provides intervention controls.',
      frameworks: { nist: 'GOVERN 3.2, MAP 3.5, MEASURE 3.3', iso: 'A.8.3', aiuc: 'C009' } },
  ];

  // ── Group 3: Metrics, Evaluation & Bias ──
  const metricsItems: ComplianceItem[] = [
    { id: 'MET-1', title: 'Metrics Selection & Documentation', status: 'addressed',
      detail: 'Compliance Audit page computes per-signal scoring baselines (mean, stddev, percentiles P25/P50/P75/P95) across all queries. Metric selection rationale documented for each of the 6 signals (Burst, Impact, Precision, Novelty, Recency, Relevance). A/B quality scores and neuron hit rates tracked.',
      frameworks: { nist: 'MEASURE 1.1', iso: '9.1' } },
    { id: 'MET-2', title: 'Validity & Reliability', status: 'addressed',
      detail: 'Compliance Audit page provides: 95% confidence intervals for all eval dimensions per answer mode (mean, CI bounds, stderr), 5-fold cross-validation stability analysis with fold CV threshold < 10%, and scoring signal robustness via per-signal coefficient of variation. Blind A/B framework validates model quality. Scoring baselines with percentile distributions (P25/P50/P75/P95) provide statistical characterization.',
      frameworks: { nist: 'MEASURE 2.5', iso: 'A.6.2.4, A.6.2.5', aiuc: 'D001' } },
    { id: 'MET-3', title: 'Privacy Risk & PII Scanning', status: 'addressed',
      detail: 'Input guard detects PII in queries (SSN, email, credit card). Compliance Audit page runs automated PII scan across all neuron content, summary, and label fields detecting SSN, email, credit card, and phone patterns. Results show per-neuron findings with PASS/FAIL badge. Query data stored locally only.',
      frameworks: { nist: 'MEASURE 2.10', iso: 'A.7.5', aiuc: 'A006' } },
    { id: 'MET-4', title: 'Fairness & Bias Assessment', status: 'addressed',
      detail: 'Compliance Audit page provides: department coverage CV with imbalance detection (CV > 0.5), per-department eval quality comparison (cross-department quality parity), invocation disparity ratio, utility range analysis, and automated remediation plan with severity-ranked action items for coverage gaps, quality gaps, and utilization gaps. Coverage CV tracked as governance KPI.',
      frameworks: { nist: 'MEASURE 2.11', iso: 'A.5' } },
    { id: 'MET-5', title: 'Prevent Hallucinated Outputs', status: 'addressed',
      detail: 'Neuron-grounded prompt assembly reduces hallucination. Blind evals score faithfulness (1-5). Output grounding check (check_output_grounding) compares response terms against assembled neuron context, computing 0-1 confidence score and flagging ungrounded references (standards/regs cited but absent from context). Grounding percentage shown per-slot in QueryLab.',
      frameworks: { nist: 'MEASURE 2.5', aiuc: 'D001' } },
    { id: 'A007', title: 'Prevent IP Violations', status: 'addressed',
      detail: 'Source-typed neurons track provenance (source_type, source_origin, citation, source_url, effective_date, last_verified). Compliance Audit provenance audit checks: source type distribution, missing citations on primary neurons, missing source URLs, stale verification dates (>365 days). Regulatory primary neurons never LLM-paraphrased.',
      frameworks: { nist: 'GOVERN 6.1, MAP 4.1', iso: 'A.7.5', aiuc: 'A007' } },
  ];

  // ── Group 4: Governance Documentation & Process Formalization ──
  const governanceItems: ComplianceItem[] = [
    { id: 'GOV-1', title: 'Change Management Process', status: 'addressed',
      detail: 'Governance page documents 4-step change control process: Proposal (refine), Review (UI diff), Approval (cherry-pick), Audit Trail (refinement log). All neuron changes tracked with action, field, old/new values, reason, timestamp. Live change activity metrics (30-day refinements, autopilot runs) displayed.',
      frameworks: { nist: 'MANAGE 4.2', iso: '6.3, A.6.2.2', aiuc: 'E007' } },
    { id: 'GOV-2', title: 'Risk Register & Treatment Plan', status: 'addressed',
      detail: 'Governance page displays formal risk register with 15 risks: likelihood x impact scoring (1-5 scale), color-coded risk scores, treatment decisions (Mitigate/Monitor/Accept), and specific controls for each risk. Quarterly reassessment scheduled in Review Schedule.',
      frameworks: { nist: 'MAP 3.2, GOVERN 1.3', iso: '6.1, 8.2, 8.3, A.5, A.5.2, A.5.3' } },
    { id: 'GOV-3', title: 'Document Control & Retention', status: 'addressed',
      detail: 'Governance page Document Registry tracks all governance documents with location, version, status, and review cycle. Documents include governance.md, risk-map.md, system-card.md, plus live UI pages (Compliance, Audit, Governance). Neuron checkpoints provide data retention.',
      frameworks: { iso: '7.5', aiuc: 'E011, E012, E013' } },
    { id: 'GOV-4', title: 'AI Objectives & Measurement', status: 'addressed',
      detail: 'Governance page AI Objectives section displays 8 formal KPIs with defined targets and live progress from system data: eval overall (>= 3.5), faithfulness (>= 4.0), user rating (>= 0.60), zero-hit rate (<= 20%), cost per 1M tokens (<= $4.00, 80% reduction vs Opus), Parity Index (>= 85% neuron/opus quality ratio), Value Score (>= 2.0 quality-adjusted cost ratio), evaluation coverage (>= 50%). Green/amber status indicators.',
      frameworks: { iso: '6.2, 9.1' } },
    { id: 'GOV-5', title: 'Communication & Reporting', status: 'addressed',
      detail: 'Governance page Communication & Reporting section defines 6 report types: daily health summary, weekly quality trends, monthly KPI status, quarterly compliance audit, quarterly risk review, and as-needed incident reports. Each specifies audience, frequency, content, and data source.',
      frameworks: { nist: 'MANAGE 4.3', iso: '7.4', aiuc: 'E014' } },
    { id: 'GOV-6', title: 'Impact Assessment Formalization', status: 'addressed',
      detail: 'Governance page Impact Assessment section provides formal stakeholder analysis: end users, organization, customers, and regulators. Each with positive impact, negative impact, and mitigation controls. Linked to specific system features (grounding check, risk tagging, provenance).',
      frameworks: { nist: 'MAP 3.2', iso: '8.4', aiuc: 'E001, E002, E003' } },
    { id: 'GOV-7', title: 'Nonconformity & Corrective Action', status: 'addressed',
      detail: 'Governance page documents 5-step nonconformity process: Detection (circuit breaker, alerts, audits), Documentation (system_alerts table), Root Cause Analysis (scoring health + refinement log review), Corrective Action (refinement, pattern update, checkpoint restore), Verification (re-run + eval + audit).',
      frameworks: { iso: '10.1, 10.2', aiuc: 'E013' } },
    { id: 'GOV-8', title: 'Review Internal Processes', status: 'addressed',
      detail: 'Governance page Review Schedule defines 9 review activities with frequency (daily to semi-annual), owner, and method. Covers: drift review (weekly), health check (daily automated), content audit (monthly), PII scan (monthly), governance docs (quarterly), risk register (quarterly), bias assessment (quarterly), scoring weights (semi-annual), compliance gap analysis (semi-annual).',
      frameworks: { nist: 'GOVERN 1.5, MANAGE 4.1', iso: '9.2, 9.3, A.6.2.6, A.9.3, A.9.4', aiuc: 'E008' } },
    { id: 'GOV-9', title: 'Concern Reporting Channel', status: 'addressed',
      detail: 'Governance page Concern Reporting section defines 3 channels: User Feedback (thumbs up/down per query, low ratings trigger circuit breaker), System Alerts (automated generation for drift/quality/API changes with dashboard visibility), Issue Tracking (repository issue tracker for system concerns and compliance gaps).',
      frameworks: { iso: 'A.4.4', aiuc: 'E012' } },
    { id: 'E001', title: 'AI Failure Plan for Security Breaches', status: 'addressed',
      detail: 'Governance page Security Breach Playbook (P1): trigger conditions, 7-step response procedure (circuit breaker trip, alert review, attack vector analysis, pattern update, test suite validation, incident documentation, exfiltration audit). Linked to input guard and system alerts.',
      frameworks: { nist: 'GOVERN 4.3, MANAGE 1.3, 4.3', iso: 'A.8.4, A.8.5', aiuc: 'E001' } },
    { id: 'E002', title: 'AI Failure Plan for Harmful Outputs', status: 'addressed',
      detail: 'Governance page Harmful Output Playbook (P1): trigger conditions (>10% risk-flagged responses), 7-step procedure (review flagged outputs, identify source neurons, deactivate, update risk categories, verify fix, halt if systematic, document). Linked to output risk tagging.',
      frameworks: { nist: 'GOVERN 4.3, MANAGE 1.3, 4.3', iso: 'A.8.4', aiuc: 'E002' } },
    { id: 'E003', title: 'AI Failure Plan for Hallucinations', status: 'addressed',
      detail: 'Governance page Hallucination Playbook (P2): trigger conditions (grounding <0.3 for >30% OR faithfulness <3.0), 7-step procedure (circuit breaker, grounding review, refinement audit, autopilot revert, blind eval, checkpoint restore, compliance audit). Linked to grounding check and eval system.',
      frameworks: { nist: 'GOVERN 4.3, MANAGE 1.3, 4.3', iso: 'A.8.4', aiuc: 'E003' } },
  ];

  // ── Group 5: Independent Assessment & Audit ──
  const auditItems: ComplianceItem[] = [
    { id: 'AUD-1', title: 'Independent Assessment', status: 'missing',
      detail: 'All testing done by sole developer. No external review, no separation of development and testing functions.',
      frameworks: { nist: 'MEASURE 1.3', iso: '9.2, A.9.3' } },
    { id: 'AUD-2', title: 'Third-Party Adversarial Robustness Testing', status: 'missing',
      detail: 'External auditor requirement. Cannot be self-certified. System must implement input filtering and auth before this testing is meaningful.',
      frameworks: { nist: 'GOVERN 4.3, MEASURE 2.1, 2.6, 2.7', aiuc: 'B001' } },
    { id: 'AUD-3', title: 'Third-Party Testing for Harmful/OOS Outputs', status: 'missing',
      detail: 'External auditor requirement. Covers harmful outputs (C010), out-of-scope outputs (C011), and customer-defined risk (C012). Depends on output filtering being implemented first.',
      frameworks: { nist: 'MEASURE 2.6, 2.7, 2.11', iso: 'A.6.2.4', aiuc: 'C010, C011, C012' } },
    { id: 'AUD-4', title: 'Third-Party Testing for Hallucinations', status: 'missing',
      detail: 'External auditor requirement. The blind A/B framework with faithfulness scoring provides testing infrastructure, but independent verification has not been performed.',
      frameworks: { nist: 'MEASURE 2.5, 2.6, 2.7', iso: 'A.6.2.4', aiuc: 'D002' } },
    { id: 'AUD-5', title: 'Management Review', status: 'missing',
      detail: 'No scheduled management review of AI system performance, risk posture, or improvement opportunities. Would need regular review meetings with documented minutes and action items.',
      frameworks: { iso: '9.3, A.9.4', aiuc: 'C008, E008' } },
  ];

  // ── Group 6: Personnel Training ──
  const trainingItems: ComplianceItem[] = [
    { id: 'TRN-1', title: 'Personnel Training & Competence', status: 'partial',
      detail: 'Getting Started page provides setup guide and training walkthrough. Operational checklist included. Missing: role-based training paths, competence assessment/certification, training records, video walkthroughs.',
      frameworks: { nist: 'GOVERN 2.2', iso: 'A.4.6', aiuc: 'E004' } },
  ];

  // ── Addressed: Governance & Policy ──
  const addressedGovernance: ComplianceItem[] = [
    { id: 'GOV-1.3', title: 'Risk Tolerance & Prioritization', status: 'addressed',
      detail: 'Defined acceptable/unacceptable risks, escalation thresholds (A/B quality drop >15% = investigate, >30% = stop), and risk severity levels in governance.md.',
      frameworks: { nist: 'GOVERN 1.3', iso: '5.2, A.5' } },
    { id: 'GOV-1.4', title: 'Transparent Documentation', status: 'addressed',
      detail: 'Full query provenance (intent, scores, neuron hits, assembled prompt, response) logged and visible in UI. System card documents architecture and data practices.',
      frameworks: { nist: 'GOVERN 1.4', iso: '7.5' } },
    { id: 'GOV-1.5', title: 'Ongoing Monitoring & Review', status: 'addressed',
      detail: 'Blind A/B framework for periodic quality checks. Scoring Health Monitor on Dashboard tracks per-signal distributions (baseline vs recent window) with automated z-score drift detection and visual alerting.',
      frameworks: { nist: 'GOVERN 1.5', iso: '9.1, A.5.5, A.6.2.6' } },
    { id: 'GOV-1.6', title: 'AI System Inventory', status: 'addressed',
      detail: 'System card (system-card.md) documents all components, models used, data flows, and dependencies.',
      frameworks: { nist: 'GOVERN 1.6', iso: 'A.6.1.2' } },
    { id: 'GOV-1.7', title: 'Decommissioning Procedures', status: 'addressed',
      detail: 'Contingency plan for model deprecation, vendor lock-in mitigation (model-agnostic architecture), fallback strategies documented.',
      frameworks: { nist: 'GOVERN 1.7' } },
    { id: 'GOV-2.1', title: 'Roles & Responsibilities', status: 'addressed',
      detail: 'System Owner, Neuron Content Author, Query Reviewer roles defined with separation of concerns matrix.',
      frameworks: { nist: 'GOVERN 2.1', iso: '5.1, 5.3, A.3.2', aiuc: 'E004' } },
    { id: 'GOV-4.3', title: 'Incident Response', status: 'addressed',
      detail: 'P1-P4 severity levels defined with response procedures. Incident log format specified.',
      frameworks: { nist: 'GOVERN 4.3', iso: 'A.8.4', aiuc: 'E001, E002, E003' } },
    { id: 'GOV-6.1', title: 'Third-Party Risk Management', status: 'addressed',
      detail: 'Anthropic API risks documented with mitigation. Model-agnostic architecture prevents vendor lock-in. Python dependency risks assessed.',
      frameworks: { nist: 'GOVERN 6.1', iso: 'A.5.4' } },
  ];

  // ── Addressed: Context & Scoping ──
  const addressedContext: ComplianceItem[] = [
    { id: 'MAP-1.1', title: 'Intended Purpose Documentation', status: 'addressed',
      detail: 'System purpose, scope, deployment context, and out-of-scope uses documented in system card and risk map.',
      frameworks: { nist: 'MAP 1.1', iso: '4.1, 4.2', aiuc: 'E010, E012' } },
    { id: 'MAP-2.1', title: 'Technical Task Definition', status: 'addressed',
      detail: 'Two-stage pipeline (classify + execute) with deterministic scoring/assembly documented. Component dependency diagram in system card.',
      frameworks: { nist: 'MAP 2.1', iso: 'A.6.1.2' } },
    { id: 'MAP-2.2', title: 'Knowledge Limits Documentation', status: 'addressed',
      detail: 'Coverage gaps documented (software eng, supply chain, HR, international programs). Out-of-scope topics listed.',
      frameworks: { nist: 'MAP 2.2', aiuc: 'C004' } },
    { id: 'MAP-3.2', title: 'Negative Impact Analysis', status: 'addressed',
      detail: 'Failure mode analysis covers scoring failures (5 modes), assembly failures (3 modes), execution failures (4 modes), and human factors (3 modes).',
      frameworks: { nist: 'MAP 3.2', iso: '8.2, 8.3' } },
    { id: 'MAP-3.3', title: 'Targeted Application Scope', status: 'addressed',
      detail: 'Narrowly scoped to aerospace domain knowledge retrieval. Deployment constraints (unclassified, single-user, local, English-only) documented.',
      frameworks: { nist: 'MAP 3.3', iso: 'A.4.2, A.4.5', aiuc: 'E010' } },
    { id: 'MAP-3.5', title: 'Human Oversight Definition', status: 'addressed',
      detail: 'Oversight levels defined per activity: query execution (none, advisory), refinement (required), weight changes (required), bulk import (required).',
      frameworks: { nist: 'MAP 3.5', iso: 'A.8.2' } },
    { id: 'MAP-4.1', title: 'Third-Party Technology Risk', status: 'addressed',
      detail: 'Anthropic API risks mapped (deprecation, pricing, policy, behavior drift) with likelihood, impact, and mitigation.',
      frameworks: { nist: 'MAP 4.1', iso: 'A.5.4' } },
  ];

  // ── Addressed: Transparency & Logging ──
  const addressedTransparency: ComplianceItem[] = [
    { id: 'MEA-2.8', title: 'Transparency & Accountability', status: 'addressed',
      detail: 'Full audit trail: query logs with intent, neuron scores (5 signals decomposed), assembled prompt, response. Radial visualization. Provenance chain visible in UI.',
      frameworks: { nist: 'MEASURE 2.8', iso: 'A.6.2.8', aiuc: 'E015' } },
    { id: 'MEA-2.9', title: 'Model Explainability', status: 'addressed',
      detail: '5-signal scoring is inherently interpretable. Spread activation visible. Neuron content inspectable. Token budget transparent.',
      frameworks: { nist: 'MEASURE 2.9', iso: 'A.8.2', aiuc: 'E016, E017' } },
    { id: 'MAN-1.4', title: 'Residual Risk Documentation', status: 'addressed',
      detail: 'Known limitations documented in system card: coverage gaps, no adversarial testing, English-only.',
      frameworks: { nist: 'MANAGE 1.4', iso: 'A.5.3' } },
    { id: 'MAN-2.4', title: 'System Disengagement Criteria', status: 'addressed',
      detail: 'Red thresholds defined: A/B quality drop >30%, >40% zero-hit queries, >25% bad answer reports triggers stop-serving.',
      frameworks: { nist: 'MANAGE 2.4' } },
    { id: 'MAN-4.3', title: 'Incident Communication', status: 'addressed',
      detail: 'Incident log format and response procedures defined. Severity levels with response times.',
      frameworks: { nist: 'MANAGE 4.3', iso: 'A.8.4, A.8.5' } },
  ];

  // ── Addressed: Data & Privacy ──
  const addressedData: ComplianceItem[] = [
    { id: 'A001', title: 'Input Data Policy', status: 'addressed',
      detail: 'Queries stored locally in PostgreSQL only. No external transmission beyond Anthropic API calls.',
      frameworks: { nist: 'MEASURE 2.10', iso: 'A.7.2, A.7.3', aiuc: 'A001' } },
    { id: 'A002', title: 'Output Data Policy', status: 'addressed',
      detail: 'All responses stored locally with full provenance chain. No output data shared externally.',
      frameworks: { aiuc: 'A002' } },
    { id: 'A003', title: 'Limit AI Agent Data Collection', status: 'addressed',
      detail: 'System collects only query text and user ratings. No telemetry, no usage analytics, no behavioral tracking.',
      frameworks: { nist: 'MAP 2.1', iso: 'A.7.2, A.7.3', aiuc: 'A003' } },
    { id: 'A005', title: 'Prevent Cross-Customer Data Exposure', status: 'addressed',
      detail: 'Single-user local deployment. No multi-tenant architecture. No cross-customer data path exists.',
      frameworks: { nist: 'MEASURE 2.10', aiuc: 'A005' } },
    { id: 'A007-A', title: 'Data Quality & Provenance', status: 'addressed',
      detail: 'Every neuron tracks: source_type, source_origin, citation, effective_date, last_verified, source_url, source_version. Regulatory neurons link to specific documents.',
      frameworks: { iso: 'A.7.2, A.7.3' } },
    { id: 'A007-B', title: 'Data Sharing & Transfer', status: 'addressed',
      detail: 'All data stored locally in PostgreSQL. Only data shared externally is assembled prompt context sent to Anthropic API. No other data transfer paths.',
      frameworks: { iso: 'A.7.5', aiuc: 'E011' } },
  ];

  // ── Addressed: Safety & Reliability ──
  const addressedSafety: ComplianceItem[] = [
    { id: 'C004', title: 'Prevent Out-of-Scope Outputs', status: 'addressed',
      detail: 'Knowledge boundaries documented in system card. Classification stage scopes queries to known departments/roles. LLM responses grounded in assembled neuron context.',
      frameworks: { nist: 'MAP 2.2, 3.4', aiuc: 'C004' } },
    { id: 'C008', title: 'Monitor AI Risk Categories', status: 'addressed',
      detail: 'Scoring Health Monitor on Dashboard tracks all 6 signal distributions with automated z-score drift detection. Blind A/B evaluation tracks quality. Performance page shows cost and token trends.',
      frameworks: { nist: 'GOVERN 1.5, MANAGE 3.1, 4.1, MEASURE 2.4, 4.3', iso: '9.1, 9.3, 10.1, 10.2, A.6.2.6, A.9.4', aiuc: 'C008' } },
    { id: 'B006', title: 'Prevent Unauthorized AI Agent Actions', status: 'addressed',
      detail: 'Yggdrasil is a retrieval system, not agentic. No tool calls, code execution, or autonomous actions. Neuron refinements require explicit human approval.',
      frameworks: { nist: 'MAP 2.1', aiuc: 'B006' } },
    { id: 'B009', title: 'Limit Output Over-Exposure', status: 'addressed',
      detail: 'Token-budgeted prompt assembly limits context exposure per query (configurable 1K\u201332K). Only top-K scored neurons included.',
      frameworks: { nist: 'MEASURE 2.10', aiuc: 'B009' } },
    { id: 'E010', title: 'AI Acceptable Use Policy', status: 'addressed',
      detail: 'Deployment constraints documented: unclassified data only, single-user, local deployment, English-only, aerospace domain scope.',
      frameworks: { nist: 'GOVERN 1.3, 2.1, MAP 1.1, 1.6', iso: '5.2, A.4.2, A.4.5, A.5.3', aiuc: 'E010' } },
    { id: 'E011', title: 'Processing Locations', status: 'addressed',
      detail: 'All processing is local (PostgreSQL database, Python backend on localhost). LLM inference occurs on Anthropic\'s infrastructure (US-based).',
      frameworks: { nist: 'GOVERN 1.6', iso: 'A.7.5', aiuc: 'E011' } },
    { id: 'E012', title: 'Regulatory Compliance Documentation', status: 'addressed',
      detail: 'NIST AI RMF, ISO 42001, and AIUC-1 gap analyses maintained. System card documents architecture, data practices, and ethical considerations.',
      frameworks: { nist: 'GOVERN 1.1, 1.2, 1.7', iso: '4.1, 4.2, A.2.2, A.4.4', aiuc: 'E012' } },
    { id: 'E015', title: 'Log Model Activity', status: 'addressed',
      detail: 'Full provenance chain logged per query: classification, neuron scores (6 signals), assembled prompt, LLM response, evaluation scores, user ratings.',
      frameworks: { nist: 'MEASURE 2.4, 2.8', iso: 'A.6.2.8', aiuc: 'E015' } },
    { id: 'E016', title: 'AI Disclosure Mechanisms', status: 'addressed',
      detail: 'System is transparently an AI tool \u2014 the entire UI is built around inspecting AI decision-making.',
      frameworks: { nist: 'MAP 2.2, 3.4, MEASURE 2.8', iso: 'A.8.2', aiuc: 'E016' } },
    { id: 'E017', title: 'System Transparency Policy', status: 'addressed',
      detail: '5-signal scoring is inherently interpretable. Spread activation paths visible in UI. Neuron content inspectable.',
      frameworks: { nist: 'GOVERN 1.1, 1.2, MAP 1.1, 1.6', iso: '5.2, A.4.2, A.8.2', aiuc: 'E017' } },
  ];

  // ── Addressed: Accountability ──
  const addressedAccountability: ComplianceItem[] = [
    { id: 'E004', title: 'Assign Accountability', status: 'addressed',
      detail: 'System Owner, Neuron Content Author, and Query Reviewer roles defined in governance.md with separation of concerns matrix.',
      frameworks: { nist: 'GOVERN 2.1, 2.3, MAP 3.5, MEASURE 2.8', iso: '5.1, 5.3, A.3.2, A.4.6, A.5.2, A.5.4', aiuc: 'E004' } },
  ];

  // ── Not Applicable ──
  const notApplicableItems: ComplianceItem[] = [
    { id: 'D003', title: 'Restrict Unsafe Tool Calls', status: 'not-applicable',
      detail: 'Yggdrasil is a retrieval system. No tool calls, code execution, filesystem access, or autonomous actions.',
      frameworks: { nist: 'GOVERN 6.1', aiuc: 'D003' } },
    { id: 'D004', title: 'Third-Party Testing of Tool Calls', status: 'not-applicable',
      detail: 'Not applicable \u2014 no tool call capability exists.',
      frameworks: { nist: 'GOVERN 6.1, MEASURE 2.6, 2.7', aiuc: 'D004' } },
    { id: 'A004', title: 'Protect IP & Trade Secrets', status: 'not-applicable',
      detail: 'Marked N/A \u2014 maps exclusively to EU AI Act Article 72 with no NIST AI RMF or ISO 42001 control. Yggdrasil does not scope to EU AI Act compliance.',
      frameworks: {} },
  ];

  // ── Tallies ──
  const allItems: ComplianceItem[] = [
    ...securityItems, ...monitoringItems, ...metricsItems, ...governanceItems,
    ...auditItems, ...trainingItems,
    ...addressedGovernance, ...addressedContext, ...addressedTransparency,
    ...addressedData, ...addressedSafety, ...addressedAccountability,
    ...notApplicableItems,
  ];
  const addressed = allItems.filter(i => i.status === 'addressed').length;
  const partial = allItems.filter(i => i.status === 'partial').length;
  const missing = allItems.filter(i => i.status === 'missing').length;
  const na = allItems.filter(i => i.status === 'not-applicable').length;

  const statusColor = (s: Status) =>
    s === 'addressed' ? '#22c55e' : s === 'partial' ? '#fb923c' : s === 'not-applicable' ? '#64748b' : '#ef4444';

  const statusLabel = (s: Status) =>
    s === 'addressed' ? 'Addressed' : s === 'partial' ? 'Partial' : s === 'not-applicable' ? 'N/A' : 'Gap';

  const frameworkTagColor: Record<string, string> = {
    nist: '#3b82f6',
    iso: '#8b5cf6',
    aiuc: '#f59e0b',
  };

  const frameworkTagLabel: Record<string, string> = {
    nist: 'NIST AI RMF',
    iso: 'ISO 42001',
    aiuc: 'AIUC-1',
  };

  const renderFrameworkTags = (frameworks: ComplianceItem['frameworks']) => {
    const entries = Object.entries(frameworks).filter(([, v]) => v);
    if (entries.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {entries.map(([key, value]) => (
          <span
            key={key}
            style={{
              display: 'inline-block',
              fontSize: '0.65rem',
              padding: '1px 6px',
              borderRadius: 3,
              background: frameworkTagColor[key] + '22',
              color: frameworkTagColor[key],
              border: `1px solid ${frameworkTagColor[key]}44`,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {frameworkTagLabel[key]}: {value}
          </span>
        ))}
      </div>
    );
  };

  const renderSection = (title: string, description: string, items: ComplianceItem[]) => (
    <section className="security-section">
      <h3>{title}</h3>
      <p className="security-section-desc">{description}</p>
      <div className="security-items">
        {items.map(item => (
          <div key={item.id} className="security-item">
            <div className="security-item-header">
              <code className="security-item-id">{item.id}</code>
              <strong className="security-item-title">{item.title}</strong>
              <span className="security-badge" style={{ background: statusColor(item.status) }}>
                {statusLabel(item.status)}
              </span>
            </div>
            <p className="security-item-detail">{item.detail}</p>
            {renderFrameworkTags(item.frameworks)}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="security-page">
      <h2>Unified Compliance Assessment</h2>
      <p className="security-intro">
        Consolidated gap analysis merging requirements from three AI governance frameworks into a single cohesive view.
        Each requirement maps to one or more source frameworks, shown as colored tags. Requirements are organized
        by implementation group so related work can be addressed cohesively.
      </p>

      <table className="about-table" style={{ marginTop: 12, marginBottom: 16 }}>
        <thead>
          <tr><th>Framework</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span style={{ color: '#3b82f6', fontWeight: 600 }}>NIST AI RMF</span></td>
            <td>NIST AI 100-1 &mdash; Risk Management Framework for AI systems. Four functions: Govern, Map, Measure, Manage. Voluntary US federal standard.</td>
          </tr>
          <tr>
            <td><span style={{ color: '#8b5cf6', fontWeight: 600 }}>ISO/IEC 42001</span></td>
            <td>International standard for AI management systems. Certifiable. Covers organizational context, leadership, planning, support, operation, evaluation, and improvement.</td>
          </tr>
          <tr>
            <td><span style={{ color: '#f59e0b', fontWeight: 600 }}>AIUC-1</span></td>
            <td>AI Use Case Standard 1.0 &mdash; first certifiable standard for AI agents. Operationalizes NIST, ISO, and EU AI Act into auditable controls across security, safety, reliability, accountability, and data privacy.</td>
          </tr>
        </tbody>
      </table>

      <div className="security-summary">
        <div className="security-summary-item" style={{ borderColor: '#22c55e' }}>
          <span className="security-summary-count" style={{ color: '#22c55e' }}>{addressed}</span>
          <span className="security-summary-label">Addressed</span>
        </div>
        <div className="security-summary-item" style={{ borderColor: '#fb923c' }}>
          <span className="security-summary-count" style={{ color: '#fb923c' }}>{partial}</span>
          <span className="security-summary-label">Partial</span>
        </div>
        <div className="security-summary-item" style={{ borderColor: '#ef4444' }}>
          <span className="security-summary-count" style={{ color: '#ef4444' }}>{missing}</span>
          <span className="security-summary-label">Gaps</span>
        </div>
        <div className="security-summary-item" style={{ borderColor: '#64748b' }}>
          <span className="security-summary-count" style={{ color: '#64748b' }}>{na}</span>
          <span className="security-summary-label">N/A</span>
        </div>
        <div className="security-summary-item" style={{ borderColor: '#94a3b8' }}>
          <span className="security-summary-count" style={{ color: '#94a3b8' }}>{allItems.length}</span>
          <span className="security-summary-label">Total</span>
        </div>
      </div>

      {renderSection(
        'Group 1: Security & Adversarial Testing',
        'Build: Input validation layer + prompt injection detection + adversarial testing. Covers input sanitization, output filtering, red-teaming, and misuse prevention.',
        securityItems
      )}

      {renderSection(
        'Group 2: Production Monitoring & Feedback Loop',
        'Build: Automated drift alerting + user feedback mechanism + systematic refinement triggers. Extends existing Scoring Health Monitor and user rating infrastructure.',
        monitoringItems
      )}

      {renderSection(
        'Group 3: Metrics, Evaluation & Bias',
        'Build: Formal metric baselines + bias assessment + privacy scanning + IP compliance. Mostly analysis and documentation: define numerical targets, assess coverage bias, add automated scanning.',
        metricsItems
      )}

      {renderSection(
        'Group 4: Governance Documentation & Process Formalization',
        'Build: Templates, procedures, change management, failure playbooks. Primarily documentation work: formalize processes that exist informally, create registers and tracking.',
        governanceItems
      )}

      {renderSection(
        'Group 5: Independent Assessment & Audit',
        'External engagement \u2014 cannot be self-certified. Requires hiring accredited auditors for adversarial testing, output evaluation, and management review. Best tackled after Groups 1\u20134 make the system audit-ready.',
        auditItems
      )}

      {renderSection(
        'Group 6: Personnel Training',
        'Role-based training paths, competence assessment, and certification. Already partially addressed by the Getting Started page. Best completed after monitoring/feedback features exist.',
        trainingItems
      )}

      <section className="security-section" style={{ marginTop: 32 }}>
        <h3>Recommended Implementation Order</h3>
        <p className="security-section-desc">
          Prioritized by dependency chains and risk reduction impact. Earlier groups unblock later groups.
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Priority</th><th>Group</th><th>Rationale</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Group 2: Production Monitoring</td><td>Low-hanging fruit. Extends existing infrastructure (Scoring Health Monitor, user ratings). Provides the feedback loop that validates all subsequent improvements.</td></tr>
            <tr><td>2</td><td>Group 1: Security & Adversarial Testing</td><td>Highest risk reduction. Input filtering and output safety are prerequisites for external audit (Group 5).</td></tr>
            <tr><td>3</td><td>Group 3: Metrics & Evaluation</td><td>Formalizes measurement. Needed to demonstrate compliance quantitatively. Bias assessment and PII scanning are independent work items.</td></tr>
            <tr><td>4</td><td>Group 4: Governance Documentation</td><td>Process formalization. Can proceed in parallel with Groups 1\u20133 but benefits from having monitoring and metrics in place first.</td></tr>
            <tr><td>5</td><td>Group 5: Independent Assessment</td><td>External dependency. Requires Groups 1\u20134 to be substantially complete before auditors can meaningfully test the system.</td></tr>
            <tr><td>6</td><td>Group 6: Personnel Training</td><td>Best done last. Training materials should reflect the final system state including monitoring, feedback, and governance processes.</td></tr>
          </tbody>
        </table>
      </section>

      <section className="security-section" style={{ marginTop: 32, opacity: 0.85 }}>
        <h3>Addressed Requirements</h3>
        <p className="security-section-desc">
          Requirements already satisfied by existing architecture, documentation, and tooling. Organized by theme.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Governance &amp; Policy</h4>
        <div className="security-items">
          {addressedGovernance.map(item => (
            <div key={item.id} className="security-item">
              <div className="security-item-header">
                <code className="security-item-id">{item.id}</code>
                <strong className="security-item-title">{item.title}</strong>
                <span className="security-badge" style={{ background: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="security-item-detail">{item.detail}</p>
              {renderFrameworkTags(item.frameworks)}
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Context &amp; Scoping</h4>
        <div className="security-items">
          {addressedContext.map(item => (
            <div key={item.id} className="security-item">
              <div className="security-item-header">
                <code className="security-item-id">{item.id}</code>
                <strong className="security-item-title">{item.title}</strong>
                <span className="security-badge" style={{ background: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="security-item-detail">{item.detail}</p>
              {renderFrameworkTags(item.frameworks)}
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Transparency &amp; Logging</h4>
        <div className="security-items">
          {addressedTransparency.map(item => (
            <div key={item.id} className="security-item">
              <div className="security-item-header">
                <code className="security-item-id">{item.id}</code>
                <strong className="security-item-title">{item.title}</strong>
                <span className="security-badge" style={{ background: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="security-item-detail">{item.detail}</p>
              {renderFrameworkTags(item.frameworks)}
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Data &amp; Privacy</h4>
        <div className="security-items">
          {addressedData.map(item => (
            <div key={item.id} className="security-item">
              <div className="security-item-header">
                <code className="security-item-id">{item.id}</code>
                <strong className="security-item-title">{item.title}</strong>
                <span className="security-badge" style={{ background: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="security-item-detail">{item.detail}</p>
              {renderFrameworkTags(item.frameworks)}
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Safety &amp; Reliability</h4>
        <div className="security-items">
          {addressedSafety.map(item => (
            <div key={item.id} className="security-item">
              <div className="security-item-header">
                <code className="security-item-id">{item.id}</code>
                <strong className="security-item-title">{item.title}</strong>
                <span className="security-badge" style={{ background: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="security-item-detail">{item.detail}</p>
              {renderFrameworkTags(item.frameworks)}
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16, marginBottom: 4, fontSize: '0.85rem', color: 'var(--text-dim)' }}>Accountability</h4>
        <div className="security-items">
          {addressedAccountability.map(item => (
            <div key={item.id} className="security-item">
              <div className="security-item-header">
                <code className="security-item-id">{item.id}</code>
                <strong className="security-item-title">{item.title}</strong>
                <span className="security-badge" style={{ background: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="security-item-detail">{item.detail}</p>
              {renderFrameworkTags(item.frameworks)}
            </div>
          ))}
        </div>
      </section>

      {renderSection(
        'Not Applicable',
        'Requirements that do not apply to Yggdrasil\'s architecture or deployment scope.',
        notApplicableItems
      )}

      <section className="security-section">
        <h3>Documentation</h3>
        <p className="security-section-desc">
          Full governance documentation is maintained in the <code>docs/</code> directory:
        </p>
        <ul className="security-doc-list">
          <li><code>docs/governance.md</code> &mdash; Risk tolerance, roles, incident response, change management</li>
          <li><code>docs/risk-map.md</code> &mdash; Failure mode analysis, knowledge boundaries, deployment constraints</li>
          <li><code>docs/system-card.md</code> &mdash; System card with architecture, data practices, performance claims, ethical considerations</li>
        </ul>
      </section>
    </div>
  );
}
