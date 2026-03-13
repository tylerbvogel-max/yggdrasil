import { useState } from 'react';

type Section = 'setup' | 'training';

export default function GettingStartedPage() {
  const [section, setSection] = useState<Section>('setup');

  return (
    <div className="about-page">
      <h2>Getting Started</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: 16 }}>
        Setup guide and training walkthrough for new Yggdrasil operators.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          className={section === 'setup' ? 'active' : ''}
          style={{
            padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
            border: section === 'setup' ? '1px solid #60a5fa' : '1px solid #334155',
            background: section === 'setup' ? '#1e3a5f' : 'transparent',
            color: section === 'setup' ? '#60a5fa' : '#c8d0dc',
          }}
          onClick={() => setSection('setup')}
        >
          Setup Guide
        </button>
        <button
          className={section === 'training' ? 'active' : ''}
          style={{
            padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
            border: section === 'training' ? '1px solid #60a5fa' : '1px solid #334155',
            background: section === 'training' ? '#1e3a5f' : 'transparent',
            color: section === 'training' ? '#60a5fa' : '#c8d0dc',
          }}
          onClick={() => setSection('training')}
        >
          Training Walkthrough
        </button>
      </div>

      {section === 'setup' && <SetupGuide />}
      {section === 'training' && <TrainingWalkthrough />}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: '#0f172a', border: '1px solid #1e2d4a', borderRadius: 8,
      padding: '12px 16px', overflowX: 'auto', fontSize: '0.8rem',
      color: '#ffffff', lineHeight: 1.6, margin: '8px 0 16px',
    }}>
      <code>{children}</code>
    </pre>
  );
}

function StepCard({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-input)', borderRadius: 8, padding: '16px 20px',
      marginBottom: 16, borderLeft: '3px solid #60a5fa',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{
          background: '#60a5fa', color: '#0f172a', borderRadius: '50%',
          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
        }}>
          {number}
        </span>
        <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{title}</strong>
      </div>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

