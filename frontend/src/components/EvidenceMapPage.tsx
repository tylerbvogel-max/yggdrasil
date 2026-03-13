import { useState, useEffect, useCallback } from 'react';
import {
  fetchEvidenceMap, verifyAllEvidence, seedEvidenceMap, fetchEvidenceContent,
  type EvidenceMappingOut, type EvidenceContentResponse,
} from '../api';

const FRAMEWORKS = [
  { value: '', label: 'All Frameworks' },
  { value: 'nist_ai_rmf', label: 'NIST AI RMF' },
  { value: 'aiuc_1', label: 'AIUC-1' },
  { value: 'iso_42001', label: 'ISO 42001' },
];

const frameworkLabel = (f: string) =>
  f === 'nist_ai_rmf' ? 'NIST AI RMF' : f === 'aiuc_1' ? 'AIUC-1' : f === 'iso_42001' ? 'ISO 42001' : f;

const statusColor = (s: string) =>
  s === 'addressed' ? '#22c55e' : s === 'partial' ? '#fb923c' : s === 'gap' ? '#ef4444' : '#64748b';

// Map evidence_location → frontend tab key
function locationToTab(evidenceType: string, location: string): string | null {
  if (evidenceType === 'review_log') return 'mgmt-reviews';
  if (evidenceType === 'table') {
    if (location === 'queries') return 'query';
    if (location === 'neuron_source_links') return 'explorer';
    return null;
  }
  if (evidenceType === 'endpoint') {
    if (location.startsWith('/queries')) return 'query';
    if (location === '/admin/scoring-health') return 'dashboard';
    if (location === '/admin/health-check') return 'dashboard';
    if (location === '/admin/compliance-audit') return 'compliance-audit';
    if (location === '/admin/compliance-snapshots') return 'compliance-audit';
    return null;
  }
  return null;
}

function isViewableFile(evidenceType: string): boolean {
  return evidenceType === 'document' || evidenceType === 'code';
}

interface Props {
  onNavigate?: (tab: string) => void;
}

