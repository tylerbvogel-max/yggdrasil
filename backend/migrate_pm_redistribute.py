"""
Non-destructive migration: redistribute 5 PM branches to appropriate specialist roles.

Actions:
1. Create new role: Contracts Manager under Contracts & Compliance (L0=114)
   - Move branch 959 (Acquisition strategy & contract management) there
2. Reparent branch 965 (Requirements management & traceability) under Systems Engineer (87)
3. Reparent branch 991 (Safety & mission assurance integration) under Safety Officer (155)
4. Create new role: Program Control Analyst under Program Management (L0=269)
   - Move branch 952 (Cost & schedule baseline management) there
   - Move branch 981 (Work breakdown structure & financial control) there
"""

import sqlite3
import datetime

DB_PATH = "yggdrasil.db"
NOW = datetime.datetime.utcnow().isoformat()
QUERY_COUNT = 79

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

max_id = cur.execute("SELECT MAX(id) FROM neurons").fetchone()[0]
assert max_id == 1001, f"Expected max_id=1001, got {max_id}"
next_id = 1002


def add_neuron(parent_id, layer, node_type, label, department, role_key,
               summary=None, content=None):
    global next_id
    nid = next_id
    next_id += 1
    cur.execute(
        """INSERT INTO neurons
           (id, parent_id, layer, node_type, label, content, summary,
            department, role_key, invocations, avg_utility, is_active,
            created_at_query_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0, 1, ?, ?)""",
        (nid, parent_id, layer, node_type, label, content, summary,
         department, role_key, QUERY_COUNT, NOW),
    )
    return nid


def reparent_branch(neuron_id, new_parent_id, new_department, new_role_key):
    """Reparent a neuron and update department/role_key for it and all descendants."""
    cur.execute("UPDATE neurons SET parent_id=? WHERE id=?", (new_parent_id, neuron_id))
    # Update department and role_key for this neuron and all descendants
    _update_subtree(neuron_id, new_department, new_role_key)


def _update_subtree(neuron_id, department, role_key):
    """Recursively update department and role_key for a neuron and all its children."""
    cur.execute(
        "UPDATE neurons SET department=?, role_key=? WHERE id=?",
        (department, role_key, neuron_id),
    )
    children = cur.execute(
        "SELECT id FROM neurons WHERE parent_id=?", (neuron_id,)
    ).fetchall()
    for (child_id,) in children:
        _update_subtree(child_id, department, role_key)


# =========================================================================
# 1. Create Contracts Manager role under Contracts & Compliance (L0=114)
#    Move branch 959 there
# =========================================================================
print("--- Creating Contracts Manager role ---")
contracts_mgr = add_neuron(
    parent_id=114, layer=1, node_type="role",
    label="Contracts Manager",
    department="Contracts & Compliance",
    role_key="contracts_mgr",
    summary="Manage acquisition strategy, contract negotiation, and partnership agreements",
    content="Senior contracts role responsible for acquisition strategy development, "
            "contract type selection and structuring, partnership and agreement frameworks, "
            "and regulatory compliance oversight. Works with Program Managers to align "
            "contract vehicles with program needs and risk posture.",
)
print(f"  Created Contracts Manager: id={contracts_mgr}")

# Move acquisition strategy branch (959 + 5 children: 960-964)
print("  Moving branch 959 (Acquisition strategy & contract management)")
reparent_branch(959, contracts_mgr, "Contracts & Compliance", "contracts_mgr")

# Verify
moved = cur.execute(
    "SELECT id, label FROM neurons WHERE role_key='contracts_mgr' AND id != ?",
    (contracts_mgr,)
).fetchall()
print(f"  Moved {len(moved)} neurons: {[m[0] for m in moved]}")

# =========================================================================
# 2. Reparent branch 965 under Systems Engineer (87)
# =========================================================================
print("\n--- Moving Requirements management under Systems Engineer ---")
reparent_branch(965, 87, "Engineering", "systems_eng")

moved = cur.execute(
    "SELECT id, label FROM neurons WHERE parent_id=965"
).fetchall()
print(f"  Moved branch 965 + {len(moved)} children under Systems Engineer (87)")

# Verify Systems Engineer now has 3 L2 tasks
se_tasks = cur.execute(
    "SELECT id, label FROM neurons WHERE parent_id=87 ORDER BY id"
).fetchall()
print(f"  Systems Engineer L2 tasks: {[(t[0], t[1]) for t in se_tasks]}")

