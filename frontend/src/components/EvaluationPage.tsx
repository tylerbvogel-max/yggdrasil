export default function EvaluationPage() {
  return (
    <div className="info-page">
      <h2 className="info-title">Blind Evaluation</h2>
      <p className="info-subtitle">How responses are compared and neurons are refined</p>

      <h3 className="info-section-title">Evaluation Flow</h3>

      <div className="flow-diagram">
        <div className="flow-step">
          <span className="flow-number">1</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Multiple Responses</div>
            <div className="flow-step-desc">
              Two or more responses are generated from different modes (e.g. neuron-enriched Haiku
              vs raw Opus). Each response includes token usage and cost data.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">2</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Blind Labeling</div>
            <div className="flow-step-desc">
              Responses are stripped of mode identifiers and assigned neutral labels
              (A, B, C…). The evaluator model cannot see which mode produced which response.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">3</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Evaluator Scoring</div>
            <div className="flow-step-desc">
              An evaluator model (configurable) reads the original query and all blind-labeled
              responses, then scores each on 5 dimensions (1–5 scale).
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">4</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Results &amp; Verdict</div>
            <div className="flow-step-desc">
              JSON result includes per-response scores, an overall winner, and a written
              verdict explaining the evaluator's reasoning.
            </div>
          </div>
        </div>
      </div>

      <h3 className="info-section-title">Scoring Dimensions</h3>

      <div className="result-card">
        <table className="score-table eval-dimensions-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Scale</th>
              <th>What It Measures</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Accuracy</strong></td>
              <td>1–5</td>
              <td>Factual correctness and freedom from errors</td>
            </tr>
            <tr>
              <td><strong>Completeness</strong></td>
              <td>1–5</td>
              <td>Coverage of all aspects of the query</td>
            </tr>
            <tr>
              <td><strong>Clarity</strong></td>
              <td>1–5</td>
              <td>Clear structure, readability, and coherent reasoning</td>
            </tr>
            <tr>
              <td><strong>Faithfulness</strong></td>
              <td>1–5</td>
              <td>Staying on-topic without hallucination or drift</td>
            </tr>
            <tr>
              <td><strong>Overall</strong></td>
              <td>1–5</td>
              <td>Holistic quality assessment combining all factors</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="info-section-title">Neuron Refinement Flow</h3>
      <p className="info-section-desc">
        After evaluation, the system can suggest improvements to the neuron graph itself.
      </p>

      <div className="flow-diagram">
        <div className="flow-step">
          <span className="flow-number">1</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Evaluation Complete</div>
            <div className="flow-step-desc">
              An eval result exists with scores, and the system knows which neurons were
              activated for the neuron-mode response.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">2</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Analyzer Review</div>
            <div className="flow-step-desc">
              An analyzer model examines the activated neurons alongside the eval results.
              It identifies gaps, redundancies, and areas for improvement.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">3</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Suggestions Generated</div>
            <div className="flow-step-desc">
              The analyzer produces concrete suggestions: updated content for existing neurons,
              or entirely new neurons to fill gaps. Each suggestion includes a rationale.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">4</span>
          <div className="flow-step-content">
            <div className="flow-step-label">User Applies Changes</div>
            <div className="flow-step-desc">
              Suggestions appear as selectable checkboxes with diff previews.
              The user reviews each suggestion and applies selected ones to the graph.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
