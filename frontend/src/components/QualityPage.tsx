import { useComplianceAudit } from '../hooks/useComplianceAudit';

export default function QualityPage() {
  const { data, error, loading } = useComplianceAudit();

  if (error) return <div className="error-msg">{error}</div>;
  if (loading || !data) return <div className="loading">Analyzing quality metrics...</div>;

  const { validity_reliability, bias_assessment } = data;

  return (
    <div className="security-page">
      <h2>Quality Analysis</h2>
      <p className="security-intro">
        Statistical validation of evaluation results: confidence intervals, cross-validation stability,
        mode comparison, and scoring signal robustness. Based on {validity_reliability.total_evals} evaluations.
      </p>

      {/* Summary cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="card-value">{validity_reliability.total_evals}</div>
          <div className="card-label">Total Evaluations</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{Object.keys(validity_reliability.confidence_intervals).length}</div>
          <div className="card-label">Answer Modes</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{
            color: Object.values(validity_reliability.cross_validation).every(cv => cv.stable) ? '#22c55e' : '#fb923c'
          }}>
            {Object.values(validity_reliability.cross_validation).every(cv => cv.stable) ? 'Stable' : 'Variance'}
          </div>
          <div className="card-label">Cross-Validation</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{
            color: Object.values(validity_reliability.signal_robustness).every(r => r.robust) ? '#22c55e' : '#fb923c'
          }}>
            {Object.values(validity_reliability.signal_robustness).filter(r => r.robust).length}/{Object.keys(validity_reliability.signal_robustness).length}
          </div>
          <div className="card-label">Robust Signals</div>
        </div>
      </div>

      {/* Eval Score Disaggregation */}
      {bias_assessment.eval_disaggregation.length > 0 && (
        <section className="security-section">
          <h3>Eval Score Disaggregation by Mode</h3>
          <p className="security-section-desc">
            Average evaluation scores broken down by answer mode. Neuron-assisted modes use the knowledge graph;
            raw modes query the LLM directly. Comparison reveals the value added by neuron context.
          </p>

          <table className="about-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr><th>Mode</th><th>Evals</th><th>Accuracy</th><th>Completeness</th><th>Clarity</th><th>Faithfulness</th><th>Overall</th></tr>
            </thead>
            <tbody>
              {bias_assessment.eval_disaggregation.map(e => (
                <tr key={e.mode}>
                  <td>{e.mode}</td>
                  <td>{e.count}</td>
                  <td>{e.avg_accuracy.toFixed(1)}</td>
                  <td>{e.avg_completeness.toFixed(1)}</td>
                  <td>{e.avg_clarity.toFixed(1)}</td>
                  <td>{e.avg_faithfulness.toFixed(1)}</td>
                  <td style={{ fontWeight: 600 }}>{e.avg_overall.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 95% Confidence Intervals */}
      <section className="security-section">
        <h3>95% Confidence Intervals
          <span style={{
            marginLeft: 8, fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
            background: Object.values(validity_reliability.cross_validation).every(cv => cv.stable) ? '#22c55e22' : '#fb923c22',
            color: Object.values(validity_reliability.cross_validation).every(cv => cv.stable) ? '#22c55e' : '#fb923c',
            border: `1px solid ${Object.values(validity_reliability.cross_validation).every(cv => cv.stable) ? '#22c55e44' : '#fb923c44'}`,
          }}>
            {Object.values(validity_reliability.cross_validation).every(cv => cv.stable) ? 'STABLE' : 'VARIANCE'}
          </span>
        </h3>
        <p className="security-section-desc">
          Per-mode confidence intervals for each evaluation dimension. Narrow intervals indicate
          reliable measurement; wide intervals suggest insufficient sample size or high score variance.
        </p>

        {Object.entries(validity_reliability.confidence_intervals).map(([mode, dims]) => (
          <div key={mode} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#60a5fa', marginBottom: 4 }}>{mode}</div>
            <table className="about-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr><th>Dimension</th><th>Mean</th><th>95% CI Lower</th><th>95% CI Upper</th><th>CI Width</th><th>Std Error</th><th>N</th></tr>
              </thead>
              <tbody>
                {Object.entries(dims).map(([dim, ci]) => {
                  const width = ci.ci_upper - ci.ci_lower;
                  return (
                    <tr key={dim}>
                      <td style={{ textTransform: 'capitalize' }}>{dim}</td>
                      <td style={{ fontWeight: 600 }}>{ci.mean.toFixed(2)}</td>
                      <td>{ci.ci_lower.toFixed(2)}</td>
                      <td>{ci.ci_upper.toFixed(2)}</td>
                      <td style={{ color: width > 1.0 ? '#fb923c' : '#8892a8' }}>{width.toFixed(2)}</td>
                      <td style={{ color: '#8892a8' }}>{ci.stderr.toFixed(4)}</td>
                      <td style={{ color: '#8892a8' }}>{ci.n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {/* Cross-Validation Stability */}
      <section className="security-section">
        <h3>Cross-Validation Stability</h3>
        <p className="security-section-desc">
          {Object.values(validity_reliability.cross_validation)[0]?.folds ?? 5}-fold cross-validation
          of overall eval scores per mode. Low fold CV ({'<'} 0.10) indicates results are robust and
          not driven by a lucky subset of evaluations.
        </p>

        <table className="about-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr><th>Mode</th><th>N</th><th>Folds</th><th>Fold Means</th><th>Fold CV</th><th>Status</th></tr>
          </thead>
          <tbody>
            {Object.entries(validity_reliability.cross_validation).map(([mode, cv]) => (
              <tr key={mode}>
                <td>{mode}</td>
                <td>{cv.n}</td>
                <td>{cv.folds}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {cv.fold_means.length > 0 ? cv.fold_means.map(m => m.toFixed(2)).join(', ') : '\u2014'}
                </td>
                <td style={{ fontWeight: 600, color: cv.stable ? '#22c55e' : '#fb923c' }}>
                  {cv.fold_cv.toFixed(3)}
                </td>
                <td>
                  <span style={{
                    fontSize: '0.7rem', padding: '1px 6px', borderRadius: 3,
                    background: cv.stable ? '#22c55e22' : '#fb923c22',
                    color: cv.stable ? '#22c55e' : '#fb923c',
                  }}>
                    {cv.message}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Scoring Signal Robustness */}
      <section className="security-section">
        <h3>Scoring Signal Robustness</h3>
        <p className="security-section-desc">
          Coefficient of variation (CV) per scoring signal. CV {'<'} 1.5 indicates the signal produces
          consistent distributions across queries. High CV may indicate a noisy or unreliable signal
          that contributes unpredictable variance to neuron ranking.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(validity_reliability.signal_robustness).map(([sig, r]) => (
            <div key={sig} style={{
              background: 'var(--bg-input)', borderRadius: 6, padding: '10px 16px',
              fontSize: '0.8rem', textAlign: 'center', minWidth: 100,
              border: `1px solid ${r.robust ? '#22c55e33' : '#fb923c33'}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: r.robust ? '#22c55e' : '#fb923c' }}>
                {r.cv.toFixed(2)}
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'capitalize', marginTop: 2 }}>{sig}</div>
              <div style={{ color: '#64748b', fontSize: '0.65rem' }}>n={r.n.toLocaleString()}</div>
              <div style={{
                marginTop: 4, fontSize: '0.6rem', padding: '1px 4px', borderRadius: 2,
                background: r.robust ? '#22c55e11' : '#fb923c11',
                color: r.robust ? '#22c55e' : '#fb923c',
              }}>
                {r.robust ? 'Robust' : 'High Variance'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
