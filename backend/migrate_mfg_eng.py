"""
Migration: Expand Manufacturing Engineer (id=96) neuron tree.

Adds 14 L2 task nodes with 62 new L3 system nodes.
Reparents existing neurons 97 and 101 under new L2 parents.
Preserves all existing firing history, edges, and bolstered neurons.

Usage:
    cd ~/Projects/yggdrasil/backend
    source venv/bin/activate
    python migrate_mfg_eng.py
"""

import asyncio
from sqlalchemy import text
from app.database import engine, async_session
from app.models import Neuron

ROLE_ID = 96
DEPARTMENT = "Engineering"
ROLE_KEY = "mfg_eng"

# Each entry: (L2 label, L2 summary, [(L3 label, L3 content), ...])
# For reparented nodes, use None as content to signal "move existing neuron here"
TREE = [
    (
        "Manufacturing Strategy & Planning",
        "Strategic planning for manufacturing systems — aligning manufacturing capability with business objectives, technology roadmaps, and capacity planning",
        [
            ("Manufacturing Strategy Formulation",
             "Defining manufacturing mission and objectives; aligning mfg strategy with business strategy; functionality of manufacturing systems (cost, quality, flexibility, delivery); generic strategies and their impact on mfg structure."),
            ("Planning Process & Methodology",
             "Defining the planning process; principles of planning; factors affecting planning needs; schools of thought (formal vs. incremental); alternative end states; paradoxes, pitfalls, and implementation difficulties."),
            ("Manufacturing Systems Evolution",
             "Evolution from job shop to batch to mass to flexible manufacturing; system functionality tradeoffs; mapping current-state to future-state capability; qualitative decision analysis for system architecture choices."),
            ("Operational & Capacity Planning",
             "Operational planning for manufacturing systems; rough-cut capacity estimation; linking strategic plans to tactical execution; planning time horizons."),
        ],
    ),
    (
        "Manufacturing Investment Analysis",
        "Economic evaluation, simulation modeling, and financial justification of manufacturing systems, equipment, and automation investments",
        [
            ("Dynamic Modeling of Manufacturing Systems",
             "Rough-cut estimation of system performance; high-resolution simulation (discrete event, Monte Carlo); modeling throughput, utilization, WIP, and bottlenecks for proposed manufacturing configurations."),
            ("Economic Translation & Financial Analysis",
             "Selection of benchmark alternatives; incremental comparison of alternatives; cash flow analysis; NPV, IRR, payback period; composite cost of capital; translating operational improvements to financial metrics."),
            ("Decision Analysis Under Uncertainty",
             "Monte Carlo techniques for capturing deviation; game theory for risk; expected value calculations; decision trees for sequential investment decisions; sensitivity analysis for key assumptions."),
            ("Capital Investment Justification",
             "Building the business case for manufacturing investments; justifying automation and CIM; quantifying intangible benefits (flexibility, quality, lead time); presenting to management with risk-adjusted projections."),
        ],
    ),
    (
        "Cost Estimating & Control",
        "Manufacturing cost structures, estimating methods, learning curves, budgeting for manufacturing operations, and cost forecasting",
        [
            ("Cost Structure & Recovery",
             "Types of costs (direct, indirect, fixed, variable); cost centers; components of labor/overhead rates; understanding cost allocation to manufactured products."),
            ("Manufacturing Budgeting",
             "Direct labor determination; expense and hourly rate determination; indirect manufacturing costs; budgeting for indirect labor cost centers; budgeting on automated workcenters (machine-hour vs. labor-hour)."),
            ("Cost Estimating Process",
             "Required input data for estimates; estimating material costs; estimating labor costs; the cost estimate grid; types of costing systems (job order, process, standard, activity-based); cost review process."),
            ("Learning Curves",
             "Curve parameters and types (Crawford unit, Wright cumulative average); curve construction procedure; integrating learning curves into cost estimates; realization factors; assumptions and effects of forgetting."),
            ("Computer-Assisted Estimating & Forecasting",
             "Parametric cost models; feature-based estimating; computer-assisted cost estimating tools; cost forecasting methods; variance analysis and estimate-at-completion tracking."),
        ],
    ),
    (
        "Manufacturing Control Systems",
        "Conceptual framework for manufacturing management control — MRP, JIT, TQM, and CIM as integrated control paradigms",
        [
            ("Manufacturing Control Process",
             "Organizational control process; the manufacturing control process (plan-execute-measure-correct); manufacturing management accounting as control feedback; levels of manufacturing control (strategic, tactical, operational)."),
            ("Manufacturing Resource Planning (MRP/MRPII)",
             "Evolution from MRP to MRPII; closed-loop MRP; bill of materials management; capacity requirements planning; MRP system architecture and integration points."),
            ("Integrated Control Paradigms",
             "JIT as a control philosophy (pull vs. push); Total Quality as a control system; CIM as information integration; how these paradigms interact and complement each other in a manufacturing enterprise."),
            ("Emerging Manufacturing Control Technologies",
             "Issues facing manufacturing enterprises; evolving control technologies; transition from islands of automation to integrated systems; role of real-time data in manufacturing control; evolution toward smart manufacturing."),
        ],
    ),
    (
        "Management of Manufacturing Technology",
        "Technology lifecycle management — identifying, evaluating, selecting, and deploying manufacturing technologies",
        [
            ("Technology Management Lifecycle",
             "Technology management lifecycle stages; technology selection model; management action model; linking technology decisions to manufacturing strategy."),
            ("Technology Planning & Assessment",
             "Opportunity identification (technology scanning/scouting); opportunity assessment (TRL, manufacturing readiness); management planning tools for technology portfolios."),
            ("Technology Selection & Specification",
             "System definition; technology review and benchmarking; system specification development; system verification methods; make/buy decision framework for manufacturing technology."),
            ("Technology Implementation & Deployment",
             "Preliminary and detailed design of technology deployment; implementation planning; acceptance testing criteria; production support and sustainment; managing the technology transition to production."),
        ],
    ),
    (
        "Design for Manufacture",
        "DFM methodologies, process-driven design, robust design, and quantitative evaluation methods for manufacturing-conscious product design",
        [
            ("DFM Fundamentals & Design Process",
             "The design process from manufacturing perspective; governing characteristics (function, form, material, process); organizational and procedural issues; concurrent engineering approach."),
            ("DFM Process & Imperatives",
             "A structured DFM process; imperatives for effective DFM (minimize part count, standardize, design for ease of fabrication); implementing the DFM imperatives; cross-functional design review."),
            ("DFM Guidelines & Quantitative Methods",
             "DFM guidelines by process type; applying guidelines systematically; quantitative evaluation methods (Boothroyd-Dewhurst DFA analysis, assembly efficiency scores, manufacturability ratings)."),
            ("Robust Design (Taguchi Methods)",
             "Parameter design; tolerance design; signal-to-noise ratios; orthogonal arrays; reducing manufacturing variation through design; quality loss function."),
            ("Computer-Aided & Process-Driven DFM",
             "Tools for process-driven design; computer-aided DFM software; traditional design methodologies (DFMA, value engineering, group technology); comparison of DFM methodologies and when to apply each."),
        ],
    ),
    (
        "Manufacturing Standards & Certification",
        "Standards development, international certification systems, and company standards programs relevant to manufacturing engineering",
        [
            ("Standards Development & Framework",
             "Historical background of manufacturing standards; development process for standards (ANSI, ISO, ASTM, SAE); how standards are created, maintained, and revised; role of the manufacturing engineer in standards bodies."),
            ("International Standards & Certification Systems",
             "ISO 9000 series; AS9100 (aerospace); IATF 16949 (automotive); international certification bodies; Nadcap special process accreditation; CE marking and global compliance."),
            ("Company Standards Programs",
             "Establishing internal manufacturing standards; process specifications; material specifications; workmanship standards; maintaining company standards library; certification of manufacturing processes and personnel."),
        ],
    ),
    (
        "Just-in-Time Manufacturing",
        "JIT philosophy, implementation modules, pull systems, setup reduction, and continuous improvement for manufacturing flow",
        [
            ("JIT Philosophy & Themes",
             "Core JIT themes (waste elimination, continuous improvement, respect for people); planning and assessment for JIT readiness; organizational prerequisites; awareness and education; housekeeping (5S)."),
            ("JIT Process Flow & Setup Reduction",
             "Process flow optimization; cellular manufacturing; setup and changeover reduction (SMED); uniform plant loading; leveled production scheduling; reducing batch sizes toward single-piece flow."),
            ("Pull Systems & Kanban",
             "The pull system concept; kanban design and sizing; signal types (card, container, electronic); supplier network integration for JIT delivery; transitioning from push to pull."),
            ("JIT Implementation & Continuous Improvement",
             "Diagnostic review; conceptual design activities; implementation planning and phasing; kaizen methodology; sustaining JIT gains; quality improvement as integral to JIT."),
        ],
    ),
    (
        "Computer-Integrated Manufacturing",
        "CIM architecture, enabling technologies, integration strategies, and planning/justification for manufacturing automation",
        [
            ("CIM Architecture & Definition",
             "Definition of CIM; driving forces (competition, quality, flexibility); CIM reference models; relationship between CAD, CAM, CAPP, and MES/ERP systems; the product data lifecycle."),
            ("CIM Technologies — Product & Process",
             "Beginning the product cycle (CAD/CAE); manufacturing the product (CNC, robotics, FMS, AGVs); planning and controlling the manufacturing process (CAPP, MRP, shop floor control)."),
            ("Integration & Communication Protocols",
             "Connecting islands of automation; MAP (Manufacturing Automation Protocol) and TOP (Technical Office Protocol); data exchange standards (IGES, STEP); network architecture for manufacturing."),
            ("CIM Planning & Justification",
             "Strategic planning for CIM implementation; phased approach to CIM; justifying CIM investments (tangible and intangible benefits); organizational change management for CIM deployment."),
        ],
    ),
    (
        "Facilities Planning & Plant Layout",
        "Site selection, plant layout optimization, energy management, environmental compliance, and disaster preparedness for manufacturing facilities",
        [
            ("Plant Layout Fundamentals",
             "Economic impact of layout decisions; facility arrangement types (process, product, fixed-position, cellular); layout fundamentals (flow patterns, space requirements, aisle design); systematic layout planning (SLP)."),
            ("Computerized Facilities Planning",
             "Computer-aided layout tools (CRAFT, ALDEP, CORELAP); simulation-based layout evaluation; material flow analysis; integration with process planning."),
            ("Energy Management for Manufacturing",
             "Energy audits for manufacturing operations; energy conservation in manufacturing processes; cogeneration opportunities; energy-efficient equipment selection; utility cost impact on manufacturing costs."),
            ("Environmental Compliance & Pollution Control",
             "Pollution abatement in manufacturing processes; environmental protection regulations affecting manufacturing; waste minimization at source; emissions control; environmental impact of manufacturing process selection."),
        ],
    ),
    (
        "Equipment Planning & Maintenance",
        "Equipment selection, material handling systems, installation, integration, and maintenance strategies for manufacturing equipment",
        [
            ("Equipment Selection & Criteria",
             "Criteria development for equipment selection; the selection process (evaluation matrix, vendor assessment, runoff testing); equipment profile evolution; Manufacturing Automation Protocol (MAP) compliance."),
            ("Group Technology & Equipment Strategy",
             "Group technology as a manufacturing strategy; part family formation; machine cell design; aligning equipment capability with product family requirements; flexible manufacturing systems."),
            ("Material Handling Systems",
             "Material handling segmentation; flow development; performance evaluation; integration of subsystems (conveyors, AGVs, AS/RS, robots); material handling equipment selection criteria."),
            ("Systems Integration & Installation",
             "Integrating equipment into manufacturing cells/lines; equipment installation planning; utility requirements; commissioning and qualification; IQ/OQ/PQ protocols."),
            ("Maintenance Strategy & Implementation",
             "Maintenance principles (reactive, preventive, predictive, TPM); maintenance program development and implementation; MTBF/MTTR analysis; spare parts management; maintenance integration with production scheduling."),
        ],
    ),
    (
        "Production Planning & Control",
        "Forecasting, master scheduling, MRP execution, capacity planning, and shop floor control from the manufacturing engineering perspective",
        [
            ("Demand Forecasting for Manufacturing",
             "Forecasting theory and methods; seasonality adjustment; statistical forecasting; demand/orders management; spares and service parts forecasting; linking forecast accuracy to manufacturing planning."),
            ("Aggregate Planning & Master Scheduling",
             "Sales plan to production plan translation; inventory planning; authorization of master schedule; rough-cut capacity planning; planning time fences; pull method differences from traditional master scheduling."),
            ("Requirements & Capacity Planning",
             "Detail production planning; machine loading; bottleneck recognition (theory of constraints); capacity alternatives (overtime, subcontract, investment); purchased parts planning; MRP vs. JIT execution."),
            ("Scheduling & Production Activity Control",
             "Priority rules and dispatching; work flow patterns (job shop, flow shop, project); simulation for schedule optimization; shop floor control; production reporting and feedback."),
        ],
        # Reparent neuron 97 here
    ),
    (
        "Manufacturing Materials Management",
        "Inventory management, procurement coordination, receiving/inspection, and repetitive manufacturing material flow — manufacturing floor perspective",
        [
            ("Inventory Management for Manufacturing",
             "Use of forecasting in inventory decisions; order points and order quantities (EOQ, safety stock); JIT inventory philosophy; inventory classification (ABC analysis); WIP management."),
            ("Manufacturing Procurement Coordination",
             "Manufacturing engineer's role in vendor selection (process capability requirements); quality and certification requirements for purchased materials; offshore procurement considerations for manufacturing; supplier technical qualification."),
            ("Receiving, Inspection & Storage",
             "Incoming material inspection methods; material identification and traceability; storage requirements (environmental control, shelf life, FIFO); material handling from receiving to point-of-use."),
            ("Repetitive Manufacturing & Line Supply",
             "Dedicated facilities and fixed routings; line supply methods (kanban, kitting, bulk); labor reporting in repetitive environments; material presentation at workstation; supermarket concepts."),
        ],
    ),
    (
        "Manufacturing Process Quality",
        "Quality planning, process capability, FMEA, quality programs, and quality cost analysis from the manufacturing process engineering perspective",
        [
            ("Quality Planning for Manufacturing",
             "Quality planning hierarchy; quality missions, policies, and plans; strategic quality planning; quality organization and inspection structure; monitoring quality outcomes; quality performance data and audits."),
            ("Process Capability Analysis",
             "Conceptual and analytical definitions of process capability; Cp, Cpk, Pp, Ppk indices; process capability vs. specifications; gage and measurement system capability (GR&R); process capability studies methodology."),
            ("FMEA, FTA & Quality Tools",
             "Failure Mode and Effects Analysis (process FMEA); fault tree analysis; Quality Function Deployment (QFD — manufacturing perspective); design review participation; reliability planning; Material Review Board (MRB) process."),
            ("Quality Programs & Standards",
             "Crosby 14-step program; quality assurance teams; zero defects methodology; quality training programs; quality standards implementation; quality audit preparation and response."),
            ("Quality Cost & Improvement",
             "Quality cost categories (prevention, appraisal, internal/external failure); strategic quality planning with cost data; baselines for analysis; product and departmental improvement; supplier quality costs; manufacturing focus on cost of quality."),
        ],
        # Reparent neuron 101 here
    ),
    (
        "Manufacturing Safety & Hazard Analysis",
        "Engineering perspective on occupational safety — hazard analysis, accident prevention, and OSHA compliance for manufacturing processes",
        [
            ("Manufacturing Hazard Analysis",
             "Hazard analysis methods for manufacturing processes; job hazard analysis (JHA); process hazard analysis; identifying hazards in new equipment/process introduction; accident prevention programs; accident investigation methods."),
            ("OSHA Compliance for Manufacturing",
             "OSHA standards relevant to manufacturing (machine guarding, lockout/tagout, confined space, PPE); Hazard Communication Standard (HazCom/GHS); recordkeeping requirements; workplace inspection preparation."),
            ("Safety Integration in Manufacturing Engineering",
             "Safety considerations in process planning; designing safe manufacturing processes; ergonomic considerations in workstation design; management policy toward safety; health and safety program fundamentals."),
        ],
    ),
]

