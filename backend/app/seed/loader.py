import json
import yaml
from pathlib import Path
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Neuron, SystemState


SEED_FILE = Path(__file__).parent / "yggdrasil_org.yaml"


async def load_seed(db: AsyncSession, force: bool = False) -> dict:
    """Parse YAML org hierarchy and insert neurons into database."""
    count = (await db.execute(select(func.count(Neuron.id)))).scalar() or 0
    if count > 0 and not force:
        return {"status": "already_seeded", "neuron_count": count}

    if force and count > 0:
        await db.execute(Neuron.__table__.delete())
        await db.flush()

    with open(SEED_FILE) as f:
        data = yaml.safe_load(f)

    created = 0
    for dept_data in data.get("departments", []):
        dept = Neuron(
            layer=0,
            node_type="department",
            label=dept_data["label"],
            department=dept_data["label"],
            summary=f"Department: {dept_data['label']}",
            created_at_query_count=0,
        )
        db.add(dept)
        await db.flush()
        created += 1

        for role_data in dept_data.get("roles", []):
            cross_ref = role_data.get("cross_ref_departments")
            role = Neuron(
                parent_id=dept.id,
                layer=1,
                node_type="role",
                label=role_data["label"],
                role_key=role_data.get("role_key"),
                department=dept_data["label"],
                summary=f"Role: {role_data['label']} in {dept_data['label']}",
                cross_ref_departments=json.dumps(cross_ref) if cross_ref else None,
                created_at_query_count=0,
            )
            db.add(role)
            await db.flush()
            created += 1

            for task_data in role_data.get("tasks", []):
                task_cross_ref = task_data.get("cross_ref_departments")
                task = Neuron(
                    parent_id=role.id,
                    layer=2,
                    node_type="task",
                    label=task_data["label"],
                    content=(task_data.get("content", "") or "").strip() or None,
                    role_key=role_data.get("role_key"),
                    department=dept_data["label"],
                    summary=task_data.get("summary") or f"Task: {task_data['label']}",
                    cross_ref_departments=json.dumps(task_cross_ref) if task_cross_ref else None,
                    created_at_query_count=0,
                )
                db.add(task)
                await db.flush()
                created += 1

                for sys_data in task_data.get("systems", []):
                    system = Neuron(
                        parent_id=task.id,
                        layer=3,
                        node_type="system",
                        label=sys_data["label"],
                        content=(sys_data.get("content", "") or "").strip() or None,
                        role_key=role_data.get("role_key"),
                        department=dept_data["label"],
                        summary=sys_data.get("summary") or f"System: {sys_data['label']}",
                        created_at_query_count=0,
                    )
                    db.add(system)
                    await db.flush()
                    created += 1

                    for dec_data in sys_data.get("decisions", []):
                        decision = Neuron(
                            parent_id=system.id,
                            layer=4,
                            node_type="decision",
                            label=dec_data["label"],
                            role_key=role_data.get("role_key"),
                            department=dept_data["label"],
                            summary=f"Decision: {dec_data['label']}",
                            created_at_query_count=0,
                        )
                        db.add(decision)
                        await db.flush()
                        created += 1

                        for out_data in dec_data.get("outputs", []):
                            output = Neuron(
                                parent_id=decision.id,
                                layer=5,
                                node_type="output",
                                label=out_data["label"],
                                content=out_data.get("content", "").strip(),
                                role_key=role_data.get("role_key"),
                                department=dept_data["label"],
                                summary=f"Output: {out_data['label']}",
                                created_at_query_count=0,
                            )
                            db.add(output)
                            await db.flush()
                            created += 1

    # Initialize system state
    state = await db.execute(select(SystemState).where(SystemState.id == 1))
    if not state.scalar_one_or_none():
        db.add(SystemState(id=1, global_token_counter=0, total_queries=0))

    await db.commit()
    final_count = (await db.execute(select(func.count(Neuron.id)))).scalar()
    return {"status": "seeded", "neuron_count": final_count}
