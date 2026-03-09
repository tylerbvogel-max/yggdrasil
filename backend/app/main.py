"""FastAPI app with lifespan auto-seed."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func, text

from app.database import engine, async_session
from app.models import Base, Neuron, SystemState
from app.routers import query, neurons, admin, autopilot, performance
from app.seed.loader import load_seed
from app.seed.regulatory_seed import seed_regulatory


async def _column_exists(conn, table: str, column: str) -> bool:
    result = await conn.execute(text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :col"
    ), {"table": table, "col": column})
    return result.fetchone() is not None


async def _index_exists(conn, index_name: str) -> bool:
    result = await conn.execute(text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :name"
    ), {"name": index_name})
    return result.fetchone() is not None


async def _table_exists(conn, table: str) -> bool:
    result = await conn.execute(text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_name = :table AND table_schema = 'public'"
    ), {"table": table})
    return result.fetchone() is not None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Migrate: make neuron_refinements.query_id nullable
    async with engine.begin() as conn:
        try:
            if await _table_exists(conn, "neuron_refinements"):
                result = await conn.execute(text(
                    "SELECT is_nullable FROM information_schema.columns "
                    "WHERE table_name = 'neuron_refinements' AND column_name = 'query_id'"
                ))
                row = result.fetchone()
                if row and row[0] == "NO":
                    await conn.execute(text(
                        "ALTER TABLE neuron_refinements ALTER COLUMN query_id DROP NOT NULL"
                    ))
                    print("Migrated: neuron_refinements.query_id is now nullable")
        except Exception as e:
            print(f"Migration check skipped: {e}")

    # Migrate: add new columns to autopilot_config if missing
    async with engine.begin() as conn:
        try:
            if await _table_exists(conn, "autopilot_config"):
                if not await _column_exists(conn, "autopilot_config", "eval_model"):
                    await conn.execute(text(
                        "ALTER TABLE autopilot_config ADD COLUMN eval_model VARCHAR(20) DEFAULT 'haiku'"
                    ))
                    print("Migrated: added autopilot_config.eval_model")
                if not await _column_exists(conn, "autopilot_config", "max_layer"):
                    await conn.execute(text(
                        "ALTER TABLE autopilot_config ADD COLUMN max_layer INTEGER DEFAULT 5"
                    ))
                    print("Migrated: added autopilot_config.max_layer")
        except Exception as e:
            print(f"Autopilot migration skipped: {e}")

    # Migrate: add cross_ref_departments and standard_date columns to neurons if missing
    async with engine.begin() as conn:
        try:
            if not await _column_exists(conn, "neurons", "cross_ref_departments"):
                await conn.execute(text(
                    "ALTER TABLE neurons ADD COLUMN cross_ref_departments TEXT"
                ))
                print("Migrated: added neurons.cross_ref_departments")
            if not await _column_exists(conn, "neurons", "standard_date"):
                await conn.execute(text(
                    "ALTER TABLE neurons ADD COLUMN standard_date VARCHAR(20)"
                ))
                print("Migrated: added neurons.standard_date")
        except Exception as e:
            print(f"Neurons migration skipped: {e}")

    # Migrate: add edge indexes and last_updated_query column for scaling
    async with engine.begin() as conn:
        try:
            if await _table_exists(conn, "neuron_edges"):
                if not await _column_exists(conn, "neuron_edges", "last_updated_query"):
                    await conn.execute(text(
                        "ALTER TABLE neuron_edges ADD COLUMN last_updated_query INTEGER DEFAULT 0"
                    ))
                    print("Migrated: added neuron_edges.last_updated_query")

                if not await _index_exists(conn, "ix_neuron_edges_target_weight"):
                    await conn.execute(text(
                        "CREATE INDEX ix_neuron_edges_target_weight ON neuron_edges(target_id, weight)"
                    ))
                    await conn.execute(text(
                        "CREATE INDEX ix_neuron_edges_source_weight ON neuron_edges(source_id, weight)"
                    ))
                    print("Migrated: added neuron_edges target/source weight indexes")
        except Exception as e:
            print(f"Edge scaling migration skipped: {e}")

    # Auto-seed on first run
    async with async_session() as db:
        count = (await db.execute(select(func.count(Neuron.id)))).scalar() or 0
        if count == 0:
            result = await load_seed(db)
            print(f"Auto-seeded: {result}")

    # Seed regulatory department — force re-seed if neuron count below v2 threshold
    async with async_session() as db:
        rcount = (await db.execute(
            select(func.count(Neuron.id)).where(Neuron.department == "Regulatory")
        )).scalar() or 0
        force_reseed = rcount < 150
        if force_reseed:
            print(f"Regulatory neuron count ({rcount}) below v2 threshold — will force re-seed")

    import asyncio
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, lambda: seed_regulatory(force=force_reseed))

    yield


app = FastAPI(
    title="Yggdrasil",
    description="Biomimetic neuron graph for prompt preparation. Two-stage Haiku pipeline with 5-signal scoring.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query.router)
app.include_router(neurons.router)
app.include_router(admin.router)
app.include_router(autopilot.router)
app.include_router(performance.router)


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