# =========================================================================
# 3. Reparent branch 991 under Safety Officer (155)
# =========================================================================
print("\n--- Moving S&MA integration under Safety Officer ---")
reparent_branch(991, 155, "Contracts & Compliance", "safety_officer")

moved = cur.execute(
    "SELECT id, label FROM neurons WHERE parent_id=991"
).fetchall()
print(f"  Moved branch 991 + {len(moved)} children under Safety Officer (155)")

# Verify Safety Officer now has 3 L2 tasks
so_tasks = cur.execute(
    "SELECT id, label FROM neurons WHERE parent_id=155 ORDER BY id"
).fetchall()
print(f"  Safety Officer L2 tasks: {[(t[0], t[1]) for t in so_tasks]}")

# =========================================================================
# 4. Create Program Control Analyst role under Program Management (L0=269)
#    Move branches 952 and 981 there
# =========================================================================
print("\n--- Creating Program Control Analyst role ---")
pca_role = add_neuron(
    parent_id=269, layer=1, node_type="role",
    label="Program Control Analyst",
    department="Program Management",
    role_key="program_control",
    summary="Manage cost/schedule baselines, EVM, WBS, and financial control for programs",
    content="Specialist role responsible for establishing and maintaining program cost and "
            "schedule baselines, Earned Value Management implementation, Work Breakdown "
            "Structure development, Integrated Baseline Reviews, JCL analysis, and budget "
            "formulation alignment. Partners with Financial Analysts for reporting and with "
            "Program Managers for decision support.",
)
print(f"  Created Program Control Analyst: id={pca_role}")

# Move cost & schedule baseline management (952 + 6 children: 953-958)
print("  Moving branch 952 (Cost & schedule baseline management)")
reparent_branch(952, pca_role, "Program Management", "program_control")

# Move WBS & financial control (981 + 3 children: 982-984)
print("  Moving branch 981 (Work breakdown structure & financial control)")
reparent_branch(981, pca_role, "Program Management", "program_control")

moved = cur.execute(
    "SELECT id, label FROM neurons WHERE role_key='program_control' AND id != ?",
    (pca_role,)
).fetchall()
print(f"  Moved {len(moved)} neurons total under Program Control Analyst")

# =========================================================================
# Summary
# =========================================================================
conn.commit()

print("\n=== SUMMARY ===")
total = cur.execute("SELECT COUNT(*) FROM neurons").fetchone()[0]
print(f"Total neurons: {total}")

# PM tasks remaining
pm_tasks = cur.execute(
    "SELECT id, label FROM neurons WHERE parent_id=270 ORDER BY id"
).fetchall()
print(f"\nProgram Manager now has {len(pm_tasks)} L2 tasks:")
for t in pm_tasks:
    print(f"  [{t[0]}] {t[1]}")

# New roles
for role_id, role_name in [(contracts_mgr, "Contracts Manager"), (pca_role, "Program Control Analyst")]:
    tasks = cur.execute(
        "SELECT id, label FROM neurons WHERE parent_id=? ORDER BY id", (role_id,)
    ).fetchall()
    count = cur.execute(
        "SELECT COUNT(*) FROM neurons WHERE role_key=(SELECT role_key FROM neurons WHERE id=?)",
        (role_id,)
    ).fetchone()[0]
    print(f"\n{role_name} (id={role_id}) — {count} total neurons, {len(tasks)} L2 tasks:")
    for t in tasks:
        children = cur.execute("SELECT COUNT(*) FROM neurons WHERE parent_id=?", (t[0],)).fetchone()[0]
        print(f"  [{t[0]}] {t[1]} ({children} L3 children)")

# Moved existing roles
for role_id, role_name in [(87, "Systems Engineer"), (155, "Safety Officer")]:
    tasks = cur.execute(
        "SELECT id, label FROM neurons WHERE parent_id=? ORDER BY id", (role_id,)
    ).fetchall()
    print(f"\n{role_name} (id={role_id}) — {len(tasks)} L2 tasks:")
    for t in tasks:
        children = cur.execute("SELECT COUNT(*) FROM neurons WHERE parent_id=?", (t[0],)).fetchone()[0]
        print(f"  [{t[0]}] {t[1]} ({children} L3 children)")

conn.close()
