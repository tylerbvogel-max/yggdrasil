import { useState, useEffect, useCallback, useRef } from 'react';

const CORVUS_API = '/corvus';

interface Interpretation {
  id: number;
  timestamp: string;
  summary: string;
}

interface CorvusStatus {
  status: string;
  captures_stored: number;
  interpretations: number;
  total_tokens: number;
  current_tokens: number;
  interpretation_mode: string;
  active_session_id: number | null;
  interrupt_status: string;
}

interface YggSettings {
  enabled: boolean;
  url: string;
  project_path: string;
  enrich_mode: string;
}

interface Entity {
  value: string;
  entity_type: string;
  app_id: string;
  timestamp: string;
}

interface Session {
  id: number;
  started_at: string;
  ended_at: string | null;
  label: string | null;
  brief_length: number;
  active: boolean;
}

export default function CorvusPage() {
  const [status, setStatus] = useState<CorvusStatus | null>(null);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [brief, setBrief] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [yggSettings, setYggSettings] = useState<YggSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'entities' | 'sessions' | 'yggdrasil'>('feed');
  const [error, setError] = useState('');
  const [effort, setEffort] = useState('normal');
  const [userContext, setUserContext] = useState('');
  const [contextDraft, setContextDraft] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${CORVUS_API}/status`);
      if (!r.ok) throw new Error('Corvus offline');
      setStatus(await r.json());
      setError('');
    } catch {
      setError('Corvus backend not reachable');
      setStatus(null);
    }
  }, []);

  const fetchInterpretations = useCallback(async () => {
    try {
      const r = await fetch(`${CORVUS_API}/interpretations`);
      if (r.ok) setInterpretations(await r.json());
    } catch {}
  }, []);

  const fetchBrief = useCallback(async () => {
    try {
      const r = await fetch(`${CORVUS_API}/session-brief`);
      if (r.ok) {
        const d = await r.json();
        setBrief(d.brief || '');
      }
    } catch {}
  }, []);

  const fetchEntities = useCallback(async () => {
    try {
      const r = await fetch(`${CORVUS_API}/entities?minutes=60`);
      if (r.ok) setEntities(await r.json());
    } catch {}
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const r = await fetch(`${CORVUS_API}/sessions`);
      if (r.ok) setSessions(await r.json());
    } catch {}
  }, []);

  const fetchYggSettings = useCallback(async () => {
    try {
      const r = await fetch(`${CORVUS_API}/settings/yggdrasil`);
      if (r.ok) setYggSettings(await r.json());
    } catch {}
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const [effortR, ctxR] = await Promise.all([
        fetch(`${CORVUS_API}/settings/effort`),
        fetch(`${CORVUS_API}/settings/context`),
      ]);
      if (effortR.ok) {
        const d = await effortR.json();
        setEffort(d.effort_level);
      }
      if (ctxR.ok) {
        const d = await ctxR.json();
        setUserContext(d.context || '');
        setContextDraft(d.context || '');
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchInterpretations();
    fetchBrief();
    fetchSettings();
    fetchYggSettings();
    pollRef.current = setInterval(() => {
      fetchStatus();
      fetchInterpretations();
      fetchBrief();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (activeTab === 'entities') fetchEntities();
    if (activeTab === 'sessions') fetchSessions();
    if (activeTab === 'yggdrasil') fetchYggSettings();
  }, [activeTab]);

  async function triggerInterpretation() {
    await fetch(`${CORVUS_API}/interpret-now`, { method: 'POST' });
    setTimeout(fetchInterpretations, 1500);
  }

  async function generateDigest() {
    const fd = new FormData();
    fd.append('hours', '8');
    const r = await fetch(`${CORVUS_API}/digest`, { method: 'POST', body: fd });
    if (r.ok) {
      const d = await r.json();
      if (d.digest) alert(d.digest);
    }
  }

  async function setEffortLevel(level: string) {
    const fd = new FormData();
    fd.append('level', level);
    await fetch(`${CORVUS_API}/settings/effort`, { method: 'POST', body: fd });
    setEffort(level);
  }

  async function saveContext() {
    const fd = new FormData();
    fd.append('context', contextDraft);
    await fetch(`${CORVUS_API}/settings/context`, { method: 'POST', body: fd });
    setUserContext(contextDraft);
  }

  async function updateYggSetting(key: string, value: string | boolean) {
    const fd = new FormData();
    fd.append(key, String(value));
    await fetch(`${CORVUS_API}/settings/yggdrasil`, { method: 'POST', body: fd });
    fetchYggSettings();
  }

  async function newSession() {
    const label = prompt('Session label (optional):');
    const fd = new FormData();
    fd.append('label', label || '');
    await fetch(`${CORVUS_API}/sessions/new`, { method: 'POST', body: fd });
    fetchSessions();
    fetchBrief();
    fetchStatus();
  }

  async function resumeSession(id: number) {
    await fetch(`${CORVUS_API}/sessions/${id}/resume`, { method: 'POST' });
    fetchSessions();
    fetchBrief();
    fetchStatus();
  }

  const statusDot = status ? 'var(--precision)' : 'var(--impact)';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: statusDot,
            boxShadow: status ? `0 0 8px ${statusDot}` : 'none',
          }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)' }}>
            Corvus — Screen Watcher
          </h2>
          {status && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {status.captures_stored} captures · {status.interpretations} interpretations · {status.interpretation_mode} mode
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={triggerInterpretation} style={{ fontSize: '0.75rem' }}>
            Interpret Now
          </button>
          <button className="btn" onClick={generateDigest} style={{ fontSize: '0.75rem', background: 'var(--bg-input)' }}>
            Generate Digest
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 24px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {(['feed', 'entities', 'sessions', 'yggdrasil'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 20px',
              background: activeTab === t ? 'var(--bg-card)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === t ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {t === 'yggdrasil' ? 'Yggdrasil Link' : t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>

        {activeTab === 'feed' && (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Left: interpretations */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Interpretation Feed
                </h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Effort:</span>
                  {['low', 'normal', 'high'].map(l => (
                    <button
                      key={l}
                      onClick={() => setEffortLevel(l)}
                      style={{
                        padding: '2px 8px', fontSize: '0.7rem', borderRadius: 4,
                        background: effort === l ? 'var(--accent)' : 'var(--bg-input)',
                        color: effort === l ? '#000' : 'var(--text-dim)',
                        border: 'none', cursor: 'pointer',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {interpretations.length === 0 && (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: 20, textAlign: 'center' }}>
                  No interpretations yet. Corvus will generate them as it watches your screen.
                </div>
              )}
              {interpretations.map(i => (
                <div key={i.id} className="result-card" style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: 4 }}>
                    {new Date(i.timestamp).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {i.summary}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: brief + context */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="chart-card" style={{ padding: 14 }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Session Brief
                </h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                  {brief || 'No brief yet.'}
                </div>
              </div>
              <div className="chart-card" style={{ padding: 14 }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Working Context
                </h4>
                <textarea
                  value={contextDraft}
                  onChange={e => setContextDraft(e.target.value)}
                  placeholder="What are you working on? Corvus will tailor its observations..."
                  rows={3}
                  style={{
                    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                    color: 'var(--text)', borderRadius: 6, padding: 8, fontSize: '0.8rem', resize: 'vertical',
                  }}
                />
                {contextDraft !== userContext && (
                  <button className="btn" onClick={saveContext} style={{ marginTop: 6, fontSize: '0.7rem' }}>
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'entities' && (
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 12 }}>
              Recent Entities (last hour)
            </h3>
            {entities.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No entities detected yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-dim)' }}>Value</th>
                    <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-dim)' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-dim)' }}>App</th>
                    <th style={{ textAlign: 'left', padding: 6, color: 'var(--text-dim)' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 6, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>{e.value}</td>
                      <td style={{ padding: 6, color: 'var(--text-dim)' }}>{e.entity_type}</td>
                      <td style={{ padding: 6, color: 'var(--text-dim)' }}>{e.app_id}</td>
                      <td style={{ padding: 6, color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'sessions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Sessions
              </h3>
              <button className="btn" onClick={newSession} style={{ fontSize: '0.75rem' }}>New Session</button>
            </div>
            {sessions.map(s => (
              <div key={s.id} className="result-card" style={{
                padding: '10px 14px', marginBottom: 6,
                borderLeft: s.active ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.85rem' }}>
                      #{s.id} {s.label || ''}
                    </span>
                    {s.active && <span style={{ marginLeft: 8, color: 'var(--accent)', fontSize: '0.7rem' }}>ACTIVE</span>}
                  </div>
                  {!s.active && (
                    <button className="btn" onClick={() => resumeSession(s.id)} style={{ fontSize: '0.7rem', padding: '2px 10px' }}>
                      Resume
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  Started: {s.started_at ? new Date(s.started_at).toLocaleString() : '?'}
                  {s.ended_at && ` · Ended: ${new Date(s.ended_at).toLocaleString()}`}
                  · Brief: {s.brief_length} chars
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'yggdrasil' && (
          <div style={{ maxWidth: 600 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 16 }}>
              Yggdrasil Integration
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.5 }}>
              Connect Corvus to Yggdrasil's neuron graph for domain-enriched interpretations.
              When enabled, Corvus queries Yggdrasil for relevant domain context before each interpretation.
            </p>

            {yggSettings ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="chart-card" style={{ padding: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={yggSettings.enabled}
                      onChange={e => updateYggSetting('enabled', e.target.checked)}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                      Enable Yggdrasil Context Enrichment
                    </span>
                  </label>
                </div>

                <div className="chart-card" style={{ padding: 14 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                    Yggdrasil URL
                  </label>
                  <input
                    value={yggSettings.url}
                    onChange={e => updateYggSetting('url', e.target.value)}
                    style={{
                      width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                      color: 'var(--text)', borderRadius: 6, padding: 8, fontSize: '0.8rem',
                    }}
                  />
                </div>

                <div className="chart-card" style={{ padding: 14 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                    Enrichment Mode
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['entities', 'always', 'never'].map(m => (
                      <button
                        key={m}
                        onClick={() => updateYggSetting('enrich_mode', m)}
                        style={{
                          padding: '4px 12px', fontSize: '0.8rem', borderRadius: 4,
                          background: yggSettings.enrich_mode === m ? 'var(--accent)' : 'var(--bg-input)',
                          color: yggSettings.enrich_mode === m ? '#000' : 'var(--text-dim)',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 6 }}>
                    <strong>entities:</strong> Only query when domain terms detected (FAR, MIL-STD, tickets) ·{' '}
                    <strong>always:</strong> Every interpretation ·{' '}
                    <strong>never:</strong> Disabled
                  </div>
                </div>

                <div className="chart-card" style={{ padding: 14 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                    Project Path (for neuron relevance learning)
                  </label>
                  <input
                    value={yggSettings.project_path}
                    onChange={e => updateYggSetting('project_path', e.target.value)}
                    placeholder="/home/user/Projects/my-project"
                    style={{
                      width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                      color: 'var(--text)', borderRadius: 6, padding: 8, fontSize: '0.8rem',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Unable to load Yggdrasil settings. Make sure Corvus backend is running.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
