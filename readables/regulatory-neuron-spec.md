# Authoritative Source Neuron Architecture — Design Specification

## Problem Statement

Operational neurons capture experiential knowledge that evolves slowly and has no single authoritative source. Two other knowledge domains share a fundamentally different set of properties:

**Regulatory knowledge** (FAR/DFARS, ITAR, NIST, AS9100D) and **technical reference knowledge** (language specs, framework APIs, protocol definitions) are both:

1. **Authoritatively sourced** — FAR 52.227-14 says what it says. `DataFrame.join()` takes the parameters it takes. A paraphrased neuron is a liability if the paraphrase is wrong.
2. **Version-controlled externally** — Federal Register updates change regulations. Python 3.12 deprecates APIs. A neuron correct in January may be wrong in March.
3. **Hierarchically structured** — Statute → regulation → agency interpretation → compliance procedure. Language spec → framework API → official guide → community pattern → project convention.
4. **Citation-dependent** — A regulatory neuron without a CFR citation is an opinion. A technical neuron without a docs reference is a guess.

The current neuron model treats all content as homogeneous. This spec introduces:
- **Source-typed neurons** with provenance tracking and staleness detection
- **External reference detection** on every neuron, tagging references to regulations, standards, and technical APIs
- **Emergent neurons** — just-in-time knowledge acquisition triggered when the system detects unresolved external references
- **Gap analytics** — using emergent patterns to map what the system doesn't know

### The Parallel

| Property | Regulatory | Technical |
|----------|-----------|-----------|
| Authoritative source | CFR, NIST, standards bodies | Language docs, framework APIs, RFCs |
| Version schedule | Federal Register, standards revisions | Language releases, library semver |
| Primary content | Verbatim clause/requirement | Verbatim signature, syntax, behavior |
| Interpretive content | Agency guidance, case law, holdings | Official guides, migration docs, known gotchas |
| Operational application | Compliance procedures | Project implementation patterns |
| Staleness trigger | New rule, amended clause, class deviation | New version, deprecated API, breaking change |
| Citation format | `48 CFR 52.227-14` | `Python 3.12 > asyncio.TaskGroup` |

---

## Data Model Changes

### New Fields on `Neuron`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `source_type` | VARCHAR(20) | `"operational"` | See source type taxonomy below |
| `source_origin` | VARCHAR(20) | `"seed"` | How the neuron was created: `"seed"`, `"bolster"`, `"autopilot"`, `"manual"`, `"ingested"`, `"emergent"` |
| `citation` | VARCHAR(500) | NULL | Formal citation (e.g., `48 CFR 52.227-14`, `Python 3.12 > asyncio.TaskGroup`) |
| `effective_date` | DATE | NULL | Date the source became effective (regulation effective date or version release date) |
| `last_verified` | DATETIME | NULL | Last time a human confirmed this neuron matches the current source |
| `source_url` | VARCHAR(500) | NULL | URL to authoritative source (eCFR, NIST, Python docs, MDN, etc.) |
| `superseded_by` | INTEGER (FK) | NULL | Neuron ID of the replacement if this version is outdated |
| `source_version` | VARCHAR(50) | NULL | Version identifier (e.g., `Python 3.12`, `React 19`, `FAR 2024-01`, `NIST Rev 3`) |
| `external_references` | TEXT (JSON) | NULL | Detected external references with resolution status (see below) |

### Source Type Taxonomy

| `source_type` | Domain | Description | Content Rules |
|---------------|--------|-------------|---------------|
| `operational` | Both | Experiential knowledge, organizational procedures | LLM-generated or human-written. No citation required. |
| `regulatory_primary` | Legal/Regulatory | Verbatim regulatory text | Never LLM-paraphrased. Citation and effective_date required. |
| `regulatory_interpretive` | Legal/Regulatory | Agency guidance, case holdings, compliance interpretations | Citation required. Must edge to the primary it interprets. |
| `technical_primary` | Technical | Language specs, API signatures, syntax rules, protocol definitions | Never LLM-paraphrased. Citation and source_version required. |
| `technical_pattern` | Technical | Official guides, best practices, migration patterns, known gotchas | Citation recommended. Must edge to the primary it applies to. |

### Source Origin Taxonomy

| `source_origin` | Description |
|-----------------|-------------|
| `seed` | Created during initial graph seeding from YAML |
| `bolster` | Created via bolster pipeline (LLM-proposed, human-reviewed) |
| `autopilot` | Created via autopilot training loop |
| `manual` | Manually created or edited by a human |
| `ingested` | Created via the authoritative source ingestion pipeline |
| `emergent` | Created via the emergent neuron pipeline (gap-triggered acquisition) |

### External References Field

The `external_references` field is a JSON array computed on neuron create/update. It stores every detected reference to an external authoritative source, along with its resolution status:

