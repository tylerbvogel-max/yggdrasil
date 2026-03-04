"""
Non-destructive migration: expand Program Manager (id=270) with 10 new L2 task
branches covering full PM discipline areas from DAU + NASA PM Handbook sources.

Existing 11 L2 tasks (271-921) are untouched.
New neurons start at id=946.
"""

import sqlite3
import datetime

DB_PATH = "yggdrasil.db"
DEPARTMENT = "Program Management"
ROLE_KEY = "program_mgr"
PM_ROLE_ID = 270
START_ID = 946
QUERY_COUNT = 79  # current query count for created_at_query_count

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Verify starting point
max_id = cur.execute("SELECT MAX(id) FROM neurons").fetchone()[0]
assert max_id < START_ID, f"Max ID {max_id} >= START_ID {START_ID}, adjust START_ID"

now = datetime.datetime.utcnow().isoformat()
next_id = START_ID


def add_neuron(parent_id, layer, node_type, label, summary=None, content=None):
    global next_id
    nid = next_id
    next_id += 1
    cur.execute(
        """INSERT INTO neurons
           (id, parent_id, layer, node_type, label, content, summary,
            department, role_key, invocations, avg_utility, is_active,
            created_at_query_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0.0, 1, ?, ?)""",
        (nid, parent_id, layer, node_type, label, content, summary,
         DEPARTMENT, ROLE_KEY, QUERY_COUNT, now),
    )
    return nid


# =============================================================================
# L2 Task 1: Program Lifecycle & Phase Gate Management
# =============================================================================
t1 = add_neuron(PM_ROLE_ID, 2, "task", "Program lifecycle and phase gate management",
    summary="Manage program progression through lifecycle phases and key decision points",
    content="Oversee program lifecycle from formulation through closeout, ensuring phase gate criteria are met at each Key Decision Point (KDP). Coordinate life-cycle reviews, Standing Review Boards, and phase transition readiness assessments per NPR 7120.5.")

add_neuron(t1, 3, "system", "Phase gate criteria and KDP preparation",
    summary="Define and verify entry/exit criteria for each lifecycle phase gate",
    content="Prepare Key Decision Point (KDP) packages including technical maturity evidence, cost/schedule status, risk posture, and staffing adequacy. Ensure all phase gate criteria are satisfied before requesting Decision Authority approval. Phases: Pre-Phase A (Concept Studies), Phase A (Concept & Technology Development), Phase B (Preliminary Design), Phase C (Final Design & Fabrication), Phase D (Assembly, Integration & Test), Phase E (Operations), Phase F (Closeout).")

add_neuron(t1, 3, "system", "Life-cycle review planning and execution",
    summary="Plan and conduct mandatory life-cycle reviews at key program milestones",
    content="Coordinate life-cycle reviews (LCRs) including Mission Concept Review (MCR), System Requirements Review (SRR), System Definition Review (SDR), Preliminary Design Review (PDR), Critical Design Review (CDR), System Integration Review (SIR), Operational Readiness Review (ORR), Flight Readiness Review (FRR), Mission Readiness Review (MRR), Post-Launch Assessment Review (PLAR), Decommissioning Review (DR), and Disposal Readiness Review (DRR). Ensure review packages address all six assessment criteria.")

add_neuron(t1, 3, "system", "Standing Review Board coordination",
    summary="Manage independent Standing Review Board composition and activities",
    content="Coordinate Standing Review Board (SRB) establishment, terms of reference, membership selection, and independence requirements. SRBs provide independent expert assessment at each life-cycle review. Ensure SRB findings are documented, tracked, and resolved. Manage Convening Authority responsibilities and reporting.")

add_neuron(t1, 3, "system", "Phase transition readiness assessment",
    summary="Evaluate program readiness to advance between lifecycle phases",
    content="Conduct readiness assessments using product maturity matrices, technical and management product checklists, and the six assessment criteria: (1) strategic alignment, (2) management approach adequacy, (3) technical approach adequacy, (4) cost/schedule estimate adequacy, (5) non-budget resource availability, (6) risk management adequacy. Compile Decision Memorandum for Decision Authority signature.")

