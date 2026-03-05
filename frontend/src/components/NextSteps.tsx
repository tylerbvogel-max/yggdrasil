export default function NextSteps() {
  return (
    <div className="next-steps">
      <h2>Next Steps</h2>
      <p className="next-steps-intro">
        Extending the neuron graph beyond non-deterministic knowledge — mapping biological glial cell
        types to system capabilities, and closing the quality gap between haiku+neurons and raw opus.
      </p>

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
            <tr><td>Microglia</td><td>Quality scanner + quarantine</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>Ependymal</td><td>Graph hygiene / reorg</td><td><span className="status-badge planned">Planned</span></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