function SetupGuide() {
  return (
    <>
      <section className="about-section">
        <h3>Prerequisites</h3>
        <table className="about-table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr><th>Requirement</th><th>Version</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td>Python</td><td>3.11+</td><td>Async SQLAlchemy requires 3.10+; tested on 3.11.2</td></tr>
            <tr><td>PostgreSQL</td><td>15+</td><td>Database backend (asyncpg driver)</td></tr>
            <tr><td>Node.js</td><td>20+</td><td>For frontend build (Vite + React 19)</td></tr>
            <tr><td>npm</td><td>10+</td><td>Comes with Node 20</td></tr>
            <tr><td>Git</td><td>Any</td><td>For cloning and checkpoint commits</td></tr>
            <tr><td>Anthropic API key</td><td>&mdash;</td><td>Required for query pipeline (classification + execution)</td></tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h3>Installation</h3>

        <StepCard number={1} title="Clone the repository">
          <CodeBlock>{`git clone https://github.com/tylerbvogel-max/yggdrasil.git
cd yggdrasil`}</CodeBlock>
        </StepCard>

        <StepCard number={2} title="Set up PostgreSQL">
          <p>Create the database and user:</p>
          <CodeBlock>{`sudo -u postgres psql -c "CREATE USER yggdrasil WITH PASSWORD 'yggdrasil';"
sudo -u postgres psql -c "CREATE DATABASE yggdrasil OWNER yggdrasil;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yggdrasil TO yggdrasil;"`}</CodeBlock>
        </StepCard>

        <StepCard number={3} title="Create your environment file">
          <p>Copy the example and add your Anthropic API key:</p>
          <CodeBlock>{`cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            The only required variable is <code style={{ color: '#60a5fa' }}>ANTHROPIC_API_KEY</code>.
            The default <code>DATABASE_URL</code> connects to the local PostgreSQL instance created above.
            All other settings (model, token budget, scoring weights) have sensible defaults in <code>backend/app/config.py</code>.
          </p>
        </StepCard>

        <StepCard number={4} title="Set up the backend">
          <CodeBlock>{`cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt`}</CodeBlock>
        </StepCard>

        <StepCard number={5} title="Start the backend">
          <CodeBlock>{`cd backend
source venv/bin/activate
uvicorn app.main:app --port 8002 --reload`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            On first start, the backend will automatically:
          </p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li>Create all tables in the PostgreSQL database</li>
            <li>Run schema migrations</li>
            <li>Seed the neuron graph (2,031 neurons across 9 departments, 51 roles, 6 layers)</li>
            <li>Load regulatory reference patterns (~150 neurons)</li>
          </ul>
        </StepCard>

        <StepCard number={6} title="Set up the frontend">
          <p>In a second terminal:</p>
          <CodeBlock>{`cd frontend
npm install`}</CodeBlock>
        </StepCard>

        <StepCard number={7} title="Run in development mode">
          <CodeBlock>{`cd frontend
npm run dev`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            Opens on <code style={{ color: '#60a5fa' }}>http://localhost:5173</code> with hot-reload.
            API calls proxy to the backend on port 8002 automatically.
          </p>
        </StepCard>

        <StepCard number={8} title="Or build for production">
          <CodeBlock>{`cd frontend
npm run build`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            Outputs to <code>frontend/dist/</code>. The backend automatically serves the built
            frontend as static files — access everything at <code style={{ color: '#60a5fa' }}>http://localhost:8002</code>.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>MCP Integration (Optional)</h3>
        <p>
          Yggdrasil can be used as an MCP server, allowing Claude Code to query the neuron graph directly
          for context enrichment — no manual copy-paste of prompts needed.
        </p>

        <StepCard number={9} title="Verify MCP configuration">
          <p>
            The repository includes a <code>.mcp.json</code> file that tells Claude Code how to spawn the
            Yggdrasil MCP server:
          </p>
          <CodeBlock>{`# .mcp.json (already in repo root)
{
  "mcpServers": {
    "yggdrasil": {
      "type": "stdio",
      "command": "/home/tylerbvogel/Projects/yggdrasil/backend/venv/bin/python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/home/tylerbvogel/Projects/yggdrasil/backend"
    }
  }
}`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            When you open Claude Code in the <code>yggdrasil/</code> directory, it will automatically
            detect this file and make the Yggdrasil tools available.
          </p>
        </StepCard>

        <StepCard number={10} title="Test MCP tools in Claude Code">
          <p>
            Open Claude Code in the project directory and verify the tools appear:
          </p>
          <CodeBlock>{`cd ~/Projects/yggdrasil
claude
# Then ask: "Use the yggdrasil graph_stats tool to show me the neuron graph statistics"`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            You should see 7 tools available: <code>query_graph</code>, <code>impact_analysis</code>,{' '}
            <code>neuron_detail</code>, <code>browse_departments</code>, <code>graph_stats</code>,{' '}
            <code>cost_report</code>, and <code>discover_clusters</code>.
          </p>
        </StepCard>

        <StepCard number={11} title="Use Yggdrasil context in queries">
          <p>
            The primary workflow: ask Claude Code a domain question, and it calls <code>query_graph</code>
            to get neuron-enriched context before answering:
          </p>
          <CodeBlock>{`# In Claude Code (with MCP connected):
"What are the ITAR compliance requirements for exporting composite materials?"
# Claude Code automatically calls query_graph → gets enriched context → answers with neuron knowledge`}</CodeBlock>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Verify Installation</h3>
        <CodeBlock>{`# Health check
curl http://localhost:8002/health

# Check neuron count (should be ~2,031)
curl http://localhost:8002/neurons/stats | python3 -m json.tool

# Run test suite
cd backend && pytest tests/ -v`}</CodeBlock>
      </section>

      <section className="about-section">
        <h3>Project Structure</h3>
        <CodeBlock>{`yggdrasil/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, startup, migrations
│   │   ├── config.py            # Settings (scoring weights, model, etc.)
│   │   ├── database.py          # SQLAlchemy async engine + PostgreSQL pool
│   │   ├── models.py            # ORM models (Neuron, Query, Edge, etc.)
│   │   ├── schemas.py           # Pydantic request/response types
│   │   ├── routers/
│   │   │   ├── query.py         # Query execution pipeline
│   │   │   ├── neurons.py       # Neuron CRUD, tree, ego graph
│   │   │   ├── admin.py         # Seed, reset, checkpoint, health
│   │   │   ├── autopilot.py     # Autonomous gap-driven training
│   │   │   └── performance.py   # Analytics & statistical tests
│   │   ├── services/
│   │   │   ├── classifier.py    # Haiku intent classification
│   │   │   ├── scoring_engine.py # 5-signal neuron scoring
│   │   │   ├── prompt_assembler.py # Top-K token-budget packing
│   │   │   ├── executor.py      # Multi-slot execution + prepare_context()
│   │   │   ├── neuron_service.py # Neuron helpers + tree walking
│   │   │   ├── structural_resolver.py # Zero-cost deterministic fast path
│   │   │   ├── project_cache.py  # Per-project neuron relevance caching
│   │   │   └── clustering.py     # Label propagation cluster discovery
│   │   ├── mcp_server.py        # MCP stdio server (7 tools for Claude Code)
│   │   └── seed/
│   │       ├── loader.py        # YAML → neuron graph seeder
│   │       └── yggdrasil_org.yaml # Domain hierarchy (9 depts)
│   ├── tests/                   # pytest suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root component + tab routing
│   │   ├── api.ts               # Backend API client
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── components/          # All page components
│   ├── package.json
│   └── vite.config.ts
├── docs/                        # Governance, risk map, system card
├── .mcp.json                     # MCP server config for Claude Code
├── .env.example
└── CLAUDE.md`}</CodeBlock>
      </section>

      <section className="about-section">
        <h3>Configuration Reference</h3>
        <p>All settings live in <code>backend/app/config.py</code> and can be overridden via <code>.env</code>:</p>
        <table className="about-table" style={{ fontSize: '0.8rem' }}>
          <thead>
            <tr><th>Variable</th><th>Default</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            <tr><td><code>ANTHROPIC_API_KEY</code></td><td>&mdash;</td><td>Required. Anthropic API key for Haiku/Sonnet/Opus</td></tr>
            <tr><td><code>DATABASE_URL</code></td><td><code>postgresql+asyncpg://yggdrasil:yggdrasil@localhost:5432/yggdrasil</code></td><td>PostgreSQL connection string</td></tr>
            <tr><td><code>HAIKU_MODEL</code></td><td><code>claude-haiku-4-5-20251001</code></td><td>Model for classification &amp; scoring</td></tr>
            <tr><td><code>TOKEN_BUDGET</code></td><td><code>4000</code></td><td>Max tokens for assembled system prompt</td></tr>
            <tr><td><code>TOP_K_NEURONS</code></td><td><code>30</code></td><td>Neurons selected per query</td></tr>
            <tr><td><code>SPREAD_ENABLED</code></td><td><code>true</code></td><td>Enable co-firing spread activation</td></tr>
            <tr><td><code>SPREAD_MAX_HOPS</code></td><td><code>3</code></td><td>Max graph hops for spread activation</td></tr>
            <tr><td><code>CANDIDATE_LIMIT</code></td><td><code>500</code></td><td>Pre-filter cap before scoring</td></tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

function TrainingWalkthrough() {
  return (
    <>
      <section className="about-section">
        <h3>Core Concepts</h3>
        <p>Before using Yggdrasil, understand these key ideas:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
          {[
            { term: 'Neuron', desc: 'A unit of domain knowledge. Each neuron has a label, content, department, and role. Organized in a 6-layer hierarchy: Department > Role > Task > System > Decision > Output.' },
            { term: 'Firing', desc: 'When a neuron is selected for a query\'s context window. Firing history drives all 5 scoring signals.' },
            { term: '5-Signal Scoring', desc: 'Each neuron is scored by Burst (recent activity), Impact (user feedback), Precision (department relevance), Novelty (age), and Recency (last fired). Combined score determines selection.' },
            { term: 'Spread Activation', desc: 'Neurons that frequently fire together build co-firing edges. When one fires, its neighbors get a score boost — emergent knowledge pathways.' },
            { term: 'Prompt Assembly', desc: 'Top-K scored neurons are packed into a token-budgeted system prompt, then sent to the LLM alongside your question.' },
            { term: 'Autopilot', desc: 'Autonomous gap-driven training loop. Detects coverage holes, generates queries, and proposes neuron refinements.' },
          ].map(c => (
            <div key={c.term} style={{
              background: 'var(--bg-input)', borderRadius: 8, padding: '12px 16px',
            }}>
              <strong style={{ color: '#60a5fa', fontSize: '0.85rem' }}>{c.term}</strong>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: '6px 0 0', lineHeight: 1.5 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h3>Walkthrough: Your First Query</h3>

        <StepCard number={1} title="Navigate to Query Lab">
          <p>
            Click <strong>Query Lab</strong> in the top nav (under the Query group). This is where you
            interact with the neuron-enriched pipeline.
          </p>
        </StepCard>

        <StepCard number={2} title="Submit a query">
          <p>
            Type a domain-relevant question in the text box. For example:
          </p>
          <CodeBlock>{`What are the key compliance requirements for exporting
aerospace components under ITAR regulations?`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            The default slot configuration runs <strong>Haiku + Neurons</strong> — the cheapest model
            enriched with your neuron graph. Click <strong>Submit</strong>.
          </p>
        </StepCard>

        <StepCard number={3} title="Understand the response">
          <p>The result panel shows:</p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li><strong>Classification</strong> — The detected intent, departments, roles, and keywords</li>
            <li><strong>Scored neurons</strong> — Which neurons were selected and their 5-signal breakdown</li>
            <li><strong>Assembled prompt</strong> — The full system prompt sent to the LLM (expandable)</li>
            <li><strong>Response</strong> — The LLM's answer, grounded in your domain knowledge</li>
          </ul>
        </StepCard>

        <StepCard number={4} title="Rate the response">
          <p>
            Use the <strong>rate slider</strong> (0.0 to 1.0) to provide feedback. This updates
            the Impact signal for every neuron that fired — neurons that contribute to good responses
            get higher scores next time. Rating is how the system learns your quality preferences.
          </p>
        </StepCard>

        <StepCard number={5} title="Try an A/B comparison">
          <p>
            Add a second slot: click <strong>Add Slot</strong> and select a different mode (e.g., <strong>Opus Raw</strong>).
            Submit the same query. You'll see both responses side by side — this is how you validate that
            cheap-model + neurons matches or exceeds expensive-model quality.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Walkthrough: Exploring the Knowledge Graph</h3>

        <StepCard number={1} title="Open the Explorer">
          <p>
            Navigate to <strong>Knowledge &gt; Explorer</strong>. The left panel shows the neuron tree — a
            hierarchical view of all 2,000+ neurons organized by department and role.
          </p>
        </StepCard>

        <StepCard number={2} title="Browse the hierarchy">
          <p>
            Click the triangle toggles to expand departments, then roles, then tasks. Each level
            reveals more specific knowledge. The tree lazy-loads — children are fetched on expand
            for performance at scale.
          </p>
        </StepCard>

        <StepCard number={3} title="Inspect a neuron">
          <p>
            Click any neuron label. The right panel shows its full detail:
          </p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li><strong>Content</strong> — The knowledge text assembled into prompts</li>
            <li><strong>Scores</strong> — Current 5-signal values with visual bars</li>
            <li><strong>Ego Graph</strong> — Co-firing neighbors visualized as a force-directed network</li>
            <li><strong>Firing History</strong> — When this neuron was last activated</li>
          </ul>
        </StepCard>

        <StepCard number={4} title="Search and filter">
          <p>
            Use the search box to find neurons by label text, or type <code>#1234</code> to jump to a
            specific ID. Use the department dropdown to filter by organizational unit.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Walkthrough: Monitoring System Health</h3>

        <StepCard number={1} title="Dashboard overview">
          <p>
            <strong>Knowledge &gt; Dashboard</strong> shows the system's vital signs: total cost, query count,
            neuron utilization, and the <strong>Scoring Health Monitor</strong> — which tracks all 6 signal
            distributions for drift detection.
          </p>
        </StepCard>

        <StepCard number={2} title="Reading the health monitor">
          <p>
            Each signal card shows a <strong>baseline</strong> mean (blue) vs <strong>recent</strong> mean (green).
            If a signal's recent mean deviates more than 2 standard deviations from baseline, it flags
            <span style={{ color: '#ef4444', fontWeight: 600 }}> DRIFT</span> with a red alert banner.
            This means the system's scoring behavior is changing — investigate why.
          </p>
        </StepCard>

        <StepCard number={3} title="Performance deep-dive">
          <p>
            <strong>Evaluate &gt; Performance</strong> provides detailed analytics: cost modeling (Haiku+Neurons vs Opus pricing),
            quality comparisons with statistical tests (Welch's t-test, Cohen's d), reliability confidence intervals,
            and learning curve analysis.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Walkthrough: Running Autopilot</h3>

        <StepCard number={1} title="Configure autopilot">
          <p>
            Navigate to <strong>Improve &gt; Autopilot</strong>. This is the gap-driven autonomous training loop.
            It detects which areas of your knowledge graph have poor coverage, generates targeted queries,
            and proposes neuron updates or new neurons.
          </p>
        </StepCard>

        <StepCard number={2} title="Run a training cycle">
          <p>
            Click <strong>Run Now</strong> to trigger a single autopilot cycle. Watch as it:
          </p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li>Identifies coverage gaps (under-fired departments/roles)</li>
            <li>Generates domain queries targeting those gaps</li>
            <li>Proposes neuron refinements (content updates, new neurons)</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Review proposed changes before applying. The <strong>Refinements</strong> tab shows the full
            audit trail of all autopilot-driven changes.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Walkthrough: Using Yggdrasil via MCP</h3>

        <StepCard number={1} title="Ensure PostgreSQL is running">
          <p>
            The MCP server connects directly to PostgreSQL (same connection pool as the FastAPI backend).
            The backend does <strong>not</strong> need to be running &mdash; the MCP server operates independently.
          </p>
        </StepCard>

        <StepCard number={2} title="Open Claude Code in the project directory">
          <CodeBlock>{`cd ~/Projects/yggdrasil
claude`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            Claude Code automatically discovers <code>.mcp.json</code> and spawns the Yggdrasil MCP server
            as a child process using stdio transport.
          </p>
        </StepCard>

        <StepCard number={3} title="Ask domain questions naturally">
          <p>
            Just ask questions as usual. Claude Code will call <code>query_graph</code> to get neuron-enriched
            context when it determines domain knowledge would be helpful:
          </p>
          <CodeBlock>{`"What FAR clauses apply to indirect cost rate agreements?"
"How does our quality management system handle non-conforming materials?"
"What are the CMMC Level 2 requirements for access control?"`}</CodeBlock>
        </StepCard>

        <StepCard number={4} title="Explore the graph interactively">
          <p>
            Use the exploration tools to understand the knowledge structure:
          </p>
          <CodeBlock>{`"Use browse_departments to show me all departments"
"Use impact_analysis to find neurons related to ITAR"
"Use neuron_detail to inspect neuron #42"
"Use discover_clusters to find cross-department patterns"`}</CodeBlock>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Walkthrough: Evaluating Quality</h3>

        <StepCard number={1} title="Run blind evaluations">
          <p>
            After submitting a query in Query Lab, click <strong>Evaluate</strong>. This sends both the
            neuron-enriched response and a raw model response to a judge LLM. The evaluation scores
            accuracy, completeness, clarity, and faithfulness on a 1&ndash;5 scale.
          </p>
        </StepCard>

        <StepCard number={2} title="Use sample query suites">
          <p>
            <strong>Query &gt; Samples</strong> provides 3 pre-built query suites (66 total queries) for
            systematic evaluation. Run these periodically to track quality trends over time.
          </p>
        </StepCard>

        <StepCard number={3} title="Check statistical rigor">
          <p>
            The <strong>Performance</strong> page runs formal statistical tests (t-tests, effect sizes,
            reliability confidence intervals) to validate that neuron enrichment actually improves quality.
            The <strong>Methodology</strong> tab explains how each test works and what the results mean.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Operational Checklist</h3>
        <table className="about-table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr><th>Task</th><th>Frequency</th><th>Where</th></tr>
          </thead>
          <tbody>
            <tr><td>Check Scoring Health Monitor for drift</td><td>Weekly</td><td>Dashboard</td></tr>
            <tr><td>Run a sample query suite for quality tracking</td><td>Weekly</td><td>Samples</td></tr>
            <tr><td>Rate query responses for Impact signal training</td><td>Per query</td><td>Query Lab</td></tr>
            <tr><td>Run autopilot cycle for gap detection</td><td>After every 20&ndash;30 queries</td><td>Autopilot</td></tr>
            <tr><td>Review and apply refinement proposals</td><td>After autopilot</td><td>Refinements</td></tr>
            <tr><td>Create a checkpoint backup</td><td>After major changes</td><td>Explorer (Checkpoint button)</td></tr>
            <tr><td>Prune stale co-firing edges</td><td>Monthly</td><td><code>POST /admin/prune-edges</code></td></tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
