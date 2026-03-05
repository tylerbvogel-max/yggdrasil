import { useState } from 'react'
import Explorer from './components/Explorer'
import Dashboard from './components/Dashboard'
import QueryLab from './components/QueryLab'
import PipelinePage from './components/PipelinePage'
import EvaluationPage from './components/EvaluationPage'
import RefinementHistory from './components/RefinementHistory'
import BolsterPage from './components/BolsterPage'
import NextSteps from './components/NextSteps'
import AutopilotPage from './components/AutopilotPage'
import CirclePacking from './components/CirclePacking'
import AboutPage from './components/AboutPage'
import DeptChordDiagram from './components/DeptChordDiagram'

type Tab = 'explorer' | 'graph' | 'dashboard' | 'cofiring' | 'query' | 'pipeline' | 'evaluation' | 'refinements' | 'bolster' | 'autopilot' | 'nextsteps' | 'about';

const NAV_GROUPS = [
  {
    label: 'Visualizations',
    items: [
      { key: 'explorer' as Tab, label: 'Explorer' },
      { key: 'graph' as Tab, label: 'Graph' },
      { key: 'dashboard' as Tab, label: 'Dashboard' },
      { key: 'cofiring' as Tab, label: 'Co-Firing' },
    ],
  },
  {
    label: 'Training',
    items: [
      { key: 'query' as Tab, label: 'Query Lab' },
      { key: 'refinements' as Tab, label: 'Refinements' },
      { key: 'bolster' as Tab, label: 'Bolster' },
      { key: 'autopilot' as Tab, label: 'Autopilot' },
    ],
  },
  {
    label: 'About',
    items: [
      { key: 'about' as Tab, label: 'Overview' },
      { key: 'pipeline' as Tab, label: 'Pipeline' },
      { key: 'nextsteps' as Tab, label: 'Next Steps' },
      { key: 'evaluation' as Tab, label: 'Evaluation' },
    ],
  },
] as const;

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer');

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
                    className={tab === item.key ? 'active' : ''}
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
        {tab === 'explorer' && <Explorer />}
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
        <div style={{ display: tab === 'query' ? 'contents' : 'none' }}><QueryLab /></div>
        {tab === 'pipeline' && <PipelinePage />}
        {tab === 'evaluation' && <EvaluationPage />}
        {tab === 'refinements' && <RefinementHistory />}
        <div style={{ display: tab === 'bolster' ? 'contents' : 'none' }}><BolsterPage /></div>
        {tab === 'autopilot' && <AutopilotPage />}
        {tab === 'nextsteps' && <NextSteps />}
        {tab === 'about' && <AboutPage />}
      </main>
    </div>
  )
}
