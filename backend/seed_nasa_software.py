"""
Seed NASA Software Engineering neurons into the Yggdrasil neuron graph.

Creates:
- 3 Role nodes (L1) under Regulatory department (#1838)
- 21 Task nodes (L2) under the respective roles

Usage:
    cd ~/Projects/yggdrasil/backend
    source venv/bin/activate
    python seed_nasa_software.py
"""

import asyncio
from sqlalchemy import text
from app.database import async_session

REGULATORY_DEPT_ID = 1838

# Define all neurons to create
# Structure: (role_key, label, layer, node_type, parent_ref, content, source_type)
# parent_ref is either "dept" for department, or a tuple index back-reference

NEURONS = []

# ─── Role Nodes (L1) ───

# Index 0: NPR 7150.2D
NEURONS.append({
    "role_key": "nasa_npr7150",
    "label": "NPR 7150.2D — NASA Software Engineering Requirements",
    "layer": 1,
    "node_type": "role",
    "parent_id": REGULATORY_DEPT_ID,
    "department": "Regulatory",
    "source_type": "regulatory_primary",
    "content": (
        "NPR 7150.2D is NASA's primary procedural requirements document for software engineering, "
        "establishing mandatory requirements for the development, acquisition, maintenance, and "
        "operation of software across all NASA programs and projects. It defines software classification "
        "levels (A through D) based on safety criticality and mission impact, with progressively "
        "stringent requirements for higher-classification software. The standard covers the full "
        "software lifecycle from planning through retirement and applies to both in-house development "
        "and contracted/acquired software."
    ),
})

# Index 1: NASA-STD-8739.8B
NEURONS.append({
    "role_key": "nasa_std8739",
    "label": "NASA-STD-8739.8B — Software Assurance & Safety",
    "layer": 1,
    "node_type": "role",
    "parent_id": REGULATORY_DEPT_ID,
    "department": "Regulatory",
    "source_type": "regulatory_primary",
    "content": (
        "NASA-STD-8739.8B establishes requirements for software assurance and software safety "
        "activities across NASA programs. It mandates independent assessment of software development "
        "processes, products, and risks to ensure mission success and safety. The standard integrates "
        "with NPR 7150.2D and defines how software assurance personnel participate in development "
        "lifecycle activities, perform independent evaluations, and report findings to program management."
    ),
})

# Index 2: NASA SWEHB
NEURONS.append({
    "role_key": "nasa_swehb",
    "label": "NASA SWEHB — Software Engineering Handbook",
    "layer": 1,
    "node_type": "role",
    "parent_id": REGULATORY_DEPT_ID,
    "department": "Regulatory",
    "source_type": "regulatory_primary",
    "content": (
        "The NASA Software Engineering Handbook (SWEHB) provides detailed guidance, best practices, "
        "and recommended approaches for implementing the requirements of NPR 7150.2D. It serves as "
        "the primary reference for NASA software practitioners, offering practical techniques for "
        "software planning, development, testing, and maintenance. Unlike NPR 7150.2D which states "
        "'what' must be done, the SWEHB explains 'how' to accomplish software engineering objectives "
        "with proven methods and industry-aligned practices."
    ),
})

# ─── Task Nodes (L2) under NPR 7150.2D (index 0) ───

