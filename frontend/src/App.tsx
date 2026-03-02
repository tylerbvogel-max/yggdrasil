import { useState } from 'react'
import Explorer from './components/Explorer'
import Dashboard from './components/Dashboard'
import QueryLab from './components/QueryLab'

type Tab = 'explorer' | 'dashboard' | 'query';

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
        </nav>
      </header>
      <main className="app-main">
        {tab === 'explorer' && <Explorer />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'query' && <QueryLab />}
      </main>
    </div>
  )
}
