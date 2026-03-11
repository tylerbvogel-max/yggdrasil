"""Bootstrap firing service: pre-seed co-firing edges and invocation stats.

Seeds the neuron graph with informed priors based on:
  Pass 1 — Structural proximity (same parent, same department)
  Pass 2 — Cross-department collaboration affinity matrix
  Pass 3 — Semantic similarity (keyword/content overlap via shared concept linkage)

All bootstrapped edges are tagged source='bootstrap' for traceability.
Bootstrapped weights are conservative (30-50% of organic equivalents) so real
usage quickly overtakes the priors.
"""

import math
from collections import defaultdict

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# ── Cross-department affinity matrix ──
# Values represent collaboration frequency (0-1 scale).
# Symmetric — only define upper triangle; code mirrors both directions.
DEPT_AFFINITY: dict[tuple[str, str], float] = {
    # Engineering works closely with Manufacturing, Quality (Regulatory), and Program Management
    ("Engineering", "Manufacturing & Operations"): 0.70,
    ("Engineering", "Regulatory"): 0.55,
    ("Engineering", "Program Management"): 0.50,
    ("Engineering", "Contracts & Compliance"): 0.35,
    ("Engineering", "Finance"): 0.20,
    ("Engineering", "Business Development"): 0.30,
    ("Engineering", "Executive Leadership"): 0.20,
    ("Engineering", "Administrative & Support"): 0.10,
    # Manufacturing works closely with Quality, Engineering, Program Management
    ("Manufacturing & Operations", "Regulatory"): 0.65,
    ("Manufacturing & Operations", "Program Management"): 0.45,
    ("Manufacturing & Operations", "Contracts & Compliance"): 0.30,
    ("Manufacturing & Operations", "Finance"): 0.25,
    ("Manufacturing & Operations", "Business Development"): 0.15,
    ("Manufacturing & Operations", "Executive Leadership"): 0.20,
    ("Manufacturing & Operations", "Administrative & Support"): 0.15,
    # Contracts works closely with Finance, Program Management, Business Development
    ("Contracts & Compliance", "Finance"): 0.60,
    ("Contracts & Compliance", "Program Management"): 0.55,
    ("Contracts & Compliance", "Business Development"): 0.50,
    ("Contracts & Compliance", "Regulatory"): 0.45,
    ("Contracts & Compliance", "Executive Leadership"): 0.35,
    ("Contracts & Compliance", "Administrative & Support"): 0.20,
    # Finance works with Contracts, Program Management, Executive Leadership
    ("Finance", "Program Management"): 0.50,
    ("Finance", "Executive Leadership"): 0.45,
    ("Finance", "Business Development"): 0.35,
    ("Finance", "Regulatory"): 0.25,
    ("Finance", "Administrative & Support"): 0.20,
    # Program Management coordinates across most departments
    ("Program Management", "Regulatory"): 0.40,
    ("Program Management", "Business Development"): 0.45,
    ("Program Management", "Executive Leadership"): 0.50,
    ("Program Management", "Administrative & Support"): 0.15,
    # Business Development
    ("Business Development", "Executive Leadership"): 0.50,
    ("Business Development", "Regulatory"): 0.20,
    ("Business Development", "Administrative & Support"): 0.10,
    # Regulatory (Quality)
    ("Regulatory", "Executive Leadership"): 0.30,
    ("Regulatory", "Administrative & Support"): 0.15,
    # Executive Leadership
    ("Executive Leadership", "Administrative & Support"): 0.25,
}


def _get_affinity(dept_a: str, dept_b: str) -> float:
    """Look up affinity for a department pair (order-independent)."""
    if dept_a == dept_b:
        return 1.0
    key = (dept_a, dept_b) if (dept_a, dept_b) in DEPT_AFFINITY else (dept_b, dept_a)
    return DEPT_AFFINITY.get(key, 0.05)