NPR7150_TASKS = [
    {
        "label": "Software Management Requirements",
        "content": (
            "Defines requirements for software management planning, organizational roles and "
            "responsibilities, and oversight activities. Requires development of a Software Management "
            "Plan (SMP) that addresses staffing, schedule, budget, risk management, and software "
            "classification. Mandates management reviews at key lifecycle milestones and requires "
            "tracking of software size, effort, cost, and schedule metrics."
        ),
    },
    {
        "label": "Software Development Lifecycle Requirements",
        "content": (
            "Establishes requirements for the overall software development lifecycle including model "
            "selection (waterfall, incremental, agile, spiral), phase definitions, entry/exit criteria, "
            "and milestone reviews. Requires lifecycle documentation including concept documents, "
            "requirements specifications, design documents, and test documentation. Mandates that the "
            "selected lifecycle model be appropriate for the software classification level and project risk."
        ),
    },
    {
        "label": "Software Requirements Management",
        "content": (
            "Requires systematic elicitation, analysis, specification, validation, and management of "
            "software requirements throughout the lifecycle. Mandates bidirectional traceability between "
            "system requirements, software requirements, design elements, code, and test cases. Requires "
            "requirements reviews, baseline control, and impact analysis for all requirement changes."
        ),
    },
    {
        "label": "Software Design",
        "content": (
            "Defines requirements for software architectural design and detailed design activities. "
            "Requires that designs address all specified requirements, define software architecture "
            "with component interfaces, and document design rationale and constraints. Mandates design "
            "reviews (PDR/CDR equivalents) and requires traceability between requirements and design elements."
        ),
    },
    {
        "label": "Software Implementation (Coding)",
        "content": (
            "Establishes requirements for coding standards, code reviews, and implementation practices. "
            "Requires adherence to project-defined coding standards, use of approved programming languages, "
            "and systematic code inspection or review processes. Mandates that code be traceable to design "
            "elements and that unit testing demonstrate code meets design specifications."
        ),
    },
    {
        "label": "Software Testing & Verification",
        "content": (
            "Defines comprehensive testing requirements across unit, integration, system, and acceptance "
            "testing levels. Requires test planning, test case development traceable to requirements, "
            "test execution with documented results, and formal test readiness reviews. Mandates "
            "regression testing for all changes, and requires that test coverage metrics demonstrate "
            "adequate verification of safety-critical and mission-critical requirements."
        ),
    },
    {
        "label": "Software Configuration Management",
        "content": (
            "Requires establishment of a Software Configuration Management (SCM) plan addressing "
            "configuration identification, change control, status accounting, and configuration audits. "
            "Mandates baseline management, formal change request processes, configuration control boards, "
            "and version control for all software work products including code, documentation, and test artifacts."
        ),
    },
    {
        "label": "Software Safety & Mission Assurance",
        "content": (
            "Establishes requirements for software safety analysis, hazard identification, and risk "
            "mitigation in safety-critical software (Class A and B). Requires software fault tree analysis, "
            "software failure modes and effects analysis (SFMEA), and safety-critical code identification. "
            "Mandates coordination with system safety engineering and tracking of safety-related software "
            "requirements through verification."
        ),
    },
    {
        "label": "Software Metrics & Measurement",
        "content": (
            "Requires collection, analysis, and reporting of software metrics to support project "
            "management decision-making and process improvement. Mandates tracking of size metrics "
            "(SLOC, function points), effort, defect density, test coverage, schedule performance, "
            "and cost performance. Requires that metrics be used for trend analysis, risk identification, "
            "and estimation improvement."
        ),
    },
    {
        "label": "Software Acquisition & Third-Party Software",
        "content": (
            "Defines requirements for acquiring, evaluating, and integrating third-party software "
            "including COTS, GOTS, open-source, and reused software. Requires evaluation of third-party "
            "software suitability, licensing compliance, and ongoing maintenance/support assessment. "
            "Mandates that acquired software undergo the same verification rigor as developed software, "
            "proportional to its classification level and criticality."
        ),
    },
    {
        "label": "Software Maintenance & Operations",
        "content": (
            "Establishes requirements for post-deployment software maintenance, operations support, "
            "and sustaining engineering. Requires a Software Maintenance Plan addressing corrective, "
            "adaptive, and perfective maintenance activities. Mandates that maintenance changes follow "
            "the same configuration management and testing processes as initial development, and requires "
            "transition planning for software end-of-life or retirement."
        ),
    },
    {
        "label": "Software Documentation Requirements",
        "content": (
            "Defines the minimum set of documentation artifacts required throughout the software lifecycle, "
            "scaled by software classification level. Requires Software Management Plan, Software "
            "Development Plan, Software Requirements Specification, Software Design Description, Software "
            "Test Plan/Procedures/Reports, and Software Version Description. Mandates document reviews, "
            "approval processes, and configuration control of all documentation artifacts."
        ),
    },
]

# ─── Task Nodes (L2) under NASA-STD-8739.8B (index 1) ───

