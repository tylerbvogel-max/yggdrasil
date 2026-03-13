"""MCP server exposing Yggdrasil's neuron graph as tools for Claude Code.

Runs as stdio transport — Claude Code spawns this as a child process.
Shares the same PostgreSQL connection pool as the FastAPI app.
"""

import json

from mcp.server.fastmcp import FastMCP

from app.database import async_session
from app.models import Neuron, NeuronEdge, SystemState, Query
from sqlalchemy import select, func, or_

mcp = FastMCP(
    "yggdrasil",
    instructions=(
        "Yggdrasil is a biomimetic neuron graph for prompt preparation. "
        "Use query_graph to get enriched context for any question. "
        "Use browse_departments, neuron_detail, and impact_analysis to explore the graph. "
        "Use graph_stats and cost_report for system health."
    ),
)


@mcp.tool()
async def query_graph(query: str, top_k: int = 30, token_budget: int = 4000, project_path: str | None = None) -> str:
    """Run the full neuron graph pipeline (classify → score → spread → inhibit → assemble) and return enriched context.

    This is the primary tool — returns a system prompt built from the most relevant neurons
    in the graph. Use the returned system_prompt as enriched context for answering questions.

    Args:
        query: The user's question or topic
        top_k: Maximum neurons to activate (default 30)
        token_budget: Token budget for the assembled prompt (default 4000)
        project_path: Optional project directory path for per-project neuron boosting
    """
    from app.services.executor import prepare_context

    async with async_session() as db:
        ctx = await prepare_context(
            db, query,
            token_budget=token_budget,
            top_k=top_k,
            project_path=project_path,
        )
        await db.commit()

        return json.dumps({
            "system_prompt": ctx.system_prompt,
            "neurons_activated": ctx.neurons_activated,
            "departments": ctx.departments,
            "intent": ctx.intent,
            "classify_cost_usd": ctx.classify_cost_usd,
            "neuron_scores": ctx.neuron_scores[:10],  # Top 10 for brevity
        }, indent=2)


@mcp.tool()
async def impact_analysis(topic: str, top_n: int = 20) -> str:
    """Find neurons most semantically similar to a topic. Pure CPU + DB read, zero API cost.

    Args:
        topic: The topic to search for
        top_n: Number of top neurons to return (default 20)
    """
    import concurrent.futures
    import asyncio

    try:
        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            from app.services.embedding_service import embed_text
            query_embedding = await loop.run_in_executor(pool, embed_text, topic)
    except Exception as e:
        return json.dumps({"error": f"Embedding failed: {e}"})

    async with async_session() as db:
        from app.services.semantic_prefilter import semantic_prefilter
        candidates = await semantic_prefilter(db, query_embedding, top_n_override=top_n)

        if not candidates:
            return json.dumps({"neurons": [], "message": "No similar neurons found"})

        cand_ids = [nid for nid, _ in candidates]
        sim_map = {nid: sim for nid, sim in candidates}

        result = await db.execute(select(Neuron).where(Neuron.id.in_(cand_ids)))
        neurons = {n.id: n for n in result.scalars().all()}

        output = []
        for nid in cand_ids:
            n = neurons.get(nid)
            if not n:
                continue
            output.append({
                "neuron_id": nid,
                "label": n.label,
                "department": n.department,
                "layer": n.layer,
                "role_key": n.role_key,
                "similarity": round(sim_map.get(nid, 0), 4),
            })

        return json.dumps({"neurons": output}, indent=2)


@mcp.tool()
async def neuron_detail(neuron_id: int) -> str:
    """Get full details for a specific neuron including content, scores, and top co-firing edges.

    Args:
        neuron_id: The neuron ID to inspect
    """
    async with async_session() as db:
        neuron = await db.get(Neuron, neuron_id)
        if not neuron:
            return json.dumps({"error": f"Neuron {neuron_id} not found"})

        # Get top co-firing edges
        result = await db.execute(
            select(NeuronEdge)
            .where(or_(NeuronEdge.source_id == neuron_id, NeuronEdge.target_id == neuron_id))
            .order_by(NeuronEdge.weight.desc())
            .limit(10)
        )
        edges = result.scalars().all()

        # Load connected neuron labels
        connected_ids = set()
        for e in edges:
            connected_ids.add(e.source_id if e.source_id != neuron_id else e.target_id)
        n_map = {}
        if connected_ids:
            n_result = await db.execute(select(Neuron).where(Neuron.id.in_(connected_ids)))
            n_map = {n.id: n for n in n_result.scalars().all()}

        edge_list = []
        for e in edges:
            other_id = e.source_id if e.source_id != neuron_id else e.target_id
            other = n_map.get(other_id)
            edge_list.append({
                "target_id": other_id,
                "target_label": other.label if other else f"#{other_id}",
                "weight": round(e.weight, 4),
                "co_fire_count": e.co_fire_count,
            })

        return json.dumps({
            "id": neuron.id,
            "label": neuron.label,
            "layer": neuron.layer,
            "department": neuron.department,
            "role_key": neuron.role_key,
            "node_type": neuron.node_type,
            "content": neuron.content,
            "summary": neuron.summary,
            "invocations": neuron.invocations,
            "avg_utility": round(neuron.avg_utility, 4) if neuron.avg_utility else 0,
            "is_active": neuron.is_active,
            "top_edges": edge_list,
        }, indent=2)