add_neuron(t1, 3, "system", "Requirements tailoring for program category and complexity",
    summary="Tailor governance requirements based on program size, category, and risk",
    content="Apply tailoring process per NPR 7120.5 to adapt requirements to program category (Cat 1: >$2B or human spaceflight, Cat 2: $365M-$2B, Cat 3: <$365M) and complexity. Document tailoring rationale, obtain approval from appropriate authority. Accommodate innovative acquisition approaches while maintaining safety and mission assurance standards.")

# =============================================================================
# L2 Task 2: Cost & Schedule Baseline Management
# =============================================================================
t2 = add_neuron(PM_ROLE_ID, 2, "task", "Cost and schedule baseline management",
    summary="Establish, maintain, and defend program cost and schedule baselines",
    content="Develop and maintain credible cost and schedule estimates, establish baselines at key decision points, track performance via Earned Value Management, and manage reserves. Ensure compliance with JCL requirements and federal budgeting processes.")

add_neuron(t2, 3, "system", "Joint Cost and Schedule Confidence Level analysis",
    summary="Perform probabilistic cost/schedule analysis coupling risks to estimates",
    content="Conduct Joint Cost and Schedule Confidence Level (JCL) analysis for programs/projects with LCC >$250M. Achieve minimum 70% JCL at KDP B/C, minimum 50% JCL funding at KDP C. Update JCL at CDR and KDP D for projects ≥$1B. Model cost and schedule risks probabilistically, identify key risk drivers, and inform management reserve and Unallocated Future Expenses (UFE) allocation.")

add_neuron(t2, 3, "system", "Earned Value Management and variance analysis",
    summary="Track cost and schedule performance using EVM metrics",
    content="Implement Earned Value Management (EVM) system per ANSI/EIA-748. Track Cost Performance Index (CPI), Schedule Performance Index (SPI), Budget at Completion (BAC), Estimate at Completion (EAC), and Variance at Completion (VAC). Analyze cost and schedule variances, identify trends, and develop corrective action plans. Conduct monthly EVM reporting with cumulative and current-period metrics.")

add_neuron(t2, 3, "system", "Integrated Baseline Review execution",
    summary="Verify performance measurement baseline through structured reviews",
    content="Conduct Integrated Baseline Reviews (IBR) to verify the Performance Measurement Baseline (PMB) is credible, comprehensive, and executable. Evaluate work scope, schedule, budget, and risk at the control account level. Assess adequacy of management processes, earned value techniques, and variance analysis. Document findings and track corrective actions.")

add_neuron(t2, 3, "system", "Basis of Estimate development and maintenance",
    summary="Document assumptions, methods, and rationale for cost/schedule estimates",
    content="Develop Basis of Estimate (BoE) documentation including ground rules, assumptions, estimating methodology (analogy, parametric, engineering build-up), data sources, model inputs, and rationale. Maintain BoE currency as program matures. Ensure traceability between BoE, WBS, and Integrated Master Schedule (IMS). Support CADRe (Cost Analysis Data Requirement) submissions.")

add_neuron(t2, 3, "system", "Management reserve and UFE allocation",
    summary="Manage budget reserves for known and unknown risks",
    content="Allocate and manage Management Reserve (MR) for known risks within the Performance Measurement Baseline and Unallocated Future Expenses (UFE) for unknown unknowns outside the PMB. Track reserve burn-down rates, establish replenishment triggers, and report reserve status at program reviews. Ensure total budget (PMB + MR + UFE) aligns with Agency Baseline Commitment (ABC).")

add_neuron(t2, 3, "system", "Federal budget formulation and PPBE alignment",
    summary="Align program budgets with NASA's Planning, Programming, Budgeting, and Execution process",
    content="Navigate NASA's Planning, Programming, Budgeting, and Execution (PPBE) process per NPR 9420.1 (formulation) and NPR 9470.1 (execution). Develop and defend budget submissions through mission directorate and agency review cycles. Translate program needs into budget line items, phased funding profiles, and out-year projections. Manage between authorized and appropriated funding levels.")

# =============================================================================
# L2 Task 3: Acquisition Strategy & Contract Management
# =============================================================================
t3 = add_neuron(PM_ROLE_ID, 2, "task", "Acquisition strategy and contract management",
    summary="Develop acquisition strategies and manage contract execution",
    content="Plan and execute acquisition strategies including make/buy decisions, contract type selection, partnership structures, and procurement compliance. Manage contract performance, deliverables, and modifications throughout program lifecycle.")

