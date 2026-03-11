"""Inhibitory regulation service — GABAergic interneuron analogues.

Three-pass inhibition applied after scoring and spread activation:

1. Regional density suppression (basket cell analogue):
   Per-region (department or role_key), if activation count exceeds the regulator's
   threshold, suppress lowest-scoring neurons down to max_survivors.

2. Redundancy suppression (chandelier cell analogue):
   Within each region, suppress neurons whose embedding cosine similarity > threshold
   to an already-selected neuron. Keeps the higher-scoring one.

3. Cross-reference floor guarantee (Martinotti cell analogue):
   Ensures minimum representation for cross-referenced departments by pulling in
   highest-scoring candidates from underrepresented regions.

Feature-flagged via settings.inhibition_enabled.
"""

import json
import numpy as np

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import InhibitoryRegulator, Neuron
from app.services.scoring_engine import NeuronScoreBreakdown


async def apply_inhibition(
    db: AsyncSession,
    scored: list[NeuronScoreBreakdown],
    top_k_count: int,
) -> tuple[list[NeuronScoreBreakdown], int]:
    """Apply 3-pass inhibitory regulation to the scored neuron list.

    Returns (full_list, survivor_count) where survivor_count is the number of
    neurons that passed inhibition. The executor should use survivor_count as
    the effective top-K for prompt assembly and firing.
    """
    if not settings.inhibition_enabled or not scored:
        return scored, min(top_k_count, len(scored))

    top_k = scored[:top_k_count]
    below = scored[top_k_count:]

    if not top_k:
        return scored

    # Load neuron metadata for top-K
    top_ids = [s.neuron_id for s in top_k]
    meta_result = await db.execute(
        select(Neuron.id, Neuron.department, Neuron.role_key, Neuron.embedding, Neuron.cross_ref_departments)
        .where(Neuron.id.in_(top_ids))
    )
    meta_rows = meta_result.all()
    dept_map: dict[int, str] = {}
    role_map: dict[int, str] = {}
    emb_map: dict[int, list[float]] = {}
    cross_ref_map: dict[int, list[str]] = {}

    for nid, dept, role, emb_json, xref in meta_rows:
        dept_map[nid] = dept or ""
        role_map[nid] = role or ""
        if emb_json:
            try:
                emb_map[nid] = json.loads(emb_json)
            except (json.JSONDecodeError, TypeError):
                pass
        if xref:
            try:
                cross_ref_map[nid] = json.loads(xref)
            except (json.JSONDecodeError, TypeError):
                pass

    # Load active inhibitory regulators
    reg_result = await db.execute(
        select(InhibitoryRegulator).where(InhibitoryRegulator.is_active == True)
    )
    regulators = list(reg_result.scalars().all())

    # Build region→regulator lookup
    region_regulators: dict[str, InhibitoryRegulator] = {}
    for reg in regulators:
        key = f"{reg.region_type}:{reg.region_value}"
        region_regulators[key] = reg

    # --- Pass 1: Regional density suppression (basket cell) ---
    survivors = list(top_k)
    suppressed_ids: set[int] = set()

    # Group by department
    dept_groups: dict[str, list[NeuronScoreBreakdown]] = {}
    for s in survivors:
        dept = dept_map.get(s.neuron_id, "")
        dept_groups.setdefault(dept, []).append(s)

    for dept, group in dept_groups.items():
        reg = region_regulators.get(f"department:{dept}")
        threshold = reg.activation_threshold if reg else settings.inhibition_default_threshold
        max_surv = reg.max_survivors if reg else settings.inhibition_default_max_survivors

        if len(group) > threshold:
            # Sort by score descending (already sorted, but be safe)
            group.sort(key=lambda s: s.combined, reverse=True)
            for s in group[max_surv:]:
                suppressed_ids.add(s.neuron_id)

            # Update regulator stats
            if reg:
                reg.total_activations += 1
                reg.total_suppressions += len(group) - max_surv

    survivors = [s for s in survivors if s.neuron_id not in suppressed_ids]

    # --- Pass 2: Redundancy suppression (chandelier cell) ---
    redundant_ids: set[int] = set()
    # Only check pairs within each department to keep it O(n) per dept
    dept_surv_groups: dict[str, list[NeuronScoreBreakdown]] = {}
    for s in survivors:
        dept = dept_map.get(s.neuron_id, "")
        dept_surv_groups.setdefault(dept, []).append(s)

    for dept, group in dept_surv_groups.items():
        if len(group) < 2:
            continue

        # Get embeddings for this group
        group_embs = []
        group_ids = []
        for s in group:
            if s.neuron_id in emb_map:
                group_embs.append(emb_map[s.neuron_id])
                group_ids.append(s.neuron_id)

        if len(group_embs) < 2:
            continue

        # Compute pairwise cosine similarities
        mat = np.array(group_embs, dtype=np.float32)
        sims = mat @ mat.T  # (n, n) cosine similarity matrix

        cosine_threshold = settings.inhibition_redundancy_cosine
        # Check from lowest-scoring to highest — suppress the weaker duplicate
        for i in range(len(group_ids) - 1, 0, -1):
            if group_ids[i] in redundant_ids:
                continue
            for j in range(i):
                if group_ids[j] in redundant_ids:
                    continue
                if sims[i][j] >= cosine_threshold:
                    # Suppress the lower-scoring one (i has lower score since group is sorted desc)
                    redundant_ids.add(group_ids[i])
                    break

    survivors = [s for s in survivors if s.neuron_id not in redundant_ids]

    # --- Pass 3: Cross-reference floor guarantee (Martinotti cell) ---
    # Collect cross-referenced departments from surviving neurons
    cross_ref_depts: set[str] = set()
    for s in survivors:
        xrefs = cross_ref_map.get(s.neuron_id, [])
        cross_ref_depts.update(xrefs)

    if cross_ref_depts:
        # Count current representation per cross-ref dept
        surv_dept_counts: dict[str, int] = {}
        for s in survivors:
            dept = dept_map.get(s.neuron_id, "")
            surv_dept_counts[dept] = surv_dept_counts.get(dept, 0) + 1

        # Pull from below-cutoff to fill underrepresented departments
        min_floor = settings.diversity_floor_min
        surv_ids = {s.neuron_id for s in survivors}
        additions: list[NeuronScoreBreakdown] = []

        for dept in cross_ref_depts:
            current = surv_dept_counts.get(dept, 0)
            if current < min_floor:
                needed = min_floor - current
                # Find best candidates from below_cutoff + suppressed
                all_below = below + [s for s in top_k if s.neuron_id in suppressed_ids or s.neuron_id in redundant_ids]
                for s in all_below:
                    if s.neuron_id in surv_ids:
                        continue
                    if dept_map.get(s.neuron_id, "") == dept:
                        additions.append(s)
                        surv_ids.add(s.neuron_id)
                        needed -= 1
                        if needed <= 0:
                            break

        survivors.extend(additions)

    # Re-sort survivors
    survivors.sort(key=lambda s: s.combined, reverse=True)

    # Rebuild full list: survivors + below_cutoff (excluding any promoted neurons)
    surv_ids = {s.neuron_id for s in survivors}
    remaining = [s for s in below if s.neuron_id not in surv_ids]
    # Also add back suppressed/redundant that weren't promoted, below the survivors
    suppressed_below = [s for s in top_k if s.neuron_id in (suppressed_ids | redundant_ids) and s.neuron_id not in surv_ids]
    suppressed_below.sort(key=lambda s: s.combined, reverse=True)

    return survivors + suppressed_below + remaining, len(survivors)


