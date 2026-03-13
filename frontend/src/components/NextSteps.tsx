export default function NextSteps() {
  return (
    <div className="next-steps">
      <h2>Next Steps</h2>

      <p className="next-steps-intro">
        Roadmap organized as a linear build sequence. Each phase builds on the previous.
        Role bolstering runs continuously in parallel via autopilot.
      </p>

      {/* ── Immediate — Reliability & Data Integrity ── */}

      <section className="next-steps-section urgent">
        <h3>Immediate — Reliability &amp; Data Integrity</h3>
        <span className="status-badge planned" style={{ background: '#ef444422', color: '#ef4444', borderColor: '#ef444444' }}>Priority</span>
        <p>
          Gaps that affect data safety, pipeline reliability, or trust in the system.
          These should be addressed before adding new features.
        </p>

        <table className="next-steps-table">
          <thead>
            <tr><th>Issue</th><th>Impact</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Batch jobs in memory</td>
              <td>The <code>_batch_jobs</code> dict lives in process memory. Server restart mid-ingest loses all job state &mdash; tokens spent, no record, no way to resume.</td>
              <td>Persist batch job state to a <code>batch_jobs</code> table. Track status, progress, token spend. Enable resume-on-restart.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>No automated backups</td>
              <td>PostgreSQL has no scheduled <code>pg_dump</code>. A bad migration, accidental truncate, or disk failure loses 2,055 neurons, 40K edges, and all query/eval history.</td>
              <td>Cron job running daily <code>pg_dump</code> with retention. Store locally + optional offsite sync.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>No authentication</td>
              <td>Every endpoint is open. The <code>user_id</code> columns exist but nothing populates them. Blocks any real multi-user transition and leaves the system exposed on any non-localhost network.</td>
              <td>Add basic auth (API key or session-based) to gate write endpoints at minimum. Populate <code>user_id</code> from auth context.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600, textDecoration: 'line-through', opacity: 0.6 }}>No scoring pipeline tests</td>
              <td style={{ opacity: 0.6 }}>The classify &rarr; score &rarr; assemble &rarr; execute chain is the core IP.</td>
              <td style={{ color: '#22c55e' }}><strong>Done.</strong> 79 tests covering scoring engine (all 6 signals + compute_score), spread activation (typed edges, stellate/pyramidal decay, multi-hop), and integration paths. Run via <code>pytest tests/ -v</code>.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="next-steps-section">
        <h3>Near-Term — Quality &amp; Observability</h3>
        <span className="status-badge planned" style={{ background: '#fb923c22', color: '#fb923c', borderColor: '#fb923c44' }}>Important</span>
        <p>
          Gaps that degrade value over time or reduce visibility into system behavior.
        </p>

        <table className="next-steps-table">
          <thead>
            <tr><th>Issue</th><th>Impact</th><th>Fix</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Write-time deduplication</td>
              <td>Ingest and bolster endpoints don&rsquo;t check for existing similar neurons before inserting. Duplicates accumulate silently, diluting scores and wasting token budget during assembly.</td>
              <td>Label similarity + content overlap check before insert. Flag near-duplicates for merge rather than creating new rows. Complements the Ependymal post-hoc scan (Phase 6).</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Neuron content versioning</td>
              <td>Refinement history exists in <code>neuron_refinements</code> but there&rsquo;s no clean way to see the full edit timeline of a single neuron or roll back to a prior version. For regulatory neurons, you need to know what it said on a specific date.</td>
              <td>Version column on neurons + snapshot-on-write to a <code>neuron_versions</code> table. Enable point-in-time recall and rollback.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Full-text search</td>
              <td>2,055 neurons and growing, but no search endpoint. Explorer relies on tree browsing. Users can&rsquo;t type &ldquo;ITAR&rdquo; and see every neuron mentioning it &mdash; only the ones with matching tags.</td>
              <td>PostgreSQL <code>tsvector</code> index on neuron label + content + summary. Search API endpoint + Explorer search bar.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Activity feed / changelog</td>
              <td>Data exists across refinements, autopilot runs, and firings tables, but no unified &ldquo;what happened to the graph today&rdquo; view. Hard to trust autonomous processes without visibility.</td>
              <td>Unified activity log page pulling from refinements, autopilot runs, ingest jobs, and alert tables. Filterable by date, action type, and source.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>CLI subprocess fragility</td>
              <td>The <code>claude -p --output-format json</code> contract is undocumented and untested. If the CLI binary updates, changes output format, or the node path shifts, the entire system breaks silently.</td>
              <td>Health-check endpoint that validates CLI availability and output format. Version pinning. Graceful error surfacing when the CLI contract breaks.</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Regulatory knowledge assessments</td>
              <td>The neuron graph needs validated coverage across all applicable regulatory bodies and professional standards. Without systematic assessment, gaps in regulatory knowledge go undetected until a compliance query fails.</td>
              <td>
                <p style={{ marginBottom: 8 }}>Apply knowledge assessments against the following regulatory bodies and standards:</p>
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Government Regulatory Bodies ({27})</summary>
                  <table style={{ width: '100%', fontSize: '0.85em', marginTop: 4 }}>
                    <thead><tr><th>Entity</th><th>Region</th><th>Domain</th></tr></thead>
                    <tbody>
                      <tr><td>FAA</td><td>United States</td><td>Civil aviation</td></tr>
                      <tr><td>EASA</td><td>European Union</td><td>Civil aviation</td></tr>
                      <tr><td>DoD</td><td>United States</td><td>Defense</td></tr>
                      <tr><td>DCMA</td><td>United States</td><td>Defense contract management</td></tr>
                      <tr><td>DDTC</td><td>United States</td><td>ITAR export controls</td></tr>
                      <tr><td>BIS</td><td>United States</td><td>EAR export controls</td></tr>
                      <tr><td>NASA</td><td>United States</td><td>Space programs</td></tr>
                      <tr><td>OSHA</td><td>United States</td><td>Occupational safety</td></tr>
                      <tr><td>EPA</td><td>United States</td><td>Environmental</td></tr>
                      <tr><td>DOT (PHMSA)</td><td>United States</td><td>Hazardous materials transport</td></tr>
                      <tr><td>DLA</td><td>United States</td><td>Defense logistics</td></tr>
                      <tr><td>TCCA</td><td>Canada</td><td>Civil aviation</td></tr>
                      <tr><td>CAA</td><td>United Kingdom</td><td>Civil aviation</td></tr>
                      <tr><td>CAAC</td><td>China</td><td>Civil aviation</td></tr>
                      <tr><td>ANAC</td><td>Brazil</td><td>Civil aviation</td></tr>
                      <tr><td>CASA</td><td>Australia</td><td>Civil aviation</td></tr>
                      <tr><td>DGCA</td><td>India</td><td>Civil aviation</td></tr>
                      <tr><td>ICAO</td><td>International (UN)</td><td>Global civil aviation standards</td></tr>
                      <tr><td>MOD</td><td>United Kingdom</td><td>Defense</td></tr>
                      <tr><td>EDA</td><td>European Union</td><td>Defense</td></tr>
                      <tr><td>ESA</td><td>European Union</td><td>Space</td></tr>
                      <tr><td>CSA</td><td>Canada</td><td>Space</td></tr>
                      <tr><td>UK Space Agency</td><td>United Kingdom</td><td>Space</td></tr>
                      <tr><td>ECHA</td><td>European Union</td><td>REACH chemicals</td></tr>
                      <tr><td>FAA AST</td><td>United States</td><td>Commercial space launches</td></tr>
                      <tr><td>NADCAP (PRI)</td><td>International</td><td>Special processes accreditation</td></tr>
                      <tr><td>CMMC-AB</td><td>United States</td><td>Cybersecurity certification</td></tr>
                    </tbody>
                  </table>
                </details>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Professional Standards ({11})</summary>
                  <table style={{ width: '100%', fontSize: '0.85em', marginTop: 4 }}>
                    <thead><tr><th>Standard</th><th>Region</th><th>Domain</th></tr></thead>
                    <tbody>
                      <tr><td>AS9100</td><td>International</td><td>Quality management (IAQG/SAE)</td></tr>
                      <tr><td>AS9110</td><td>International</td><td>Maintenance/repair</td></tr>
                      <tr><td>AS9120</td><td>International</td><td>Stockist/distributors</td></tr>
                      <tr><td>ISO 9001</td><td>International</td><td>General quality management</td></tr>
                      <tr><td>SAE standards (AMS, ARP)</td><td>US/International</td><td>Materials, processes</td></tr>
                      <tr><td>NAS standards</td><td>United States</td><td>National Aerospace Standards</td></tr>
                      <tr><td>ISO 14001</td><td>International</td><td>Environmental management</td></tr>
                      <tr><td>ISO 45001</td><td>International</td><td>Occupational health &amp; safety</td></tr>
                      <tr><td>RTCA DO standards (DO-178C)</td><td>International</td><td>Software/equipment</td></tr>
                      <tr><td>EUROCAE</td><td>Europe</td><td>Aviation electronics</td></tr>
                      <tr><td>ASTM standards</td><td>International</td><td>Materials/testing</td></tr>
                      <tr><td>NFPA standards</td><td>United States</td><td>Fire protection</td></tr>
                    </tbody>
                  </table>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

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
            <tr><td>Ingest Placement Validation</td><td>Department required (dropdown) before ingestion runs. Backend rejects proposals missing department, role_key, or parent_id at apply time. Prevents orphaned neurons from entering the graph.</td></tr>
            <tr><td>Semantic Prefilter</td><td>In-memory numpy matrix of all neuron embeddings (~3MB). Matrix dot product for O(1ms) cosine ranking replaces org-chart filtering as primary candidate selection. Dynamic candidate pool (50&ndash;2000) controllable per query via UI slider.</td></tr>
            <tr><td>Inhibitory Regulation</td><td>3-pass biologically-inspired suppression: (1) Regional density/basket cell, (2) Redundancy/chandelier cell (cosine {'>'} 0.92), (3) Cross-ref floor/Martinotti cell. Returns survivor_count as effective top-K. Feature-flagged with fallback to static diversity floor.</td></tr>
            <tr><td>Typed Edges</td><td>Stellate (intra-department, decay=0.3) vs pyramidal (cross-department, min_weight=0.20) edge classification. Differential spread activation thresholds based on edge type.</td></tr>
            <tr><td>Gated Modulatory Scoring</td><td>Semantic similarity (stimulus) gates 5 modulatory signals. Pre-wired via 384-dim sentence embeddings with experience-dependent plasticity. Gate threshold 0.3, floor 0.05.</td></tr>
            <tr><td>Cache-Aware Cost Calculation</td><td>Separated base_input (1x), cache_creation (1.25x), cache_read (0.10x) pricing. Reduced reported cost inflation ~47%.</td></tr>
            <tr><td>Pipeline Test Suite</td><td>79 automated tests covering scoring engine (all 6 signals), spread activation (typed edges, stellate/pyramidal), and compute_score integration.</td></tr>
            <tr><td>3D Neuron Universe</td><td>Three.js force-directed graph of entire neuron network. Colorable by department or layer, directional edge particles, filter controls, zoom-to-fit.</td></tr>
            <tr><td>MCP Server Mode</td><td>7-tool stdio MCP server for Claude Code integration. <code>query_graph</code> runs the full neuron pipeline and returns enriched context without LLM execution. Tools: query_graph, impact_analysis, neuron_detail, browse_departments, graph_stats, cost_report, discover_clusters.</td></tr>
            <tr><td>Structural Fast Path</td><td>Deterministic resolver for structural queries (list departments, roles in X, neurons about Y, graph stats, connections). Regex + keyword pattern matching at zero API cost &mdash; bypasses Haiku classification entirely.</td></tr>
            <tr><td>Per-Project Neuron Caching</td><td>ProjectProfile model tracks neuron relevance per project path. After 3+ queries, frequently useful neurons get a 1.0&ndash;1.3&times; scoring boost. EMA-weighted relevance accumulation.</td></tr>
            <tr><td>Auto-Clustering</td><td>Label propagation on co-firing edges discovers emergent cross-department neuron clusters. API endpoint (<code>GET /neurons/clusters</code>), MCP tool (<code>discover_clusters</code>), and autopilot gap source (<code>emergent_cluster</code>).</td></tr>
            <tr><td>prepare_context() Extraction</td><td>Core pipeline (classify &rarr; score &rarr; spread &rarr; inhibit &rarr; assemble) extracted from <code>execute_query()</code> into standalone <code>prepare_context()</code> function. Enables MCP server and REST API to share the same pipeline code.</td></tr>
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

        <h4>RAG Layer (Semantic Retrieval) <span style={{ fontSize: '0.7rem', color: '#22c55e' }}>&mdash; Done (semantic prefilter)</span></h4>
        <ul>
          <li><s><strong>Embed neuron content</strong></s> &mdash; <strong>Done.</strong> All 2,054 neurons embedded with <code>all-MiniLM-L6-v2</code> (384-dim). In-memory numpy cache (~3MB) for O(1ms) matrix dot product.</li>
          <li><s><strong>Dual retrieval</strong></s> &mdash; <strong>Done.</strong> Semantic prefilter is the primary candidate selection path; classification output provides dept/role scoring boosts. Org-chart filtering retained as fallback when embeddings unavailable.</li>
          <li><s><strong>Incremental re-embedding</strong></s> &mdash; <strong>Done.</strong> Cache invalidated on <code>POST /admin/embed-neurons</code>. New neurons embedded at create time.</li>
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

      {/* ── Phase 9: Conversational Context Handoff ── */}

      <section className="next-steps-section">
        <h3>Phase 9 — Conversational Context Handoff</h3>
        <span className="status-badge planned">Backlog</span>
        <p>
          Yggdrasil currently operates as a single-shot system: classify, score, assemble, execute, done.
          This is intentional &mdash; front-loading context reduces hallucination and keeps the neuron
          selection pipeline clean. But users often need follow-up questions after the initial answer,
          and today they lose all assembled context when they do.
        </p>

        <h4>Option A: Context Export</h4>
        <p>
          After an answer is generated, offer a one-click export of the assembled context (scored neurons,
          system prompt, query, and response) into a format consumable by external LLM interfaces &mdash;
          ChatGPT, Claude.ai, local Ollama, etc. The user continues their conversation elsewhere with
          the full Yggdrasil context already loaded. This preserves the &ldquo;selfish prompt&rdquo;
          philosophy: the external system starts with high-quality, relevance-ranked context rather
          than a blank slate.
        </p>

        <h4>Option B: In-App Conversation</h4>
        <p>
          Extend the Query Lab into a multi-turn interface where follow-up questions carry forward
          the assembled neuron context from the original query. Each follow-up could optionally re-fire
          the neuron graph (if the conversation shifts topics) or retain the original context window
          (if the user is drilling deeper on the same subject). The key constraint: the neuron context
          always occupies the high-attention zone of the prompt, regardless of how many conversational
          turns accumulate after it.
        </p>
        <p>
          Both options solve the same problem &mdash; letting users go deeper without losing the
          knowledge the system already assembled. Option A is simpler and keeps Yggdrasil focused
          on what it does best (selection and assembly). Option B is more integrated but requires
          managing conversation state and the attention-degradation tradeoffs that the single-shot
          design deliberately avoids.
        </p>
      </section>

      {/* ── Phase 10: Live Standards & Regulatory APIs ── */}

      <section className="next-steps-section">
        <h3>Phase 10 — Live Standards &amp; Regulatory APIs</h3>
        <span className="status-badge planned">Backlog</span>
        <p>
          The neuron graph currently relies on point-in-time ingestion &mdash; someone feeds it a document,
          and that snapshot lives in the graph until manually updated. This phase adds durable API connections
          to authoritative sources so the graph stays current without human intervention.
        </p>

        <h4>Regulatory &amp; Legal</h4>
        <ul>
          <li><strong>eCFR API</strong> &mdash; Electronic Code of Federal Regulations. REST API provides current
            full text of any CFR title/part/section. Schedule weekly pulls for tracked parts (e.g., 48 CFR for FAR/DFARS,
            14 CFR for FAA, 32 CFR for defense). Diff against existing neurons to detect changes and flag stale content.</li>
          <li><strong>Federal Register API</strong> &mdash; New rules, proposed rules, and notices. Daily poll for
            tracked agencies (DoD, FAA, NIST, GSA). Feed new entries into the emergent queue as regulatory signals
            before they become codified in the CFR.</li>
          <li><strong>Congress.gov API</strong> &mdash; Track bills and enacted legislation affecting defense/aerospace
            procurement, export control, and AI governance (e.g., NDAA amendments, AI-related bills).</li>
          <li><strong>NIST CSRC</strong> &mdash; Publications feed for SP 800-series, AI RMF updates, and cybersecurity
            framework revisions. Detect when referenced NIST documents get new versions.</li>
        </ul>

        <h4>Industry Standards</h4>
        <ul>
          <li><strong>SAE MOBILUS / IHS Markit</strong> &mdash; API access to AMS, AS, ARP standards referenced by
            aerospace neurons. Detect revision changes to standards like AS9100, AS6081, AMS 2750. Subscription-based
            access &mdash; cost varies by scope.</li>
          <li><strong>ISO Online Browsing Platform</strong> &mdash; Track revision status of referenced ISO standards
            (ISO 9001, ISO 42001, ISO 27001). Limited API &mdash; may need periodic scraping with change detection.</li>
          <li><strong>NADCAP eAuditNet</strong> &mdash; Track accreditation checklist updates for special process
            certifications (welding, NDT, heat treat, coatings).</li>
        </ul>

        <h4>Technical Documentation</h4>
        <ul>
          <li><strong>Language/framework docs</strong> &mdash; Versioned API docs for Python, TypeScript, React, FastAPI,
            SQLAlchemy, D3, and other tools in the stack. Pull changelogs and migration guides on major version releases
            to keep technical neurons current.</li>
          <li><strong>Cloud provider APIs</strong> &mdash; AWS, Azure, GCP release notes and service documentation.
            Relevant when connector neurons (Phase 7) integrate with cloud services.</li>
          <li><strong>LLM provider changelogs</strong> &mdash; Anthropic, OpenAI model deprecation schedules, new model
            releases, API changes. Auto-update the model registry and flag neurons that reference deprecated capabilities.</li>
        </ul>

        <h4>Integration Pattern</h4>
        <p>
          Each API source gets a scheduled poller (cron or autopilot-style tick) that:
        </p>
        <ul>
          <li>Fetches the latest version of tracked resources</li>
          <li>Diffs against existing neuron content to detect meaningful changes</li>
          <li>Routes changes to the emergent queue with source metadata (effective date, version, citation)</li>
          <li>Optionally auto-ingests minor updates (typo fixes, formatting) while flagging substantive changes for review</li>
          <li>Logs all API interactions for compliance audit trail (AIUC-1 E015)</li>
        </ul>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: 8 }}>
          The goal is a living knowledge graph that reflects the current state of its source material &mdash; not
          a static snapshot that silently drifts out of date. Staleness is the primary failure mode of any
          knowledge system; automated refresh is the countermeasure.
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
            <tr><td>&mdash;</td><td>Neuron graph + 6-signal gated scoring (2,054 neurons)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Semantic prefilter (embedding-primary candidate selection)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Inhibitory regulation (3-pass: density, redundancy, cross-ref floor)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Multi-hop spread activation (typed edges: stellate + pyramidal)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Blind A/B evaluation + BH-FDR correction</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Co-firing edge graph (224,920+ edges)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Bolster + Autopilot</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Source-typed neurons + reference detection</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Emergent queue (data model + API)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>PostgreSQL migration (asyncpg + JSONB)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Compliance framework (NIST/ISO/AIUC-1)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Governance dashboard (13 live KPIs)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Evaluate suite (Performance, Quality, Fairness, Compliance)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Cost modeling (cache-aware: base/create/read pricing)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Input guard (16 adversarial patterns)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Scoring health monitor + drift detection</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Pipeline test suite (79 tests: scoring engine + spread activation)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>3D neuron universe (Three.js force graph)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>MCP server mode (7 tools, stdio transport)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Structural fast path (zero-cost deterministic resolver)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Per-project neuron caching (ProjectProfile + boost)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>&mdash;</td><td>Auto-clustering (label propagation + emergent_cluster gap)</td><td><span className="status-badge built">Built</span></td></tr>
            <tr><td>1</td><td>Role bolstering (2,054 &rarr; 3,000+ neurons)</td><td><span className="status-badge planned">Active</span></td></tr>
            <tr><td>2</td><td>Emergent Queue UI + ingestion pipeline</td><td><span className="status-badge planned">Next</span></td></tr>
            <tr><td>2</td><td>Source Coverage analytics + verification</td><td><span className="status-badge planned">Next</span></td></tr>
            <tr><td>3</td><td>Structured prompt assembly</td><td><span className="status-badge planned">Planned</span></td></tr>
            <tr><td>3</td><td>RAG layer (semantic retrieval)</td><td><span className="status-badge built">Built</span></td></tr>
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
            <tr><td>9</td><td>Conversational context handoff (export + in-app)</td><td><span className="status-badge planned">Backlog</span></td></tr>
            <tr><td>10</td><td>Live standards &amp; regulatory APIs (eCFR, Federal Register, SAE, ISO, tech docs)</td><td><span className="status-badge planned">Backlog</span></td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
