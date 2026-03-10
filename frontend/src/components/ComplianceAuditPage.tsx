import { useComplianceAudit } from '../hooks/useComplianceAudit';

export default function ComplianceAuditPage() {
  const { data, error, loading } = useComplianceAudit();

  if (error) return <div className="error-msg">{error}</div>;
  if (loading || !data) return <div className="loading">Running compliance scan...</div>;

  const { pii_scan, scoring_baselines, provenance_audit, bias_assessment } = data;

  return (
    <div className="security-page">
      <h2>Compliance Scan</h2>
      <p className="security-intro">
        Automated compliance checks: PII scanning (MET-3), scoring signal baselines (MET-1),
        provenance audit (A007), and structural distribution analysis. Run on-demand against live neuron data.
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
          (SSN, email, credit card, phone number). Includes false positive filtering for
          DFARS clause numbers and example/placeholder email domains.
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
                  <td style={{ color: '#c8d0dc' }}>{f.department || '(none)'}</td>
                  <td><code>{f.field}</code></td>
                  <td style={{ color: '#ef4444' }}>{f.pii_type}</td>
                  <td>{f.match_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <td style={{ color: '#c8d0dc' }}>{s.min.toFixed(4)}</td>
                <td style={{ color: '#c8d0dc' }}>{s.max.toFixed(4)}</td>
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

      {/* Layer Distribution */}
      <section className="security-section">
        <h3>Structural Distribution</h3>
        <p className="security-section-desc">
          Neuron distribution across the 6-layer hierarchy (L0=Department through L5=Output).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(bias_assessment.layer_distribution).map(([layer, count]) => (
            <div key={layer} style={{
              background: 'var(--bg-input)', borderRadius: 6, padding: '6px 12px',
              fontSize: '0.8rem', textAlign: 'center',
            }}>
              <div style={{ fontWeight: 600, color: '#60a5fa' }}>{count}</div>
              <div style={{ color: '#c8d0dc', fontSize: '0.7rem' }}>{layer}</div>
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
              <div style={{ color: '#c8d0dc', fontSize: '0.7rem' }}>{type}</div>
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
                    <td style={{ color: '#c8d0dc' }}>{n.department || '(none)'}</td>
                    <td>{n.source_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {provenance_audit.missing_citations_count > 20 && (
              <div style={{ fontSize: '0.75rem', color: '#c8d0dc', marginTop: 4 }}>
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
                    <td style={{ color: '#c8d0dc' }}>{n.department || '(none)'}</td>
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
