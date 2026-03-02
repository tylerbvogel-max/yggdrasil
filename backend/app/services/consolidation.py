"""Periodic decay/pruning of neuron activation history.

Run periodically to:
1. Decay avg_utility on neurons that haven't fired recently
2. Prune old firing records beyond retention window
3. Deactivate neurons with consistently low utility
"""

from sqlalchemy import select, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Neuron, NeuronFiring, SystemState

# Retention: keep firings within 2000 queries
FIRING_RETENTION_QUERIES = 2000
# Decay: reduce avg_utility by 5% per consolidation for unfired neurons
DECAY_RATE = 0.95
# Deactivation threshold: neurons with <0.05 utility after 10+ consolidations
DEACTIVATION_THRESHOLD = 0.05


async def run_consolidation(db: AsyncSession) -> dict:
    """Run periodic consolidation: decay, prune, deactivate."""
    state_result = await db.execute(select(SystemState).where(SystemState.id == 1))
    state = state_result.scalar_one_or_none()
    if not state:
        return {"status": "no_state"}

    total_queries = state.total_queries

    # 1. Prune old firing records
    cutoff = total_queries - FIRING_RETENTION_QUERIES
    if cutoff > 0:
        prune_result = await db.execute(
            delete(NeuronFiring).where(NeuronFiring.global_query_offset < cutoff)
        )
        pruned = prune_result.rowcount
    else:
        pruned = 0

    # 2. Decay utility on neurons that haven't fired recently
    recent_window = max(0, total_queries - 200)
    # Get neurons that have fired recently
    recent_fired = await db.execute(
        select(NeuronFiring.neuron_id).where(
            NeuronFiring.global_query_offset >= recent_window
        ).distinct()
    )
    recently_active_ids = {r[0] for r in recent_fired.all()}

    # Decay all other neurons
    all_neurons = await db.execute(select(Neuron).where(Neuron.is_active == True))
    decayed = 0
    deactivated = 0
    for neuron in all_neurons.scalars():
        if neuron.id not in recently_active_ids:
            neuron.avg_utility *= DECAY_RATE
            decayed += 1

            if neuron.avg_utility < DEACTIVATION_THRESHOLD and neuron.invocations > 0:
                # Only deactivate leaf nodes (layer 5) with very low utility
                if neuron.layer == 5:
                    neuron.is_active = False
                    deactivated += 1

    from datetime import datetime, timezone
    state.last_consolidation_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "status": "consolidated",
        "firings_pruned": pruned,
        "neurons_decayed": decayed,
        "neurons_deactivated": deactivated,
        "total_queries": total_queries,
    }
