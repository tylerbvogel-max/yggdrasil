#!/usr/bin/env python3
"""
Ingest Databricks ELT pipeline knowledge into the Yggdrasil neuron graph.

Calls the bolster API in batches, using Sonnet to generate neurons for each
topic area under Engineering > Data Engineer.

Usage:
    python scripts/ingest_databricks.py [--dry-run]
"""

import argparse
import json
import sys
import time
import requests

BASE_URL = "http://localhost:8002"
MODEL = "sonnet"
DEPARTMENT = "Engineering"

# Each prompt generates a batch of neurons for one topic area.
# The bolster endpoint sends Engineering dept context + our prompt to Sonnet.
BATCH_PROMPTS = [
    # --- Phase 1: Create the L1 role and L2 task skeleton ---
    {
        "name": "Data Engineer role + core tasks",
        "message": (
            "Create a new L1 role 'Data Engineer' under the Engineering department (neuron #56) "
            "with role_key 'data_engineer'. Then create these L2 task neurons under it:\n"
            "1. 'ELT pipeline development (medallion architecture)' — bronze/silver/gold layer design\n"
            "2. 'Data ingestion and streaming' — batch and streaming source ingestion\n"
            "3. 'Delta Lake operations and optimization' — table management, performance tuning\n"
            "4. 'Data transformation and processing' — PySpark/Spark SQL transformations\n"
            "5. 'Unity Catalog governance and security' — access control, lineage, data discovery\n"
            "6. 'Workflow orchestration and scheduling' — Databricks Workflows, job management\n"
            "7. 'Delta Live Tables (DLT) pipeline development' — declarative pipeline framework\n"
            "8. 'Change data capture and slowly changing dimensions' — CDC patterns, SCD Type 1/2\n"
            "9. 'Data quality and testing' — expectations, validation, monitoring\n"
            "10. 'Performance tuning and cost optimization' — cluster config, Photon, adaptive query\n"
            "All neurons should have department='Engineering' and role_key='data_engineer'."
        ),
    },

    # --- Phase 2: Bronze layer / ingestion (L3-L5) ---
    # Parent IDs: #304=ELT pipeline, #305=Data ingestion
    {
        "name": "Bronze layer - Auto Loader",
        "message": (
            "Create L3 system neurons under neuron #305 (Data ingestion and streaming, L2 task) "
            "with L4 decision and L5 output children for Auto Loader patterns. "
            "Use parent_id=305 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics (one L3→L4→L5 chain each):\n"
            "- Auto Loader with cloudFiles for JSON/CSV/Parquet landing zones\n"
            "- Schema inference and evolution with Auto Loader (mergeSchema, schemaLocation)\n"
            "- Auto Loader file notification mode vs directory listing mode (when to use each)\n"
            "- Auto Loader configuration: maxFilesPerTrigger, cloudFiles.format options\n"
            "- Rescue data column (_rescued_data) for handling malformed records\n\n"
            "L4 decisions should capture WHEN to use each pattern. L5 outputs should show the code pattern or config."
        ),
    },
    {
        "name": "Bronze layer - Kafka and streaming ingestion",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #305 (Data ingestion and streaming, L2 task). "
            "Use parent_id=305 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- Kafka source ingestion with readStream.format('kafka') — broker config, topic subscription\n"
            "- Structured Streaming trigger modes: availableNow (replaces trigger once), processingTime, continuous\n"
            "- Streaming checkpoint management — checkpointLocation, recovery semantics\n"
            "- Watermarking for late data handling (withWatermark)\n"
            "- Multi-hop streaming: chaining bronze→silver as streaming-to-streaming\n\n"
            "Decisions should explain when each trigger mode is appropriate."
        ),
    },
    {
        "name": "Bronze layer - batch ingestion patterns",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #305 (Data ingestion and streaming, L2 task). "
            "Use parent_id=305 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- COPY INTO for idempotent file ingestion (vs Auto Loader tradeoffs)\n"
            "- Reading from JDBC sources (spark.read.format('jdbc')) with partitioning strategies\n"
            "- Reading from REST APIs via custom UDFs or notebook-based extraction\n"
            "- File format considerations: Parquet vs Delta vs JSON vs CSV performance characteristics\n"
            "- Ingestion metadata columns: _metadata.file_path, _metadata.file_modification_time"
        ),
    },

    # --- Phase 3: Silver layer / transformations ---
    # Parent ID: #307=Data transformation
    {
        "name": "Silver layer - core transformations",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #307 (Data transformation and processing, L2 task). "
            "Use parent_id=307 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- Deduplication strategies: dropDuplicates, window functions with row_number\n"
            "- Data cleansing: handling nulls (coalesce, na.fill), type casting, standardization\n"
            "- Flatten nested JSON: explode(), posexplode(), inline(), schema_of_json()\n"
            "- Pivoting and unpivoting data (pivot/stack patterns)\n"
            "- Complex joins: broadcast joins for small tables, skew join hints (SKEW), SortMerge vs Broadcast\n\n"
            "L4 decisions should explain when to choose each approach."
        ),
    },
    {
        "name": "Silver layer - Spark SQL functions",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #307 (Data transformation and processing, L2 task). "
            "Use parent_id=307 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- Window functions: row_number, rank, dense_rank, lead, lag, ntile with partitionBy/orderBy\n"
            "- Aggregation patterns: groupBy + agg, cube, rollup, grouping_sets\n"
            "- String functions: regexp_extract, regexp_replace, split, concat_ws, trim\n"
            "- Date/time functions: date_trunc, datediff, months_between, from_unixtime, to_timestamp\n"
            "- Higher-order functions: transform, filter, aggregate, exists on array columns\n\n"
            "L5 outputs should show the function signature and a usage example."
        ),
    },

    # --- Phase 4: Gold layer / aggregation ---
    # Parent ID: #304=ELT pipeline development
    {
        "name": "Gold layer - aggregation and serving",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #304 (ELT pipeline development, L2 task). "
            "Use parent_id=304 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics (gold layer patterns):\n"
            "- Materialized views vs gold Delta tables (tradeoffs, refresh strategies)\n"
            "- Star schema modeling in Delta Lake: fact tables, dimension tables, surrogate keys\n"
            "- Pre-aggregated summary tables for dashboards (daily/weekly/monthly rollups)\n"
            "- Gold table partitioning strategies for downstream consumers\n"
            "- Creating views and sharing data via Unity Catalog for BI tool access"
        ),
    },

    # --- Phase 5: Delta Lake operations ---
    # Parent ID: #306=Delta Lake operations
    {
        "name": "Delta Lake - table management",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #306 (Delta Lake operations and optimization, L2 task). "
            "Use parent_id=306 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- OPTIMIZE and ZORDER: when to run, column selection for ZORDER, bin-packing\n"
            "- VACUUM: retention period (default 7 days), interaction with time travel\n"
            "- Time travel: VERSION AS OF, TIMESTAMP AS OF, DESCRIBE HISTORY, restoring tables\n"
            "- Table properties: delta.autoOptimize.optimizeWrite, delta.autoOptimize.autoCompact\n"
            "- Liquid clustering (replaces ZORDER): CLUSTER BY, when to migrate from ZORDER\n"
            "- Delta table constraints: CHECK constraints, NOT NULL, informational FK"
        ),
    },
    {
        "name": "Delta Lake - MERGE and DML",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #306 (Delta Lake operations and optimization, L2 task). "
            "Use parent_id=306 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- MERGE INTO patterns: upsert (match→update, not matched→insert)\n"
            "- MERGE with delete: whenMatchedDelete for soft-delete propagation\n"
            "- MERGE performance: partition pruning, merge condition selectivity\n"
            "- DELETE and UPDATE operations on Delta tables\n"
            "- Schema evolution: mergeSchema, overwriteSchema, adding/renaming columns\n"
            "- Clone operations: SHALLOW CLONE vs DEEP CLONE, use cases for each\n\n"
            "L4 decisions should be specific about when each pattern applies."
        ),
    },

    # --- Phase 6: Unity Catalog ---
    # Parent ID: #308=Unity Catalog
    {
        "name": "Unity Catalog - governance",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #308 (Unity Catalog governance and security, L2 task). "
            "Use parent_id=308 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- Three-level namespace: catalog.schema.table hierarchy\n"
            "- Managed vs external tables/volumes in Unity Catalog\n"
            "- GRANT/REVOKE permissions: table, schema, catalog level ACLs\n"
            "- Row-level and column-level security (row filters, column masks)\n"
            "- Data lineage tracking: automatic lineage from Spark operations\n"
            "- Volumes: managed vs external, for non-tabular data (files, models)"
        ),
    },

    # --- Phase 7: DLT ---
    # Parent ID: #310=DLT
    {
        "name": "Delta Live Tables - pipeline development",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #310 (Delta Live Tables pipeline development, L2 task). "
            "Use parent_id=310 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- DLT table types: streaming tables (@dlt.table with spark.readStream) vs materialized views\n"
            "- DLT expectations for data quality: @dlt.expect, expect_or_drop, expect_or_fail\n"
            "- DLT pipeline modes: triggered vs continuous, development vs production\n"
            "- DLT Python vs SQL syntax comparison\n"
            "- DLT event log: querying pipeline metrics and data quality results\n"
            "- DLT with Auto Loader: cloud_files() function in DLT context"
        ),
    },

    # --- Phase 8: CDC/SCD ---
    # Parent ID: #311=CDC/SCD
    {
        "name": "CDC and SCD patterns",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #311 (Change data capture and slowly changing dimensions, L2 task). "
            "Use parent_id=311 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- CDC with DLT: APPLY CHANGES INTO, specifying keys/sequence_by/columns\n"
            "- SCD Type 1: overwrite with MERGE (matched→update, not matched→insert)\n"
            "- SCD Type 2: tracking history with effective_date, end_date, is_current flag\n"
            "- SCD Type 2 implementation with MERGE: expire old + insert new in one statement\n"
            "- CDC from Debezium/Kafka: parsing change events (op field: c/u/d/r)\n"
            "- APPLY CHANGES INTO with SCD Type 2: STORED AS SCD TYPE 2 option in DLT\n\n"
            "Be very specific about the SQL/Python patterns."
        ),
    },

    # --- Phase 9: Workflows ---
    # Parent ID: #309=Workflow orchestration
    {
        "name": "Workflow orchestration",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #309 (Workflow orchestration and scheduling, L2 task). "
            "Use parent_id=309 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- Databricks Workflows: job creation, task dependencies (DAG), task types\n"
            "- Task types: notebook_task, spark_python_task, dbt_task, pipeline_task (DLT)\n"
            "- Job parameters and task values: dbutils.widgets, taskValues for inter-task communication\n"
            "- Retry policies and failure handling: max_retries, timeout_seconds\n"
            "- Job clusters vs all-purpose clusters (cost implications)\n"
            "- Orchestrating multi-hop pipelines: bronze→silver→gold as job tasks"
        ),
    },

    # --- Phase 10: Data quality ---
    # Parent ID: #312=Data quality
    {
        "name": "Data quality and testing",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #312 (Data quality and testing, L2 task). "
            "Use parent_id=312 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- DLT expectations: expect (warn), expect_or_drop (filter), expect_or_fail (abort)\n"
            "- Custom data quality checks with assert statements in notebooks\n"
            "- Great Expectations integration on Databricks\n"
            "- Monitoring row counts, null rates, and schema drift between runs\n"
            "- Quarantine tables: routing failed-quality records for investigation"
        ),
    },

    # --- Phase 11: Performance and cost ---
    # Parent ID: #313=Performance tuning
    {
        "name": "Performance tuning and cost optimization",
        "message": (
            "Create L3→L4→L5 neuron chains under neuron #313 (Performance tuning and cost optimization, L2 task). "
            "Use parent_id=313 for all L3 neurons. department='Engineering', role_key='data_engineer'.\n\n"
            "Topics:\n"
            "- Photon engine: when it helps (aggregations, joins, Delta operations), when to skip\n"
            "- Adaptive Query Execution (AQE): coalescePartitions, skewJoin, localShuffleReader\n"
            "- Cluster sizing: worker count, instance types, autoscaling min/max\n"
            "- Spot instances vs on-demand for batch vs streaming workloads\n"
            "- Caching strategies: CACHE TABLE, Delta cache, disk cache vs memory cache\n"
            "- Partition pruning: partition columns selection, predicate pushdown, data skipping\n\n"
            "L4 decisions should give specific thresholds and guidelines."
        ),
    },
]