add_neuron(t3, 3, "system", "Make-buy and competed-directed analysis",
    summary="Analyze sourcing options and competition strategies for program elements",
    content="Conduct make-vs-buy analysis considering technical capability, cost, schedule, risk, and industrial base health. Evaluate competed vs. directed procurement approaches. Assess partnership and contribution opportunities. Document analysis in acquisition strategy with rationale for selected approach. Consider small business set-aside requirements and socioeconomic goals.")

add_neuron(t3, 3, "system", "Acquisition Strategy Meeting preparation",
    summary="Prepare and present acquisition strategy for approval",
    content="Prepare Acquisition Strategy Meeting (ASM) package during program formulation. Present acquisition approach, contract strategy, source selection plan, partnership arrangements, and procurement timeline to Decision Authority. Address industrial base assessment, supply chain risk, and competition considerations. Obtain approval before issuing solicitations.")

add_neuron(t3, 3, "system", "Contract type selection and structuring",
    summary="Select appropriate contract types based on risk allocation and program maturity",
    content="Select contract types based on program maturity, risk allocation, and requirements definition: Firm-Fixed-Price (FFP) for well-defined requirements, Cost-Plus-Fixed-Fee (CPFF) for R&D with uncertain scope, Cost-Plus-Award-Fee (CPAF) for incentivizing performance, Cost-Plus-Incentive-Fee (CPIF) for cost control incentives, Time-and-Materials (T&M) for level-of-effort work. Structure award fee criteria, incentive fee targets, and contract data requirements.")

add_neuron(t3, 3, "system", "Partnership and agreement structures",
    summary="Establish international, interagency, and industry partnership agreements",
    content="Develop and manage partnership structures including Space Act Agreements (SAA) — reimbursable and non-reimbursable, Memoranda of Understanding (MOU), Interagency Agreements (IAA), and international cooperative agreements. Define roles, responsibilities, interfaces, data rights, and intellectual property provisions. Manage partner contributions, milestones, and deliverables.")

add_neuron(t3, 3, "system", "FAR-DFARS compliance for defense and government programs",
    summary="Ensure procurement compliance with Federal Acquisition Regulation",
    content="Ensure acquisition activities comply with Federal Acquisition Regulation (FAR), Defense Federal Acquisition Regulation Supplement (DFARS), and NASA FAR Supplement (NFS). Address key provisions: cost accounting standards (CAS), Truth in Negotiations Act (TINA), contractor business system requirements, organizational conflict of interest, intellectual property and data rights, and contract audit requirements.")

# =============================================================================
# L2 Task 4: Requirements Management & Traceability
# =============================================================================
t4 = add_neuron(PM_ROLE_ID, 2, "task", "Requirements management and traceability",
    summary="Manage requirements flow-down, traceability, and change control",
    content="Establish and maintain requirements hierarchy from program-level through subsystem-level, ensure bidirectional traceability, manage requirements changes through formal change control, and coordinate verification and validation planning.")

add_neuron(t4, 3, "system", "Requirements flow-down and decomposition",
    summary="Decompose top-level requirements through the system hierarchy",
    content="Manage requirements flow-down from programmatic requirements (stakeholder needs, mission objectives) through technical requirements (system, subsystem, component). Categorize requirements as: Programmatic (cost, schedule, performance), Institutional (safety, security, environmental), Allocated (derived from parent to child), Derived (implementation choices), and Technical Authority (engineering, S&MA, health). Ensure each requirement is necessary, verifiable, achievable, and traceable.")

add_neuron(t4, 3, "system", "Verification and validation planning",
    summary="Plan V&V approach for all requirements across program lifecycle",
    content="Develop Verification and Validation (V&V) plan defining methods (test, analysis, inspection, demonstration) for each requirement. Establish V&V success criteria, test procedures, and acceptance thresholds. Coordinate V&V across system levels — component, subsystem, system, and mission. Track V&V completion status through requirements verification matrix. Ensure environmental and qualification testing coverage.")

add_neuron(t4, 3, "system", "Requirements change control and impact assessment",
    summary="Manage requirements changes through formal change control process",
    content="Operate requirements change control process: capture change requests, assess technical/cost/schedule impacts, evaluate ripple effects through traceability matrix, obtain Configuration Control Board (CCB) approval, update requirements baseline, and flow changes to affected work packages. Maintain change history and rationale. Distinguish between class I (baseline) and class II (non-baseline) changes.")

