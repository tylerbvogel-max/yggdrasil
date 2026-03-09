"""Migrate all data from SQLite to PostgreSQL.

Usage:
    cd backend
    source venv/bin/activate
    python migrate_sqlite_to_pg.py
"""

import sqlite3
import psycopg2
from pathlib import Path

SQLITE_PATH = Path(__file__).parent / "yggdrasil.db"
PG_DSN = "postgresql://yggdrasil:yggdrasil@localhost:5432/yggdrasil"

# Tables in dependency order (parents before children)
TABLES = [
    "neurons",
    "system_state",
    "queries",
    "neuron_firings",
    "neuron_edges",
    "neuron_refinements",
    "eval_scores",
    "intent_neuron_map",
    "autopilot_config",
    "autopilot_runs",
    "propagation_log",
    "emergent_queue",
]

# Tables with auto-increment sequences that need resetting
SEQUENCE_TABLES = {
    "neurons": "neurons_id_seq",
    "queries": "queries_id_seq",
    "neuron_firings": "neuron_firings_id_seq",
    "neuron_refinements": "neuron_refinements_id_seq",
    "eval_scores": "eval_scores_id_seq",
    "intent_neuron_map": "intent_neuron_map_id_seq",
    "autopilot_runs": "autopilot_runs_id_seq",
    "propagation_log": "propagation_log_id_seq",
    "emergent_queue": "emergent_queue_id_seq",
}


def migrate():
    if not SQLITE_PATH.exists():
        print(f"SQLite database not found: {SQLITE_PATH}")
        return

    sqlite_conn = sqlite3.connect(str(SQLITE_PATH))
    sqlite_conn.row_factory = sqlite3.Row
    pg_conn = psycopg2.connect(PG_DSN)
    pg_cursor = pg_conn.cursor()

    # Disable FK trigger checks for bulk insert (requires table owner)
    for table in TABLES:
        try:
            pg_cursor.execute(f"ALTER TABLE {table} DISABLE TRIGGER ALL")
        except Exception:
            pg_conn.rollback()

    for table in TABLES:
        # Check if table exists in SQLite
        sqlite_cursor = sqlite_conn.cursor()
        sqlite_cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
        )
        if not sqlite_cursor.fetchone():
            print(f"  {table}: not in SQLite, skipping")
            continue

        # Check if table exists in PostgreSQL
        pg_cursor.execute(
            "SELECT 1 FROM information_schema.tables WHERE table_name = %s AND table_schema = 'public'",
            (table,),
        )
        if not pg_cursor.fetchone():
            print(f"  {table}: not in PostgreSQL, skipping")
            continue

        # Get column names from SQLite
        sqlite_cursor.execute(f"PRAGMA table_info({table})")
        sqlite_cols = [row[1] for row in sqlite_cursor.fetchall()]

        # Get column names from PostgreSQL
        pg_cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = %s AND table_schema = 'public' ORDER BY ordinal_position",
            (table,),
        )
        pg_cols = [row[0] for row in pg_cursor.fetchall()]

        # Use only columns that exist in both
        common_cols = [c for c in sqlite_cols if c in pg_cols]

        # Detect boolean columns in PG (SQLite stores as 0/1)
        pg_cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = %s AND data_type = 'boolean'",
            (table,),
        )
        bool_cols = {row[0] for row in pg_cursor.fetchall()}
        bool_indices = [i for i, c in enumerate(common_cols) if c in bool_cols]

        # Read all rows from SQLite, ordered by id if it exists
        cols_str = ", ".join(common_cols)
        order_clause = " ORDER BY id" if "id" in common_cols else ""
        sqlite_cursor.execute(f"SELECT {cols_str} FROM {table}{order_clause}")
        rows = sqlite_cursor.fetchall()

        if not rows:
            print(f"  {table}: 0 rows (empty)")
            continue

        # Convert 0/1 to True/False for boolean columns
        def convert_row(row):
            row = list(row)
            for idx in bool_indices:
                if row[idx] is not None:
                    row[idx] = bool(row[idx])
            return tuple(row)

        # Clear existing data in PG table
        pg_cursor.execute(f"DELETE FROM {table}")

        # Bulk insert
        placeholders = ", ".join(["%s"] * len(common_cols))
        insert_sql = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})"

        batch_size = 500
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            pg_cursor.executemany(insert_sql, [convert_row(row) for row in batch])

        print(f"  {table}: {len(rows)} rows migrated")

    # Reset sequences
    for table, seq_name in SEQUENCE_TABLES.items():
        try:
            pg_cursor.execute(
                f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {table}), 1))"
            )
        except Exception as e:
            print(f"  Warning: could not reset sequence {seq_name}: {e}")
            pg_conn.rollback()
            pg_cursor.execute("SET session_replication_role = 'replica'")

    # Re-enable FK triggers
    for table in TABLES:
        try:
            pg_cursor.execute(f"ALTER TABLE {table} ENABLE TRIGGER ALL")
        except Exception:
            pg_conn.rollback()

    pg_conn.commit()
    pg_conn.close()
    sqlite_conn.close()
    print("\nMigration complete!")

    # Verify
    pg_conn = psycopg2.connect(PG_DSN)
    pg_cursor = pg_conn.cursor()
    for table in TABLES:
        try:
            pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = pg_cursor.fetchone()[0]
            if count > 0:
                print(f"  {table}: {count} rows in PostgreSQL")
        except Exception:
            pass
    pg_conn.close()


if __name__ == "__main__":
    print("Migrating SQLite → PostgreSQL...")
    print(f"Source: {SQLITE_PATH}")
    print(f"Target: {PG_DSN}\n")
    migrate()