```json
[
  {
    "pattern": "MIL-STD-1472",
    "domain": "regulatory",
    "family": "MIL-STD",
    "resolved_neuron_id": 2341,
    "resolved_at": "2026-03-01T14:30:00Z"
  },
  {
    "pattern": "ASME Y14.5 §6.4",
    "domain": "regulatory",
    "family": "ASME",
    "resolved_neuron_id": null,
    "resolved_at": null
  },
  {
    "pattern": "DataFrame.groupBy()",
    "domain": "technical",
    "family": "PySpark",
    "resolved_neuron_id": 1456,
    "resolved_at": "2026-02-15T09:00:00Z"
  }
]
```

- Computed automatically by scanning `content` and `summary` against known citation patterns
- Updated when new primary/technical neurons are ingested (previously unresolved references may become resolved)
- Unresolved references feed the emergent queue automatically

### New Table: `emergent_queue`

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `citation_pattern` | VARCHAR(200) | The detected reference string (e.g., `MIL-STD-1472`) |
| `domain` | VARCHAR(20) | `"regulatory"` or `"technical"` |
| `family` | VARCHAR(50) | Citation family (e.g., `FAR`, `DFARS`, `MIL-STD`, `ASME`, `Python`, `PySpark`) |
| `detection_count` | INTEGER | Number of times this reference has been detected across neurons/queries (increments on each new detection) |
| `first_detected_at` | DATETIME | Timestamp of first detection |
| `last_detected_at` | DATETIME | Timestamp of most recent detection |
| `detected_in_neuron_ids` | TEXT (JSON) | Array of neuron IDs that contain this reference |
| `detected_in_query_ids` | TEXT (JSON) | Array of query IDs where this reference appeared in assembled context |
| `status` | VARCHAR(20) | `"pending"`, `"in_progress"`, `"resolved"`, `"dismissed"` |
| `resolved_neuron_id` | INTEGER (FK) | Neuron ID created to resolve this reference (NULL until resolved) |
| `resolved_at` | DATETIME | When the reference was resolved |
| `notes` | TEXT | Human notes (e.g., "proprietary standard, cannot ingest", "superseded by X") |

### Migration

```sql
ALTER TABLE neurons ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'operational';
ALTER TABLE neurons ADD COLUMN source_origin VARCHAR(20) NOT NULL DEFAULT 'seed';
ALTER TABLE neurons ADD COLUMN citation VARCHAR(500);
ALTER TABLE neurons ADD COLUMN effective_date DATE;
ALTER TABLE neurons ADD COLUMN last_verified DATETIME;
ALTER TABLE neurons ADD COLUMN source_url VARCHAR(500);
ALTER TABLE neurons ADD COLUMN superseded_by INTEGER REFERENCES neurons(id);
ALTER TABLE neurons ADD COLUMN source_version VARCHAR(50);
ALTER TABLE neurons ADD COLUMN external_references TEXT;

CREATE TABLE emergent_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citation_pattern VARCHAR(200) NOT NULL,
    domain VARCHAR(20) NOT NULL,
    family VARCHAR(50),
    detection_count INTEGER NOT NULL DEFAULT 1,
    first_detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detected_in_neuron_ids TEXT NOT NULL DEFAULT '[]',
    detected_in_query_ids TEXT NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolved_neuron_id INTEGER REFERENCES neurons(id),
    resolved_at DATETIME,
    notes TEXT
);
```

Existing neurons get `source_type = 'operational'` and `source_origin = 'seed'` by default. No existing content changes.

---

## External Reference Detection

### Detection Engine

A deterministic pattern matcher that scans neuron `content` and `summary` for references to external authoritative sources. Runs on:
- Neuron creation (any origin: seed, bolster, autopilot, manual, ingested, emergent)
- Neuron content update (refinement, re-verification)
- Bulk retroactive scan (one-time for existing neurons)

### Citation Patterns

#### Regulatory Patterns

| Family | Regex Pattern | Examples |
|--------|--------------|----------|
| FAR | `FAR\s+\d+\.\d+` | FAR 31.205-6, FAR 52.227-14 |
| DFARS | `DFARS\s+\d+\.\d+` | DFARS 252.204-7012 |
| ITAR | `ITAR\s+§?\d+\.\d+` | ITAR §120.6, ITAR 121.1 |
| EAR | `EAR\s+§?\d+\.\d+` | EAR §730.3 |
| CFR | `\d+\s+CFR\s+\d+` | 48 CFR 52.227, 22 CFR 120 |
| NIST | `NIST\s+SP\s+\d+-\d+` | NIST SP 800-171, NIST SP 800-53 |
| MIL-STD | `MIL-STD-\d+[A-Z]?` | MIL-STD-1472, MIL-STD-810H |
| MIL-SPEC | `MIL-[A-Z]+-\d+` | MIL-PRF-31032, MIL-DTL-5015 |
| AS/AS9100 | `AS\s?\d+[A-Z]?` | AS9100D, AS9102, AS6081 |
| DO standards | `DO-\d+[A-Z]?` | DO-178C, DO-254, DO-160G |
| ASME | `ASME\s+[A-Z]\d+` | ASME Y14.5, ASME B31.3 |
| NADCAP | `NADCAP\s+[A-Z]+\d*` | NADCAP AC7004, NADCAP AC7114 |
| ISO | `ISO\s+\d+` | ISO 9001, ISO 27001 |
| SAE | `SAE\s+(AS|AMS|ARP|J)\d+` | SAE AS6500, SAE AMS 2750 |
| OSHA | `OSHA\s+\d+\.\d+` | OSHA 1910.134 |
| ASTM | `ASTM\s+[A-Z]\d+` | ASTM D3039, ASTM E1351 |

