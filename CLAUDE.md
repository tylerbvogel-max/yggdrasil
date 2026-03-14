# Yggdrasil

Biomimetic neuron graph for prompt preparation. Two-stage Haiku pipeline: classify intent → score neurons → assemble context → execute with enriched prompt.

## Stack
- Python FastAPI + PostgreSQL (async SQLAlchemy + asyncpg) + Anthropic Python SDK
- Port 8002

## Dev Commands
```bash
cd ~/Projects/yggdrasil/backend
source venv/bin/activate
uvicorn app.main:app --port 8002 --reload
```

## Key Concepts
- **Neurons**: Nodes in a 6-layer org hierarchy (L0=Department → L5=Output/Comm)
- **Firing**: When a neuron is selected for a query context
- **5 Signals**: Burst, Impact, Practice, Novelty, Recency
- **Propagation**: Child firing propagates up at 0.6× per layer

## Corvus Integration
Corvus (screen-watcher) is integrated as a subpackage under `backend/app/corvus/` with endpoints at `/corvus/`. Chrome extension captures → OCR → classify → interpret → queue observations for neuron graph ingestion.

## NASA Software Engineering Compliance Policy

All code contributions to this project MUST adhere to the following NASA software engineering standards. These requirements apply to code reviews, development practices, and Corvus-driven development suggestions.

### Governing Standards
- **NPR 7150.2D** — NASA Software Engineering Requirements (primary procedural authority)
- **NASA-STD-8739.8B** — Software Assurance and Software Safety Standard
- **NASA-STD-8739.9** — Software Formal Inspections Standard
- **NASA SWEHB** — Software Engineering Handbook (guidance/best practices)

### Code Review Requirements (per NPR 7150.2D & NASA-STD-8739.8/9)
1. **Software safety**: All changes must consider failure modes. Code that controls neuron scoring, observation evaluation, or LLM-driven actions must document assumptions and failure behavior.
2. **Configuration management**: Every change must be traceable (git commit with descriptive message). No uncommitted changes in production.
3. **Secure coding**: Follow NASA Secure Coding Portal practices — validate all external inputs, sanitize LLM outputs before database writes, no hardcoded credentials, no SQL injection vectors.
4. **Formal inspections**: Non-trivial changes (new endpoints, schema changes, LLM prompt modifications) require structured review against acceptance criteria before merge.
5. **Testing & verification**: New features require verification evidence. API endpoints need at minimum a smoke test. LLM pipeline changes need evaluation against known-good queries.
6. **Software classification**: This system processes operational knowledge and influences decision-making. Treat it as safety-relevant software — changes to scoring algorithms, neuron creation, or observation approval logic require heightened review.
7. **Metrics & measurement**: Track token usage, model costs, and pipeline latency. Cost projections and actuals must remain visible in the UI.
8. **Third-party software management**: LLM model updates (Haiku/Sonnet/Opus version changes), dependency upgrades, and Anthropic SDK updates must be evaluated for behavioral impact before adoption.
9. **Documentation**: Public-facing endpoints must have docstrings. Schema changes must include migration logic. LLM system prompts must document their intent and expected output format.

### Corvus Development-Specific Rules
- Screen capture data is ephemeral — never persist raw screenshots beyond the processing pipeline
- Observation-to-neuron flow must maintain provenance (source_origin="corvus", refinement records)
- LLM evaluation proposals are advisory only — human approval required before graph modifications
- Interpretation cadence and alert thresholds must be configurable, not hardcoded
