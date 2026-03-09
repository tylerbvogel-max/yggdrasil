export default function Iso42001Page() {
  type Status = 'addressed' | 'partial' | 'missing';

  interface IsoItem {
    id: string;
    title: string;
    status: Status;
    detail: string;
    nistRef?: string;
    aiucRef?: string;
  }

  // ── Group 1: Leadership & Strategic Direction ──
  const leadershipItems: IsoItem[] = [
    { id: '5.1', title: 'Leadership & Commitment', status: 'addressed',
      detail: 'System Owner role defined in governance.md with decision authority over neuron content, model selection, and deployment. Risk tolerance thresholds set (A/B quality drop >15% = investigate, >30% = stop).',
      nistRef: 'GOV-2.1', aiucRef: 'E004' },
    { id: '5.2', title: 'AI Policy', status: 'addressed',
      detail: 'Deployment constraints documented: unclassified data only, single-user, local deployment, English-only, aerospace domain scope. Acceptable use policy defined in system card.',
      nistRef: 'GOV-1.3', aiucRef: 'E010, E017' },
    { id: '5.3', title: 'Organizational Roles & Responsibilities', status: 'addressed',
      detail: 'System Owner, Neuron Content Author, and Query Reviewer roles defined with separation of concerns matrix. Single developer currently fills all roles.',
      nistRef: 'GOV-2.1', aiucRef: 'E004' },
  ];

  // ── Group 2: Planning & Risk Assessment ──
  const planningItems: IsoItem[] = [
    { id: '4.1', title: 'Understanding the Organization & Context', status: 'addressed',
      detail: 'Aerospace/defense domain context documented. Stakeholder needs (knowledge retrieval for regulatory compliance) defined. External factors (regulatory landscape, LLM vendor dependency) assessed.',
      nistRef: 'MAP-1.1, MAP-3.3', aiucRef: 'C001, E012' },
    { id: '4.2', title: 'Understanding Stakeholder Needs', status: 'addressed',
      detail: 'System card documents intended users (aerospace professionals), use cases (regulatory Q&A, standards lookup), and deployment context (single-user local tool).',
      nistRef: 'MAP-1.1', aiucRef: 'E012' },
    { id: '6.1', title: 'Actions to Address Risks & Opportunities', status: 'partial',
      detail: 'Risk map covers 15 failure modes with severity analysis. Scoring Health Monitor detects drift. Missing: formal risk treatment plan with accept/mitigate/transfer decisions per risk, risk register with review cadence.',
      nistRef: 'MAP-3.2, GOV-1.3', aiucRef: 'C001' },
    { id: '6.2', title: 'AI Objectives & Planning', status: 'partial',
      detail: 'Quality targets exist informally (A/B eval scores, cost tracking). Missing: formal measurable AI objectives with timelines, resource allocation, and progress tracking.',
      nistRef: 'MAN-1.1', aiucRef: 'E013' },
    { id: '6.3', title: 'Planning of Changes', status: 'missing',
      detail: 'No formal change management process. Git commits without review gates. Neuron refinements require manual approval, but code/config changes have no change advisory board or impact assessment.',
      nistRef: 'MAN-4.2', aiucRef: 'E007' },
  ];

  // ── Group 3: Support & Resources ──
  const supportItems: IsoItem[] = [
    { id: '7.4', title: 'Communication', status: 'partial',
      detail: 'Incident communication format defined with severity levels and response times. Missing: stakeholder communication plan, regular reporting cadence, transparency report distribution.',
      nistRef: 'MAN-4.3', aiucRef: 'E014' },
    { id: '7.5', title: 'Documented Information', status: 'partial',
      detail: 'Governance docs (governance.md, risk-map.md, system-card.md) maintained. Query provenance fully logged. Missing: document control process (versioning, review, approval), retention policy.',
      nistRef: 'GOV-1.4', aiucRef: 'E011, E012, E013' },
  ];

  // ── Group 4: Operation (AI System Lifecycle) ──
  const operationItems: IsoItem[] = [
    { id: '8.1', title: 'Operational Planning & Control', status: 'partial',
      detail: 'Two-stage pipeline (classify \u2192 score \u2192 assemble \u2192 execute) is well-defined and deterministic. Missing: formal operational procedures document, runbook for common operations.',
      nistRef: 'MAP-2.1', aiucRef: 'E013' },
    { id: '8.2', title: 'AI Risk Assessment', status: 'partial',
      detail: 'Risk map documents 15 failure modes across scoring, assembly, execution, and human factors. Missing: formal likelihood \u00d7 impact matrix, risk scoring methodology, periodic reassessment schedule.',
      nistRef: 'MAP-3.2, GOV-1.3', aiucRef: 'C001' },
    { id: '8.3', title: 'AI Risk Treatment', status: 'partial',
      detail: 'Mitigations documented per failure mode (e.g., token budget prevents over-assembly, domain scoping prevents off-topic). Missing: formal risk treatment plan with residual risk acceptance, treatment effectiveness measurement.',
      nistRef: 'MAN-1.4', aiucRef: 'C001' },
    { id: '8.4', title: 'AI System Impact Assessment', status: 'partial',
      detail: 'System card documents deployment constraints and ethical considerations. Negative impact analysis covers 15 failure modes. Missing: formal impact assessment template, stakeholder impact analysis, periodic reassessment.',
      nistRef: 'MAP-3.2', aiucRef: 'E001, E002, E003' },
  ];

  // ── Group 5: Performance Evaluation ──
  const performanceItems: IsoItem[] = [
    { id: '9.1', title: 'Monitoring, Measurement, Analysis & Evaluation', status: 'partial',
      detail: 'Scoring Health Monitor tracks 6 signal distributions with z-score drift detection. Performance page tracks cost, token usage, and quality trends. Missing: formal KPI framework with targets, measurement frequency, and trend analysis procedures.',
      nistRef: 'GOV-1.5, MEA-1.1', aiucRef: 'C008' },
    { id: '9.2', title: 'Internal Audit', status: 'missing',
      detail: 'No formal internal audit program. No audit schedule, scope, or criteria defined. No separation between auditor and auditee roles (sole developer).',
      nistRef: 'MEA-1.3', aiucRef: 'E008' },
    { id: '9.3', title: 'Management Review', status: 'missing',
      detail: 'No scheduled management review of AI system performance, risk posture, or improvement opportunities. Would need regular review meetings with documented minutes and action items.',
      nistRef: 'GOV-1.5', aiucRef: 'C008, E014' },
  ];

  // ── Group 6: Improvement ──
  const improvementItems: IsoItem[] = [
    { id: '10.1', title: 'Nonconformity & Corrective Action', status: 'partial',
      detail: 'Refine process corrects neuron content issues. Incident response defined for quality drops. Missing: formal nonconformity register, root cause analysis process, corrective action tracking with effectiveness verification.',
      nistRef: 'MAN-4.2, GOV-4.3', aiucRef: 'C008, E013' },
    { id: '10.2', title: 'Continual Improvement', status: 'partial',
      detail: 'Autopilot provides gap-driven improvement. Refine process improves neuron quality. Emergent queue detects new patterns. Missing: formal improvement program with objectives, measurement, and review.',
      nistRef: 'MAN-4.2', aiucRef: 'C008, E013' },
  ];

  // ── Annex A Controls ──
  const annexAItems: IsoItem[] = [
    { id: 'A.2.2', title: 'AI Policy for Interested Parties', status: 'addressed',
      detail: 'System card and deployment constraints are publicly documented. Acceptable use policy defined.',
      nistRef: 'GOV-1.3', aiucRef: 'E010, E012' },
    { id: 'A.3.2', title: 'AI Roles within the Organization', status: 'addressed',
      detail: 'System Owner, Neuron Content Author, and Query Reviewer roles defined in governance.md.',
      nistRef: 'GOV-2.1', aiucRef: 'E004' },
    { id: 'A.4.2', title: 'AI System Use Policy', status: 'addressed',
      detail: 'Acceptable use policy documented. Domain scope, deployment constraints, and out-of-scope uses clearly defined.',
      nistRef: 'MAP-3.3', aiucRef: 'E010' },
    { id: 'A.4.4', title: 'Reporting AI System Concerns', status: 'partial',
      detail: 'Incident log format defined. Missing: formal concern reporting channel, whistleblower protection, anonymous reporting option.',
      nistRef: 'GOV-4.3', aiucRef: 'E012' },
    { id: 'A.4.5', title: 'AI Acceptable Use', status: 'addressed',
      detail: 'Deployment constraints documented. Out-of-scope uses listed. Domain boundaries enforced by classification stage.',
      nistRef: 'MAP-3.3', aiucRef: 'E010' },
    { id: 'A.4.6', title: 'AI Competence & Awareness', status: 'partial',
      detail: 'Getting Started page provides setup guide and training walkthrough. Missing: role-based training paths, competence assessment, training records.',
      nistRef: 'GOV-2.2', aiucRef: 'E004' },
    { id: 'A.5', title: 'AI Risk Management Policies', status: 'partial',
      detail: 'Risk tolerance thresholds defined. Failure modes analyzed. Missing: formal risk management policy document with scope, objectives, and review schedule.',
      nistRef: 'GOV-1.3, MAP-3.2', aiucRef: 'C001' },
    { id: 'A.5.2', title: 'AI Risk Assessment Process', status: 'partial',
      detail: 'Risk map documents failure modes with severity. Missing: repeatable risk assessment methodology, risk register, periodic reassessment triggers.',
      nistRef: 'MAP-3.2', aiucRef: 'C001, E004' },
    { id: 'A.5.3', title: 'AI Risk Treatment Process', status: 'partial',
      detail: 'Mitigations exist per failure mode. Token budget, domain scoping, human-in-the-loop controls. Missing: formal treatment plan with residual risk documentation.',
      nistRef: 'MAN-1.4', aiucRef: 'E010' },
    { id: 'A.5.4', title: 'AI Risk Communication', status: 'partial',
      detail: 'Risk map is documented. Incident severity levels defined. Missing: risk communication plan to stakeholders, regular risk reporting.',
      nistRef: 'MAN-4.3', aiucRef: 'E004' },
    { id: 'A.5.5', title: 'AI Risk Monitoring & Review', status: 'partial',
      detail: 'Scoring Health Monitor provides real-time drift detection. Performance page tracks trends. Missing: formal risk monitoring schedule, risk indicator thresholds, escalation procedures.',
      nistRef: 'GOV-1.5', aiucRef: 'F001, E014' },
    { id: 'A.6.1.2', title: 'AI System Design Documentation', status: 'addressed',
      detail: 'System card documents full architecture: two-stage pipeline, 6-layer neuron hierarchy, 5-signal scoring, spread activation, token-budgeted assembly.',
      nistRef: 'MAP-2.1', aiucRef: 'C007' },
    { id: 'A.6.2.2', title: 'AI System Development Lifecycle', status: 'missing',
      detail: 'No formal development lifecycle process. No stage gates, no design reviews, no development standards document.',
      nistRef: 'MAN-4.2', aiucRef: 'E007' },
    { id: 'A.6.2.4', title: 'AI System Testing', status: 'partial',
      detail: '36 unit tests cover scoring engine and spread activation. Blind A/B evaluation framework. Missing: integration tests, acceptance criteria, formal test plan, test coverage metrics.',
      nistRef: 'MEA-2.5, MEA-2.6', aiucRef: 'C002, C010\u2013C012, D002' },
    { id: 'A.6.2.5', title: 'AI System Validation', status: 'partial',
      detail: 'Blind A/B evaluation validates quality against bare model. Missing: formal validation criteria, acceptance thresholds, validation report template.',
      nistRef: 'MEA-2.5', aiucRef: 'C002' },
    { id: 'A.6.2.6', title: 'AI System Monitoring', status: 'partial',
      detail: 'Scoring Health Monitor with z-score drift detection on Dashboard. Cost and token tracking on Performance page. Missing: automated alerting, monitoring SLAs, escalation on threshold breach.',
      nistRef: 'GOV-1.5, MEA-2.4', aiucRef: 'C008, E008' },
    { id: 'A.6.2.8', title: 'AI System Logging', status: 'addressed',
      detail: 'Full provenance chain logged per query: classification (intent, departments, roles, keywords), neuron scores (6 signals), assembled prompt, LLM response, evaluation scores, user ratings.',
      nistRef: 'MEA-2.8', aiucRef: 'E015' },
    { id: 'A.7.2', title: 'Data Quality for AI Systems', status: 'addressed',
      detail: 'Neuron content is human-authored and reviewed. Regulatory neurons sourced from primary documents with citation tracking. Source type (regulatory/operational) and origin (seed/llm/autopilot) tracked per neuron.',
      nistRef: 'MAP-2.1', aiucRef: 'A001, A003' },
    { id: 'A.7.3', title: 'Data Provenance', status: 'addressed',
      detail: 'Every neuron tracks: source_type, source_origin, citation, effective_date, last_verified, source_url, source_version. Regulatory neurons link to specific document sections.',
      nistRef: 'MEA-2.8', aiucRef: 'A001, A003' },
    { id: 'A.7.5', title: 'Data Sharing & Transfer', status: 'addressed',
      detail: 'All data stored locally in PostgreSQL. Only data shared externally is assembled prompt context sent to Anthropic API for inference. No other data transfer paths.',
      nistRef: 'MEA-2.10', aiucRef: 'A007, E011' },
    { id: 'A.8.2', title: 'Transparent AI System Information', status: 'addressed',
      detail: '5-signal scoring is inherently interpretable. Spread activation paths visible. Neuron content inspectable. Token budgets transparent. UI built around inspecting AI decision-making.',
      nistRef: 'MEA-2.9', aiucRef: 'E016, E017' },
    { id: 'A.8.3', title: 'AI System User Feedback', status: 'partial',
      detail: 'User rating (1\u20135) exists per query. Missing: structured feedback collection, feedback analysis pipeline, feedback-driven improvement triggers.',
      nistRef: 'MAN-4.1', aiucRef: 'C009' },
    { id: 'A.8.4', title: 'AI Incident Management', status: 'addressed',
      detail: 'P1\u2013P4 severity levels defined with response procedures. Incident log format specified. Red thresholds trigger stop-serving.',
      nistRef: 'GOV-4.3', aiucRef: 'E001, E002' },
    { id: 'A.8.5', title: 'AI Incident Response', status: 'partial',
      detail: 'Incident severity levels and response times defined. Missing: specific playbooks per incident type (security breach, harmful output, hallucination), post-incident review process.',
      nistRef: 'GOV-4.3', aiucRef: 'E001' },
    { id: 'A.9.2', title: 'AI System Compliance Verification', status: 'partial',
      detail: 'NIST AI RMF gap analysis maintained. AIUC-1 compliance assessment with 45-requirement crosswalk. This ISO 42001 analysis. Missing: formal compliance verification schedule, evidence collection process.',
      nistRef: 'GOV-1.5', aiucRef: 'C007, E008' },
    { id: 'A.9.3', title: 'AI System Audit', status: 'missing',
      detail: 'No formal audit program. No audit criteria, scope, frequency, or independence defined. Sole-developer context makes separation of duties difficult.',
      nistRef: 'MEA-1.3', aiucRef: 'C007, E008' },
    { id: 'A.9.4', title: 'Management Review of AI Systems', status: 'missing',
      detail: 'No scheduled management review. Missing: review inputs (monitoring data, audit results, risk changes), review outputs (improvement actions, resource decisions), meeting minutes.',
      nistRef: 'GOV-1.5', aiucRef: 'C008, E008' },
  ];

  const allItems: IsoItem[] = [
    ...leadershipItems, ...planningItems, ...supportItems, ...operationItems,
    ...performanceItems, ...improvementItems, ...annexAItems,
  ];
  const addressed = allItems.filter(i => i.status === 'addressed').length;
  const partial = allItems.filter(i => i.status === 'partial').length;
  const missing = allItems.filter(i => i.status === 'missing').length;

  const statusColor = (s: Status) =>
    s === 'addressed' ? '#22c55e' : s === 'partial' ? '#fb923c' : '#ef4444';

  const statusLabel = (s: Status) =>
    s === 'addressed' ? 'Addressed' : s === 'partial' ? 'Partial' : 'Gap';

  const renderSection = (title: string, description: string, items: IsoItem[]) => (
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
            {(item.nistRef || item.aiucRef) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {item.nistRef && (
                  <span style={{
                    display: 'inline-block', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3,
                    background: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    NIST: {item.nistRef}
                  </span>
                )}
                {item.aiucRef && (
                  <span style={{
                    display: 'inline-block', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3,
                    background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    AIUC-1: {item.aiucRef}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="security-page">
      <h2>ISO/IEC 42001 Compliance</h2>
      <p className="security-intro">
        Gap analysis against <strong>ISO/IEC 42001:2023</strong> &mdash; the international standard for
        AI Management Systems (AIMS). ISO 42001 provides a management-system structure (clauses 4&ndash;10)
        plus Annex A controls for responsible AI development and operation. Each requirement below shows
        its cross-references to NIST AI RMF and AIUC-1 where applicable.
      </p>
      <p className="security-intro" style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        Note: ISO 42001 is a management system standard &mdash; it focuses on organizational processes,
        documentation, and governance rather than specific technical controls. Many gaps here are about
        formalizing processes that exist informally (risk assessment, change management, auditing)
        rather than building new technical capabilities.
      </p>

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
        <div className="security-summary-item" style={{ borderColor: '#94a3b8' }}>
          <span className="security-summary-count" style={{ color: '#94a3b8' }}>{allItems.length}</span>
          <span className="security-summary-label">Total</span>
        </div>
      </div>

      {renderSection(
        '5. Leadership & Strategic Direction',
        'Top management commitment, AI policy establishment, and organizational role assignment. Yggdrasil\u2019s governance documentation covers these foundational requirements.',
        leadershipItems
      )}

      {renderSection(
        '4 & 6. Planning & Risk Assessment',
        'Understanding organizational context, assessing AI-specific risks, setting objectives, and planning changes. The risk map provides a strong foundation; gaps are in formalizing the process.',
        planningItems
      )}

      {renderSection(
        '7. Support & Resources',
        'Communication, documentation, and resource management for the AI management system.',
        supportItems
      )}

      {renderSection(
        '8. Operation (AI System Lifecycle)',
        'Operational planning, risk assessment execution, risk treatment, and impact assessment. The two-stage pipeline is well-defined; gaps are in formalizing the risk management lifecycle.',
        operationItems
      )}

      {renderSection(
        '9. Performance Evaluation',
        'Monitoring, internal audit, and management review. The Scoring Health Monitor provides real-time performance data; gaps are in formal audit and review processes.',
        performanceItems
      )}

      {renderSection(
        '10. Improvement',
        'Corrective action and continual improvement processes. Autopilot and refine processes provide improvement mechanisms; gaps are in formal tracking and measurement.',
        improvementItems
      )}

      {renderSection(
        'Annex A: AI-Specific Controls',
        'Annex A provides 38 controls across policies (A.2\u2013A.4), risk management (A.5), engineering (A.6), data (A.7), transparency (A.8), and third-party (A.9). These are the operational controls that implement the management system.',
        annexAItems
      )}

      <section className="security-section">
        <h3>Key Observations</h3>
        <div className="result-card" style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text)' }}>Strongest areas:</strong> Data governance (A.7), transparency (A.8),
            and logging (A.6.2.8) are well-addressed thanks to Yggdrasil&rsquo;s provenance-first architecture.
            Every neuron tracks its source, every query logs its full decision chain.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: 'var(--text)' }}>Pattern in gaps:</strong> Most &ldquo;partial&rdquo; items share the same
            root cause &mdash; the capability exists but the formal process documentation does not. Risk assessment
            is done but not in a repeatable template. Monitoring exists but without formal escalation procedures.
            Improvement happens but without tracked objectives.
          </p>
          <p>
            <strong style={{ color: 'var(--text)' }}>Path to compliance:</strong> Unlike NIST (which requires new technical
            capabilities like input filtering and adversarial testing), ISO 42001 gaps are largely addressable through
            documentation: risk register template, change management procedure, audit schedule, management review
            minutes template. A focused documentation sprint could close most partial items.
          </p>
        </div>
      </section>

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
