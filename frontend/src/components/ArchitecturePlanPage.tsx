import { useState, type ReactNode } from 'react';

function CollapsibleSection({ title, children, defaultOpen = false, style }: {
  title: string; children: ReactNode; defaultOpen?: boolean; style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="about-section" style={style}>
      <h3
        onClick={() => setOpen(!open)}
        style={{ marginTop: 0, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: '0.7rem', color: '#64748b', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        {title}
      </h3>
      {open && children}
    </section>
  );
}

type RoadmapStatus = 'done' | 'in-progress' | 'planned' | 'deferred';

interface RoadmapItem {
  id: string;
  title: string;
  status: RoadmapStatus;
  effort: string;
  detail: string;
  controls: string;
}

const TIER_1: RoadmapItem[] = [
  { id: 'T1-1', title: 'Error message sanitization', status: 'done', effort: '< 30 min',
    detail: 'Global exception handler now returns generic "Internal server error" to clients while logging real error server-side. Prevents leaking implementation details.',
    controls: 'SI-11, SOC 2 CC7.3' },
  { id: 'T1-2', title: 'Audit log middleware', status: 'done', effort: '1-2 hours',
    detail: 'AuditMiddleware logs all POST/PUT/DELETE/PATCH requests to audit_log table with timestamp, endpoint, action, status code, client IP, user agent, redacted body summary, and response time. Skips high-frequency endpoints (Corvus frames). Query and summary endpoints for audit review.',
    controls: 'AU-2, AU-3, AU-4, AU-8, AU-12, CMMC 3.3.1/3.3.5/3.3.6, SOC 2 CC7.2/CC7.3' },
  { id: 'T1-3', title: 'Session timeout headers', status: 'done', effort: '< 30 min',
    detail: 'SecurityHeadersMiddleware sets X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP, HSTS, Referrer-Policy, Permissions-Policy, Cache-Control, and X-Session-Timeout on all responses.',
    controls: 'AC-12, SC-10, CMMC 3.1.11/3.13.9' },
  { id: 'T1-4', title: 'System use notification banner', status: 'done', effort: '< 30 min',
    detail: 'GET /admin/system-banner endpoint serves configurable banner text. SystemUseBanner component displays modal overlay on first visit (per-session acknowledgment via sessionStorage). Banner text configurable via SYSTEM_USE_BANNER env var.',
    controls: 'AC-8, CMMC 3.1.9' },
  { id: 'T1-5', title: 'Data retention configuration', status: 'planned', effort: '< 30 min',
    detail: 'Add data_retention_days to config.py with a scheduled cleanup function for old query logs and audit records.',
    controls: 'SI-12, SOC 2 P1.5/P1.6/C1.2, AU-11' },
  { id: 'T1-6', title: 'TLS-ready configuration', status: 'planned', effort: '< 30 min',
    detail: 'Add ssl_keyfile/ssl_certfile to config.py. Document uvicorn TLS launch. App becomes TLS-capable without enforcing it on localhost.',
    controls: 'SC-8, CMMC 3.13.8, AC-17(2)' },
];

const TIER_2: RoadmapItem[] = [
  { id: 'T2-1', title: 'API key rotation tracking', status: 'planned', effort: '1-2 hours',
    detail: 'Endpoint to record API key rotation timestamp. Alert if Anthropic key >90 days old. Key management lifecycle tracking.',
    controls: 'SC-12, CMMC 3.13.10, IA-5' },
  { id: 'T2-2', title: 'Privacy notice endpoint + banner', status: 'planned', effort: '1-2 hours',
    detail: 'Configurable privacy notice describing data collected, usage, retention, and deletion rights. Frontend consent banner.',
    controls: 'PT-5, SOC 2 P1.1/P1.2, CMMC 3.1.9' },
  { id: 'T2-3', title: 'Exception handling cleanup', status: 'planned', effort: '2-3 hours',
    detail: 'Replace ~30 bare except Exception blocks with specific exception types + structured logging. Addresses silent failure risks.',
    controls: 'SI-11, SI-2, SOC 2 CC7.3, NASA CR-01' },
  { id: 'T2-4', title: 'Vulnerability scanning integration', status: 'planned', effort: '2-3 hours',
    detail: 'Add pip-audit and npm audit as part of compliance audit endpoint. Track known CVEs in dependencies.',
    controls: 'RA-5, CMMC 3.11.2, SI-2' },
  { id: 'T2-5', title: 'Audit log integrity protection', status: 'planned', effort: '1-2 hours',
    detail: 'Add HMAC chain to audit log entries (each record signs previous hash). Detects tampering without needing separate infrastructure.',
    controls: 'AU-9, CMMC 3.3.8, SOC 2 CC7.2' },
];

const TIER_3: RoadmapItem[] = [
  { id: 'T3-1', title: 'System Security Plan (SSP) stub', status: 'planned', effort: '2-3 hours',
    detail: 'docs/system-security-plan.md — SSP template populated from existing system card, governance docs, and this compliance assessment. Foundational FedRAMP document.',
    controls: 'PL-2, CA-6, CMMC 3.12.4' },
  { id: 'T3-2', title: 'Incident Response Plan', status: 'planned', effort: '1-2 hours',
    detail: 'docs/incident-response-plan.md — Formalize existing P1-P4 severity levels and playbooks from governance.md into standalone IRP with FedRAMP-required sections.',
    controls: 'IR-8, CMMC 3.6.1, SOC 2 CC7.4' },
  { id: 'T3-3', title: 'Data classification policy', status: 'planned', effort: '1 hour',
    detail: 'docs/data-classification.md — Define sensitivity levels for all data types: queries, neuron content, Corvus captures, audit logs, API keys.',
    controls: 'MP-3, SOC 2 C1.1, CMMC 3.8.4, RA-2' },
  { id: 'T3-4', title: 'Contingency Plan stub', status: 'planned', effort: '2-3 hours',
    detail: 'docs/contingency-plan.md — Backup procedures, RTO/RPO targets, recovery procedures for PostgreSQL and neuron graph data.',
    controls: 'CP-2, SOC 2 A1.3, CMMC 3.12.1' },
  { id: 'T3-5', title: 'POA&M (Plan of Action & Milestones)', status: 'planned', effort: '1-2 hours',
    detail: 'docs/poam.md — Formal tracking of all compliance gaps with remediation timelines, responsible parties, and completion criteria.',
    controls: 'CA-5, PM-4, CMMC 3.12.2' },
  { id: 'T3-6', title: 'Rules of Behavior document', status: 'planned', effort: '1 hour',
    detail: 'docs/rules-of-behavior.md — Expected user behavior, acceptable use, data handling responsibilities.',
    controls: 'PL-4, SOC 2 CC1.1, CMMC 3.1.9' },
];

const statusStyle = (s: RoadmapStatus): React.CSSProperties => ({
  display: 'inline-block', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 3, fontWeight: 600,
  background: s === 'done' ? '#22c55e22' : s === 'in-progress' ? '#3b82f622' : s === 'deferred' ? '#64748b22' : '#fb923c22',
  color: s === 'done' ? '#22c55e' : s === 'in-progress' ? '#3b82f6' : s === 'deferred' ? '#64748b' : '#fb923c',
  border: `1px solid ${s === 'done' ? '#22c55e44' : s === 'in-progress' ? '#3b82f644' : s === 'deferred' ? '#64748b44' : '#fb923c44'}`,
});

const statusText = (s: RoadmapStatus) =>
  s === 'done' ? 'Done' : s === 'in-progress' ? 'In Progress' : s === 'deferred' ? 'Deferred' : 'Planned';

function RoadmapTier({ title, subtitle, items, color }: { title: string; subtitle: string; items: RoadmapItem[]; color: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const done = items.filter(i => i.status === 'done').length;
  return (
    <section className="about-section" style={{ borderLeft: `3px solid ${color}`, paddingLeft: 16 }}>
      <h4 style={{ color, marginTop: 0, marginBottom: 2 }}>{title}</h4>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 0 }}>
        {subtitle} &mdash; {done}/{items.length} complete
      </p>
      <table className="about-table" style={{ fontSize: '0.8rem' }}>
        <thead>
          <tr>
            <th style={{ width: 50 }}>ID</th>
            <th>Task</th>
            <th style={{ width: 70 }}>Status</th>
            <th style={{ width: 80 }}>Effort</th>
            <th style={{ width: 180 }}>Controls Addressed</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <>{/* eslint-disable-next-line react/jsx-key */}
              <tr key={item.id} onClick={() => setExpanded(expanded === item.id ? null : item.id)} style={{ cursor: 'pointer' }}>
                <td><code>{item.id}</code></td>
                <td style={{ fontWeight: 500 }}>{item.title}</td>
                <td><span style={statusStyle(item.status)}>{statusText(item.status)}</span></td>
                <td style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.effort}</td>
                <td style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>{item.controls}</td>
              </tr>
              {expanded === item.id && (
                <tr key={item.id + '-d'}>
                  <td colSpan={5} style={{ padding: '8px 16px', background: 'var(--bg-input)', fontSize: '0.78rem', color: '#c8d0dc', lineHeight: 1.5 }}>
                    {item.detail}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function ArchitecturePlanPage() {
  return (
    <div className="about-page">
      <h2>Architecture Plan: Biomimetic Neuron Type System</h2>

      <CollapsibleSection title="Session Recovery" style={{ background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p>
          This plan was developed in a Claude Code session on <strong>2026-03-10</strong>.
          The session transcript is stored at:
        </p>
        <pre className="about-tree">{`~/.claude/projects/-home-tylerbvogel/23e91f28-44c8-413f-ae96-1f8a7c2ed6b2.jsonl`}</pre>
        <p>
          To resume this session in Claude Code, run:
        </p>
        <pre className="about-tree">{`claude --resume 23e91f28-44c8-413f-ae96-1f8a7c2ed6b2`}</pre>
        <p style={{ color: 'var(--text-dim)' }}>
          If the session has expired, start a new session and reference this page &mdash; the full plan is documented below.
          The relevant code changes from this session are in the git history.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="The Problem">
        <p>
          Yggdrasil currently treats all neurons as fungible &mdash; a neuron is a neuron.
          In biology, this is not the case. Neurons are differentiated into functional classes,
          morphological types, and neurotransmitter types, each serving distinct roles in the network.
          The absence of these specialized types in Yggdrasil creates specific, observable problems:
        </p>
        <ul className="about-features">
          <li>
            <strong>No inhibition</strong> &mdash; Without GABAergic interneurons, there is no mechanism to prevent
            a single role from flooding the context window. A query about &ldquo;BOM to ERP automation&rdquo;
            activated 401 neurons, most of them irrelevant, because nothing suppresses over-represented regions.
          </li>
          <li>
            <strong>Org-chart walls</strong> &mdash; The department/role filter creates hard silos. A neuron about
            &ldquo;SAP API integration&rdquo; in IT will never be a candidate for a query classified as Engineering,
            even though it&rsquo;s directly relevant. Knowledge doesn&rsquo;t respect org charts.
          </li>
          <li>
            <strong>Uniform learning</strong> &mdash; All neurons learn the same way. But inhibitory regulation should
            learn differently from excitatory activation (opposite learning signals), and cross-department connectors
            should learn differently from local specialists.
          </li>
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="The Core Architectural Shift">
        <p>
          <strong>From:</strong> Organization-structure-primary candidate selection (filter by department/role, then score)
        </p>
        <p>
          <strong>To:</strong> Semantic-embedding-primary candidate selection (find nearest neurons by meaning, then score with org as metadata)
        </p>
        <p>
          Department and role become metadata &mdash; useful for display, scoring boosts (1.25&times;/1.5&times;),
          and defining inhibitory regulator regions &mdash; but no longer the determining factor for which neurons
          are candidates. The embedding is the filter. It has no artificial walls.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Current Pipeline</h4>
        <pre className="about-tree">{`Query
  → Classify (Haiku, ~200ms) — extracts dept, role, keywords
  → Filter by org chart (SQL WHERE dept IN / role IN)
  → Score survivors (6 signals)
  → Spread activation (uniform edges)
  → Diversity floor (static)
  → Assemble top-K → Execute`}</pre>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Target Pipeline</h4>
        <pre className="about-tree">{`Query
  → Embed query (~10ms, local)     ─┐
  → Semantic pre-filter (~1ms)      │ parallel with
  → Classify (Haiku, ~200ms)       ─┘
  → Score candidates (dept/role as boosts, not filters)
  → Inhibitory regulation (learned, per-region)
  → Spread activation (typed edges: pyramidal vs stellate)
  → Assemble top-K → Execute`}</pre>
        <p>
          The new pipeline is actually <strong>faster</strong> because the semantic pre-filter (11ms) runs in parallel
          with classification (200ms), whereas the old pipeline ran them sequentially.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Biological Neuron Types → System Analogues">
        <p>
          A key design insight: these behaviors are implemented as <strong>separate objects</strong> (persistent
          database entities with their own learning rules), not as scoring parameters. Biology uses distinct cell
          types for regulation rather than giving every neuron self-regulation capability because:
        </p>
        <ul className="about-features">
          <li><strong>Regulation must be independent of the thing being regulated</strong> &mdash; an excited neuron has no incentive to suppress itself</li>
          <li><strong>Different functions need different learning rules</strong> &mdash; inhibitory plasticity follows opposite signals from excitatory</li>
          <li><strong>They scale independently</strong> &mdash; you can add more inhibition to a region without changing any knowledge neurons</li>
        </ul>

        <h4 style={{ color: '#22c55e', marginTop: 24, marginBottom: 8 }}>Functional Classes</h4>
        <table className="about-table">
          <thead>
            <tr><th>Biological</th><th>Yggdrasil Analogue</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Sensory neurons</td>
              <td>L0&ndash;L1 (Department/Role) &mdash; receive and classify the query stimulus. The classifier stage is sensory transduction.</td>
              <td style={{ color: '#22c55e' }}>Already built</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Interneurons</td>
              <td>L2&ndash;L4 (Task/System/Decision) &mdash; the processing substrate, bulk of the ~2,000 neurons. Co-firing edges between them form learned associations.</td>
              <td style={{ color: '#22c55e' }}>Already built</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Motor neurons</td>
              <td>L5 (Output) + prompt assembly + LLM execution &mdash; produce the action. The LLM is the effector organ.</td>
              <td style={{ color: '#22c55e' }}>Already built</td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ color: '#fb923c', marginTop: 24, marginBottom: 8 }}>Morphological Types</h4>
        <table className="about-table">
          <thead>
            <tr><th>Biological</th><th>Yggdrasil Analogue</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Pyramidal neurons</td>
              <td>
                <strong>Cross-department connector neurons.</strong> Existing knowledge neurons that have proven cross-department
                co-firing associations. Tagged (not created) as connectors. Carry typed &ldquo;pyramidal&rdquo; edges with higher
                confidence threshold for inter-department spreading activation. ~5&ndash;10% of existing neurons qualify.
              </td>
              <td style={{ color: '#22c55e' }}>Built &mdash; edges classified, differential spread decay</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Stellate neurons</td>
              <td>
                <strong>Role-local neurons.</strong> The typical L3&ndash;L5 neuron with co-firing edges primarily within its own
                department. Local processing with stellate decay (0.3) and lower spread threshold. Spread activation
                uses differential thresholds based on whether the edge crosses a department boundary.
              </td>
              <td style={{ color: '#22c55e' }}>Built &mdash; stellate decay + pyramidal min_weight</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Granule cells</td>
              <td>
                <strong>Semantic embeddings.</strong> Pattern separation / expansion recoding &mdash; 384-dim vectors that project
                neuron content into high-dimensional space where similar-but-different concepts become distinguishable.
                &ldquo;Thermal protection system&rdquo; vs &ldquo;thermal management system&rdquo; share keywords but
                are separable in embedding space.
              </td>
              <td style={{ color: '#22c55e' }}>Already built (all 2,054 neurons embedded)</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Purkinje cells</td>
              <td>
                <strong>Prompt assembler.</strong> Massive fan-in (all scored neurons) &rarr; single coherent output (assembled prompt).
                Future improvement: coherence-aware ordering and active redundancy suppression during assembly.
              </td>
              <td style={{ color: 'var(--text-dim)' }}>Low priority &mdash; current assembler works</td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ color: '#ef4444', marginTop: 24, marginBottom: 8 }}>Neurotransmitter Types</h4>
        <table className="about-table">
          <thead>
            <tr><th>Biological</th><th>Yggdrasil Analogue</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Glutamatergic (excitatory)</td>
              <td>
                <strong>Relevance signal + gating mechanism.</strong> Without excitatory input (semantic similarity),
                modulatory signals are attenuated to 5% background. Already correctly modeled as the stimulus gate
                in <code>compute_score</code>.
              </td>
              <td style={{ color: '#22c55e' }}>Already built</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>GABAergic (inhibitory)</td>
              <td>
                <strong>Inhibitory regulator nodes.</strong> ~60 persistent objects (1 per department + 1 per role) that
                monitor regional activation density and suppress over-represented regions. They prevent a single role from
                monopolizing the context window. They <strong>learn</strong> from utility feedback &mdash; strengthening
                inhibition when suppression improves outcomes, weakening it when suppression hurts.
              </td>
              <td style={{ color: '#22c55e' }}>Built &mdash; 3-pass inhibitory regulation</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Chandelier cells</td>
              <td>
                <strong>Redundancy suppression + modulatory ceiling.</strong> Chandelier cells synapse at the axon initial
                segment &mdash; uniquely powerful veto authority. In Yggdrasil: pairwise embedding comparison within
                top-K per department, suppressing near-duplicate neurons ({'>'}92% cosine similarity). Prevents
                near-duplicate knowledge from consuming multiple top-K slots.
              </td>
              <td style={{ color: '#22c55e' }}>Built &mdash; Pass 2 of inhibitory regulation</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Neuromodulatory (dopamine, serotonin, norepinephrine)</td>
              <td>
                <strong>The 5 modulatory scoring signals.</strong> These are correctly modeled as global parameters
                (volume transmitters), not separate objects. Impact = dopamine (reward learning), Burst + Novelty =
                norepinephrine (alertness/attention), Recency + Precision = serotonin (state/gain control).
              </td>
              <td style={{ color: '#22c55e' }}>Already built</td>
            </tr>
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Implementation Phases">

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>Phase 1: Schema (Additive, Non-Breaking)</h4>
        <p>All changes are additive. No existing data modified. Instant rollback by disabling feature flags.</p>
        <table className="about-table">
          <thead>
            <tr><th>Change</th><th>File</th><th>Details</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>InhibitoryRegulator</code> model</td>
              <td><code>models.py</code></td>
              <td>
                New table: <code>id</code>, <code>region_type</code> (department/role_key/layer),
                <code>region_value</code>, <code>inhibition_strength</code> (learned, 0&ndash;1),
                <code>activation_threshold</code> (default 15), <code>max_survivors</code> (default 8),
                <code>redundancy_cosine_threshold</code> (default 0.92), learning counters
                (<code>total_suppressions</code>, <code>total_activations</code>,
                <code>avg_post_suppression_utility</code>), <code>is_active</code>, <code>created_at</code>
              </td>
            </tr>
            <tr>
              <td><code>edge_type</code> column</td>
              <td><code>models.py</code></td>
              <td>
                Add to <code>NeuronEdge</code>: <code>edge_type VARCHAR(20) DEFAULT &apos;pyramidal&apos;</code>.
                Existing edges default to pyramidal. Classification into pyramidal vs stellate based on whether
                source and target share a department.
              </td>
            </tr>
            <tr>
              <td>Config parameters</td>
              <td><code>config.py</code></td>
              <td>
                <code>semantic_prefilter_enabled</code>, <code>semantic_prefilter_top_n</code> (250),
                <code>semantic_prefilter_min_similarity</code> (0.15), <code>inhibition_enabled</code>,
                <code>inhibition_default_threshold</code> (15), <code>inhibition_default_max_survivors</code> (8),
                <code>inhibition_redundancy_cosine</code> (0.92), <code>inhibition_learning_alpha</code> (0.2),
                <code>spread_stellate_decay</code> (0.3), <code>spread_chandelier_factor</code> (-0.2)
              </td>
            </tr>
            <tr>
              <td>Migrations</td>
              <td><code>main.py</code></td>
              <td>Add migration blocks in lifespan for new table and column</td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ marginTop: 24, marginBottom: 8 }}>Phase 2: Semantic Pre-Filter Service</h4>
        <p>New file: <code>app/services/semantic_prefilter.py</code></p>
        <ul className="about-features">
          <li>
            <strong>In-process embedding cache</strong> &mdash; On first query, load all ~2,054 neuron embeddings into a
            numpy matrix (~3MB). Cache invalidated on neuron create/update/embed.
          </li>
          <li>
            <strong>Pre-filter function</strong> &mdash; Matrix dot product of query embedding against all neurons (~1ms).
            Return top-N (default 250) with pre-computed similarity scores.
          </li>
          <li>
            <strong>Replaces <code>get_neurons_by_filter</code></strong> &mdash; No department/role WHERE clause.
            The embedding is the filter. Every neuron is a candidate if semantically close enough.
          </li>
        </ul>

        <h4 style={{ marginTop: 24, marginBottom: 8 }}>Phase 3: Rewire the Executor Pipeline</h4>
        <p>File: <code>app/services/executor.py</code></p>
        <ul className="about-features">
          <li>
            <strong>Parallel execution</strong> &mdash; <code>embed_query</code> + <code>semantic_prefilter</code> (~11ms)
            runs concurrently with <code>classify_query</code> (~200ms) via <code>asyncio.gather</code>
          </li>
          <li>
            <strong>Classifier output demoted</strong> &mdash; Departments/roles become scoring boosts (1.25&times;/1.5&times;
            multipliers, already in <code>compute_score</code>), not filter criteria
          </li>
          <li>
            <strong>Feature flag</strong> &mdash; <code>semantic_prefilter_enabled</code> gates the new path.
            When False, falls back to old <code>get_neurons_by_filter</code>.
          </li>
        </ul>

        <h4 style={{ marginTop: 24, marginBottom: 8 }}>Phase 4: Update Score Candidates</h4>
        <p>File: <code>app/services/neuron_service.py</code></p>
        <ul className="about-features">
          <li>
            <strong>Accept <code>SemanticCandidate</code></strong> which carries pre-computed similarity &mdash;
            skip redundant embedding load in <code>score_candidates</code>
          </li>
          <li>
            Old <code>get_neurons_by_filter</code> and <code>apply_diversity_floor</code> stay in the file for rollback
          </li>
        </ul>

        <h4 style={{ marginTop: 24, marginBottom: 8 }}>Phase 5: Inhibitory Regulation Service</h4>
        <p>New file: <code>app/services/inhibitory_regulator.py</code></p>
        <p>Replaces <code>apply_diversity_floor</code> with a 3-pass biologically-inspired inhibition mechanism:</p>
        <table className="about-table">
          <thead>
            <tr><th>Pass</th><th>Biological Analogue</th><th>Function</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Regional density</td>
              <td>Basket cell</td>
              <td>
                Count neurons per region in top-K. If count exceeds <code>activation_threshold</code>,
                suppress lowest-scoring neurons in that region down to <code>max_survivors</code>.
                Suppression = multiply score by <code>(1 - inhibition_strength)</code>.
              </td>
            </tr>
            <tr>
              <td>2. Redundancy</td>
              <td>Chandelier cell</td>
              <td>
                Compare top-K neurons pairwise by embedding cosine similarity.
                If two neurons are {'>'}92% similar, suppress the lower scorer.
                Prevents near-duplicate knowledge from consuming multiple top-K slots.
              </td>
            </tr>
            <tr>
              <td>3. Floor guarantee</td>
              <td>Martinotti cell</td>
              <td>
                After suppression, check if cross-referenced departments have zero representation.
                Pull in 1 highest-scoring candidate per underrepresented department.
                Preserves the intent of the old diversity floor with lighter touch.
              </td>
            </tr>
          </tbody>
        </table>
        <p><strong>Learning rule:</strong> After each query receives a utility rating:</p>
        <ul className="about-features">
          <li>High utility after suppression &rarr; strengthen inhibition (+0.02)</li>
          <li>Low utility after suppression &rarr; weaken inhibition (-0.05, faster correction)</li>
          <li>Asymmetric learning: loosening is faster than tightening (biological precedent: LTD is faster than LTP for inhibitory synapses)</li>
        </ul>

        <h4 style={{ marginTop: 24, marginBottom: 8 }}>Phase 6: Typed Edge Spreading Activation</h4>
        <p>File: <code>app/services/neuron_service.py</code> (modify <code>spread_activation</code>)</p>
        <table className="about-table">
          <thead>
            <tr><th>Edge Type</th><th>Biological Analogue</th><th>Behavior</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Stellate</strong> (intra-department)</td>
              <td>Local interneuron</td>
              <td>Lower threshold (0.10), broader local spread. Liberal within a domain.</td>
            </tr>
            <tr>
              <td><strong>Pyramidal</strong> (cross-department)</td>
              <td>Long-range excitatory</td>
              <td>Higher threshold (0.20), requires proven association. Only strong cross-domain edges propagate.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Edge classification is computed from existing co-firing data: if source and target neurons share a department,
          the edge is stellate; if they span departments, it&rsquo;s pyramidal. Existing edges are reclassified, not recreated.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="What Stays, What Changes, What Dies">
        <table className="about-table">
          <thead>
            <tr><th>Component</th><th>Fate</th></tr>
          </thead>
          <tbody>
            <tr><td><code>classify_query</code> (Haiku)</td><td style={{ color: '#22c55e' }}>Stays &mdash; extracts intent/dept/role/keywords, but output is scoring context, not filter criteria</td></tr>
            <tr><td><code>get_neurons_by_filter</code></td><td style={{ color: '#ef4444' }}>Dies &mdash; replaced by <code>semantic_prefilter</code></td></tr>
            <tr><td><code>score_candidates</code></td><td style={{ color: '#fb923c' }}>Modified &mdash; accepts pre-computed similarity, skips redundant embedding load</td></tr>
            <tr><td><code>apply_diversity_floor</code></td><td style={{ color: '#ef4444' }}>Dies &mdash; replaced by inhibitory regulators</td></tr>
            <tr><td><code>spread_activation</code></td><td style={{ color: '#fb923c' }}>Modified &mdash; typed edge support, differential thresholds</td></tr>
            <tr><td><code>compute_score</code></td><td style={{ color: '#22c55e' }}>Stays &mdash; gated modulatory model unchanged</td></tr>
            <tr><td><code>prompt_assembler</code></td><td style={{ color: '#22c55e' }}>Stays &mdash; unchanged</td></tr>
            <tr><td>Dept/role on Neuron</td><td style={{ color: '#22c55e' }}>Stays as metadata &mdash; display, classifier boost, regulator regions</td></tr>
            <tr><td>Embeddings</td><td style={{ color: '#22c55e' }}>Stays, becomes primary &mdash; backbone of candidate selection</td></tr>
            <tr><td><code>prepare_context()</code></td><td style={{ color: '#22c55e' }}>New &mdash; extracted from <code>execute_query()</code> for reuse by MCP server and REST API</td></tr>
            <tr><td><code>mcp_server.py</code></td><td style={{ color: '#22c55e' }}>New &mdash; MCP stdio server exposing 7 tools (query_graph, impact_analysis, neuron_detail, browse_departments, graph_stats, cost_report, discover_clusters)</td></tr>
            <tr><td><code>structural_resolver.py</code></td><td style={{ color: '#22c55e' }}>New &mdash; deterministic fast path for structural queries (zero API cost)</td></tr>
            <tr><td><code>project_cache.py</code></td><td style={{ color: '#22c55e' }}>New &mdash; per-project neuron relevance tracking with boost multiplier (1.0&ndash;1.3&times;)</td></tr>
            <tr><td><code>clustering.py</code></td><td style={{ color: '#22c55e' }}>New &mdash; label propagation on co-firing edges for emergent cross-department cluster discovery</td></tr>
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Rollback Safety">
        <p>Two feature flags in <code>config.py</code> / <code>.env</code>:</p>
        <pre className="about-tree">{`SEMANTIC_PREFILTER_ENABLED=true   # false → revert to org-chart filtering
INHIBITION_ENABLED=true           # false → revert to static diversity floor`}</pre>
        <p>
          Old functions (<code>get_neurons_by_filter</code>, <code>apply_diversity_floor</code>) remain in the codebase
          until the new system is validated. All schema changes are additive &mdash; no columns removed, no data modified.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Risks">
        <table className="about-table">
          <thead>
            <tr><th>Risk</th><th>Mitigation</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>L0&ndash;L1 ancestor neurons have generic content, score low semantically</td>
              <td>Always include hierarchical ancestors of any top-N candidate (structural inclusion rule)</td>
            </tr>
            <tr>
              <td>Sparse regions ({'<'}5 neurons) over-suppressed by inhibitory regulators</td>
              <td>Auto-calibrate thresholds on seed; <code>activation_threshold</code> must exceed region size</td>
            </tr>
            <tr>
              <td>Embedding cache memory at scale (200K+ neurons)</td>
              <td>2K neurons = 3MB (fine). At 200K, switch to float16 (150MB) or mmap. Not a concern now.</td>
            </tr>
            <tr>
              <td>Regression in eval quality from pipeline change</td>
              <td>Feature flags allow instant rollback. Run both pipelines in parallel on sample queries before switching.</td>
            </tr>
          </tbody>
        </table>
      </CollapsibleSection>

      <CollapsibleSection title="Research Context">
        <p>
          This architecture emerged from observing that an untrained biomimetic neuron model defaults to basic RAG.
          Without differential experience, the only discriminative signal is keyword matching &mdash; functionally
          equivalent to string-match retrieval. The progression:
        </p>
        <ol>
          <li><strong>Cold start (RAG equivalent)</strong> &mdash; No experience, keyword matching only. Where we started.</li>
          <li><strong>Cortical topography (semantic embeddings)</strong> &mdash; Pre-wired evolutionary priors via 384-dim vectors. Implemented 2026-03-10.</li>
          <li><strong>Gated modulatory activation</strong> &mdash; Relevance gates modulatory signals; neurons can&rsquo;t fire without stimulus. Implemented 2026-03-10.</li>
          <li><strong>Neuron type differentiation</strong> &mdash; Inhibitory regulators, typed edges, pyramidal/stellate distinction. This plan.</li>
          <li><strong>Experience-dependent plasticity</strong> &mdash; As query volume grows, modulatory signals differentiate, co-firing edges form genuine associations, inhibitory regulators learn optimal suppression levels. Ongoing.</li>
        </ol>
        <p>
          The insight that these stages mirror real neural development (genetic pre-wiring &rarr; cell type differentiation
          &rarr; experience-dependent plasticity) suggests the underlying architecture is biologically sound. Each stage
          solves a specific, observable problem rather than adding complexity for its own sake.
        </p>
      </CollapsibleSection>

      <CollapsibleSection title="Completed Work">
        <p>Groundwork implemented on 2026-03-10:</p>
        <ul className="about-features">
          <li><strong>Semantic embeddings</strong> &mdash; All 2,054 neurons embedded with <code>all-MiniLM-L6-v2</code> (384-dim). Stored in <code>neurons.embedding</code> column.</li>
          <li><strong>Gated modulatory scoring</strong> &mdash; <code>compute_score</code> split into stimulus + gated modulation. Gate threshold 0.3, floor 0.05.</li>
          <li><strong>Semantic relevance</strong> &mdash; <code>score_candidates</code> computes cosine similarity when embeddings available, replacing keyword matching as the relevance signal.</li>
          <li><strong>Query embedding</strong> &mdash; <code>executor.py</code> embeds the user query in a thread pool and passes through the scoring pipeline.</li>
          <li><strong>Embedding admin endpoint</strong> &mdash; <code>POST /admin/embed-neurons</code> to batch-embed all neurons.</li>
        </ul>
        <p>Full architecture implemented on 2026-03-11:</p>
        <ul className="about-features">
          <li><strong>Semantic prefilter</strong> &mdash; In-memory numpy matrix of all neuron embeddings (~3MB). Matrix dot product for O(1ms) cosine ranking. Replaces org-chart filtering as primary candidate selection.</li>
          <li><strong>3-pass inhibitory regulation</strong> &mdash; (1) Regional density/basket cell: per-dept threshold + max_survivors. (2) Redundancy/chandelier cell: cosine {'>'} 0.92 within dept. (3) Cross-ref floor/Martinotti cell: minimum dept representation. Returns survivor_count as effective top-K.</li>
          <li><strong>Typed edges</strong> &mdash; Stellate (intra-department, decay=0.3) vs pyramidal (cross-department, min_weight=0.20). Edge classification via <code>POST /admin/classify-edges</code>.</li>
          <li><strong>Parallel classify + embed</strong> &mdash; <code>asyncio.create_task</code> for both; embed failure is non-fatal fallback to keyword scoring.</li>
          <li><strong>Dynamic candidate pool</strong> &mdash; <code>candidate_pool</code> param flows from UI dual-dot slider &rarr; API &rarr; executor &rarr; semantic_prefilter as <code>top_n_override</code>.</li>
          <li><strong>Cache-aware cost calculation</strong> &mdash; Separated base_input (1x), cache_creation (1.25x), cache_read (0.10x) pricing. Reduced reported costs ~47%.</li>
          <li><strong>Per-slot runtime timing</strong> &mdash; <code>duration_ms</code> per slot + live elapsed timer in Query Lab.</li>
          <li><strong>Activation graph</strong> &mdash; Force-directed co-firing network replacing radial spoke diagram. Hover-only labels, department-colored nodes.</li>
          <li><strong>System prompt override</strong> &mdash; Raw mode uses <code>--system-prompt</code> CLI flag to prevent built-in prompt injection.</li>
        </ul>
        <p>GitNexus-inspired enhancements implemented on 2026-03-13:</p>
        <ul className="about-features">
          <li><strong>MCP server mode</strong> &mdash; 7-tool stdio MCP server for Claude Code integration. <code>query_graph</code> runs the full pipeline without LLM execution. Shares PostgreSQL connection pool with FastAPI.</li>
          <li><strong>Structural fast path</strong> &mdash; Regex-based resolver for deterministic queries (list departments, roles in X, neurons about Y, graph stats, neuron connections). Zero API cost, bypasses Haiku classification entirely.</li>
          <li><strong>Per-project neuron caching</strong> &mdash; <code>ProjectProfile</code> model tracks neuron relevance per project path. After 3+ queries, frequently useful neurons get a 1.0&ndash;1.3&times; scoring boost.</li>
          <li><strong>Auto-clustering</strong> &mdash; Label propagation on co-firing edges discovers cross-department neuron clusters. API endpoint + MCP tool + autopilot gap source for emergent cluster coverage.</li>
          <li><strong>prepare_context() extraction</strong> &mdash; Core pipeline (classify &rarr; score &rarr; spread &rarr; inhibit &rarr; assemble) extracted into a standalone async function, enabling both MCP and REST API to share the same pipeline code.</li>
        </ul>
      </CollapsibleSection>

      {/* ── Security Compliance Roadmap ── */}
      <CollapsibleSection title="Security Compliance Roadmap" defaultOpen style={{ background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Cross-sectional implementation plan addressing <strong>FedRAMP Moderate</strong> (259 controls),{' '}
          <strong>SOC 2 Type II</strong> (51 criteria), and <strong>CMMC Level 2</strong> (110 practices).
          Each item maps to specific controls across all three frameworks. Items are ordered by effort-to-impact ratio.
        </p>
        <div className="stat-cards" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="card-value" style={{ color: '#22c55e' }}>
              {[...TIER_1, ...TIER_2, ...TIER_3].filter(i => i.status === 'done').length}
            </div>
            <div className="card-label">Done</div>
          </div>
          <div className="stat-card">
            <div className="card-value" style={{ color: '#3b82f6' }}>
              {[...TIER_1, ...TIER_2, ...TIER_3].filter(i => i.status === 'in-progress').length}
            </div>
            <div className="card-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="card-value" style={{ color: '#fb923c' }}>
              {[...TIER_1, ...TIER_2, ...TIER_3].filter(i => i.status === 'planned').length}
            </div>
            <div className="card-label">Planned</div>
          </div>
          <div className="stat-card">
            <div className="card-value">
              {TIER_1.length + TIER_2.length + TIER_3.length}
            </div>
            <div className="card-label">Total Items</div>
          </div>
        </div>

        <RoadmapTier
          title="Tier 1: Quick Wins"
          subtitle="One-line to small code changes, each under 30 minutes"
          items={TIER_1}
          color="#22c55e"
        />
        <RoadmapTier
          title="Tier 2: Small Features"
          subtitle="1-3 hour implementation tasks, moderate impact"
          items={TIER_2}
          color="#3b82f6"
        />
        <RoadmapTier
          title="Tier 3: Documentation"
          subtitle="No code changes — formal policy and procedure documents"
          items={TIER_3}
          color="#8b5cf6"
        />
      </CollapsibleSection>
    </div>
  );
}
