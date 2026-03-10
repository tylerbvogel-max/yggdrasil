import { useComplianceAudit } from '../hooks/useComplianceAudit';

export default function FairnessPage() {
  const { data, error, loading } = useComplianceAudit();

  if (error) return <div className="error-msg">{error}</div>;
  if (loading || !data) return <div className="loading">Analyzing fairness metrics...</div>;

  const { bias_assessment, fairness_analysis } = data;

  return (
    <div className="security-page">
      <h2>Fairness Analysis</h2>
      <p className="security-intro">
        Cross-department balance analysis: coverage distribution, eval quality parity,
        invocation disparity, and automated remediation recommendations.
      </p>

      {/* Summary cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="card-value" style={{ color: bias_assessment.coverage_imbalanced ? '#fb923c' : '#22c55e' }}>
            {bias_assessment.coverage_cv.toFixed(2)}
          </div>
          <div className="card-label">Coverage CV{bias_assessment.coverage_imbalanced ? ' (imbalanced)' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{fairness_analysis.invocation_disparity_ratio ?? 'N/A'}</div>
          <div className="card-label">Invocation Disparity</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{fairness_analysis.utility_range.toFixed(3)}</div>
          <div className="card-label">Utility Range</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: fairness_analysis.fairness_pass ? '#22c55e' : '#fb923c' }}>
            {fairness_analysis.remediation_count}
          </div>
          <div className="card-label">Remediation Items</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: fairness_analysis.fairness_pass ? '#22c55e' : '#fb923c' }}>
            {fairness_analysis.fairness_pass ? 'Pass' : 'Fail'}
          </div>
          <div className="card-label">Fairness Status</div>
        </div>
      </div>

      {/* Department Coverage */}
      <section className="security-section">
        <h3>Department Coverage
          <span style={{
            marginLeft: 8, fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
            background: bias_assessment.coverage_imbalanced ? '#fb923c22' : '#22c55e22',
            color: bias_assessment.coverage_imbalanced ? '#fb923c' : '#22c55e',
            border: `1px solid ${bias_assessment.coverage_imbalanced ? '#fb923c44' : '#22c55e44'}`,
          }}>
            {bias_assessment.coverage_imbalanced ? 'IMBALANCED' : 'BALANCED'}
          </span>
        </h3>
        <p className="security-section-desc">
          Distribution of neurons across {bias_assessment.department_count} departments.
          Coefficient of Variation (CV) &gt; 0.5 indicates significant imbalance that may bias
          query responses toward over-represented departments.
        </p>

        <table className="about-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr><th>Department</th><th>Neurons</th><th>% of Total</th><th>Invocations</th><th>Avg Utility</th></tr>
          </thead>
          <tbody>
            {bias_assessment.department_coverage.map(d => {
              const isOutlier = d.pct_of_total > (100 / bias_assessment.department_count) * 2;
              return (
                <tr key={d.department}>
                  <td>{d.department}</td>
                  <td style={{ color: isOutlier ? '#fb923c' : undefined, fontWeight: isOutlier ? 600 : undefined }}>
                    {d.neuron_count}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 8, background: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, d.pct_of_total)}%`, height: '100%',
                          background: isOutlier ? '#fb923c' : '#60a5fa', borderRadius: 4,
                        }} />
                      </div>
                      <span>{d.pct_of_total}%</span>
                    </div>
                  </td>
                  <td>{d.total_invocations.toLocaleString()}</td>
                  <td>{d.avg_utility.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Per-Department Eval Quality */}
      {fairness_analysis.department_eval_quality.length > 0 && (
        <section className="security-section">
          <h3>Per-Department Eval Quality</h3>
          <p className="security-section-desc">
            Do some departments consistently receive lower-quality answers?
            Rows highlighted amber score &gt; 0.5 below the mode average.
          </p>

          <table className="about-table" style={{ fontSize: '0.78rem' }}>
            <thead>
              <tr><th>Department</th><th>Mode</th><th>Evals</th><th>Avg Overall</th><th>Avg Faithfulness</th></tr>
            </thead>
            <tbody>
              {fairness_analysis.department_eval_quality.map((d, i) => {
                const modeRows = fairness_analysis.department_eval_quality.filter(r => r.answer_mode === d.answer_mode);
                const modeAvg = modeRows.reduce((s, r) => s + r.avg_overall, 0) / modeRows.length;
                const isLow = d.avg_overall < modeAvg - 0.5;
                return (
                  <tr key={i} style={{ background: isLow ? '#fb923c11' : undefined }}>
                    <td>{d.department}</td>
                    <td style={{ color: '#c8d0dc' }}>{d.answer_mode}</td>
                    <td>{d.eval_count}</td>
                    <td style={{ fontWeight: 600, color: isLow ? '#fb923c' : undefined }}>{d.avg_overall.toFixed(1)}</td>
                    <td>{d.avg_faithfulness.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Remediation Plan */}
      <section className="security-section">
        <h3>Remediation Plan
          <span style={{
            marginLeft: 8, fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
            background: fairness_analysis.remediation_count === 0 ? '#22c55e22' : '#fb923c22',
            color: fairness_analysis.remediation_count === 0 ? '#22c55e' : '#fb923c',
            border: `1px solid ${fairness_analysis.remediation_count === 0 ? '#22c55e44' : '#fb923c44'}`,
          }}>
            {fairness_analysis.remediation_count === 0 ? 'NO ACTIONS' : `${fairness_analysis.remediation_count} ACTIONS`}
          </span>
        </h3>
        <p className="security-section-desc">
          Automated recommendations based on coverage gaps, quality disparities, and utilization imbalances.
          Each item includes a severity level and specific corrective action.
        </p>

        {fairness_analysis.remediation_plan.length > 0 ? (
          <div className="security-items">
            {fairness_analysis.remediation_plan.map((item, i) => (
              <div key={i} className="security-item" style={{ padding: '8px 12px', marginBottom: 6 }}>
                <div className="security-item-header">
                  <span style={{
                    fontSize: '0.68rem', padding: '1px 6px', borderRadius: 3, marginRight: 8,
                    background: item.severity === 'high' ? '#ef444422' : item.severity === 'medium' ? '#fb923c22' : '#64748b22',
                    color: item.severity === 'high' ? '#ef4444' : item.severity === 'medium' ? '#fb923c' : '#64748b',
                  }}>
                    {item.severity}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', padding: '1px 6px', borderRadius: 3,
                    background: '#3b82f622', color: '#3b82f6',
                  }}>
                    {item.type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#c8d0dc', marginLeft: 8 }}>{item.department}</span>
                </div>
                <p className="security-item-detail" style={{ marginTop: 4 }}>{item.message}</p>
                <p style={{ fontSize: '0.78rem', color: '#60a5fa', marginTop: 4 }}>
                  <strong>Action:</strong> {item.action}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#22c55e', fontSize: '0.85rem' }}>
            No fairness remediation items identified. All departments within acceptable bounds.
          </div>
        )}
      </section>
    </div>
  );
}