STD8739_TASKS = [
    {
        "label": "Software Assurance Planning & Organization",
        "content": (
            "Requires development of a Software Assurance Plan that defines organizational structure, "
            "roles, responsibilities, and authorities for software assurance activities. Mandates "
            "independence of software assurance personnel from the development team, with direct "
            "reporting access to program/project management. Requires resource planning for software "
            "assurance staffing proportional to software classification and project complexity."
        ),
    },
    {
        "label": "Software Safety Analysis & Hazard Tracking",
        "content": (
            "Establishes requirements for systematic software safety analysis including software fault "
            "tree analysis (SFTA), software failure modes and effects analysis (SFMEA), and code-level "
            "safety analysis. Requires maintenance of a software safety hazard tracking system linked "
            "to the system-level hazard analysis. Mandates that all safety-critical software requirements "
            "be verified through testing, analysis, or inspection with documented evidence."
        ),
    },
    {
        "label": "Independent Verification & Validation (IV&V)",
        "content": (
            "Defines requirements for Independent Verification and Validation activities performed by "
            "organizations technically, managerially, and financially independent of the development team. "
            "Requires IV&V for Class A (safety-critical, human-rated) software and establishes criteria "
            "for when IV&V is recommended for Class B and C software. Mandates IV&V planning, lifecycle "
            "participation, issue tracking, and reporting to NASA IV&V Program Office."
        ),
    },
    {
        "label": "Software Assurance in Acquisition",
        "content": (
            "Establishes software assurance requirements for contracted and acquired software, including "
            "COTS, GOTS, open-source, and subcontracted development. Requires that contracts include "
            "software assurance provisions, deliverables, and oversight rights. Mandates evaluation of "
            "contractor software processes, independent assessment of contractor deliverables, and "
            "acceptance criteria that include software assurance compliance."
        ),
    },
    {
        "label": "Software Classification & Criticality Analysis",
        "content": (
            "Defines the process for classifying software into Classes A through D based on safety "
            "criticality, mission criticality, and institutional impact. Requires analysis of potential "
            "software failure consequences including loss of life, loss of mission, or degradation of "
            "mission objectives. Classification determines the rigor of software engineering and assurance "
            "requirements applied throughout the lifecycle."
        ),
    },
    {
        "label": "Software Assurance Metrics & Reporting",
        "content": (
            "Requires collection and reporting of software assurance metrics including defect discovery "
            "rates, inspection coverage, test coverage, open issue aging, and risk status. Mandates "
            "regular software assurance status reporting to program/project management with trends, "
            "risks, and recommended actions. Requires that metrics data be used to assess process "
            "effectiveness and support continuous improvement."
        ),
    },
    # ─── NASA-STD-8739.9 tasks (also under nasa_std8739 role) ───
    {
        "label": "Software Formal Inspection Process",
        "content": (
            "NASA-STD-8739.9 defines the formal inspection process for software work products including "
            "requirements, design documents, code, and test artifacts. Establishes a structured multi-step "
            "process: planning, overview, preparation, inspection meeting, rework, and follow-up. Requires "
            "that inspections be data-driven with defined entry/exit criteria, maximum inspection rates, "
            "and documented results including defect counts and inspection effort."
        ),
    },
    {
        "label": "Inspection Roles & Responsibilities",
        "content": (
            "Defines specific roles required for formal inspections: Moderator (trained facilitator who "
            "manages the process), Author (creator of the work product), Readers (present the material), "
            "and Inspectors (identify defects). Requires that moderators be trained and certified, that "
            "inspection teams include domain experts, and that management not attend inspection meetings "
            "to maintain a non-threatening environment focused on defect detection."
        ),
    },
    {
        "label": "Defect Classification & Tracking",
        "content": (
            "Establishes a defect classification taxonomy for formal inspections including severity "
            "levels (major/minor) and defect types (logic, interface, data, documentation, standards). "
            "Requires that all defects identified during inspections be logged, tracked to resolution, "
            "and verified by the moderator. Mandates collection of inspection metrics for process "
            "improvement including defect density by type, phase, and severity."
        ),
    },
]

# ─── Task Nodes (L2) under NASA SWEHB (index 2) ───