async def bootstrap_firings(
    db: AsyncSession,
    dry_run: bool = False,
) -> dict:
    """Pre-seed co-firing edges and invocation estimates.

    Args:
        dry_run: If True, compute stats but don't write anything.

    Returns summary dict with counts and details per pass.
    """
    summary = {
        "pass_1_structural": {"edges_created": 0, "edges_updated": 0},
        "pass_2_cross_dept": {"edges_created": 0, "edges_updated": 0},
        "pass_3_concept": {"edges_created": 0, "edges_updated": 0},
        "pass_4_gap_fill": {"edges_created": 0},
        "neurons_updated": 0,
        "dry_run": dry_run,
    }

    # ── Load all active non-concept neurons with their hierarchy info ──
    result = await db.execute(text("""
        SELECT id, parent_id, layer, department, role_key, label,
               invocations, avg_utility, content
        FROM neurons
        WHERE is_active = true AND layer >= 0
        ORDER BY id
    """))
    rows = result.all()

    neurons = {}
    for r in rows:
        neurons[r[0]] = {
            "id": r[0], "parent_id": r[1], "layer": r[2], "department": r[3],
            "role_key": r[4], "label": r[5], "invocations": r[6],
            "avg_utility": r[7], "content": r[8] or "",
        }

    # Group neurons by parent and department
    by_parent: dict[int, list[int]] = defaultdict(list)
    by_dept: dict[str, list[int]] = defaultdict(list)
    by_dept_role: dict[tuple[str, str | None], list[int]] = defaultdict(list)

    for nid, n in neurons.items():
        if n["parent_id"]:
            by_parent[n["parent_id"]].append(nid)
        if n["department"]:
            by_dept[n["department"]].append(nid)
            by_dept_role[(n["department"], n["role_key"])].append(nid)

    # Track all edges to create (deduplicated)
    # Key: (min_id, max_id), Value: {weight, source_detail}
    edges_to_create: dict[tuple[int, int], dict] = {}

    def _add_edge(a: int, b: int, weight: float, pass_name: str):
        if a == b:
            return
        key = (min(a, b), max(a, b))
        existing = edges_to_create.get(key)
        if existing is None or weight > existing["weight"]:
            edges_to_create[key] = {"weight": weight, "pass": pass_name}

    # ═══════════════════════════════════════════
    # Pass 1: Structural proximity (same parent)
    # ═══════════════════════════════════════════
    for parent_id, children in by_parent.items():
        if len(children) < 2:
            continue
        parent = neurons.get(parent_id)
        # Siblings sharing a parent get baseline co-firing weight
        # Weight scales by layer depth (deeper = more specific = stronger affinity)
        base_w = 0.30  # enough to clear default visibility threshold
        layer_bonus = (parent["layer"] / 5.0) * 0.15 if parent else 0.0
        sibling_weight = min(0.50, base_w + layer_bonus)

        for i, a in enumerate(children):
            for b in children[i + 1:]:
                _add_edge(a, b, sibling_weight, "structural")

    p1_count = len(edges_to_create)
    summary["pass_1_structural"]["edges_created"] = p1_count

    # ═══════════════════════════════════════════
    # Pass 2: Cross-department affinity
    # ═══════════════════════════════════════════
    # For each department pair with affinity > 0.2, co-fire role-level (L1)
    # and task-level (L2) neurons that share keyword overlap
    dept_list = list(by_dept.keys())
    for i, dept_a in enumerate(dept_list):
        for dept_b in dept_list[i + 1:]:
            affinity = _get_affinity(dept_a, dept_b)
            if affinity < 0.20:
                continue

            # Get role-level (L1) and task-level (L2) neurons for each department
            neurons_a = [nid for nid in by_dept[dept_a] if neurons[nid]["layer"] in (1, 2)]
            neurons_b = [nid for nid in by_dept[dept_b] if neurons[nid]["layer"] in (1, 2)]

            if not neurons_a or not neurons_b:
                continue

            # Cross-department edges: weight = affinity * 0.4 (conservative)
            # Only connect neurons with keyword overlap for precision
            for na in neurons_a:
                label_a = neurons[na]["label"].lower()
                words_a = set(label_a.split())
                for nb in neurons_b:
                    label_b = neurons[nb]["label"].lower()
                    words_b = set(label_b.split())
                    # Check for meaningful word overlap (exclude common stop words)
                    stop_words = {"and", "or", "the", "of", "in", "to", "for", "a", "an", "&"}
                    shared = (words_a & words_b) - stop_words
                    if shared:
                        w = min(0.50, affinity * 0.6)
                        _add_edge(na, nb, w, "cross_dept")

    p2_count = len(edges_to_create) - p1_count
    summary["pass_2_cross_dept"]["edges_created"] = p2_count

    # ═══════════════════════════════════════════
    # Pass 3: Concept-linked co-firing
    # ═══════════════════════════════════════════
    # Neurons linked to the same concept should co-fire with each other
    concept_result = await db.execute(text("""
        SELECT n.id FROM neurons n
        WHERE n.node_type = 'concept' AND n.layer = -1 AND n.is_active = true
    """))
    concept_ids = [r[0] for r in concept_result.all()]

    for cid in concept_ids:
        # Get all neurons linked to this concept via instantiation edges
        # Only role (L1) and task (L2) level — avoids combinatorial explosion at leaf layers
        linked_result = await db.execute(text("""
            SELECT CASE WHEN e.source_id = :cid THEN e.target_id ELSE e.source_id END AS linked_id,
                   n.department
            FROM neuron_edges e
            JOIN neurons n ON n.id = CASE WHEN e.source_id = :cid THEN e.target_id ELSE e.source_id END
            WHERE e.edge_type = 'instantiates'
              AND (e.source_id = :cid OR e.target_id = :cid)
              AND n.layer IN (1, 2)
              AND n.is_active = true
        """), {"cid": cid})
        linked = linked_result.all()

        if len(linked) < 2:
            continue

        # Only cross-department pairs (same-dept already covered by Pass 1)
        concept_weight = min(0.40, 0.20 + len(linked) * 0.008)
        for i, (a, dept_a) in enumerate(linked):
            for b, dept_b in linked[i + 1:]:
                if a == b or dept_a == dept_b:
                    continue
                _add_edge(a, b, concept_weight, "concept")

    p3_count = len(edges_to_create) - p1_count - p2_count
    summary["pass_3_concept"]["edges_created"] = p3_count

    # ═══════════════════════════════════════════
    # Pass 4: Gap fill — ensure every neuron has
    # at least one edge >= visibility threshold
    # ═══════════════════════════════════════════
    VISIBILITY_THRESHOLD = 0.30

    # Build set of neurons already covered by planned edges
    covered = set()
    for (a, b), info in edges_to_create.items():
        if info["weight"] >= VISIBILITY_THRESHOLD:
            covered.add(a)
            covered.add(b)

    # Also check existing DB edges for coverage
    existing_covered_result = await db.execute(text("""
        SELECT DISTINCT unnest(ARRAY[source_id, target_id])
        FROM neuron_edges
        WHERE weight >= :thresh
    """), {"thresh": VISIBILITY_THRESHOLD})
    for row in existing_covered_result.all():
        covered.add(row[0])

    # For each uncovered neuron, connect to parent (if exists) or first sibling
    gap_count = 0
    for nid, n in neurons.items():
        if nid in covered:
            continue
        # Connect to parent
        pid = n["parent_id"]
        if pid and pid in neurons:
            _add_edge(nid, pid, VISIBILITY_THRESHOLD, "gap_fill")
            gap_count += 1
            continue
        # No parent — connect to first sibling in same department
        dept_peers = by_dept.get(n["department"], [])
        for peer in dept_peers:
            if peer != nid and peer in covered:
                _add_edge(nid, peer, VISIBILITY_THRESHOLD, "gap_fill")
                gap_count += 1
                break

    summary["pass_4_gap_fill"]["edges_created"] = gap_count

    # ═══════════════════════════════════════════
    # Write edges
    # ═══════════════════════════════════════════
    if not dry_run:
        created = 0
        updated = 0
        for (src, tgt), info in edges_to_create.items():
            w = round(info["weight"], 4)
            # Conservative co_fire_count: derive from weight (weight = co_fire_count / 20)
            co_fire = max(1, round(w * 10))  # ~50% of organic equivalent

            result = await db.execute(text(
                "INSERT INTO neuron_edges (source_id, target_id, co_fire_count, weight, "
                "  last_updated_query, edge_type, source, last_adjusted) "
                "VALUES (:src, :tgt, :cfc, :w, 0, "
                "  CASE WHEN (SELECT department FROM neurons WHERE id = :src) = "
                "       (SELECT department FROM neurons WHERE id = :tgt) "
                "  THEN 'stellate' ELSE 'pyramidal' END, "
                "  'bootstrap', now()) "
                "ON CONFLICT (source_id, target_id) DO UPDATE SET "
                "  weight = GREATEST(neuron_edges.weight, :w), "
                "  source = CASE WHEN neuron_edges.source = 'organic' THEN neuron_edges.source ELSE 'bootstrap' END, "
                "  last_adjusted = now() "
                "WHERE neuron_edges.source != 'organic'"
            ), {"src": src, "tgt": tgt, "cfc": co_fire, "w": w})
            if result.rowcount > 0:
                updated += 1
            else:
                created += 1

        # ── Estimate invocations/utility for neurons with zero organic activity ──
        # Use structural position + sibling average to set reasonable starting values
        neuron_updates = 0
        for nid, n in neurons.items():
            if n["invocations"] > 0:
                continue  # already has organic activity, skip

            # Estimate based on layer (higher layers fire more often)
            # L0: 20, L1: 15, L2: 10, L3: 6, L4: 4, L5: 2
            layer_base = max(2, 20 - n["layer"] * 4)

            # Check siblings' average invocations for calibration
            siblings = by_parent.get(n["parent_id"], []) if n["parent_id"] else []
            sibling_invocations = [neurons[s]["invocations"] for s in siblings if neurons[s]["invocations"] > 0]
            if sibling_invocations:
                # Use sibling average but cap at 50% to stay conservative
                sibling_avg = sum(sibling_invocations) / len(sibling_invocations)
                estimated = round(sibling_avg * 0.5)
            else:
                estimated = layer_base

            # Set utility slightly below default to let organic performance overtake
            estimated_utility = 0.45

            await db.execute(text(
                "UPDATE neurons SET invocations = :inv, avg_utility = :util "
                "WHERE id = :nid AND invocations = 0"
            ), {"nid": nid, "inv": estimated, "util": estimated_utility})
            neuron_updates += 1

        summary["neurons_updated"] = neuron_updates
        await db.commit()

    summary["total_edges"] = len(edges_to_create)
    return summary


