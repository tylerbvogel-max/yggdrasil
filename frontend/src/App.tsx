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
import ObservationReviewPage from './components/ObservationReviewPage'
import CodeReviewPage from './components/CodeReviewPage'

type Tab = 'explorer' | 'graph' | 'universe' | 'dashboard' | 'cofiring' | 'layer-heatmap' | 'query' | 'samples' | 'pipeline' | 'evaluation' | 'refinements' | 'autopilot' | 'emergent-queue' | 'nextsteps' | 'about' | 'arch-plan' | 'getting-started' | 'monetization' | 'compliance' | 'compliance-audit' | 'quality' | 'fairness' | 'governance' | 'performance' | 'perf-explain' | 'method-risks' | 'mgmt-reviews' | 'evidence-map' | 'corvus-feed' | 'corvus-observations' | 'code-review';

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
      { key: 'code-review', label: 'Code Review' },
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
        {tab === 'corvus-observations' && <ObservationReviewPage />}
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
        {tab === 'code-review' && <CodeReviewPage />}
        {tab === 'governance' && <GovernancePage />}
        {tab === 'performance' && <PerformancePage />}
        {tab === 'perf-explain' && <PerformanceExplanationPage />}
        {tab === 'method-risks' && <MethodologicalRisks />}
      </main>
    </div>
  )
}


