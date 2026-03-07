# Authoritative Source Neuron Architecture — Implementation Brief

**Purpose:** Everything a new session needs to implement the authoritative source neuron architecture.

---

## What This Is

Yggdrasil's neuron graph currently treats all knowledge as homogeneous operational content. This architecture adds source-typed neurons, external reference detection, emergent (self-growing) neurons, and gap analytics. The full design spec is at `readables/regulatory-neuron-spec.md`.

## Codebase Orientation

### Stack
- **Backend:** Python FastAPI, async SQLAlchemy + aiosqlite, SQLite, Anthropic SDK
- **Frontend:** React + TypeScript + Vite
- **Port:** 8002

### Key Backend Paths
- `backend/app/models.py` — SQLAlchemy models (`Neuron`, `NeuronEdge`, `QueryHistory`, etc.)
- `backend/app/database.py` — Async engine and session factory
- `backend/app/routers/neurons.py` — Neuron CRUD, scoring, spread activation, spread log
- `backend/app/routers/query.py` — Query pipeline (classify → score → assemble → execute)
- `backend/app/routers/admin.py` — Bolster, autopilot, refine/apply, scan endpoints
- `backend/app/scoring.py` — 5-signal neuron scoring engine
- `backend/app/prompt_assembly.py` — Token-budgeted context assembly
- `backend/app/config.py` — DB connection string, model settings

### Key Frontend Paths
- `frontend/src/App.tsx` — Nav groups and routing
- `frontend/src/api.ts` — All API call functions and TypeScript interfaces
- `frontend/src/components/` — All page components
  - `Dashboard.tsx` — Stats, cost report, spread activation log
  - `Explorer.tsx` — Neuron tree browser
  - `NextSteps.tsx` — Roadmap page (links to this doc)

### Nav Groups (in App.tsx)
```
Query:    Query Lab, Samples
Knowledge: Explorer, Graph, Dashboard, Co-Firing
Improve:  Bolster, Autopilot, Refinements
Evaluate: Performance, Methodology, Evaluation
About:    Overview, Pipeline, NIST AI RMF, Next Steps, Monetization
```

New pages go into: **Emergent Queue → Improve**, **Source Coverage → Evaluate**

### Database
- SQLite at `backend/yggdrasil.db`
- All access via async SQLAlchemy ORM (no raw sqlite3 calls)
- Migrations are manual `ALTER TABLE` — no Alembic yet
- Current neuron count: ~1,800+

### Existing Patterns to Follow
- **Bolster flow:** LLM proposes → human reviews → apply endpoint creates neurons. Same pattern for ingestion.
- **Admin endpoints:** `POST /admin/*` for batch operations, return summary JSON.
- **Frontend data fetching:** `api.ts` exports typed fetch functions, components call them in `useEffect`.
- **Neuron creation:** Always through `session.add(Neuron(...))` with full field population.

---

## Implementation Phases

### Phase A — Data Model & Detection (start here)

**1. Add fields to Neuron model** (`models.py`)

New columns on `Neuron`:
| Field | Type | Default |
|-------|------|---------|
| `source_type` | `String(20)` | `"operational"` |
| `source_origin` | `String(20)` | `"seed"` |
| `citation` | `String(500)` | `None` |
| `effective_date` | `Date` | `None` |
| `last_verified` | `DateTime` | `None` |
| `source_url` | `String(500)` | `None` |
| `superseded_by` | `Integer` (FK to neurons.id) | `None` |
| `source_version` | `String(50)` | `None` |
| `external_references` | `Text` (JSON) | `None` |

All existing neurons default to `source_type='operational'`, `source_origin='seed'`.

**2. Create `emergent_queue` table** (`models.py`)

See `regulatory-neuron-spec.md` → "New Table: emergent_queue" for full schema.

**3. Run migration** — Manual ALTER TABLE statements against `yggdrasil.db`. See spec for SQL.

