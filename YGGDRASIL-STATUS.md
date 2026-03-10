# Yggdrasil — Project Status & Session Handoff

Last updated: 2026-03-08

## What Is Yggdrasil

A biomimetic neuron graph for prompt preparation. Instead of traditional RAG, it organizes domain knowledge as a 6-layer neural hierarchy (Department → Role → Task → System → Decision → Output) and uses a two-stage Haiku pipeline:

1. **Classify** — Haiku classifies the query → intent, departments, roles, keywords
2. **Score** — 5-signal scoring (Burst, Impact, Precision, Novelty, Recency) + multi-hop spread activation through co-firing edges
3. **Assemble** — Top-K neurons packed into a 4000-token system prompt
4. **Execute** — Haiku (or Sonnet/Opus via multi-slot blind A/B) answers with enriched context

Domain: defense aerospace (X-plane prototype development, modeled as "Yggdrasil Aero"). Norse mythology naming, no real company branding.

## Current Stats (as of 2026-03-08)

- **2,040 neurons** across 9 departments, 51 roles
- **189 queries** executed through Query Lab
- **~40K co-firing edges** (pruned from 229K — removed 189K stale single-fire edges)
- Layer distribution: L0=9, L1=51, L2=406, L3=942, L4=357, L5=266

## Stack

- **Backend:** Python FastAPI + SQLite (async SQLAlchemy + aiosqlite) + Anthropic SDK
- **Frontend:** React + Vite + TypeScript + D3.js for visualizations
- **Port:** 8002
- **Dev:** `cd backend && source venv/bin/activate && uvicorn app.main:app --port 8002 --reload`
- **Frontend dev:** `cd frontend && npm run dev` (proxies to 8002)
- **Build:** `cd frontend && npm run build` (dist/ served by FastAPI)
- **Tests:** `cd backend && pytest tests/ -v`

## Backend Architecture

```
backend/app/
├── main.py              # FastAPI app, mounts routers, serves frontend dist/
├── config.py            # Settings (DB path, API keys)
├── database.py          # Async SQLAlchemy session
├── models.py            # ORM models (Neuron, Query, NeuronEdge, etc.)
├── schemas.py           # Pydantic schemas (all request/response types)
├── routers/
│   ├── neurons.py       # CRUD, tree, ego graph (multi-hop BFS), edges, refinement history
│   ├── query.py         # Query execution, eval, rating, refine, run-counts
│   ├── admin.py         # Bolster, seed, backup, maintain
│   ├── autopilot.py     # Gap-driven autonomous training loop
│   └── performance.py   # Token/cost analytics
├── services/
│   ├── classifier.py        # Haiku query classification
│   ├── scoring_engine.py    # 5-signal neuron scoring + spread activation
│   ├── prompt_assembler.py  # Top-K assembly into system prompt
│   ├── executor.py          # Multi-slot parallel execution
│   ├── propagation.py       # Utility propagation (child→parent at 0.6×)
│   ├── neuron_service.py    # Neuron CRUD helpers
│   ├── reference_detector.py # Regex scan for 18 regulatory + 6 technical families
│   ├── reference_hooks.py   # Auto-scan on neuron create/update
│   ├── gap_detector.py      # Gap analysis for autopilot
│   ├── consolidation.py     # Dedup/merge logic
│   └── claude_cli.py        # CLI wrapper (runs `claude -p` from cwd=/tmp)
└── seed/
    ├── loader.py            # Initial data seeding
    └── regulatory_seed.py   # Regulatory reference patterns
```

## Frontend Components

```
frontend/src/components/
├── Dashboard.tsx          # Overview cards + department chord diagram
├── Explorer.tsx           # Neuron tree browser + detail panel + ego graph
├── NeuronTree.tsx         # Recursive tree with search (supports numeric ID search)
├── NeuronDetail.tsx       # Selected neuron info panel
├── NeuronEgoGraph.tsx     # D3 ego graph — organic curved wires, multi-hop, glow effects
├── SpreadTrail.tsx        # Spread activation visualization
├── QueryLab.tsx           # Main query interface (submit, multi-slot, eval, refine)
├── SampleQueries.tsx      # 3 suites: Core (26), X-Plane Backtest (26), Prototype Readiness (14)
├── AutopilotPage.tsx      # Gap-driven autonomous training config + run history
├── EvaluationPage.tsx     # Blind A/B eval results
├── RefinementHistory.tsx  # Neuron refinement audit trail
├── PerformancePage.tsx    # Token/cost charts
├── NextSteps.tsx          # Phased roadmap (rendered in app)
├── PipelinePage.tsx       # Pipeline architecture explanation
├── DeptChordDiagram.tsx   # D3 chord diagram for dept interconnections
├── CirclePacking.tsx      # D3 circle packing for dept/role visualization
├── ScoreBars.tsx          # 5-signal score bar chart
├── TokenCharts.tsx        # Token usage charts
├── SecurityPage.tsx       # Security posture page
├── MonetizationPage.tsx   # Business model page
└── AboutPage.tsx          # Project overview
```

## Key Features Built (Recent Session)

### Query Lab Enhancements
- **Refine state persistence** — Refine results saved to DB (`refine_json` on query), recovered via `pending_refine` in query detail response when navigating back
- **Run Again** — Clears results, keeps message text, lets user re-select models before submitting (does NOT auto-submit)
- **+ New Query button** — Next to "Query History" header, spawns blank session
- **Cross-tab neuron navigation** — Clicking neuron IDs in refinement results navigates to Explorer with that neuron selected
- **Sample run counts** — `POST /queries/run-counts` tracks how many times each sample query has been run