@mcp.tool()
async def browse_departments(department: str | None = None) -> str:
    """Browse the neuron graph hierarchy.

    Without arguments: lists all departments with neuron counts.
    With department: lists roles and neuron counts within that department.

    Args:
        department: Optional department name to drill into
    """
    async with async_session() as db:
        if department is None:
            result = await db.execute(
                select(Neuron.department, func.count(Neuron.id))
                .where(Neuron.is_active == True, Neuron.department.isnot(None))
                .group_by(Neuron.department)
                .order_by(func.count(Neuron.id).desc())
            )
            return json.dumps({
                "departments": [
                    {"name": dept, "neuron_count": count}
                    for dept, count in result.all()
                ]
            }, indent=2)
        else:
            result = await db.execute(
                select(Neuron.role_key, func.count(Neuron.id))
                .where(
                    Neuron.is_active == True,
                    Neuron.department == department,
                    Neuron.role_key.isnot(None),
                )
                .group_by(Neuron.role_key)
                .order_by(func.count(Neuron.id).desc())
            )
            return json.dumps({
                "department": department,
                "roles": [
                    {"role_key": rk, "neuron_count": count}
                    for rk, count in result.all()
                ]
            }, indent=2)


@mcp.tool()
async def graph_stats() -> str:
    """Get overall neuron graph statistics: totals, layer/department breakdowns, edge counts."""
    async with async_session() as db:
        total = (await db.execute(
            select(func.count(Neuron.id)).where(Neuron.is_active == True)
        )).scalar() or 0

        by_layer = await db.execute(
            select(Neuron.layer, func.count(Neuron.id))
            .where(Neuron.is_active == True)
            .group_by(Neuron.layer)
            .order_by(Neuron.layer)
        )

        by_dept = await db.execute(
            select(Neuron.department, func.count(Neuron.id))
            .where(Neuron.is_active == True, Neuron.department.isnot(None))
            .group_by(Neuron.department)
            .order_by(func.count(Neuron.id).desc())
        )

        edge_count = (await db.execute(select(func.count()).select_from(NeuronEdge))).scalar() or 0

        state = (await db.execute(select(SystemState).where(SystemState.id == 1))).scalar_one_or_none()

        total_firings = 0
        if state:
            from app.models import NeuronFiring
            total_firings = (await db.execute(
                select(func.count(NeuronFiring.id))
            )).scalar() or 0

        return json.dumps({
            "total_neurons": total,
            "total_edges": edge_count,
            "total_queries": state.total_queries if state else 0,
            "total_firings": total_firings,
            "by_layer": {f"L{layer}": count for layer, count in by_layer.all()},
            "by_department": {dept: count for dept, count in by_dept.all()},
        }, indent=2)


@mcp.tool()
async def cost_report() -> str:
    """Get cost and token usage summary across all queries."""
    async with async_session() as db:
        result = await db.execute(
            select(
                func.count(Query.id),
                func.coalesce(func.sum(Query.cost_usd), 0),
                func.coalesce(func.sum(Query.classify_input_tokens + Query.classify_output_tokens), 0),
                func.coalesce(func.sum(Query.execute_input_tokens + Query.execute_output_tokens), 0),
            )
        )
        row = result.one()
        total_queries = row[0]
        total_cost = float(row[1])
        classify_tokens = int(row[2])
        execute_tokens = int(row[3])
        total_tokens = classify_tokens + execute_tokens

        return json.dumps({
            "total_queries": total_queries,
            "total_cost_usd": round(total_cost, 6),
            "avg_cost_per_query": round(total_cost / total_queries, 6) if total_queries else 0,
            "total_tokens": total_tokens,
            "classify_tokens": classify_tokens,
            "execute_tokens": execute_tokens,
        }, indent=2)


@mcp.tool()
async def discover_clusters(min_weight: float = 0.3, min_size: int = 3) -> str:
    """Discover emergent cross-department neuron clusters via label propagation on co-firing edges.

    Finds groups of neurons that frequently co-fire across department boundaries,
    revealing hidden knowledge patterns the manual hierarchy doesn't capture.

    Args:
        min_weight: Minimum edge weight to include (default 0.3)
        min_size: Minimum cluster size (default 3)
    """
    from app.services.clustering import find_clusters

    async with async_session() as db:
        clusters = await find_clusters(db, min_weight=min_weight, min_size=min_size)

        return json.dumps({
            "cluster_count": len(clusters),
            "clusters": [
                {
                    "cluster_id": c["cluster_id"],
                    "neuron_ids": c["neuron_ids"],
                    "departments": c["departments"],
                    "neuron_count": len(c["neuron_ids"]),
                    "dept_count": len(c["departments"]),
                    "avg_internal_weight": round(c["avg_internal_weight"], 4),
                    "suggested_label": c["suggested_label"],
                }
                for c in clusters
            ]
        }, indent=2)


if __name__ == "__main__":
    mcp.run(transport="stdio")
