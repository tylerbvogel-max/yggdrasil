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
              <td>$90K &ndash; $130K</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>500-600 hrs senior full-stack + AI + domain expertise</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>IP Sale (one-time)</td>
              <td>$175K &ndash; $400K</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Adjusted for open-source knowledge base (~20-30% reduction from $250-500K)</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>SaaS ARR (20 customers)</td>
              <td>$500K &ndash; $1.2M</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>$2K-5K/mo per seat, mid-tier defense contractors</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Company Valuation (5x ARR)</td>
              <td>$2.5M &ndash; $6M</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Early SaaS multiples, pre-traction</td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
          Knowledge base built entirely from open-source information (FAR/DFARS, MIL-STDs, NADCAP, AS9100, etc.).
          Value is in the retrieval architecture, not the raw content. Google's entire business is built on indexing publicly available web pages.
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#ef4444', marginBottom: 12 }}>Tier 1 &mdash; Highest Leverage (Value Multipliers)</h3>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Multi-Tenant Isolation</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Right now it's single-user SQLite. The moment this serves multiple organizations with isolated neuron graphs,
            it becomes a platform instead of a tool. That's the difference between selling a product and selling a business.
            The Postgres migration is already planned &mdash; extend it with org-scoped graphs.
          </p>
        </div>

        <div className="result-card" style={{ marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text)', marginBottom: 6 }}>Demonstrable Eval Corpus</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Build 50-100 curated question/answer pairs across the 8 departments with known-correct answers.
            Then show a prospect: "Haiku + our system scores 4.2/5 on domain accuracy. Bare Opus scores 3.8. Here's the data."
            That's a sales deck that closes deals.
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
            Federal Register + eCFR auto-detection with neuron impact propagation. The moment neurons self-flag as stale
            based on regulatory changes, this becomes a living compliance system, not a static knowledge base.
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
            for production deployment.
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
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: '#22c55e', marginBottom: 12 }}>Recommended Priority Order</h3>
        <div className="result-card">
          <ol style={{ paddingLeft: 20, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 2 }}>
            <li><strong style={{ color: 'var(--text)' }}>Eval corpus</strong> &mdash; cheap to build, infrastructure exists, transforms every sales conversation</li>
            <li><strong style={{ color: 'var(--text)' }}>Model-agnostic execution</strong> &mdash; de-risks the product, widens addressable market</li>
            <li><strong style={{ color: 'var(--text)' }}>Multi-tenant + Postgres</strong> &mdash; turns it from portfolio project to deployable product</li>
            <li><strong style={{ color: 'var(--text)' }}>RBAC + classification tagging</strong> &mdash; prerequisite for defense customers</li>
            <li><strong style={{ color: 'var(--text)' }}>Regulatory monitoring</strong> &mdash; recurring value engine, justifies SaaS pricing</li>
            <li><strong style={{ color: 'var(--text)' }}>Graph export/import</strong> &mdash; marketplace dynamics, cross-division sharing</li>
          </ol>
        </div>
      </section>

      <section>
        <h3 style={{ color: 'var(--accent)', marginBottom: 12 }}>Defensible IP</h3>
        <div className="result-card">
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 12 }}>
            The defensible IP is in the <strong style={{ color: 'var(--text)' }}>architecture</strong>, not the knowledge content:
          </p>
          <ul style={{ paddingLeft: 20, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.8 }}>
            <li>5-signal neuron scoring engine (Burst, Impact, Practice, Novelty, Recency)</li>
            <li>Spread activation across co-firing graph</li>
            <li>Token-budgeted prompt assembly with score-ordered packing</li>
            <li>Full audit trail &mdash; every classification, score, firing, and prompt is logged</li>
            <li>Blind evaluation framework with cross-tier bias awareness</li>
            <li>Configurable A/B testing infrastructure for LLM cost-quality tradeoffs</li>
            <li>Demonstrated thesis: cheap models + structured context approaches expensive model quality</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
