import { useState, useCallback } from 'react'
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
type Tab = 'explorer' | 'graph' | 'universe' | 'dashboard' | 'cofiring' | 'layer-heatmap' | 'query' | 'samples' | 'pipeline' | 'evaluation' | 'refinements' | 'autopilot' | 'emergent-queue' | 'nextsteps' | 'about' | 'arch-plan' | 'getting-started' | 'monetization' | 'compliance' | 'compliance-audit' | 'quality' | 'fairness' | 'governance' | 'performance' | 'perf-explain' | 'method-risks' | 'mgmt-reviews' | 'evidence-map';

interface NavItem {
  key: Tab;
  label: string;
  className?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
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

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer');
  const [explorerNeuronId, setExplorerNeuronId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );

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
          {!collapsed && <h1 className="app-title">Yggdrasil</h1>}
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
      </aside>
      <main className="app-main">
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
