import { useState, useEffect, useCallback } from 'react';
import {
  fetchComplianceSuiteDashboard,
  fetchComplianceSuiteControls,
  runComplianceSuite,
  fetchComplianceSuiteRuns,
  type ComplianceSuiteDashboardResponse,
  type ComplianceSuiteControl,
  type ComplianceSuiteRunSummary,
  type SuiteProgressEvent,
} from '../api';
import ControlDetail from './ControlDetail';

const FRAMEWORK_LABELS: Record<string, string> = {
  fedramp: 'FedRAMP Moderate',
  cmmc: 'CMMC Level 2',
  soc2: 'SOC 2 Type II',
  iso42001: 'ISO/IEC 42001:2023',
  eu_ai_act: 'EU AI Act',
  nasa: 'NASA NPR 7150.2D',
  aiuc: 'AIUC-1',
};

const STATUS_COLORS: Record<string, string> = {
  passed: '#22c55e',
  failed: '#ef4444',
  partial: '#eab308',
  attested: '#3b82f6',
  untested: '#94a3b8',
};

const EVIDENCE_TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  automated_test: { bg: '#dbeafe', color: '#1e40af', label: 'Auto' },
  code_artifact: { bg: '#f3e8ff', color: '#6b21a8', label: 'Code' },
  config_check: { bg: '#dcfce7', color: '#166534', label: 'Config' },
  doc_artifact: { bg: '#fef9c3', color: '#854d0e', label: 'Doc' },
  static_analysis: { bg: '#fce7f3', color: '#9d174d', label: 'Static' },
  manual_attestation: { bg: '#f1f5f9', color: '#475569', label: 'Manual' },
};

