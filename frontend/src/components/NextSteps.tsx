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
            <tr><td>Neuron Graph</td><td>1,800+-node 6-layer hierarchy (Department &rarr; Role &rarr; Task &rarr; System &rarr; Decision &rarr; Output) with 5-signal scoring (Burst, Impact, Precision, Novelty, Recency)</td></tr>
            <tr><td>Multi-Hop Spread Activation</td><td>Frontier-based BFS through co-firing graph with compounding decay (Collins &amp; Loftus 1975, SA-RAG). Up to 3 hops, max-path aggregation to prevent hub bias.</td></tr>
            <tr><td>Co-Firing Edge Graph</td><td>Hebbian edges form when neurons fire together. Weighted by frequency. Feeds spread activation and cross-domain discovery.</td></tr>
            <tr><td>Blind A/B Evaluation</td><td>Multi-slot parallel execution, blind scoring (accuracy, completeness, clarity, faithfulness, overall), external export for ChatGPT review. BH-FDR statistical correction.</td></tr>
            <tr><td>Bolster &amp; Autopilot</td><td>LLM-proposed neuron expansion with human review (bolster) and autonomous training loop (autopilot). Source origin tracking per neuron.</td></tr>
            <tr><td>Utility Feedback</td><td>User ratings flow back to neurons via EMA. Neurons that contribute to good answers rise; bad answers sink them.</td></tr>
            <tr><td>Source-Typed Neurons</td><td>5 source types (operational, regulatory primary/interpretive, technical primary/pattern) with provenance fields: citation, effective date, source version, verification timestamp.</td></tr>
            <tr><td>External Reference Detection</td><td>Regex-based scanner for 18 regulatory families + 6 technical families. Runs on every neuron create/update. 1,129 references detected across 596 neurons.</td></tr>
            <tr><td>Emergent Queue</td><td>293 unresolved references auto-queued with detection counts, neuron tracking, and dismiss workflow. Data model and API complete; UI in Phase 2.</td></tr>
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
          Current total: <strong>1,800+ neurons</strong>. Target: <strong>~3,000+</strong>.
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
        <span className="status-badge planned">Backlog</span>

        <h4>Microglia &mdash; Quality Scanner</h4>
        <ul>
          <li><strong>Prompt injection detection</strong> &mdash; Periodic scan for content that attempts to override system behavior. Quarantine, don&rsquo;t delete.</li>
          <li><strong>Hallucination detection</strong> &mdash; Cross-neuron consistency checks. LLM-generated neurons (autopilot, bolster) get lower trust and more aggressive scanning.</li>
          <li><strong>Logical flaw detection</strong> &mdash; Devil&rsquo;s advocate pass on high-invocation declining-utility neurons.</li>
        </ul>

        <h4>Ependymal &mdash; Graph Hygiene</h4>
        <ul>
          <li>Merge near-duplicate neurons (cosine similarity on content embeddings)</li>
          <li>Re-parent misplaced neurons, rebalance disproportionate departments</li>
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

        <h4>Deterministic Query Classification</h4>
        <p>
          Replace Haiku classifier with a local model to make the entire selection pipeline LLM-free.
          Currently costs ~$0.00005/call and adds 300&ndash;500ms latency. Matters at high volume,
          low latency, or air-gapped deployment. Candidates: TF-IDF/BM25, local sentence-transformer (~30MB).
          Keep the <code>classify_query()</code> interface swappable.
        </p>

        <h4>Connector Neurons</h4>
        <p>
          A <code>node_type: &ldquo;connector&rdquo;</code> neuron that holds an invocation spec (endpoint, query template)
          instead of prose. When selected, the execution stage calls the external system (Databricks, SQL, APIs)
          rather than passing content to the LLM. The neuron graph becomes the single routing layer for both
          knowledge retrieval and system integration.
        </p>

        <h4>PostgreSQL Migration</h4>
        <p>
          Swap <code>aiosqlite</code> for <code>asyncpg</code>. The ORM layer is already database-agnostic.
          Triggered by concurrent write needs or shared infrastructure deployment. Enables JSONB for scoring
          breakdowns, row-level locking, and production backup/restore.
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
            <tr><td>&mdash;</td><td>Neuron graph + 5-signal scoring</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Multi-hop spread activation</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Blind A/B evaluation + external export</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Co-firing edge graph</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Bolster + Autopilot</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Source-typed neurons + reference detection</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Emergent queue (data model + API)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>1</td><td>Role bolstering (~1,800 &rarr; 3,000+ neurons)</td><td><span className="status-badge planned">Active</span></td></tr>
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
            <tr><td>6</td><td>Microglia (quality scanner)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>6</td><td>Ependymal (graph hygiene)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>6</td><td>Answer caching</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>7</td><td>Deterministic classifier</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>7</td><td>Connector neurons</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>7</td><td>PostgreSQL migration</td><td><span className="status-badge planned">When Needed</span></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
