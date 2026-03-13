export default function MethodologicalRisks() {
  const risks: {
    id: number;
    title: string;
    severity: 'high' | 'medium';
    color: string;
    description: string;
    mechanism: string;
    mitigation: string;
    status: string;
  }[] = [
    {
      id: 1,
      title: 'Popularity Bias / Convergence Trap',
      severity: 'high',
      color: '#ef4444',
      description:
        'Practice and Impact reward neurons that fire often and score well historically. This creates a rich-get-richer loop where established neurons dominate selection and newer or niche neurons starve for exposure.',
      mechanism:
        'Over time, the system converges on a narrow "comfort zone" — performing well on common query patterns while silently failing on edge cases it never selects neurons for. Novelty decays fast and doesn\'t fully counter this. The risk is a graph that looks healthy by its own metrics but has developed blind spots shaped by query distribution.',
      mitigation:
        'Semantic prefilter (built) provides candidate selection independent of firing history — cosine similarity against all 2,054 neuron embeddings doesn\'t care whether a neuron has been popular. Inhibitory regulation (built) prevents regional density from monopolizing context. Periodic "cold neuron audit" to surface high-content neurons with zero or near-zero firings.',
      status: 'Partially mitigated — semantic prefilter + inhibitory regulation reduce but don\'t eliminate the loop',
    },
    {
      id: 2,
      title: 'Circular Evaluation',
      severity: 'high',
      color: '#ef4444',
      description:
        'The system uses LLMs to classify, score, generate, and evaluate. If the scoring pipeline has a systematic blind spot, the evaluation framework shares enough of the same biases that it won\'t catch it.',
      mechanism:
        'Blind A/B helps, but the judge is still an LLM with its own preferences. The system is measuring its performance against itself. Haiku scoring biases could persist undetected because Haiku/Sonnet evaluators share similar training-derived preferences. Self-referential metrics can show steady improvement while actual domain accuracy stagnates or degrades.',
      mitigation:
        'External human eval corpus of 50-100 curated Q&A pairs with known-correct answers (planned). Cross-provider evaluation (using a non-Anthropic model as judge). User rating feedback loop already exists but needs volume to be statistically meaningful.',
      status: 'Partially mitigated — user ratings exist, human eval corpus planned',
    },
    {
      id: 3,
      title: 'Co-Firing Reflects Queries, Not Knowledge',
      severity: 'high',
      color: '#ef4444',
      description:
        'Edges form because neurons fire together in response to user queries, not because they\'re inherently related. The graph\'s emergent structure is shaped by what users happen to ask, which may have significant gaps.',
      mechanism:
        'If nobody asks about the intersection of ITAR and manufacturing processes, those neurons never develop edges — even though the relationship is critical. A subject matter expert would draw different connections than the co-firing graph discovers. The graph encodes usage patterns, not domain truth. Query distribution skew directly becomes knowledge structure skew.',
      mitigation:
        'Semantic prefilter (built) selects candidates by embedding similarity independent of query history, providing a baseline relationship layer that doesn\'t depend on co-firing. Typed edges (stellate vs pyramidal) differentiate local vs cross-domain spread. SME-curated "must-link" edges for known critical relationships remain planned. Autopilot with diverse gap strategies partially explores underqueried areas.',
      status: 'Partially mitigated — semantic prefilter provides query-independent candidate path; co-firing still shapes spread activation',
    },
    {
      id: 4,
      title: 'Classification as Single Point of Failure',
      severity: 'high',
      color: '#ef4444',
      description:
        'Everything downstream depends on Haiku correctly identifying intent, departments, roles, and keywords. A misclassification at the top of the funnel means the scoring engine operates on wrong signals.',
      mechanism:
        'The system will confidently select the best neurons for the wrong interpretation. Because the rest of the pipeline works well, the output may look polished while being grounded in irrelevant context. There is no mechanism to detect "I classified this wrong" after the fact. The error is invisible in the final output quality — it reads well but answers the wrong question.',
      mitigation:
        'Semantic prefilter (built) as primary candidate selection means classification no longer gates which neurons are candidates — all neurons are ranked by embedding similarity regardless of classified departments. Classification output is now scoring context (dept/role boosts), not a filter. A total misclassification degrades scoring boosts but doesn\'t exclude relevant neurons. Multi-query decomposition (planned) would further reduce dependency. Additionally, the structural resolver (built) bypasses classification entirely for deterministic queries — "list departments", "neurons about ITAR", etc. are resolved directly from the database at zero API cost.',
      status: 'Substantially mitigated — semantic prefilter makes classification non-blocking; structural resolver bypasses it entirely for deterministic queries',
    },
    {
      id: 5,
      title: 'Organizational Hierarchy \u2260 Knowledge Hierarchy',
      severity: 'medium',
      color: '#fb923c',
      description:
        'The 6-layer structure mirrors how organizations work, not how knowledge relates. A single FAR clause might be equally relevant to Engineering, Contracts, Program Management, and Manufacturing — but it lives under one parent.',
      mechanism:
        'Cross-ref departments are a patch, not a solution. The fundamental assumption that org structure is a good ontology for knowledge retrieval is unproven and may introduce systematic retrieval failures for cross-cutting topics. Knowledge that spans departments is structurally disadvantaged because it can only inherit one parent\'s classification boost.',
      mitigation:
        'Semantic prefilter (built) eliminates org-chart walls entirely for candidate selection — embedding similarity has no department boundaries. Cross-department pyramidal edges with proven co-firing propagate activation across departments. Inhibitory regulation preserves cross-department representation via Martinotti cell floor guarantee. Community detection (Phase 5) would discover emergent groupings.',
      status: 'Substantially mitigated — semantic prefilter ignores org hierarchy; pyramidal edges + inhibitory floor preserve cross-dept coverage',
    },
    {
      id: 6,
      title: 'Fixed Granularity',
      severity: 'medium',
      color: '#fb923c',
      description:
        'The 100-300 token neuron size determines everything: how many fit in a budget, how many hops are useful, how much irrelevant content rides along with relevant content. But optimal granularity varies by query type.',
      mechanism:
        'A regulatory question might need a single precise clause (20 tokens) while a process question might need a full procedure (500 tokens). The system can\'t adapt its resolution per query — it retrieves at the granularity it was built at. Over-granular neurons lose coherence; under-granular neurons waste tokens on partially relevant content.',
      mitigation:
        'Summary-only fallback in assembly partially addresses this (coarser retrieval when budget is tight). Community summaries (Phase 5) would provide a "zoom out" option. Hierarchical retrieval — return the neuron plus its parent context — could adapt resolution dynamically.',
      status: 'Partially mitigated — summary fallback exists',
    },
    {
      id: 7,
      title: 'MCP Context Without Execution',
      severity: 'medium',
      color: '#fb923c',
      description:
        'When used via MCP, Claude Code receives the neuron-assembled context but makes its own execution decisions. The neuron graph has no control over how the downstream model interprets or uses the provided context.',
      mechanism:
        'The neuron graph carefully scores, ranks, and assembles context optimized for a specific intent. But the receiving model may ignore relevant neurons, misinterpret the hierarchical structure, or combine the neuron context with other information in ways that dilute its value. There is no feedback loop from MCP usage back to the neuron graph — the system cannot learn whether its context was actually helpful.',
      mitigation:
        'Per-project caching (built) provides an indirect feedback signal — neurons that are repeatedly queried for the same project accumulate relevance, creating a weak proxy for usefulness. The query_graph tool returns neuron metadata alongside the prompt, allowing the calling model to understand the scoring rationale. Future: structured feedback from MCP clients back to the neuron firing/utility system.',
      status: 'Partially mitigated — per-project caching provides indirect signal; direct MCP feedback loop planned',
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ marginBottom: 8 }}>Methodological Risks</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 24 }}>
        Known theoretical weaknesses of the neuron knowledge graph approach itself — not implementation
        bugs, but fundamental risks in the methodology. These inform future redesign priorities and
        help evaluate whether observed failures are systemic or incidental.
      </p>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32,
        fontSize: '0.8rem',
      }}>
        <div style={{
          padding: '10px 14px', borderRadius: 6,
          background: '#ef444412', border: '1px solid #ef444433',
        }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>
            {risks.filter(r => r.severity === 'high').length} High Severity
          </span>
          <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
            — could produce confident wrong answers
          </span>
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: 6,
          background: '#fb923c12', border: '1px solid #fb923c33',
        }}>
          <span style={{ color: '#fb923c', fontWeight: 700 }}>
            {risks.filter(r => r.severity === 'medium').length} Medium Severity
          </span>
          <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
            — degrades quality over time
          </span>
        </div>
      </div>

      {risks.map(risk => (
        <div key={risk.id} className="result-card" style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 3,
              background: risk.color + '22', color: risk.color,
              border: `1px solid ${risk.color}44`,
            }}>
              {risk.severity}
            </span>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{risk.title}</h3>
          </div>

          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 10 }}>
            {risk.description}
          </p>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Mechanism
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.6, margin: 0 }}>
              {risk.mechanism}
            </p>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Potential Mitigations
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.6, margin: 0 }}>
              {risk.mitigation}
            </p>
          </div>

          <div style={{
            fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic',
            padding: '6px 10px', borderRadius: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            {risk.status}
          </div>
        </div>
      ))}

      <div className="result-card" style={{ padding: '16px 20px', marginTop: 24 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Compound Risk: Feedback Loop</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 10 }}>
          Risks 1 and 3 compound: the system optimizes toward what it already knows works
          (popularity bias), reinforced by edges that reflect past behavior rather than knowledge
          truth (query-shaped co-firing). This is a feedback loop that could feel like improvement
          while actually narrowing the system's effective knowledge surface. Evaluation metrics
          (Risk 2) may not catch this because they share the same biases.
        </p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
          The strongest countermeasure &mdash; a scoring path independent of usage history &mdash; is now
          partially implemented via the semantic prefilter. Candidate selection by embedding similarity
          is fully independent of firing history and co-firing patterns. However, spread activation
          still amplifies query-shaped associations. Community detection (Phase 5) would provide a
          structural countermeasure at the graph level.
        </p>
      </div>
      <div style={{ marginTop: 40 }}>
        <h2 style={{ marginBottom: 8 }}>Evaluation Limitations</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 20 }}>
          Known limitations of the evaluation and measurement framework. These affect how much
          confidence to place in reported metrics, not the architecture itself.
        </p>

        <div className="result-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gap: 14, fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: 'var(--text)' }}>Sample size</strong> — The dataset is relatively small
              compared to production evaluation suites. Power analysis flags underpowered tests, but some genuine
              effects may not reach significance.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Judge bias</strong> — The evaluator model introduces
              systematic bias. An Opus judge tends to rate Haiku answers slightly lower than a Haiku judge would.
              This is documented but not corrected for.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Ordinal scale</strong> — The 1-5 scoring scale is ordinal,
              not interval. Mean-based statistics (t-test, Cohen's d) treat the scale as interval. Mann-Whitney U
              respects the ordinal nature but is less interpretable.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Query distribution</strong> — Evaluation queries may not be
              representative of production workload. If queries disproportionately cover well-represented topics,
              quality metrics may overstate real-world performance.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Temporal confounds</strong> — The early-vs-late quality trend
              test attributes improvement to graph growth, but other factors changed over time (prompt refinements,
              content quality improvements).
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Pricing volatility</strong> — Cost models use current
              Anthropic pricing. Relative tier pricing has been stable, but absolute dollar figures should be
              considered snapshots.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Fairness scope</strong> — Fairness analysis is limited to
              department-level coverage balance and eval quality parity. Demographic fairness of user populations
              is not applicable as a single-author system but would be required in multi-tenant deployment.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Cross-validation determinism</strong> — Fold assignment uses
              a deterministic hash-based shuffle per mode. Results are reproducible but may be sensitive to the
              specific partition. Monte Carlo cross-validation would be more robust but slower.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
