import { useState, useCallback, useEffect } from 'react'
import Explorer from './components/Explorer'
import Dashboard from './components/Dashboard'
import QueryLab from './components/QueryLab'
import PipelinePage from './components/PipelinePage'
import EvaluationPage from './components/EvaluationPage'
import RefinementHistory from './components/RefinementHistory'
import NextSteps from './components/NextSteps'
import AutopilotPage from './components/AutopilotPage'
import CirclePacking from './components/CirclePacking'
import AboutPage from './components/AboutPage'
import MonetizationPage from './components/MonetizationPage'
import SampleQueries from './components/SampleQueries'
import DeptChordDiagram from './components/DeptChordDiagram'
import GettingStartedPage from './components/GettingStartedPage'
import CompliancePage from './components/CompliancePage'
import ComplianceAuditPage from './components/ComplianceAuditPage'
import QualityPage from './components/QualityPage'
import FairnessPage from './components/FairnessPage'
import GovernancePage from './components/GovernancePage'
import PerformancePage from './components/PerformancePage'
import PerformanceExplanationPage from './components/PerformanceExplanationPage'
import EmergentQueuePage from './components/EmergentQueuePage'
import LayerHeatmap from './components/LayerHeatmap'
import MethodologicalRisks from './components/MethodologicalRisks'
import NeuronUniverse from './components/NeuronUniverse'
import ArchitecturePlanPage from './components/ArchitecturePlanPage'
import ManagementReviewPage from './components/ManagementReviewPage'
import EvidenceMapPage from './components/EvidenceMapPage'
import CorvusPage from './components/CorvusPage'

type Tab = 'explorer' | 'graph' | 'universe' | 'dashboard' | 'cofiring' | 'layer-heatmap' | 'query' | 'samples' | 'pipeline' | 'evaluation' | 'refinements' | 'autopilot' | 'emergent-queue' | 'nextsteps' | 'about' | 'arch-plan' | 'getting-started' | 'monetization' | 'compliance' | 'compliance-audit' | 'quality' | 'fairness' | 'governance' | 'performance' | 'perf-explain' | 'method-risks' | 'mgmt-reviews' | 'evidence-map' | 'corvus-feed' | 'corvus-observations';

type Theme = 'corvus-native' | 'yggdrasil-dark' | 'yggdrasil-light' | 'high-contrast' | 'colorblind';

const THEME_LABELS: Record<Theme, string> = {
  'corvus-native': 'Corvus Native',
  'yggdrasil-dark': 'Yggdrasil',
  'yggdrasil-light': 'Yggdrasil Light',
  'high-contrast': 'High Contrast',
  'colorblind': 'Colorblind',
};

