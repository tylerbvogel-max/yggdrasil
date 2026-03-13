import { useState } from 'react';

type Section = 'setup' | 'corvus' | 'training';

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
        <button
          className={section === 'corvus' ? 'active' : ''}
          style={{
            padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
            border: section === 'corvus' ? '1px solid #c87533' : '1px solid #334155',
            background: section === 'corvus' ? '#3a2510' : 'transparent',
            color: section === 'corvus' ? '#d4915a' : '#c8d0dc',
          }}
          onClick={() => setSection('corvus')}
        >
          Corvus Integration
        </button>
      </div>

      {section === 'setup' && <SetupGuide />}
      {section === 'corvus' && <CorvusSetupGuide />}
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

function CorvusSetupGuide() {
  const [checkResult, setCheckResult] = useState<{
    backend: boolean;
    extension: boolean;
    capturing: boolean;
    message: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const runHealthCheck = async () => {
    setChecking(true);
    const result = { backend: false, extension: false, capturing: false, message: '' };

    try {
      // Check 1: Is the Corvus service reachable within Yggdrasil?
      const statusRes = await fetch('/corvus/status');
      if (statusRes.ok) {
        const data = await statusRes.json();
        result.backend = true;
        result.capturing = (data.captures_stored || 0) > 0;

        // If backend is up but no captures, extension may not be sending frames
        if (!result.capturing) {
          result.message = 'Backend is running but no captures received yet. Make sure the Chrome extension is installed and you have started a capture session.';
        } else {
          result.extension = true;
          result.message = `All systems operational. ${data.captures_stored} captures stored, ${data.interpretations} interpretations generated.`;
        }
      } else {
        result.message = 'Corvus endpoint returned an error. Check that Yggdrasil is running on port 8002.';
      }
    } catch {
      result.message = 'Cannot reach Corvus. Make sure Yggdrasil is running on port 8002.';
    }

    setCheckResult(result);
    setChecking(false);
  };

  return (
    <>
      <section className="about-section">
        <h3>Overview</h3>
        <p style={{ lineHeight: 1.7, marginBottom: 12 }}>
          Corvus is a silent screen watcher that captures your screen, extracts text via OCR,
          and periodically generates AI-powered interpretations of what you're working on.
          These observations flow into Yggdrasil's neuron graph via the Observation Review pipeline.
        </p>
        <p style={{ lineHeight: 1.7 }}>
          Corvus is fully integrated into Yggdrasil — there is no separate backend to run.
          The only external component is a <strong>Chrome extension</strong> that captures screen frames
          and sends them to Yggdrasil. The extension runs in ChromeOS proper (where it can see your displays),
          while Yggdrasil handles capture processing, OCR, and AI interpretation.
        </p>
      </section>

      <section className="about-section">
        <h3>Prerequisites</h3>
        <table className="about-table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr><th>Requirement</th><th>Details</th></tr>
          </thead>
          <tbody>
            <tr><td>Chrome browser</td><td>With developer mode enabled (for sideloading the extension)</td></tr>
            <tr><td>Tesseract OCR</td><td><code>sudo apt install tesseract-ocr</code> in Crostini</td></tr>
            <tr><td>Anthropic API key</td><td>Same key used for Yggdrasil (Haiku for interpretations)</td></tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h3>Step 1: Verify Yggdrasil is Running</h3>

        <StepCard number={1} title="Ensure Yggdrasil backend is running">
          <p>
            Corvus is integrated into Yggdrasil — no separate backend needed.
            Just make sure Yggdrasil is running on port 8002:
          </p>
          <CodeBlock>{`curl http://localhost:8002/corvus/health
# Should return: {"status":"ok","service":"corvus","version":"0.3.0"}`}</CodeBlock>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Step 2: Install the Chrome Extension</h3>

        <StepCard number={4} title="Enable Chrome Developer Mode">
          <p>
            Open Chrome and navigate to <code style={{ color: '#d4915a' }}>chrome://extensions</code>.
            Toggle the <strong>Developer mode</strong> switch in the top-right corner.
          </p>
        </StepCard>

        <StepCard number={5} title="Load the extension">
          <p>
            Click <strong>"Load unpacked"</strong> and select the extension directory:
          </p>
          <CodeBlock>{`~/Projects/corvus/extension/`}</CodeBlock>
          <p style={{ marginTop: 8 }}>
            On ChromeOS, this path resolves to <code>Linux files/Projects/corvus/extension/</code>
            in the file picker. The extension should appear in your toolbar as "Corvus".
            It connects to port 8002 (Yggdrasil) for all capture and status endpoints.
          </p>
        </StepCard>

        <StepCard number={6} title="Grant permissions">
          <p>
            The extension requires these permissions:
          </p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li><strong>desktopCapture</strong> — to capture your screen</li>
            <li><strong>tabs</strong> — to open the dashboard tab</li>
            <li><strong>debugger</strong> — for the Computer Use feature (optional)</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Chrome will prompt for these when you first use each feature.
          </p>
        </StepCard>

        <StepCard number={7} title="Open the Corvus dashboard">
          <p>
            Click the Corvus icon in the Chrome toolbar. This opens the built-in dashboard
            where you can start a capture session, adjust settings, and see live interpretations.
          </p>
          <p style={{ marginTop: 8 }}>
            Access the Corvus dashboard from the Yggdrasil UI under{' '}
            <strong>Corvus &gt; Screen Watcher</strong>.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Step 3: Start Capturing</h3>

        <StepCard number={8} title="Select a screen to capture">
          <p>
            In the Corvus dashboard, click <strong>"Start Watching"</strong>. Chrome will show
            a screen picker — select the monitor or window you want Corvus to watch.
          </p>
          <p style={{ marginTop: 8 }}>
            Corvus captures frames periodically and sends them to Yggdrasil at{' '}
            <code>localhost:8002/corvus/capture</code> as JPEG data.
          </p>
        </StepCard>

        <StepCard number={9} title="Configure interpretation settings">
          <p>
            Adjust these settings in the Corvus dashboard or via the Yggdrasil Screen Watcher page:
          </p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li><strong>Effort level</strong> — Low (minimal tokens), Normal (balanced), High (detailed analysis)</li>
            <li><strong>Cadence</strong> — How often the AI interprets accumulated frames (default: every few minutes)</li>
            <li><strong>Working context</strong> — Optional text hint for what you're working on (improves relevance)</li>
            <li><strong>Crop regions</strong> — Focus on specific screen areas per app</li>
          </ul>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Step 4: Configure Enrichment</h3>

        <StepCard number={10} title="Configure Yggdrasil enrichment settings">
          <p>
            Since Corvus is integrated into Yggdrasil, observations flow into the neuron graph automatically.
            Go to <strong>Corvus &gt; Screen Watcher</strong> and click the{' '}
            <strong>Yggdrasil Link</strong> tab to control enrichment behavior:
          </p>
          <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.8 }}>
            <li><strong>Enabled</strong> — Toggle on to activate observation ingestion</li>
            <li><strong>Enrichment mode</strong> — "entities" (send on entity detection) or "always" (send every digest)</li>
            <li><strong>Project path</strong> — Your working project directory (for project-specific neuron boosting)</li>
          </ul>
        </StepCard>

        <StepCard number={11} title="Verify the observation pipeline">
          <p>
            Once Corvus generates a digest with Yggdrasil integration enabled, it will{' '}
            <code>POST</code> to <code>/ingest/observation</code>. Check the{' '}
            <strong>Corvus &gt; Observations</strong> page to see queued observations.
          </p>
          <p style={{ marginTop: 8 }}>
            From there, use <strong>Evaluate</strong> to have an LLM propose neuron actions (create, update, merge, or dismiss),
            then <strong>Apply</strong> the ones you approve. This is how screen-captured knowledge enters the graph.
          </p>
        </StepCard>
      </section>

      <section className="about-section">
        <h3>Connection Check</h3>
        <p style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Run a quick check to verify all components are connected properly.
        </p>
        <button
          className="btn"
          onClick={runHealthCheck}
          disabled={checking}
          style={{ fontSize: '0.85rem', padding: '8px 20px', marginBottom: 16 }}
        >
          {checking ? 'Checking...' : 'Run Connection Check'}
        </button>

        {checkResult && (
          <div style={{
            background: 'var(--bg-input)', borderRadius: 8, padding: '16px 20px',
            border: `1px solid ${checkResult.backend && checkResult.extension ? 'rgba(122,154,109,0.3)' : 'rgba(184,84,80,0.3)'}`,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{checkResult.backend ? '\u2705' : '\u274C'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                  Corvus (via Yggdrasil port 8002)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{checkResult.extension ? '\u2705' : '\u274C'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                  Chrome Extension (sending captures)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem' }}>{checkResult.capturing ? '\u2705' : '\u274C'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                  Captures being received
                </span>
              </div>
            </div>
            <p style={{
              fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 12,
              lineHeight: 1.6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {checkResult.message}
            </p>
          </div>
        )}
      </section>

      <section className="about-section">
        <h3>Architecture</h3>
        <CodeBlock>{`ChromeOS (Chrome Extension)          Crostini Linux VM
┌────────────────────────┐          ┌────────────────────────┐
│  desktopCapture API    │          │  Yggdrasil (port 8002) │
│  ──────────────────    │  JPEG    │                        │
│  Screen → JPEG frames  │────────→│  /corvus/capture       │
│  Audio  → WebM chunks  │  POST   │  /corvus/audio-chunk   │
└────────────────────────┘          │                        │
                                    │  OCR + Dedup + Haiku   │
                                    │  Interpretations       │
                                    │          │             │
                                    │          ↓ (internal)  │
                                    │  Classify + Queue      │
                                    │  Evaluate + Apply      │
                                    │  → Neuron Graph        │
                                    └────────────────────────┘`}</CodeBlock>
      </section>

      <section className="about-section">
        <h3>Troubleshooting</h3>
        <table className="about-table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr><th>Symptom</th><th>Cause</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Extension not visible in toolbar</td>
              <td>Not loaded or developer mode off</td>
              <td>Go to <code>chrome://extensions</code>, enable Developer mode, click "Load unpacked"</td>
            </tr>
            <tr>
              <td>"Cannot reach backend" in dashboard</td>
              <td>Yggdrasil not running on port 8002</td>
              <td>Start Yggdrasil and verify with <code>curl http://localhost:8002/corvus/health</code></td>
            </tr>
            <tr>
              <td>Captures not appearing</td>
              <td>Screen share not started</td>
              <td>Click "Start Watching" in the Corvus dashboard and select a screen</td>
            </tr>
            <tr>
              <td>No observations in Yggdrasil</td>
              <td>Enrichment not enabled</td>
              <td>Check <strong>Corvus &gt; Screen Watcher &gt; Yggdrasil Link</strong> tab</td>
            </tr>
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
