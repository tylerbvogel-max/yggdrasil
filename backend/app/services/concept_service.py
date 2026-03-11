"""Concept neuron service: department-agnostic framework nodes.

Concept neurons represent transdisciplinary frameworks (e.g. Three Horizons,
PDCA, DMAIC) that span multiple departments. They use:
- node_type='concept', layer=-1, department=NULL, parent_id=NULL
- 'instantiates' edge_type connecting to department-specific neurons
- Higher spread decay (0.6) and lower threshold (0.10) than pyramidal edges

Concept neurons act as seed nodes for future community detection (Phase 5),
bootstrapping clusters that Leiden/Louvain then completes organically.
"""

import json

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Neuron, NeuronEdge


async def create_concept_neuron(
    db: AsyncSession,
    label: str,
    content: str,
    summary: str | None = None,
) -> Neuron:
    """Create a concept neuron (layer=-1, no department, no parent)."""
    from app.services.neuron_service import get_system_state

    state = await get_system_state(db)

    neuron = Neuron(
        parent_id=None,
        layer=-1,
        node_type="concept",
        label=label,
        content=content,
        summary=summary or label,
        department=None,
        role_key=None,
        created_at_query_count=state.total_queries,
        source_type="operational",
        source_origin="concept",
    )
    db.add(neuron)
    await db.flush()  # get ID

    # Embed
    import concurrent.futures
    import asyncio
    from app.services.embedding_service import embed_text

    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        embed_text_str = f"{label} {summary or ''} {content}"
        vec = await loop.run_in_executor(pool, embed_text, embed_text_str)

    neuron.embedding = json.dumps(vec)
    await db.flush()

    return neuron


async def link_concept_to_neurons(
    db: AsyncSession,
    concept_id: int,
    target_ids: list[int],
    weight: float = 0.5,
) -> int:
    """Create 'instantiates' edges from a concept neuron to target neurons.

    Returns count of edges created.
    """
    created = 0
    for tid in target_ids:
        src, tgt = min(concept_id, tid), max(concept_id, tid)
        await db.execute(text(
            "INSERT INTO neuron_edges (source_id, target_id, co_fire_count, weight, last_updated_query, edge_type, source, last_adjusted) "
            "VALUES (:src, :tgt, 1, :w, 0, 'instantiates', 'concept_seed', now()) "
            "ON CONFLICT (source_id, target_id) DO UPDATE SET edge_type = 'instantiates', weight = GREATEST(neuron_edges.weight, :w), last_adjusted = now()"
        ), {"src": src, "tgt": tgt, "w": weight})
        created += 1

    await db.flush()
    return created


async def cofire_concept_neurons(
    db: AsyncSession,
    fired_neuron_ids: list[int],
    query_offset: int,
) -> list[int]:
    """When neurons fire, check if any are linked to concept neurons via 'instantiates' edges.

    If so, boost the concept neuron's co-firing with all other fired neurons that
    share the same concept. This strengthens the concept hub over time.

    Returns list of concept neuron IDs that were co-fired.
    """
    if len(fired_neuron_ids) < 2:
        return []

    # Find concept neurons linked to any fired neuron
    result = await db.execute(text("""
        SELECT DISTINCT n.id
        FROM neurons n
        JOIN neuron_edges e ON (
            (e.source_id = n.id AND e.target_id = ANY(:ids))
            OR (e.target_id = n.id AND e.source_id = ANY(:ids))
        )
        WHERE n.node_type = 'concept' AND n.is_active = true
          AND e.edge_type = 'instantiates'
    """), {"ids": fired_neuron_ids})
    concept_ids = [row[0] for row in result.all()]

    if not concept_ids:
        return []

    # For each concept, strengthen edges between it and all fired neurons
    for cid in concept_ids:
        for fid in fired_neuron_ids:
            if fid == cid:
                continue
            src, tgt = min(cid, fid), max(cid, fid)
            # Upsert: create if missing, increment co_fire_count if exists
            await db.execute(text(
                "INSERT INTO neuron_edges (source_id, target_id, co_fire_count, weight, last_updated_query, edge_type, source, last_adjusted) "
                "VALUES (:src, :tgt, 1, 0.05, :qoff, 'instantiates', 'organic', now()) "
                "ON CONFLICT (source_id, target_id) DO UPDATE SET "
                "  co_fire_count = neuron_edges.co_fire_count + 1, "
                "  weight = LEAST(1.0, (neuron_edges.co_fire_count + 1) / 20.0), "
                "  last_updated_query = :qoff, "
                "  source = CASE WHEN neuron_edges.source = 'bootstrap' THEN 'organic' ELSE neuron_edges.source END, "
                "  last_adjusted = now()"
            ), {"src": src, "tgt": tgt, "qoff": query_offset})

    return concept_ids


async def get_concept_neurons(db: AsyncSession) -> list[dict]:
    """List all concept neurons with their instantiation edge counts."""
    result = await db.execute(
        select(Neuron).where(Neuron.node_type == "concept").order_by(Neuron.id)
    )
    concepts = list(result.scalars().all())

    output = []
    for c in concepts:
        # Count instantiation edges
        edge_result = await db.execute(text("""
            SELECT COUNT(*) FROM neuron_edges
            WHERE edge_type = 'instantiates'
              AND (source_id = :cid OR target_id = :cid)
        """), {"cid": c.id})
        edge_count = edge_result.scalar() or 0

        output.append({
            "id": c.id,
            "label": c.label,
            "summary": c.summary,
            "content": c.content,
            "invocations": c.invocations,
            "avg_utility": c.avg_utility,
            "instantiation_edges": edge_count,
            "is_active": c.is_active,
        })

    return output


async def seed_three_horizons(db: AsyncSession) -> dict:
    """Seed the Three Horizons framework. Delegates to seed_all_concepts for just this one."""
    results = await seed_all_concepts(db, only=["Three Horizons Framework"])
    if results["seeded"]:
        return {"status": "seeded", **results["seeded"][0]}
    if results["skipped"]:
        return {"status": "already_seeded", "message": results["skipped"][0]}
    return {"status": "error", "message": "Unknown error"}


# ── Concept Neuron Registry ──
# Each entry defines a transdisciplinary concept with:
#   label, summary, content, direct_patterns (label/summary match), content_patterns (content-only match)
# Patterns use SQL LIKE syntax (case-insensitive).

