import { useEffect, useState } from 'react';
import { fetchStats } from '../api';
import type { NeuronStats } from '../types';

export default function AboutPage() {
  const [stats, setStats] = useState<NeuronStats | null>(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="about-page">
      <h2>About Yggdrasil</h2>

      <section className="about-section">
        <h3>Overview</h3>
        <p>
          Yggdrasil is a biomimetic neuron graph for prompt preparation. It uses a two-stage
          Haiku pipeline to enrich LLM queries with relevant organizational knowledge:
        </p>
        <ol>
          <li><strong>Classify</strong> — Haiku analyzes the query to extract intent, departments, roles, and keywords</li>
          <li><strong>Score</strong> — Neurons are scored across 5 signals (Burst, Impact, Practice, Novelty, Recency) and top-K are selected</li>
          <li><strong>Assemble</strong> — Selected neurons are packed into a ~4000-token system prompt</li>
          <li><strong>Execute</strong> — Haiku (or Sonnet/Opus) responds with the enriched context</li>
        </ol>
      </section>

      <section className="about-section">
        <h3>Neuron Graph Structure</h3>
        <p>
          The knowledge graph is organized as a 6-layer hierarchy modeled after an aerospace
          organization:
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Layer</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>L0</td><td>Department</td><td>Top-level organizational divisions (Engineering, Program Management, etc.)</td></tr>
            <tr><td>L1</td><td>Role</td><td>Specialist roles within each department</td></tr>
            <tr><td>L2</td><td>Task</td><td>Core responsibilities and task areas for each role</td></tr>
            <tr><td>L3</td><td>System</td><td>Specific systems, processes, or tools used</td></tr>
            <tr><td>L4</td><td>Decision</td><td>Key decisions and judgment calls</td></tr>
            <tr><td>L5</td><td>Output</td><td>Deliverables, reports, and communications</td></tr>
          </tbody>
        </table>
        {stats && (
          <div className="about-stats">
            <div className="about-stat"><span className="about-stat-value">{stats.total_neurons}</span><span className="about-stat-label">Total Neurons</span></div>
            <div className="about-stat"><span className="about-stat-value">{Object.keys(stats.by_department).length}</span><span className="about-stat-label">Departments</span></div>
            <div className="about-stat"><span className="about-stat-value">{Object.values(stats.by_department_roles).reduce((sum, roles) => sum + Object.keys(roles).length, 0)}</span><span className="about-stat-label">Roles</span></div>
          </div>
        )}
      </section>

      <section className="about-section">
        <h3>Scoring Signals</h3>
        <p>Each neuron is scored using 5 signals when evaluating relevance to a query:</p>
        <table className="about-table">
          <thead>
            <tr><th>Signal</th><th>What It Measures</th></tr>
          </thead>
          <tbody>
            <tr><td className="signal-burst">Burst</td><td>Keyword and intent match strength from the classification stage</td></tr>
            <tr><td className="signal-impact">Impact</td><td>Historical utility — how useful this neuron has been in past queries</td></tr>
            <tr><td className="signal-practice">Practice</td><td>Frequency of firing — how often this neuron gets selected</td></tr>
            <tr><td className="signal-novelty">Novelty</td><td>Freshness bonus for recently created neurons</td></tr>
            <tr><td className="signal-recency">Recency</td><td>Recent firing boost — neurons used recently get a short-term bump</td></tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h3>Application Stack</h3>
        <table className="about-table">
          <thead>
            <tr><th>Component</th><th>Technology</th></tr>
          </thead>
          <tbody>
            <tr><td>Backend</td><td>Python FastAPI + async SQLAlchemy + aiosqlite</td></tr>
            <tr><td>Frontend</td><td>React + Vite + TypeScript</td></tr>
            <tr><td>Database</td><td>SQLite with WAL mode (local file)</td></tr>
            <tr><td>LLM Provider</td><td>Anthropic API (Claude Haiku / Sonnet / Opus)</td></tr>
            <tr><td>Port</td><td>8002 (serves both API and static frontend)</td></tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h3>Key Features</h3>
        <ul className="about-features">
          <li><strong>Query Lab</strong> — Submit queries, evaluate responses, refine neuron content with AI-assisted analysis</li>
          <li><strong>Bolster</strong> — Bulk-expand neuron knowledge by providing domain context to an LLM</li>
          <li><strong>Autopilot</strong> — Autonomous training loop that generates queries, evaluates, refines, and applies improvements</li>
          <li><strong>Explorer</strong> — Browse and inspect the full neuron tree with scoring details</li>
          <li><strong>Dashboard</strong> — Visualize neuron health, firing patterns, and role coverage</li>
          <li><strong>Pipeline</strong> — Step-through view of the two-stage classification and scoring process</li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Backup & Data Safety</h3>
        <table className="about-table">
          <thead>
            <tr><th>Location</th><th>Method</th><th>Schedule</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Google Drive</td>
              <td>Rotating copy of SQLite DB — alternates between <code>backup_a.db</code> and <code>backup_b.db</code></td>
              <td>Every 2 weeks (Sunday 3am)</td>
            </tr>
            <tr>
              <td>GitHub</td>
              <td>JSON neuron checkpoint committed and pushed to remote</td>
              <td>Every 2 weeks (same schedule)</td>
            </tr>
            <tr>
              <td>Local</td>
              <td>SQLite DB file at <code>backend/yggdrasil.db</code></td>
              <td>Live (always current)</td>
            </tr>
          </tbody>
        </table>
        <p className="about-note">
          Backups are managed by a systemd timer (<code>yggdrasil-backup.timer</code>).
          Two Google Drive copies are maintained at all times, each 2 weeks apart, providing
          a 2-4 week recovery window. The git repository is hosted at
          {' '}<code>github.com/tylerbvogel-max/yggdrasil</code>.
        </p>
      </section>

      <section className="about-section">
        <h3>Project Structure</h3>
        <pre className="about-tree">{`yggdrasil/
  backend/
    app/
      main.py            # FastAPI entry point
      config.py          # Settings and env vars
      database.py        # SQLAlchemy engine (WAL mode)
      models.py          # Neuron, Query, NeuronFiring models
      schemas.py         # Pydantic request/response schemas
      scoring.py         # 5-signal neuron scoring engine
      routers/
        neurons.py       # Tree, detail, stats endpoints
        query.py         # Query, evaluate, refine pipeline
        admin.py         # Seed, checkpoint, bolster, cost report
        autopilot.py     # Autonomous training loop
      seed/
        yggdrasil_org.yaml  # Neuron tree definition
        loader.py           # YAML seed loader
    checkpoints/         # JSON neuron snapshots (git-tracked)
    backup.sh            # Automated backup script
    yggdrasil.db         # SQLite database
  frontend/
    src/
      App.tsx            # Tab navigation shell
      api.ts             # Backend API client
      types.ts           # TypeScript type definitions
      components/        # Page components (Explorer, Dashboard, etc.)
    dist/                # Built frontend (served by FastAPI)`}</pre>
      </section>
    </div>
  );
}