SWEHB_TASKS = [
    {
        "label": "Software Lifecycle Models (Waterfall, Agile, Incremental)",
        "content": (
            "Provides guidance on selecting and tailoring software lifecycle models appropriate to "
            "project characteristics, risk, and software classification. Covers traditional waterfall, "
            "incremental, evolutionary, spiral, and agile approaches with NASA-specific considerations. "
            "Addresses how agile practices (Scrum, Kanban, SAFe) can be adapted to meet NPR 7150.2D "
            "requirements while maintaining required documentation and review milestones."
        ),
    },
    {
        "label": "Software Planning & Estimation",
        "content": (
            "Provides techniques for software size estimation (SLOC, function points, story points), "
            "effort estimation (COCOMO II, parametric models, expert judgment), and schedule planning. "
            "Covers Work Breakdown Structure development, resource allocation, risk-adjusted scheduling, "
            "and earned value management integration. Recommends calibration of estimation models using "
            "historical NASA project data."
        ),
    },
    {
        "label": "Software Requirements Analysis",
        "content": (
            "Guides practitioners through requirements elicitation techniques (interviews, prototyping, "
            "use cases, scenarios), analysis methods (modeling, simulation, feasibility studies), and "
            "specification formats (SRS templates, user stories with acceptance criteria). Addresses "
            "requirements quality attributes including completeness, consistency, testability, and "
            "traceability establishment practices."
        ),
    },
    {
        "label": "Software Architecture & Design Patterns",
        "content": (
            "Provides guidance on software architecture development including architectural styles "
            "(layered, event-driven, microservices, real-time), design patterns (publish-subscribe, "
            "state machine, command), and quality attribute trade-off analysis. Covers architecture "
            "documentation using standard views (logical, process, deployment, development) and "
            "architecture evaluation methods (ATAM, SAAM) applicable to NASA flight and ground systems."
        ),
    },
    {
        "label": "Coding Standards & Secure Coding Practices",
        "content": (
            "Provides coding standard guidance including NASA's recommended practices for C, C++, Java, "
            "Python, and Ada. Covers secure coding practices addressing input validation, memory "
            "management, error handling, and privilege management. References JPL Institutional Coding "
            "Standard for C and the Power of 10 rules for safety-critical code. Addresses static "
            "analysis tool usage and automated code quality enforcement."
        ),
    },
    {
        "label": "Software Testing Strategies & Test Planning",
        "content": (
            "Provides comprehensive testing guidance including test strategy development, test case "
            "design techniques (boundary value, equivalence partitioning, state transition, model-based), "
            "and test environment management. Covers testing levels from unit through system acceptance, "
            "with NASA-specific guidance on hardware-in-the-loop testing, simulation-based testing, and "
            "operational readiness testing for flight software."
        ),
    },
    {
        "label": "Software Peer Reviews & Walkthroughs",
        "content": (
            "Provides guidance on implementing peer review processes ranging from informal walkthroughs "
            "to formal inspections per NASA-STD-8739.9. Covers review types (desk checks, pair programming "
            "reviews, Fagan inspections, team reviews), reviewer preparation, defect identification "
            "techniques, and review effectiveness metrics. Addresses integration of peer reviews into "
            "agile workflows through pull request reviews and continuous inspection."
        ),
    },
    {
        "label": "Software Process Improvement & CMMI",
        "content": (
            "Guides organizations in software process improvement using CMMI (Capability Maturity Model "
            "Integration) as a reference framework. Covers process assessment, gap analysis, improvement "
            "planning, and measurement of process maturity. Addresses NASA's institutional requirement "
            "for software process improvement programs and integration with broader organizational "
            "quality management systems and lessons learned programs."
        ),
    },
    {
        "label": "Reuse & COTS/GOTS Software Management",
        "content": (
            "Provides guidance on evaluating, selecting, integrating, and maintaining reusable software "
            "components including COTS (Commercial Off-The-Shelf), GOTS (Government Off-The-Shelf), and "
            "open-source software. Covers licensing analysis, security vulnerability assessment, long-term "
            "supportability evaluation, and integration testing requirements. Addresses software reuse "
            "libraries, component certification, and the unique risks of dependency on third-party "
            "software in mission-critical applications."
        ),
    },
]


