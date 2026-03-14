import { useEffect, useState } from 'react';

interface CheckItem {
  id: string;
  category: string;
  standard: string;
  requirement: string;
  check_items: string[];
}

interface NeuronEntry {
  id: number;
  label: string;
  layer: number;
  invocations: number;
  has_content: boolean;
  has_summary: boolean;
}

interface StandardCoverage {
  role_label: string;
  neurons: NeuronEntry[];
  total_invocations: number;
}

interface Metrics {
  total_nasa_neurons: number;
  l2_with_content: number;
  l2_total: number;
  coverage_pct: number;
  total_invocations: number;
  refinement_count: number;
}

interface CodeReviewData {
  checklist: CheckItem[];
  standards_coverage: Record<string, StandardCoverage>;
  metrics: Metrics;
}

const STATUS_COLORS: Record<string, string> = {
  pass: '#22c55e',
  partial: '#fb923c',
  unchecked: '#64748b',
};

export default function CodeReviewPage() {
  const [data, setData] = useState<CodeReviewData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Record<string, Record<number, boolean>>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetch(`/admin/code-review`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load saved checks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('corvus-code-review-checks');
    if (saved) {
      try { setChecks(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const toggleCheck = (itemId: string, idx: number) => {
    setChecks(prev => {
      const next = { ...prev };
      if (!next[itemId]) next[itemId] = {};
      next[itemId] = { ...next[itemId], [idx]: !next[itemId][idx] };
      localStorage.setItem('corvus-code-review-checks', JSON.stringify(next));
      return next;
    });
  };

  const clearChecks = () => {
    setChecks({});
    localStorage.removeItem('corvus-code-review-checks');
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!data) return;
    setExpandedItems(new Set(data.checklist.map(c => c.id)));
  };

  const collapseAll = () => setExpandedItems(new Set());

  if (error) return <div className="error-msg">{error}</div>;
  if (loading || !data) return <div className="loading">Loading code review checklist...</div>;

  const { checklist, standards_coverage, metrics } = data;

  const categories = ['all', ...Array.from(new Set(checklist.map(c => c.category)))];
  const filtered = filterCategory === 'all' ? checklist : checklist.filter(c => c.category === filterCategory);

  const getItemStatus = (item: CheckItem): string => {
    const itemChecks = checks[item.id] || {};
    const total = item.check_items.length;
    const checked = Object.values(itemChecks).filter(Boolean).length;
    if (checked === 0) return 'unchecked';
    if (checked === total) return 'pass';
    return 'partial';
  };

  const totalChecks = checklist.reduce((s, c) => s + c.check_items.length, 0);
  const totalChecked = Object.entries(checks).reduce((s, [id, cs]) => {
    const item = checklist.find(c => c.id === id);
    if (!item) return s;
    return s + Object.entries(cs).filter(([idx, v]) => v && Number(idx) < item.check_items.length).length;
  }, 0);

  return (
    <div className="security-page">
      <h2>Code Review Checklist</h2>
      <p className="security-intro">
        NASA-aligned code review requirements derived from NPR 7150.2D, NASA-STD-8739.8B/9, and NASA SWEHB.
        Use this checklist before merging changes to ensure compliance with software engineering standards.
      </p>

      {/* Metrics cards */}
      <div className="stat-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="card-value" style={{ color: totalChecked === totalChecks ? '#22c55e' : '#fb923c' }}>
            {totalChecked}/{totalChecks}
          </div>
          <div className="card-label">Checks Completed</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{metrics.total_nasa_neurons}</div>
          <div className="card-label">NASA Neurons</div>
        </div>
        <div className="stat-card">
          <div className="card-value" style={{ color: metrics.coverage_pct >= 80 ? '#22c55e' : '#fb923c' }}>
            {metrics.coverage_pct}%
          </div>
          <div className="card-label">Content Coverage</div>
        </div>
        <div className="stat-card">
          <div className="card-value">{metrics.refinement_count}</div>
          <div className="card-label">Refinements</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={{
            background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '5px 10px', fontSize: '0.8rem',
          }}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
          ))}
        </select>
        <button onClick={expandAll} style={btnStyle}>Expand All</button>
        <button onClick={collapseAll} style={btnStyle}>Collapse All</button>
        <button onClick={clearChecks} style={{ ...btnStyle, borderColor: '#ef444444', color: '#ef4444' }}>
          Reset Checks
        </button>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
        {filtered.map(item => {
          const status = getItemStatus(item);
          const expanded = expandedItems.has(item.id);
          const itemChecks = checks[item.id] || {};
          const checkedCount = Object.values(itemChecks).filter(Boolean).length;

          return (
            <div key={item.id} style={{
              background: 'var(--bg-input)', borderRadius: 8,
              border: `1px solid ${status === 'pass' ? '#22c55e33' : status === 'partial' ? '#fb923c33' : 'var(--border)'}`,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggleExpand(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', background: 'none', border: 'none',
                  color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: STATUS_COLORS[status], flexShrink: 0,
                }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: 48, color: '#64748b' }}>
                  {item.id}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>
                  {item.category}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {checkedCount}/{item.check_items.length}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                  &#9654;
                </span>
              </button>

              {expanded && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '10px 0 4px', fontStyle: 'italic' }}>
                    {item.standard}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '4px 0 12px', lineHeight: 1.5 }}>
                    {item.requirement}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {item.check_items.map((check, idx) => (
                      <label key={idx} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                        fontSize: '0.8rem', color: itemChecks[idx] ? '#22c55e' : 'var(--text)',
                        textDecoration: itemChecks[idx] ? 'line-through' : 'none',
                        opacity: itemChecks[idx] ? 0.7 : 1,
                      }}>
                        <input
                          type="checkbox"
                          checked={!!itemChecks[idx]}
                          onChange={() => toggleCheck(item.id, idx)}
                          style={{ marginTop: 2, accentColor: '#22c55e' }}
                        />
                        <span>{check}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Standards Coverage */}
      <h3 style={{ color: 'var(--text)', marginBottom: 12 }}>NASA Standards Coverage</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 16 }}>
        Neuron graph coverage for NASA software engineering standards. Neurons with content provide
        knowledge context during queries; invocations indicate how often they fire.
      </p>

      {Object.entries(standards_coverage).map(([roleKey, std]) => (
        <div key={roleKey} style={{ marginBottom: 20 }}>
          <h4 style={{ color: '#60a5fa', fontSize: '0.85rem', marginBottom: 8 }}>
            {std.role_label}
            <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 8, fontSize: '0.75rem' }}>
              {std.neurons.length} neurons &middot; {std.total_invocations} invocations
            </span>
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {std.neurons.map(n => (
              <div key={n.id} style={{
                background: 'var(--bg-input)', borderRadius: 6, padding: '8px 12px',
                border: `1px solid ${n.has_content ? '#22c55e22' : '#ef444422'}`,
                fontSize: '0.78rem',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{n.label}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem', color: '#64748b' }}>
                  <span>L{n.layer}</span>
                  <span>&middot;</span>
                  <span style={{ color: n.has_content ? '#22c55e' : '#ef4444' }}>
                    {n.has_content ? 'Has content' : 'Needs content'}
                  </span>
                  <span>&middot;</span>
                  <span>{n.invocations} fires</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'none', color: 'var(--text-dim)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '5px 12px', fontSize: '0.78rem', cursor: 'pointer',
};
