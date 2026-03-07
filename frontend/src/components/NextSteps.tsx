export default function NextSteps() {
  return (
    <div className="next-steps">
      <h2>Next Steps</h2>
      <p className="next-steps-intro">
        Extending the neuron graph beyond non-deterministic knowledge — mapping biological glial cell
        types to system capabilities, and closing the quality gap between haiku+neurons and raw opus.
      </p>

      <section className="next-steps-section urgent">
        <h3>Role Bolstering — In Progress</h3>
        <span className="status-badge planned">Active</span>
        <p>
          Expanding all 51 roles from skeletal (5-15 neurons) to full L2→L5 depth (60-100+ neurons each),
          using defense/aerospace reference standards as source material. Current total: <strong>1,769 neurons</strong> (up from 1,336).
          Target: <strong>~3,000+ neurons</strong>.
        </p>

        <h4>Completed Roles (at or near target depth)</h4>
        <ul>
          <li><strong>VP Strategy</strong> — 97 neurons, full L1→L5 (reference quality bar)</li>
          <li><strong>CEO</strong> — 74 neurons, 12 L2 / 18 L3 / 14 L4 / 29 L5</li>
          <li><strong>BD Director</strong> — 73 neurons, full depth with Shipley BD lifecycle</li>
          <li><strong>Capture Manager</strong> — 64 neurons, full depth with gate reviews</li>
          <li><strong>Quality Manager</strong> — 62 neurons (needs more L4/L5)</li>
          <li><strong>Production Manager</strong> — 60 neurons, full depth</li>
          <li><strong>Facilities Manager</strong> — 49 neurons, full depth</li>
          <li><strong>Data Engineer</strong> — 251 neurons (Databricks ELT subtree)</li>
          <li><strong>Manufacturing Engineer</strong> — 124 neurons</li>
          <li><strong>Industrial Engineer</strong> — 167 neurons</li>
          <li><strong>Program Manager</strong> — 78 neurons (needs more L5 outputs)</li>
        </ul>

        <h4>Partially Bolstered (L2 skeleton in place, need L3/L4/L5 depth)</h4>
        <ul>
          <li><strong>CFO</strong> — 39 neurons (12 L2 tasks done, 7 new ones need L3/L4/L5)</li>
          <li><strong>CTO</strong> — 17 neurons (10 L2 tasks done, 8 new ones need depth)</li>
          <li><strong>VP BD</strong> — 36 neurons (11 L2 / 19 L3, needs more L4/L5)</li>
          <li><strong>VP Engineering</strong> — 15 neurons (11 L2 tasks done, need L3/L4/L5)</li>
          <li><strong>VP Operations</strong> — 21 neurons (needs L3/L4/L5 expansion)</li>
          <li><strong>COO</strong> — 15 neurons (needs more L2 tasks and depth)</li>
          <li><strong>Contracts Manager</strong> — 16 neurons (10 L2, needs L3/L4/L5)</li>
          <li><strong>Export Control Officer</strong> — 18 neurons (11 L2, needs depth)</li>
          <li><strong>Proposal Manager</strong> — 18 neurons (11 L2, needs depth)</li>
          <li><strong>Cost Estimator</strong> — 39 neurons (31 L3s but no L4/L5)</li>
          <li><strong>Financial Analyst</strong> — 30 neurons (needs more L4/L5)</li>
          <li><strong>FAR/DFARS</strong> — 27 neurons (needs L4/L5)</li>
          <li><strong>AS9100 Rev D</strong> — 39 neurons (needs more L4/L5)</li>
          <li><strong>ASME Y14.5</strong> — 24 neurons (needs more depth)</li>
          <li><strong>MIL-STD Series</strong> — 23 neurons (needs depth)</li>
          <li><strong>DO Standards</strong> — 20 neurons (needs depth)</li>
        </ul>

        <h4>Still Skeletal (need full buildout from L2 through L5)</h4>
        <ul>
          <li><strong>Engineering:</strong> Electrical (9), Mechanical (12), Software (9), Systems (9), Test (9)</li>
          <li><strong>Contracts:</strong> Contract Analyst (19), FAR Specialist (10), Quality Auditor (14), Safety Officer (14)</li>
          <li><strong>Finance:</strong> Cost Accountant (23)</li>
          <li><strong>Admin:</strong> HR Generalist (9), IT Support (9), Payroll (5), Procurement (5)</li>
          <li><strong>Supply Chain Manager</strong> — 15 neurons</li>
          <li><strong>Program Control Analyst</strong> — 12 neurons (9 L3s but no L4/L5)</li>
          <li><strong>Regulatory:</strong> NADCAP (12), NAS 410 (6), NIST/CMMC (7), OSHA (8), ISO (6), SAE AS6500 (7), ITAR/EAR (16), ASTM (8)</li>
        </ul>

        <h4>Bolster Process</h4>
        <p>
          Each role is bolstered using the <code>POST /admin/bolster</code> API with Sonnet, referencing
          government publications (DoD, NASA, FAA, NIST), professional standards (PMI, ASQ, INCOSE, SAE),
          and defense-specific regulations (FAR/DFARS, MIL-STDs, ITAR, CMMC). Source material compiled in{' '}
          <code>readables/defense-aerospace-role-resources.md</code>. Process documented in{' '}
          <code>BOLSTER_GUIDE.md</code>.
        </p>
      </section>

      <section className="next-steps-section urgent">
        <h3>Tier 1 — High Impact, Low Cost</h3>
        <span className="status-badge planned">Priority</span>
        <p>
          Improvements that close the haiku+neurons vs opus quality gap with minimal cost increase.
          Estimated gap closure: <strong>60-70% → 80%</strong> of opus quality at ~1x current cost.
        </p>

        <h4>RAG Layer (Semantic Retrieval)</h4>
        <ul>
          <li>
            <strong>Embed neuron content into vector store</strong> — Embed all neuron{' '}
            <code>content</code> + <code>summary</code> fields (Chroma, FAISS, or sqlite-vss).
            Fixes cold-neuron problem where critical but rarely-invoked neurons get underscored
            by Burst/Recency signals.
          </li>
          <li>
            <strong>Dual retrieval at query time</strong> — Run both neuron scoring pipeline and
            semantic similarity search. Merge results — neurons surfaced by RAG but missed by scoring
            get a "semantic relevance boost" in the final top-K selection.
          </li>
          <li>
            <strong>Embedding maintenance</strong> — Re-embed on neuron create/update (autopilot,
            bolster, manual edits). Incremental, not full rebuild.
          </li>
        </ul>

        <h4>Prompt Assembly Structure</h4>
        <ul>
          <li>
            <strong>Structured sections</strong> — Replace flat text assembly with clear
            hierarchy: <code>## Relevant Standards</code>, <code>## Cross-References</code>,{' '}
            <code>## Domain Context</code>. Helps Haiku extract more from the same token budget.
          </li>
          <li>
            <strong>Priority ordering</strong> — Highest-scored neurons first within each section.
            If Haiku truncates attention, critical content is already consumed.
          </li>
        </ul>

        <h4>Query Decomposition</h4>
        <ul>
          <li>
            <strong>Multi-query splitting</strong> — Complex queries get decomposed by Haiku into
            2-3 sub-queries, each scored/assembled independently. Final Haiku pass synthesizes
            sub-answers. Adds 2-3x cost but still 20x cheaper than opus.
          </li>
          <li>
            <strong>Cross-domain detection</strong> — Classifier flags queries spanning multiple
            departments (e.g., "how does ITAR affect NADCAP audit scope for a foreign subsidiary?")
            for decomposition rather than single-pass retrieval.
          </li>
        </ul>
      </section>

      <section className="next-steps-section">
        <h3>Tier 2 — Medium Impact, Still Cheap</h3>
        <span className="status-badge planned">Planned</span>
        <p>
          Estimated gap closure: <strong>80% → 90%</strong> of opus quality at 3-5x current cost
          (still 12-20x cheaper than raw opus).
        </p>

        <h4>Sonnet as Middle Tier</h4>
        <ul>
          <li>
            <strong>Synthesis routing</strong> — Haiku classifier flags queries requiring judgment,
            cross-domain synthesis, or tradeoff analysis. These route to Sonnet instead of Haiku
            for execution. Sonnet is ~6x cheaper than Opus but far more capable than Haiku for
            reasoning tasks.
          </li>
          <li>
            <strong>Cost-conscious prompting</strong> — Sonnet system prompt includes
            "Be precise and concise. Prioritize accuracy over elaboration." to reduce output tokens
            (the expensive side at $15/M) without sacrificing reasoning depth.
          </li>
          <li>
            <strong>Routing criteria</strong> — Multi-department queries, comparative/evaluative
            intent, risk assessment, anything the classifier tags as "needs synthesis."
          </li>
        </ul>

        <h4>Cross-Reference Chasing</h4>
        <ul>
          <li>
            <strong>Follow <code>cross_ref_departments</code> links</strong> — When neurons fire,
            pull related neurons from cross-referenced departments. The field exists but scoring
            doesn't currently traverse these links.
          </li>
          <li>
            <strong>Two-pass retrieval</strong> — First pass gets top-K neurons. Second pass uses
            those neurons' cross-references and parent chains to re-score and pull related neurons
            missed in the first pass. Catches cross-domain connections that single-pass misses.
          </li>
        </ul>
      </section>

      <section className="next-steps-section">
        <h3>Research-Based Extensions</h3>
        <span className="status-badge planned">Backlog</span>
        <p>
          Improvements identified from recent graph-augmented retrieval research. Multi-hop spread activation
          (from SA-RAG) has already been implemented. The following three extensions are candidates for future work.
        </p>

        <h4>Theme/Cluster Pre-Scoring</h4>
        <p>
          <em>Based on: Cog-RAG (AAAI 2026) — cognitive-inspired dual-hypergraph retrieval</em>
        </p>
        <ul>
          <li>
            <strong>Concept</strong> — Before scoring individual neurons, score neuron clusters (grouped by
            role_key, department, or discovered community) at the theme level. Clusters whose theme doesn't
            match the query intent get pruned early, reducing the candidate set before expensive per-neuron
            scoring runs.
          </li>
          <li>
            <strong>Benefit</strong> — Reduces noise from topically irrelevant neurons that happen to have high
            Burst or Recency signals. Analogous to how Cog-RAG's theme-level hyperedges filter before
            document-level retrieval.
          </li>
          <li>
            <strong>Implementation sketch</strong> — Pre-compute cluster embeddings (average of member neuron
            content embeddings). At query time, compute cosine similarity between query embedding and cluster
            embeddings. Only score neurons from top-N clusters. Lightweight — adds one vector comparison step.
          </li>
        </ul>

        <h4>Co-Firing Community Detection</h4>
        <p>
          <em>Based on: GraphRAG (Microsoft, 2024) — Leiden community detection on entity graphs</em>
        </p>
        <ul>
          <li>
            <strong>Concept</strong> — Run Leiden or Louvain community detection on the NeuronEdge co-firing
            graph to discover emergent neuron groupings that cross the fixed hierarchy. Neurons that frequently
            fire together across different queries form natural communities, even if they sit in different
            departments or roles.
          </li>
          <li>
            <strong>Benefit</strong> — Surfaces cross-domain relationships that the hand-built hierarchy misses.
            A community of neurons spanning Quality, Engineering, and Contracts might emerge around "first article
            inspection" — something the tree structure can't represent but the co-firing data reveals.
          </li>
          <li>
            <strong>Implementation sketch</strong> — Periodically run Leiden on NeuronEdge weights using{' '}
            <code>python-igraph</code> or <code>networkx</code>. Store community assignments as a neuron field.
            Use communities as an alternative grouping for diversity floor enforcement and spread activation
            seeding. Could also feed into theme/cluster pre-scoring above.
          </li>
        </ul>

        <h4>Community-Level Summaries</h4>
        <p>
          <em>Based on: GraphRAG (Microsoft, 2024) — hierarchical community summarization</em>
        </p>
        <ul>
          <li>
            <strong>Concept</strong> — Pre-generate LLM summaries for each detected community (or for each
            role/department cluster). These summaries capture the collective knowledge of a group of neurons
            in a single compressed representation.
          </li>
          <li>
            <strong>Benefit</strong> — When the token budget is tight, a community summary can stand in for
            10-20 individual neurons at a fraction of the token cost. Enables a "zoom out" mode: broad
            questions get community summaries, narrow questions get individual neurons, with graceful
            degradation as budget shrinks.
          </li>
          <li>
            <strong>Implementation sketch</strong> — After community detection, batch-generate summaries via
            Haiku (one prompt per community: "Summarize the following knowledge areas: [neuron contents]").
            Store summaries in a <code>NeuronCommunity</code> table. At assembly time, if the token budget
            can't fit all selected neurons, substitute community summaries for the lowest-scored clusters.
            Re-generate summaries when community membership changes significantly.
          </li>
        </ul>
      </section>

      <section className="next-steps-section">
        <h3>Tier 3 — Structural Improvements</h3>
        <span className="status-badge planned">Planned</span>
        <p>
          Deeper graph-level changes for long-term quality gains.
        </p>
        <ul>
          <li>
            <strong>Neuron relationship fields</strong> — Add explicit "see also" /
            "related" links between neurons across departments. Makes the graph function as
            a true graph rather than a forest of trees. Populated via autopilot or manual curation.
          </li>
          <li>
            <strong>Answer caching</strong> — Cache assembled prompt + response for common query
            patterns. Regulatory queries tend to be repetitive. Cache key on classified intent +
            top-K neuron IDs.
          </li>
          <li>
            <strong>Neuron content enrichment</strong> — Add structured metadata: applicability
            conditions, common misconceptions, related standards, decision criteria. Goes beyond
            prose content to give Haiku more structured reasoning material.
          </li>
        </ul>
      </section>

      <section className="next-steps-section">
        <h3>Deterministic Process Neurons</h3>
        <p>
          Add a <code>node_type: "connector"</code> neuron subtype that holds a structured invocation
          spec (endpoint, query template, credentials ref) instead of prose content. When the scoring
          pipeline selects a connector neuron, the execution stage calls the external system (Databricks,
          SQL, APIs) rather than passing content to the LLM. The neuron graph remains the single routing
          layer — it just dispatches differently based on type.
        </p>
      </section>

      <section className="next-steps-section">
        <h3>Deterministic Query Classification</h3>
        <span className="status-badge planned">Backlog</span>
        <p>
          Currently the pipeline makes <strong>2 LLM calls per query</strong>: (1) Haiku classification
          (intent, departments, roles, keywords) and (2) per-slot execution. All scoring signals, spread
          activation, diversity floor, prompt assembly, and co-firing edges are already fully deterministic.
          The classification stage is the only LLM dependency in the scoring pipeline.
        </p>
        <p>
          Replacing the Haiku classifier with a deterministic alternative would make the entire selection
          pipeline LLM-free, with only the final execution step requiring a model call.
        </p>

        <h4>Candidate Approaches</h4>
        <ul>
          <li>
            <strong>Keyword / regex matching</strong> — Match query terms against the known department
            and role vocabulary. Cheapest and fastest, but brittle with synonyms and novel phrasing.
            Good enough for well-scoped queries within familiar domains.
          </li>
          <li>
            <strong>TF-IDF / BM25</strong> — Score query terms against existing neuron text corpus to
            identify relevant departments and roles without any LLM call. Handles partial matches and
            term frequency better than raw keyword matching.
          </li>
          <li>
            <strong>Local embedding model</strong> — A small sentence-transformer (~30MB) encodes the
            query and compares against pre-computed department/role embeddings via cosine similarity.
            Near-LLM classification quality at zero API cost and &lt;10ms latency.
          </li>
        </ul>

        <h4>When It Matters</h4>
        <ul>
          <li>
            <strong>High volume</strong> — At 100K queries/day, classification alone costs ~$5/day.
            A local classifier eliminates it entirely.
          </li>
          <li>
            <strong>Latency</strong> — The Haiku classification call adds ~300-500ms of network roundtrip.
            A local classifier runs in &lt;10ms. Significant for real-time or interactive applications.
          </li>
          <li>
            <strong>Air-gapped deployment</strong> — Defense customers may need the scoring pipeline to
            work without external API calls. A deterministic classifier makes the entire selection pipeline
            air-gappable, with only the final execution needing an LLM endpoint.
          </li>
        </ul>

        <h4>Current Recommendation</h4>
        <p>
          Keep Haiku classification for now — it costs ~$0.00005 per call and handles edge cases well.
          Design the classifier interface so it's swappable: the downstream pipeline only consumes a
          structured dict (intent, departments, role_keys, keywords). Any replacement slots in behind
          the same <code>classify_query()</code> function signature without touching scoring, assembly,
          or execution code.
        </p>
      </section>

      <section className="next-steps-section">
        <h3>Microglia — Quality Scanner</h3>
        <span className="status-badge planned">Planned</span>
        <p>Three threat vectors, three detection strategies:</p>
        <ul>
          <li>
            <strong>Prompt injection in neuron content</strong> — Periodic scan running each neuron's
            content through a classifier prompt: "Does this text contain instructions that attempt to
            override system behavior?" Flag and quarantine (<code>is_active = false</code>) rather than
            delete, pending human review.
          </li>
          <li>
            <strong>Hallucinated facts</strong> — Cross-neuron consistency checks (contradictions within
            a department get flagged) plus provenance tracking via a <code>source</code> field (seed data
            vs. human refinement vs. LLM-generated). LLM-generated neurons get lower trust and more
            aggressive scanning.
          </li>
          <li>
            <strong>Memetic/logical flaws</strong> — "Devil's advocate" pass: feed a neuron's content +
            parent chain to a model asking "What assumptions could be wrong?" Neurons with high invocations
            but declining utility are prime candidates.
          </li>
        </ul>
      </section>

      <section className="next-steps-section">
        <h3>Ependymal — Graph Hygiene</h3>
        <span className="status-badge planned">Planned</span>
        <p>
          Like cerebrospinal fluid clearing metabolic waste (glymphatic system), a periodic graph
          hygiene process that:
        </p>
        <ul>
          <li>Merges near-duplicate neurons (cosine similarity on content embeddings)</li>
          <li>Re-parents misplaced neurons (e.g., a Task-layer neuron under the wrong Role)</li>
          <li>Rebalances the tree — flags departments with disproportionate neuron counts</li>
          <li>Prunes dead branches (entire subtrees with zero firings over N queries)</li>
        </ul>
        <p>
          Combined with microglia into a single <strong>maintenance cycle</strong>:{' '}
          <code>POST /admin/maintain</code> returns proposed actions (quarantines, merges, re-parents,
          prunes) as a preview, then <code>POST /admin/maintain/apply</code> executes approved changes.
          Same pattern as the existing refine/apply flow.
        </p>
      </section>

      <section className="next-steps-section">
        <h3>Knowledge Ingestion — MIT OCW Engineering Corpus</h3>
        <span className="status-badge planned">Idea</span>
        <p>
          Parse MIT OpenCourseWare materials (Mechanical Engineering + Aeronautics &amp; Astronautics) into
          formula-level neurons. ~190 courses in scope, ~70 with substantial lecture notes and problem sets.
          Estimated yield: <strong>6,000–8,000 neurons</strong> across 6 layers.
        </p>
        <p>Structure: <strong>Discipline → Course → Topic → Scenario → Formula + Conditions</strong></p>
        <ul>
          <li>Lecture notes/PDFs → LLM extraction pipeline (Haiku ~$5-15, Sonnet ~$50-150)</li>
          <li>Problem sets provide the critical scenario-to-formula mapping ("given X, use Y")</li>
          <li>Prerequisite chains in course catalogs map directly to neuron graph edges</li>
          <li>~50-100MB raw text, compresses to ~5-15MB of structured neuron data</li>
        </ul>
      </section>

      <section className="next-steps-section">
        <h3>Knowledge Ingestion — Databricks ELT Pipelines</h3>
        <span className="status-badge planned">Idea</span>
        <p>
          Add data engineering domain knowledge, specifically Databricks ELT pipeline patterns.
          Primary sources: Databricks public documentation, Spark API references, and
          certification study materials. Covers Delta Lake, Unity Catalog, Structured Streaming,
          Auto Loader, and medallion architecture patterns.
        </p>
      </section>

      <section className="next-steps-section">
        <h3>Scaling — SQLite to PostgreSQL Migration</h3>
        <span className="status-badge planned">When Needed</span>
        <p>
          SQLite is the correct choice for single-user development and demonstration. The migration
          trigger is either: (a) multiple concurrent users needing write access, or (b) deployment
          to shared infrastructure. The migration is low-risk because the application uses async
          SQLAlchemy throughout — the ORM layer is already database-agnostic.
        </p>

        <h4>Migration Steps</h4>
        <ol>
          <li>
            <strong>Swap driver</strong> — Change connection string in <code>config.py</code> from{' '}
            <code>sqlite+aiosqlite:///yggdrasil.db</code> to{' '}
            <code>postgresql+asyncpg://user:pass@host/yggdrasil</code>.
            Install <code>asyncpg</code> to replace <code>aiosqlite</code>.
          </li>
          <li>
            <strong>Generate schema</strong> — Run SQLAlchemy models through Alembic to create
            the PostgreSQL schema. ORM model definitions are unchanged.
          </li>
          <li>
            <strong>Migrate data</strong> — One-time dump from SQLite, load into Postgres.
          </li>
          <li>
            <strong>Audit for raw SQL</strong> — Grep codebase for any raw <code>sqlite3.connect()</code>{' '}
            or direct SQL calls bypassing SQLAlchemy. Fix SQLite-specific syntax: implicit type coercion,
            <code>PRAGMA</code> calls (WAL mode — Postgres uses MVCC natively), boolean-as-integer patterns,
            and auto-increment behavior differences.
          </li>
          <li>
            <strong>Test full pipeline</strong> — Query, score, bolster, apply, autopilot against Postgres.
          </li>
        </ol>

        <h4>What Postgres Enables</h4>
        <ul>
          <li>
            <strong>Concurrent writes</strong> — Multiple users querying, firing neurons, and running
            bolsters simultaneously without SQLite's single-writer lock.
          </li>
          <li>
            <strong>ACID transactions with row-level locking</strong> — Content versioning and provenance
            updates become transactionally safe (neuron update + version record commit atomically).
          </li>
          <li>
            <strong>Native JSONB</strong> — Scoring signal breakdowns, provenance metadata, and
            regulatory citations stored as queryable JSONB rather than serialized text.
          </li>
          <li>
            <strong>Production backup/restore</strong> — <code>pg_dump</code>, point-in-time recovery,
            WAL archiving replace file-copy SQLite backups.
          </li>
        </ul>

        <h4>Preparation (Do Now)</h4>
        <p>
          Keep all new queries in the SQLAlchemy ORM layer. Every raw <code>sqlite3</code> call
          avoided today is one fewer thing to fix on migration day. Verification scripts and batch
          tools should use the API endpoints rather than direct database access.
        </p>
      </section>

      <section className="next-steps-section">
        <h3>Summary</h3>
        <table className="next-steps-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>System Analog</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Neurons</td><td>Neuron graph + 5-signal scoring</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>Astrocytes</td><td>Utility feedback loop</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>Oligodendrocytes</td><td>SQLite + checkpoints</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>RAG Layer</td><td>Semantic retrieval complement</td><td><span className="status-badge planned">Tier 1</span></td></tr>
            <tr><td>Query Decomposition</td><td>Multi-pass retrieval</td><td><span className="status-badge planned">Tier 1</span></td></tr>
            <tr><td>Sonnet Routing</td><td>Tiered model escalation</td><td><span className="status-badge planned">Tier 2</span></td></tr>
            <tr><td>Cross-Ref Chasing</td><td>Graph traversal at query time</td><td><span className="status-badge planned">Tier 2</span></td></tr>
            <tr><td>Multi-Hop Spread</td><td>SA-RAG frontier traversal</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>Theme Pre-Scoring</td><td>Cog-RAG cluster filtering</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>Community Detection</td><td>GraphRAG Leiden communities</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>Community Summaries</td><td>GraphRAG compressed fallback</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>Microglia</td><td>Quality scanner + quarantine</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>Ependymal</td><td>Graph hygiene / reorg</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>Deterministic Classifier</td><td>LLM-free query classification</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>PostgreSQL Migration</td><td>Multi-user scaling (SQLAlchemy swap)</td><td><span className="status-badge planned">When Needed</span></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