add_neuron(t4, 3, "system", "Traceability matrix development and maintenance",
    summary="Maintain bidirectional traceability from stakeholder needs to verification evidence",
    content="Develop and maintain Requirements Traceability Matrix (RTM) linking stakeholder needs → program requirements → system requirements → subsystem requirements → verification evidence. Ensure bidirectional traceability (parent-to-child and child-to-parent). Identify orphan requirements (no parent) and gold-plating (no child trace). Use traceability to assess change impacts and verify completeness.")

# =============================================================================
# L2 Task 5: Program Governance & Authority
# =============================================================================
t5 = add_neuron(PM_ROLE_ID, 2, "task", "Program governance and authority management",
    summary="Navigate governance structures, authorities, and decision-making processes",
    content="Operate within organizational governance frameworks, coordinate with Technical Authorities, manage formal decision processes, and prepare briefings for management councils. Ensure clear separation of programmatic and institutional responsibilities.")

add_neuron(t5, 3, "system", "Programmatic and institutional authority coordination",
    summary="Navigate the boundary between programmatic and institutional responsibilities",
    content="Manage the interface between Programmatic Authority (mission directorates, programs, projects — responsible for cost, schedule, technical performance) and Institutional Authority (Mission Support Directorate, Center Directors — responsible for workforce, infrastructure, institutional capabilities). Ensure program needs are met through institutional services while respecting authority boundaries. Coordinate center resource allocation and facility usage.")

add_neuron(t5, 3, "system", "Technical Authority coordination",
    summary="Interface with independent Technical Authority disciplines",
    content="Coordinate with three Technical Authority (TA) disciplines independently funded from program budgets: Engineering Technical Authority (Office of the Chief Engineer — OCE), Safety and Mission Assurance Technical Authority (Office of Safety and Mission Assurance — OSMA), and Health and Medical Technical Authority (Office of the Chief Health and Medical Officer — OCHMO). Manage TA requirements, waivers, and dissent resolution while maintaining TA independence.")

add_neuron(t5, 3, "system", "Formal dissent process management",
    summary="Manage technical and programmatic disagreement resolution",
    content="Administer the formal dissent process for documenting and escalating technical or programmatic disagreements that cannot be resolved at working level. Ensure dissenting opinions are captured, documented, and elevated to appropriate Decision Authority. Track dissent resolution through management chain. Protect dissenter rights while maintaining program progress. Document resolution rationale and any accepted risks.")

add_neuron(t5, 3, "system", "Management council briefing preparation",
    summary="Prepare program briefings for Agency, Directorate, and Center management councils",
    content="Prepare briefing packages for management councils: Agency Program Management Council (APMC, chaired by Associate Administrator), Mission Directorate PMC (DPMC, chaired by MDAA), and Center Management Council (CMC). Address program status, performance against baselines, risk posture, resource needs, and decision requests. Tailor content to council level and decision authority. Support Decision Memorandum development and signature.")

add_neuron(t5, 3, "system", "Decision memorandum development",
    summary="Draft and coordinate formal decision documents for program milestones",
    content="Develop Decision Memoranda documenting Key Decision Point outcomes, authorized cost/schedule/content parameters, conditions and actions required for next phase, and concurrence signatures. Capture Decision Authority direction, resource commitments, and any tailoring approvals. Ensure decision memoranda align with Agency Baseline Commitment (ABC) and Management Agreement frameworks.")

# =============================================================================
# L2 Task 6: Stakeholder & External Reporting
# =============================================================================
t6 = add_neuron(PM_ROLE_ID, 2, "task", "Stakeholder communication and external reporting",
    summary="Manage stakeholder communications, external reporting, and partnership coordination",
    content="Coordinate program communications across internal and external stakeholders, manage congressional and oversight body reporting requirements, maintain partnership relationships, and implement knowledge management practices.")

add_neuron(t6, 3, "system", "Congressional and oversight body reporting",
    summary="Prepare and submit required reports to Congress, OMB, and oversight bodies",
    content="Manage external reporting requirements for major programs (LCC >$250M): prepare quarterly and annual reports to Congress and OMB, respond to Government Accountability Office (GAO) reviews, support Inspector General audits. Report significant cost/schedule breaches per Nunn-McCurdy (defense) or NASA Authorization Act thresholds. Develop corrective action plans for breached baselines.")

