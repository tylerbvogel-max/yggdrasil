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

type Tab = 'explorer' | 'graph' | 'dashboard' | 'query' | 'pipeline' | 'evaluation' | 'refinements' | 'bolster' | 'autopilot' | 'nextsteps' | 'about';

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer');

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Yggdrasil</h1>
        <nav className="tab-nav">
          <button className={tab === 'explorer' ? 'active' : ''} onClick={() => setTab('explorer')}>Explorer</button>
          <button className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')}>Graph</button>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tab === 'query' ? 'active' : ''} onClick={() => setTab('query')}>Query Lab</button>
          <button className={tab === 'pipeline' ? 'active' : ''} onClick={() => setTab('pipeline')}>Pipeline</button>
          <button className={tab === 'evaluation' ? 'active' : ''} onClick={() => setTab('evaluation')}>Evaluation</button>
          <button className={tab === 'refinements' ? 'active' : ''} onClick={() => setTab('refinements')}>Refinements</button>
          <button className={tab === 'bolster' ? 'active' : ''} onClick={() => setTab('bolster')}>Bolster</button>
          <button className={tab === 'autopilot' ? 'active' : ''} onClick={() => setTab('autopilot')}>Autopilot</button>
          <button className={tab === 'nextsteps' ? 'active' : ''} onClick={() => setTab('nextsteps')}>Next Steps</button>
          <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>About</button>
        </nav>
      </header>
      <main className="app-main">
        {tab === 'explorer' && <Explorer />}
        {tab === 'graph' && <CirclePacking />}
        {tab === 'dashboard' && <Dashboard />}
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