**4. Build citation pattern detector** — Regex-based, deterministic. Two sets:
- Regulatory: FAR, DFARS, ITAR, EAR, CFR, NIST, MIL-STD, MIL-SPEC, AS, DO, ASME, NADCAP, ISO, SAE, OSHA, ASTM
- Technical: Python, PySpark, SQLAlchemy, SQL, React, FastAPI, Delta Lake, Node.js

Full regex table in spec → "Citation Patterns" section.

Returns: `[{"pattern": "...", "domain": "...", "family": "..."}]`

**5. Build retroactive scan endpoint** — `POST /admin/scan-references`
- Scans all neurons, populates `external_references`, seeds `emergent_queue`
- Returns summary stats (see spec for response format)

**6. Hook detection into neuron create/update** — Anywhere neurons are created (bolster apply, autopilot, manual), run the detector and populate `external_references`.

### Phase B — Ingestion & Emergent Queue

**7. Unified ingestion endpoint** — `POST /admin/ingest-source`
- Accepts source text + metadata
- LLM segments into neuron proposals (see spec for prompt templates)
- Content validation (cosine similarity against source)
- Returns proposals for human review (same pattern as bolster)

**8. Emergent Queue UI** — New React component under Improve nav
- Table with sort/filter
- Acquire → opens ingestion pre-populated
- Dismiss with required notes
- Batch actions
- Summary stats cards

**9. Automatic edge creation on ingestion**
- Citation grep existing neurons for new neuron's citation → create edges
- Reverse grep → edges
- Update `external_references` resolved status on matching neurons

**10. Post-query detection** — After query execution, scan assembled neurons for unresolved refs, feed to queue. Non-blocking.

### Phase C — Analytics & Verification

**11. Source Coverage page** — New React component under Evaluate nav
- Gap heat map (departments × citation families)
- Resolution rate over time
- Top unresolved references
- Coverage by role

**12. Explorer enhancements** — Source type badges, citation display, external references panel

**13. Dashboard enhancements** — Source neuron counts, resolution rate, queue depth cards

**14. Scoring modifier** — Staleness penalty in `scoring.py` for unverified authoritative neurons

**15. Verification sweep** — `POST /admin/verify-sources` with staleness detection signals

---

## Key Design Decisions

1. **Never LLM-paraphrase primary sources.** The LLM segments and structures; content comes verbatim from the source.
2. **Emergent neurons are non-blocking.** Detection and queuing happen post-query. The user never waits for acquisition.
3. **Two-tier acquisition:** Pre-load top 30-50 most-referenced citations (core). Everything else acquired on-demand via the emergent queue.
4. **External references are computed, not manual.** The regex detector runs automatically on every neuron create/update.
5. **Same review pattern as bolster.** All ingested/emergent neurons go through human review before creation.
6. **Staleness flags, never auto-deactivates.** Stale neurons get flagged and scored lower, but only humans mark them superseded.

## Source Type Quick Reference

| `source_type` | Content | Citation Required? |
|---------------|---------|-------------------|
| `operational` | Experiential/procedural knowledge | No |
| `regulatory_primary` | Verbatim regulatory text | Yes + effective_date |
| `regulatory_interpretive` | Agency guidance, case holdings | Yes |
| `technical_primary` | API signatures, syntax, specs | Yes + source_version |
| `technical_pattern` | Best practices, migration patterns | Recommended |

## Source Origin Quick Reference

| `source_origin` | Created By |
|-----------------|-----------|
| `seed` | Initial YAML seeding |
| `bolster` | Bolster pipeline |
| `autopilot` | Autopilot training loop |
| `manual` | Human direct entry |
| `ingested` | Authoritative source ingestion pipeline |
| `emergent` | Gap-triggered acquisition from emergent queue |

---

## Files to Read First

1. **This file** — you're here
2. `readables/regulatory-neuron-spec.md` — Full design spec with all details
3. `backend/app/models.py` — Current data model (add new fields/table here)
4. `backend/app/routers/admin.py` — Existing admin endpoints (pattern for new ones)
5. `backend/app/routers/neurons.py` — Neuron CRUD and scoring
6. `frontend/src/App.tsx` — Nav groups (add new pages here)
7. `frontend/src/api.ts` — API interfaces (add new types/fetchers here)
