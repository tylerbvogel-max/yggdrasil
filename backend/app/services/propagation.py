"""Parent chain activation propagation.

When a leaf neuron fires, activation propagates up the tree at decay_rate per layer.
E.g., Layer 5 fires at 0.8 → L4 gets 0.48 → L3 gets 0.29 → ...
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Neuron, PropagationLog


async def propagate_activation(
    db: AsyncSession,
    neuron_id: int,
    activation: float,
    query_id: int,
) -> list[dict]:
    """Walk up parent chain, propagating decayed activation. Returns list of propagation records."""
    records = []
    current_id = neuron_id
    current_activation = activation

    while True:
        result = await db.execute(
            select(Neuron.parent_id).where(Neuron.id == current_id)
        )
        parent_id = result.scalar_one_or_none()
        if parent_id is None:
            break

        current_activation *= settings.propagation_decay

        log = PropagationLog(
            query_id=query_id,
            source_neuron_id=neuron_id,
            target_neuron_id=parent_id,
            activation_value=round(current_activation, 6),
        )
        db.add(log)

        # Increment invocations on parent
        parent = await db.get(Neuron, parent_id)
        if parent:
            parent.invocations = (parent.invocations or 0) + 1

        records.append({
            "target_neuron_id": parent_id,
            "activation": round(current_activation, 6),
        })

        current_id = parent_id

    return records
