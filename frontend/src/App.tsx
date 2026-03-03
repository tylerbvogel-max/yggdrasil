import { useState } from 'react'
import Explorer from './components/Explorer'
import Dashboard from './components/Dashboard'
import QueryLab from './components/QueryLab'
import PipelinePage from './components/PipelinePage'
import EvaluationPage from './components/EvaluationPage'
import RefinementHistory from './components/RefinementHistory'
import BolsterPage from './components/BolsterPage'
import NextSteps from './components/NextSteps'

type Tab = 'explorer' | 'dashboard' | 'query' | 'pipeline' | 'evaluation' | 'refinements' | 'bolster' | 'nextsteps';

export default function App() {
  const [tab, setTab] = useState<Tab>('explorer');

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Yggdrasil</h1>
        <nav className="tab-nav">
          <button className={tab === 'explorer' ? 'active' : ''} onClick={() => setTab('explorer')}>Explorer</button>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tab === 'query' ? 'active' : ''} onClick={() => setTab('query')}>Query Lab</button>
          <button className={tab === 'pipeline' ? 'active' : ''} onClick={() => setTab('pipeline')}>Pipeline</button>
          <button className={tab === 'evaluation' ? 'active' : ''} onClick={() => setTab('evaluation')}>Evaluation</button>
          <button className={tab === 'refinements' ? 'active' : ''} onClick={() => setTab('refinements')}>Refinements</button>
          <button className={tab === 'bolster' ? 'active' : ''} onClick={() => setTab('bolster')}>Bolster</button>
          <button className={tab === 'nextsteps' ? 'active' : ''} onClick={() => setTab('nextsteps')}>Next Steps</button>
        </nav>
      </header>
      <main className="app-main">
        {tab === 'explorer' && <Explorer />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'query' && <QueryLab />}
        {tab === 'pipeline' && <PipelinePage />}
        {tab === 'evaluation' && <EvaluationPage />}
        {tab === 'refinements' && <RefinementHistory />}
        {tab === 'bolster' && <BolsterPage />}
        {tab === 'nextsteps' && <NextSteps />}
      </main>
    </div>
  )
}