export default function ComplianceDashboard() {
  const [dashboard, setDashboard] = useState<ComplianceSuiteDashboardResponse | null>(null);
  const [controls, setControls] = useState<ComplianceSuiteControl[]>([]);
  const [runs, setRuns] = useState<ComplianceSuiteRunSummary[]>([]);
  const [selectedFw, setSelectedFw] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'control_id' | 'title' | 'family'>('control_id');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SuiteProgressEvent | null>(null);
  const [selectedControl, setSelectedControl] = useState<{ framework: string; controlId: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [d, c, r] = await Promise.all([
        fetchComplianceSuiteDashboard(),
        fetchComplianceSuiteControls(selectedFw === 'all' ? undefined : selectedFw),
        fetchComplianceSuiteRuns(10),
      ]);
      setDashboard(d);
      setControls(c);
      setRuns(r);
    } catch (e) {
      setError(String(e));
    }
  }, [selectedFw]);

  useEffect(() => { load(); }, [load]);

  const handleRunSuite = useCallback(async () => {
    setRunning(true);
    setProgress(null);
    setError(null);
    try {
      await runComplianceSuite(
        selectedFw === 'all' ? undefined : selectedFw,
        (evt) => setProgress(evt),
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [selectedFw, load]);

  const handleRunSelected = useCallback(async () => {
    if (selected.size === 0) return;
    // Collect all provider IDs for selected controls
    const providerIds = new Set<string>();
    for (const c of controls) {
      const key = `${c.framework}:${c.control_id}`;
      if (selected.has(key)) {
        for (const pid of c.provider_ids) providerIds.add(pid);
      }
    }
    setRunning(true);
    setProgress(null);
    setError(null);
    try {
      await runComplianceSuite(
        undefined,
        (evt) => setProgress(evt),
        Array.from(providerIds),
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [selected, controls, load]);

  const toggleSelect = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const filtered = controls.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      return c.control_id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.family.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => a[sortKey].localeCompare(b[sortKey]));

  const toggleSelectAll = useCallback(() => {
    setSelected(prev => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map(c => `${c.framework}:${c.control_id}`));
    });
  }, [filtered]);

  const fwData = dashboard?.frameworks ?? {};

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ color: 'var(--text)', margin: 0 }}>Compliance Suite Dashboard</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dashboard?.latest_run && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Last run: {new Date(dashboard.latest_run.started_at).toLocaleString()} — {dashboard.latest_run.passed}P / {dashboard.latest_run.failed}F
            </span>
          )}
          <a
            href={dashboard?.latest_run ? `/admin/compliance/runs/${dashboard.latest_run.id}/report${selectedFw !== 'all' ? `?framework=${selectedFw}` : ''}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 12px', fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text)', textDecoration: 'none', cursor: dashboard?.latest_run ? 'pointer' : 'default',
              opacity: dashboard?.latest_run ? 1 : 0.5,
            }}
          >
            Download Report
          </a>
          {selected.size > 0 && (
            <button
              onClick={handleRunSelected}
              disabled={running}
              style={{
                padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: running ? 'wait' : 'pointer',
                background: running ? 'var(--bg-card)' : '#8b5cf6', color: running ? 'var(--text)' : 'white',
                border: 'none', borderRadius: 6,
              }}
            >
              {running ? 'Running...' : `Run Selected (${selected.size})`}
            </button>
          )}
          <button
            onClick={handleRunSuite}
            disabled={running}
            style={{
              padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: running ? 'wait' : 'pointer',
              background: running ? 'var(--bg-card)' : '#3b82f6', color: running ? 'var(--text)' : 'white',
              border: 'none', borderRadius: 6,
            }}
          >
            {running ? 'Running...' : 'Run Suite'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {running && progress && (
        <div style={{ marginBottom: 16, background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>
            <span>Stage: {progress.stage}</span>
            <span>{progress.completed}/{progress.total}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`, background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {error && <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Attestation expiry alerts */}
      {dashboard?.expiring_attestations && dashboard.expiring_attestations.length > 0 && (
        <div style={{ padding: 12, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#854d0e' }}>
          <strong>Attestation Alerts:</strong> {dashboard.expiring_attestations.length} attestation(s) expired and need re-attestation.
        </div>
      )}

      {/* Framework tiles — click to filter, click again or click "All" to reset */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(fwData).map(([fw, data]) => {
          if (!data) return null;
          const fwKey = String(fw);
          const d = data as { total: number; passed: number; failed: number; partial: number; attested: number; untested: number; compliance_pct: number };
          const color = d.compliance_pct >= 80 ? '#22c55e' : d.compliance_pct >= 50 ? '#eab308' : '#ef4444';
          const isActive = selectedFw === fwKey;
          const isDimmed = selectedFw !== 'all' && !isActive;
          return (
            <div
              key={fwKey}
              onClick={() => setSelectedFw(isActive ? 'all' : fwKey)}
              style={{
                background: 'var(--bg-card)',
                border: isActive ? '2px solid #3b82f6' : '1px solid var(--border)',
                borderRadius: 8, padding: 16, cursor: 'pointer',
                opacity: isDimmed ? 0.45 : 1,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.5 }}>{FRAMEWORK_LABELS[fwKey] || fwKey}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color, margin: '4px 0' }}>{d.compliance_pct}%</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 11 }}>
                {(['passed', 'failed', 'partial', 'attested', 'untested'] as const).map(s => (
                  <span key={s} style={{ padding: '1px 6px', borderRadius: 4, background: STATUS_COLORS[s] + '22', color: STATUS_COLORS[s] }}>
                    {(d as Record<string, number>)[s]} {s}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{d.total} controls</div>
            </div>
          );
        })}
      </div>
      {selectedFw !== 'all' && (
        <button
          onClick={() => setSelectedFw('all')}
          style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12 }}
        >
          Show all frameworks
        </button>
      )}

      {/* Control table */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search controls..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text)', flex: 1, maxWidth: 300 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{filtered.length} controls</span>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Clear selection ({selected.size})
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 6px', width: 32 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {selectedFw === 'all' && <th style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}>Framework</th>}
              <th style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }} onClick={() => setSortKey('control_id')}>ID {sortKey === 'control_id' ? '▾' : ''}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }} onClick={() => setSortKey('title')}>Title {sortKey === 'title' ? '▾' : ''}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }} onClick={() => setSortKey('family')}>Family {sortKey === 'family' ? '▾' : ''}</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text)' }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text)' }}>Providers</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(c => {
              const rowKey = `${c.framework}:${c.control_id}`;
              return (
                <tr
                  key={`${c.framework}-${c.control_id}`}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected.has(rowKey) ? 'var(--bg-card)' : 'transparent' }}
                  onMouseEnter={e => { if (!selected.has(rowKey)) e.currentTarget.style.background = 'var(--bg-card)'; }}
                  onMouseLeave={e => { if (!selected.has(rowKey)) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '6px 6px', width: 32 }}>
                    <input
                      type="checkbox"
                      checked={selected.has(rowKey)}
                      onChange={() => toggleSelect(rowKey)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  {selectedFw === 'all' && <td style={{ padding: '6px 12px', color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }} onClick={() => setSelectedControl({ framework: c.framework, controlId: c.control_id })}>{c.framework}</td>}
                  <td style={{ padding: '6px 12px', color: 'var(--text)', fontFamily: 'monospace' }} onClick={() => setSelectedControl({ framework: c.framework, controlId: c.control_id })}>{c.control_id}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--text)' }} onClick={() => setSelectedControl({ framework: c.framework, controlId: c.control_id })}>{c.title}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-dim)' }} onClick={() => setSelectedControl({ framework: c.framework, controlId: c.control_id })}>{c.family}</td>
                  <td style={{ padding: '6px 12px' }} onClick={() => setSelectedControl({ framework: c.framework, controlId: c.control_id })}>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {c.evidence_types.map(et => {
                        const s = EVIDENCE_TYPE_STYLE[et] || { bg: '#f1f5f9', color: '#475569', label: et };
                        return <span key={et} style={{ padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>;
                      })}
                    </div>
                  </td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-dim)' }} onClick={() => setSelectedControl({ framework: c.framework, controlId: c.control_id })}>{c.provider_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Run history */}
      <div style={{ marginTop: 24 }}>
        <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0 }}>
          {showHistory ? '▾' : '▸'} Run History ({runs.length})
        </button>
        {showHistory && (
          <div style={{ marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text)' }}>Run</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text)' }}>Date</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text)' }}>Passed</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text)' }}>Failed</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text)' }}>Duration</th>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text)' }}>Report</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 12px', color: 'var(--text)' }}>#{r.id}</td>
                    <td style={{ padding: '4px 12px', color: 'var(--text-dim)' }}>{r.started_at ? new Date(r.started_at).toLocaleString() : '—'}</td>
                    <td style={{ padding: '4px 12px', color: '#22c55e' }}>{r.passed}</td>
                    <td style={{ padding: '4px 12px', color: '#ef4444' }}>{r.failed}</td>
                    <td style={{ padding: '4px 12px', color: 'var(--text-dim)' }}>{r.duration_ms}ms</td>
                    <td style={{ padding: '4px 12px' }}>
                      <a href={`/admin/compliance/runs/${r.id}/report`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', fontSize: 12 }}>View</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Control detail modal */}
      {selectedControl && (
        <ControlDetail
          framework={selectedControl.framework}
          controlId={selectedControl.controlId}
          onClose={() => setSelectedControl(null)}
        />
      )}
    </div>
  );
}