#### Technical Patterns

| Family | Detection Heuristic | Examples |
|--------|-------------------|----------|
| Python | Backtick or code-block containing known stdlib/common library references | `asyncio.TaskGroup`, `dataclasses.field()` |
| PySpark | `DataFrame.`, `SparkSession.`, `pyspark.sql.functions.` | `DataFrame.join()`, `F.col()` |
| SQLAlchemy | `select(`, `Session.`, `mapped_column`, `Mapped[` | `session.execute(select(...))` |
| SQL | `SELECT`, `MERGE INTO`, `CREATE TABLE`, window function syntax | `ROW_NUMBER() OVER (PARTITION BY ...)` |
| React | `use[A-Z]` hooks, `React.` | `useEffect()`, `useState()`, `React.memo` |
| FastAPI | `Depends(`, `APIRouter`, `@router.` | `Depends(get_db)` |
| Delta Lake | `DeltaTable.`, `MERGE INTO`, `OPTIMIZE`, `VACUUM` | `DeltaTable.forPath()` |
| Node.js | `require(`, `import ... from`, known core modules | `fs.readFile()`, `EventEmitter` |

Technical detection is fuzzier than regulatory — many code references are generic. The detector uses a known-library registry to reduce false positives. Unrecognized backtick code is ignored rather than queued.

### Resolution Check

When a reference is detected, the system checks:

1. Does a neuron with matching `citation` field exist where `source_type` is primary or technical_primary? → **Resolved.** Store `resolved_neuron_id`.
2. Does an `emergent_queue` entry with matching `citation_pattern` already exist?
   - Yes and status is `resolved` → link to the resolved neuron
   - Yes and status is `pending` → increment `detection_count`, add neuron/query ID to tracking arrays, update `last_detected_at`
   - No → create new queue entry with `status = 'pending'`

### Retroactive Scan: `POST /admin/scan-references`

One-time bulk scan of all existing neurons. Populates `external_references` for every neuron and seeds the emergent queue with all unresolved references. This is the "citation mining" step — run once to establish the baseline, then incremental detection handles new neurons.

**Output:**
```json
{
  "neurons_scanned": 1843,
  "neurons_with_references": 412,
  "total_references_found": 876,
  "resolved": 34,
  "unresolved": 842,
  "new_queue_entries": 187,
  "existing_queue_entries_incremented": 12,
  "top_unresolved_families": [
    {"family": "FAR", "count": 234},
    {"family": "MIL-STD", "count": 89},
    {"family": "AS", "count": 67},
    {"family": "ASME", "count": 45},
    {"family": "ITAR", "count": 38}
  ]
}
```

---

## Emergent Neuron Pipeline

### Concept

Emergent neurons are not pre-authored, not human-curated, not bolstered. They emerge from the system recognizing a reference it cannot resolve. The graph grows itself at the point of need.

This is the third self-organizing pathway in the graph:

| Pathway | Trigger | What Emerges |
|---------|---------|-------------|
| Co-firing edges | Two neurons fire together repeatedly | An emergent *relationship* — the edge didn't exist in the original graph |
| Spread activation | Multi-hop traversal discovers bridge neurons | An emergent *relevance* — the neuron wasn't directly related but is reachable |
| Emergent neurons | Unresolved citation detected in operational content | An emergent *node* — the graph grows itself at the point of need |

### Two-Tier Acquisition Strategy

#### Core References (Pre-Loaded)

References that appear in 5+ operational neurons across multiple roles. These are the foundational regulations and technical specs that the system needs to *recognize regulatory and technical territory when it encounters it*. Without these, the system can't identify that a query touches a FAR question or a PySpark API.

Identified by the retroactive scan (top-N citations by frequency). Pre-loaded via the ingestion pipeline. Estimated: 30-50 regulatory, 20-30 technical.

#### Emergent References (On-Demand)

Everything else — the long tail of specific clauses, niche MIL-STDs, edge-case API signatures. Acquired when the detection count crosses a threshold or when a human triggers acquisition from the queue.

### Acquisition Flow

1. **Triggering.** An emergent queue entry reaches acquisition threshold:
   - Automatic: `detection_count >= configurable_threshold` (default: 3)
   - Manual: human clicks "Acquire" in the Emergent Queue UI
   - Batch: human selects multiple queue entries and triggers batch acquisition

2. **Source location.** The system attempts to locate the authoritative source:
   - Regulatory: eCFR API (for CFR references), NIST website, standards body websites
   - Technical: official documentation URLs (docs.python.org, spark.apache.org, etc.)
   - If source cannot be located automatically, queue entry is flagged for manual source provision

3. **Ingestion.** Source text is fed through the standard ingestion pipeline:
   - LLM segments into clause/function-level neurons
   - Content validation against source text (drift detection)
   - Human reviews proposals (same UI as bolster review)
   - Approved neurons created with `source_origin = 'emergent'` and full provenance

