import { useEffect, useState } from 'react';
import { fetchComplianceAudit } from '../api';
import type { ComplianceAuditResponse } from '../api';

export default function ComplianceAuditPage() {
  const [data, setData] = useState<ComplianceAuditResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceAudit()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="error-msg">{error}</div>;
  if (loading || !data) return <div className="loading">Running compliance audit...</div>;

  const { pii_scan, bias_assessment, scoring_baselines, provenance_audit } = data;

  return (
    <div className="security-page">
      <h2>Compliance Audit</h2>
      <p className="security-intro">
        Automated compliance checks covering PII scanning (MET-3), bias assessment (MET-4),
        scoring baselines (MET-1), and provenance audit (A007). Run on-demand against live neuron data.
      </p>

      {/* Summary cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="card-value" style={{ color: pii_scan.clean ? '#22c55e' : '#ef4444' }}>
            {pii_scan.clean ? 'Clean' : pii_scan.total_findings}
          </div>
          <div className="card-label">PII Findings</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: bias_assessment.coverage_imbalanced ? '#fb923c' : '#22c55e' }}>
            {bias_assessment.coverage_cv.toFixed(2)}
          </div>
          <div className="card-label">Coverage CV{bias_assessment.coverage_imbalanced ? ' (imbalanced)' : ''}</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{scoring_baselines.queries_analyzed}</div>
          <div className="card-label">Queries Baselined</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: provenance_audit.missing_citations_count > 0 ? '#fb923c' : '#22c55e' }}>
            {provenance_audit.missing_citations_count}
          </div>
          <div className="card-label">Missing Citations</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{data.total_neurons}</div>
          <div className="card-label">Neurons Scanned</div>
        </div>
      </div>

      {/* PII Scan */}
      <section className="security-section">
        <h3>PII Scan
          <span style={{
            marginLeft: 8, fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
            background: pii_scan.clean ? '#22c55e22' : '#ef444422',
            color: pii_scan.clean ? '#22c55e' : '#ef4444',
            border: `1px solid ${pii_scan.clean ? '#22c55e44' : '#ef444444'}`,
          }}>
            {pii_scan.clean ? 'PASS' : `${pii_scan.total_findings} FINDINGS`}
          </span>
        </h3>
        <p className="security-section-desc">
          Scans all active neuron content, summary, and label fields for PII patterns
          (SSN, email, credit card, phone number).
        </p>
        {pii_scan.clean ? (
          <div style={{ color: '#22c55e', fontSize: '0.85rem' }}>
            No PII detected in any neuron fields.
          </div>
        ) : (
          <table className="about-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr><th>Neuron</th><th>Department</th><th>Field</th><th>Type</th><th>Count</th></tr>
            </thead>
            <tbody>
              {pii_scan.findings.map((f, i) => (
                <tr key={i}>
                  <td title={`ID: ${f.neuron_id}`}>{f.neuron_label}</td>
                  <td style={{ color: '#8892a8' }}>{f.department || '(none)'}</td>
                  <td><code>{f.field}</code></td>
                  <td style={{ color: '#ef4444' }}>{f.pii_type}</td>
                  <td>{f.match_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Bias Assessment */}
      <section className="security-section">
        <h3>Bias & Coverage Assessment
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
          Department neuron distribution analysis. Coefficient of Variation (CV) &gt; 0.5 indicates
          significant imbalance that may bias query responses toward over-represented departments.
        </p>

        <h4 style={{ margin: '12px 0 6px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Department Coverage</h4>
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

        <h4 style={{ margin: '16px 0 6px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Layer Distribution</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(bias_assessment.layer_distribution).map(([layer, count]) => (
            <div key={layer} style={{
              background: 'var(--bg-input)', borderRadius: 6, padding: '6px 12px',
              fontSize: '0.8rem', textAlign: 'center',
            }}>
              <div style={{ fontWeight: 600, color: '#60a5fa' }}>{count}</div>
              <div style={{ color: '#8892a8', fontSize: '0.7rem' }}>{layer}</div>
            </div>
          ))}
        </div>

        {bias_assessment.eval_disaggregation.length > 0 && (
          <>
            <h4 style={{ margin: '16px 0 6px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Eval Score Disaggregation by Mode</h4>
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
          </>
        )}
      </section>

      {/* Scoring Baselines */}
      <section className="security-section">
        <h3>Scoring Signal Baselines</h3>
        <p className="security-section-desc">
          Per-signal distribution statistics computed across {scoring_baselines.queries_analyzed} queries.
          These baselines document the expected scoring behavior and serve as reference for drift detection.
        </p>

        <table className="about-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr><th>Signal</th><th>Count</th><th>Mean</th><th>StdDev</th><th>P25</th><th>Median</th><th>P75</th><th>P95</th><th>Min</th><th>Max</th></tr>
          </thead>
          <tbody>
            {Object.entries(scoring_baselines.signals).map(([sig, s]) => (
              <tr key={sig}>
                <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{sig}</td>
                <td>{s.count.toLocaleString()}</td>
                <td>{s.mean.toFixed(4)}</td>
                <td>{s.stddev.toFixed(4)}</td>
                <td>{s.p25.toFixed(4)}</td>
                <td style={{ fontWeight: 600 }}>{s.p50.toFixed(4)}</td>
                <td>{s.p75.toFixed(4)}</td>
                <td>{s.p95.toFixed(4)}</td>
                <td style={{ color: '#8892a8' }}>{s.min.toFixed(4)}</td>
                <td style={{ color: '#8892a8' }}>{s.max.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 style={{ margin: '16px 0 6px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Metric Selection Rationale</h4>
        <div className="security-items">
          {Object.entries(scoring_baselines.metric_rationale).map(([sig, rationale]) => (
            <div key={sig} className="security-item" style={{ padding: '8px 12px' }}>
              <div className="security-item-header">
                <strong style={{ textTransform: 'capitalize' }}>{sig}</strong>
              </div>
              <p className="security-item-detail" style={{ marginTop: 4 }}>{rationale}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Provenance Audit */}
      <section className="security-section">
        <h3>Provenance Audit</h3>
        <p className="security-section-desc">
          Verifies source tracking completeness for regulatory and technical primary neurons.
          Checks for missing citations, missing source URLs, and stale verification dates.
        </p>

        <h4 style={{ margin: '12px 0 6px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>Source Type Distribution</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(provenance_audit.source_type_distribution).map(([type, count]) => (
            <div key={type} style={{
              background: 'var(--bg-input)', borderRadius: 6, padding: '6px 12px',
              fontSize: '0.8rem', textAlign: 'center',
            }}>
              <div style={{ fontWeight: 600, color: '#a78bfa' }}>{count}</div>
              <div style={{ color: '#8892a8', fontSize: '0.7rem' }}>{type}</div>
            </div>
          ))}
        </div>

        {provenance_audit.missing_citations_count > 0 && (
          <>
            <h4 style={{ margin: '12px 0 6px', fontSize: '0.85rem', color: '#fb923c' }}>
              Missing Citations ({provenance_audit.missing_citations_count})
            </h4>
            <table className="about-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr><th>ID</th><th>Neuron</th><th>Department</th><th>Source Type</th></tr>
              </thead>
              <tbody>
                {provenance_audit.missing_citations.slice(0, 20).map(n => (
                  <tr key={n.neuron_id}>
                    <td>{n.neuron_id}</td>
                    <td>{n.label}</td>
                    <td style={{ color: '#8892a8' }}>{n.department || '(none)'}</td>
                    <td>{n.source_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {provenance_audit.missing_citations_count > 20 && (
              <div style={{ fontSize: '0.75rem', color: '#8892a8', marginTop: 4 }}>
                ...and {provenance_audit.missing_citations_count - 20} more
              </div>
            )}
          </>
        )}

        {provenance_audit.missing_citations_count === 0 && (
          <div style={{ color: '#22c55e', fontSize: '0.85rem', marginBottom: 8 }}>
            All primary neurons have citations.
          </div>
        )}

        {provenance_audit.stale_neurons_count > 0 && (
          <>
            <h4 style={{ margin: '12px 0 6px', fontSize: '0.85rem', color: '#fb923c' }}>
              Stale Neurons ({provenance_audit.stale_neurons_count}) &mdash; not verified in 365+ days
            </h4>
            <table className="about-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr><th>ID</th><th>Neuron</th><th>Department</th><th>Last Verified</th><th>Days</th></tr>
              </thead>
              <tbody>
                {provenance_audit.stale_neurons.map(n => (
                  <tr key={n.neuron_id}>
                    <td>{n.neuron_id}</td>
                    <td>{n.label}</td>
                    <td style={{ color: '#8892a8' }}>{n.department || '(none)'}</td>
                    <td>{n.last_verified.split('T')[0]}</td>
                    <td style={{ color: '#ef4444' }}>{n.days_since_verified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {provenance_audit.stale_neurons_count === 0 && provenance_audit.missing_citations_count === 0 && (
          <div style={{ color: '#22c55e', fontSize: '0.85rem' }}>
            All primary neurons have citations and are within verification window.
          </div>
        )}
      </section>
    </div>
  );
}