export default function EvidenceMapPage({ onNavigate }: Props) {
  const [evidence, setEvidence] = useState<EvidenceMappingOut[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ passed: number; failed: number; total: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Content viewer modal state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerContent, setViewerContent] = useState<EvidenceContentResponse | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data = await fetchEvidenceMap(filter || undefined);
      if (data.length === 0 && !filter) {
        await seedEvidenceMap();
        data = await fetchEvidenceMap();
      }
      setEvidence(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verifyAllEvidence();
      setVerifyResult(result);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  };

  const handleViewFile = async (path: string) => {
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError('');
    setViewerContent(null);
    try {
      const result = await fetchEvidenceContent(path);
      setViewerContent(result);
    } catch (e: unknown) {
      setViewerError(e instanceof Error ? e.message : String(e));
    } finally {
      setViewerLoading(false);
    }
  };

  const toggleFramework = (fw: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(fw)) next.delete(fw);
      else next.add(fw);
      return next;
    });
  };

  // Group by framework
  const grouped: Record<string, EvidenceMappingOut[]> = {};
  for (const ev of evidence) {
    if (!grouped[ev.framework]) grouped[ev.framework] = [];
    grouped[ev.framework].push(ev);
  }

  // Stats
  const statusCounts: Record<string, number> = {};
  for (const ev of evidence) {
    statusCounts[ev.status] = (statusCounts[ev.status] || 0) + 1;
  }

  const staleCount = evidence.filter(ev => {
    if (!ev.last_verified) return true;
    const days = (Date.now() - new Date(ev.last_verified).getTime()) / 86400000;
    return days > 30;
  }).length;

  // Render action button for a row
  const renderAction = (ev: EvidenceMappingOut) => {
    if (isViewableFile(ev.evidence_type)) {
      return (
        <button
          onClick={() => handleViewFile(ev.evidence_location)}
          style={{
            background: '#3b82f622', color: '#60a5fa', border: '1px solid #3b82f644',
            borderRadius: 4, padding: '2px 10px', fontSize: '0.7rem', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          View Source
        </button>
      );
    }

    const tab = locationToTab(ev.evidence_type, ev.evidence_location);
    if (tab && onNavigate) {
      const labels: Record<string, string> = {
        'query': 'Query Lab',
        'dashboard': 'Dashboard',
        'compliance-audit': 'Audit Scan',
        'explorer': 'Explorer',
        'mgmt-reviews': 'Reviews',
      };
      return (
        <button
          onClick={() => onNavigate(tab)}
          style={{
            background: '#8b5cf622', color: '#a78bfa', border: '1px solid #8b5cf644',
            borderRadius: 4, padding: '2px 10px', fontSize: '0.7rem', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Go to {labels[tab] || tab}
        </button>
      );
    }

    return <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{ev.evidence_location}</span>;
  };

  if (error) return <div className="error-msg">{error}</div>;
  if (loading) return <div className="loading">Loading evidence map...</div>;

  return (
    <div className="security-page">
      <h2>Evidence Map</h2>
      <p className="security-intro">
        Maps every compliance requirement to verifiable evidence artifacts. Makes third-party
        audits a structured &ldquo;check the box&rdquo; process &mdash; auditors verify evidence
        rather than discovering it.
      </p>

      {/* Summary cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#22c55e' }}>{statusCounts.addressed || 0}</div>
          <div className="card-label">Addressed</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#fb923c' }}>{statusCounts.partial || 0}</div>
          <div className="card-label">Partial</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: '#ef4444' }}>{statusCounts.gap || 0}</div>
          <div className="card-label">Gaps</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: staleCount > 0 ? '#fb923c' : '#22c55e' }}>{staleCount}</div>
          <div className="card-label">Stale (&gt;30d)</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{evidence.length}</div>
          <div className="card-label">Total</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.8rem' }}
        >
          {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <button onClick={handleVerify} disabled={verifying}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer' }}>
          {verifying ? 'Verifying...' : 'Verify All'}
        </button>
        <a
          href="/admin/compliance-report?format=html"
          target="_blank" rel="noopener noreferrer"
          style={{ background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'none' }}>
          Generate Report
        </a>
        {verifyResult && (
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Last verify: {verifyResult.passed} passed, {verifyResult.failed} failed of {verifyResult.total}
          </span>
        )}
      </div>

      {/* Evidence Table grouped by framework */}
      {Object.entries(grouped).map(([fw, items]) => (
        <section key={fw} className="security-section">
          <h3
            onClick={() => toggleFramework(fw)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            {collapsed.has(fw) ? '\u25B8' : '\u25BE'} {frameworkLabel(fw)} ({items.length})
          </h3>
          {!collapsed.has(fw) && (
            <table className="about-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Requirement</th>
                  <th>Status</th>
                  <th>Evidence</th>
                  <th>Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {items.map(ev => {
                  const isStale = !ev.last_verified || (Date.now() - new Date(ev.last_verified).getTime()) / 86400000 > 30;
                  return (
                    <tr key={ev.id}>
                      <td><code>{ev.requirement_id}</code></td>
                      <td>{ev.requirement_name}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', fontSize: '0.7rem', padding: '1px 8px', borderRadius: 4,
                          background: statusColor(ev.status) + '22', color: statusColor(ev.status),
                          border: `1px solid ${statusColor(ev.status)}44`, fontWeight: 600,
                        }}>
                          {ev.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{renderAction(ev)}</td>
                      <td style={{ color: isStale ? '#fb923c' : '#94a3b8', fontSize: '0.75rem' }}>
                        {ev.last_verified
                          ? new Date(ev.last_verified).toLocaleDateString()
                          : <em>never</em>}
                        {isStale && ev.last_verified && <span title="Stale: not verified in 30+ days"> !</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {/* File Content Viewer Modal */}
      {viewerOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setViewerOpen(false)}
        >
          <div
            style={{
              background: '#0f1117', border: '1px solid #334155', borderRadius: 12,
              width: '90vw', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 20px', borderBottom: '1px solid #1e293b',
            }}>
              <div>
                <code style={{ fontSize: '0.85rem', color: '#60a5fa' }}>
                  {viewerContent?.path || 'Loading...'}
                </code>
                {viewerContent && (
                  <span style={{ marginLeft: 12, fontSize: '0.7rem', color: '#64748b' }}>
                    {viewerContent.language} &middot; {(viewerContent.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
              <button
                onClick={() => setViewerOpen(false)}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem',
                  cursor: 'pointer', padding: '4px 8px',
                }}
              >
                &times;
              </button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {viewerLoading && <div className="loading" style={{ padding: 20 }}>Loading file...</div>}
              {viewerError && <div className="error-msg">{viewerError}</div>}
              {viewerContent && (
                <pre style={{
                  margin: 0, fontSize: '0.78rem', lineHeight: 1.5,
                  color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                }}>
                  {viewerContent.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
