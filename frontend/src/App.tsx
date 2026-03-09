import { useState } from 'react'
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

type Tab = 'explorer' | 'graph' | 'dashboard' | 'cofiring' | 'query' | 'samples' | 'pipeline' | 'evaluation' | 'refinements' | 'autopilot' | 'emergent-queue' | 'nextsteps' | 'about' | 'getting-started' | 'monetization' | 'compliance' | 'compliance-audit' | 'quality' | 'fairness' | 'governance' | 'performance' | 'perf-explain';

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
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'cofiring', label: 'Co-Firing' },
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
      { key: 'compliance-audit', label: 'Compliance' },
      { key: 'evaluation', label: 'Evaluation' },
      { key: 'perf-explain', label: 'Methodology' },
    ],
  },
  {
    label: 'About',
    items: [
      { key: 'getting-started', label: 'Getting Started' },
      { key: 'about', label: 'Overview' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'compliance', label: 'Compliance' },
      { key: 'governance', label: 'Governance' },
      { key: 'nextsteps', label: 'Next Steps' },
      { key: 'monetization', label: 'Monetization', className: 'nav-monetization' },
    ],
  },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer');
  const [explorerNeuronId, setExplorerNeuronId] = useState<number | null>(null);

  function navigateToNeuron(id: number) {
    setExplorerNeuronId(id);
    setTab('explorer');
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Yggdrasil</h1>
        <nav className="tab-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="nav-group">
              <span className="nav-group-label">{group.label}</span>
              <div className="nav-group-items">
                {group.items.map(item => (
                  <button
                    key={item.key}
                    className={`${tab === item.key ? 'active' : ''}${item.className ? ' ' + item.className : ''}`}
                    onClick={() => setTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'explorer' && <Explorer navigateToNeuronId={explorerNeuronId} onNavigateHandled={() => setExplorerNeuronId(null)} />}
        {tab === 'graph' && <CirclePacking />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'cofiring' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Role Co-Firing Chord Diagram</h3>
            <div style={{ flex: 1, minHeight: 0 }}>
              <DeptChordDiagram />
            </div>
          </div>
        )}
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
        {tab === 'monetization' && <MonetizationPage />}
        {tab === 'compliance' && <CompliancePage />}
        {tab === 'compliance-audit' && <ComplianceAuditPage />}
        {tab === 'quality' && <QualityPage />}
        {tab === 'fairness' && <FairnessPage />}
        {tab === 'governance' && <GovernancePage />}
        {tab === 'performance' && <PerformancePage />}
        {tab === 'perf-explain' && <PerformanceExplanationPage />}
      </main>
    </div>
  )
}
