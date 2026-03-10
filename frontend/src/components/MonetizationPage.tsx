export default function MonetizationPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ color: '#ef4444', marginBottom: 24, borderBottom: '2px solid #ef444433', paddingBottom: 12 }}>
        Monetization Strategy
      </h2>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: 12 }}>Valuation Estimates</h3>
        <table className="score-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Range</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Cost to Develop</td>
              <td>$150K &ndash; $220K</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>800-1,000+ hrs senior full-stack + AI/ML pipeline + aerospace domain + compliance architecture</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>IP Sale (one-time)</td>
              <td>$400K &ndash; $750K</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>2K+ neuron graph, 13 backend services, 3 compliance frameworks, multi-signal scoring IP, full eval pipeline</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>SaaS ARR (20 customers)</td>
              <td>$960K &ndash; $2.4M</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>$4K-10K/mo per seat; autopilot, batch ingestion, drift detection, and compliance posture justify premium tiers</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Company Valuation (5&ndash;8x ARR)</td>
              <td>$4.8M &ndash; $19.2M</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Compliance-certified AI SaaS in regulated verticals commands 5&ndash;8x; multi-tenant readiness and autonomous pipeline increase multiple</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
          Knowledge base built entirely from open-source information (FAR/DFARS, MIL-STDs, NADCAP, AS9100, etc.).
          Value is in the retrieval architecture and compliance posture, not the raw content.
          Google's entire business is built on indexing publicly available web pages.
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: 12 }}>Current Development Scope</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Neurons', value: '2,055', sub: '9 departments, 52 roles' },
            { label: 'Co-firing Edges', value: '40,595', sub: 'Spread activation graph' },
            { label: 'Queries Executed', value: '189', sub: '5,209 neuron firings' },
            { label: 'Evaluations', value: '262', sub: 'Blind A/B scored' },
            { label: 'Refinements', value: '1,623', sub: 'Graph mutations logged' },
            { label: 'Autopilot Runs', value: '123', sub: 'Autonomous gap-filling' },
            { label: 'Emergent Queue', value: '401', sub: 'Detected citation patterns' },
            { label: 'Frontend Components', value: '35', sub: 'React + TypeScript + D3' },
            { label: 'Backend Services', value: '13', sub: 'Scoring, classification, assembly' },
            { label: 'API Routers', value: '6', sub: 'REST endpoints' },
            { label: 'Database', value: 'PostgreSQL', sub: 'Async SQLAlchemy, multi-user ready' },
            { label: 'Compliance Frameworks', value: '3', sub: 'NIST AI RMF, AIUC-1, ISO 42001' },
          ].map(stat => (
            <div key={stat.label} className="result-card" style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{stat.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{stat.sub}</div>
            </div>
          ))}
        </div>
        <div className="result-card" style={{ padding: '12px 16px' }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 8, fontSize: '0.9rem' }}>Architecture Components Built</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            <div>5-signal neuron scoring engine</div>
            <div>Spread activation across co-firing graph</div>
            <div>Two-stage classify &rarr; score pipeline</div>
            <div>Token-budgeted prompt assembly</div>
            <div>Blind A/B evaluation framework</div>
            <div>Autopilot with multi-strategy gap detection</div>
            <div>Emergent citation queue + batch ingestion</div>
            <div>Z-score drift detection (5 signals)</div>
            <div>Model registry with cost tracking</div>
            <div>PostgreSQL with multi-tenant user_id columns</div>
            <div>D3 visualizations (graph, heatmap, chord)</div>
            <div>NIST/AIUC-1/ISO 42001 compliance tracking</div>
            <div>Input guard + reference detection hooks</div>
            <div>Performance methodology + fairness analysis</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#ef4444', marginBottom: 12 }}>Tier 1 &mdash; Highest Leverage (Value Multipliers)</h3>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>
            NIST AI RMF + AIUC-1 Certification
            <span style={{ fontSize: '0.7rem', marginLeft: 8, padding: '2px 8px', borderRadius: 3, background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}>IN PROGRESS</span>
          </h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Full NIST AI RMF gap analysis is maintained with 25 subcategories tracked (SecurityPage). AIUC-1 compliance assessment
            covers 45 requirements across 6 domains with source framework crosswalks to NIST, ISO 42001, and EU AI Act.
            Current posture: {'>'}50% addressed or partial. Completing certification would make Yggdrasil one of the
            first AI retrieval systems with third-party-audited compliance &mdash; a hard moat in regulated industries
            where procurement requires documented risk management frameworks. Defense and aerospace RFPs increasingly
            mandate NIST AI RMF alignment; having it pre-certified eliminates months from sales cycles.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>
            Multi-Tenant Isolation
          </h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            PostgreSQL migration is complete and nullable <code style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>user_id</code> columns
            have been added to all user-scoped tables (queries, firings, evals, refinements, autopilot runs).
            The next step is org-scoped neuron graphs with tenant isolation and row-level security policies.
            That's the difference between selling a product and selling a business. The centralized model registry
            is in place to support per-tenant billing when the SDK swap happens.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Demonstrable Eval Corpus</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Build 50-100 curated question/answer pairs across the 9 departments with known-correct answers.
            Then show a prospect: "Haiku + our system scores 4.2/5 on domain accuracy. Bare Opus scores 3.8. Here's the data."
            The blind A/B evaluation framework already exists &mdash; just need the corpus. Combined with NIST compliance
            documentation, this becomes a sales deck that satisfies both technical and procurement reviewers.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Model-Agnostic Execution Layer</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            The scoring engine, neuron graph, and prompt assembly have nothing Claude-specific about them.
            If you can swap in GPT-4, Gemini, or Llama behind the same neuron pipeline, the value proposition shifts from
            "Claude optimization tool" to "LLM-agnostic institutional knowledge platform." That's a much larger market
            and eliminates single-vendor risk &mdash; which defense procurement cares about deeply.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#fb923c', marginBottom: 12 }}>Tier 2 &mdash; Strong Differentiators</h3>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Regulatory Monitoring Pipeline</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Federal Register + eCFR auto-detection with neuron impact propagation. The emergent queue already detects
            citation patterns in LLM responses. The moment neurons self-flag as stale based on regulatory changes,
            this becomes a living compliance system, not a static knowledge base.
            That's recurring value that justifies recurring revenue.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Export/Import of Neuron Graphs</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Let organizations snapshot, version, and share neuron corpora. A company could maintain a "base aerospace graph"
            and layer project-specific neurons on top. This creates a marketplace dynamic &mdash; even internally across divisions.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>RBAC on Neurons</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Some knowledge is ITAR-controlled, some is CUI, some is public. Tag neurons with classification levels
            and filter assembly based on user clearance. In defense, this isn't a feature &mdash; it's a prerequisite
            for production deployment. NIST AI RMF GOV-6.1 and AIUC-1 B006 already reference access control requirements &mdash;
            RBAC directly addresses both.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Compliance-as-a-Feature Dashboard</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Expose the NIST/AIUC-1 compliance posture as a live customer-facing dashboard. Customers can show their
            auditors real-time drift detection, scoring health, activity logs, and gap status without manual reporting.
            Transparency reports (AIUC-1 E014) become self-service. This turns compliance overhead into a product feature
            that competitors can't easily replicate.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#facc15', marginBottom: 12 }}>Tier 3 &mdash; Polish & UX</h3>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            <div><strong style={{ color: 'var(--text)' }}>Streaming responses (SSE)</strong> &mdash; Real-time output so the UI feels responsive on long Opus calls</div>
            <div><strong style={{ color: 'var(--text)' }}>Neuron provenance tracking</strong> &mdash; Which bolster/refine session created each neuron, full audit trail</div>
            <div><strong style={{ color: 'var(--text)' }}>Cost forecasting</strong> &mdash; "This query configuration will cost ~$X based on historical patterns"</div>
            <div><strong style={{ color: 'var(--text)' }}>Automated transparency reports</strong> &mdash; Scheduled PDF/HTML generation covering scoring distributions, query volumes, cost trends, and compliance status per AIUC-1 E014</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#22c55e', marginBottom: 12 }}>Recommended Priority Order</h3>
        <div className="result-card">
          <ol style={{ paddingLeft: 20, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 2 }}>
            <li><strong style={{ color: 'var(--text)' }}>Complete NIST/AIUC-1 compliance gaps</strong> &mdash; close remaining gaps (input filtering, auth, output risk detection), engage third-party auditor</li>
            <li><strong style={{ color: 'var(--text)' }}>Eval corpus</strong> &mdash; cheap to build, infrastructure exists, transforms every sales conversation</li>
            <li><strong style={{ color: 'var(--text)' }}>Model-agnostic execution</strong> &mdash; de-risks the product, widens addressable market</li>
            <li><strong style={{ color: 'var(--text)' }}>Multi-tenant + org isolation</strong> &mdash; PostgreSQL done; add tenant scoping to turn it into a deployable platform</li>
            <li><strong style={{ color: 'var(--text)' }}>RBAC + classification tagging</strong> &mdash; prerequisite for defense customers, directly satisfies NIST GOV-6.1</li>
            <li><strong style={{ color: 'var(--text)' }}>Regulatory monitoring</strong> &mdash; recurring value engine, justifies SaaS pricing</li>
            <li><strong style={{ color: 'var(--text)' }}>Compliance dashboard + transparency reports</strong> &mdash; turns audit overhead into a sellable feature</li>
            <li><strong style={{ color: 'var(--text)' }}>Graph export/import</strong> &mdash; marketplace dynamics, cross-division sharing</li>
          </ol>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: 12 }}>Compliance as Competitive Moat</h3>
        <div className="result-card">
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 12 }}>
            Most AI startups treat compliance as a checkbox they'll handle later. Yggdrasil is building it into the
            architecture from day one. Here's why that matters for monetization:
          </p>
          <table className="score-table" style={{ marginBottom: 12 }}>
            <thead>
              <tr>
                <th>Advantage</th>
                <th>Impact</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Procurement shortcut</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Pre-certified NIST AI RMF alignment cuts 3-6 months off government/defense sales cycles</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Price premium</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Compliance-certified AI tools command 30-50% higher pricing than uncertified alternatives</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Switching cost</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Once a customer's auditors approve the system, switching to an uncertified competitor triggers re-audit</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>RFP eligibility</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Growing number of defense/aerospace RFPs require NIST AI RMF alignment &mdash; no compliance = no bid</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Trust signal</td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Third-party AIUC-1 audit badge signals maturity that most AI startups can't demonstrate</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 style={{ color: 'var(--accent)', marginBottom: 12 }}>Defensible IP</h3>
        <div className="result-card">
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 12 }}>
            The defensible IP is in the <strong style={{ color: 'var(--text)' }}>architecture and compliance posture</strong>, not the knowledge content:
          </p>
          <ul style={{ paddingLeft: 20, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.8 }}>
            <li>5-signal neuron scoring engine (Burst, Impact, Practice, Novelty, Recency)</li>
            <li>Spread activation across 40K+ co-firing edges with propagation logging</li>
            <li>Token-budgeted prompt assembly with score-ordered packing</li>
            <li>Full audit trail &mdash; every classification, score, firing, and prompt is logged (AIUC-1 E015)</li>
            <li>Blind evaluation framework with cross-tier bias awareness (262 evaluations)</li>
            <li>Autopilot with 5-strategy gap detection (123 autonomous runs)</li>
            <li>Emergent citation queue with batch ingestion pipeline (401 detected patterns)</li>
            <li>Z-score drift detection on scoring distributions (NIST GOV-1.5)</li>
            <li>NIST AI RMF + AIUC-1 compliance framework with 45-requirement crosswalk to ISO 42001</li>
            <li>Multi-user-ready PostgreSQL schema with centralized model registry</li>
            <li>Demonstrated thesis: cheap models + structured context approaches expensive model quality</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
