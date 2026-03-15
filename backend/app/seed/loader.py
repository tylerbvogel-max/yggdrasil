import json
import yaml
from pathlib import Path
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Neuron, SystemState


SEED_FILE = Path(__file__).parent / "yggdrasil_org.yaml"


async def _add_neuron(db: AsyncSession, **kwargs) -> Neuron:
    neuron = Neuron(**kwargs, created_at_query_count=0)
    db.add(neuron)
    await db.flush()
    return neuron


def _cross_ref_json(data: dict) -> str | None:
    cross_ref = data.get("cross_ref_departments")
    return json.dumps(cross_ref) if cross_ref else None


def _content_or_none(data: dict) -> str | None:
    return (data.get("content", "") or "").strip() or None


async def _seed_outputs(db: AsyncSession, dec_data: dict, parent_id: int,
                        role_key: str | None, department: str) -> int:
    created = 0
    for out_data in dec_data.get("outputs", []):
        await _add_neuron(
            db, parent_id=parent_id, layer=5, node_type="output",
            label=out_data["label"], content=out_data.get("content", "").strip(),
            role_key=role_key, department=department,
            summary=f"Output: {out_data['label']}",
        )
        created += 1
    return created


async def _seed_decisions(db: AsyncSession, sys_data: dict, parent_id: int,
                          role_key: str | None, department: str) -> int:
    created = 0
    for dec_data in sys_data.get("decisions", []):
        decision = await _add_neuron(
            db, parent_id=parent_id, layer=4, node_type="decision",
            label=dec_data["label"], role_key=role_key, department=department,
            summary=f"Decision: {dec_data['label']}",
        )
        created += 1
        created += await _seed_outputs(db, dec_data, decision.id, role_key, department)
    return created


async def _seed_systems(db: AsyncSession, task_data: dict, parent_id: int,
                        role_key: str | None, department: str) -> int:
    created = 0
    for sys_data in task_data.get("systems", []):
        system = await _add_neuron(
            db, parent_id=parent_id, layer=3, node_type="system",
            label=sys_data["label"], content=_content_or_none(sys_data),
            role_key=role_key, department=department,
            summary=sys_data.get("summary") or f"System: {sys_data['label']}",
        )
        created += 1
        created += await _seed_decisions(db, sys_data, system.id, role_key, department)
    return created


async def _seed_tasks(db: AsyncSession, role_data: dict, parent_id: int,
                      role_key: str | None, department: str) -> int:
    created = 0
    for task_data in role_data.get("tasks", []):
        task = await _add_neuron(
            db, parent_id=parent_id, layer=2, node_type="task",
            label=task_data["label"], content=_content_or_none(task_data),
            role_key=role_key, department=department,
            summary=task_data.get("summary") or f"Task: {task_data['label']}",
            cross_ref_departments=_cross_ref_json(task_data),
        )
        created += 1
        created += await _seed_systems(db, task_data, task.id, role_key, department)
    return created


async def _seed_roles(db: AsyncSession, dept_data: dict, parent_id: int,
                      department: str) -> int:
    created = 0
    for role_data in dept_data.get("roles", []):
        role_key = role_data.get("role_key")
        role = await _add_neuron(
            db, parent_id=parent_id, layer=1, node_type="role",
            label=role_data["label"], role_key=role_key, department=department,
            summary=f"Role: {role_data['label']} in {department}",
            cross_ref_departments=_cross_ref_json(role_data),
        )
        created += 1
        created += await _seed_tasks(db, role_data, role.id, role_key, department)
    return created


async def _seed_departments(db: AsyncSession, data: dict) -> int:
    created = 0
    for dept_data in data.get("departments", []):
        department = dept_data["label"]
        dept = await _add_neuron(
            db, layer=0, node_type="department",
            label=department, department=department,
            summary=f"Department: {department}",
        )
        created += 1
        created += await _seed_roles(db, dept_data, dept.id, department)
    return created


async def _ensure_system_state(db: AsyncSession) -> None:
    state = await db.execute(select(SystemState).where(SystemState.id == 1))
    if not state.scalar_one_or_none():
        db.add(SystemState(id=1, global_token_counter=0, total_queries=0))


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

    await _seed_departments(db, data)
    await _ensure_system_state(db)

    await db.commit()
    final_count = (await db.execute(select(func.count(Neuron.id)))).scalar()
    return {"status": "seeded", "neuron_count": final_count}