4. **Resolution.** On neuron creation:
   - Queue entry updated: `status = 'resolved'`, `resolved_neuron_id = new_id`, `resolved_at = now()`
   - All neurons in `detected_in_neuron_ids` have their `external_references` updated with the resolved neuron ID
   - Edges created automatically between the new primary neuron and all neurons that referenced it
   - Other queue entries referencing sub-sections of the same source are flagged (e.g., resolving "FAR Part 31" may partially resolve "FAR 31.205-6")

5. **Verification.** Next time a query fires neurons that reference the newly resolved citation, spread activation can now traverse to the primary source. The answer improves without anyone having pre-loaded it.

### Non-Blocking Behavior

Emergent detection and queue population are **non-blocking** to the query pipeline. The flow is:
1. Query executes normally (classify → score → assemble → execute)
2. Post-execution, assembled neurons are scanned for unresolved references
3. Any new unresolved references are queued
4. Query response is returned immediately — the user doesn't wait for acquisition

The emergent queue is processed separately, either by background automation or human-triggered batch acquisition.

---

## Unified Knowledge Model

### Layer 1: Primary Sources

Verbatim, authoritative content. The LLM segments and structures it; the content comes from the source.

#### Regulatory Primary (`regulatory_primary`)

Direct representations of authoritative regulatory text.

**Content rules:**
- Verbatim or near-verbatim from the source — never LLM-paraphrased
- One neuron per clause, section, or discrete requirement
- `citation` required (e.g., `48 CFR 52.227-14(b)(1)`)
- `effective_date` required
- `source_url` should point to the canonical source (eCFR, NIST, standards body)

**Examples:**
- FAR 52.227-14 "Rights in Data — General" — each alt (Alt I, II, III, IV, V) as a separate neuron
- ITAR §120.6 "Defense article" definition
- NIST SP 800-171 Rev 3 §3.1.1 "Account Management"
- AS9100D §8.4.1 "Control of externally provided processes, products, and services"

**Hierarchy mapping:**
- L0: Department (e.g., "Contracts & Compliance")
- L1: Role (e.g., "FAR/DFARS Specialist")
- L2: Regulation/Standard (e.g., "FAR Part 52 — Solicitation Provisions and Contract Clauses")
- L3: Subpart/Section
- L4: Specific clause or requirement
- L5: Conditions, exceptions, or applicability notes

**What the LLM does:** Segments source documents into clause-level chunks, generates summaries and identifies parent-child relationships. The LLM proposes the structure; the content comes from the source.

**What the LLM does NOT do:** Generate, paraphrase, or "improve" primary source content. Ever.

#### Technical Primary (`technical_primary`)

Verbatim language specs, API signatures, syntax definitions.

**Content rules:**
- Exact syntax, parameters, return types, and behavior from official documentation
- One neuron per function/method/class/concept, or per syntax rule
- `citation` required (e.g., `Python 3.12 docs > asyncio.TaskGroup`)
- `source_version` required (e.g., `Python 3.12`, `SQLAlchemy 2.0`, `React 19`)
- `source_url` should link to official docs page

**Examples:**
- `DataFrame.join(other, on, how, lsuffix, rsuffix, sort, validate)` — exact parameters, types, default values, and behavior
- SQL `MERGE INTO` syntax — exact grammar from the SQL standard or database-specific docs
- `React.useEffect(setup, dependencies?)` — exact signature, cleanup behavior, dependency array rules
- `FastAPI Depends()` — injection mechanism, caching behavior, async support

**Hierarchy mapping:**
- L0: Department (e.g., "Engineering")
- L1: Role (e.g., "Data Engineer" or "Software Engineer")
- L2: Technology (e.g., "PySpark", "SQLAlchemy 2.0", "React 19")
- L3: Module/Category (e.g., "DataFrame Operations", "Session API", "Hooks")
- L4: Specific function/class/method
- L5: Parameters, edge cases, exceptions, deprecation notes

**What the LLM does:** Parses documentation into structured neuron proposals — extracting signatures, identifying parameter details, flagging deprecated APIs, suggesting parent-child relationships.

**What the LLM does NOT do:** Invent parameters, guess at behavior, or fill in gaps from training data. If the docs don't say it, the neuron doesn't say it.

### Layer 2: Interpretive Sources

How the rules apply — guidance, patterns, and established practice backed by authoritative context.

#### Regulatory Interpretive (`regulatory_interpretive`)

Agency guidance, case holdings, compliance interpretations.

**Content rules:**
- Must cite the specific guidance, decision, or memo
- Must reference the primary source neuron(s) it interprets (via edges)
- `citation` required (e.g., `DCAA CAM §6-410.3`, `ASBCA No. 62345`)
- Should include the holding or interpretation, not just a reference
- `superseded_by` used when newer guidance overrides

