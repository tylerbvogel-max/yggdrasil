"""FastAPI app with lifespan auto-seed."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func

from app.database import engine, async_session
from app.models import Base, Neuron, SystemState
from app.routers import query, neurons, admin
from app.seed.loader import load_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Auto-seed on first run
    async with async_session() as db:
        count = (await db.execute(select(func.count(Neuron.id)))).scalar() or 0
        if count == 0:
            result = await load_seed(db)
            print(f"Auto-seeded: {result}")

    yield


app = FastAPI(
    title="Yggdrasil",
    description="Biomimetic neuron graph for prompt preparation. Two-stage Haiku pipeline with 5-signal scoring.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(query.router)
app.include_router(neurons.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    async with async_session() as db:
        neuron_count = (await db.execute(select(func.count(Neuron.id)))).scalar() or 0
        state = (await db.execute(select(SystemState).where(SystemState.id == 1))).scalar_one_or_none()
        total_queries = state.total_queries if state else 0

    return {
        "status": "ok",
        "neuron_count": neuron_count,
        "total_queries": total_queries,
    }


# Serve frontend static files if built
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # SPA catch-all — must NOT match API prefixes
    _api_prefixes = ("/neurons", "/queries", "/query", "/eval-scores", "/admin", "/health", "/docs", "/openapi")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path and any(full_path.startswith(p.lstrip("/")) for p in _api_prefixes):
            raise HTTPException(status_code=404, detail="Not found")
        file_path = frontend_dist / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