add_neuron(t6, 3, "system", "Program status communication and reporting cadence",
    summary="Establish and maintain program status reporting across stakeholder tiers",
    content="Define and execute program communication plan: monthly program status reports with EVM dashboards, weekly management summaries, quarterly program reviews, and ad-hoc status updates for significant events. Tailor reporting content and frequency to stakeholder tier — sponsors, customers, partners, team leads. Maintain single source of truth for program metrics and status.")

add_neuron(t6, 3, "system", "International and interagency partnership management",
    summary="Manage ongoing relationships with international and government partners",
    content="Manage day-to-day partnership coordination: joint schedule integration, interface control document maintenance, data exchange, technology transfer controls (ITAR/EAR compliance), partner milestone tracking, and contribution verification. Conduct joint program reviews. Manage cultural and time zone challenges for international partnerships. Escalate and resolve interface issues.")

add_neuron(t6, 3, "system", "Knowledge management and lessons learned",
    summary="Capture, share, and apply program knowledge and lessons learned",
    content="Implement knowledge management approach: capture lessons learned at program reviews and phase gates, maintain searchable lessons learned database, conduct knowledge-sharing sessions, document institutional knowledge before personnel transitions. Apply relevant lessons from predecessor programs during formulation. Develop Knowledge Management Plan and conduct post-project knowledge capture at closeout (Phase F).")

# =============================================================================
# L2 Task 7: Work Breakdown Structure & Financial Control
# =============================================================================
t7 = add_neuron(PM_ROLE_ID, 2, "task", "Work breakdown structure and financial control",
    summary="Develop WBS framework and align financial tracking with work scope",
    content="Establish product-oriented Work Breakdown Structure as the framework for planning, budgeting, scheduling, cost accounting, and performance reporting. Ensure WBS integrates with organizational structure and financial systems.")

add_neuron(t7, 3, "system", "WBS development and dictionary maintenance",
    summary="Develop product-oriented WBS and maintain work package definitions",
    content="Develop Work Breakdown Structure (WBS) per NASA standard (NPR 7120.5) or MIL-STD-881 for defense programs. Use product-oriented decomposition — each element represents a deliverable product, service, or data item. Maintain WBS dictionary defining scope, deliverables, responsible organization, and success criteria for each element. Extend WBS to control account level for EVM integration.")

add_neuron(t7, 3, "system", "Financial tracking and accounting alignment",
    summary="Align WBS with accounting systems for accurate cost collection and reporting",
    content="Ensure WBS aligns with agency financial system and cost accounting structure. Map WBS elements to charge numbers, cost accounts, and budget line items. Track actual costs against budgeted costs at control account and work package level. Reconcile financial system data with EVM data. Support CADRe (Cost Analysis Data Requirement) submissions with accurate historical cost data.")

add_neuron(t7, 3, "system", "Performance Measurement Baseline structure",
    summary="Establish PMB integrating scope, schedule, and budget at control account level",
    content="Structure Performance Measurement Baseline (PMB) integrating authorized work scope, time-phased budget, and schedule at the control account level. Ensure PMB = sum of all control account budgets. Establish Budgeted Cost of Work Scheduled (BCWS) time-phased profile. Define earned value measurement techniques for each control account (milestones, percent complete, level of effort, apportioned effort). Maintain PMB integrity through formal change control.")

# =============================================================================
# L2 Task 8: Program Formulation & Planning
# =============================================================================
t8 = add_neuron(PM_ROLE_ID, 2, "task", "Program formulation and strategic planning",
    summary="Lead program formulation including concept development, trade studies, and planning",
    content="Lead program formulation activities from concept studies through preliminary design, developing the technical approach, acquisition strategy, cost and schedule estimates, and organizational structure. Produce key formulation products: Formulation Agreement, Program/Project Plan, and Program Commitment Agreement.")

add_neuron(t8, 3, "system", "Concept studies and Design Reference Mission analysis",
    summary="Conduct and manage concept studies and mission architecture analysis",
    content="Lead Pre-Phase A concept studies: develop Design Reference Missions (DRMs) defining mission objectives, concept of operations, and system architecture options. Conduct feasibility studies, technology surveys, and preliminary risk assessments. Evaluate multiple mission concepts against science/mission objectives, cost, schedule, and risk criteria. Support Mission Concept Review (MCR) preparation.")