**Examples:**
- "DCAA considers IR&D costs allowable under FAR 31.205-18 when the contractor maintains adequate records linking IR&D projects to potential government benefit" (citing DCAA Contract Audit Manual §7-1200)
- "In *Raytheon Co.*, ASBCA No. 57576 (2015), the board held that the contractor's commercial item determination under FAR 12.101 was reasonable based on catalog pricing evidence"
- "DoD Class Deviation 2020-O0013 waives the requirement for certified cost or pricing data for contracts below $2M when..."

**Source hierarchy:**
- Agency guidance (DCAA CAM, DFARS PGI, DCMA instructions)
- Board/court decisions (ASBCA, CBCA, COFC, Federal Circuit)
- Class deviations and interim rules
- Industry consensus interpretations (NCMA, ABA PSCL)

#### Technical Pattern (`technical_pattern`)

Official guides, established patterns, migration strategies, known gotchas.

**Content rules:**
- Must reference the primary source neuron(s) it applies to (via edges)
- `citation` recommended (e.g., `Databricks docs > Medallion Architecture`, `React docs > You Might Not Need an Effect`)
- Should describe the pattern, when to use it, and when not to
- `source_version` recommended (patterns may be version-specific)

**Examples:**
- "SCD Type 2 pattern for slowly changing dimensions in Delta Lake: use `MERGE INTO` with hash comparison on business keys, insert new row with current timestamp, expire old row" (citing Databricks documentation)
- "SQLAlchemy 2.0 migration: replace `session.query(Model)` with `session.execute(select(Model))` — the legacy Query API is deprecated and will be removed in 3.0" (citing SQLAlchemy migration guide)
- "PySpark: avoid `collect()` on large DataFrames — it pulls all data to the driver. Use `take(n)` or `toPandas()` on aggregated results" (citing Spark performance tuning guide)
- "Known gotcha: `asyncio.TaskGroup` silently swallows `KeyboardInterrupt` in Python 3.11 — fixed in 3.12 via ExceptionGroup handling" (citing CPython issue tracker)

**Source hierarchy:**
- Official documentation guides and tutorials
- Official migration/upgrade guides
- Framework maintainer blog posts and RFCs
- Performance tuning guides and benchmarks
- CPython/framework issue trackers (for known bugs and gotchas)
- Established community consensus (e.g., widely-adopted patterns from major open-source projects)

### Layer 3: Operational (`operational`)

Existing neurons. No changes. These reference Layer 1 and Layer 2 neurons through edges rather than duplicating authoritative content.

**Regulatory cross-reference example:**
- Operational neuron: "When processing an export request, classify the item using the USML categories and check for ITAR applicability"
- Edge to regulatory_primary: ITAR §120.6 definition of "defense article"
- Edge to regulatory_interpretive: DDTC Advisory Opinion on classification of dual-use composites
- Edge to operational: Export Control Officer procedures for TAA preparation

**Technical cross-reference example:**
- Operational neuron: "Silver-layer transformation: join CDS view extracts on business key, apply SCD Type 2 logic, write to Delta table"
- Edge to technical_primary: PySpark `DataFrame.join()` API reference
- Edge to technical_primary: Delta Lake `MERGE INTO` syntax
- Edge to technical_pattern: SCD Type 2 pattern for medallion architecture
- Edge to operational: CDS view extract schedule and data quality checks