CONCEPT_DEFINITIONS: list[dict] = [
    {
        "label": "Three Horizons Framework",
        "summary": "Strategic planning model: H1 (core), H2 (emerging), H3 (future vision) across all departments",
        "content": (
            "The Three Horizons framework is a strategic planning model that categorizes "
            "organizational activities into three time horizons: H1 (core business — protect and "
            "extend current operations), H2 (emerging opportunities — build new capabilities), "
            "and H3 (future vision — create options for transformational change). Each department "
            "applies this framework differently: Engineering focuses on technical debt vs R&D "
            "investment, Contracts on current compliance vs future regulatory positioning, "
            "Manufacturing on production optimization vs process innovation. The framework "
            "enables cross-departmental strategic alignment by providing a shared vocabulary "
            "for time-horizon trade-offs."
        ),
        "direct_patterns": ["%horizon%"],
        "content_patterns": ["%horizon%", "% h1 %", "% h2 %", "% h3 %"],
    },
    {
        "label": "Root Cause Analysis",
        "summary": "Systematic analytical method (5-Why, Ishikawa, fault tree) for identifying underlying causes of failures across all departments",
        "content": (
            "Root Cause Analysis (RCA) is a systematic method for identifying the fundamental "
            "cause of problems or nonconformances rather than treating symptoms. Core techniques "
            "include: 5-Why analysis (iterative questioning to trace causal chains), Ishikawa/fishbone "
            "diagrams (categorizing causes by Man, Machine, Method, Material, Measurement, Environment), "
            "and fault tree analysis (Boolean logic decomposition of failure modes). In aerospace "
            "manufacturing, RCA is required by AS9100 clause 10.2 for nonconformance disposition, "
            "by DCMA for corrective action verification, and by FAA for continued airworthiness. "
            "Each department applies RCA differently: Engineering uses physics-of-failure analysis, "
            "Manufacturing uses process capability data and SPC trend analysis, Quality uses "
            "nonconformance pattern analysis, Contracts traces root cause to flowdown gaps, and "
            "Finance analyzes cost-of-quality drivers. The discipline of asking 'why' beyond the "
            "first obvious answer is the shared principle across all applications."
        ),
        "direct_patterns": ["%root cause%"],
        "content_patterns": ["%root cause%", "%fishbone%", "%ishikawa%", "%5 why%", "%five why%", "%fault tree%"],
    },
    {
        "label": "Risk Matrix",
        "summary": "Likelihood × severity framework for risk assessment and prioritization, applied across technical, programmatic, financial, and compliance domains",
        "content": (
            "The risk matrix (probability × impact grid) is the universal framework for risk "
            "assessment across aerospace organizations. Risks are scored on likelihood (1-5 scale "
            "from rare to almost certain) and severity/impact (1-5 from negligible to catastrophic), "
            "producing a risk priority number that drives mitigation priority. Applications span: "
            "Engineering (technical risk — design margins, material properties, test coverage gaps), "
            "Program Management (schedule and cost risk — critical path delays, resource conflicts), "
            "Manufacturing (process risk — capability gaps, tooling failures, supplier disruptions), "
            "Finance (financial risk — cost overruns, cash flow exposure, contract penalties), "
            "Contracts (compliance risk — regulatory changes, flowdown gaps, audit findings), "
            "and Executive Leadership (enterprise risk — market shifts, competitive threats, "
            "workforce gaps). MIL-STD-882E formalizes this for defense programs. The matrix "
            "provides a shared vocabulary for cross-functional risk discussions and trade-offs."
        ),
        "direct_patterns": ["%risk matrix%", "%risk assessment%"],
        "content_patterns": ["%risk matrix%", "%likelihood%severity%", "%probability%impact%", "%risk priority%"],
    },
    {
        "label": "FMEA — Failure Mode and Effects Analysis",
        "summary": "Systematic risk methodology: identify failure modes, assess severity/occurrence/detection, prioritize by RPN across design, process, and system domains",
        "content": (
            "Failure Mode and Effects Analysis (FMEA) is a structured risk assessment methodology "
            "that systematically identifies potential failure modes, evaluates their effects, and "
            "prioritizes corrective actions using the Risk Priority Number (RPN = Severity × "
            "Occurrence × Detection). Three primary types: Design FMEA (DFMEA — Engineering-led, "
            "evaluates design vulnerabilities before production), Process FMEA (PFMEA — "
            "Manufacturing-led, evaluates process steps that could produce nonconforming product), "
            "and System FMEA (cross-functional, evaluates system-level interactions and interfaces). "
            "Required by AS9100 clause 8.3.3 for design and development planning, by IATF 16949 "
            "for automotive-grade aerospace suppliers, and by customer-specific requirements on "
            "most defense contracts. AIAG-VDA FMEA Handbook (2019) replaced the traditional RPN "
            "approach with Action Priority (AP) levels. Cross-departmental linkage: Engineering "
            "identifies the failure mode, Manufacturing assesses process controls, Quality validates "
            "detection methods, and Program Management tracks closure. A PFMEA without "
            "Manufacturing input is incomplete; a DFMEA without field data from Quality is blind."
        ),
        "direct_patterns": ["%fmea%", "%failure mode%effect%"],
        "content_patterns": ["%fmea%", "%failure mode%effect%", "%risk priority number%", "%dfmea%", "%pfmea%"],
    },
    {
        "label": "Corrective Action / CAPA",
        "summary": "Structured problem-resolution process (8D, CAPA, CAR) linking nonconformance detection through root cause to systemic prevention",
        "content": (
            "Corrective and Preventive Action (CAPA) is the closed-loop process for resolving "
            "nonconformances and preventing recurrence. The 8D methodology (Eight Disciplines) "
            "provides the most common structure: D1-Team, D2-Problem Description, D3-Containment, "
            "D4-Root Cause, D5-Corrective Action, D6-Implementation, D7-Prevention, D8-Closure. "
            "Required by AS9100 clause 10.2, FAR 52.246 quality clauses, and DCMA instruction "
            "for supplier corrective action requests (SCARs). Cross-departmental by design: "
            "Quality initiates CARs from inspection findings, Manufacturing implements process "
            "corrections, Engineering dispositions design-related nonconformances (use-as-is, "
            "rework, scrap), Contracts manages customer notification requirements, and Program "
            "Management tracks closure timelines against delivery schedules. Preventive action "
            "(the 'P' in CAPA) extends beyond the immediate finding to systemic process "
            "improvements — the distinction between fixing one part and fixing the system that "
            "produced it. Effectiveness verification (D7/D8) requires objective evidence that "
            "the corrective action actually prevented recurrence, not just that it was implemented."
        ),
        "direct_patterns": ["%corrective action%", "%capa%"],
        "content_patterns": ["%corrective action%", "%capa%", "%8d %", "%8-d %", "% car %", "% scar %"],
    },
    {
        "label": "Configuration Management",
        "summary": "Discipline of tracking and controlling design/document/process configurations through identification, control, status accounting, and audit",
        "content": (
            "Configuration Management (CM) is the discipline of establishing and maintaining "
            "consistency of a product's attributes with its requirements and design baseline. "
            "Four pillars: Configuration Identification (CI — establishing baselines and naming "
            "conventions), Configuration Control (CC — managing changes through ECOs/ECNs with "
            "impact analysis), Configuration Status Accounting (CSA — tracking current "
            "configuration of every unit), and Configuration Audit (CA — verifying physical "
            "product matches approved documentation). Governed by EIA-649 (National Consensus "
            "Standard for CM), MIL-STD-973 (defense), and AS9100 clause 8.5.2. Cross-departmental "
            "impact: Engineering owns design baselines and ECO disposition, Manufacturing must "
            "implement changes at the correct effectivity point, Contracts manages customer "
            "change notification and approval requirements, Quality audits configuration during "
            "FAI and production, and Program Management tracks change incorporation against "
            "delivery milestones. The fundamental principle: every change to form, fit, or "
            "function must be traceable from requirement through implementation to verification."
        ),
        "direct_patterns": ["%configuration management%"],
        "content_patterns": [
            "%configuration management%", "%config control%", "%change control%",
            "%engineering change%", "% eco %", "% ecn %", "%configuration audit%",
        ],
    },
    {
        "label": "Gate Review / Phase-Gate",
        "summary": "Decision governance framework: structured reviews at program milestones (SRR, PDR, CDR, TRR, PRR) gating progression with cross-functional go/no-go criteria",
        "content": (
            "Gate reviews (phase-gate process) provide structured decision points where "
            "cross-functional leadership evaluates program maturity against predefined criteria "
            "before authorizing progression to the next phase. Standard aerospace gates: SRR "
            "(System Requirements Review), PDR (Preliminary Design Review), CDR (Critical Design "
            "Review), TRR (Test Readiness Review), PRR (Production Readiness Review), and "
            "post-delivery reviews. Each gate has entry/exit criteria spanning multiple "
            "departments: Engineering demonstrates design maturity, Manufacturing confirms "
            "producibility, Quality validates test completeness, Contracts verifies compliance "
            "flowdown, Finance confirms cost-at-completion, and Program Management integrates "
            "the overall readiness assessment. Governed by MIL-STD-1521B (defense technical "
            "reviews), NASA NPR 7123.1 (systems engineering), and customer-specific review "
            "requirements. The gate is a decision point, not a presentation — the output is "
            "go/no-go/go-with-conditions, not consensus. Business Development gates (bid/no-bid, "
            "proposal reviews) follow the same structural pattern applied to capture decisions."
        ),
        "direct_patterns": ["%gate review%", "%phase gate%", "%design review%"],
        "content_patterns": [
            "%gate review%", "%phase gate%", "%milestone review%", "%design review%",
            "% srr %", "% pdr %", "% cdr %", "% trr %", "% prr %",
        ],
    },
    {
        "label": "Trade Study / Trade-Off Analysis",
        "summary": "Structured decision methodology: weighted criteria evaluation of alternatives (Pugh matrix, AHP, multi-attribute utility) for technical and programmatic choices",
        "content": (
            "Trade study (trade-off analysis) is the structured process for evaluating "
            "alternative solutions against weighted criteria to make defensible engineering "
            "and programmatic decisions. Methods include Pugh matrix (binary comparison against "
            "datum), Analytic Hierarchy Process (AHP — pairwise criteria weighting), and "
            "multi-attribute utility theory (MAUT — quantified utility functions). In aerospace: "
            "Engineering conducts material selection, architecture, and design trades; "
            "Manufacturing evaluates process alternatives (additive vs subtractive, tooling "
            "approaches); Program Management trades schedule/cost/performance (the iron triangle); "
            "Contracts evaluates supplier alternatives and teaming arrangements; Finance models "
            "lease-vs-buy and capital allocation alternatives; and Business Development evaluates "
            "bid strategies and market positioning. The discipline is the same: define criteria, "
            "weight by stakeholder priorities, score alternatives with evidence, document the "
            "rationale. Required by MIL-STD-881F (WBS) to document key technical decisions and "
            "by NASA SE Handbook for architecture selection."
        ),
        "direct_patterns": ["%trade study%", "%trade-off%", "%tradeoff%"],
        "content_patterns": ["%trade study%", "%trade-off%", "%tradeoff%", "%pugh matrix%", "%weighted criteria%"],
    },
    {
        "label": "ITAR / Export Control",
        "summary": "Regulatory regime controlling defense article/service transfers: ITAR (USML), EAR (CCL), DDTC licensing — affects every department touching controlled technical data",
        "content": (
            "International Traffic in Arms Regulations (ITAR, 22 CFR 120-130) and Export "
            "Administration Regulations (EAR, 15 CFR 730-774) constitute the US export control "
            "framework governing transfer of defense articles, services, and technical data. "
            "ITAR covers items on the US Munitions List (USML); EAR covers dual-use items on "
            "the Commerce Control List (CCL). Every department is affected: Engineering must "
            "classify designs (USML vs CCL jurisdiction), control technical data access, and "
            "mark documents with distribution statements. Manufacturing must restrict facility "
            "access for foreign nationals and control export of production tooling and processes. "
            "Contracts must include DFARS 252.225-7048 flowdown, manage TAAs (Technical "
            "Assistance Agreements) and MLAs (Manufacturing License Agreements). HR/Admin must "
            "screen employees and visitors against denied parties lists. IT must control "
            "electronic transfer of controlled data. Program Management must plan export "
            "licenses into schedule milestones. Finance must track license values and report "
            "DDTC fees. Non-compliance penalties: criminal ($1M/violation, 20 years imprisonment) "
            "and civil ($500K/violation, debarment). ITAR is not optional and not delegable — "
            "it is every employee's responsibility."
        ),
        "direct_patterns": ["%itar%", "%export control%"],
        "content_patterns": ["%itar%", "%export control%", "%ear %", "%usml%", "%defense article%", "%technical data%controlled%"],
    },
    {
        "label": "AS9100 Quality Management System",
        "summary": "Aerospace QMS standard: ISO 9001 base + aerospace supplements for risk management, configuration control, product safety, and counterfeit parts prevention",
        "content": (
            "AS9100 (Rev D, based on ISO 9001:2015) is the aerospace-specific quality management "
            "system standard required by virtually all prime contractors and regulatory bodies. "
            "Key aerospace supplements beyond ISO 9001: risk management (clause 6.1 — operational "
            "risk beyond just QMS risk), configuration management (clause 8.5.2), product safety "
            "(clause 8.1.1), counterfeit parts prevention (clause 8.1.4), first article inspection "
            "(clause 8.5.1.1 — per AS9102), special processes (clause 8.5.1.2 — Nadcap), and "
            "on-time delivery performance (clause 9.1.2). Cross-departmental scope: Quality owns "
            "the QMS and leads audits, Engineering implements design control (clause 8.3), "
            "Manufacturing implements production control and FOD prevention, Contracts ensures "
            "supplier QMS requirements flowdown, Program Management drives OTIF metrics, and "
            "Executive Leadership conducts management review (clause 9.3). Certification is by "
            "accredited registrars under the IAQG OASIS database. Loss of AS9100 certification "
            "is effectively a business-ending event for an aerospace manufacturer."
        ),
        "direct_patterns": ["%as9100%", "%as 9100%"],
        "content_patterns": ["%as9100%", "%as 9100%", "%as9110%", "%as9120%"],
    },
    {
        "label": "Requirements Flowdown",
        "summary": "Contractual and technical mechanism for cascading prime contract requirements to sub-tier suppliers, subcontractors, and internal departments",
        "content": (
            "Requirements flowdown is the process of decomposing and allocating prime contract "
            "requirements to all parties responsible for their fulfillment — subcontractors, "
            "suppliers, and internal departments. In aerospace, incomplete flowdown is one of "
            "the most common root causes of nonconformance and contract disputes. Flowdown "
            "categories: technical requirements (drawings, specs, process standards), quality "
            "requirements (AS9100, special process approvals, inspection levels), regulatory "
            "requirements (ITAR, DFARS clauses, FAR quality clauses), and programmatic "
            "requirements (delivery schedules, data item deliverables, reporting). Cross-departmental: "
            "Contracts identifies applicable clauses and generates PO flowdown language, "
            "Engineering decomposes technical requirements to make/buy items, Quality specifies "
            "supplier quality requirements and incoming inspection levels, Manufacturing identifies "
            "special process requirements for sub-tier suppliers, and Program Management tracks "
            "flowdown completeness as a compliance risk metric. FAR 52.244-6 and DFARS 252.244-7001 "
            "mandate specific flowdown to subcontractors. The principle: if the prime is "
            "responsible to the customer, the sub must be responsible to the prime, with "
            "requirements traceable end-to-end."
        ),
        "direct_patterns": ["%flowdown%", "%flow-down%", "%flow down%"],
        "content_patterns": ["%flowdown%", "%flow-down%", "%flow down%", "%requirements allocation%"],
    },
    {
        "label": "First Article Inspection (FAI)",
        "summary": "Verification process (AS9102) confirming that production processes produce conforming product — bridges design, manufacturing, and quality acceptance",
        "content": (
            "First Article Inspection (FAI) per AS9102 is the process of verifying that the "
            "production process produces parts conforming to engineering requirements. It bridges "
            "the gap between design intent and manufacturing reality. Three forms: Form 1 (Part "
            "Number Accountability — lists all part numbers in the FAI), Form 2 (Product "
            "Accountability — raw material, special processes, functional tests), Form 3 "
            "(Characteristic Accountability — dimensional results for every characteristic on "
            "the drawing). Cross-departmental: Engineering defines the characteristics and "
            "acceptance criteria (design requirements baseline), Manufacturing produces the "
            "first article using production-representative tooling and processes, Quality "
            "performs the measurements and completes the AS9102 forms, Contracts determines "
            "FAI requirements from customer purchase order flowdown, and Program Management "
            "schedules FAI completion as a delivery gate prerequisite. Partial/delta FAI is "
            "permitted when changes affect only some characteristics (AS9102 clause 4.2). "
            "FAI must be repeated when: production is interrupted >2 years, process/tooling/ "
            "material changes, manufacturing site changes, or design changes to form/fit/function."
        ),
        "direct_patterns": ["%first article%"],
        "content_patterns": ["%first article%", "%fai %", "%as9102%"],
    },
    {
        "label": "Nonconformance Management (NCR/MRB)",
        "summary": "Disposition process for nonconforming product: detection, segregation, review board (MRB) disposition (use-as-is, rework, repair, scrap), and customer notification",
        "content": (
            "Nonconformance management is the process for handling product or process deviations "
            "from specified requirements. The Material Review Board (MRB) is the cross-functional "
            "authority for dispositions beyond simple rework. Disposition options: use-as-is "
            "(engineering justification that the nonconformance doesn't affect form/fit/function), "
            "rework (restore to full conformance per approved method), repair (restore to usable "
            "condition that may not fully meet original requirements — requires customer approval "
            "for aerospace), or scrap. Cross-departmental: Quality detects and documents the "
            "nonconformance (NCR), segregates material, and initiates MRB. Engineering provides "
            "technical disposition rationale and stress analysis for use-as-is/repair. "
            "Manufacturing develops rework/repair procedures and estimates cost/schedule impact. "
            "Contracts determines customer notification obligations (many prime contracts require "
            "notification for use-as-is and repair dispositions). Program Management assesses "
            "delivery schedule impact. Governed by AS9100 clause 8.7, FAR 52.246 quality clauses, "
            "and customer-specific MRB authority delegation."
        ),
        "direct_patterns": ["%nonconformance%", "%non-conformance%"],
        "content_patterns": ["%nonconformance%", "%non-conformance%", "%ncr %", "%mrb %", "%material review%"],
    },
    {
        "label": "Earned Value Management (EVM)",
        "summary": "Performance measurement system integrating scope, schedule, and cost baselines to quantify program health (CPI, SPI, EAC, TCPI)",
        "content": (
            "Earned Value Management (EVM/EVMS) is the integrated performance measurement system "
            "that combines scope, schedule, and cost baselines to provide objective program health "
            "metrics. Core metrics: PV (Planned Value), EV (Earned Value), AC (Actual Cost), "
            "CPI (Cost Performance Index = EV/AC), SPI (Schedule Performance Index = EV/PV), "
            "EAC (Estimate at Completion), and TCPI (To-Complete Performance Index). Required "
            "on defense contracts exceeding $20M by DFARS 252.234-7001 and ANSI/EIA-748 "
            "(32 criteria). Cross-departmental: Program Management maintains the Performance "
            "Measurement Baseline and reports EVM metrics. Finance provides actual cost data "
            "and cost accounting alignment. Engineering and Manufacturing perform the work and "
            "report earned value against work packages. Contracts negotiates the PMB and manages "
            "over-target baselines. Executive Leadership uses EVM data for portfolio-level "
            "investment decisions and LRIP/full-rate transition criteria. The fundamental insight: "
            "spending on schedule doesn't mean you're on schedule — only earned value reveals "
            "true progress against plan."
        ),
        "direct_patterns": ["%earned value%"],
        "content_patterns": ["%earned value%", "% evm %", "%evms%", "%cost performance index%", "%schedule performance index%"],
    },
    {
        "label": "Supplier Management / Supply Chain",
        "summary": "Lifecycle management of external suppliers: qualification, surveillance, performance rating, corrective action, and risk mitigation for the aerospace supply chain",
        "content": (
            "Supplier management encompasses the full lifecycle of external supplier relationships: "
            "qualification (initial capability assessment and approval), ongoing surveillance "
            "(audit schedules, incoming inspection, delegated source inspection), performance "
            "measurement (on-time delivery, quality reject rate, responsiveness), corrective "
            "action (SCARs — Supplier Corrective Action Requests), and risk management (sole-source "
            "identification, financial health monitoring, geopolitical exposure). Cross-departmental: "
            "Quality manages the Approved Supplier List and conducts supplier audits per AS9100 "
            "clause 8.4. Contracts negotiates terms, manages PO flowdown, and handles disputes. "
            "Engineering qualifies supplier technical capabilities and approves special processes. "
            "Manufacturing coordinates delivery schedules and incoming material flow. Program "
            "Management assesses supply chain schedule risk. Finance evaluates supplier financial "
            "stability. Executive Leadership makes strategic make-vs-buy and dual-source decisions. "
            "The aerospace supply chain is deep (Tier 1 → Tier 4+), and visibility degrades "
            "at each tier — sub-tier management is the persistent challenge."
        ),
        "direct_patterns": ["%supplier management%", "%supply chain%"],
        "content_patterns": ["%supplier management%", "%vendor management%", "%supply chain%", "%approved supplier%", "% asl %"],
    },
    {
        "label": "Compliance Audit",
        "summary": "Systematic examination of adherence to requirements: internal audits, registrar audits, customer audits, and regulatory surveillance across QMS, contracts, and operations",
        "content": (
            "Compliance auditing is the systematic, independent examination of whether activities "
            "and results conform to planned arrangements and requirements. Audit types in aerospace: "
            "internal audits (AS9100 clause 9.2 — self-assessment of QMS effectiveness), registrar "
            "audits (AS9100 certification surveillance), customer audits (prime contractor "
            "assessment of supplier capability), regulatory audits (FAA/DCMA/EPA surveillance), "
            "and special audits (triggered by quality escapes or corrective action verification). "
            "Cross-departmental: Quality plans and executes the internal audit program. "
            "Contracts ensures audit rights are preserved in supplier agreements and manages "
            "customer audit logistics. Manufacturing hosts audits and provides objective evidence "
            "of process control. Engineering demonstrates design control compliance. Finance "
            "supports cost accounting system audits (DCAA). Executive Leadership conducts "
            "management review of audit findings (AS9100 clause 9.3). The audit is the "
            "organization's immune system — findings are not failures, they are the mechanism "
            "for detecting and correcting drift before it becomes systemic."
        ),
        "direct_patterns": ["%compliance audit%", "%audit finding%"],
        "content_patterns": ["%compliance audit%", "%audit trail%", "%audit finding%", "%internal audit%", "%surveillance audit%"],
    },
    {
        "label": "Training and Qualification",
        "summary": "Competency assurance framework: training requirements identification, delivery, effectiveness evaluation, and qualification records for personnel performing critical operations",
        "content": (
            "Training and qualification management ensures personnel performing work affecting "
            "product conformity are competent based on education, training, skills, and experience "
            "(AS9100 clause 7.2). In aerospace, this extends beyond general competency to "
            "specific qualifications: NDT certification (NAS 410/SNT-TC-1A), welder qualification "
            "(AWS D17.1), soldering certification (IPC J-STD-001), paint/coating applicator "
            "qualification, and special process operator certification. Cross-departmental: "
            "Quality defines competency requirements and maintains qualification records. "
            "Manufacturing identifies training needs for production operators and maintains "
            "skill matrices. Engineering requires ongoing professional development and tool "
            "proficiency. Contracts ensures training requirements flow to suppliers. Program "
            "Management budgets training time and tracks workforce readiness. HR/Admin manages "
            "training infrastructure and compliance tracking systems. Executive Leadership "
            "conducts workforce planning and succession for critical skills. The principle: "
            "untrained personnel performing critical operations is a latent defect in the "
            "management system, not just a training gap."
        ),
        "direct_patterns": ["%training requirement%", "%qualification requirement%"],
        "content_patterns": ["%training requirement%", "%qualification requirement%", "%competency%", "%personnel qualification%"],
    },
    {
        "label": "Lessons Learned",
        "summary": "Organizational knowledge capture: structured collection, validation, dissemination, and reuse of experiential insights from program execution across departments",
        "content": (
            "Lessons learned is the organizational knowledge management discipline of capturing, "
            "validating, and disseminating experiential insights to prevent recurrence of problems "
            "and replicate successes. AS9100 clause 7.1.6 (Organizational Knowledge) requires "
            "this explicitly. Methods: after-action reviews (AARs — structured post-event analysis), "
            "project retrospectives, close-out reports, and lessons-learned databases. "
            "Cross-departmental: Engineering captures design lessons (material selection pitfalls, "
            "interface failures, analysis shortcuts that backfired). Manufacturing captures "
            "process lessons (tooling approaches, setup sequences, material handling issues). "
            "Program Management captures execution lessons (scheduling assumptions that proved "
            "wrong, risk mitigations that worked or failed). Contracts captures negotiation "
            "lessons and clause interpretation precedents. Quality captures systemic patterns "
            "from NCR and CAPA trend analysis. The chronic failure mode: lessons are documented "
            "but never disseminated, creating institutional amnesia where the organization "
            "repeats the same mistakes because the knowledge is trapped in a database nobody queries."
        ),
        "direct_patterns": ["%lessons learned%"],
        "content_patterns": ["%lessons learned%", "%after action%", "%retrospective%", "%organizational knowledge%"],
    },
    {
        "label": "Continuous Improvement / Lean",
        "summary": "Systematic pursuit of incremental and breakthrough improvements: kaizen events, lean manufacturing, Six Sigma, value stream mapping across operations",
        "content": (
            "Continuous improvement is the ongoing effort to improve products, services, and "
            "processes through incremental (kaizen) and breakthrough changes. In aerospace "
            "manufacturing, this encompasses lean manufacturing (waste elimination, flow "
            "optimization, pull systems), Six Sigma (DMAIC — Define, Measure, Analyze, Improve, "
            "Control for data-driven process improvement), value stream mapping (end-to-end "
            "process visualization and optimization), and kaizen events (focused, time-boxed "
            "improvement workshops). Cross-departmental: Manufacturing leads lean implementation "
            "and kaizen events on the production floor. Engineering applies DFSS (Design for "
            "Six Sigma) to product development. Quality uses statistical methods and trend "
            "analysis to identify improvement opportunities. Program Management integrates "
            "improvement initiatives into program plans. Executive Leadership sets improvement "
            "targets and allocates resources. AS9100 clause 10.3 requires continual improvement "
            "of QMS suitability, adequacy, and effectiveness. The key insight: improvement "
            "without measurement is just change — data-driven improvement with statistical "
            "validation is the standard."
        ),
        "direct_patterns": ["%continuous improvement%"],
        "content_patterns": ["%continuous improvement%", "%kaizen%", "%lean%six sigma%", "%dmaic%", "%value stream%"],
    },
    {
        "label": "Make vs Buy Decision",
        "summary": "Strategic sourcing decision framework: core competency analysis, cost modeling, risk assessment, and capacity planning for insource/outsource choices",
        "content": (
            "Make-vs-buy analysis is the strategic decision framework for determining whether "
            "to produce components/assemblies internally or procure from external suppliers. "
            "Decision factors: core competency alignment (is this a differentiating capability?), "
            "cost comparison (fully burdened internal cost vs landed supplier cost including "
            "quality risk), capacity availability (does the factory have bandwidth?), intellectual "
            "property protection (ITAR-controlled processes may require internal production), "
            "supply chain risk (sole-source exposure, lead time volatility), and quality control "
            "(special process capability, inspection access). Cross-departmental: Engineering "
            "assesses technical complexity and IP sensitivity. Manufacturing evaluates capacity, "
            "capability, and capital equipment requirements. Finance builds the cost model with "
            "overhead absorption analysis. Contracts evaluates supplier terms, warranty, and "
            "liability allocation. Program Management assesses schedule risk of each option. "
            "Executive Leadership makes the strategic decision considering long-term capability "
            "investment vs short-term cost optimization. The decision often changes over "
            "program lifecycle: prototype (make for learning), LRIP (make or buy based on "
            "capability), full-rate (buy for cost if quality is proven)."
        ),
        "direct_patterns": ["%make vs buy%", "%make-vs-buy%", "%make or buy%"],
        "content_patterns": ["%make vs buy%", "%make-vs-buy%", "%make or buy%", "%insource%outsource%", "%core competency%sourcing%"],
    },
    {
        "label": "Work Breakdown Structure (WBS)",
        "summary": "Hierarchical decomposition of program scope into manageable work packages: the structural backbone linking requirements, schedule, cost, and earned value",
        "content": (
            "The Work Breakdown Structure (WBS) is the hierarchical decomposition of total "
            "program scope into progressively smaller, manageable work packages. It provides "
            "the structural backbone connecting requirements to schedule, cost, and earned value. "
            "MIL-STD-881F defines standard WBS structures for defense programs by product type "
            "(aircraft, electronics, space). Cross-departmental: Program Management creates and "
            "maintains the WBS and maps it to the integrated master schedule. Engineering "
            "decomposes technical scope into hardware/software elements. Manufacturing maps "
            "production activities to work packages. Finance maps cost accounts to WBS elements "
            "for earned value tracking. Contracts maps CLIN/SLIN structures to WBS for billing. "
            "The WBS is not an org chart — it is product-oriented, decomposing what is being "
            "delivered, not who is doing the work. The responsibility assignment matrix (RAM) "
            "maps WBS elements to the organizational breakdown structure (OBS) to establish "
            "control accounts where scope, schedule, and budget intersect."
        ),
        "direct_patterns": ["%work breakdown%"],
        "content_patterns": ["%work breakdown%", "% wbs %", "%mil-std-881%"],
    },
    {
        "label": "Documentation Control / Records Management",
        "summary": "System for creating, reviewing, approving, distributing, and retaining controlled documents and quality records per AS9100 and regulatory retention requirements",
        "content": (
            "Documentation control and records management governs the lifecycle of controlled "
            "documents (procedures, specifications, work instructions) and quality records "
            "(inspection reports, test data, certifications, traceability records). AS9100 "
            "clauses 7.5.2 (creating/updating) and 7.5.3 (control of documented information) "
            "establish requirements. Cross-departmental: Quality manages the document control "
            "system and defines retention schedules. Engineering controls drawings, specifications, "
            "and design calculations. Manufacturing maintains work instructions, router travelers, "
            "and process records. Contracts retains contract files and correspondence per FAR "
            "4.703 (6-year retention for most contract records). Finance maintains cost "
            "accounting records per DCAA requirements. The critical principle: if it isn't "
            "documented, it didn't happen — in regulated aerospace, undocumented activities "
            "are nonconformances regardless of whether the work was actually performed correctly."
        ),
        "direct_patterns": ["%document control%", "%documentation control%"],
        "content_patterns": ["%document control%", "%documentation control%", "%record retention%", "%controlled document%"],
    },
    # ── Wave 2: Peripheral-cluster concepts (bootstrap aggregation) ──
    {
        "label": "Data Engineering / ETL Pipeline",
        "summary": "Data ingestion, transformation, and quality frameworks: Spark, Databricks, Delta Lake, Auto Loader, DLT, and pipeline orchestration across engineering and operations",
        "content": (
            "Data engineering encompasses the design, construction, and maintenance of data "
            "pipelines that ingest, transform, and serve data for analytics and operations. "
            "In aerospace manufacturing, this includes ETL (Extract-Transform-Load) workflows "
            "using Apache Spark and Databricks, Delta Lake for ACID-compliant data lakes, "
            "Auto Loader for incremental file ingestion, and Delta Live Tables (DLT) for "
            "declarative pipeline definitions with built-in data quality expectations. Key "
            "patterns: PySpark transformations (groupBy, window functions, higher-order array "
            "functions), JDBC source integration for ERP/MES systems, schema evolution and "
            "drift detection, data quality gates (expect, expect_or_drop, expect_or_fail), "
            "and Unity Catalog governance (row filters, column masks). Cross-departmental: "
            "Engineering builds and maintains pipelines. Manufacturing provides MES/ERP source "
            "data. Finance feeds cost and labor data. Quality uses pipeline outputs for SPC "
            "and trend analysis. Program Management consumes dashboards built on pipeline outputs. "
            "The principle: data pipelines are the nervous system connecting operational systems "
            "to decision-making — reliability, latency, and quality of data directly impact "
            "the quality of decisions across every department."
        ),
        "direct_patterns": ["%data engineer%", "%etl%", "%data pipeline%"],
        "content_patterns": [
            "%pyspark%", "%databrick%", "%delta lake%", "%auto loader%",
            "%delta live%", "% dlt %", "%spark sql%", "% jdbc %",
            "%schema drift%", "%data quality%expect%",
        ],
    },
    {
        "label": "Government Cost Accounting (FAR/CAS/DCAA)",
        "summary": "Federal cost accounting compliance: FAR Part 31 allowability, CAS allocation standards, DCAA audit readiness, indirect rate structures, and incurred cost submissions",
        "content": (
            "Government cost accounting governs how defense contractors accumulate, allocate, "
            "and report costs on government contracts. The framework rests on three pillars: "
            "FAR Part 31 (cost allowability — which costs can be charged to government contracts), "
            "Cost Accounting Standards (CAS — consistency in how costs are measured, assigned, "
            "and allocated), and DCAA audit (the Defense Contract Audit Agency verifies compliance). "
            "Key concepts: indirect rate structures (overhead, G&A, fringe, material handling), "
            "cost pool composition and allocation base selection per CAS 418, wrap rate calculation "
            "(stacking indirect rates onto direct labor), unallowable cost segregation per "
            "FAR 31.205, Disclosure Statement (CASB DS-2) documenting cost accounting practices, "
            "Forward Pricing Rate Proposals (FPRP) and Agreements (FPRA), and annual incurred "
            "cost submissions. Cross-departmental: Finance maintains the cost accounting system "
            "and rate structures. Executive Leadership certifies cost pool allocations and "
            "Disclosure Statement accuracy. Contracts ensures proper cost charging on each "
            "contract type. Program Management tracks cost performance against EAC/ETC. "
            "Administrative & Support processes labor distribution (timekeeping) that feeds "
            "the entire cost accumulation system. Non-compliance risks include cost disallowances, "
            "CAS noncompliance penalties, and potential False Claims Act liability."
        ),
        "direct_patterns": ["%cost accounting%", "%far part 31%", "%cas %disclosure%"],
        "content_patterns": [
            "%far 31.2%", "%dcaa%", "%indirect rate%", "%cost pool%",
            "%wrap rate%", "%allocation base%", "%unallowable%cost%",
            "%disclosure statement%", "%incurred cost%", "%forward pricing rate%",
            "%cas 4%", "%cost allowab%",
        ],
    },
    {
        "label": "Facility & Environmental Compliance",
        "summary": "Facility systems management and environmental regulatory compliance: HVAC, water quality, emissions (NESHAP Subpart GG), refrigerant management, and EPA/state permitting",
        "content": (
            "Facility and environmental compliance encompasses the management of building "
            "systems, utility infrastructure, and environmental permits required for aerospace "
            "manufacturing operations. Key domains: HVAC zone design and setpoint management "
            "for manufacturing environments (temperature/humidity control for composite layup, "
            "coating operations, and metrology labs), chiller and cooling tower performance "
            "monitoring, water quality management (potable water per SDWA, process water for "
            "chemical processing, cooling water treatment and legionella prevention), emissions "
            "compliance under NESHAP Subpart GG (aerospace coating operations — HAP inventory "
            "calculation, coating-specific emission limits per §63.745, major source applicability "
            "determination per §63.741), refrigerant management per EPA Section 608 and HFC "
            "phase-down schedules, and paint booth ventilation per NFPA 33. Cross-departmental: "
            "Manufacturing operates within facility constraints and generates environmental "
            "compliance data. Engineering designs processes that must meet environmental limits. "
            "Regulatory/Quality audits environmental compliance and maintains permits. "
            "Finance tracks environmental compliance costs and capital investment for facility "
            "upgrades. Executive Leadership authorizes capital expenditures for facility systems."
        ),
        "direct_patterns": ["%environmental compliance%", "%facility compliance%"],
        "content_patterns": [
            "%hvac%", "%chiller%", "%cooling tower%", "%water quality%",
            "%subpart gg%", "%emission%limit%", "% hap %", "%neshap%",
            "%refrigerant%", "%epa section 608%", "%nfpa 33%",
            "%legionella%", "%potable water%",
        ],
    },
    {
        "label": "Cybersecurity / CMMC / Information Security",
        "summary": "Information security frameworks for defense contractors: CMMC certification, NIST 800-171 CUI protection, STIG compliance, security clearance management, and System Security Plans",
        "content": (
            "Cybersecurity and information security for defense contractors centers on protecting "
            "Controlled Unclassified Information (CUI) and classified data per federal requirements. "
            "The Cybersecurity Maturity Model Certification (CMMC) framework requires third-party "
            "assessment (C3PAO) of contractor security practices. NIST SP 800-171 defines the "
            "110 security controls for CUI protection. Key implementation areas: System Security "
            "Plans (SSP) documenting how each control is implemented, Plans of Action & Milestones "
            "(POA&M) for controls not yet fully implemented, STIG (Security Technical "
            "Implementation Guide) compliance for endpoint hardening and patch management, "
            "security clearance processing through DISS/eQIP, and facility access control "
            "based on citizenship and program classification. Cross-departmental: Administrative "
            "& Support (IT) implements technical controls — endpoint management, patching, "
            "network security. Contracts manages DFARS 252.204-7012 cybersecurity clauses and "
            "flowdown requirements. Engineering implements data-level security (Unity Catalog "
            "row filters, column masks) in data platforms. Executive Leadership authorizes "
            "CMMC assessment scheduling and resource allocation. Manufacturing ensures shop "
            "floor systems handling CUI meet NIST 800-171 controls. Program Management ensures "
            "program-specific security requirements are flowed to all team members."
        ),
        "direct_patterns": ["%cmmc%", "%cybersecurity%", "%information security%"],
        "content_patterns": [
            "%nist 800-171%", "%nist 800%", "% cui %", "%system security plan%",
            "%poa&m%", "% stig %", "%security clearance%", "%diss/eqip%",
            "%dfars 252.204%", "%endpoint%patch%", "%c3pao%",
        ],
    },
    {
        "label": "Proposal Management / Capture Process",
        "summary": "Business capture lifecycle: opportunity identification, Shipley process, color team reviews, competitive intelligence, teaming arrangements, and compliant proposal submission",
        "content": (
            "Proposal management and the capture process govern how defense/aerospace companies "
            "identify, pursue, and win new business. The Shipley capture management framework "
            "structures the process from opportunity identification through proposal submission. "
            "Key phases: opportunity screening (strategic fit, resource availability, win "
            "probability assessment), capture planning (customer engagement, competitive "
            "intelligence gathering, teaming/partnering decisions), proposal development "
            "(Shipley color team reviews — Pink team for compliance, Red team for persuasiveness, "
            "Gold team for executive review), and submission (compliant proposal package per "
            "RFP Section L/M evaluation criteria). Critical elements: past performance "
            "compilation from CPARS, competitive win probability tracking, bid/no-bid gate "
            "reviews, teaming arrangement selection (prime, sub, JV), and price-to-win analysis. "
            "Cross-departmental: Business Development leads capture and customer engagement. "
            "Executive Leadership makes bid/no-bid decisions and approves teaming arrangements. "
            "Engineering provides technical volume content and basis of estimate. Contracts "
            "ensures compliance with solicitation terms and conditions. Finance develops cost "
            "volumes and pricing strategy. Program Management provides schedule and staffing plans."
        ),
        "direct_patterns": ["%proposal management%", "%capture process%", "%capture plan%"],
        "content_patterns": [
            "%shipley%", "%color team%", "%pink team%", "%red team%",
            "%gold team%", "%bid%no-bid%", "%win prob%", "%competitive intelligence%",
            "%past performance%cpars%", "%price.to.win%", "%capture%strateg%",
            "%proposal%schedule%", "%section l%section m%",
        ],
    },
    {
        "label": "Occupational Safety & Health (OSHA)",
        "summary": "Workplace safety compliance: OSHA standards (29 CFR 1910/1926), hazard analysis (MIL-STD-882E), mishap investigation (HFACS), ergonomics, and system safety assessment",
        "content": (
            "Occupational safety and health in aerospace manufacturing encompasses OSHA regulatory "
            "compliance, system safety engineering, and workplace hazard management. OSHA 29 CFR "
            "1910 (general industry) and 1926 (construction) define baseline safety requirements. "
            "Key areas: air contaminant monitoring per OSHA 1910.1000 (PEL compliance, action "
            "levels, baseline sampling), hazard analysis per MIL-STD-882E (fault tree analysis, "
            "hazard risk indices, safety-critical item identification), mishap investigation "
            "using HFACS (Human Factors Analysis and Classification System) framework, "
            "ergonomic assessment (environmental ergonomics, workstation design, repetitive "
            "motion analysis), paint booth and process ventilation compliance per NFPA 33, "
            "and hazardous waste stream classification (RCRA listed and characteristic wastes). "
            "Cross-departmental: Contracts & Compliance manages safety programs, mishap "
            "investigation, and regulatory reporting. Manufacturing implements safety controls "
            "on the production floor and manages contractor safety during facility work. "
            "Regulatory/Quality audits safety compliance and maintains OSHA logs. Engineering "
            "performs system safety analyses during design. Executive Leadership sets safety "
            "policy and allocates resources for safety improvements."
        ),
        "direct_patterns": ["%occupational safety%", "%osha%compliance%"],
        "content_patterns": [
            "% osha %", "%osha 1910%", "%osha 1926%", "%mil-std-882%",
            "%mishap%investigation%", "% hfacs %", "%hazard%analysis%",
            "%ergonomic%", "%human factor%", "%hazardous waste%",
            "%system safety%assessment%",
        ],
    },
    {
        "label": "Performance Measurement / KPIs",
        "summary": "Organizational performance tracking: KPI frameworks, operational dashboards, OEE, schedule adherence metrics, and strategic initiative scorecards across all departments",
        "content": (
            "Performance measurement and KPI (Key Performance Indicator) management provides "
            "the quantitative feedback loop for organizational decision-making. In aerospace "
            "manufacturing, performance measurement spans operational metrics (OEE — Overall "
            "Equipment Effectiveness, cycle time vs standard, yield loss Pareto, schedule "
            "adherence), financial metrics (cost variance, EAC accuracy, indirect rate "
            "performance), quality metrics (defect rates, DPMO, first-pass yield, NCR closure "
            "time), and strategic metrics (capture rate, proposal win ratio, technology "
            "readiness advancement). Key frameworks: Performance Measurement Baseline (PMB) "
            "for earned value tracking, Balanced Scorecard for strategic alignment, and "
            "operational dashboards for real-time visibility. Cross-departmental: Executive "
            "Leadership defines strategic KPIs and reviews performance dashboards. Manufacturing "
            "tracks OEE, production metrics, and master production schedule adherence. "
            "Program Management monitors EVM performance indices (CPI/SPI). Engineering "
            "tracks design review completion rates and TRL advancement. Quality monitors "
            "defect trends and audit findings. Finance tracks rate variance and billing "
            "accuracy. Business Development monitors pipeline health and win rates. The "
            "principle: what gets measured gets managed — but measuring the wrong things "
            "drives the wrong behaviors."
        ),
        "direct_patterns": ["%key performance indicator%", "% kpi %framework%"],
        "content_patterns": [
            "% kpi%", "%dashboard%metric%", "% oee %", "%schedule adherence%",
            "%performance measure%baseline%", "%balanced scorecard%",
            "%production metric%", "%strategic%scorecard%",
        ],
    },
    {
        "label": "Statistical Process Control / Metrology",
        "summary": "Statistical methods for process monitoring and measurement assurance: SPC control charts, acceptance sampling, GD&T (ASME Y14.5), calibration, and measurement system analysis",
        "content": (
            "Statistical Process Control (SPC) and metrology provide the quantitative foundation "
            "for manufacturing quality assurance. SPC uses control charts (X-bar/R, X-bar/S, "
            "p-charts, c-charts) to monitor process stability and detect special-cause variation "
            "before it produces nonconforming product. Key concepts: control chart sensitivity "
            "calibration against tolerance limits, sampling interval economic optimization "
            "(balancing inspection cost against risk of undetected drift), acceptance sampling "
            "plans (AQL-based lot acceptance per ANSI/ASQ Z1.4), work sampling for labor "
            "utilization studies, and process capability indices (Cp, Cpk, Pp, Ppk). Metrology "
            "encompasses GD&T interpretation per ASME Y14.5 (datum reference frames, geometric "
            "tolerances, material condition modifiers), measurement system analysis (Gage R&R), "
            "and calibration program management. Cross-departmental: Engineering specifies "
            "tolerances and GD&T callouts on drawings. Manufacturing performs SPC monitoring "
            "and inspection per sampling plans. Quality manages the calibration program and "
            "validates measurement systems. Regulatory/Quality ensures measurement traceability "
            "to NIST standards. The principle: you cannot improve what you cannot measure, and "
            "you cannot measure what you cannot control — SPC and metrology are the twin "
            "foundations of process-based quality assurance."
        ),
        "direct_patterns": ["%statistical process control%", "% spc %chart%"],
        "content_patterns": [
            "%control chart%", "%acceptance sampling%", "%work sampling%",
            "%gd&t%", "%asme y14.5%", "%gage r&r%", "%measurement system%analysis%",
            "%process capability%", "%sampling%interval%", "% cpk%",
        ],
    },
]


