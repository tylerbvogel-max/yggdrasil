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
import SecurityPage from './components/SecurityPage'
import Aiuc1Page from './components/Aiuc1Page'
import PerformancePage from './components/PerformancePage'
import PerformanceExplanationPage from './components/PerformanceExplanationPage'

type Tab = 'explorer' | 'graph' | 'dashboard' | 'cofiring' | 'query' | 'samples' | 'pipeline' | 'evaluation' | 'refinements' | 'autopilot' | 'nextsteps' | 'about' | 'monetization' | 'security' | 'aiuc1' | 'performance' | 'perf-explain';

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
    ],
  },
  {
    label: 'Evaluate',
    items: [
      { key: 'performance', label: 'Performance' },
      { key: 'perf-explain', label: 'Methodology' },
      { key: 'evaluation', label: 'Evaluation' },
    ],
  },
  {
    label: 'About',
    items: [
      { key: 'about', label: 'Overview' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'security', label: 'NIST AI RMF' },
      { key: 'aiuc1', label: 'AIUC-1' },
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
        {tab === 'nextsteps' && <NextSteps />}
        {tab === 'about' && <AboutPage />}
        {tab === 'monetization' && <MonetizationPage />}
        {tab === 'security' && <SecurityPage />}
        {tab === 'aiuc1' && <Aiuc1Page />}
        {tab === 'performance' && <PerformancePage />}
        {tab === 'perf-explain' && <PerformanceExplanationPage />}
      </main>
    </div>
  )
}
