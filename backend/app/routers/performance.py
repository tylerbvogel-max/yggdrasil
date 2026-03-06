"""GET /admin/performance — Pure SQL analytics, no LLM invocation."""

import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

# Pricing per million tokens (current Anthropic rates as of 2025)
# Haiku 4.5, Sonnet 4.6, Opus 4.6
PRICING = {
    "haiku":  {"input": 1.00, "output": 5.00},
    "sonnet": {"input": 3.00, "output": 15.00},
    "opus":   {"input": 5.00, "output": 25.00},
}


@router.get("/performance")
async def performance_report(db: AsyncSession = Depends(get_db)):
    """Compute all performance analytics from database. No LLM calls."""

    result = await db.execute(text("SELECT COUNT(*) FROM queries"))
    total_queries = result.scalar() or 0
    if total_queries == 0:
        return {"error": "No queries to analyze"}

    # --- 1. Cost summary ---
    row = (await db.execute(text("""
        SELECT
            COUNT(*) as n,
            COALESCE(SUM(cost_usd), 0) as total_cost,
            COALESCE(AVG(cost_usd), 0) as avg_cost,
            MIN(cost_usd) as min_cost,
            MAX(cost_usd) as max_cost,
            COALESCE(SUM(classify_input_tokens), 0) as cls_in,
            COALESCE(SUM(classify_output_tokens), 0) as cls_out,
            COALESCE(SUM(execute_input_tokens), 0) as exe_in,
            COALESCE(SUM(execute_output_tokens), 0) as exe_out,
            COALESCE(SUM(eval_input_tokens), 0) as eval_in,
            COALESCE(SUM(eval_output_tokens), 0) as eval_out
        FROM queries
    """))).fetchone()

    cost_summary = {
        "total_queries": row[0],
        "total_cost": round(row[1], 4),
        "avg_cost": round(row[2], 4),
        "min_cost": round(row[3] or 0, 4),
        "max_cost": round(row[4] or 0, 4),
        "classify_tokens": {"input": row[5], "output": row[6]},
        "execute_tokens": {"input": row[7], "output": row[8]},
        "eval_tokens": {"input": row[9], "output": row[10]},
        "total_input_tokens": row[5] + row[7] + row[9],
        "total_output_tokens": row[6] + row[8] + row[10],
    }

    # --- 2. Cost modeling: Haiku+Neurons vs alternatives ---
    row2 = (await db.execute(text("""
        SELECT
            AVG(classify_input_tokens) as avg_cls_in,
            AVG(classify_output_tokens) as avg_cls_out,
            AVG(execute_input_tokens) as avg_exe_in,
            AVG(execute_output_tokens) as avg_exe_out
        FROM queries WHERE execute_input_tokens > 0
    """))).fetchone()

    avg_cls_in = row2[0] or 0
    avg_cls_out = row2[1] or 0
    avg_exe_in = row2[2] or 0
    avg_exe_out = row2[3] or 0

    h = PRICING["haiku"]
    s = PRICING["sonnet"]
    o = PRICING["opus"]

    haiku_neuron_cost = (
        (avg_cls_in * h["input"] + avg_cls_out * h["output"]) / 1_000_000 +
        (avg_exe_in * h["input"] + avg_exe_out * h["output"]) / 1_000_000
    )
    sonnet_raw_cost = (avg_cls_in * s["input"] + avg_exe_out * s["output"]) / 1_000_000
    opus_raw_cost = (avg_cls_in * o["input"] + avg_exe_out * o["output"]) / 1_000_000

    cost_modeling = {
        "avg_tokens": {
            "classify_input": round(avg_cls_in),
            "classify_output": round(avg_cls_out),
            "execute_input": round(avg_exe_in),
            "execute_output": round(avg_exe_out),
        },
        "per_query_cost": {
            "haiku_neuron": round(haiku_neuron_cost, 4),
            "sonnet_raw": round(sonnet_raw_cost, 4),
            "opus_raw": round(opus_raw_cost, 4),
        },
        "savings_vs_opus": round((1 - haiku_neuron_cost / opus_raw_cost) * 100, 1) if opus_raw_cost > 0 else 0,
        "savings_vs_sonnet": round((1 - haiku_neuron_cost / sonnet_raw_cost) * 100, 1) if sonnet_raw_cost > 0 else 0,
        "projected_monthly_1k": {
            "haiku_neuron": round(haiku_neuron_cost * 1000, 2),
            "sonnet_raw": round(sonnet_raw_cost * 1000, 2),
            "opus_raw": round(opus_raw_cost * 1000, 2),
        },
        "annual_savings_vs_opus_1k": round((opus_raw_cost - haiku_neuron_cost) * 1000 * 12, 2),
        "annual_savings_vs_sonnet_1k": round((sonnet_raw_cost - haiku_neuron_cost) * 1000 * 12, 2),
    }

    # --- 3. Quality by answer mode ---
    rows = (await db.execute(text("""
        SELECT answer_mode, COUNT(*) as n,
            ROUND(AVG(accuracy), 2) as acc,
            ROUND(AVG(completeness), 2) as comp,
            ROUND(AVG(clarity), 2) as clar,
            ROUND(AVG(faithfulness), 2) as faith,
            ROUND(AVG(overall), 2) as overall
        FROM eval_scores GROUP BY answer_mode ORDER BY overall DESC
    """))).fetchall()

    quality_by_mode = [
        {
            "mode": r[0], "n": r[1],
            "accuracy": r[2], "completeness": r[3],
            "clarity": r[4], "faithfulness": r[5], "overall": r[6],
        }
        for r in rows
    ]

    # Haiku+Neurons vs Opus Raw quality ratio
    haiku_n_overall = next((r[6] for r in rows if r[0] == "haiku_neuron"), None)
    opus_r_overall = next((r[6] for r in rows if r[0] == "opus_raw"), None)
    quality_ratio = round(haiku_n_overall / opus_r_overall * 100) if haiku_n_overall and opus_r_overall else None

    # --- 4. Reliability: score distribution for haiku_neuron ---
    rows = (await db.execute(text("""
        SELECT overall, COUNT(*) as n FROM eval_scores
        WHERE answer_mode = 'haiku_neuron' GROUP BY overall ORDER BY overall
    """))).fetchall()

    score_dist = [{"score": r[0], "count": r[1]} for r in rows]
    total_scored = sum(r[1] for r in rows)
    good_count = sum(r[1] for r in rows if r[0] >= 4)

    reliability = {
        "distribution": score_dist,
        "total_evaluated": total_scored,
        "score_4_plus": good_count,
        "reliability_pct": round(good_count / total_scored * 100) if total_scored > 0 else 0,
    }

    # --- 5. Quality trend: early vs late ---
    median_id = total_queries // 2
    rows = (await db.execute(text(f"""
        SELECT
            CASE WHEN q.id <= {median_id} THEN 'early' ELSE 'late' END as period,
            COUNT(DISTINCT q.id) as queries,
            ROUND(AVG(e.overall), 2) as avg_overall,
            ROUND(AVG(e.accuracy), 2) as avg_acc,
            ROUND(AVG(e.completeness), 2) as avg_comp
        FROM queries q JOIN eval_scores e ON e.query_id = q.id
        WHERE e.answer_mode = 'haiku_neuron'
        GROUP BY CASE WHEN q.id <= {median_id} THEN 'early' ELSE 'late' END
    """))).fetchall()

    quality_trend = {r[0]: {"queries": r[1], "overall": r[2], "accuracy": r[3], "completeness": r[4]} for r in rows}

    # --- 6. Neuron graph stats ---
    row = (await db.execute(text("SELECT COUNT(*) FROM neurons WHERE is_active = 1"))).fetchone()
    active_neurons = row[0]

    row = (await db.execute(text("SELECT COUNT(*) FROM neurons WHERE invocations = 0"))).fetchone()
    never_fired = row[0]

    rows = (await db.execute(text("""
        SELECT
            CASE
                WHEN invocations = 0 THEN 'never_fired'
                WHEN invocations BETWEEN 1 AND 5 THEN '1_to_5'
                WHEN invocations BETWEEN 6 AND 20 THEN '6_to_20'
                ELSE 'over_20'
            END as bucket, COUNT(*) as n
        FROM neurons WHERE is_active = 1 GROUP BY bucket
    """))).fetchall()
    utilization = {r[0]: r[1] for r in rows}

    row = (await db.execute(text("SELECT COUNT(DISTINCT neuron_id) FROM neuron_firings"))).fetchone()
    distinct_fired = row[0]

    # Layer distribution
    rows = (await db.execute(text("""
        SELECT layer, COUNT(*) FROM neurons WHERE is_active = 1 GROUP BY layer ORDER BY layer
    """))).fetchall()
    layer_dist = {f"L{r[0]}": r[1] for r in rows}

    # Department distribution
    rows = (await db.execute(text("""
        SELECT department, COUNT(*) FROM neurons WHERE is_active = 1 AND department IS NOT NULL
        GROUP BY department ORDER BY COUNT(*) DESC
    """))).fetchall()
    dept_dist = {r[0]: r[1] for r in rows}

    neuron_stats = {
        "active_neurons": active_neurons,
        "distinct_fired": distinct_fired,
        "never_fired": never_fired,
        "utilization": utilization,
        "layer_distribution": layer_dist,
        "department_distribution": dept_dist,
    }

    # --- 7. Refinement impact ---
    row = (await db.execute(text(
        "SELECT COUNT(*) FROM neuron_refinements WHERE action = 'create'"
    ))).fetchone()
    created = row[0]

    row = (await db.execute(text(
        "SELECT COUNT(*) FROM neuron_refinements WHERE action = 'update'"
    ))).fetchone()
    updated = row[0]

    # Graph growth by query phase
    rows = (await db.execute(text("""
        SELECT
            CASE
                WHEN created_at_query_count <= 25 THEN 'seed'
                WHEN created_at_query_count <= 50 THEN 'q26_50'
                WHEN created_at_query_count <= 75 THEN 'q51_75'
                ELSE 'q76_plus'
            END as phase, COUNT(*) as n
        FROM neurons GROUP BY phase ORDER BY MIN(created_at_query_count)
    """))).fetchall()
    graph_growth = {r[0]: r[1] for r in rows}

    refinement_impact = {
        "neurons_created": created,
        "neurons_updated": updated,
        "graph_growth": graph_growth,
    }

    # --- 8. Autopilot stats ---
    rows = (await db.execute(text("""
        SELECT status, COUNT(*) as n,
            ROUND(AVG(eval_overall), 2) as avg_score,
            COALESCE(SUM(neurons_created), 0) as created,
            COALESCE(SUM(updates_applied), 0) as updated,
            ROUND(COALESCE(SUM(cost_usd), 0), 4) as cost
        FROM autopilot_runs GROUP BY status
    """))).fetchall()

    autopilot = [
        {"status": r[0], "runs": r[1], "avg_score": r[2],
         "created": r[3], "updated": r[4], "cost": r[5]}
        for r in rows
    ]

    # --- 9. Total investment ---
    row = (await db.execute(text("SELECT COALESCE(SUM(cost_usd), 0) FROM queries"))).fetchone()
    query_spend = round(row[0], 2)
    row = (await db.execute(text("SELECT COALESCE(SUM(cost_usd), 0) FROM autopilot_runs"))).fetchone()
    autopilot_spend = round(row[0], 2)

    investment = {
        "query_pipeline": query_spend,
        "autopilot": autopilot_spend,
        "total": round(query_spend + autopilot_spend, 2),
    }

    # --- 10. Neuron count vs quality correlation ---
    rows = (await db.execute(text("""
        SELECT
            CASE
                WHEN json_array_length(q.selected_neuron_ids) <= 5 THEN '1-5'
                WHEN json_array_length(q.selected_neuron_ids) <= 15 THEN '6-15'
                WHEN json_array_length(q.selected_neuron_ids) <= 30 THEN '16-30'
                ELSE '31+'
            END as bucket,
            COUNT(DISTINCT q.id) as queries,
            ROUND(AVG(e.overall), 2) as avg_score
        FROM queries q
        JOIN eval_scores e ON e.query_id = q.id
        WHERE e.answer_mode = 'haiku_neuron'
        GROUP BY bucket
        ORDER BY MIN(json_array_length(q.selected_neuron_ids))
    """))).fetchall()

    neuron_quality_corr = [{"bucket": r[0], "queries": r[1], "avg_score": r[2]} for r in rows]

    # --- 11. Per-query timeline (for chart) ---
    rows = (await db.execute(text("""
        SELECT q.id, ROUND(q.cost_usd, 4) as cost,
            json_array_length(q.selected_neuron_ids) as neurons,
            (SELECT ROUND(AVG(overall), 2) FROM eval_scores WHERE query_id = q.id AND answer_mode = 'haiku_neuron') as score,
            q.created_at
        FROM queries q ORDER BY q.id
    """))).fetchall()

    query_timeline = [
        {"id": r[0], "cost": r[1], "neurons": r[2], "score": r[3], "created_at": r[4]}
        for r in rows
    ]

    return {
        "cost_summary": cost_summary,
        "cost_modeling": cost_modeling,
        "quality_by_mode": quality_by_mode,
        "quality_ratio": quality_ratio,
        "reliability": reliability,
        "quality_trend": quality_trend,
        "neuron_stats": neuron_stats,
        "refinement_impact": refinement_impact,
        "autopilot": autopilot,
        "investment": investment,
        "neuron_quality_correlation": neuron_quality_corr,
        "query_timeline": query_timeline,
    }
