export default function Aiuc1Page() {
  const dataPrivacyItems = [
    { id: 'A001', title: 'Establish Input Data Policy', status: 'addressed' as const,
      detail: 'Queries stored locally in SQLite only. No external transmission beyond Anthropic API calls (required for LLM execution). No user data collection beyond query text.' },
    { id: 'A002', title: 'Establish Output Data Policy', status: 'addressed' as const,
      detail: 'All responses stored locally with full provenance chain. No output data shared externally. Response text logged alongside neuron scores and assembled prompt for audit.' },
    { id: 'A003', title: 'Limit AI Agent Data Collection', status: 'addressed' as const,
      detail: 'System collects only query text and user ratings. No telemetry, no usage analytics, no behavioral tracking. Neuron graph is author-curated, not user-derived.' },
    { id: 'A004', title: 'Protect IP & Trade Secrets', status: 'partial' as const,
      detail: 'Neuron content is stored locally and never sent externally except as assembled prompt context to the LLM API. Missing: formal IP classification on neurons, data-at-rest encryption, export controls on neuron content.' },
    { id: 'A005', title: 'Prevent Cross-Customer Data Exposure', status: 'addressed' as const,
      detail: 'Single-user local deployment. No multi-tenant architecture. No cross-customer data path exists. Would require auth + tenant isolation before multi-user deployment.' },
    { id: 'A006', title: 'Prevent PII Leakage', status: 'partial' as const,
      detail: 'Policy prohibits PII in neurons. Query data stored locally only. Missing: automated PII scanning on neuron content and query inputs, formal privacy audit process.' },
    { id: 'A007', title: 'Prevent IP Violations', status: 'partial' as const,
      detail: 'Source-typed neurons track provenance (citation, source URL, effective date). Regulatory primary neurons are never LLM-paraphrased. Missing: automated license compliance checking, formal IP review process for new neuron content.' },
  ];

  const securityItems = [
    { id: 'B001', title: 'Third-Party Adversarial Robustness Testing', status: 'missing' as const,
      detail: 'No external red-teaming or adversarial testing has been performed. Requires hiring an accredited security auditor. System must be testable first (input filtering, auth).' },
    { id: 'B002', title: 'Detect Adversarial Input', status: 'missing' as const,
      detail: 'No prompt injection detection on query input. The classifier receives raw user text without sanitization. Would need an input classifier/filter before the Haiku classification stage.' },
    { id: 'B004', title: 'Prevent AI Endpoint Scraping', status: 'partial' as const,
      detail: 'Currently localhost-only deployment eliminates network attack surface. Missing for production: rate limiting, API authentication, request throttling, IP allowlisting.' },
    { id: 'B005', title: 'Implement Real-Time Input Filtering', status: 'missing' as const,
      detail: 'No input sanitization layer exists. Raw query text flows directly into the classification pipeline. Need: input validation, injection pattern detection, content policy enforcement.' },
    { id: 'B006', title: 'Prevent Unauthorized AI Agent Actions', status: 'addressed' as const,
      detail: 'Yggdrasil is a retrieval system, not an agentic system. It does not make tool calls, execute code, or take actions. The only external call is the Anthropic API for text generation. Neuron refinements require explicit human approval.' },
    { id: 'B009', title: 'Limit Output Over-Exposure', status: 'addressed' as const,
      detail: 'Token-budgeted prompt assembly limits context exposure per query (configurable 1K\u201332K). Only top-K scored neurons are included. Full neuron graph is never exposed to the LLM.' },
  ];

  const safetyItems = [
    { id: 'C001', title: 'Define AI Risk Taxonomy', status: 'partial' as const,
      detail: 'Failure mode analysis in risk-map.md covers scoring failures (5 modes), assembly failures (3 modes), execution failures (4 modes), and human factors (3 modes). Missing: formal severity/likelihood matrix mapped to AIUC-1 risk categories.' },
    { id: 'C002', title: 'Conduct Pre-Deployment Testing', status: 'partial' as const,
      detail: '36 unit tests cover scoring engine and spread activation. Blind A/B evaluation framework validates quality. Missing: integration tests, acceptance criteria gate, formal test plan with pass/fail thresholds.' },
    { id: 'C003', title: 'Prevent Harmful Outputs', status: 'partial' as const,
      detail: 'Domain-scoped neuron graph constrains responses to aerospace/defense knowledge. Neuron content is human-authored and reviewed. Missing: output content filtering, harmful content detection on LLM responses.' },
    { id: 'C004', title: 'Prevent Out-of-Scope Outputs', status: 'addressed' as const,
      detail: 'Knowledge boundaries documented in system card. Classification stage scopes queries to known departments/roles. Out-of-scope topics listed. LLM responses are grounded in assembled neuron context.' },
    { id: 'C005', title: 'Prevent Customer-Defined High Risk Outputs', status: 'missing' as const,
      detail: 'No configurable risk output categories. No customer-defined content policies. Would need a policy engine that flags/blocks responses matching defined risk patterns.' },
    { id: 'C007', title: 'Flag High Risk Outputs', status: 'missing' as const,
      detail: 'No output risk flagging mechanism. Responses are returned without confidence or risk indicators. Would need: response confidence scoring, low-grounding detection, risk category tagging.' },
    { id: 'C008', title: 'Monitor AI Risk Categories', status: 'addressed' as const,
      detail: 'Scoring Health Monitor on Dashboard tracks all 6 signal distributions with automated z-score drift detection (baseline vs recent window). Blind A/B evaluation tracks quality. Performance page shows cost and token trends. Visual alerting on anomalies in Dashboard.' },
    { id: 'C009', title: 'Enable Real-Time Feedback and Intervention', status: 'partial' as const,
      detail: 'User rating (1\u20135) exists per query. Refine process allows human-guided corrections. Missing: real-time circuit breaker (auto-disable if quality drops below threshold), kill switch, intervention dashboard.' },
    { id: 'C010', title: 'Third-Party Testing for Harmful Outputs', status: 'missing' as const,
      detail: 'External auditor requirement. Cannot be self-certified. System must implement output filtering (C003) before this testing is meaningful.' },
    { id: 'C011', title: 'Third-Party Testing for Out-of-Scope Outputs', status: 'missing' as const,
      detail: 'External auditor requirement. The domain-scoped architecture provides a strong foundation, but formal boundary testing by an independent party has not been performed.' },
    { id: 'C012', title: 'Third-Party Testing for Customer-Defined Risk', status: 'missing' as const,
      detail: 'External auditor requirement. Depends on C005 (risk output categories) being implemented first.' },
  ];

  const reliabilityItems = [
    { id: 'D001', title: 'Prevent Hallucinated Outputs', status: 'partial' as const,
      detail: 'Neuron-grounded prompt assembly significantly reduces hallucination \u2014 the LLM is given curated domain knowledge rather than relying on parametric memory. Blind evals score faithfulness (1\u20135). Missing: automated hallucination detection comparing response claims against assembled neuron content.' },
    { id: 'D002', title: 'Third-Party Testing for Hallucinations', status: 'missing' as const,
      detail: 'External auditor requirement. The blind A/B framework with faithfulness scoring provides the testing infrastructure, but independent verification has not been performed.' },
    { id: 'D003', title: 'Restrict Unsafe Tool Calls', status: 'not-applicable' as const,
      detail: 'Yggdrasil is a retrieval system. It does not make tool calls, execute code, access filesystems, or perform actions. The only external interaction is read-only API calls to Anthropic for text generation.' },
    { id: 'D004', title: 'Third-Party Testing of Tool Calls', status: 'not-applicable' as const,
      detail: 'Not applicable \u2014 no tool call capability exists. If agentic features are added in the future, this requirement becomes critical.' },
  ];

  const accountabilityItems = [
    { id: 'E001', title: 'AI Failure Plan for Security Breaches', status: 'partial' as const,
      detail: 'Incident severity levels (P1\u2013P4) defined in governance.md with response procedures. Missing: specific security breach playbook with containment steps, notification procedures, and forensic requirements.' },
    { id: 'E002', title: 'AI Failure Plan for Harmful Outputs', status: 'partial' as const,
      detail: 'Incident response format exists. Red threshold defined (>25% bad answer reports = stop serving). Missing: specific harmful output playbook with immediate response steps, root cause template, and remediation workflow.' },
    { id: 'E003', title: 'AI Failure Plan for Hallucinations', status: 'partial' as const,
      detail: 'Quality drop thresholds defined (A/B quality drop >30% = stop). Missing: specific hallucination playbook with grounding analysis steps, neuron content review process, and LLM behavior change investigation.' },
    { id: 'E004', title: 'Assign Accountability', status: 'addressed' as const,
      detail: 'System Owner, Neuron Content Author, and Query Reviewer roles defined in governance.md with separation of concerns matrix. Single-developer currently fills all roles.' },
    { id: 'E007', title: 'Document System Change Approvals', status: 'missing' as const,
      detail: 'No formal change approval process. Git commits happen without review gates. Neuron refinements require manual approval in UI, but code/config changes have no review requirement.' },
    { id: 'E008', title: 'Review Internal Processes', status: 'partial' as const,
      detail: 'Refine process provides query-level review. Autopilot has gap-driven improvement. Missing: scheduled process review cadence, formal audit of scoring weights, systematic review of neuron content quality.' },
    { id: 'E009', title: 'Monitor Third-Party Access', status: 'partial' as const,
      detail: 'Anthropic API is the only third-party dependency. Token usage and costs tracked per query. Missing: automated monitoring of API behavior changes, version pinning alerts, SLA tracking.' },
    { id: 'E010', title: 'Establish AI Acceptable Use Policy', status: 'addressed' as const,
      detail: 'Deployment constraints documented: unclassified data only, single-user, local deployment, English-only, aerospace domain scope. Out-of-scope uses listed in system card.' },
    { id: 'E011', title: 'Record Processing Locations', status: 'addressed' as const,
      detail: 'All processing is local (SQLite on disk, Python backend on localhost). LLM inference occurs on Anthropic\'s infrastructure (US-based). No other processing locations.' },
    { id: 'E012', title: 'Document Regulatory Compliance', status: 'addressed' as const,
      detail: 'NIST AI RMF gap analysis maintained (SecurityPage). System card documents architecture, data practices, and ethical considerations. This AIUC-1 analysis provides additional framework coverage.' },
    { id: 'E013', title: 'Implement Quality Management System', status: 'partial' as const,
      detail: 'Refine process exists for neuron improvement. Blind A/B evaluation provides quality measurement. Autopilot provides systematic improvement. Missing: formal QMS with documented procedures, audit trails for process changes, management review.' },
    { id: 'E014', title: 'Share Transparency Reports', status: 'missing' as const,
      detail: 'All data for transparency reports exists (query logs, scoring breakdowns, cost tracking, evaluation results). Missing: automated report generation, scheduled reporting cadence, stakeholder distribution.' },
    { id: 'E015', title: 'Log Model Activity', status: 'addressed' as const,
      detail: 'Full provenance chain logged per query: classification (intent, departments, roles, keywords), neuron scores (6 signals decomposed), assembled prompt, LLM response, evaluation scores, user ratings. All inspectable in UI.' },
    { id: 'E016', title: 'Implement AI Disclosure Mechanisms', status: 'addressed' as const,
      detail: 'System is transparently an AI tool \u2014 the entire UI is built around inspecting AI decision-making. No scenario where a user wouldn\'t know they\'re interacting with AI-generated content.' },
    { id: 'E017', title: 'Document System Transparency Policy', status: 'addressed' as const,
      detail: '5-signal scoring is inherently interpretable. Spread activation paths visible in UI. Neuron content inspectable. Token budgets transparent. System card documents all architectural decisions.' },
  ];

  const societyItems = [
    { id: 'F001', title: 'Prevent AI Cyber Misuse', status: 'partial' as const,
      detail: 'Domain-scoped neuron graph limits system to aerospace/defense knowledge retrieval. No code execution capability. Missing: explicit content policy guardrails against misuse scenarios, output filtering for dual-use information.' },
  ];

  type Status = 'addressed' | 'partial' | 'missing' | 'not-applicable';

  const allItems: { status: Status }[] = [
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

  const renderSection = (title: string, description: string, items: { id: string; title: string; status: Status; detail: string }[]) => (
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
            <tr><th>NIST AI RMF</th><th>AIUC-1</th></tr>
          </thead>
          <tbody>
            <tr><td>GOVERN &rarr; Policies &amp; accountability</td><td>Domain E (Accountability) &mdash; 17 specific requirements</td></tr>
            <tr><td>MAP &rarr; Context &amp; risk identification</td><td>Domains A (Data) + C (Safety) &mdash; planning &amp; scoping controls</td></tr>
            <tr><td>MEASURE &rarr; Evaluation &amp; testing</td><td>Domains B (Security) + C (Safety) + D (Reliability) &mdash; testing requirements incl. third-party</td></tr>
            <tr><td>MANAGE &rarr; Risk response &amp; monitoring</td><td>All domains &mdash; ongoing monitoring, incident response, continuous improvement</td></tr>
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
