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
          <div className="about-thesis-card">
            <h4 style={{ color: '#22c55e' }}>Hallucination Reduction via Front-Loaded Context</h4>
            <p>
              LLMs exhibit a well-documented <strong>&ldquo;lost in the middle&rdquo; problem</strong> &mdash; information
              at the beginning and end of the context window receives higher attention weights than information buried
              in the middle. In a long conversational exchange, early context (the original problem statement, constraints,
              domain facts) drifts into that low-attention zone as each new turn pushes it further from the edges.
              Compaction mitigates this but is lossy by definition &mdash; a summary of what was said, not the original
              precise information.
            </p>
            <p>
              Hallucination correlates directly with uncertainty. When the model lacks relevant context in its
              active attention window, it fills gaps with plausible-sounding generation drawn from parametric
              memory (training data) rather than the specific domain knowledge it was given. In a 15-turn
              conversation, the model&rsquo;s effective access to turn-2 context has degraded significantly &mdash;
              precisely when it starts &ldquo;remembering&rdquo; things from training that may conflict with
              your domain specifics.
            </p>
            <p>
              Yggdrasil&rsquo;s architecture is a deliberate bet on the opposite strategy:{' '}
              <strong>be selfish with the context window.</strong>{' '}
              Anyone who works deeply with LLMs understands that the context window is finite and it is a fight
              to get information in. Every token of context is a scarce resource &mdash; once the window fills,
              something gets pushed out or compressed. The design philosophy is intentional: rather than letting
              context accumulate organically through conversation (where relevance is accidental and degradation
              is inevitable), <strong>claim the context window upfront with the highest-value information
              available.</strong> The neuron scoring system selects the most relevant knowledge for the specific
              query, and the assembler packs it into the high-attention zone of the prompt &mdash; before any
              generation begins. The model sees everything it needs at once, in the position where attention is
              strongest, with no conversational drift to degrade access over time. The 5-signal scoring adds a
              further layer: it&rsquo;s not random context stuffing (which can dilute attention), but{' '}
              <em>relevance-ranked</em> context that concentrates the model&rsquo;s attention on what actually
              matters for this query. This is prompt insertion as a deliberate act &mdash; being selfish with
              the most valuable real estate in the LLM interaction.
            </p>
            <p>
              The tradeoff is real: a conversation <em>can</em> uncover angles you didn&rsquo;t anticipate through
              iterative clarification. But for domain-specific accuracy &mdash; regulatory compliance, engineering
              standards, procedural knowledge &mdash; the evidence favors structured retrieval before generation
              over emergent retrieval through extended dialogue. The neuron graph acts as an external memory system
              that doesn&rsquo;t degrade with conversation length: turn 20 can re-fire the graph and get the same
              quality context as turn 1.
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
            <tr><td>Backend</td><td>Python FastAPI + async SQLAlchemy + asyncpg</td></tr>
            <tr><td>Frontend</td><td>React + Vite + TypeScript</td></tr>
            <tr><td>Database</td><td>PostgreSQL (JSONB scoring breakdowns, row-level locking)</td></tr>
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