async def _seed_one_concept(
    db: AsyncSession,
    defn: dict,
) -> dict | None:
    """Seed a single concept neuron from its definition. Returns result dict or None if already exists."""

    # Check if already seeded (match on label)
    existing = await db.execute(
        select(Neuron).where(
            Neuron.node_type == "concept",
            Neuron.label == defn["label"],
        )
    )
    if existing.scalar_one_or_none():
        return None

    # Create concept neuron
    concept = await create_concept_neuron(
        db,
        label=defn["label"],
        content=defn["content"],
        summary=defn["summary"],
    )

    # Build SQL for finding matching neurons
    direct_clauses = []
    content_clauses = []
    params: dict = {"concept_id": concept.id}

    for i, pat in enumerate(defn.get("direct_patterns", [])):
        pname = f"dp_{i}"
        params[pname] = pat
        direct_clauses.append(f"lower(label) LIKE :{pname} OR lower(summary) LIKE :{pname}")

    for i, pat in enumerate(defn.get("content_patterns", [])):
        pname = f"cp_{i}"
        params[pname] = pat
        content_clauses.append(f"lower(content) LIKE :{pname}")

    direct_expr = " OR ".join(direct_clauses) if direct_clauses else "false"
    content_expr = " OR ".join(content_clauses) if content_clauses else "false"
    all_expr = " OR ".join(filter(None, [
        f"({direct_expr})" if direct_clauses else None,
        f"({content_expr})" if content_clauses else None,
    ]))

    if not all_expr:
        await db.flush()
        return {
            "concept_neuron_id": concept.id,
            "label": concept.label,
            "direct_matches": 0,
            "content_matches": 0,
            "edges_created": 0,
        }

    result = await db.execute(text(f"""
        SELECT id,
            CASE WHEN {direct_expr} THEN 'direct' ELSE 'content' END AS match_type
        FROM neurons
        WHERE is_active = true
          AND node_type != 'concept'
          AND id != :concept_id
          AND ({all_expr})
    """), params)
    matches = result.all()

    direct_ids = [r[0] for r in matches if r[1] == "direct"]
    content_ids = [r[0] for r in matches if r[1] == "content"]

    edges_created = 0
    if direct_ids:
        edges_created += await link_concept_to_neurons(db, concept.id, direct_ids, weight=0.5)
    if content_ids:
        edges_created += await link_concept_to_neurons(db, concept.id, content_ids, weight=0.3)

    return {
        "concept_neuron_id": concept.id,
        "label": concept.label,
        "direct_matches": len(direct_ids),
        "content_matches": len(content_ids),
        "edges_created": edges_created,
    }


async def seed_all_concepts(
    db: AsyncSession,
    only: list[str] | None = None,
) -> dict:
    """Seed all (or specified) concept neurons from CONCEPT_DEFINITIONS.

    Args:
        only: If provided, only seed concepts whose labels are in this list.

    Returns dict with 'seeded' (list of results) and 'skipped' (already existing).
    """
    seeded = []
    skipped = []

    definitions = CONCEPT_DEFINITIONS
    if only:
        only_lower = {o.lower() for o in only}
        definitions = [d for d in definitions if d["label"].lower() in only_lower]

    for defn in definitions:
        result = await _seed_one_concept(db, defn)
        if result is None:
            skipped.append(f"{defn['label']} (already exists)")
        else:
            seeded.append(result)

    if seeded:
        await db.commit()
        # Invalidate embedding cache so new concept neurons are included in semantic search
        from app.services.semantic_prefilter import invalidate_cache
        invalidate_cache()

    total_edges = sum(r["edges_created"] for r in seeded)
    return {
        "seeded": seeded,
        "skipped": skipped,
        "total_new_concepts": len(seeded),
        "total_skipped": len(skipped),
        "total_edges_created": total_edges,
    }
