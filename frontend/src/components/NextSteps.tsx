export default function NextSteps() {
  return (
    <div className="next-steps">
      <h2>Next Steps</h2>
      <p className="next-steps-intro">
        Extending the neuron graph beyond non-deterministic knowledge — mapping biological glial cell
        types to system capabilities.
      </p>

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
        <h3>Astrocytes — Feedback Loop</h3>
        <span className="status-badge built">Built</span>
        <p>
          The existing utility rating + score propagation system fills this role. High-utility neurons
          get "fed" (boosted scores), starved ones atrophy — matching how astrocytes provide nutrients
          to active neurons.
        </p>
      </section>

      <section className="next-steps-section">
        <h3>Oligodendrocytes — Structural Integrity</h3>
        <span className="status-badge built">Built</span>
        <p>
          SQLite persistence + the Knowledge Checkpoint system covers structural integrity. Like myelin
          sheaths protecting signal fidelity, the DB ensures neurons don't degrade in transit.
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
        <p>
          Implementation: <code>POST /admin/scan</code> endpoint producing a <code>ScanReport</code>{' '}
          (neuron_id, threat_type, confidence, details). Findings go to a <code>neuron_quarantine</code>{' '}
          table for human-in-the-loop review.
        </p>
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
              <th>Brain Cell</th>
              <th>System Analog</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Neurons</td><td>Neuron graph</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>Astrocytes</td><td>Utility feedback loop</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>Oligodendrocytes</td><td>SQLite + checkpoints</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>Microglia</td><td>Quality scanner + quarantine</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>Ependymal</td><td>Graph hygiene / reorg</td><td><span className="status-badge planned">Planned</span></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
