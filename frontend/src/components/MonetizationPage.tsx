export default function MonetizationPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ color: '#ef4444', marginBottom: 24, borderBottom: '2px solid #ef444433', paddingBottom: 12 }}>
        Monetization Strategy
      </h2>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--accent)', marginBottom: 12 }}>Valuation Estimates</h3>
        {/* Cost to Develop */}
        <div className="result-card" style={{ marginBottom: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h4 style={{ color: 'var(--text)', margin: 0 }}>Cost to Develop</h4>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>$180K &ndash; $260K</span>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 8 }}>
            Estimated 1,000&ndash;1,200+ hours of senior-level engineering at $150&ndash;$220/hr (blended US contractor rate for
            full-stack + AI/ML + domain expertise). This is what it would cost to hire someone to rebuild this from scratch.
          </p>
          <table className="score-table" style={{ fontSize: '0.78rem' }}>
            <thead><tr><th>Work Area</th><th>Est. Hours</th><th>Rationale</th></tr></thead>
            <tbody>
              <tr>
                <td>Neuron graph + 6-layer hierarchy</td>
                <td>180&ndash;220</td>
                <td style={{ color: 'var(--text-dim)' }}>2,055 neurons, department/role/task/system/decision/output layers, seed data pipeline, CRUD + bulk operations</td>
              </tr>
              <tr>
                <td>5-signal scoring engine</td>
                <td>100&ndash;130</td>
                <td style={{ color: 'var(--text-dim)' }}>Burst, Impact, Practice, Novelty, Recency with per-signal normalization, spread activation across co-firing graph, propagation logging</td>
              </tr>
              <tr>
                <td>Two-stage Haiku pipeline</td>
                <td>80&ndash;100</td>
                <td style={{ color: 'var(--text-dim)' }}>Classify intent &rarr; score neurons &rarr; token-budgeted assembly &rarr; execute. Prompt engineering, model registry, cost tracking</td>
              </tr>
              <tr>
                <td>MCP server + structural resolver</td>
                <td>60&ndash;80</td>
                <td style={{ color: 'var(--text-dim)' }}>7-tool stdio MCP server, structural fast path for zero-cost deterministic queries, per-project neuron caching with EMA boost and cold-start protection</td>
              </tr>
              <tr>
                <td>Autopilot + emergent queue</td>
                <td>80&ndash;100</td>
                <td style={{ color: 'var(--text-dim)' }}>5-strategy gap detection, autonomous runs, citation pattern detection, batch ingestion, auto-clustering via label propagation</td>
              </tr>
              <tr>
                <td>Eval framework + drift detection</td>
                <td>60&ndash;80</td>
                <td style={{ color: 'var(--text-dim)' }}>Blind A/B evaluation, z-score drift on 5 signals, provenance tracking with neuron source links</td>
              </tr>
              <tr>
                <td>Compliance architecture</td>
                <td>100&ndash;130</td>
                <td style={{ color: 'var(--text-dim)' }}>NIST AI RMF (25 subcategories), AIUC-1 (45 requirements, 6 domains), ISO 42001 crosswalk, input guards, reference detection hooks, fairness analysis</td>
              </tr>
              <tr>
                <td>PostgreSQL + async backend</td>
                <td>80&ndash;100</td>
                <td style={{ color: 'var(--text-dim)' }}>17 backend services, 7 API routers, async SQLAlchemy + asyncpg, multi-tenant user_id columns, centralized model registry</td>
              </tr>
              <tr>
                <td>React frontend + D3 visualizations</td>
                <td>120&ndash;150</td>
                <td style={{ color: 'var(--text-dim)' }}>35 components, graph visualization, heatmap, chord diagram, department explorer, query interface, eval dashboard, compliance pages, monetization analysis</td>
              </tr>
              <tr>
                <td>Aerospace domain research</td>
                <td>80&ndash;100</td>
                <td style={{ color: 'var(--text-dim)' }}>FAR/DFARS, MIL-STDs, NADCAP, AS9100 knowledge curation, domain-specific neuron content across 9 departments and 52 roles</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 8, fontStyle: 'italic' }}>
            Low end: 1,000 hrs &times; $150/hr = $150K, padded to $180K for project management overhead.
            High end: 1,200 hrs &times; $200/hr = $240K, padded to $260K. Rates reflect senior engineers with both AI/ML pipeline
            experience and regulated-industry domain knowledge &mdash; a rare combination that commands premium rates.
          </div>
        </div>

        {/* IP Sale */}
        <div className="result-card" style={{ marginBottom: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h4 style={{ color: 'var(--text)', margin: 0 }}>IP Sale (one-time)</h4>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>$500K &ndash; $900K</span>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 8 }}>
            IP sale value is typically 2&ndash;4x development cost, reflecting the buyer's avoided risk, time-to-market
            acceleration, and the value of a working system vs. a greenfield build. The multiplier accounts for:
          </p>
          <ul style={{ paddingLeft: 20, color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.7, marginBottom: 8 }}>
            <li><strong style={{ color: 'var(--text)' }}>Eliminated build risk</strong> &mdash; Buyer gets a proven, working system. No architectural false starts, no "6 months in and we need to pivot the scoring model." A ground-up build has ~30% chance of significant rework; buying eliminates that.</li>
            <li><strong style={{ color: 'var(--text)' }}>Time-to-market</strong> &mdash; 12&ndash;18 months of development compressed to an integration timeline. In regulated industries where compliance certification alone takes 3&ndash;6 months, the calendar savings are worth more than the dollar savings.</li>
            <li><strong style={{ color: 'var(--text)' }}>Domain-specific neuron corpus</strong> &mdash; 2,055 neurons across 9 aerospace departments with co-firing relationships isn't just code &mdash; it's curated institutional knowledge. Recreating the corpus requires the same domain research regardless of how good your engineers are.</li>
            <li><strong style={{ color: 'var(--text)' }}>Compliance head start</strong> &mdash; NIST AI RMF gap analysis, AIUC-1 assessment with 45 requirements, ISO 42001 crosswalk already mapped. A buyer in defense/aerospace needs this anyway; getting it pre-built with the product saves 200+ hours of compliance work.</li>
            <li><strong style={{ color: 'var(--text)' }}>MCP integration layer</strong> &mdash; The MCP server with structural resolver and project caching represents a ready-made developer integration surface. Building MCP tooling from scratch requires deep protocol knowledge and iteration on the tool API design.</li>
            <li><strong style={{ color: 'var(--text)' }}>Evaluation infrastructure</strong> &mdash; Blind A/B framework, drift detection, autopilot with gap detection, provenance tracking. This is the kind of infrastructure that gets deprioritized in internal builds but is critical for production AI systems.</li>
          </ul>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Low end: ~2.5x development cost ($180K &times; 2.8 &asymp; $500K). High end: ~3.5x ($260K &times; 3.5 &asymp; $900K).
            Comparable acquisitions: AI startups with working products in regulated verticals have been acquired for $500K&ndash;$2M
            at pre-revenue stage, with the premium driven by compliance readiness and domain specificity.
          </div>
        </div>

        {/* SaaS ARR */}
        <div className="result-card" style={{ marginBottom: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h4 style={{ color: 'var(--text)', margin: 0 }}>SaaS ARR (20 customers)</h4>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>$1.2M &ndash; $3M</span>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 8 }}>
            Per-seat pricing of $5K&ndash;$12.5K/month across 20 enterprise customers. The range reflects tiered pricing
            based on feature access and usage volume.
          </p>
          <table className="score-table" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
            <thead><tr><th>Tier</th><th>Monthly/Seat</th><th>Includes</th><th>Target Customer</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Standard</td>
                <td>$5K</td>
                <td style={{ color: 'var(--text-dim)' }}>Neuron graph queries, MCP IDE integration, structural fast path (zero-cost lookups), scoring pipeline, basic compliance dashboard</td>
                <td style={{ color: 'var(--text-dim)' }}>Mid-size aerospace suppliers, engineering firms needing domain-enriched AI</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Professional</td>
                <td>$8K</td>
                <td style={{ color: 'var(--text-dim)' }}>+ Autopilot gap detection, drift monitoring, evaluation framework, per-project caching, auto-clustering insights, batch ingestion</td>
                <td style={{ color: 'var(--text-dim)' }}>Defense contractors needing autonomous knowledge maintenance + audit trails</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Enterprise</td>
                <td>$12.5K</td>
                <td style={{ color: 'var(--text-dim)' }}>+ Org-scoped tenant isolation, RBAC on neurons, full NIST/AIUC-1 compliance posture, regulatory monitoring, transparency reports, custom neuron graphs</td>
                <td style={{ color: 'var(--text-dim)' }}>Prime contractors, government agencies requiring certified AI with classification controls</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 8 }}>
            ARR calculation: 20 customers &times; weighted average $5K&ndash;$12.5K/mo &times; 12 months = $1.2M&ndash;$3M.
            Pricing is benchmarked against enterprise AI/knowledge management platforms in regulated industries:
            Palantir Foundry ($5&ndash;$15K/seat/mo), Databricks ($5&ndash;$20K/mo for enterprise), Veeva ($3&ndash;$10K/seat/mo in life sciences).
            Compliance certification and defense-sector specificity justify the upper range &mdash; these customers expect to pay premium
            for tools that satisfy procurement requirements out of the box.
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Why 20 customers is conservative:</strong> The US aerospace and defense industry
            has 200+ prime contractors and thousands of Tier 1&ndash;3 suppliers. Even 20 customers represents {'<'}1% market penetration.
            The constraint isn't addressable market &mdash; it's sales capacity and compliance certification timeline.
          </p>
        </div>

        {/* Company Valuation */}
        <div className="result-card" style={{ marginBottom: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h4 style={{ color: 'var(--text)', margin: 0 }}>Company Valuation (5&ndash;8x ARR)</h4>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>$6M &ndash; $24M</span>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: 8 }}>
            SaaS companies are typically valued at a multiple of ARR. The 5&ndash;8x range reflects the characteristics
            of the business:
          </p>
          <table className="score-table" style={{ fontSize: '0.78rem', marginBottom: 8 }}>
            <thead><tr><th>Multiple Driver</th><th>Impact</th><th>Yggdrasil Position</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Vertical SaaS premium</td>
                <td>&uarr; multiple</td>
                <td style={{ color: 'var(--text-dim)' }}>Domain-specific AI for aerospace/defense commands higher multiples than horizontal tools (Veeva trades at 8&ndash;12x; vertical &gt; horizontal)</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Compliance moat</td>
                <td>&uarr; multiple</td>
                <td style={{ color: 'var(--text-dim)' }}>Pre-certified NIST/AIUC-1 creates switching costs. Once a customer's auditors approve, moving to an uncertified competitor triggers re-audit</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Net revenue retention</td>
                <td>&uarr; multiple</td>
                <td style={{ color: 'var(--text-dim)' }}>Regulatory monitoring + autopilot create recurring value. Neuron graphs deepen over time, increasing switching cost. Expected NRR {'>'} 120%</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Early stage / scale risk</td>
                <td>&darr; multiple</td>
                <td style={{ color: 'var(--text-dim)' }}>Pre-revenue, single-developer team, no proven sales motion yet. This is the primary discount factor</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Developer tooling angle</td>
                <td>&uarr; multiple</td>
                <td style={{ color: 'var(--text-dim)' }}>MCP server turns Yggdrasil into developer infrastructure (not just a SaaS app). Dev tools companies (Snyk, Vercel, Postman) command 8&ndash;15x at growth stage</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>AI infrastructure category</td>
                <td>&uarr; multiple</td>
                <td style={{ color: 'var(--text-dim)' }}>AI-native companies in 2024&ndash;2026 see elevated multiples. Context enrichment / RAG infrastructure is a particularly hot category</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Low end: $1.2M ARR &times; 5x = $6M (accounts for early-stage discount, pre-revenue risk).
            High end: $3M ARR &times; 8x = $24M (assumes compliance certification complete, proven sales motion, strong NRR).
            The wide range reflects uncertainty at pre-revenue stage &mdash; the multiple compresses or expands dramatically
            based on whether the first 5 customers validate the pricing model.
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4 }}>
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
            { label: 'Backend Services', value: '17', sub: 'Scoring, classification, MCP, caching' },
            { label: 'API Routers', value: '7', sub: 'REST endpoints + clusters' },
            { label: 'MCP Tools', value: '7', sub: 'Zero-HTTP context enrichment' },
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
            <div>MCP server mode (stdio, 7 tools)</div>
            <div>Structural fast path (zero-cost resolver)</div>
            <div>Per-project neuron caching (EMA boost)</div>
            <div>Auto-clustering via label propagation</div>
            <div>Neuron provenance tracking + audit trail</div>
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

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Developer Integration (MCP Server)</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Yggdrasil exposes its full pipeline as an MCP (Model Context Protocol) server. Claude Code, Cursor, and
            other MCP-capable IDEs can call directly into the neuron graph for context enrichment without HTTP
            round-trips. This positions Yggdrasil as infrastructure that plugs into the developer's existing
            workflow &mdash; not another tool they have to switch to. The structural fast path means simple lookups
            cost exactly $0 in API fees.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#facc15', marginBottom: 12 }}>Tier 3 &mdash; Polish & UX</h3>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            <div><strong style={{ color: 'var(--text)' }}>Streaming responses (SSE)</strong> &mdash; Real-time output so the UI feels responsive on long Opus calls</div>
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
            <li>MCP server mode &mdash; direct IDE integration without HTTP overhead</li>
            <li>Structural fast path &mdash; zero-cost deterministic queries bypass LLM classification</li>
            <li>Per-project neuron relevance caching with cold-start protection</li>
            <li>Cross-department auto-clustering via label propagation on co-firing edges</li>
            <li>Demonstrated thesis: cheap models + structured context approaches expensive model quality</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
