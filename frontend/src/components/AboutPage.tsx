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
        <h3>Why This Exists</h3>
        <p>
          Enterprise AI adoption faces three converging risks that Yggdrasil is designed to address:
        </p>

        <div className="about-thesis-grid">
          <div className="about-thesis-card">
            <h4 style={{ color: '#ef4444' }}>Cost Exposure</h4>
            <p>
              Frontier models (Opus, GPT-4) cost 60&ndash;100x more than lightweight models (Haiku, GPT-4o-mini).
              Organizations routing every query to the most expensive model are burning budget on tasks where
              a well-contextualized cheap model produces equivalent results. Yggdrasil proves the thesis:
              <strong> structured domain knowledge + cheap model &asymp; expensive model quality at 1/60th the cost.</strong>
            </p>
          </div>
          <div className="about-thesis-card">
            <h4 style={{ color: '#fb923c' }}>AI Pricing Risk</h4>
            <p>
              Current AI pricing follows the blitzscaling playbook &mdash; subsidized rates to capture market share,
              followed by inevitable price corrections. Organizations building workflows around a single provider
              at today's prices face the same risk Uber drivers faced: dependency on artificially low rates.
              Yggdrasil's architecture is <strong>model-agnostic by design</strong> &mdash; the neuron graph,
              scoring engine, and prompt assembly have nothing provider-specific about them.
            </p>
          </div>
          <div className="about-thesis-card">
            <h4 style={{ color: '#facc15' }}>Auditability Gap</h4>
            <p>
              In regulated industries (defense, aerospace, medical, financial), "the AI said so" is not an acceptable
              audit trail. Every federal contractor needs to demonstrate <em>why</em> a decision was made and
              <em> what information informed it</em>. The <strong>NIST AI Risk Management Framework (AI RMF, NIST AI 100-1)</strong> defines
              traceability and explainability as core requirements for trustworthy AI &mdash; its Map and Measure functions
              require organizations to document system behavior and reconstruct how outputs were produced.
              Yggdrasil provides full provenance aligned with these requirements:
              <strong> every classification, score, neuron selection, assembled prompt, and response is logged</strong>.
              The only non-deterministic step is the final LLM generation &mdash; everything else is reproducible.
            </p>
          </div>
        </div>
      </section>

      <section className="about-section">
        <h3>How It Works</h3>
        <p>
          Yggdrasil uses a two-stage pipeline to enrich LLM queries with relevant organizational knowledge:
        </p>
        <ol>
          <li><strong>Classify</strong> &mdash; Haiku analyzes the query to extract intent, departments, roles, and keywords</li>
          <li><strong>Score</strong> &mdash; Neurons are scored across 5 signals (Burst, Impact, Practice, Novelty, Recency) and top-K are selected</li>
          <li><strong>Assemble</strong> &mdash; Selected neurons are packed into a token-budgeted system prompt (configurable 1K&ndash;32K)</li>
          <li><strong>Execute</strong> &mdash; The model responds with enriched context, and all results are logged for audit</li>
        </ol>
      </section>

      <section className="about-section">
        <h3>What Makes This Different</h3>

        <h4 style={{ color: '#ef4444', marginTop: 16, marginBottom: 8 }}>Tier 1 &mdash; Core Architecture (Defensible IP)</h4>
        <ul className="about-features">
          <li>
            <strong>5-Signal Neuron Scoring</strong> &mdash; Not keyword matching. Each neuron is scored on Burst
            (query relevance), Impact (historical utility), Practice (firing frequency), Novelty (freshness),
            and Recency (recent use). This produces a nuanced ranking that adapts to usage patterns over time.
          </li>
          <li>
            <strong>Spread Activation</strong> &mdash; When a neuron fires, activation propagates through the co-firing
            graph to related neurons. This means the system surfaces knowledge connections that weren't explicitly
            queried for &mdash; emergent recall, not just retrieval.
          </li>
          <li>
            <strong>Token-Budgeted Prompt Assembly</strong> &mdash; Score-ordered packing with per-slot configurable
            budgets (1K&ndash;32K tokens) and neuron counts (1&ndash;500). The assembler groups by department and role
            for structural coherence, with automatic fallback to summary-only when full content exceeds budget.
          </li>
          <li>
            <strong>Full Audit Trail</strong> &mdash; Every classification, score breakdown, neuron selection, assembled
            prompt, model response, and evaluation is logged. The entire decision chain from "user asked X" to "system
            provided Y because of neurons Z" is reproducible and inspectable.
          </li>
          <li>
            <strong>A/B Testing Infrastructure</strong> &mdash; Multi-slot parallel execution with per-slot token budgets,
            neuron counts, and model selection. Run Haiku at 4K/8K/12K tokens alongside raw Opus simultaneously.
            Blind evaluation with cross-tier bias awareness (Opus judging Sonnet vs Haiku).
          </li>
        </ul>

        <h4 style={{ color: '#fb923c', marginTop: 16, marginBottom: 8 }}>Tier 2 &mdash; Domain Intelligence</h4>
        <ul className="about-features">
          <li>
            <strong>6-Layer Knowledge Hierarchy</strong> &mdash; Department &rarr; Role &rarr; Task &rarr; System &rarr;
            Decision &rarr; Output. Not a flat document store. The structure encodes organizational relationships,
            enabling contextually appropriate knowledge selection based on the type of question asked.
          </li>
          <li>
            <strong>Self-Improving Loop</strong> &mdash; Query &rarr; Evaluate &rarr; Refine &rarr; Apply &rarr; Re-query.
            Every evaluation identifies knowledge gaps. Every refinement improves the graph. The Autopilot feature
            runs this loop autonomously, continuously expanding and correcting the knowledge base.
          </li>
          <li>
            <strong>Cost Arbitrage Proof</strong> &mdash; Demonstrable evidence that Haiku + neuron context at 8K tokens
            approaches Opus-quality answers at ~92% less cost. The system quantifies exactly where the cost-quality
            frontier sits for any given domain density.
          </li>
        </ul>

        <h4 style={{ color: '#facc15', marginTop: 16, marginBottom: 8 }}>Tier 3 &mdash; Operational Features</h4>
        <ul className="about-features">
          <li>
            <strong>Blind Evaluation Framework</strong> &mdash; Answers are labeled A/B/C with no model identification.
            Scored on accuracy, completeness, clarity, faithfulness, and overall quality. Evaluator model is
            configurable (Haiku/Sonnet/Opus) with documented guidance on cross-tier judge bias.
          </li>
          <li>
            <strong>Co-Firing Graph</strong> &mdash; Neurons that fire together develop weighted edges. This creates
            an emergent association map &mdash; a secondary knowledge structure that isn't designed but discovered
            through usage patterns. Visualized as chord diagrams and ego graphs.
          </li>
          <li>
            <strong>Bolster System</strong> &mdash; Targeted knowledge expansion by department and role. Feed domain
            context to an LLM, review proposed neurons and updates, selectively apply. Systematic deepening from
            skeletal (5&ndash;15 neurons) to full coverage (60&ndash;100+ neurons per role).
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Neuron Graph Structure</h3>
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
            <tr><td className="signal-impact">Impact</td><td>Historical utility &mdash; how useful this neuron has been in past queries</td></tr>
            <tr><td className="signal-practice">Practice</td><td>Frequency of firing &mdash; how often this neuron gets selected</td></tr>
            <tr><td className="signal-novelty">Novelty</td><td>Freshness bonus for recently created neurons</td></tr>
            <tr><td className="signal-recency">Recency</td><td>Recent firing boost &mdash; neurons used recently get a short-term bump</td></tr>
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
          <li><strong>Query Lab</strong> &mdash; Multi-slot A/B comparison with XY plot for token budget and neuron count per slot</li>
          <li><strong>Bolster</strong> &mdash; Bulk-expand neuron knowledge by providing domain context to an LLM</li>
          <li><strong>Autopilot</strong> &mdash; Autonomous training loop that generates queries, evaluates, refines, and applies improvements</li>
          <li><strong>Explorer</strong> &mdash; Browse and inspect the full neuron tree with scoring details</li>
          <li><strong>Dashboard</strong> &mdash; Visualize neuron health, firing patterns, and role coverage</li>
          <li><strong>Pipeline</strong> &mdash; Step-through view of the two-stage classification and scoring process</li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Backup &amp; Data Safety</h3>
        <table className="about-table">
          <thead>
            <tr><th>Location</th><th>Method</th><th>Schedule</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Google Drive</td>
              <td>Rotating copy of SQLite DB &mdash; alternates between <code>backup_a.db</code> and <code>backup_b.db</code></td>
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
          a 2&ndash;4 week recovery window. The git repository is hosted at
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