# Index of L2 nodes that should adopt reparented neurons
REPARENT_MAP = {
    11: 97,   # "Production Planning & Control" adopts neuron 97
    13: 101,  # "Manufacturing Process Quality" adopts neuron 101
}


async def get_total_queries(db) -> int:
    result = await db.execute(text("SELECT total_queries FROM system_state WHERE id = 1"))
    row = result.fetchone()
    return row[0] if row else 0


async def migrate():
    async with async_session() as db:
        total_queries = await get_total_queries(db)

        # Verify neuron 96 exists and is mfg_eng role
        result = await db.execute(
            text("SELECT id, label, role_key FROM neurons WHERE id = 96")
        )
        role = result.fetchone()
        if not role or role[2] != "mfg_eng":
            print(f"ERROR: Neuron 96 is not mfg_eng role. Found: {role}")
            return

        # Check if migration already ran (look for first L2 node)
        result = await db.execute(
            text("""
                SELECT COUNT(*) FROM neurons
                WHERE parent_id = 96 AND layer = 2
                AND label = 'Manufacturing Strategy & Planning'
            """)
        )
        if result.scalar() > 0:
            print("Migration already applied — Manufacturing Strategy & Planning L2 node exists.")
            return

        # Verify reparent targets exist
        for l2_idx, neuron_id in REPARENT_MAP.items():
            result = await db.execute(
                text("SELECT id, parent_id, layer, label FROM neurons WHERE id = :id"),
                {"id": neuron_id},
            )
            row = result.fetchone()
            if not row:
                print(f"ERROR: Neuron {neuron_id} not found for reparenting.")
                return
            if row[1] != 96:
                print(f"WARNING: Neuron {neuron_id} parent_id is {row[1]}, expected 96.")
            print(f"Will reparent: [{neuron_id}] L{row[2]} '{row[3]}' → child of L2 '{TREE[l2_idx][0]}'")

        created = 0
        reparented = 0

        for l2_idx, (l2_label, l2_summary, l3_nodes) in enumerate(TREE):
            # Create L2 task node
            l2 = Neuron(
                parent_id=ROLE_ID,
                layer=2,
                node_type="task",
                label=l2_label,
                summary=l2_summary,
                role_key=ROLE_KEY,
                department=DEPARTMENT,
                created_at_query_count=total_queries,
            )
            db.add(l2)
            await db.flush()
            created += 1
            print(f"  Created L2 [{l2.id}]: {l2_label}")

            # Create L3 system nodes
            for l3_label, l3_content in l3_nodes:
                l3 = Neuron(
                    parent_id=l2.id,
                    layer=3,
                    node_type="system",
                    label=l3_label,
                    content=l3_content.strip(),
                    summary=f"System: {l3_label}",
                    role_key=ROLE_KEY,
                    department=DEPARTMENT,
                    created_at_query_count=total_queries,
                )
                db.add(l3)
                await db.flush()
                created += 1

            # Reparent existing neuron if applicable
            if l2_idx in REPARENT_MAP:
                neuron_id = REPARENT_MAP[l2_idx]
                await db.execute(
                    text("UPDATE neurons SET parent_id = :new_parent WHERE id = :id"),
                    {"new_parent": l2.id, "id": neuron_id},
                )
                reparented += 1
                print(f"  Reparented [{neuron_id}] → child of [{l2.id}] {l2_label}")

        await db.commit()

        # Final stats
        result = await db.execute(
            text("SELECT COUNT(*) FROM neurons WHERE role_key = 'mfg_eng'")
        )
        total_mfg = result.scalar()
        print(f"\nDone! Created {created} neurons, reparented {reparented}.")
        print(f"Total mfg_eng neurons: {total_mfg}")


if __name__ == "__main__":
    asyncio.run(migrate())