### Explorer Enhancements
- **Numeric ID search** — Search "270" or "#270" both work (hash optional)
- **Multi-hop ego graph** — Backend BFS traverses co-firing edges up to 2 hops, returns full subgraph with hop distances
- **Organic visualization** — Curved bezier wires, SVG glow filters, department-colored edges, concentric layout. Hop2-to-hop2 edges filtered out to prevent visual clutter.

### Neuron Seeding
- **9 X-plane gap neurons** (IDs 2549-2557): aeroelasticity, TPS/materials, propulsion, GNC, autonomous flight, flight control laws, TRL assessment, ground test, flight test
- **5 prototype competency neurons** (IDs 2570-2574): telemetry/mission control, safety risk/abort logic, HIL/digital twin, rapid prototype manufacturing, cross-functional IPT methodology
- **14 Prototype Readiness sample queries** across 7 categories

## What's Ready for Backtesting

Three sample query suites in SampleQueries.tsx:
1. **Core (26)** — General aerospace/defense domain queries
2. **X-Plane Backtest (26)** — Targeted at X-plane knowledge gaps
3. **Prototype Readiness (14)** — Manufacturing/integration competencies

Run counts are tracked per sample. User plans to manually run backtests and review results. Low-eval results feed into gap-driven autopilot for automatic neuron expansion.

## Scaling Work (commit 407fa57, 2026-03-08)

Implemented phases 1, 2, 4, 5b of the 200K neuron scaling plan:

| Done | What | File(s) |
|------|------|---------|
| 5b | SQLite pragmas (synchronous=NORMAL, 64MB cache, 256MB mmap) | `database.py` |
| 1c | Edge indexes (target_weight, source_weight) + last_updated_query column | `main.py`, `models.py` |
| 1a | Frontier-scoped spread activation (per-hop edge fetch) | `neuron_service.py` |
| 1b | Batch co-fire updates, min_cofire_score threshold, prune endpoint | `executor.py`, `admin.py`, `config.py` |
| 2a | NeuronCandidate dataclass (no content blob in pre-filter) | `neuron_service.py` |
| 2b | SQL-side keyword hit ranking + LIMIT 500 | `neuron_service.py` |
| 4a | GET /neurons/children with child_count, max_depth on /tree | `neurons.py`, `neuron_service.py` |
| 4b | Frontend lazy-load tree (children on expand, 2-layer initial) | `NeuronTree.tsx`, `Explorer.tsx` |

New config settings in `config.py`: `candidate_limit=500`, `min_cofire_score=0.3`, `edge_prune_min_cofires=2`, `edge_prune_stale_queries=100`

## Pydantic Note

`QueryDetail` has a forward reference to `RefineResponse` (defined later in schemas.py). Uses string annotation `"RefineResponse | None"` with `QueryDetail.model_rebuild()` called after `RefineResponse` is defined.

## Research Documents

In `readables/`:
- `core_competencies_that_require_development.txt` — 10 prototype competencies analysis
- `defense-aerospace-role-resources.md` — Source material for role bolstering
- `regulatory-neuron-spec.md` — Authoritative source architecture spec
- `authoritative-source-implementation-brief.md` — Implementation plan for Phase 2
- `domain-knowledge-strategy.md` — Overall knowledge strategy
- `yggdrasil-strategic-memo.md` — Strategic positioning document

## Roadmap (from NextSteps.tsx)

| Phase | Status | What |
|-------|--------|------|
| — | Built | Neuron graph, 5-signal scoring, spread activation, co-firing edges, blind A/B eval, bolster/autopilot, source-typed neurons, reference detection, emergent queue API |
| 1 | Active | Role bolstering (2,031 → 3,000+ neurons) |
| 2 | Next | Emergent Queue UI + source ingestion pipeline + coverage analytics |
| 3 | Planned | Structured prompt assembly, RAG layer, query decomposition, cross-ref chasing |
| 4 | Planned | Sonnet model routing (tiered by complexity) |
| 5 | Backlog | Theme pre-scoring (Cog-RAG), community detection (GraphRAG Leiden), community summaries |
| 6 | Backlog | Microglia quality scanner, Ependymal graph hygiene, answer caching |
| 7 | Backlog | Deterministic classifier, connector neurons, PostgreSQL migration |

## Immediate Next Steps

### Remaining Scaling Work (200K neuron readiness)
1. **Phase 5a: Deferred writes** — Move firing records + edge updates to FastAPI `BackgroundTasks` so query responses return immediately without waiting for O(K^2) edge work. Changes in `executor.py`: split write path into sync (Query row + commit + return) and deferred (firings, propagation, edges).
2. **Phase 3a: Role-level co-firing table** — New `RoleEdge` model tracking co-firing at role_key level (max 1,275 edges vs millions). Permanently bounds edge growth regardless of neuron count.
3. **Phase 3b: Spread activation via RoleEdge** — Spread through small role graph first, then expand activated roles back to neuron-level candidates. Makes spread O(R) where R=~100 roles instead of O(E) where E=millions of edges.
4. **Phase 6a: Query timing instrumentation** — Log timing per pipeline stage (classify, pre-filter, score, spread, assemble, execute). Store in `query_timing` table or log.
5. **Phase 6b: Candidate count guardrails** — Hard limits with warnings: `max_candidates_hard: 2000`, `max_edges_per_hop: 5000`.

### Feature Work
6. **Run backtests** — Execute X-Plane Backtest and Prototype Readiness sample suites through Query Lab, review results manually
7. **Gap-driven autopilot** — Let autopilot process low-eval backtest results to expand weak areas
8. **Phase 2: Emergent Queue UI** — Build the frontend table for the 293 unresolved references already queued in the backend
9. **Phase 2: Source ingestion** — `POST /admin/ingest-source` pipeline for bulk knowledge loading
10. **Continue role bolstering** — Many of the 51 roles still have only 5-15 neurons each