async def seed():
    async with async_session() as db:
        created_ids = []

        # Create Role nodes (L1)
        role_ids = {}  # index -> neuron_id
        roles = [
            (0, NEURONS[0]),
            (1, NEURONS[1]),
            (2, NEURONS[2]),
        ]

        for idx, neuron_data in roles:
            result = await db.execute(
                text(
                    "INSERT INTO neurons (parent_id, layer, node_type, label, content, "
                    "department, role_key, source_type, source_origin, is_active) "
                    "VALUES (:parent_id, :layer, :node_type, :label, :content, "
                    ":department, :role_key, :source_type, 'seed', true) "
                    "RETURNING id"
                ),
                {
                    "parent_id": neuron_data["parent_id"],
                    "layer": neuron_data["layer"],
                    "node_type": neuron_data["node_type"],
                    "label": neuron_data["label"],
                    "content": neuron_data["content"],
                    "department": neuron_data["department"],
                    "role_key": neuron_data["role_key"],
                    "source_type": neuron_data["source_type"],
                },
            )
            row = result.fetchone()
            neuron_id = row[0]
            role_ids[idx] = neuron_id
            created_ids.append(neuron_id)
            print(f"  CREATED L1 Role [{neuron_id}] {neuron_data['label']}")

        # Create Task nodes (L2) under NPR 7150.2D
        npr7150_role_id = role_ids[0]
        for task in NPR7150_TASKS:
            result = await db.execute(
                text(
                    "INSERT INTO neurons (parent_id, layer, node_type, label, content, "
                    "department, role_key, source_type, source_origin, is_active) "
                    "VALUES (:parent_id, :layer, :node_type, :label, :content, "
                    ":department, :role_key, :source_type, 'seed', true) "
                    "RETURNING id"
                ),
                {
                    "parent_id": npr7150_role_id,
                    "layer": 2,
                    "node_type": "task",
                    "label": task["label"],
                    "content": task["content"],
                    "department": "Regulatory",
                    "role_key": "nasa_npr7150",
                    "source_type": "regulatory_primary",
                },
            )
            row = result.fetchone()
            neuron_id = row[0]
            created_ids.append(neuron_id)
            print(f"  CREATED L2 Task [{neuron_id}] {task['label']}")

        # Create Task nodes (L2) under NASA-STD-8739.8B (includes 8739.9 tasks)
        std8739_role_id = role_ids[1]
        for task in STD8739_TASKS:
            result = await db.execute(
                text(
                    "INSERT INTO neurons (parent_id, layer, node_type, label, content, "
                    "department, role_key, source_type, source_origin, is_active) "
                    "VALUES (:parent_id, :layer, :node_type, :label, :content, "
                    ":department, :role_key, :source_type, 'seed', true) "
                    "RETURNING id"
                ),
                {
                    "parent_id": std8739_role_id,
                    "layer": 2,
                    "node_type": "task",
                    "label": task["label"],
                    "content": task["content"],
                    "department": "Regulatory",
                    "role_key": "nasa_std8739",
                    "source_type": "regulatory_primary",
                },
            )
            row = result.fetchone()
            neuron_id = row[0]
            created_ids.append(neuron_id)
            print(f"  CREATED L2 Task [{neuron_id}] {task['label']}")

        # Create Task nodes (L2) under NASA SWEHB
        swehb_role_id = role_ids[2]
        for task in SWEHB_TASKS:
            result = await db.execute(
                text(
                    "INSERT INTO neurons (parent_id, layer, node_type, label, content, "
                    "department, role_key, source_type, source_origin, is_active) "
                    "VALUES (:parent_id, :layer, :node_type, :label, :content, "
                    ":department, :role_key, :source_type, 'seed', true) "
                    "RETURNING id"
                ),
                {
                    "parent_id": swehb_role_id,
                    "layer": 2,
                    "node_type": "task",
                    "label": task["label"],
                    "content": task["content"],
                    "department": "Regulatory",
                    "role_key": "nasa_swehb",
                    "source_type": "regulatory_primary",
                },
            )
            row = result.fetchone()
            neuron_id = row[0]
            created_ids.append(neuron_id)
            print(f"  CREATED L2 Task [{neuron_id}] {task['label']}")

        await db.commit()

        print(f"\n{'='*60}")
        print(f"Done! Created {len(created_ids)} neurons.")
        print(f"Role IDs: NPR 7150.2D={role_ids[0]}, STD-8739.8B={role_ids[1]}, SWEHB={role_ids[2]}")
        print(f"All IDs: {created_ids}")


if __name__ == "__main__":
    asyncio.run(seed())