def run_bolster(message: str, department: str = DEPARTMENT, model: str = MODEL) -> dict:
    """Call the bolster API and return the response."""
    resp = requests.post(
        f"{BASE_URL}/admin/bolster",
        json={"message": message, "model": model, "department": department},
        timeout=600,
    )
    resp.raise_for_status()
    return resp.json()


def apply_bolster(session_id: str, update_ids: list[int], new_neuron_ids: list[int]) -> dict:
    """Apply bolster suggestions."""
    resp = requests.post(
        f"{BASE_URL}/admin/bolster/apply",
        json={
            "session_id": session_id,
            "update_ids": update_ids,
            "new_neuron_ids": new_neuron_ids,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def get_neuron_count() -> int:
    resp = requests.get(f"{BASE_URL}/neurons/stats", timeout=10)
    return resp.json()["total_neurons"]


def main():
    parser = argparse.ArgumentParser(description="Ingest Databricks ELT knowledge")
    parser.add_argument("--dry-run", action="store_true", help="Show prompts without calling API")
    parser.add_argument("--start-from", type=int, default=0, help="Skip to batch N (0-indexed)")
    args = parser.parse_args()

    initial_count = get_neuron_count()
    print(f"Starting neuron count: {initial_count}")
    print(f"Batches to run: {len(BATCH_PROMPTS)}")
    print()

    total_created = 0
    total_updated = 0
    total_cost = 0.0

    for i, batch in enumerate(BATCH_PROMPTS):
        if i < args.start_from:
            print(f"[{i+1}/{len(BATCH_PROMPTS)}] SKIPPED: {batch['name']}")
            continue

        print(f"[{i+1}/{len(BATCH_PROMPTS)}] {batch['name']}")

        if args.dry_run:
            print(f"  Prompt: {batch['message'][:120]}...")
            print()
            continue

        try:
            result = run_bolster(batch["message"])
        except Exception as e:
            print(f"  ERROR in bolster call: {e}")
            print(f"  Stopping. Resume with --start-from {i}")
            break

        n_updates = len(result.get("updates", []))
        n_new = len(result.get("new_neurons", []))
        tokens_in = result.get("input_tokens", 0)
        tokens_out = result.get("output_tokens", 0)

        # Estimate cost (Sonnet pricing)
        cost = (tokens_in * 3.0 + tokens_out * 15.0) / 1_000_000
        total_cost += cost

        print(f"  Sonnet: {tokens_in} in / {tokens_out} out (${cost:.4f})")
        print(f"  Suggestions: {n_updates} updates, {n_new} new neurons")
        print(f"  Reasoning: {result.get('reasoning', '')[:150]}")

        if n_updates == 0 and n_new == 0:
            print("  Nothing to apply, skipping")
            print()
            continue

        # Apply all suggestions
        update_ids = list(range(n_updates))
        new_neuron_ids = list(range(n_new))

        try:
            apply_result = apply_bolster(result["session_id"], update_ids, new_neuron_ids)
        except Exception as e:
            print(f"  ERROR in apply: {e}")
            print(f"  Stopping. Resume with --start-from {i}")
            break

        created = apply_result.get("created", 0)
        updated = apply_result.get("updated", 0)
        total_created += created
        total_updated += updated
        print(f"  Applied: {updated} updated, {created} created")
        print()

        # Small delay to be nice to the CLI subprocess
        time.sleep(2)

    final_count = get_neuron_count()
    print("=" * 50)
    print(f"Done! Neurons: {initial_count} → {final_count} (+{final_count - initial_count})")
    print(f"Total created: {total_created}, Total updated: {total_updated}")
    print(f"Estimated cost: ${total_cost:.4f}")


if __name__ == "__main__":
    main()