async def get_bootstrap_stats(db: AsyncSession) -> dict:
    """Return statistics about bootstrap vs organic edges."""
    result = await db.execute(text("""
        SELECT
            source,
            COUNT(*) as edge_count,
            ROUND(AVG(weight)::numeric, 4) as avg_weight,
            ROUND(AVG(co_fire_count)::numeric, 1) as avg_cofires
        FROM neuron_edges
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY source
    """))
    rows = result.all()

    stats = {}
    for r in rows:
        stats[r[0]] = {
            "edge_count": r[1],
            "avg_weight": float(r[2]) if r[2] else 0,
            "avg_cofires": float(r[3]) if r[3] else 0,
        }

    # Count neurons with bootstrap-only invocations (no organic firings)
    organic_fired = await db.execute(text("""
        SELECT COUNT(DISTINCT n.id)
        FROM neurons n
        JOIN neuron_firings nf ON nf.neuron_id = n.id
        WHERE n.is_active = true AND n.layer >= 0
    """))
    organic_count = organic_fired.scalar() or 0

    total_active = await db.execute(text("""
        SELECT COUNT(*) FROM neurons WHERE is_active = true AND layer >= 0
    """))
    total = total_active.scalar() or 0

    return {
        "edge_sources": stats,
        "neurons_with_organic_firings": organic_count,
        "neurons_bootstrap_only": total - organic_count,
        "total_active_neurons": total,
    }


async def purge_bootstrap(db: AsyncSession) -> dict:
    """Remove all bootstrap-sourced edges and reset bootstrap invocations.

    Use this if bootstrap priors are causing unwanted bias.
    """
    # Delete bootstrap edges
    result = await db.execute(text(
        "DELETE FROM neuron_edges WHERE source = 'bootstrap'"
    ))
    edges_deleted = result.rowcount

    # Reset invocations on neurons that have no organic firings
    inv_result = await db.execute(text("""
        UPDATE neurons SET invocations = 0, avg_utility = 0.5
        WHERE is_active = true AND layer >= 0
          AND id NOT IN (SELECT DISTINCT neuron_id FROM neuron_firings)
          AND invocations > 0
    """))
    neurons_reset = inv_result.rowcount

    await db.commit()
    return {
        "edges_deleted": edges_deleted,
        "neurons_reset": neurons_reset,
    }
