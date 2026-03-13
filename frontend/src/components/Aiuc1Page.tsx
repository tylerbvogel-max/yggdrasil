export default function Aiuc1Page() {
  type Status = 'addressed' | 'partial' | 'missing' | 'not-applicable';

  interface AiucItem {
    id: string;
    title: string;
    status: Status;
    detail: string;
    source?: { nist?: string; iso?: string; eu?: string; other?: string };
  }

  const dataPrivacyItems: AiucItem[] = [
    { id: 'A001', title: 'Establish Input Data Policy', status: 'addressed',
      detail: 'Queries stored locally in PostgreSQL only. No external transmission beyond Anthropic API calls (required for LLM execution). No user data collection beyond query text.',
      source: { nist: 'MEASURE 2.10', iso: 'A.7.2, A.7.3', eu: 'Art. 11' } },
    { id: 'A002', title: 'Establish Output Data Policy', status: 'addressed',
      detail: 'All responses stored locally with full provenance chain. No output data shared externally. Response text logged alongside neuron scores and assembled prompt for audit.',
      source: { other: 'CSA AI Controls Matrix (AICM)' } },
    { id: 'A003', title: 'Limit AI Agent Data Collection', status: 'addressed',
      detail: 'System collects only query text and user ratings. No telemetry, no usage analytics, no behavioral tracking. Neuron graph is author-curated, not user-derived.',
      source: { nist: 'MAP 2.1', iso: 'A.7.2, A.7.3' } },
    { id: 'A004', title: 'Protect IP & Trade Secrets', status: 'not-applicable',
      detail: 'Marked N/A \u2014 this requirement maps exclusively to EU AI Act Article 72 with no corresponding NIST AI RMF or ISO 42001 control. Yggdrasil does not scope to EU AI Act compliance.',
      source: { eu: 'Art. 72 (sole source)' } },
    { id: 'A005', title: 'Prevent Cross-Customer Data Exposure', status: 'addressed',
      detail: 'Single-user local deployment. No multi-tenant architecture. No cross-customer data path exists. Would require auth + tenant isolation before multi-user deployment.',
      source: { nist: 'MEASURE 2.10' } },
    { id: 'A006', title: 'Prevent PII Leakage', status: 'partial',
      detail: 'Policy prohibits PII in neurons. Query data stored locally only. Missing: automated PII scanning on neuron content and query inputs, formal privacy audit process.',
      source: { nist: 'MEASURE 2.10', eu: 'Art. 72' } },
    { id: 'A007', title: 'Prevent IP Violations', status: 'partial',
      detail: 'Source-typed neurons track provenance (citation, source URL, effective date). Regulatory primary neurons are never LLM-paraphrased. Missing: automated license compliance checking, formal IP review process for new neuron content.',
      source: { nist: 'GOVERN 6.1, MAP 4.1', iso: 'A.7.5' } },
  ];

  const securityItems: AiucItem[] = [
    { id: 'B001', title: 'Third-Party Adversarial Robustness Testing', status: 'missing',
      detail: 'No external red-teaming or adversarial testing has been performed. Requires hiring an accredited security auditor. System must be testable first (input filtering, auth).',
      source: { nist: 'GOVERN 4.3, MEASURE 2.1, 2.6, 2.7' } },
    { id: 'B002', title: 'Detect Adversarial Input', status: 'addressed',
      detail: 'Input guard (input_guard.py) implements 16 regex-based adversarial detection patterns including instruction override, role hijacking, system prompt extraction, delimiter injection, encoding evasion, and data exfiltration. Runs pre-classification on all query input.',
      source: { nist: 'GOVERN 1.5, MEASURE 2.4, 2.7, 3.1', eu: 'Art. 15, 72' } },
    { id: 'B004', title: 'Prevent AI Endpoint Scraping', status: 'partial',
      detail: 'Currently localhost-only deployment eliminates network attack surface. Missing for production: rate limiting, API authentication, request throttling, IP allowlisting.',
      source: { nist: 'MEASURE 2.7', eu: 'Art. 15' } },
    { id: 'B005', title: 'Implement Real-Time Input Filtering', status: 'addressed',
      detail: 'Input guard runs pre-classification with 16 adversarial patterns. Covers instruction override, role hijacking, system prompt extraction, delimiter injection, encoding evasion, and data exfiltration. Flagged queries are blocked with detailed reason.',
      source: { nist: 'MEASURE 2.7' } },
    { id: 'B006', title: 'Prevent Unauthorized AI Agent Actions', status: 'addressed',
      detail: 'Yggdrasil is a retrieval system, not an agentic system. It does not make tool calls, execute code, or take actions. The only external call is the Anthropic API for text generation. Neuron refinements require explicit human approval.',
      source: { nist: 'MAP 2.1' } },
    { id: 'B009', title: 'Limit Output Over-Exposure', status: 'addressed',
      detail: 'Token-budgeted prompt assembly limits context exposure per query (configurable 1K\u201332K). Only top-K scored neurons are included. Full neuron graph is never exposed to the LLM.',
      source: { nist: 'MEASURE 2.10' } },
  ];

  const safetyItems: AiucItem[] = [
    { id: 'C001', title: 'Define AI Risk Taxonomy', status: 'partial',
      detail: 'Failure mode analysis in risk-map.md covers scoring failures (5 modes), assembly failures (3 modes), execution failures (4 modes), and human factors (3 modes). Missing: formal severity/likelihood matrix mapped to AIUC-1 risk categories.',
      source: { nist: 'GOVERN 1.1, 1.2, 1.7, MAP 2.1, 2.2, 5.1', iso: '4.1, 6.1, 8.2\u20138.4, A.5', eu: 'Art. 9' } },
    { id: 'C002', title: 'Conduct Pre-Deployment Testing', status: 'partial',
      detail: '36 unit tests cover scoring engine and spread activation. Blind A/B evaluation framework validates quality. Missing: integration tests, acceptance criteria gate, formal test plan with pass/fail thresholds.',
      source: { nist: 'MEASURE 2.6, 2.7, 2.8, MAP 3.3', iso: 'A.6.2.4, A.6.2.5', eu: 'Art. 9, 27' } },
    { id: 'C003', title: 'Prevent Harmful Outputs', status: 'partial',
      detail: 'Domain-scoped neuron graph constrains responses to aerospace/defense knowledge. Neuron content is human-authored and reviewed. Missing: output content filtering, harmful content detection on LLM responses.',
      source: { nist: 'MEASURE 2.11', eu: 'Art. 9' } },
    { id: 'C004', title: 'Prevent Out-of-Scope Outputs', status: 'addressed',
      detail: 'Knowledge boundaries documented in system card. Classification stage scopes queries to known departments/roles. Out-of-scope topics listed. LLM responses are grounded in assembled neuron context.',
      source: { nist: 'MAP 2.2, 3.4', eu: 'Art. 72' } },
    { id: 'C005', title: 'Prevent Customer-Defined High Risk Outputs', status: 'missing',
      detail: 'No configurable risk output categories. No customer-defined content policies. Would need a policy engine that flags/blocks responses matching defined risk patterns.',
      source: { nist: 'MANAGE 1.4', eu: 'Art. 9' } },
    { id: 'C007', title: 'Flag High Risk Outputs', status: 'missing',
      detail: 'No output risk flagging mechanism. Responses are returned without confidence or risk indicators. Would need: response confidence scoring, low-grounding detection, risk category tagging.',
      source: { nist: 'GOVERN 3.2, MAP 3.5', iso: 'A.6.1.2, A.9.2, A.9.3' } },
    { id: 'C008', title: 'Monitor AI Risk Categories', status: 'addressed',
      detail: 'Scoring Health Monitor on Dashboard tracks all 6 signal distributions with automated z-score drift detection (baseline vs recent window). Blind A/B evaluation tracks quality. Performance page shows cost and token trends. Visual alerting on anomalies in Dashboard.',
      source: { nist: 'GOVERN 1.5, MANAGE 3.1, 4.1, MEASURE 2.4, 4.3', iso: '9.1, 9.3, 10.1, 10.2, A.6.2.6, A.9.4', eu: 'Art. 72' } },
    { id: 'C009', title: 'Enable Real-Time Feedback and Intervention', status: 'partial',
      detail: 'User rating (1\u20135) exists per query. Refine process allows human-guided corrections. Missing: real-time circuit breaker (auto-disable if quality drops below threshold), kill switch, intervention dashboard.',
      source: { nist: 'GOVERN 3.2, MAP 3.5, MEASURE 3.3', iso: 'A.8.3', eu: 'Art. 14' } },
    { id: 'C010', title: 'Third-Party Testing for Harmful Outputs', status: 'missing',
      detail: 'External auditor requirement. Cannot be self-certified. System must implement output filtering (C003) before this testing is meaningful.',
      source: { nist: 'MEASURE 2.6, 2.7, 2.8, 2.11', iso: 'A.6.2.4', eu: 'Art. 9' } },
    { id: 'C011', title: 'Third-Party Testing for Out-of-Scope Outputs', status: 'missing',
      detail: 'External auditor requirement. The domain-scoped architecture provides a strong foundation, but formal boundary testing by an independent party has not been performed.',
      source: { nist: 'MAP 2.2, 3.4, MEASURE 2.6, 2.7', iso: 'A.6.2.4' } },
    { id: 'C012', title: 'Third-Party Testing for Customer-Defined Risk', status: 'missing',
      detail: 'External auditor requirement. Depends on C005 (risk output categories) being implemented first.',
      source: { nist: 'MANAGE 1.4, MEASURE 2.6, 2.7', iso: 'A.6.2.4' } },
  ];

  const reliabilityItems: AiucItem[] = [
    { id: 'D001', title: 'Prevent Hallucinated Outputs', status: 'partial',
      detail: 'Neuron-grounded prompt assembly significantly reduces hallucination \u2014 the LLM is given curated domain knowledge rather than relying on parametric memory. Blind evals score faithfulness (1\u20135). Missing: automated hallucination detection comparing response claims against assembled neuron content.',
      source: { nist: 'MEASURE 2.5' } },
    { id: 'D002', title: 'Third-Party Testing for Hallucinations', status: 'missing',
      detail: 'External auditor requirement. The blind A/B framework with faithfulness scoring provides the testing infrastructure, but independent verification has not been performed.',
      source: { nist: 'MEASURE 2.5, 2.6, 2.7', iso: 'A.6.2.4' } },
    { id: 'D003', title: 'Restrict Unsafe Tool Calls', status: 'not-applicable',
      detail: 'Yggdrasil is a retrieval system. It does not make tool calls, execute code, access filesystems, or perform actions. The only external interaction is read-only API calls to Anthropic for text generation.',
      source: { nist: 'GOVERN 6.1', eu: 'Art. 72' } },
    { id: 'D004', title: 'Third-Party Testing of Tool Calls', status: 'not-applicable',
      detail: 'Not applicable \u2014 no tool call capability exists. If agentic features are added in the future, this requirement becomes critical.',
      source: { nist: 'GOVERN 6.1, MEASURE 2.6, 2.7' } },
  ];

  const accountabilityItems: AiucItem[] = [
    { id: 'E001', title: 'AI Failure Plan for Security Breaches', status: 'partial',
      detail: 'Incident severity levels (P1\u2013P4) defined in governance.md with response procedures. Missing: specific security breach playbook with containment steps, notification procedures, and forensic requirements.',
      source: { nist: 'GOVERN 4.3, MANAGE 1.3, 4.3', iso: 'A.8.4, A.8.5', eu: 'Art. 20, 73' } },
    { id: 'E002', title: 'AI Failure Plan for Harmful Outputs', status: 'partial',
      detail: 'Incident response format exists. Red threshold defined (>25% bad answer reports = stop serving). Missing: specific harmful output playbook with immediate response steps, root cause template, and remediation workflow.',
      source: { nist: 'GOVERN 4.3, MANAGE 1.3, 4.3', iso: 'A.8.4', eu: 'Art. 20, 73' } },
    { id: 'E003', title: 'AI Failure Plan for Hallucinations', status: 'partial',
      detail: 'Quality drop thresholds defined (A/B quality drop >30% = stop). Missing: specific hallucination playbook with grounding analysis steps, neuron content review process, and LLM behavior change investigation.',
      source: { nist: 'GOVERN 4.3, MANAGE 1.3, 4.3', iso: 'A.8.4', eu: 'Art. 20, 73' } },
    { id: 'E004', title: 'Assign Accountability', status: 'addressed',
      detail: 'System Owner, Neuron Content Author, and Query Reviewer roles defined in governance.md with separation of concerns matrix. Single-developer currently fills all roles.',
      source: { nist: 'GOVERN 2.1, 2.3, MAP 3.5, MEASURE 2.8', iso: '5.1, 5.3, A.3.2, A.4.6, A.5.2, A.5.4', eu: 'Art. 17, 18' } },
    { id: 'E007', title: 'Document System Change Approvals', status: 'missing',
      detail: 'No formal change approval process. Git commits happen without review gates. Neuron refinements require manual approval in UI, but code/config changes have no review requirement.',
      source: { nist: 'GOVERN 1.4, MANAGE 4.1, 4.2', iso: '6.3, A.6.2.2, A.6.2.4', eu: 'Art. 17, 18' } },
    { id: 'E008', title: 'Review Internal Processes', status: 'addressed',
      detail: 'Management review infrastructure with 7 review types and cadence tracking (pii_audit=90d, scoring_health=7d, governance_review=90d, compliance_audit=30d). Compliance snapshots track posture over time. Evidence map links every requirement to verifiable artifacts. Self-assessment report generator pre-builds auditor deliverables.',
      source: { nist: 'GOVERN 1.5, 1.6, MANAGE 4.1', iso: '9.2, 9.3, A.6.2.6, A.9.3, A.9.4', eu: 'Art. 43' } },
    { id: 'E009', title: 'Monitor Third-Party Access', status: 'partial',
      detail: 'Anthropic API is the only third-party dependency. Token usage and costs tracked per query. Missing: automated monitoring of API behavior changes, version pinning alerts, SLA tracking.',
      source: { nist: 'GOVERN 1.5, MANAGE 4.1', eu: 'Art. 72' } },
    { id: 'E010', title: 'Establish AI Acceptable Use Policy', status: 'addressed',
      detail: 'Deployment constraints documented: unclassified data only, single-user, local deployment, English-only, aerospace domain scope. Out-of-scope uses listed in system card.',
      source: { nist: 'GOVERN 1.3, 2.1, MAP 1.1, 1.6', iso: '5.2, A.4.2, A.4.5, A.5.3', eu: 'Art. 9, 13' } },
    { id: 'E011', title: 'Record Processing Locations', status: 'addressed',
      detail: 'All processing is local (PostgreSQL database, Python backend on localhost). LLM inference occurs on Anthropic\'s infrastructure (US-based). No other processing locations.',
      source: { nist: 'GOVERN 1.6', iso: 'A.7.5', eu: 'Art. 11' } },
    { id: 'E012', title: 'Document Regulatory Compliance', status: 'addressed',
      detail: 'NIST AI RMF gap analysis maintained (SecurityPage). System card documents architecture, data practices, and ethical considerations. This AIUC-1 analysis provides additional framework coverage.',
      source: { nist: 'GOVERN 1.1, 1.2, 1.7', iso: '4.1, 4.2, A.2.2, A.4.4', eu: 'Art. 9, 11, 17' } },
    { id: 'E013', title: 'Implement Quality Management System', status: 'partial',
      detail: 'Refine process exists for neuron improvement. Blind A/B evaluation provides quality measurement. Autopilot provides systematic improvement. Missing: formal QMS with documented procedures, audit trails for process changes, management review.',
      source: { nist: 'GOVERN 1.3, 1.4', iso: '6.2, 7.5, 8.1, 10.1, 10.2', eu: 'Art. 9, 17' } },
    { id: 'E014', title: 'Share Transparency Reports', status: 'missing',
      detail: 'All data for transparency reports exists (query logs, scoring breakdowns, cost tracking, evaluation results). Missing: automated report generation, scheduled reporting cadence, stakeholder distribution.',
      source: { nist: 'GOVERN 1.5, 4.1, MEASURE 2.8, 4.1', iso: '7.4, 9.3, A.5.5', eu: 'Art. 11, 13' } },
    { id: 'E015', title: 'Log Model Activity', status: 'addressed',
      detail: 'Full provenance chain logged per query: classification (intent, departments, roles, keywords), neuron scores (6 signals decomposed), assembled prompt, LLM response, evaluation scores, user ratings. All inspectable in UI.',
      source: { nist: 'MEASURE 2.4, 2.8', iso: 'A.6.2.8', eu: 'Art. 12, 19' } },
    { id: 'E016', title: 'Implement AI Disclosure Mechanisms', status: 'addressed',
      detail: 'System is transparently an AI tool \u2014 the entire UI is built around inspecting AI decision-making. No scenario where a user wouldn\'t know they\'re interacting with AI-generated content.',
      source: { nist: 'MAP 2.2, 3.4, MEASURE 2.8', iso: 'A.8.2', eu: 'Art. 13, 50' } },
    { id: 'E017', title: 'Document System Transparency Policy', status: 'addressed',
      detail: '5-signal scoring is inherently interpretable. Spread activation paths visible in UI. Neuron content inspectable. Token budgets transparent. System card documents all architectural decisions.',
      source: { nist: 'GOVERN 1.1, 1.2, MAP 1.1, 1.6', iso: '5.2, A.4.2, A.8.2', eu: 'Art. 11' } },
  ];

  const societyItems: AiucItem[] = [
    { id: 'F001', title: 'Prevent AI Cyber Misuse', status: 'partial',
      detail: 'Domain-scoped neuron graph limits system to aerospace/defense knowledge retrieval. No code execution capability. Missing: explicit content policy guardrails against misuse scenarios, output filtering for dual-use information.',
      source: { nist: 'MEASURE 2.7', iso: 'A.5.5' } },
  ];

  const allItems: AiucItem[] = [
    ...dataPrivacyItems, ...securityItems, ...safetyItems,
    ...reliabilityItems, ...accountabilityItems, ...societyItems,
  ];
  const addressed = allItems.filter(i => i.status === 'addressed').length;
  const partial = allItems.filter(i => i.status === 'partial').length;
  const missing = allItems.filter(i => i.status === 'missing').length;
  const na = allItems.filter(i => i.status === 'not-applicable').length;

  const statusColor = (s: Status) =>
    s === 'addressed' ? '#22c55e' : s === 'partial' ? '#fb923c' : s === 'not-applicable' ? '#64748b' : '#ef4444';

  const statusLabel = (s: Status) =>
    s === 'addressed' ? 'Addressed' : s === 'partial' ? 'Partial' : s === 'not-applicable' ? 'N/A' : 'Gap';

  const sourceTagColor: Record<string, string> = {
    nist: '#3b82f6',
    iso: '#8b5cf6',
    eu: '#f59e0b',
    other: '#6b7280',
  };

  const sourceTagLabel: Record<string, string> = {
    nist: 'NIST AI RMF',
    iso: 'ISO 42001',
    eu: 'EU AI Act',
    other: 'Other',
  };

  const renderSourceTags = (source?: AiucItem['source']) => {
    if (!source) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {Object.entries(source).map(([key, value]) => (
          <span
            key={key}
            title={value}
            style={{
              display: 'inline-block',
              fontSize: '0.65rem',
              padding: '1px 6px',
              borderRadius: 3,
              background: sourceTagColor[key] + '22',
              color: sourceTagColor[key],
              border: `1px solid ${sourceTagColor[key]}44`,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {sourceTagLabel[key]}: {value}
          </span>
        ))}
      </div>
    );
  };

  const renderSection = (title: string, description: string, items: AiucItem[]) => (
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
            {renderSourceTags(item.source)}
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="security-page">
      <h2>AIUC-1 Compliance Assessment</h2>
      <p className="security-intro">
        Gap analysis against <strong>AIUC-1</strong> (AI Use Case Standard 1.0) &mdash; the first certifiable standard
        for AI agents covering security, safety, reliability, accountability, data privacy, and societal risk.
        AIUC-1 operationalizes the <strong>NIST AI RMF</strong>, <strong>ISO 42001</strong>, and the <strong>EU AI Act</strong> into
        specific, auditable controls verified by accredited third-party auditors.
      </p>
      <p className="security-intro" style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        Note: Yggdrasil is a <em>retrieval</em> system (classify &rarr; score &rarr; assemble &rarr; execute), not an
        agentic system. It does not make tool calls, execute code, or take autonomous actions. Several AIUC-1 requirements
        around tool call safety (D003, D004) are not applicable. The system&rsquo;s strongest compliance posture is in
        accountability and transparency &mdash; full query provenance is logged and inspectable by design.
        Requirements sourced exclusively from the EU AI Act with no NIST or ISO mapping are marked N/A.
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
        <div className="security-summary-item" style={{ borderColor: '#64748b' }}>
          <span className="security-summary-count" style={{ color: '#64748b' }}>{na}</span>
          <span className="security-summary-label">N/A</span>
        </div>
        <div className="security-summary-item" style={{ borderColor: '#94a3b8' }}>
          <span className="security-summary-count" style={{ color: '#94a3b8' }}>{allItems.length}</span>
          <span className="security-summary-label">Total</span>
        </div>
      </div>

      <section className="security-section">
        <h3>Source Framework Legend</h3>
        <p className="security-section-desc">
          Each requirement below shows its source framework mappings. These indicate which upstream standards
          informed the AIUC-1 control. Hover over a tag to see the specific subcategory/clause/article.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {Object.entries(sourceTagLabel).map(([key, label]) => (
            <span key={key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem',
            }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                background: sourceTagColor[key],
              }} />
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="security-section">
        <h3>Relationship to NIST AI RMF</h3>
        <p className="security-section-desc">
          NIST AI RMF (AI 100-1) is a voluntary strategic framework that defines <em>what</em> to consider across four
          functions (Govern, Map, Measure, Manage). AIUC-1 operationalizes those functions into <em>specific, testable
          controls</em> organized by risk domain. Where NIST says &ldquo;consider security and resilience&rdquo; (MEASURE 2.7),
          AIUC-1 requires third-party adversarial robustness testing (B001), adversarial input detection (B002),
          endpoint scraping prevention (B004), and real-time input filtering (B005) &mdash; each independently auditable.
        </p>
        <table className="about-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>NIST AI RMF Function</th><th>AIUC-1 Domain(s)</th><th>Key Subcategories Referenced</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>GOVERN &rarr; Policies &amp; accountability</td>
              <td>Domain E (Accountability)</td>
              <td>GOV 1.1\u20131.7, 2.1, 2.3, 3.2, 4.1, 4.3, 6.1</td>
            </tr>
            <tr>
              <td>MAP &rarr; Context &amp; risk identification</td>
              <td>Domains A (Data) + C (Safety)</td>
              <td>MAP 1.1, 1.6, 2.1, 2.2, 3.3, 3.4, 3.5, 4.1, 5.1</td>
            </tr>
            <tr>
              <td>MEASURE &rarr; Evaluation &amp; testing</td>
              <td>Domains B (Security) + C (Safety) + D (Reliability)</td>
              <td>MEA 2.1, 2.4\u20132.8, 2.10, 2.11, 3.1, 3.3, 4.1, 4.3</td>
            </tr>
            <tr>
              <td>MANAGE &rarr; Risk response &amp; monitoring</td>
              <td>All domains</td>
              <td>MAN 1.3, 1.4, 3.1, 4.1, 4.2, 4.3</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="security-section">
        <h3>Relationship to ISO/IEC 42001</h3>
        <p className="security-section-desc">
          ISO/IEC 42001 is the international standard for AI Management Systems (AIMS). It provides a
          management-system structure (clauses 4\u201310) plus Annex A controls. AIUC-1 references
          ISO 42001 primarily in safety (C-domain), accountability (E-domain), and data governance (A-domain).
        </p>
        <table className="about-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>ISO 42001 Area</th><th>AIUC-1 Mapping</th><th>Key Clauses Referenced</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Context &amp; Leadership (4\u20135)</td>
              <td>E004, E010, E012, E013</td>
              <td>4.1, 4.2, 5.1, 5.2, 5.3</td>
            </tr>
            <tr>
              <td>Planning &amp; Support (6\u20137)</td>
              <td>E007, E013, E014</td>
              <td>6.1, 6.2, 6.3, 7.4, 7.5</td>
            </tr>
            <tr>
              <td>Operation &amp; Performance (8\u20139)</td>
              <td>C001, C008, E008</td>
              <td>8.1\u20138.4, 9.1\u20139.3</td>
            </tr>
            <tr>
              <td>Improvement (10)</td>
              <td>C008, E013</td>
              <td>10.1, 10.2</td>
            </tr>
            <tr>
              <td>Annex A: AI Risk (A.5\u2013A.9)</td>
              <td>A001, A003, A007, C007\u2013C012, E-domain</td>
              <td>A.5.2\u2013A.5.5, A.6.1.2, A.6.2.2\u2013A.6.2.8, A.7.2\u2013A.7.5, A.8.2\u2013A.8.5, A.9.2\u2013A.9.4</td>
            </tr>
          </tbody>
        </table>
      </section>

      {renderSection(
        'A. Data & Privacy',
        'Protecting users and enterprises against data privacy concerns through data policies, access controls, and safeguards against data leakage, IP exposure, and unauthorized use.',
        dataPrivacyItems
      )}

      {renderSection(
        'B. Security',
        'Preventing unauthorized access and adversarial exploitation through robustness testing, input filtering, access controls, and monitoring. This is the largest gap area for Yggdrasil.',
        securityItems
      )}

      {renderSection(
        'C. Safety',
        'Mitigating harmful AI outputs and protecting against unsafe recommendations via risk taxonomy, pre-deployment testing, output controls, and human-in-the-loop safeguards.',
        safetyItems
      )}

      {renderSection(
        'D. Reliability',
        'Preventing unreliable outputs that could cause harm, particularly hallucinations and unauthorized tool calls. Tool call requirements are N/A for Yggdrasil\u2019s retrieval architecture.',
        reliabilityItems
      )}

      {renderSection(
        'E. Accountability',
        'Enforcing governance and oversight via failure planning, activity logging, change documentation, transparency reporting, and quality management. This is Yggdrasil\u2019s strongest domain.',
        accountabilityItems
      )}

      {renderSection(
        'F. Society',
        'Guarding against catastrophic societal harm by implementing guardrails against cyber exploitation, system misuse, and threats to national security.',
        societyItems
      )}

      <section className="security-section">
        <h3>Priority Implementation Path</h3>
        <p className="security-section-desc">
          If pursuing AIUC-1 certification, this is the recommended implementation order based on risk reduction and dependency chains:
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Priority</th><th>Work</th><th>Unblocks</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>1. Input filtering</td>
              <td>Add input sanitization layer before classifier &mdash; prompt injection detection, content policy enforcement, input validation</td>
              <td>B002, B005, and makes B001 (third-party testing) meaningful</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>2. Auth + rate limiting</td>
              <td>API authentication, request throttling, IP controls on all endpoints</td>
              <td>B004, and required for any non-localhost deployment</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>3. Output risk detection</td>
              <td>Compare LLM responses against assembled neuron content to flag ungrounded claims; add harmful content filtering</td>
              <td>C003, C007, D001 improvement</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>4. Circuit breaker</td>
              <td>Auto-disable serving if quality metrics drop below defined thresholds (thresholds already exist in governance.md)</td>
              <td>C009, and demonstrates operational maturity</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>5. Failure playbooks</td>
              <td>Write specific playbooks for security breach, harmful output, and hallucination incidents with step-by-step response</td>
              <td>E001, E002, E003</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>6. PII scanner</td>
              <td>Automated PII detection on neuron content and query inputs</td>
              <td>A006, and strengthens A004</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>7. Third-party audit</td>
              <td>Engage accredited AIUC-1 auditor (e.g. Schellman) for formal adversarial testing and certification</td>
              <td>B001, C010\u2013C012, D002 &mdash; cannot be self-certified</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="security-section">
        <h3>References</h3>
        <ul className="security-doc-list">
          <li><a href="https://www.aiuc-1.com/" target="_blank" rel="noopener noreferrer">AIUC-1 Standard</a> &mdash; Official standard homepage</li>
          <li><a href="https://www.aiuc-1.com/crosswalks/nist-ai-rmf" target="_blank" rel="noopener noreferrer">AIUC-1 x NIST AI RMF Crosswalk</a> &mdash; Requirement-level mapping</li>
          <li><code>docs/governance.md</code> &mdash; Risk tolerance, roles, incident response, change management</li>
          <li><code>docs/risk-map.md</code> &mdash; Failure mode analysis, knowledge boundaries, deployment constraints</li>
          <li><code>docs/system-card.md</code> &mdash; System card with architecture, data practices, and performance claims</li>
        </ul>
      </section>
    </div>
  );
}
