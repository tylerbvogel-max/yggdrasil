"""Auto-clustering via label propagation on co-firing edges.

Discovers cross-department neuron clusters that the manual hierarchy
doesn't capture. Uses only numpy (already installed) — no extra deps.

~2K nodes × ~40K edges runs in <100ms.
"""

import numpy as np
from collections import Counter

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Neuron, NeuronEdge


async def find_clusters(
    db: AsyncSession,
    min_weight: float = 0.3,
    min_size: int = 3,
    min_departments: int = 2,
    max_iterations: int = 10,
) -> list[dict]:
    """Run label propagation and return cross-department clusters.

    Returns list of dicts with: cluster_id, neuron_ids, departments,
    avg_internal_weight, suggested_label.
    """
    # Load edges above threshold
    result = await db.execute(
        select(NeuronEdge.source_id, NeuronEdge.target_id, NeuronEdge.weight)
        .where(NeuronEdge.weight >= min_weight)
    )
    edges = result.all()

    if not edges:
        return []

    # Build node set and adjacency
    node_set: set[int] = set()
    for src, tgt, _ in edges:
        node_set.add(src)
        node_set.add(tgt)

    nodes = sorted(node_set)
    node_to_idx = {nid: i for i, nid in enumerate(nodes)}
    n = len(nodes)

    # Adjacency list with weights
    adj: list[list[tuple[int, float]]] = [[] for _ in range(n)]
    for src, tgt, w in edges:
        i, j = node_to_idx[src], node_to_idx[tgt]
        adj[i].append((j, w))
        adj[j].append((i, w))

    # Label propagation: each node starts as its own label
    labels = np.arange(n, dtype=np.int32)
    rng = np.random.default_rng(42)

    for iteration in range(max_iterations):
        order = rng.permutation(n)
        changed = 0
        for i in order:
            neighbors = adj[i]
            if not neighbors:
                continue
            # Weighted vote
            label_weights: dict[int, float] = {}
            for j, w in neighbors:
                lbl = labels[j]
                label_weights[lbl] = label_weights.get(lbl, 0.0) + w
            best_label = max(label_weights, key=label_weights.get)
            if labels[i] != best_label:
                labels[i] = best_label
                changed += 1
        if changed == 0:
            break

    # Group by label
    clusters_raw: dict[int, list[int]] = {}
    for i, lbl in enumerate(labels):
        clusters_raw.setdefault(int(lbl), []).append(nodes[i])

    # Load neuron metadata for filtering and labeling
    all_ids = list(node_set)
    neuron_result = await db.execute(
        select(Neuron.id, Neuron.label, Neuron.department, Neuron.layer)
        .where(Neuron.id.in_(all_ids))
    )
    neuron_info = {r[0]: {"label": r[1], "department": r[2], "layer": r[3]} for r in neuron_result.all()}

    # Filter: keep clusters with min_size and min_departments
    clusters = []
    for cluster_id, (lbl, nids) in enumerate(clusters_raw.items()):
        if len(nids) < min_size:
            continue
        depts = set()
        for nid in nids:
            info = neuron_info.get(nid, {})
            dept = info.get("department")
            if dept:
                depts.add(dept)
        if len(depts) < min_departments:
            continue

        # Calculate avg internal edge weight
        internal_weights = []
        for src, tgt, w in edges:
            if src in set(nids) and tgt in set(nids):
                internal_weights.append(w)
        avg_weight = np.mean(internal_weights) if internal_weights else 0.0

        # Generate suggested label from most common words in neuron labels
        words: list[str] = []
        for nid in nids:
            info = neuron_info.get(nid, {})
            label = info.get("label", "")
            words.extend(w.lower() for w in label.split() if len(w) > 3)
        common = Counter(words).most_common(3)
        suggested = " + ".join(w for w, _ in common) if common else f"Cluster {cluster_id}"

        clusters.append({
            "cluster_id": cluster_id,
            "neuron_ids": sorted(nids),
            "departments": sorted(depts),
            "avg_internal_weight": float(avg_weight),
            "suggested_label": suggested,
        })

    # Sort by size descending
    clusters.sort(key=lambda c: len(c["neuron_ids"]), reverse=True)

    return clusters