interface NavItem {
  key: Tab;
  label: string;
  className?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Corvus',
    items: [
      { key: 'corvus-feed', label: 'Screen Watcher' },
      { key: 'corvus-observations', label: 'Observations' },
    ],
  },
  {
    label: 'Query',
    items: [
      { key: 'query', label: 'Query Lab' },
      { key: 'samples', label: 'Samples' },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { key: 'explorer', label: 'Explorer' },
      { key: 'graph', label: 'Graph' },
      { key: 'universe', label: '3D Universe' },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'cofiring', label: 'Co-Firing' },
      { key: 'layer-heatmap', label: 'Layer Heatmap' },
    ],
  },
  {
    label: 'Improve',
    items: [
      { key: 'autopilot', label: 'Autopilot' },
      { key: 'refinements', label: 'Refinements' },
      { key: 'emergent-queue', label: 'Emergent Queue' },
    ],
  },
  {
    label: 'Evaluate',
    items: [
      { key: 'performance', label: 'Performance' },
      { key: 'quality', label: 'Quality' },
      { key: 'fairness', label: 'Fairness' },
      { key: 'evaluation', label: 'Evaluation' },
      { key: 'perf-explain', label: 'Methodology' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { key: 'compliance-audit', label: 'Audit Scan' },
      { key: 'mgmt-reviews', label: 'Reviews' },
      { key: 'evidence-map', label: 'Evidence Map' },
      { key: 'compliance', label: 'Unified View' },
      { key: 'governance', label: 'Governance' },
    ],
  },
  {
    label: 'About',
    items: [
      { key: 'getting-started', label: 'Getting Started' },
      { key: 'about', label: 'Overview' },
      { key: 'arch-plan', label: 'Architecture Plan' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'method-risks', label: 'Risks' },
      { key: 'nextsteps', label: 'Next Steps' },
      { key: 'monetization', label: 'Monetization', className: 'nav-monetization' },
    ],
  },
];

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('corvus-theme');
  if (saved && saved in THEME_LABELS) {
    return saved as Theme;
  }
  return 'corvus-native';
}

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer');
  const [explorerNeuronId, setExplorerNeuronId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('corvus-theme', theme);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    setThemeMenuOpen(false);
  }

  function navigateToNeuron(id: number) {
    setExplorerNeuronId(id);
    setTab('explorer');
  }

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  // Find which group the active tab belongs to
  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.key === tab))?.label;

  return (
    <div className="app app-sidebar-layout">
      <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <img src="/corvus-logo-128.png" alt="Corvus" className="sidebar-logo" />
          {!collapsed && <h1 className="app-title">Corvus</h1>}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>
        {!collapsed && (
          <nav className="sidebar-nav">
            {NAV_GROUPS.map(group => (
              <div key={group.label} className={`sidebar-group${activeGroup === group.label ? ' sidebar-group-active' : ''}`}>
                <button
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="sidebar-chevron">{expandedGroups.has(group.label) ? '\u25BE' : '\u25B8'}</span>
                  <span>{group.label}</span>
                </button>
                {expandedGroups.has(group.label) && (
                  <div className="sidebar-group-items">
                    {group.items.map(item => (
                      <button
                        key={item.key}
                        className={`sidebar-item${tab === item.key ? ' active' : ''}${item.className ? ' ' + item.className : ''}`}
                        onClick={() => setTab(item.key)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        )}
        {/* Settings gear — always visible, even when collapsed */}
        <div className="sidebar-settings-area">
          <button
            className="sidebar-settings-btn"
            onClick={() => setThemeMenuOpen(o => !o)}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Settings popup */}
      {themeMenuOpen && (
        <>
          <div className="settings-overlay" onClick={() => setThemeMenuOpen(false)} />
          <div className="settings-popup">
            <div className="settings-popup-header">
              <span>Settings</span>
              <button className="settings-popup-close" onClick={() => setThemeMenuOpen(false)}>&times;</button>
            </div>
            <div className="settings-popup-section">
              <label className="settings-label">Theme</label>
              <div className="settings-theme-options">
                {(Object.keys(THEME_LABELS) as Theme[]).map(t => (
                  <button
                    key={t}
                    className={`settings-theme-btn${theme === t ? ' active' : ''}`}
                    onClick={() => setTheme(t)}
                  >
                    <span className={`settings-theme-swatch settings-theme-swatch--${t}`} />
                    <span>{THEME_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      <main className="app-main">
        {tab === 'corvus-feed' && <CorvusPage />}
        {tab === 'corvus-observations' && <CorvusObservationsPage />}
        {tab === 'explorer' && <Explorer navigateToNeuronId={explorerNeuronId} onNavigateHandled={() => setExplorerNeuronId(null)} />}
        {tab === 'graph' && <CirclePacking />}
        {tab === 'universe' && <NeuronUniverse />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'cofiring' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Role Co-Firing Chord Diagram</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <DeptChordDiagram />
            </div>
          </div>
        )}
        {tab === 'layer-heatmap' && <LayerHeatmap />}
        <div style={{ display: tab === 'query' ? 'contents' : 'none' }}><QueryLab onNavigateToNeuron={navigateToNeuron} /></div>
        {tab === 'pipeline' && <PipelinePage />}
        {tab === 'evaluation' && <EvaluationPage />}
        {tab === 'refinements' && <RefinementHistory />}
        {tab === 'samples' && <SampleQueries />}
        {tab === 'autopilot' && <AutopilotPage />}
        {tab === 'emergent-queue' && <EmergentQueuePage />}
        {tab === 'nextsteps' && <NextSteps />}
        {tab === 'getting-started' && <GettingStartedPage />}
        {tab === 'about' && <AboutPage />}
        {tab === 'arch-plan' && <ArchitecturePlanPage />}
        {tab === 'monetization' && <MonetizationPage />}
        {tab === 'compliance' && <CompliancePage />}
        {tab === 'compliance-audit' && <ComplianceAuditPage />}
        {tab === 'mgmt-reviews' && <ManagementReviewPage />}
        {tab === 'evidence-map' && <EvidenceMapPage onNavigate={k => setTab(k as Tab)} />}
        {tab === 'quality' && <QualityPage />}
        {tab === 'fairness' && <FairnessPage />}
        {tab === 'governance' && <GovernancePage />}
        {tab === 'performance' && <PerformancePage />}
        {tab === 'perf-explain' && <PerformanceExplanationPage />}
        {tab === 'method-risks' && <MethodologicalRisks />}
      </main>
    </div>
  )
}


/** Observations page — shows Yggdrasil observation queue from Corvus ingestion */
function CorvusObservationsPage() {
  const [observations, setObservations] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchObs();
  }, [filter]);

  async function fetchObs() {
    try {
      const url = filter
        ? `/ingest/observations?status=${filter}&limit=50`
        : '/ingest/observations?limit=50';
      const r = await fetch(url);
      if (r.ok) setObservations(await r.json());
    } catch {}
  }

  async function approve(id: number) {
    await fetch(`/ingest/observations/${id}/approve`, { method: 'POST' });
    fetchObs();
  }

  async function reject(id: number) {
    await fetch(`/ingest/observations/${id}/reject`, { method: 'POST' });
    fetchObs();
  }

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)' }}>
          Corvus Observations
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', 'queued', 'approved', 'rejected', 'duplicate'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '3px 10px', fontSize: '0.75rem', borderRadius: 4,
                background: filter === f ? 'var(--accent)' : 'var(--bg-input)',
                color: filter === f ? '#000' : 'var(--text-dim)',
                border: 'none', cursor: 'pointer',
              }}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 16 }}>
        Observations from Corvus screen watching, queued for neuron creation in the knowledge graph.
      </p>

      {observations.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>
          No observations yet. Corvus will submit observations at digest time when Yggdrasil integration is enabled.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {observations.map(o => (
            <div key={o.id} className="result-card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3, fontSize: '0.65rem', fontWeight: 600,
                    textTransform: 'uppercase',
                    background: o.status === 'queued' ? 'rgba(56,189,248,0.15)' :
                                o.status === 'approved' ? 'rgba(34,197,94,0.15)' :
                                o.status === 'rejected' ? 'rgba(239,68,68,0.15)' :
                                'rgba(255,255,255,0.05)',
                    color: o.status === 'queued' ? 'var(--accent)' :
                           o.status === 'approved' ? 'var(--precision)' :
                           o.status === 'rejected' ? 'var(--impact)' :
                           'var(--text-dim)',
                  }}>
                    {o.status}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{o.observation_type}</span>
                  {o.proposed_department && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>· {o.proposed_department}</span>
                  )}
                  {o.similarity_score != null && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      · {(o.similarity_score * 100).toFixed(0)}% similar
                    </span>
                  )}
                </div>
                {o.status === 'queued' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn" onClick={() => approve(o.id)} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                      Approve
                    </button>
                    <button onClick={() => reject(o.id)} style={{
                      fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4,
                      background: 'var(--bg-input)', color: 'var(--text-dim)',
                      border: 'none', cursor: 'pointer',
                    }}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5 }}>
                {o.text}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: 4 }}>
                {o.created_at ? new Date(o.created_at).toLocaleString() : ''}
                {o.created_neuron_id && <span> · Created neuron #{o.created_neuron_id}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