async def seed_inhibitory_regulators(db: AsyncSession) -> int:
    """Create default inhibitory regulators for each department and high-volume role.

    Returns the number of regulators created.
    """
    # Get all departments
    dept_result = await db.execute(
        text("SELECT DISTINCT department FROM neurons WHERE department IS NOT NULL AND is_active = true")
    )
    departments = [r[0] for r in dept_result.all()]

    # Get high-volume roles (>20 neurons)
    role_result = await db.execute(
        text("""
            SELECT department, role_key, COUNT(*) as cnt
            FROM neurons
            WHERE role_key IS NOT NULL AND is_active = true
            GROUP BY department, role_key
            HAVING COUNT(*) > 20
        """)
    )
    high_volume_roles = role_result.all()

    created = 0

    # Department-level regulators
    for dept in departments:
        existing = await db.execute(
            select(InhibitoryRegulator).where(
                InhibitoryRegulator.region_type == "department",
                InhibitoryRegulator.region_value == dept,
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(InhibitoryRegulator(
                region_type="department",
                region_value=dept,
                activation_threshold=settings.inhibition_default_threshold,
                max_survivors=settings.inhibition_default_max_survivors,
                redundancy_cosine_threshold=settings.inhibition_redundancy_cosine,
            ))
            created += 1

    # Role-level regulators for high-volume roles
    for dept, role_key, cnt in high_volume_roles:
        existing = await db.execute(
            select(InhibitoryRegulator).where(
                InhibitoryRegulator.region_type == "role_key",
                InhibitoryRegulator.region_value == role_key,
            )
        )
        if existing.scalar_one_or_none() is None:
            db.add(InhibitoryRegulator(
                region_type="role_key",
                region_value=role_key,
                activation_threshold=max(10, cnt // 3),
                max_survivors=max(5, cnt // 5),
                redundancy_cosine_threshold=settings.inhibition_redundancy_cosine,
            ))
            created += 1

    await db.flush()
    return created
