import { useState, useEffect } from 'react';
import {
  fetchComplianceSuiteControlDetail,
  submitComplianceAttestation,
  type ControlDetailResponse,
} from '../api';

const TYPE_BADGES: Record<string, { bg: string; color: string }> = {
  automated_test: { bg: '#dbeafe', color: '#1e40af' },
  code_artifact: { bg: '#f3e8ff', color: '#6b21a8' },
  config_check: { bg: '#dcfce7', color: '#166534' },
  doc_artifact: { bg: '#fef9c3', color: '#854d0e' },
  static_analysis: { bg: '#fce7f3', color: '#9d174d' },
  manual_attestation: { bg: '#f1f5f9', color: '#475569' },
};

interface Props {
  framework: string;
  controlId: string;
  onClose: () => void;
}

export default function ControlDetail({ framework, controlId, onClose }: Props) {
  const [data, setData] = useState<ControlDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [attestBy, setAttestBy] = useState('');
  const [attestNotes, setAttestNotes] = useState('');
  const [attesting, setAttesting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchComplianceSuiteControlDetail(framework, controlId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [framework, controlId]);

  const handleAttest = async (providerId: string) => {
    if (!attestBy.trim()) return;
    setAttesting(true);
    try {
      await submitComplianceAttestation(providerId, attestBy, attestNotes);
      // Refresh
      const d = await fetchComplianceSuiteControlDetail(framework, controlId);
      setData(d);
    } finally {
      setAttesting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, maxWidth: 720, width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>Loading...</div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#ef4444' }}>Control not found</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{framework.toUpperCase()}</div>
                <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 18 }}>{data.control.control_id} — {data.control.title}</h3>
                <div style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>{data.control.family}</div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text)', padding: 4 }}>&times;</button>
            </div>

            <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{data.control.description}</p>

            {data.control.external_ref && (
              <a href={data.control.external_ref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3b82f6', display: 'block', marginBottom: 16 }}>
                External Reference ↗
              </a>
            )}

            <h4 style={{ color: 'var(--text)', fontSize: 14, marginBottom: 12 }}>Evidence Providers ({data.providers.length})</h4>
            {data.providers.map(p => {
              const badge = TYPE_BADGES[p.evidence_type] || TYPE_BADGES.manual_attestation;
              const latestResults = data.history.filter(h => h.provider_id === p.id);
              const latest = latestResults[0];
              const isManual = p.evidence_type === 'manual_attestation';

              // Sparkline: last 10 results
              const spark = latestResults.slice(0, 10).reverse();

              return (
                <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>{p.evidence_type}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.id}</span>
                    {latest && (
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: latest.passed ? '#dcfce7' : '#fef2f2', color: latest.passed ? '#166534' : '#991b1b' }}>
                        {latest.passed ? 'PASS' : 'FAIL'}
                      </span>
                    )}
                  </div>

                  {p.code_refs.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 4 }}>
                      {p.code_refs.join(', ')}
                    </div>
                  )}

                  {/* Adaptation rationale */}
                  {p.rationale && (
                    <div style={{
                      margin: '6px 0', padding: '8px 10px', background: '#eef2ff',
                      borderLeft: '3px solid #6366f1', borderRadius: 4, fontSize: 12,
                      color: '#3730a3', lineHeight: 1.5,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                        Adaptation Rationale
                      </div>
                      {p.rationale}
                    </div>
                  )}

                  {/* Sparkline */}
                  {spark.length > 1 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                      {spark.map((s, i) => (
                        <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: s.passed ? '#22c55e' : '#ef4444' }} title={s.collected_at || ''} />
                      ))}
                    </div>
                  )}

                  {/* Manual attestation form */}
                  {isManual && (
                    <div style={{ marginTop: 8, padding: 8, background: 'var(--bg)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Submit Attestation</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <input
                          type="text" placeholder="Attested by" value={attestBy}
                          onChange={e => setAttestBy(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text)', flex: 1, minWidth: 120 }}
                        />
                        <input
                          type="text" placeholder="Notes (optional)" value={attestNotes}
                          onChange={e => setAttestNotes(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text)', flex: 2, minWidth: 120 }}
                        />
                        <button
                          onClick={() => handleAttest(p.id)}
                          disabled={attesting || !attestBy.trim()}
                          style={{ padding: '4px 12px', fontSize: 12, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Attest
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
