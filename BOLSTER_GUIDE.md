# Yggdrasil Role Bolster Guide

## Project Context

Yggdrasil is a biomimetic neuron graph for prompt preparation in a defense/aerospace manufacturing context. It uses a 6-layer hierarchy:

- **L0 — Department**: Top-level organizational grouping (e.g., "Executive Leadership", "Engineering")
- **L1 — Role**: A functional role within the department (e.g., "VP Strategy", "Program Manager")
- **L2 — Task**: Core competency areas and responsibility domains for that role
- **L3 — System**: Operational processes, methodologies, frameworks, and procedures that implement each task
- **L4 — Decision**: Governed decision frameworks with criteria, thresholds, escalation protocols, and authority matrices
- **L5 — Output**: Deliverable templates, report formats, dashboard specifications, and communication packages

The backend is a FastAPI + SQLite app running on port 8002. The bolster API creates new neurons and updates existing ones.

## Current State

There are ~1,336 neurons across 51 roles. Most roles are skeletal (5-15 neurons) with only L1-L2 or L1-L3 depth. The goal is to bring every role to the depth and quality of the **VP Strategy** role (97 neurons, full L1→L5 hierarchy with proper parent chains).

The VP Strategy role has 13 L2 tasks (one per consulting framework), each with 3-5 L3 systems detailing operational processes, 1-2 L4 decisions with explicit criteria and escalation protocols, and 1-2 L5 output deliverable templates. This is the quality bar.

## How to Bolster a Role

### Step 1: Understand the Role's Current State

Query the database to see what exists:
```bash
cd ~/Projects/yggdrasil/backend && source venv/bin/activate
python3 -c "
import sqlite3
conn = sqlite3.connect('yggdrasil.db')
for row in conn.execute('''
    SELECT id, layer, node_type, label, parent_id
    FROM neurons WHERE role_key = ? ORDER BY layer, id
''', ('ROLE_KEY_HERE',)):
    indent = '  ' * row[1]
    print(f'{indent}L{row[1]} {row[2]} #{row[0]}: {row[3]} (parent={row[4]})')
"
```

### Step 2: Build L2 Tasks from Source Material

Using the provided reference documents/URLs, identify 8-15 core competency areas for the role. Each L2 task should represent a distinct responsibility domain — apply MECE thinking (no overlap, full coverage).

Send the first bolster with the role description and L2 task list. The bolster API has a **5,000 character message limit**, so you will need to split across multiple requests.

```bash
curl -s -X POST http://localhost:8002/admin/bolster \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "YOUR MESSAGE HERE (max 5000 chars)",
    "model": "sonnet",
    "department": "DEPARTMENT_NAME"
  }' | python3 -m json.tool
```

### Step 3: Apply Results

```bash
curl -s -X POST http://localhost:8002/admin/bolster/apply \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id": "SESSION_ID_FROM_RESPONSE",
    "update_ids": [0, 1, 2, ...],
    "new_neuron_ids": [0, 1, 2, ...]
  }' | python3 -m json.tool
```

Accept all proposed updates and new neurons by listing all indices.

### Step 4: Deepen with L3 Systems, L4 Decisions, L5 Outputs

After the L2 skeleton is in place, send follow-up bolsters requesting depth. Group 3-4 L2 tasks per bolster to stay under the 5,000 char limit. Be explicit about what you want at each layer:

**L3 Systems** — Ask for operational processes, methodologies, review cadences, tools, and standards. For defense/aerospace context, reference specific standards (MIL-STD, AS9100, FAR/DFARS, ITAR) where applicable. Example: "The Program Manager's EVM task needs L3 systems: CPI/SPI calculation and threshold monitoring process, variance analysis at completion (VAC/EAC) methodology, monthly CPR generation per DI-MGMT-81466, and IPMR Format 1-5 reporting cadence."

**L4 Decisions** — Ask for governed decision frameworks with explicit criteria, thresholds, authority levels, escalation protocols, and documentation requirements. Example: "Add L4 decision: program rebaseline trigger criteria — when CPI < 0.85 or SPI < 0.80 for 3 consecutive months, PM must present rebaseline proposal to PMC within 30 days."

**L5 Outputs** — Ask for deliverable templates, report formats, dashboard specifications, briefing structures, and communication packages. Example: "Add L5 output: Monthly Program Status Review (PSR) briefing template — 12-slide format covering schedule, cost, technical, risk, and action items."

### Step 5: Verify and Fix Parent Chains

After all bolsters are applied, verify the tree integrity. The bolster API sometimes parents neurons to the wrong layer (e.g., L4 decisions pointing to L2 tasks instead of L3 systems). Fix these:

```python
import sqlite3
conn = sqlite3.connect('yggdrasil.db')

# Check for parent chain violations
for layer in range(2, 6):
    bad = conn.execute(f"""
        SELECT n.id, n.label, n.parent_id, p.layer
        FROM neurons n JOIN neurons p ON n.parent_id = p.id
        WHERE n.role_key = 'ROLE_KEY' AND n.layer = {layer}
        AND p.layer != {layer - 1}
    """).fetchall()
    if bad:
        print(f"L{layer} violations: {len(bad)}")
        for b in bad:
            print(f"  #{b[0]} '{b[1]}' -> parent #{b[2]} (L{b[3]}, should be L{layer-1})")
```

Reparent misplaced neurons to the most semantically appropriate parent at the correct layer.

### Step 6: Run Bolsters in Parallel

You can run multiple bolster requests concurrently (use background bash commands). Apply results as they complete. This significantly speeds up the process — a full role can be built in 4-6 bolster rounds.

## Bolster Message Patterns

### Pattern A: Create a new L1 role with L2 tasks
```
Create a new L1 role neuron: "ROLE_NAME" (role_key: ROLE_KEY) under DEPARTMENT.
This role is responsible for [description].

Core L2 task neurons to create:
1. [Task name]: [Detailed description of what this covers]
2. [Task name]: [Detailed description]
...
```

### Pattern B: Deepen existing tasks with L3/L4/L5
```
Deepen the ROLE_NAME subtree. The [Task A] task needs L3 system neurons:
[specific process 1], [specific process 2], [specific process 3].
The [Task B] task needs L3 systems: [process 1], [process 2].
Add L4 decision neurons: [decision framework 1 with criteria],
[decision framework 2 with thresholds].
Add L5 output neurons: [deliverable template 1], [report format 2].
```

## Quality Standards

- Every L2 task should have at least 3 L3 systems beneath it
- Every framework cluster should have at least 1 L4 decision with explicit go/no-go criteria
- Every framework cluster should have at least 1 L5 output deliverable template
- All neurons should reference defense/aerospace manufacturing context where applicable
- Use specific standards (MIL-STD, AS9100, FAR, ITAR, PMBOK, etc.) not generic descriptions
- Target 60-100 neurons per role depending on role complexity
- Simpler roles (Payroll Specialist, IT Support) can be 30-50 neurons
- Complex roles (Program Manager, Quality Manager, Manufacturing Engineer) should be 80-120+

## Department and Role Key Reference

| Department | Role | role_key |
|---|---|---|
| Executive Leadership | Chief Executive Officer | ceo |
| Executive Leadership | Chief Financial Officer | cfo |
| Executive Leadership | Chief Operating Officer | coo |
| Executive Leadership | Chief Technology Officer | cto |
| Executive Leadership | VP Business Development | vp_bd |
| Executive Leadership | VP Engineering | vp_engineering |
| Executive Leadership | VP Operations | vp_ops |
| Business Development | BD Director | bd_director |
| Business Development | Capture Manager | capture_mgr |
| Business Development | Proposal Manager | proposal_mgr |
| Program Management | Program Manager | program_mgr |
| Program Management | Program Control Analyst | program_control |
| Engineering | Electrical Engineer | elec_eng |
| Engineering | Manufacturing Engineer | mfg_eng |
| Engineering | Mechanical Engineer | mech_eng |
| Engineering | Software Engineer | sw_eng |
| Engineering | Systems Engineer | sys_eng |
| Engineering | Test Engineer | test_eng |
| Contracts & Compliance | Contract Analyst | contract_analyst |
| Contracts & Compliance | Contracts Manager | contracts_mgr |
| Contracts & Compliance | Export Control Officer | export_control |
| Contracts & Compliance | FAR/DFARS Specialist | far_dfars_spec |
| Contracts & Compliance | Quality Auditor | quality_auditor |
| Contracts & Compliance | Safety Officer | safety_officer |
| Finance | Cost Accountant | cost_accountant |
| Finance | Cost Estimator | cost_estimator |
| Finance | Financial Analyst | fin_analyst |
| Manufacturing & Operations | Facilities Manager | facilities_mgr |
| Manufacturing & Operations | Production Manager | prod_mgr |
| Manufacturing & Operations | Quality Manager | quality_mgr |
| Manufacturing & Operations | Supply Chain Manager | supply_chain |
| Administrative & Support | HR Generalist | hr_generalist |
| Administrative & Support | IT Support Specialist | it_support |
| Administrative & Support | Payroll Specialist | payroll |
| Administrative & Support | Procurement Specialist | procurement |