add_neuron(t8, 3, "system", "Alternatives analysis and trade studies",
    summary="Evaluate alternative approaches and conduct trade studies for key decisions",
    content="Conduct Analysis of Alternatives (AoA) evaluating competing approaches for mission architecture, technology selection, and implementation strategy. Define trade study criteria (performance, cost, schedule, risk, operability). Apply decision analysis methods (weighted scoring, Pugh matrix, multi-attribute utility theory). Document trade rationale and sensitivity analysis. Feed results into acquisition strategy and requirements baseline.")

add_neuron(t8, 3, "system", "Technology Readiness Level assessment integration",
    summary="Integrate TRL assessments into program planning and risk management",
    content="Integrate Technology Readiness Level (TRL) assessments into program planning: assess TRL of critical technologies at each phase gate, develop Technology Development Plans for technologies below TRL 6, identify technology maturation risks and mitigation strategies. Coordinate with technology development programs. Ensure TRL ≥ 6 for critical technologies before KDP C (entry to Final Design). Track technology maturation progress.")

add_neuron(t8, 3, "system", "Program and project plan development",
    summary="Develop comprehensive program/project plans for stakeholder approval",
    content="Develop Program Plan (or Project Plan) as the governing management document: define mission objectives, technical approach, organizational structure, roles and responsibilities, management processes, schedule, cost estimate, risk management approach, acquisition strategy, and key milestones. Incorporate 28 control plans by reference. Obtain Decision Authority approval. Update plan at each major phase transition.")

add_neuron(t8, 3, "system", "Formulation Agreement and Program Commitment Agreement",
    summary="Develop formal agreements authorizing program formulation and implementation",
    content="Develop Formulation Agreement (FA) — agreement between Mission Directorate and program/project authorizing formulation activities, defining scope, resources, and schedule for formulation phase. Develop Program Commitment Agreement (PCA) — agreement between MDAA and AA authorizing transition to implementation, documenting cost/schedule/technical baselines, safety factors, and stakeholder commitments. These agreements establish the Agency Baseline Commitment (ABC).")

# =============================================================================
# L2 Task 9: Safety & Mission Assurance Integration
# =============================================================================
t9 = add_neuron(PM_ROLE_ID, 2, "task", "Safety and mission assurance integration",
    summary="Integrate safety and mission assurance requirements into program execution",
    content="Coordinate Safety and Mission Assurance (S&MA) activities across the program, ensuring compliance with NASA safety standards, environmental regulations, and quality requirements. Interface with S&MA Technical Authority while maintaining program schedule and budget.")

add_neuron(t9, 3, "system", "Safety and mission assurance plan coordination",
    summary="Develop and coordinate S&MA plan with Technical Authority",
    content="Coordinate development of Safety and Mission Assurance Plan with OSMA Technical Authority. Define S&MA requirements, processes, and deliverables for each program phase. Address: reliability analysis, failure modes and effects analysis (FMEA), probabilistic risk assessment (PRA), parts and materials selection, contamination control, software assurance, and quality management. Ensure S&MA activities are funded, scheduled, and staffed.")

add_neuron(t9, 3, "system", "Human-rating certification coordination",
    summary="Manage human-rating certification process for crewed systems",
    content="Coordinate human-rating certification per NPR 8705.2 for crewed spacecraft and launch vehicles. Manage Human-Rating Certification Package development, track certification requirements compliance, coordinate human factors engineering, crew safety analysis, abort system verification, and life support qualification. Interface with Crew Office, Astronaut Health, and independent safety panels. Applicable to human spaceflight programs.")

add_neuron(t9, 3, "system", "Environmental compliance and NEPA coordination",
    summary="Ensure environmental regulatory compliance including NEPA documentation",
    content="Manage National Environmental Policy Act (NEPA) compliance documentation: Environmental Impact Statements (EIS), Environmental Assessments (EA), or Categorical Exclusions as appropriate. Coordinate with environmental offices for launch site environmental reviews, orbital debris compliance per NASA-STD-8719.14, nuclear launch safety per NPR 8715.3 (for RTG/RHU missions), and hazardous materials management. Obtain environmental approvals before irreversible commitments.")

