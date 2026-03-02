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
          <div className="flow-group-label">Stage 1 — Neuron Preparation</div>

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
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2b</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Neuron Scoring</div>
              <div className="flow-step-desc">
                Candidate neurons are filtered by department &amp; role match, then each is scored
                using 6 weighted signals. Top-K neurons are selected by composite score.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2c</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Prompt Assembly</div>
              <div className="flow-step-desc">
                Selected neuron content is assembled into a ~4000-token system prompt.
                Neurons are ordered by layer (L0→L5) for hierarchical context.
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

      <h3 className="info-section-title">6 Scoring Signals</h3>
      <p className="info-section-desc">
        Each neuron receives a composite score from these six signals, weighted and summed.
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
      </div>
    </div>
  )
}
