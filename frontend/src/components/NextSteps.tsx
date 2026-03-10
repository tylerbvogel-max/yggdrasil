export default function NextSteps() {
  return (
    <div className="next-steps">
      <h2>Next Steps</h2>

      <p className="next-steps-intro">
        Roadmap organized as a linear build sequence. Each phase builds on the previous.
        Role bolstering runs continuously in parallel via autopilot.
      </p>

      {/* ── Completed ── */}

      <section className="next-steps-section">
        <h3>Completed</h3>
        <span className="status-badge built">Built</span>
        <table className="next-steps-table">
          <thead>
            <tr><th>Component</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Neuron Graph</td><td>2,031-node 6-layer hierarchy (Department &rarr; Role &rarr; Task &rarr; System &rarr; Decision &rarr; Output) with 5-signal scoring (Burst, Impact, Precision, Novelty, Recency). 9 departments, 51 roles.</td></tr>
            <tr><td>Multi-Hop Spread Activation</td><td>Frontier-based BFS through co-firing graph with compounding decay (Collins &amp; Loftus 1975, SA-RAG). Up to 3 hops, max-path aggregation to prevent hub bias.</td></tr>
            <tr><td>Co-Firing Edge Graph</td><td>224,920 Hebbian edges formed when neurons fire together. Weighted by frequency. Feeds spread activation and cross-domain discovery.</td></tr>
            <tr><td>Blind A/B Evaluation</td><td>Multi-slot parallel execution, blind scoring (accuracy, completeness, clarity, faithfulness, overall), external export for ChatGPT review. BH-FDR statistical correction.</td></tr>
            <tr><td>Bolster &amp; Autopilot</td><td>LLM-proposed neuron expansion with human review (bolster) and autonomous training loop (autopilot). Source origin tracking per neuron.</td></tr>
            <tr><td>Utility Feedback</td><td>User ratings flow back to neurons via EMA. Neurons that contribute to good answers rise; bad answers sink them.</td></tr>
            <tr><td>Source-Typed Neurons</td><td>5 source types (operational, regulatory primary/interpretive, technical primary/pattern) with provenance fields: citation, effective date, source version, verification timestamp.</td></tr>
            <tr><td>External Reference Detection</td><td>Regex-based scanner for 18 regulatory families + 6 technical families. Runs on every neuron create/update. 1,129 references detected across 596 neurons.</td></tr>
            <tr><td>Emergent Queue</td><td>293 unresolved references auto-queued with detection counts, neuron tracking, and dismiss workflow. Data model and API complete; UI in Phase 2.</td></tr>
            <tr><td>PostgreSQL Migration</td><td>Migrated from SQLite/aiosqlite to PostgreSQL/asyncpg. Full async ORM layer with JSONB for scoring breakdowns, row-level locking, and production backup/restore.</td></tr>
            <tr><td>Compliance Framework</td><td>NIST AI RMF, ISO 42001, and custom AIUC-1 audit standard mapped to system components. Compliance matrix with 15+ requirements tracked across 4 statuses.</td></tr>
            <tr><td>Governance Dashboard</td><td>Live KPI monitoring: 13 metrics including cost/1M tokens, Parity Index, Value Score, eval scores, Coverage CV. AI Objectives table with targets and status.</td></tr>
            <tr><td>Evaluate Suite</td><td>4-page evaluation system: Performance (mode comparison, score radar, cost analysis), Quality (CIs, cross-validation, signal robustness), Fairness (dept coverage, eval quality, remediation), Compliance (PII scan, provenance audit, scoring baselines).</td></tr>
            <tr><td>Cost Modeling</td><td>Run cost vs training cost split. Run cost = haiku/sonnet production slots + classify overhead. Training cost = all tiers including opus benchmarks. Per-1M-token normalization.</td></tr>
            <tr><td>Input Guard</td><td>16 adversarial pattern detectors (prompt injection, jailbreak, PII exfiltration, system prompt extraction, etc.) with risk-level classification and query blocking.</td></tr>
            <tr><td>Scoring Health Monitor</td><td>Signal drift detection with coefficient of variation tracking. Per-signal distribution statistics across all queries for baseline documentation.</td></tr>
          </tbody>
        </table>
      </section>

      {/* ── Phase 1: Role Bolstering ── */}

      <section className="next-steps-section urgent">
        <h3>Phase 1 — Role Bolstering</h3>
        <span className="status-badge planned">Active / Ongoing</span>
        <p>
          Expanding all 51 roles from skeletal (5&ndash;15 neurons) to full L2&rarr;L5 depth (60&ndash;100+ neurons each).
          Runs continuously via autopilot and manual bolster sessions, in parallel with all other phases.
          Current total: <strong>2,031 neurons</strong>. Target: <strong>~3,000+</strong>.
        </p>
        <p>
          Process: <code>POST /admin/bolster</code> with Sonnet, referencing government publications,
          professional standards, and defense-specific regulations. Source material in{' '}
          <code>readables/defense-aerospace-role-resources.md</code>.
        </p>
      </section>

      {/* ── Phase 2: Authoritative Source Architecture ── */}

      <section className="next-steps-section urgent">
        <h3>Phase 2 — Authoritative Source Architecture</h3>
        <span className="status-badge planned">Next</span>
        <p>
          Completing the emergent neuron pipeline. Phase A (data model, detection, retroactive scan) is done.
          Remaining work builds the UI and ingestion workflows.
        </p>
        <p style={{ fontSize: '0.9em', color: 'var(--text-dim)' }}>
          Full spec: <code>readables/regulatory-neuron-spec.md</code><br />
          Implementation brief: <code>readables/authoritative-source-implementation-brief.md</code>
        </p>

        <h4>Phase B &mdash; Ingestion &amp; Emergent Queue UI</h4>
        <ul>
          <li><strong>Emergent Queue page</strong> &mdash; Table under Improve nav with sort/filter, acquire/dismiss actions, detection count trends, and batch operations.</li>
          <li><strong>Ingestion endpoint</strong> &mdash; <code>POST /admin/ingest-source</code> accepts source text + metadata, LLM segments into neuron proposals, content validation against source, human review (same pattern as bolster).</li>
          <li><strong>Automatic edge creation</strong> &mdash; Citation-grep on ingestion creates edges between new primary neurons and all neurons that reference them. Updates <code>external_references</code> resolution status.</li>
          <li><strong>Post-query detection</strong> &mdash; Non-blocking scan of assembled neurons after query execution, feeding unresolved references to the queue.</li>
        </ul>

        <h4>Phase C &mdash; Analytics &amp; Verification</h4>
        <ul>
          <li><strong>Source Coverage page</strong> &mdash; Gap heat map (departments &times; citation families), resolution rates over time, top unresolved references, coverage by role. Under Evaluate nav.</li>
          <li><strong>Explorer enhancements</strong> &mdash; Source type badges, citation display, external references panel with resolved/unresolved status.</li>
          <li><strong>Dashboard cards</strong> &mdash; Source neuron counts, reference resolution rate, emergent queue depth.</li>
          <li><strong>Staleness detection</strong> &mdash; Scoring penalty for unverified authoritative neurons. Verification sweep endpoint with time-based and version-gap signals.</li>
        </ul>
      </section>

      {/* ── Phase 3: Retrieval Quality ── */}

      <section className="next-steps-section">
        <h3>Phase 3 — Retrieval Quality</h3>
        <span className="status-badge planned">Planned</span>
        <p>
          Improvements to how neurons are found and assembled. Each targets a specific quality gap.
        </p>

        <h4>Structured Prompt Assembly</h4>
        <ul>
          <li><strong>Sectioned output</strong> &mdash; Replace flat text assembly with <code>## Relevant Standards</code>, <code>## Cross-References</code>, <code>## Domain Context</code>. Helps the execution model extract more from the same token budget.</li>
          <li><strong>Priority ordering</strong> &mdash; Highest-scored neurons first within each section. If the model truncates attention, critical content is already consumed.</li>
        </ul>

        <h4>RAG Layer (Semantic Retrieval)</h4>
        <ul>
          <li><strong>Embed neuron content</strong> &mdash; Vector store (Chroma, FAISS, or sqlite-vss) over all neuron <code>content</code> + <code>summary</code>. Fixes the cold-neuron problem where critical but rarely-invoked neurons get underscored by Burst/Recency.</li>
          <li><strong>Dual retrieval</strong> &mdash; Run both neuron scoring and semantic search. Neurons surfaced by RAG but missed by scoring get a relevance boost in top-K selection.</li>
          <li><strong>Incremental re-embedding</strong> &mdash; Re-embed on neuron create/update. No full rebuilds.</li>
        </ul>

        <h4>Query Decomposition</h4>
        <ul>
          <li><strong>Multi-query splitting</strong> &mdash; Complex queries decomposed into 2&ndash;3 sub-queries, each scored/assembled independently. Final pass synthesizes sub-answers. 2&ndash;3x cost but still 20x cheaper than Opus.</li>
          <li><strong>Cross-domain detection</strong> &mdash; Classifier flags queries spanning multiple departments for decomposition rather than single-pass retrieval.</li>
        </ul>

        <h4>Cross-Reference Chasing</h4>
        <ul>
          <li><strong>Follow <code>cross_ref_departments</code></strong> &mdash; When neurons fire, pull related neurons from cross-referenced departments. The field exists but scoring doesn&rsquo;t traverse these links yet.</li>
          <li><strong>Two-pass retrieval</strong> &mdash; First pass gets top-K. Second pass uses those neurons&rsquo; cross-references to re-score and pull related neurons missed in the first pass.</li>
        </ul>
      </section>

      {/* ── Phase 4: Model Routing ── */}

      <section className="next-steps-section">
        <h3>Phase 4 — Model Routing</h3>
        <span className="status-badge planned">Planned</span>
        <p>
          Tiered model escalation based on query complexity.
        </p>
        <ul>
          <li><strong>Sonnet as middle tier</strong> &mdash; Haiku classifier flags queries requiring judgment, cross-domain synthesis, or tradeoff analysis. These route to Sonnet (~6x cheaper than Opus, far more capable than Haiku for reasoning).</li>
          <li><strong>Routing criteria</strong> &mdash; Multi-department queries, comparative/evaluative intent, risk assessment, anything tagged &ldquo;needs synthesis.&rdquo;</li>
          <li><strong>Cost-conscious prompting</strong> &mdash; Sonnet system prompt optimized to reduce output tokens without sacrificing reasoning depth.</li>
        </ul>
      </section>

      {/* ── Phase 5: Graph Intelligence ── */}

      <section className="next-steps-section">
        <h3>Phase 5 — Graph Intelligence</h3>
        <span className="status-badge planned">Backlog</span>
        <p>
          Research-based extensions from graph-augmented retrieval literature.
        </p>

        <h4>Theme/Cluster Pre-Scoring</h4>
        <p><em>Based on: Cog-RAG (AAAI 2026)</em></p>
        <ul>
          <li>Score neuron clusters at the theme level before individual scoring. Prune irrelevant clusters early, reducing candidate set before per-neuron scoring.</li>
          <li>Pre-compute cluster embeddings; cosine similarity filters at query time. One vector comparison step.</li>
        </ul>

        <h4>Co-Firing Community Detection</h4>
        <p><em>Based on: GraphRAG (Microsoft, 2024) &mdash; Leiden communities</em></p>
        <ul>
          <li>Run Leiden/Louvain on co-firing graph to discover emergent groupings crossing the fixed hierarchy.</li>
          <li>Use communities for diversity floor enforcement and spread activation seeding.</li>
        </ul>

        <h4>Community-Level Summaries</h4>
        <p><em>Based on: GraphRAG (Microsoft, 2024)</em></p>
        <ul>
          <li>Pre-generate LLM summaries per community. When token budget is tight, community summaries stand in for 10&ndash;20 individual neurons.</li>
          <li>Enables &ldquo;zoom out&rdquo; mode: broad questions get summaries, narrow questions get individual neurons.</li>
        </ul>
      </section>

      {/* ── Phase 6: Maintenance & Quality ── */}

      <section className="next-steps-section">
        <h3>Phase 6 — Maintenance &amp; Quality</h3>
        <span className="status-badge planned">Partial</span>

        <h4>Microglia &mdash; Quality Scanner <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>(partial &mdash; input guard + PII scan done)</span></h4>
        <ul>
          <li><s>Prompt injection detection</s> &mdash; <strong>Done.</strong> Input guard with 16 adversarial pattern detectors, risk-level classification, and query blocking. PII scanning across all neuron fields with false-positive filtering.</li>
          <li><strong>Hallucination detection</strong> &mdash; Cross-neuron consistency checks. LLM-generated neurons (autopilot, bolster) get lower trust and more aggressive scanning.</li>
          <li><strong>Logical flaw detection</strong> &mdash; Devil&rsquo;s advocate pass on high-invocation declining-utility neurons.</li>
        </ul>

        <h4>Ependymal &mdash; Graph Hygiene <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>(partial &mdash; fairness remediation done)</span></h4>
        <ul>
          <li><s>Rebalance disproportionate departments</s> &mdash; <strong>Partial.</strong> Automated fairness remediation detects coverage gaps, quality gaps, and utilization gaps per department with severity-ranked action items. Coverage CV tracked as governance KPI.</li>
          <li><strong>Alignment Check (post-ingest hygiene)</strong> &mdash; Standalone scan triggered from Governance dashboard after large ingest batches or on schedule. Scans the full graph for:
            <ul>
              <li>Near-duplicate neurons across all parents (label similarity + content overlap), not just within one subtree</li>
              <li>Cross-department duplication where the same knowledge landed under different roles</li>
              <li>Orphaned or low-relevance neurons that lost context after graph evolution</li>
              <li>Misplaced neurons whose content better fits a different parent/department</li>
            </ul>
            Presents findings in a review UI (similar to emergent queue) with merge, re-parent, and deactivate actions. Intentionally decoupled from ingest &mdash; acquisition stays fast, hygiene runs as a separate whole-graph pass.
          </li>
          <li>Prune dead branches (zero firings over N queries)</li>
        </ul>
        <p>
          Combined into a single maintenance cycle: <code>POST /admin/maintain</code> previews actions,{' '}
          <code>POST /admin/maintain/apply</code> executes approved changes.
        </p>

        <h4>Answer Caching</h4>
        <ul>
          <li>Cache assembled prompt + response for common query patterns. Cache key on classified intent + top-K neuron IDs. Regulatory queries tend to be repetitive.</li>
        </ul>
      </section>

      {/* ── Phase 7: Advanced Architecture ── */}

      <section className="next-steps-section">
        <h3>Phase 7 — Advanced Architecture</h3>
        <span className="status-badge planned">Backlog</span>

        <h4>Local Model Routing (Classify + Score)</h4>
        <p>
          Replace the Haiku API calls in the classify &rarr; score &rarr; assemble pipeline with a locally-hosted
          open model (Llama 3.1 8B, Mistral 7B, or similar). Both stages produce structured JSON &mdash; constrained-output
          tasks that small models handle well. This makes the entire neuron selection pipeline free and removes the
          network round trip, while the final execution stage stays on Claude where generation quality matters.
        </p>
        <p>
          <strong>Integration:</strong> <a href="https://ollama.com" style={{ color: '#60a5fa' }}>Ollama</a> serves
          an OpenAI-compatible API on <code>localhost:11434</code>. A <code>local_llm_chat()</code> backend function
          routes classify/score calls locally while keeping <code>claude_chat()</code> for execution. Config flag
          to swap between local and Haiku per stage.
        </p>
        <div style={{
          background: '#1e293b', border: '1px solid var(--border)', borderRadius: 6,
          padding: '12px 16px', marginTop: 8, fontSize: '0.8rem',
        }}>
          <strong style={{ color: '#fb923c' }}>Hardware requirements for local inference:</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong>Minimum (7&ndash;8B models):</strong> Apple Silicon Mac with 16GB unified memory (M1/M2/M3/M4).
              Expect 30&ndash;50 tokens/sec, sub-second classify responses. Linux/Windows with 16GB RAM + any modern CPU also viable but slower (~10&ndash;20 tok/s).</li>
            <li><strong>Recommended (13B models):</strong> Apple Silicon with 32&ndash;36GB unified memory (M-series Pro/Max).
              Better accuracy on nuanced classifications while maintaining fast inference.</li>
            <li><strong>High-end (70B models):</strong> Apple Silicon with 64GB+ (M-series Max/Ultra) or Linux with NVIDIA GPU (24GB+ VRAM, e.g. RTX 4090).
              Overkill for classify/score but viable if serving multiple use cases.</li>
            <li><strong>Not recommended:</strong> Chromebooks, low-RAM laptops, or machines without Metal/CUDA acceleration.
              CPU-only inference on 7B models drops to ~5&ndash;10 tok/s, adding noticeable latency to every query.</li>
          </ul>
        </div>

        <h4>Connector Neurons</h4>
        <p>
          A <code>node_type: &ldquo;connector&rdquo;</code> neuron that holds an invocation spec (endpoint, query template)
          instead of prose. When selected, the execution stage calls the external system (Databricks, SQL, APIs)
          rather than passing content to the LLM. The neuron graph becomes the single routing layer for both
          knowledge retrieval and system integration.
        </p>

        <h4><s>PostgreSQL Migration</s> &mdash; Done</h4>
        <p style={{ color: '#22c55e' }}>
          Migrated to PostgreSQL with asyncpg. JSONB scoring breakdowns, row-level locking, and production backup/restore all operational.
        </p>
      </section>

      {/* ── Phase 8: Infrastructure ── */}

      <section className="next-steps-section">
        <h3>Phase 8 — Infrastructure</h3>
        <span className="status-badge planned">Backlog</span>

        <h4>Docker Containerization</h4>
        <p>
          Package the backend (FastAPI + asyncpg), PostgreSQL, and local LLM service (Ollama) into
          a <code>docker-compose.yml</code> for reproducible single-machine deploys. Eliminates environment
          setup friction and makes the project portable across machines. Natural prerequisite if Kubernetes
          orchestration is ever needed for multi-replica scaling, isolated batch workers, or zero-downtime
          rolling updates.
        </p>
      </section>

      {/* ── Knowledge Ingestion ── */}

      <section className="next-steps-section">
        <h3>Knowledge Ingestion Targets</h3>
        <span className="status-badge planned">Idea</span>
        <p>
          Large-scale corpus ingestion candidates. Each would use the authoritative source ingestion pipeline
          (Phase 2) once it&rsquo;s operational.
        </p>
        <ul>
          <li>
            <strong>MIT OCW Engineering Corpus</strong> &mdash; ~190 courses in Mechanical Engineering + Aero/Astro.
            Formula-level neurons from lecture notes and problem sets. Estimated yield: 6,000&ndash;8,000 neurons.
          </li>
          <li>
            <strong>Databricks ELT Pipelines</strong> &mdash; Delta Lake, Unity Catalog, Structured Streaming,
            Auto Loader, medallion architecture patterns from official documentation and certification materials.
          </li>
        </ul>
      </section>

      {/* ── Summary Table ── */}

      <section className="next-steps-section">
        <h3>Summary</h3>
        <table className="next-steps-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Component</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>&mdash;</td><td>Neuron graph + 5-signal scoring (2,031 neurons)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Multi-hop spread activation</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Blind A/B evaluation + BH-FDR correction</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Co-firing edge graph (224,920 edges)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Bolster + Autopilot</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Source-typed neurons + reference detection</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Emergent queue (data model + API)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>PostgreSQL migration (asyncpg + JSONB)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Compliance framework (NIST/ISO/AIUC-1)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Governance dashboard (13 live KPIs)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Evaluate suite (Performance, Quality, Fairness, Compliance)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Cost modeling (run vs training split)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Input guard (16 adversarial patterns)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Scoring health monitor + drift detection</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>1</td><td>Role bolstering (2,031 &rarr; 3,000+ neurons)</td><td><span className="status-badge planned">Active</span></td></tr>
            <tr><td>2</td><td>Emergent Queue UI + ingestion pipeline</td><td><span className="status-badge planned">Next</span></td></tr>
            <tr><td>2</td><td>Source Coverage analytics + verification</td><td><span className="status-badge planned">Next</span></td></tr>
            <tr><td>3</td><td>Structured prompt assembly</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>3</td><td>RAG layer (semantic retrieval)</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>3</td><td>Query decomposition</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>3</td><td>Cross-reference chasing</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>4</td><td>Sonnet model routing</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>5</td><td>Theme pre-scoring (Cog-RAG)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>5</td><td>Community detection (GraphRAG Leiden)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>5</td><td>Community summaries (GraphRAG)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>6</td><td>Microglia (hallucination + logical flaw detection)</td><td><span className="status-badge planned">Partial</span></td></tr>
            <tr><td>6</td><td>Ependymal (alignment check, dedup, re-parent, prune)</td><td><span className="status-badge planned">Partial</span></td></tr>
            <tr><td>6</td><td>Answer caching</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>7</td><td>Local model routing (classify + score)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>7</td><td>Connector neurons</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>8</td><td>Docker containerization (compose)</td><td><span className="status-badge planned">Backlog</span></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
