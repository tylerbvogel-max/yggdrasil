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
          Enterprise AI adoption faces four converging risks that Yggdrasil is designed to address:
        </p>

        <div className="about-thesis-grid">
          <div className="about-thesis-card">
            <h4 style={{ color: '#ef4444' }}>Cost Exposure</h4>
            <p>
              Frontier models (Opus, GPT-4) cost 60&ndash;100x more than lightweight models (Haiku, GPT-4o-mini).
              Organizations routing every query to the most expensive model are burning budget on tasks where
              a well-contextualized cheap model produces equivalent results. Yggdrasil proves the thesis:
              <strong> structured domain knowledge + cheap model &asymp; expensive model quality at 1/60th the cost.</strong>
              {' '}Additional cost and latency mitigations include: an MCP server mode that stops after context assembly (no execution cost), a structural fast-path resolver that answers deterministic queries at zero API cost, and per-project neuron caching that avoids redundant scoring by remembering which neurons matter for each codebase.
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
          <div className="about-thesis-card">
            <h4 style={{ color: '#22c55e' }}>Hallucination Reduction via Front-Loaded Context</h4>
            <p>
              LLMs hallucinate when they lack relevant context in their active attention window &mdash; filling gaps
              with plausible-sounding generation from training data rather than domain-specific facts. The well-documented
              <strong> &ldquo;lost in the middle&rdquo; problem</strong> makes this worse in long conversations: early
              context drifts into low-attention zones as new turns accumulate.
            </p>
            <p>
              Yggdrasil&rsquo;s design philosophy: <strong>be selfish with the context window.</strong> The context
              window is finite and every token is a scarce resource. Rather than letting it fill organically through
              conversation &mdash; where relevance is accidental and degradation is inevitable &mdash;
              <strong> claim it upfront with relevance-ranked knowledge.</strong> The neuron scoring system selects
              the highest-value information for each query and packs it into the high-attention zone of the prompt
              before generation begins. This is prompt insertion as a deliberate act: the model sees everything it
              needs at once, with no conversational drift to degrade access over time. Turn 20 can re-fire the
              graph and get the same quality context as turn 1.
            </p>
          </div>
        </div>

        <h4 style={{ marginTop: 24, marginBottom: 8 }}>Evolution from Static Knowledge Files</h4>
        <p>
          Before Yggdrasil, the standard approach to giving an LLM domain knowledge was the <code>skills.md</code> pattern:
          large static markdown files loaded into the system prompt as-is. A role might have a 3,000-token file covering
          its responsibilities, procedures, and reference material &mdash; and the entire file would be injected into every
          query, regardless of whether 5% or 100% of that content was relevant.
        </p>
        <p>
          This works at small scale, but it has three structural problems that compound as knowledge grows:
        </p>
        <ul className="about-features">
          <li>
            <strong>No selectivity</strong> &mdash; Every query pays the token cost for all knowledge in the file,
            even when only a few paragraphs are relevant. At 10 roles &times; 3,000 tokens each, you&rsquo;re burning
            30K tokens of context on every query whether or not it needs aerospace manufacturing procedures alongside
            contract compliance guidance.
          </li>
          <li>
            <strong>No learning</strong> &mdash; Static files don&rsquo;t know which parts of themselves are useful.
            A paragraph that has never once improved an answer sits at the same priority as one that&rsquo;s critical
            to 80% of queries. There&rsquo;s no feedback loop between query outcomes and knowledge selection.
          </li>
          <li>
            <strong>No discovery</strong> &mdash; Static files only contain what someone explicitly wrote into them.
            They can&rsquo;t discover that two pieces of knowledge from different departments are frequently needed
            together, or that a gap exists where queries consistently get poor answers.
          </li>
        </ul>
        <p>
          Yggdrasil replaces this with <strong>active knowledge management</strong>. Instead of monolithic files,
          knowledge is decomposed into individual neurons (typically 100&ndash;300 tokens each) organized in a
          6-layer hierarchy. Instead of loading everything, the scoring engine selects only the neurons most
          relevant to each query. Instead of static priority, neurons earn their relevance through usage &mdash;
          the 5-signal scoring system tracks how often each neuron fires, how useful it has been, and how
          recently it was needed. And instead of a closed system, the co-firing graph and emergent queue
          discover relationships and gaps that no one designed.
        </p>
        <p>
          The result is that a 2,000-neuron graph with active selection outperforms a 30,000-token static file
          at a fraction of the per-query cost &mdash; because the system only pays for the knowledge that matters
          for each specific question, and it gets better at that selection with every query it processes.
        </p>
      </section>

      <section className="about-section">
        <h3>How It Works</h3>
        <p>
          Yggdrasil uses a multi-stage pipeline to enrich LLM queries with relevant organizational knowledge:
        </p>
        <ol>
          <li><strong>Embed + Classify (parallel)</strong> &mdash; Query is embedded (384-dim, ~10ms) and semantically prefiltered against all neurons (~1ms), while Haiku classifies intent/departments/roles/keywords (~200ms). Both run concurrently.</li>
          <li><strong>Score</strong> &mdash; Semantic candidates are scored with gated modulatory activation: semantic similarity (stimulus gate) enables 5 modulatory signals (Burst, Impact, Precision, Novelty, Recency). Classification provides dept/role boosts, not filters.</li>
          <li><strong>Spread + Inhibit</strong> &mdash; Multi-hop spreading activation through typed edges (stellate for intra-dept, pyramidal for cross-dept). Then 3-pass inhibitory regulation: regional density suppression, redundancy removal, and cross-department floor guarantee.</li>
          <li><strong>Assemble</strong> &mdash; Surviving neurons are packed into a token-budgeted system prompt (configurable 1K&ndash;32K)</li>
          <li><strong>Execute</strong> &mdash; The model responds with enriched context, and all results are logged for audit</li>
        </ol>
      </section>

      <section className="about-section">
        <h3>What Makes This Different</h3>

        <h4 style={{ color: '#ef4444', marginTop: 16, marginBottom: 8 }}>Tier 1 &mdash; Core Architecture (Defensible IP)</h4>
        <ul className="about-features">
          <li>
            <strong>6-Signal Gated Activation</strong> &mdash; Semantic similarity (stimulus) gates 5 modulatory signals
            (Burst, Impact, Precision, Novelty, Recency). Pre-wired via 384-dim sentence embeddings for cortical
            topography, with experience-dependent plasticity through usage. Not keyword matching &mdash; true
            conceptual similarity adapted by learned usage patterns.
          </li>
          <li>
            <strong>Multi-Hop Spread Activation</strong> &mdash; When a neuron fires, activation propagates through
            the co-firing graph to related neurons across up to 3 hops with compounding decay, discovering
            &ldquo;bridge&rdquo; entities not directly connected to the query but reachable through intermediate
            nodes. Based on spreading activation theory from cognitive science (Collins &amp; Loftus, 1975)
            and adapted for knowledge-graph RAG per SA-RAG (Pavlovi&#x107; et al., arXiv:2512.15922, 2025).
            Uses max-path aggregation (not sum) to prevent hub bias &mdash; a neuron reachable via many weak
            paths doesn&rsquo;t outrank one reachable via a single strong path.
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
        <h3>Where This Fits in Current Research</h3>
        <p>
          Yggdrasil&rsquo;s architecture independently converges with several recent academic approaches to
          graph-based retrieval-augmented generation. No single component is novel in isolation &mdash;
          the value is in the integration of these techniques into a complete, measured production system
          with blind evaluation infrastructure and statistical significance testing.
        </p>

        <table className="about-table">
          <thead>
            <tr><th>Approach</th><th>What They Do</th><th>Yggdrasil&rsquo;s Relationship</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Microsoft GraphRAG</td>
              <td>
                Auto-extracts knowledge graphs from documents using LLMs, applies Leiden community detection
                to discover hierarchical clusters, and pre-generates community summaries. Supports &ldquo;global&rdquo;
                queries (summarize the whole corpus) and &ldquo;local&rdquo; queries (reason about specific entities).
              </td>
              <td>
                Yggdrasil uses a hand-structured organizational hierarchy (6 layers: Department &rarr; Role &rarr;
                Task &rarr; System &rarr; Decision &rarr; Output) rather than auto-extracted graphs.
                This trades scalability for domain precision &mdash; the graph encodes how aerospace defense teams
                actually operate, not just what entities appear in documents. GraphRAG&rsquo;s community detection
                could be applied to Yggdrasil&rsquo;s co-firing graph to discover emergent neuron groupings that
                the hand-designed hierarchy doesn&rsquo;t capture.
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>SA-RAG <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(arXiv:2512.15922, Dec 2025)</span></td>
              <td>
                Integrates spreading activation &mdash; a cognitive science algorithm modeling how human semantic
                memory retrieves associated concepts &mdash; into knowledge-graph-based RAG. Discovers &ldquo;bridge&rdquo;
                entities not directly mentioned in the query but critical for multi-hop reasoning.
                Achieves 25&ndash;39% accuracy improvement over naive RAG on multi-hop benchmarks.
              </td>
              <td>
                Yggdrasil independently implemented spread activation through its co-firing graph before
                SA-RAG&rsquo;s publication. After reviewing SA-RAG&rsquo;s results (25&ndash;39% accuracy
                improvement from multi-hop propagation), the implementation was extended from single-hop to
                multi-hop (configurable up to 3 hops with compounding decay), enabling bridge entity discovery
                across organizational boundaries &mdash; neurons reachable only through intermediate nodes
                that connect disparate departments or knowledge domains.
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Cog-RAG <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(AAAI 2026)</span></td>
              <td>
                Uses a cognitive-inspired two-stage retrieval strategy: first activates query-relevant
                thematic content from a theme hypergraph (global context), then drills down to specific
                entities within that theme using an entity hypergraph (local details). Models high-order
                relationships via hyperedges connecting multiple entities simultaneously.
              </td>
              <td>
                Yggdrasil&rsquo;s Stage 1 classification (intent, departments, roles, keywords) serves a
                similar &ldquo;theme activation&rdquo; function, followed by individual neuron scoring. The
                classification boost (1.5&times; for role match, 1.25&times; for department match) acts as
                a coarse theme filter. Cog-RAG&rsquo;s approach suggests formalizing this into explicit
                cluster-level scoring before individual neuron ranking &mdash; score groups of neurons first,
                then only evaluate individuals within the top-scoring clusters.
              </td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Hop Count and Neuron Granularity</h4>
        <p>
          The optimal number of spread activation hops is not a universal constant &mdash; it depends on
          neuron granularity and graph density. Coarse-grained neurons (paragraph-level, 100&ndash;300 tokens
          each, as in this system) pack substantial context per node, so each promoted neuron consumes a
          significant portion of the token budget. One or two hops already surface meaningful related knowledge;
          by hop 3, promotions tend to be tangential. Fine-grained neurons (single facts or formulas at
          20&ndash;50 tokens) would benefit from more hops, since individual nodes don&rsquo;t carry enough
          context alone and need multi-hop traversal to assemble coherent clusters.
        </p>
        <p>
          Graph density is the other axis. Yggdrasil&rsquo;s co-firing graph is relatively sparse &mdash;
          edges only form when neurons actually fire together across queries, and the weight threshold
          ({'>'}0.15) prunes weak links. In a sparse graph, hop 3 may only reach a handful of additional
          nodes. In a dense graph (10K+ neurons with embedding-based edges), 3 hops could fan out to
          thousands of candidates, requiring more aggressive decay or lower hop limits.
        </p>
        <p>
          The current configuration (3 max hops, 0.5 decay, 0.15 minimum activation) is calibrated for
          ~2,000 paragraph-level neurons with sparse co-firing edges. The compounding decay
          (activation &times; edge_weight &times; 0.5 per hop) naturally prunes weak paths, and the
          early-exit condition means unused hops cost nothing. If neuron granularity shifts (e.g., the
          planned MIT OCW ingestion at formula-level detail), the hop count should increase accordingly.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>What Differentiates This System</h4>
        <p>
          The academic systems above are benchmarked against standard datasets (HotpotQA, MuSiQue,
          2WikiMultihopQA). Yggdrasil is benchmarked against its own domain queries with blind A/B
          evaluation, statistical significance testing (Benjamini-Hochberg FDR correction across 6 tests),
          effect size reporting, and power analysis. The research papers prove that graph-based RAG
          techniques work; Yggdrasil proves what they cost, how reliable they are, and whether the
          tradeoff is worth it for a specific organization &mdash; with the measurement infrastructure
          to back it up.
        </p>
        <p>
          The combination of domain-specific organizational hierarchy, multi-signal adaptive scoring,
          spread activation, token-budgeted assembly, blind evaluation, and full audit provenance in a
          single system is unusual. No individual technique is unique; the integration and measurement
          discipline is.
        </p>
      </section>

      <section className="about-section">
        <h3>Authoritative Sources &amp; Emergent Neurons</h3>
        <p>
          Not all knowledge is created equal. Yggdrasil distinguishes between three categories of knowledge,
          each with different content rules, provenance requirements, and lifecycle management:
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Source-Typed Neurons</h4>
        <table className="about-table">
          <thead>
            <tr><th>Source Type</th><th>Domain</th><th>Content Rules</th><th>Example</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Operational</td>
              <td>Both</td>
              <td>Experiential knowledge, organizational procedures. No citation required.</td>
              <td>&ldquo;When processing an export request, classify the item using USML categories&rdquo;</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Regulatory Primary</td>
              <td>Legal</td>
              <td>Verbatim regulatory text. Never LLM-paraphrased. Citation and effective date required.</td>
              <td>FAR 52.227-14 &ldquo;Rights in Data &mdash; General&rdquo;</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Regulatory Interpretive</td>
              <td>Legal</td>
              <td>Agency guidance, case holdings. Citation required. Must edge to the primary it interprets.</td>
              <td>DCAA CAM &sect;6-410.3 guidance on IR&amp;D cost allowability</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Technical Primary</td>
              <td>Technical</td>
              <td>API signatures, syntax, specs. Never LLM-paraphrased. Citation and version required.</td>
              <td><code>DataFrame.join(other, on, how)</code> &mdash; exact parameters and behavior</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Technical Pattern</td>
              <td>Technical</td>
              <td>Official guides, best practices, known gotchas. Citation recommended.</td>
              <td>SCD Type 2 pattern for Delta Lake medallion architecture</td>
            </tr>
          </tbody>
        </table>
        <p>
          The unifying principle: <strong>facts that must be assumed true because they are outside the
          system&rsquo;s control</strong>. FAR 52.227-14 says what it says. <code>DataFrame.join()</code> takes
          the parameters it takes. A paraphrased neuron is a liability if the paraphrase is wrong. These
          neurons carry full provenance &mdash; citation, source URL, effective date or version, and
          verification timestamp &mdash; and are never LLM-generated or paraphrased.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>External Reference Detection</h4>
        <p>
          Every neuron&rsquo;s content is scanned by a deterministic regex-based pattern matcher that detects
          references to external authoritative sources. The detector covers regulatory citations (FAR, DFARS,
          ITAR, EAR, CFR, NIST, MIL-STD, AS9100, ASME, ISO, SAE, OSHA, ASTM, and more) and technical
          references (Python stdlib, PySpark, SQLAlchemy, React, FastAPI, Delta Lake, Node.js). Each detected
          reference is tracked with its resolution status &mdash; whether a corresponding primary source neuron
          exists in the graph.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Emergent Neurons</h4>
        <p>
          Emergent neurons are the graph&rsquo;s third self-organizing pathway, alongside co-firing edges
          (emergent relationships) and spread activation (emergent relevance). When the reference detector
          finds a citation that no existing primary neuron resolves, that reference enters an <strong>emergent
          queue</strong> &mdash; a priority-ranked backlog of knowledge gaps the system has discovered in itself.
        </p>
        <p>
          Each time the same unresolved reference is detected across different neurons or queries, its priority
          increases. When a reference crosses a detection threshold (or a human triggers it manually), the system
          acquires the authoritative source text, segments it into neuron proposals via LLM, and presents them
          for human review &mdash; the same flow as bolster. On approval, the new neuron is created with full
          provenance, edges are automatically built to every neuron that referenced it, and those neurons&rsquo;
          external reference entries are marked resolved.
        </p>
        <p>
          The result is a graph that <strong>identifies what it doesn&rsquo;t know and grows itself at the
          point of need</strong>. Rather than pre-loading every possible regulation or API reference, the system
          maintains a core set of the most-referenced authoritative sources (~50&ndash;80 pre-loaded) and acquires
          everything else on demand as the operational neurons reveal what they actually reference. The emergent
          queue doubles as gap analytics &mdash; a self-generating map of the system&rsquo;s blind spots,
          prioritized by how frequently each gap is encountered.
        </p>

        <table className="about-table">
          <thead>
            <tr><th>Self-Organizing Pathway</th><th>Trigger</th><th>What Emerges</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Co-Firing Edges</td>
              <td>Two neurons fire together repeatedly across queries</td>
              <td>An emergent <em>relationship</em> &mdash; an association that wasn&rsquo;t designed but discovered</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Spread Activation</td>
              <td>Multi-hop traversal discovers bridge neurons</td>
              <td>An emergent <em>relevance</em> &mdash; a neuron not directly related but reachable through intermediate nodes</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Emergent Neurons</td>
              <td>Unresolved citation detected in operational content</td>
              <td>An emergent <em>node</em> &mdash; the graph grows itself where knowledge is missing</td>
            </tr>
          </tbody>
        </table>
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
        <p>Each neuron is scored using 6 signals organized into two biological categories:</p>

        <h4 style={{ color: '#22c55e', marginTop: 16, marginBottom: 8 }}>Stimulus (Depolarization)</h4>
        <p>
          The primary driver of neuron activation. Without stimulus, a neuron cannot reach activation threshold
          regardless of how strong its modulatory signals are.
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Signal</th><th>Weight</th><th>What It Measures</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className="signal-burst">Relevance</td>
              <td>50%</td>
              <td>
                <strong>Semantic similarity</strong> between the query and neuron content, computed via
                384-dimensional sentence embeddings (all-MiniLM-L6-v2). Replaces keyword matching with
                true conceptual proximity &mdash; &ldquo;BOM export to ERP&rdquo; is semantically close to
                &ldquo;CAD data integration pipeline&rdquo; even with zero shared keywords. Falls back to
                two-tier keyword matching (exact phrase + token-level with domain stop-word filtering) for
                neurons without embeddings.
              </td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ color: '#fb923c', marginTop: 16, marginBottom: 8 }}>Neuromodulatory Signals (Gain Control)</h4>
        <p>
          Modulatory signals adjust the neuron&rsquo;s sensitivity and response gain but cannot cause firing on their own.
          They are <strong>gated by relevance</strong>: full modulation requires relevance &ge; 0.3 (the gate threshold).
          Without stimulus, modulatory contribution is attenuated to 5% (spontaneous background rate).
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Signal</th><th>Weight</th><th>Biological Analogue</th><th>What It Measures</th></tr>
          </thead>
          <tbody>
            <tr><td className="signal-burst">Burst</td><td>8%</td><td>Dopamine (salience)</td><td>Firing frequency in recent query window &mdash; neurons activated repeatedly are primed</td></tr>
            <tr><td className="signal-impact">Impact</td><td>15%</td><td>Long-term potentiation</td><td>Historical utility (EMA) &mdash; neurons that consistently produce good answers strengthen</td></tr>
            <tr><td className="signal-practice">Precision</td><td>7%</td><td>Synaptic specificity</td><td>Department-level firing ratio &mdash; specialist neurons that fire within their domain</td></tr>
            <tr><td className="signal-novelty">Novelty</td><td>5%</td><td>Norepinephrine (attention)</td><td>Freshness bonus for recently created neurons &mdash; new knowledge gets exploration priority</td></tr>
            <tr><td className="signal-recency">Recency</td><td>15%</td><td>Short-term potentiation</td><td>Exponential decay since last firing &mdash; recently used neurons remain primed</td></tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h3>The Cold Start Problem: From Newborn Brain to Trained Network</h3>
        <p>
          A genuinely interesting challenge emerged during development: <strong>an untrained biomimetic neuron model
          defaults to basic RAG.</strong> This is not a design flaw &mdash; it is an accurate reproduction of what
          happens with a blank neural slate.
        </p>
        <p>
          In the early stages (~200 queries across 2,000 neurons), every neuron had essentially identical history:
          same impact scores (0.5 default), same recency (all fired during batch ingestion), similar burst patterns.
          The 6-signal scoring architecture was fully wired &mdash; synaptic plasticity (impact EMA), Hebbian
          learning (co-firing edges), neuromodulation (burst/recency), spreading activation &mdash; but with no
          differential experience to work with. The only signal creating any discrimination was keyword matching,
          which meant the system was functionally equivalent to string-match RAG with extra steps.
        </p>
        <p>
          <strong>Biological analogy:</strong> a fruit fly larva has ~3,000 neurons, and at least those have been
          pre-shaped by millions of generations of evolutionary selection pressure. Yggdrasil&rsquo;s 2,000 neurons
          had no such evolutionary history &mdash; they were born with identical synaptic weights and no experience.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Evolutionary Pre-Wiring: Cortical Topography via Embeddings</h4>
        <p>
          The solution draws from how biological brains are pre-wired at birth. Real neural circuits don&rsquo;t start
          from a blank slate &mdash; evolution encodes structural priors through genetic programs that wire functionally
          related neurons together before the organism opens its eyes. The visual cortex is already connected to the
          visual thalamus. The motor cortex already has topographic maps of the body.
        </p>
        <p>
          Yggdrasil replicates this with <strong>semantic embeddings as cortical topography</strong>. Every neuron&rsquo;s
          content is encoded into a 384-dimensional vector using a sentence transformer model. These vectors define
          each neuron&rsquo;s position in semantic space &mdash; a topographic map where neurons encoding similar
          concepts are &ldquo;spatially&rdquo; proximate. When a query arrives, its embedding is compared against all
          candidate neuron embeddings via cosine similarity, producing a continuous relevance score that captures
          conceptual relatedness rather than lexical overlap.
        </p>
        <p>
          This transforms the relevance signal from binary keyword matching (stimulus or no stimulus) into a gradient
          that reflects genuine semantic proximity. &ldquo;BOM export to ERP system&rdquo; is recognized as related to
          &ldquo;batch file ingestion pipeline&rdquo; and &ldquo;REST API extraction patterns&rdquo; even though they
          share no keywords. The 5 modulatory signals then operate on top of this semantic foundation, amplifying
          neurons that have proven useful (impact), are currently primed (burst/recency), or specialize in the
          relevant domain (precision).
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>The Gated Activation Model</h4>
        <p>
          A critical design choice: relevance acts as a <strong>gate</strong> on the modulatory signals, not just an
          additive component. Without this, a neuron with high burst + high recency + high impact but zero relevance
          could outscore a genuinely relevant neuron with moderate modulatory signals. This is biologically
          wrong &mdash; neuromodulators (dopamine, norepinephrine) adjust sensitivity but cannot cause an action
          potential without sufficient depolarization from the primary stimulus (glutamate).
        </p>
        <p>
          The scoring formula splits into stimulus and gated modulation:
        </p>
        <pre className="about-tree">{`combined = stimulus + (modulatory × gate)

  stimulus  = weight_relevance × relevance
  modulatory = Σ(weight_i × signal_i) for burst, impact, precision, novelty, recency
  gate = clamp(relevance / threshold, floor, 1.0)
         where threshold = 0.3, floor = 0.05`}</pre>
        <p>
          A neuron with zero semantic relevance gets only 5% of its modulatory potential (spontaneous background
          activity). A neuron with even weak relevance (0.15) gets ~50% modulation, and anything above the
          threshold (0.3) receives full modulation. This creates clean separation between relevant and irrelevant
          neurons while preserving the modulatory signals&rsquo; ability to amplify and rank within the relevant set.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Why This Matters Beyond Yggdrasil</h4>
        <p>
          The insight that an untrained neural scoring model defaults to RAG, and that evolutionary pre-wiring via
          embeddings is the solution, has implications for any system that attempts to grow prompt context strategies
          through usage. The pattern is general:
        </p>
        <ul className="about-features">
          <li>
            <strong>Cold start = RAG</strong> &mdash; Any adaptive retrieval system without differential experience
            can only discriminate on surface-level text matching, which is what RAG does. The architecture for
            learning is present but inert.
          </li>
          <li>
            <strong>Embeddings = evolutionary priors</strong> &mdash; Pre-computed semantic vectors give the system
            &ldquo;innate&rdquo; understanding of concept relationships, analogous to the genetic programs that
            pre-wire biological neural circuits. This bootstraps the system past the RAG-equivalent phase.
          </li>
          <li>
            <strong>Usage signals = lived experience</strong> &mdash; As the system processes more queries, the
            modulatory signals (impact, burst, recency, co-firing edges) differentiate from their initial flat
            state. Neurons that consistently contribute to good answers strengthen. Neurons that fire together
            develop associative edges. The system evolves from &ldquo;pre-wired infant&rdquo; to
            &ldquo;experienced practitioner&rdquo; through use.
          </li>
          <li>
            <strong>Gated modulation = biological plausibility</strong> &mdash; Without gating, the modulatory
            signals create noise that overwhelms the semantic signal. With gating, the system accurately reproduces
            the biological principle that neuromodulators can only amplify, not initiate, activation.
          </li>
        </ul>
        <p>
          The progression from RAG &rarr; pre-wired &rarr; experience-adapted is not a workaround for a missing
          feature &mdash; it is the natural development trajectory of any biomimetic retrieval system that takes
          the biological analogy seriously. The fact that it mirrors real neural development (genetic pre-wiring
          at birth, then experience-dependent plasticity) is evidence that the underlying architecture is sound.
        </p>
      </section>

      <section className="about-section">
        <h3>Application Stack</h3>
        <table className="about-table">
          <thead>
            <tr><th>Component</th><th>Technology</th></tr>
          </thead>
          <tbody>
            <tr><td>Backend</td><td>Python FastAPI + async SQLAlchemy + asyncpg</td></tr>
            <tr><td>Frontend</td><td>React + Vite + TypeScript</td></tr>
            <tr><td>Database</td><td>PostgreSQL (JSONB scoring breakdowns, row-level locking)</td></tr>
            <tr><td>LLM Provider</td><td>Anthropic API (Claude Haiku / Sonnet / Opus)</td></tr>
            <tr><td>Embeddings</td><td>sentence-transformers/all-MiniLM-L6-v2 (384-dim, local CPU inference)</td></tr>
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
          <li><strong>Emergent Queue</strong> &mdash; Unresolved citation tracker with acquire workflow (paste source &rarr; LLM segments into proposals &rarr; review &rarr; create neurons)</li>
          <li><strong>Explorer</strong> &mdash; Browse and inspect the full neuron tree with scoring details</li>
          <li><strong>Dashboard</strong> &mdash; Visualize neuron health, firing patterns, and role coverage</li>
          <li><strong>Governance</strong> &mdash; Live KPI dashboard with 13 metrics: Parity Index, Value Score, run/training cost split, eval scores, Coverage CV, and more</li>
          <li><strong>Evaluate Suite</strong> &mdash; Performance (mode comparison, cost analysis), Quality (CIs, cross-validation), Fairness (dept coverage, remediation), Compliance (PII, provenance, baselines)</li>
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
              <td>PostgreSQL</td>
              <td><code>pg_dump</code> to Google Drive &mdash; alternates between <code>backup_a.sql</code> and <code>backup_b.sql</code></td>
              <td>Every 2 weeks (Sunday 3am)</td>
            </tr>
            <tr>
              <td>GitHub</td>
              <td>JSON neuron checkpoint committed and pushed to remote</td>
              <td>Every 2 weeks (same schedule)</td>
            </tr>
            <tr>
              <td>Local</td>
              <td>PostgreSQL database (always current, WAL-based recovery)</td>
              <td>Live</td>
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
      database.py        # SQLAlchemy engine (asyncpg)
      models.py          # Neuron, Query, NeuronFiring, EmergentQueue, etc.
      schemas.py         # Pydantic request/response schemas
      scoring.py         # 5-signal neuron scoring engine
      routers/
        neurons.py       # Tree, detail, stats, edges endpoints
        query.py         # Query, evaluate, refine pipeline
        admin.py         # Seed, checkpoint, compliance, governance, ingest
        autopilot.py     # Autonomous training loop
      services/
        claude_cli.py    # Claude CLI wrapper (subprocess)
        reference_detector.py  # Regex-based citation scanner
        reference_hooks.py     # External reference population
        gap_detector.py        # Emergent queue + gap detection
      seed/
        yggdrasil_org.yaml  # Neuron tree definition
        loader.py           # YAML seed loader
    checkpoints/         # JSON neuron snapshots (git-tracked)
    backup.sh            # Automated backup script
  frontend/
    src/
      App.tsx            # Tab navigation shell
      api.ts             # Backend API client
      types.ts           # TypeScript type definitions
      hooks/             # Shared data hooks (useComplianceAudit, etc.)
      components/        # Page components (Explorer, Dashboard, etc.)
    dist/                # Built frontend (served by FastAPI)`}</pre>
      </section>
    </div>
  );
}
