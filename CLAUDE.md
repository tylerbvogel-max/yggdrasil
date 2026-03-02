# Yggdrasil

Biomimetic neuron graph for prompt preparation. Two-stage Haiku pipeline: classify intent → score neurons → assemble context → execute with enriched prompt.

## Stack
- Python FastAPI + SQLite (async SQLAlchemy + aiosqlite) + Anthropic Python SDK
- Port 8002

## Dev Commands
```bash
cd ~/Projects/aurora-neuron/backend
source venv/bin/activate
uvicorn app.main:app --port 8002 --reload
```

## Key Concepts
- **Neurons**: Nodes in a 6-layer org hierarchy (L0=Department → L5=Output/Comm)
- **Firing**: When a neuron is selected for a query context
- **5 Signals**: Burst, Impact, Practice, Novelty, Recency
- **Propagation**: Child firing propagates up at 0.6× per layer