**Confidence decay:** Interpretive and pattern neurons older than a configurable threshold without re-verification get a scoring penalty. Default thresholds:
- `regulatory_interpretive`: 3 years (legal guidance changes slowly)
- `technical_pattern`: 18 months (technical patterns shift faster)
- `regulatory_primary` and `technical_primary`: no time-based decay (they're either current or superseded, not gradually stale)

---

## Ingestion Pipeline

### Shared Architecture

Both regulatory and technical ingestion follow the same pipeline pattern. Used for both pre-loaded core references and resolved emergent acquisitions.

1. User provides source text + metadata (citation prefix, source URL, version, parent neuron)
2. LLM segments the text into neuron-sized chunks
3. LLM generates labels, summaries, layer assignments, citations, and suggested edges
4. **Content validation:** pipeline compares proposed neuron content against original source text (cosine similarity). Drift below threshold flags for review.
5. Proposals returned for human review (same UI pattern as bolster)
6. Human approves/rejects/edits each proposed neuron
7. Approved neurons created with full provenance metadata, `last_verified = now()`, and appropriate `source_origin` (`"ingested"` for manual, `"emergent"` for queue-triggered)
8. **External reference detection** runs on the new neurons (they may reference other external sources)
9. **Automatic edge creation:** grep existing neurons for citation matches; update `external_references` on neurons that referenced this citation

### `POST /admin/ingest-source`

Unified endpoint for both regulatory and technical content.

**Request:**
```json
{
  "source_text": "... full text of source section ...",
  "source_type": "regulatory_primary | regulatory_interpretive | technical_primary | technical_pattern",
  "citation_prefix": "48 CFR 52.227 | Python 3.12 > asyncio",
  "source_url": "https://...",
  "source_version": "FAR 2024-01 | Python 3.12 | React 19",
  "effective_date": "2024-01-01",
  "parent_neuron_id": 456,
  "department": "Contracts & Compliance | Engineering",
  "role_key": "far_dfars | data_engineer | software_engineer",
  "interprets_neuron_ids": [123, 456],
  "emergent_queue_id": null
}
```

- `interprets_neuron_ids` only used for interpretive/pattern types — creates edges to those primary neurons automatically
- `effective_date` used for regulatory sources; `source_version` used for technical sources; both can be provided
- `emergent_queue_id` links to the queue entry that triggered this ingestion (if any). On completion, the queue entry is marked resolved.

### LLM Segmentation Prompts

**Primary sources:**
```
You are segmenting authoritative source material into individual knowledge neurons.

Rules:
- Preserve the source content verbatim. Do not paraphrase, simplify, or add commentary.
- One neuron per discrete clause, function, rule, or definition.
- Generate a concise label and 1-2 sentence summary for each neuron.
- Assign a layer (L2-L5) based on granularity.
- Generate a specific citation for each neuron using the provided prefix.
- Suggest edges to existing neurons if you see topical overlap (provide neuron IDs).

Source type: {source_type}
Citation prefix: {citation_prefix}
Existing neuron labels for edge suggestions: {existing_neuron_labels}
```

**Interpretive/pattern sources:**
```
You are segmenting interpretive or best-practice source material into individual knowledge neurons.

Rules:
- Capture the interpretation, holding, pattern, or recommendation accurately.
- Include the reasoning or conditions, not just the conclusion.
- One neuron per discrete interpretation, pattern, or recommendation.
- Generate a concise label and 1-2 sentence summary for each neuron.
- Identify which primary source neurons this content interprets or applies to.
- Flag any content that contradicts existing neurons (provide neuron IDs).

Source type: {source_type}
Citation prefix: {citation_prefix}
Related primary neuron IDs and labels: {primary_neuron_info}
```

---

## Staleness Detection

### Verification Sweep: `POST /admin/verify-sources`

Unified verification for both regulatory and technical sources.

**Detection signals:**

| Signal | Regulatory | Technical |
|--------|-----------|-----------|
| Time-based | `last_verified` > 12 months (primary), > 6 months (interpretive) | `last_verified` > 12 months (primary), > 18 months (pattern) |
| Source-change | HTTP Last-Modified or page hash on `source_url` | Same |
| External feed | Federal Register API for CFR changes | PyPI/npm release feeds, GitHub release tags, changelog RSS |
| Supersession | New interpretive neuron citing same primary | New version deprecation notice, migration guide |
| Version gap | N/A | `source_version` < current stable release of the technology |

**Version gap detection (technical only):**

The system maintains a `technology_versions` lookup:

```json
{
  "Python": "3.13",
  "SQLAlchemy": "2.0",
  "React": "19",
  "PySpark": "3.5",
  "FastAPI": "0.115"
}
```

Neurons with `source_version` below the current version are flagged. Manually maintained table updated when major releases ship.

**Action:** Stale neurons are flagged in the UI but NOT automatically modified or deactivated. A human reviews and either:
- Re-verifies (updates `last_verified` to now)
- Updates content and re-verifies
- Marks as superseded (sets `superseded_by` to replacement neuron ID, sets `is_active = false`)
- For version gaps: re-ingests from new version docs, creating new neurons and superseding old ones

### Scoring Integration

The scoring engine incorporates staleness as a modifier on the combined score:

- `last_verified` older than threshold → penalty (configurable weight, default 0.1)
- `superseded_by IS NOT NULL` → neuron excluded entirely (treated as `is_active = false`)
- Primary/interpretive/technical neurons without `citation` → flagged as data quality issue
- Version-gap neurons → reduced score but not excluded (old API may still be relevant if the project hasn't upgraded)

This is NOT a new scoring signal — it's a modifier applied only to non-operational source types.

---

## Cross-Referencing Strategy

### Automatic Edge Creation

When any non-operational neuron is ingested, the pipeline scans existing neurons for matches:

1. **Citation grep:** Search `content` and `summary` of all existing neurons for the new neuron's `citation` string. Match → edge with `weight = 0.5`.
2. **Reverse citation grep:** Search the new neuron's content for citations matching existing neurons. Match → edge with `weight = 0.5`.
3. **Explicit links:** `interprets_neuron_ids` from the ingestion request → edges with `weight = 0.6`.
4. **Technology co-occurrence:** For technical neurons, match on technology name (e.g., a new PySpark neuron auto-edges to existing PySpark neurons within the same role). Lower weight: `0.3`.
5. **External reference resolution:** All neurons whose `external_references` array contains the new neuron's citation get edges with `weight = 0.5`, and their `external_references` entry is updated with `resolved_neuron_id`.

These seeded edges participate in spread activation alongside co-fired edges.

### Cross-Domain Spread Activation

The most powerful cross-references are between domains:

- A query about "subcontractor data rights for a software deliverable" fires operational neurons about subcontracting, which spread-activate to `regulatory_primary` neurons about FAR 52.227-14, which spread-activate to `technical_pattern` neurons about open-source license compliance in deliverable software.
- A query about "building a CUI-compliant data pipeline" fires `operational` Data Engineer neurons, which spread to `regulatory_primary` NIST 800-171 controls, which spread to `technical_primary` PySpark encryption APIs.

Multi-hop spread with compounding decay naturally handles the distance — by hop 3, only paths through consistently high-weight edges survive.

### Diversity Floor Integration

When non-operational neurons fire, the diversity floor ensures mixed source types in the final assembly:
- At least 1 primary source neuron when interpretive/pattern neurons fire
- At least 1 operational neuron when regulatory/technical neurons fire
- Prevents pure-reference or pure-operational answers when the query spans both domains

---

## Gap Analytics

### Purpose

The emergent queue and external reference data together create a self-generating map of what the system doesn't know. This data feeds three use cases:

1. **Prioritizing ingestion work** — what should we pre-load next?
2. **Identifying structural gaps** — which roles/departments have weak authoritative coverage?
3. **Measuring system maturity** — what percentage of external references are resolved?

### Metrics

#### System-Wide

| Metric | Source | What It Tells You |
|--------|--------|-------------------|
| Total external references detected | `external_references` across all neurons | Scale of the reference surface area |
| Resolution rate | Resolved / total references | System maturity — how much of what it references does it actually have? |
| Unresolved references | References with `resolved_neuron_id = null` | Outstanding gaps |
| Queue depth | `emergent_queue WHERE status = 'pending'` | Backlog of acquisition work |
| Queue velocity | Resolved entries per week | How fast gaps are being closed |
| Repeat detection rate | Queue entries with `detection_count > 3` | High-priority gaps the system keeps hitting |

#### By Citation Family

| Family | Unresolved | Resolved | Resolution % | Avg Detection Count |
|--------|-----------|----------|-------------|-------------------|
| FAR | 234 | 12 | 4.9% | 3.2 |
| MIL-STD | 89 | 0 | 0% | 1.4 |
| PySpark | 45 | 23 | 33.8% | 2.1 |
| ... | ... | ... | ... | ... |

This tells you: "We have decent PySpark coverage but almost zero MIL-STD coverage, and FAR references are everywhere but almost none are resolved."

#### By Role/Department

| Department | Role | Neurons w/ References | Unresolved | Resolution % |
|-----------|------|----------------------|-----------|-------------|
| Engineering | Manufacturing Engineer | 87 | 62 | 28.7% |
| Contracts | FAR/DFARS Specialist | 23 | 18 | 21.7% |
| Engineering | Data Engineer | 45 | 12 | 73.3% |

This tells you: "Manufacturing Engineer neurons are full of unresolved MIL-STD and ASME references. Data Engineer is in better shape because we've ingested some PySpark docs."

#### By Source Origin

| Origin | Count | Avg Resolution Rate of References |
|--------|-------|---------------------------------|
| seed | 546 | 3.2% |
| bolster | 412 | 5.1% |
| autopilot | 834 | 7.8% |
| emergent | 23 | 95.2% |

This tells you: "Autopilot is generating the most neurons with external references, but emergent neurons have the best resolution rate because they're created specifically to resolve gaps."

### Gap Heat Map

A visual representation of which areas of the graph have the densest unresolved references. Dimensions:
- X axis: Department
- Y axis: Citation family (FAR, MIL-STD, ASME, Python, PySpark, etc.)
- Cell color: heat intensity based on unresolved reference count
- Cell click: drills down to the specific unresolved references

This is the single most useful view for deciding where to invest ingestion effort.

---

## UI Changes

### Nav Placement

Two new items added to the existing nav structure:

| Group | Item | Description |
|-------|------|-------------|
| **Improve** | Emergent Queue | Pending/resolved emergent references, acquisition triggers |
| **Evaluate** | Source Coverage | Gap analytics, resolution rates, heat map |

The existing Explorer, Dashboard, and Verification page get enhancements (described below) but no new nav items.

### Explorer Enhancements

- Source type badge next to each neuron:
  - `Reg. Primary` (blue)
  - `Reg. Interpretive` (amber)
  - `Tech Primary` (teal)
  - `Tech Pattern` (purple)
  - `Operational` (default, no badge)
- Source origin badge (smaller, secondary): `seed`, `bolster`, `autopilot`, `manual`, `ingested`, `emergent`
- Citation displayed below the label for non-operational neurons
- `source_version` displayed for technical neurons
- `last_verified` with color coding: green (<6 months), yellow (6-12 months), red (>12 months)
- Superseded neurons shown with strikethrough and link to successor
- **External references panel** (collapsible): lists all detected references with resolved/unresolved status, links to resolved primary neurons or "Queue" link for unresolved

### Dashboard Enhancements

- New card: "Source Neurons" with count by source type (5-segment bar)
- New card: "Reference Resolution" — X resolved / Y total (Z%)
- New card: "Emergent Queue" — pending count, link to queue page
- Staleness summary: X neurons due for re-verification, by type

### Emergent Queue Page (new — under Improve)

- Table of all queue entries, sortable by detection count, family, status, last detected
- Status filter: Pending | In Progress | Resolved | Dismissed
- Per-entry detail:
  - Citation pattern and family
  - Detection count and trend (increasing? stable?)
  - List of neurons that contain this reference (clickable links to Explorer)
  - List of queries where this reference appeared
  - "Acquire" button → opens ingestion UI pre-populated with citation prefix and suggested source URL
  - "Dismiss" button with required notes field (e.g., "proprietary, cannot ingest")
- Batch actions: select multiple → batch acquire, batch dismiss
- Summary stats at top: pending count, resolved this week, top families

### Source Coverage Page (new — under Evaluate)

- **Gap Heat Map** — departments × citation families, color by unresolved count
- **Resolution Rate Over Time** — line chart showing resolution % trend (weekly)
- **Top Unresolved References** — table of highest-detection-count pending items
- **Coverage by Role** — bar chart of resolution % per role
- **Source Origin Distribution** — pie/bar chart of neuron counts by `source_origin`
- **Recently Resolved** — feed of recently resolved emergent items with links to created neurons

---

## Ingestion Priority

### Phase 0 — Foundation (run first)
1. **Retroactive scan** — `POST /admin/scan-references` on all existing neurons. Populates `external_references` and seeds the emergent queue. This generates the data-driven priority list for everything below.

### Phase 1 — Core References (top citations from retroactive scan, pre-load)
2. **Top 30-50 regulatory citations** by detection frequency — likely FAR Part 31, FAR Part 52 key clauses, ITAR §120-130, NIST SP 800-171, AS9100D §8.
3. **Top 20-30 technical citations** by detection frequency — likely PySpark DataFrame API, SQLAlchemy Session, Delta Lake MERGE, FastAPI Depends, Python asyncio.

### Phase 2 — Emergent-Driven (let the queue prioritize)
4. From this point forward, the emergent queue drives acquisition. Items with `detection_count >= 3` are prioritized. Human reviews and acquires in batches, guided by the gap heat map.

### Phase 3 — Depth (manual expansion of high-value areas)
5. **Full FAR Part ingestion** for parts already partially covered (31, 52, 15, 12)
6. **Full ITAR Part 120-130** for defense export control
7. **Interpretive layer** — DCAA CAM key sections, significant ASBCA decisions, active class deviations
8. **Technical depth** — React hooks API, TypeScript type system, D3.js selections, Databricks Unity Catalog

---

## What This Does NOT Cover

- **Automated source monitoring** via Federal Register API or PyPI/npm feeds — described conceptually but not spec'd as a buildable feature. Requires API integration, citation parsing, and change-matching logic. Future phase.
- **Legal privilege / work product protection** — if interpretive neurons contain attorney analysis, they may need access controls. Out of scope but noted.
- **Multi-jurisdiction** — assumes US federal regulation. EASA, NATO STANAG, foreign export controls would need separate ingestion pipelines.
- **Version history** — `superseded_by` handles linear succession but not branching (a regulation that splits into two successor clauses, or a library that forks). The NeuronRefinement table partially covers content changes, but a full version graph is out of scope.
- **Automated testing of technical neurons** — verifying that code examples in technical neurons actually compile/run. Valuable but a separate system.
- **License/copyright compliance** — some technical documentation has restrictive licenses (Oracle docs, some standards bodies). Ingestion must respect source licensing. Noted but not enforced by the system.
- **Automated source fetching** — the spec describes locating sources (eCFR API, docs URLs) but does not implement a scraper. Source text is provided by the user or fetched semi-manually. Full automation is a future phase.

---

## Implementation Order

### Phase A — Data Model & Detection
1. **Data model changes** — Add all new fields to Neuron model, create `emergent_queue` table, run migration
2. **Citation pattern detector** — Regex-based scanner for regulatory and technical references
3. **Retroactive scan endpoint** — `POST /admin/scan-references` to populate `external_references` on all existing neurons and seed the emergent queue
4. **Post-create hook** — Run detection on every new/updated neuron (bolster, autopilot, manual)

### Phase B — Ingestion & Emergent Queue
5. **Unified ingestion endpoint** — `POST /admin/ingest-source` with LLM segmentation, content validation, and human review
6. **Emergent Queue UI** — Page under Improve nav group with queue table, acquire/dismiss actions, summary stats
7. **Automatic edge creation** — Citation-grep, reverse-grep, and external_references resolution on ingestion
8. **Post-query detection** — Non-blocking scan of assembled neurons after query execution, feeding unresolved references to the queue

### Phase C — Analytics & Verification
9. **Source Coverage page** — Gap heat map, resolution rates, top unresolved, coverage by role
10. **Explorer enhancements** — Source type badges, citation display, external references panel
11. **Dashboard enhancements** — Source neuron counts, resolution rate card, queue depth card
12. **Scoring modifier** — Staleness penalty for unverified authoritative neurons
13. **Verification sweep** — `POST /admin/verify-sources` with staleness detection
14. **Technology version tracking** — Manual version table + version gap detection

### Phase D — Future
15. **External feed monitoring** — Federal Register API, release feed integration
16. **Automated source fetching** — eCFR API integration, docs URL scraping
17. **Batch emergent acquisition** — Process top-N queue items in a single automated session
