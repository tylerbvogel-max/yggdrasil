function PipelineArchitectureSVG() {
  // Colors from design system
  const c = {
    bg: '#0a0e17',
    card: '#131926',
    border: '#1e2d4a',
    text: '#ffffff',
    dim: '#8896a8',
    accent: '#38bdf8',
    green: '#22c55e',
    purple: '#a78bfa',
    orange: '#fb923c',
    red: '#ef4444',
    pink: '#f472b6',
    yellow: '#facc15',
    teal: '#2dd4bf',
  };

  const W = 760;
  const H = 820;

  // Node dimensions
  const nw = 180;  // node width
  const nh = 44;   // node height
  const r = 8;     // border radius

  // Helper: rounded rect node
  const Node = ({ x, y, label, color, sub, w, h, badge }: {
    x: number; y: number; label: string; color: string;
    sub?: string; w?: number; h?: number; badge?: string;
  }) => {
    const bw = w || nw;
    const bh = h || nh;
    return (
      <g>
        <rect x={x} y={y} width={bw} height={bh} rx={r} ry={r}
          fill={c.card} stroke={color} strokeWidth={1.5} />
        <text x={x + bw / 2} y={y + (sub ? bh / 2 - 5 : bh / 2 + 1)}
          textAnchor="middle" dominantBaseline="middle"
          fill={c.text} fontSize={11} fontWeight={600} fontFamily="Inter, sans-serif">
          {label}
        </text>
        {sub && (
          <text x={x + bw / 2} y={y + bh / 2 + 9}
            textAnchor="middle" dominantBaseline="middle"
            fill={c.dim} fontSize={9} fontFamily="Inter, sans-serif">
            {sub}
          </text>
        )}
        {badge && (
          <g>
            <rect x={x + bw - 36} y={y - 8} width={36} height={16} rx={8}
              fill={color} opacity={0.15} stroke={color} strokeWidth={0.5} />
            <text x={x + bw - 18} y={y} textAnchor="middle" dominantBaseline="middle"
              fill={color} fontSize={8} fontWeight={700} fontFamily="Inter, sans-serif">
              {badge}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Helper: arrow line
  const Arrow = ({ x1, y1, x2, y2, color, dashed }: {
    x1: number; y1: number; x2: number; y2: number;
    color?: string; dashed?: boolean;
  }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color || c.border} strokeWidth={1.5}
      strokeDasharray={dashed ? '4 3' : undefined}
      markerEnd="url(#arrowhead)" />
  );

  // Helper: curved path with arrow
  const CurvedArrow = ({ d, color, dashed }: {
    d: string; color?: string; dashed?: boolean;
  }) => (
    <path d={d} fill="none"
      stroke={color || c.border} strokeWidth={1.5}
      strokeDasharray={dashed ? '4 3' : undefined}
      markerEnd="url(#arrowhead)" />
  );

  // Layout coordinates
  const cx = W / 2;         // center X
  const queryY = 30;
  const resolverY = 100;
  const classifyY = 200;
  const scoreY = 290;
  const spreadY = 360;
  const inhibitY = 430;
  const boostY = 500;
  const assembleY = 570;
  const mcpExitY = 645;
  const executeY = 645;
  const resultsY = 720;

  // Column positions
  const leftX = cx - 100;   // left branch
  const rightX = cx + 100;  // right branch
  const farRightX = cx + 230; // MCP exit / fast path exit

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="info-section-title" style={{ marginBottom: 4 }}>Architecture Overview</h3>
      <p className="info-section-desc" style={{ marginBottom: 16 }}>
        Three access paths through the neuron graph: structural fast path (green),
        MCP context assembly (purple), and full REST execution (blue).
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{
        maxWidth: W, display: 'block', margin: '0 auto',
        background: c.bg, borderRadius: 12, border: `1px solid ${c.border}`,
      }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={c.border} />
          </marker>
          <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={c.green} />
          </marker>
          <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill={c.purple} />
          </marker>
        </defs>

        {/* ── Legend ── */}
        <g transform="translate(16, 16)">
          <line x1={0} y1={6} x2={24} y2={6} stroke={c.green} strokeWidth={2} />
          <text x={30} y={10} fill={c.dim} fontSize={9} fontFamily="Inter, sans-serif">
            Fast path (zero cost)
          </text>
          <line x1={140} y1={6} x2={164} y2={6} stroke={c.purple} strokeWidth={2} />
          <text x={170} y={10} fill={c.dim} fontSize={9} fontFamily="Inter, sans-serif">
            MCP path (context only)
          </text>
          <line x1={310} y1={6} x2={334} y2={6} stroke={c.accent} strokeWidth={2} />
          <text x={340} y={10} fill={c.dim} fontSize={9} fontFamily="Inter, sans-serif">
            REST path (full execution)
          </text>
        </g>

        {/* ── Query Input ── */}
        <Node x={cx - nw / 2} y={queryY} label="Query" sub="REST API / MCP / UI" color={c.accent} />

        {/* Arrow: Query → Resolver */}
        <Arrow x1={cx} y1={queryY + nh} x2={cx} y2={resolverY} />

        {/* ── Structural Resolver ── */}
        <Node x={cx - nw / 2} y={resolverY} label="Structural Resolver" sub="regex patterns • ~0ms" color={c.green} badge="$0" />

        {/* Fast-path exit arrow (curved right) */}
        <CurvedArrow
          d={`M ${cx + nw / 2} ${resolverY + nh / 2} C ${farRightX - 20} ${resolverY + nh / 2}, ${farRightX} ${resolverY + nh / 2 + 20}, ${farRightX} ${resolverY + 70}`}
          color={c.green} />
        {/* Fast-path exit node */}
        <Node x={farRightX - 60} y={resolverY + 72} label="Instant Response" sub="departments, stats, topics" color={c.green} w={120} badge="$0" />

        {/* Arrow: Resolver → Parallel stage (non-structural) */}
        <Arrow x1={cx} y1={resolverY + nh} x2={cx} y2={classifyY - 18} />
        <text x={cx + 8} y={resolverY + nh + 20} fill={c.dim} fontSize={8} fontFamily="Inter, sans-serif">
          non-structural
        </text>

        {/* ── Parallel: Classify + Embed ── */}
        {/* Bracket label */}
        <text x={cx} y={classifyY - 6} textAnchor="middle"
          fill={c.accent} fontSize={9} fontWeight={600} fontFamily="Inter, sans-serif"
          letterSpacing={0.5}>
          PARALLEL
        </text>

        {/* Fork lines */}
        <line x1={cx} y1={classifyY - 2} x2={leftX + nw / 2} y2={classifyY} stroke={c.border} strokeWidth={1} />
        <line x1={cx} y1={classifyY - 2} x2={rightX + nw / 2} y2={classifyY} stroke={c.border} strokeWidth={1} />

        <Node x={leftX} y={classifyY} label="Classify (Haiku)" sub="intent • depts • roles • keywords" color={c.accent} badge="~200ms" />
        <Node x={rightX} y={classifyY} label="Embed + Prefilter" sub="384-dim cosine • top-N" color={c.teal} badge="~11ms" />

        {/* Merge lines */}
        <line x1={leftX + nw / 2} y1={classifyY + nh} x2={cx} y2={scoreY} stroke={c.border} strokeWidth={1} />
        <line x1={rightX + nw / 2} y1={classifyY + nh} x2={cx} y2={scoreY} stroke={c.border} strokeWidth={1} />

        {/* ── Score ── */}
        <Node x={cx - nw / 2} y={scoreY} label="6-Signal Scoring" sub="Relevance gates 5 modulators" color={c.accent} />
        <Arrow x1={cx} y1={scoreY + nh} x2={cx} y2={spreadY} />

        {/* ── Spread ── */}
        <Node x={cx - nw / 2} y={spreadY} label="Spread Activation" sub="stellate + pyramidal edges • 3 hops" color={c.accent} />
        <Arrow x1={cx} y1={spreadY + nh} x2={cx} y2={inhibitY} />

        {/* ── Inhibit ── */}
        <Node x={cx - nw / 2} y={inhibitY} label="Inhibitory Regulation" sub="density • redundancy • cross-ref" color={c.accent} />
        <Arrow x1={cx} y1={inhibitY + nh} x2={cx} y2={boostY} />

        {/* ── Project Cache Boost ── */}
        <Node x={cx - nw / 2} y={boostY} label="Project Cache Boost" sub="1.0–1.3× for known projects" color={c.orange} badge="optional" />
        <Arrow x1={cx} y1={boostY + nh} x2={cx} y2={assembleY} />

        {/* ── Assemble ── */}
        <Node x={cx - nw / 2} y={assembleY} label="Prompt Assembly" sub="token-budgeted • dept-grouped" color={c.accent} />

        {/* ── MCP Exit (curved right from assemble) ── */}
        <CurvedArrow
          d={`M ${cx + nw / 2} ${assembleY + nh / 2} C ${farRightX - 40} ${assembleY + nh / 2}, ${farRightX - 20} ${assembleY + nh / 2 + 30}, ${farRightX - 20} ${mcpExitY}`}
          color={c.purple} />
        <Node x={farRightX - 80} y={mcpExitY} label="MCP Response" sub="system_prompt + scores JSON" color={c.purple} w={120} badge="no LLM $" />

        {/* ── REST continues to execution ── */}
        <Arrow x1={cx} y1={assembleY + nh} x2={cx} y2={executeY} color={c.accent} />
        <Node x={cx - nw / 2} y={executeY} label="LLM Execution" sub="Haiku / Sonnet / Opus" color={c.accent} />
        <Arrow x1={cx} y1={executeY + nh} x2={cx} y2={resultsY} />

        {/* ── Results ── */}
        <Node x={cx - nw / 2} y={resultsY} label="Results + Recording" sub="fire neurons • update edges • costs" color={c.accent} />

        {/* ── Cost annotations ── */}
        <g>
          {/* Brace-like annotation for the scoring block */}
          <line x1={cx - nw / 2 - 20} y1={scoreY} x2={cx - nw / 2 - 20} y2={assembleY + nh}
            stroke={c.border} strokeWidth={1} strokeDasharray="3 2" />
          <text x={cx - nw / 2 - 24} y={(scoreY + assembleY + nh) / 2}
            textAnchor="end" dominantBaseline="middle"
            fill={c.dim} fontSize={8} fontFamily="Inter, sans-serif"
            transform={`rotate(-90, ${cx - nw / 2 - 24}, ${(scoreY + assembleY + nh) / 2})`}>
            prepare_context()
          </text>
        </g>
      </svg>
    </div>
  );
}

function MCPToolMap() {
  const tools: {
    name: string; desc: string; cost: string; color: string;
    layer: 'pipeline' | 'read' | 'aggregate';
  }[] = [
    { name: 'query_graph', desc: 'Full pipeline → enriched context', cost: '~$0.00005', color: '#a78bfa', layer: 'pipeline' },
    { name: 'impact_analysis', desc: 'Semantic search by topic', cost: '$0', color: '#2dd4bf', layer: 'read' },
    { name: 'neuron_detail', desc: 'Single neuron + top edges', cost: '$0', color: '#60a5fa', layer: 'read' },
    { name: 'browse_departments', desc: 'Dept/role hierarchy', cost: '$0', color: '#60a5fa', layer: 'read' },
    { name: 'graph_stats', desc: 'Counts by layer, dept, edges', cost: '$0', color: '#22c55e', layer: 'aggregate' },
    { name: 'cost_report', desc: 'Spend, tokens, avg cost', cost: '$0', color: '#22c55e', layer: 'aggregate' },
    { name: 'discover_clusters', desc: 'Cross-dept co-firing clusters', cost: '$0', color: '#fb923c', layer: 'aggregate' },
  ];

  const layerLabels: Record<string, string> = {
    pipeline: 'Runs neuron pipeline',
    read: 'Direct DB read',
    aggregate: 'DB aggregation',
  };
  const layerColors: Record<string, string> = {
    pipeline: '#a78bfa',
    read: '#60a5fa',
    aggregate: '#22c55e',
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="info-section-title">MCP Tool Map</h3>
      <p className="info-section-desc" style={{ marginBottom: 12 }}>
        Seven tools available when Claude Code connects via MCP. Only <code style={{ color: '#a78bfa' }}>query_graph</code> touches
        the Haiku API — the other six are pure database operations at zero cost.
      </p>

      {/* Layer legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: '0.75rem' }}>
        {Object.entries(layerLabels).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: layerColors[key], flexShrink: 0,
            }} />
            <span style={{ color: '#c8d0dc' }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8,
      }}>
        {tools.map(t => (
          <div key={t.name} style={{
            background: '#131926', border: `1px solid #1e2d4a`,
            borderRadius: 10, padding: '12px 14px',
            borderLeft: `3px solid ${t.color}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <code style={{ color: t.color, fontSize: '0.8rem', fontWeight: 600 }}>{t.name}</code>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                padding: '1px 6px', borderRadius: 8,
                background: t.cost === '$0' ? '#22c55e18' : '#a78bfa18',
                color: t.cost === '$0' ? '#22c55e' : '#a78bfa',
                border: `1px solid ${t.cost === '$0' ? '#22c55e33' : '#a78bfa33'}`,
              }}>
                {t.cost}
              </span>
            </div>
            <div style={{ color: '#c8d0dc', fontSize: '0.78rem', lineHeight: 1.4 }}>
              {t.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessPathComparison() {
  const paths: {
    name: string; color: string; entry: string; exit: string;
    stages: string; cost: string; latency: string; useCase: string;
  }[] = [
    {
      name: 'Structural Fast Path',
      color: '#22c55e',
      entry: 'Any (REST, MCP, UI)',
      exit: 'After resolver',
      stages: 'Resolver only',
      cost: '$0',
      latency: '~0ms',
      useCase: '"List departments", "graph stats", "neurons about X"',
    },
    {
      name: 'MCP Context',
      color: '#a78bfa',
      entry: 'Claude Code MCP',
      exit: 'After assembly',
      stages: 'Classify → Score → Spread → Inhibit → Assemble',
      cost: '~$0.00005',
      latency: '~200ms',
      useCase: 'Domain questions where Claude Code is the executor',
    },
    {
      name: 'Full REST Execution',
      color: '#38bdf8',
      entry: 'Query Lab UI / API',
      exit: 'After LLM response',
      stages: 'Classify → Score → Spread → Inhibit → Assemble → Execute',
      cost: '$0.0001–0.05',
      latency: '1–8s',
      useCase: 'Direct answers, A/B evaluation, autopilot',
    },
  ];

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="info-section-title">Access Paths</h3>
      <p className="info-section-desc" style={{ marginBottom: 12 }}>
        Three ways into the neuron graph — each exits the pipeline at a different depth.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paths.map(p => (
          <div key={p.name} style={{
            background: '#131926', borderRadius: 10, padding: '14px 18px',
            borderLeft: `3px solid ${p.color}`,
            border: `1px solid #1e2d4a`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: p.color, fontSize: '0.9rem' }}>{p.name}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: '#1a2136', color: p.color, border: `1px solid ${p.color}44`,
                }}>
                  {p.cost}
                </span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: '#1a2136', color: '#c8d0dc', border: '1px solid #1e2d4a',
                }}>
                  {p.latency}
                </span>
              </div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '4px 16px', fontSize: '0.78rem', color: '#c8d0dc', lineHeight: 1.5,
            }}>
              <div><span style={{ color: '#8896a8' }}>Entry:</span> {p.entry}</div>
              <div><span style={{ color: '#8896a8' }}>Exit:</span> {p.exit}</div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#8896a8' }}>Stages:</span> {p.stages}
              </div>
              <div style={{ gridColumn: '1 / -1', fontStyle: 'italic', color: '#8896a8' }}>
                {p.useCase}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <div className="info-page">
      <h2 className="info-title">Neuron Pipeline</h2>
      <p className="info-subtitle">How queries flow through classification, scoring, and prompt assembly</p>

      <PipelineArchitectureSVG />
      <MCPToolMap />
      <AccessPathComparison />

      <h3 className="info-section-title" style={{ marginTop: 8 }}>Detailed Stage Walkthrough</h3>
      <p className="info-section-desc" style={{ marginBottom: 16 }}>
        Expand each stage below for implementation details.
      </p>

      <div className="flow-diagram">
        <div className="flow-step" style={{ borderLeft: '3px solid #22c55e' }}>
          <span className="flow-number" style={{ background: '#22c55e' }}>0</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Structural Resolver (Fast Path)</div>
            <div className="flow-step-desc">
              Before any API calls, a regex + keyword pattern matcher checks if the query is structural
              ("list departments", "roles in Engineering", "neurons about ITAR", "graph stats").
              If matched, the answer is built directly from the database at <strong>zero API cost</strong> and
              zero latency. Only non-structural queries proceed to the full pipeline below.
              <br /><em style={{ color: 'var(--text-dim)' }}>~0ms, deterministic — no Haiku call</em>
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">1</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Query Submitted</div>
            <div className="flow-step-desc">
              User enters a query with mode selection (neuron, raw Haiku, raw Opus).
              Multiple modes can run in parallel for blind comparison.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-group">
          <div className="flow-group-label">Stage 1 — Neuron Preparation (parallel)</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="flow-step substep">
              <span className="flow-number">2a</span>
              <div className="flow-step-content">
                <div className="flow-step-label">Classification via Haiku</div>
                <div className="flow-step-desc">
                  Haiku analyzes the query and extracts structured metadata:
                  <span className="tag intent">intent</span>{' '}
                  <span className="tag dept">departments</span>{' '}
                  <span className="tag role">role_keys</span>{' '}
                  <span className="tag keyword">keywords</span>
                  <br /><em style={{ color: 'var(--text-dim)' }}>~200ms, runs in parallel with 2b</em>
                </div>
              </div>
            </div>

            <div className="flow-step substep">
              <span className="flow-number">2b</span>
              <div className="flow-step-content">
                <div className="flow-step-label">Query Embedding + Semantic Prefilter</div>
                <div className="flow-step-desc">
                  Query is embedded via <code>all-MiniLM-L6-v2</code> (384-dim), then
                  a matrix dot product against all ~2,054 neuron embeddings selects the top-N
                  candidates by cosine similarity. No department/role filtering &mdash; the
                  embedding is the filter.
                  <br /><em style={{ color: 'var(--text-dim)' }}>~11ms, runs in parallel with 2a</em>
                </div>
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2c</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Neuron Scoring</div>
              <div className="flow-step-desc">
                Semantic candidates are scored using 6 gated signals (Relevance as stimulus gate,
                then Burst, Impact, Precision, Novelty, Recency as modulators). Classification
                output provides dept/role scoring boosts (1.25&times;/1.5&times;), not hard filters.
                Pre-computed cosine similarities from the prefilter skip redundant embedding lookups.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2d</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Spreading Activation (Typed Edges)</div>
              <div className="flow-step-desc">
                Multi-hop spread through the Hebbian co-firing graph with typed edges:
                <strong> stellate</strong> (intra-department, decay=0.3) for liberal local spread, and
                <strong> pyramidal</strong> (cross-department, min_weight=0.20) for high-confidence
                cross-domain connections. Up to 3 hops with compounding decay. Max-path aggregation
                prevents hub bias.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2e</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Inhibitory Regulation</div>
              <div className="flow-step-desc">
                3-pass biologically-inspired suppression replaces the static diversity floor:
                (1) <strong>Regional density</strong> (basket cell) &mdash; per-dept threshold + max_survivors.
                (2) <strong>Redundancy</strong> (chandelier cell) &mdash; pairwise cosine {'>'} 0.92 within dept suppresses near-duplicates.
                (3) <strong>Cross-ref floor</strong> (Martinotti cell) &mdash; guarantees minimum dept representation.
                Returns survivor_count as effective top-K.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2f</span>
            <div className="flow-step-content">
              <div className="flow-step-label">Prompt Assembly</div>
              <div className="flow-step-desc">
                Surviving neurons are assembled into a token-budgeted system prompt (configurable 1K&ndash;32K).
                Neurons are ordered by layer (L0&rarr;L5) for hierarchical context, with automatic
                fallback to summary-only when full content exceeds budget.
              </div>
            </div>
          </div>

          <div className="flow-arrow short" />

          <div className="flow-step substep">
            <span className="flow-number">2g</span>
            <div className="flow-step-content">
              <div className="flow-step-label">External Reference Detection</div>
              <div className="flow-step-desc">
                Post-assembly, assembled neurons are scanned for references to external authoritative
                sources &mdash; regulations (FAR, ITAR, NIST, MIL-STDs), technical specs (Python docs,
                PySpark APIs, framework signatures). Unresolved references are queued for future
                acquisition as <strong>emergent neurons</strong>. Non-blocking; the query proceeds immediately.
              </div>
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">3</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Parallel Execution</div>
            <div className="flow-step-desc">
              All selected modes execute concurrently. Neuron mode sends the enriched system prompt;
              raw modes send the query directly without neuron context.
            </div>
          </div>
        </div>

        <div className="flow-arrow" />

        <div className="flow-step">
          <span className="flow-number">4</span>
          <div className="flow-step-content">
            <div className="flow-step-label">Results Collected</div>
            <div className="flow-step-desc">
              Responses return with token usage and cost breakdowns.
              If multiple modes ran, blind evaluation can compare quality.
            </div>
          </div>
        </div>

        <div className="flow-step" style={{ borderLeft: '3px solid #a78bfa', marginTop: 16 }}>
          <span className="flow-number" style={{ background: '#a78bfa' }}>MCP</span>
          <div className="flow-step-content">
            <div className="flow-step-label">MCP Server Mode (Alternative Entry Point)</div>
            <div className="flow-step-desc">
              When accessed via MCP (Model Context Protocol), the pipeline stops after Stage 2f (Prompt Assembly).
              The assembled system prompt and neuron metadata are returned as JSON &mdash; no LLM execution.
              Claude Code uses the returned context directly, making its own execution decisions.
              This eliminates execution cost while preserving full neuron graph intelligence.
            </div>
          </div>
        </div>
      </div>

      <h3 className="info-section-title">Scoring Signals</h3>
      <p className="info-section-desc">
        Each neuron receives a composite score from a gated modulatory system: semantic similarity
        (the stimulus gate) must exceed threshold before 5 modulatory signals activate.
        Spreading activation through typed edges provides an additional boost.
        All time-based signals use query counts instead of tokens for stability.
      </p>

      <div className="signal-grid">
        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot burst" />
            <span className="signal-name">Burst</span>
          </div>
          <code className="signal-formula">min(1, fires / 15)</code>
          <div className="signal-desc">
            <strong>Hot hand detector.</strong> Counts firings in the last 50 queries.
            If a neuron has been useful recently, it's probably relevant now too.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot impact" />
            <span className="signal-name">Impact</span>
          </div>
          <code className="signal-formula">clamp(avg_utility, 0, 1)</code>
          <div className="signal-desc">
            <strong>User satisfaction score.</strong> When you rate a response, those ratings
            flow back to the neurons that helped produce it. Neurons that consistently
            contribute to highly-rated answers rise to the top.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot precision" />
            <span className="signal-name">Precision</span>
          </div>
          <code className="signal-formula">fires / dept_queries</code>
          <div className="signal-desc">
            <strong>Specialist accuracy.</strong> Measures how often this neuron fires
            relative to its department's total activity. Floors at 0.3 when data is scarce
            (fewer than 5 department queries).
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot novelty" />
            <span className="signal-name">Novelty</span>
          </div>
          <code className="signal-formula">max(0, 1 − age / 200)</code>
          <div className="signal-desc">
            <strong>New knowledge bonus.</strong> Age measured in query count since creation.
            Freshly created neurons get a head start so they can prove themselves
            before older neurons crowd them out.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot recency" />
            <span className="signal-name">Recency</span>
          </div>
          <code className="signal-formula">e<sup>−since_last / 500</sup></code>
          <div className="signal-desc">
            <strong>"Use it or lose it."</strong> Measured in queries since last firing.
            Neurons that haven't been activated in a while gradually fade in priority.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot relevance" />
            <span className="signal-name">Relevance</span>
          </div>
          <code className="signal-formula">matches / len(keywords)</code>
          <div className="signal-desc">
            <strong>Content match.</strong> Counts how many classified keywords appear
            in the neuron's label, summary, and content. Ensures neurons are topically
            relevant to the current query.
          </div>
        </div>

        <div className="signal-card">
          <div className="signal-header">
            <span className="signal-dot spread" />
            <span className="signal-name">Spread</span>
          </div>
          <code className="signal-formula">src × edge_w × decay</code>
          <div className="signal-desc">
            <strong>Associative recall with typed edges.</strong> After scoring, activation spreads
            through the co-firing graph up to 3 hops. <strong>Stellate</strong> edges (intra-department)
            use decay=0.3 for broader local spread. <strong>Pyramidal</strong> edges (cross-department)
            require min_weight=0.20 for proven cross-domain links. Max-path aggregation prevents hub bias.
          </div>
        </div>
      </div>
    </div>
  )
}