add_neuron(t9, 3, "system", "Quality assurance and surveillance planning",
    summary="Establish quality assurance approach for program deliverables",
    content="Develop Quality Assurance Surveillance Plan (QASP) defining government oversight of contractor quality systems. Establish acceptance criteria, inspection points, and surveillance methods. Coordinate quality requirements flow-down to subcontractors. Monitor contractor quality metrics: nonconformance rates, corrective action effectiveness, process audit results. Ensure AS9100 or equivalent QMS compliance for aerospace contractors.")

# =============================================================================
# L2 Task 10: Leading Indicators & Program Health
# =============================================================================
t10 = add_neuron(PM_ROLE_ID, 2, "task", "Leading indicators and program health assessment",
    summary="Monitor program health using leading indicators and trend analysis",
    content="Establish and monitor leading indicators for early detection of program issues. Track program health metrics across cost, schedule, technical, and risk dimensions. Analyze trends and develop proactive corrective actions before problems become critical.")

add_neuron(t10, 3, "system", "Required and recommended leading indicators",
    summary="Implement NASA-required and program-specific leading indicators",
    content="Implement NASA-required leading indicators per NPR 7120.5: cost and schedule growth trends, reserve consumption rates, risk closure rates, requirements volatility, technical performance measures, and staffing metrics. Develop program-specific indicators tailored to mission type and risk profile. Establish indicator thresholds (green/yellow/red) and escalation triggers. Report leading indicators at monthly program reviews and management council briefings.")

add_neuron(t10, 3, "system", "Program health dashboard and metrics framework",
    summary="Maintain comprehensive program health dashboard for management visibility",
    content="Develop and maintain program health dashboard integrating: EVM metrics (CPI, SPI, EAC), risk burn-down charts, requirements closure status, review action item tracking, technology maturation progress, workforce loading, and major milestone status. Provide drill-down capability from summary to detail level. Automate data collection where possible. Present dashboard at monthly and quarterly reviews.")

add_neuron(t10, 3, "system", "Trend analysis and early warning systems",
    summary="Analyze performance trends to identify emerging issues before they become critical",
    content="Perform trend analysis on key program metrics: EVM cumulative CPI/SPI trends, risk identification rate vs. closure rate, reserve burn-down slope, requirements change rate, action item aging, and contractor performance trends. Establish early warning thresholds and automatic alerts. Develop root cause analysis capability for adverse trends. Brief trend analysis findings at program reviews with recommended corrective actions.")

add_neuron(t10, 3, "system", "Design stability and maturity assessment",
    summary="Assess design stability and technical maturity throughout development",
    content="Track design stability metrics: drawing release rate vs. plan, engineering change request rate, interface control document maturity, test-as-you-fly compliance, hardware/software integration status. Assess Technical Readiness Level (TRL) and Manufacturing Readiness Level (MRL) progression against plan. Flag design churn and instability as leading indicators of cost/schedule growth. Coordinate with Systems Engineering for maturity gate assessments.")

add_neuron(t10, 3, "system", "Manufacturing Readiness Level progression tracking",
    summary="Track MRL advancement through development and production phases",
    content="Monitor Manufacturing Readiness Level (MRL) progression from MRL 1 (basic manufacturing implications identified) through MRL 10 (full rate production demonstrated). Conduct MRL assessments at key milestones: MRL 4-5 at PDR, MRL 6 at CDR, MRL 8 at production readiness. Track producibility risks, manufacturing process maturation, tooling development, and supply chain readiness. Flag MRL shortfalls as program risks requiring mitigation plans.")

# =============================================================================

total_added = next_id - START_ID
conn.commit()
print(f"Successfully added {total_added} new neurons (IDs {START_ID}-{next_id - 1})")
print(f"  10 new L2 tasks")
print(f"  {total_added - 10} new L3 systems")

# Verify
total = cur.execute("SELECT COUNT(*) FROM neurons").fetchone()[0]
pm_count = cur.execute(
    "SELECT COUNT(*) FROM neurons WHERE role_key='program_mgr'"
).fetchone()[0]
print(f"\nTotal neurons in DB: {total}")
print(f"Total program_mgr neurons: {pm_count}")

conn.close()
