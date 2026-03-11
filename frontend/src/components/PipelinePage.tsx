export default function PipelinePage() {
  return (
    <div className="info-page">
      <h2 className="info-title">Neuron Pipeline</h2>
      <p className="info-subtitle">How queries flow through classification, scoring, and prompt assembly</p>

      <div className="flow-diagram">
        <div className="flow-step">
          <span className="flow-number">1</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Query Submitted</div>
            <div className="flow-step-desc">
              User enters a query with mode selection (neuron, raw Haiku, raw Opus).
              Multiple modes can run in parallel for blind comparison.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-group">
          <div className="flow-group-label">Stage 1 — Neuron Preparation (parallel)</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="flow-step substep">
              <span className="flow-number">2a</span>
              <div className="flow-step-content">
                <div className="flow-step-label">Classification via Haiku</div>
                <div className="flow-step-desc">
                  Haiku analyzes the query and extracts structured metadata:
                  <span className="tag intent">intent</span>{' '}
                  <span className="tag dept">departments</span>{' '}
                  <span className="tag role">role_keys</span>{' '}
                  <span className="tag keyword">keywords</span>
                  <br /><em style={{ color: 'var(--text-dim)' }}>~200ms, runs in parallel with 2b</em>
                </div>
              </div>
            </div>

            <div className="flow-step substep">
              <span className="flow-number">2b</span>
              <div className="flow-step-content">
                <div className="flow-step-label">Query Embedding + Semantic Prefilter</div>
                <div className="flow-step-desc">
                  Query is embedded via <code>all-MiniLM-L6-v2</code> (384-dim), then
                  a matrix dot product against all ~2,054 neuron embeddings selects the top-N
                  candidates by cosine similarity. No department/role filtering &mdash; the
                  embedding is the filter.
                  <br /><em style={{ color: 'var(--text-dim)' }}>~11ms, runs in parallel with 2a</em>
                </div>
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2c</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Neuron Scoring</div>
              <div className="flow-step-desc">
                Semantic candidates are scored using 6 gated signals (Relevance as stimulus gate,
                then Burst, Impact, Precision, Novelty, Recency as modulators). Classification
                output provides dept/role scoring boosts (1.25&times;/1.5&times;), not hard filters.
                Pre-computed cosine similarities from the prefilter skip redundant embedding lookups.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2d</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Spreading Activation (Typed Edges)</div>
              <div className="flow-step-desc">
                Multi-hop spread through the Hebbian co-firing graph with typed edges:
                <strong> stellate</strong> (intra-department, decay=0.3) for liberal local spread, and
                <strong> pyramidal</strong> (cross-department, min_weight=0.20) for high-confidence
                cross-domain connections. Up to 3 hops with compounding decay. Max-path aggregation
                prevents hub bias.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2e</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Inhibitory Regulation</div>
              <div className="flow-step-desc">
                3-pass biologically-inspired suppression replaces the static diversity floor:
                (1) <strong>Regional density</strong> (basket cell) &mdash; per-dept threshold + max_survivors.
                (2) <strong>Redundancy</strong> (chandelier cell) &mdash; pairwise cosine {'>'} 0.92 within dept suppresses near-duplicates.
                (3) <strong>Cross-ref floor</strong> (Martinotti cell) &mdash; guarantees minimum dept representation.
                Returns survivor_count as effective top-K.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2f</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Prompt Assembly</div>
              <div className="flow-step-desc">
                Surviving neurons are assembled into a token-budgeted system prompt (configurable 1K&ndash;32K).
                Neurons are ordered by layer (L0&rarr;L5) for hierarchical context, with automatic
                fallback to summary-only when full content exceeds budget.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2g</span>
            <div className="flow-step-content">
              <div className="flow-step-label">External Reference Detection</div>
              <div className="flow-step-desc">
                Post-assembly, assembled neurons are scanned for references to external authoritative
                sources &mdash; regulations (FAR, ITAR, NIST, MIL-STDs), technical specs (Python docs,
                PySpark APIs, framework signatures). Unresolved references are queued for future
                acquisition as <strong>emergent neurons</strong>. Non-blocking; the query proceeds immediately.
              </div>
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">3</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Parallel Execution</div>
            <div className="flow-step-desc">
              All selected modes execute concurrently. Neuron mode sends the enriched system prompt;
              raw modes send the query directly without neuron context.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">4</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Results Collected</div>
            <div className="flow-step-desc">
              Responses return with token usage and cost breakdowns.
              If multiple modes ran, blind evaluation can compare quality.
            </div>
          </div>
        </div>
      </div>

      <h3 className="info-section-title">Scoring Signals</h3>
      <p className="info-section-desc">
        Each neuron receives a composite score from a gated modulatory system: semantic similarity
        (the stimulus gate) must exceed threshold before 5 modulatory signals activate.
        Spreading activation through typed edges provides an additional boost.
        All time-based signals use query counts instead of tokens for stability.
      </p>

      <div className="signal-grid">
        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot burst" />
            <span className="signal-name">Burst</span>
          </div>
          <code className="signal-formula">min(1, fires / 15)</code>
          <div className="signal-desc">
            <strong>Hot hand detector.</strong> Counts firings in the last 50 queries.
            If a neuron has been useful recently, it's probably relevant now too.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot impact" />
            <span className="signal-name">Impact</span>
          </div>
          <code className="signal-formula">clamp(avg_utility, 0, 1)</code>
          <div className="signal-desc">
            <strong>User satisfaction score.</strong> When you rate a response, those ratings
            flow back to the neurons that helped produce it. Neurons that consistently
            contribute to highly-rated answers rise to the top.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot precision" />
            <span className="signal-name">Precision</span>
          </div>
          <code className="signal-formula">fires / dept_queries</code>
          <div className="signal-desc">
            <strong>Specialist accuracy.</strong> Measures how often this neuron fires
            relative to its department's total activity. Floors at 0.3 when data is scarce
            (fewer than 5 department queries).
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot novelty" />
            <span className="signal-name">Novelty</span>
          </div>
          <code className="signal-formula">max(0, 1 − age / 200)</code>
          <div className="signal-desc">
            <strong>New knowledge bonus.</strong> Age measured in query count since creation.
            Freshly created neurons get a head start so they can prove themselves
            before older neurons crowd them out.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot recency" />
            <span className="signal-name">Recency</span>
          </div>
          <code className="signal-formula">e<sup>−since_last / 500</sup></code>
          <div className="signal-desc">
            <strong>"Use it or lose it."</strong> Measured in queries since last firing.
            Neurons that haven't been activated in a while gradually fade in priority.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot relevance" />
            <span className="signal-name">Relevance</span>
          </div>
          <code className="signal-formula">matches / len(keywords)</code>
          <div className="signal-desc">
            <strong>Content match.</strong> Counts how many classified keywords appear
            in the neuron's label, summary, and content. Ensures neurons are topically
            relevant to the current query.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot spread" />
            <span className="signal-name">Spread</span>
          </div>
          <code className="signal-formula">src × edge_w × decay</code>
          <div className="signal-desc">
            <strong>Associative recall with typed edges.</strong> After scoring, activation spreads
            through the co-firing graph up to 3 hops. <strong>Stellate</strong> edges (intra-department)
            use decay=0.3 for broader local spread. <strong>Pyramidal</strong> edges (cross-department)
            require min_weight=0.20 for proven cross-domain links. Max-path aggregation prevents hub bias.
          </div>
        </div>
      </div>
    </div>
  )
}
