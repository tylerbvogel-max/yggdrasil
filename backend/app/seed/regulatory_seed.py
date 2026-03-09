"""Regulatory department seed data — ~200 neurons covering aerospace standards.

Run directly to populate an existing DB:
    cd backend && python -m app.seed.regulatory_seed
"""

import json
import os
import re
from urllib.parse import urlparse

import psycopg2

DEPARTMENT = "Regulatory"


def _cross_ref(depts: list[str]) -> str:
    return json.dumps(depts)


# Structure: list of (role_label, role_key, cross_ref_depts, standard_date, tasks)
# Each task: (label, summary, content, cross_ref_depts | None, systems)
# Each system: (label, summary, content)

REGULATORY_TREE = [
    # ── AS9100 Rev D ──
    ("AS9100 Rev D", "as9100d",
     ["Engineering", "Manufacturing & Operations", "Contracts & Compliance", "Administrative & Support", "Program Management", "Finance"],
     "2016-09-20",
     [
        ("Clause 4 — Context of the Organization", "AS9100D Clause 4: organizational context, interested parties, QMS scope",
         "Clause 4 requires the organization to determine external/internal issues relevant to its purpose and strategic direction, understand needs of interested parties (customers, regulatory authorities, suppliers), and define QMS scope including aerospace-specific requirements. The scope must address product safety, prevention of counterfeit parts, and applicable statutory/regulatory requirements.",
         None, [
            ("4.1 Understanding the Organization", "Determine internal/external issues affecting QMS",
             "SWOT analysis for QMS context. Must consider: industry-specific risks, technology changes, supply chain complexity, organizational knowledge, regulatory environment changes. Review annually at management review."),
            ("4.4 QMS and Its Processes", "Process approach requirements for aerospace QMS",
             "Define processes needed for QMS: inputs/outputs, sequence/interaction, criteria/methods for effectiveness, resources needed, responsibilities, risks/opportunities. Must address: process owners, KPIs, customer requirements flowdown, regulatory compliance verification."),
        ]),
        ("Clause 5 — Leadership", "AS9100D Clause 5: management commitment, customer focus, quality policy, org roles",
         "Clause 5 requires top management to demonstrate leadership and commitment to the QMS by ensuring quality policy and objectives are established, integrating QMS into business processes, promoting process approach and risk-based thinking, and ensuring QMS achieves intended results. Must ensure customer focus, establish quality policy communicated throughout the organization, and assign roles/responsibilities/authorities.",
         None, [
            ("5.1 Leadership and Commitment", "Top management commitment to QMS effectiveness",
             "Top management must: ensure quality policy/objectives are compatible with strategic direction, ensure QMS integration into business processes, promote use of process approach and risk-based thinking, ensure resources available, communicate importance of effective QMS, ensure QMS achieves intended results, engage/direct/support persons, promote improvement, support other relevant management roles."),
            ("5.2 Quality Policy", "Establishing and communicating quality policy",
             "Quality policy must: be appropriate to purpose/context, provide framework for quality objectives, include commitment to satisfy requirements, include commitment to continual improvement. Must be available as documented information, communicated/understood/applied within organization, available to relevant interested parties."),
            ("5.3 Organizational Roles, Responsibilities and Authorities", "Assigning QMS roles and authorities",
             "Top management must assign responsibility/authority for: ensuring QMS conforms to requirements, ensuring processes deliver intended outputs, reporting QMS performance and improvement opportunities, ensuring promotion of customer focus, ensuring QMS integrity maintained during changes. Must include management representative with authority for resolving quality issues."),
        ]),
        ("Clause 6 — Planning", "AS9100D Clause 6: risk-based thinking, quality objectives, planning of changes",
         "Clause 6 requires planning to address risks and opportunities (considering context and interested parties), establish quality objectives at relevant functions/levels/processes, and plan changes to QMS in a systematic manner. Aerospace additions include product safety risks, operational risks, and supply chain risks.",
         None, [
            ("6.1 Actions to Address Risks and Opportunities", "Risk-based thinking for QMS planning",
             "Must consider issues from 4.1 and requirements from 4.2 to determine risks/opportunities that need addressing. Plan actions to address risks/opportunities, integrate into QMS processes, evaluate effectiveness. Actions proportionate to potential impact on product/service conformity. Aerospace: must address product safety, counterfeit prevention, supply chain risks."),
            ("6.2 Quality Objectives and Planning", "Setting measurable quality objectives",
             "Quality objectives must: be consistent with quality policy, be measurable, take into account applicable requirements, be relevant to product/service conformity, be monitored, be communicated, be updated as appropriate. Planning must determine: what will be done, what resources required, who responsible, when completed, how results evaluated."),
        ]),
        ("Clause 7 — Support", "AS9100D Clause 7: resources, competence, awareness, communication, documented information",
         "Clause 7 covers support requirements: determining/providing resources (people, infrastructure, monitoring equipment, organizational knowledge), ensuring competence through education/training/experience, awareness of quality policy/objectives, internal/external communications, and controlling documented information including retention requirements.",
         None, [
            ("7.1.5 Monitoring and Measuring Resources", "Calibration and measurement system requirements",
             "Equipment must be calibrated/verified at specified intervals against traceable standards. Calibration status must be identifiable. Records retained. If found out of calibration, assess validity of previous results. Applies to all measurement equipment affecting product conformity — including software used for inspection."),
            ("7.5 Documented Information", "Document control and records management for aerospace",
             "Controlled documents: creation/update with proper identification, format, review/approval. Distribution, access, retrieval, storage, preservation, retention, disposition. Prevent unintended use of obsolete documents. External documents identified and controlled. Electronic signatures validated per 21 CFR Part 11 where applicable."),
        ]),
        ("8.1 Operational Planning and Control", "AS9100D 8.1: config mgmt, product safety, counterfeit prevention, work transfer",
         "Operational planning must address configuration management throughout product lifecycle, product safety assessment and management, prevention of counterfeit parts (detection, quarantine, reporting), and work transfer activities (in-house, supplier, between facilities). Must plan, implement, and control processes needed to meet requirements for provision of products and services.",
         None, [
            ("Configuration Management", "Product configuration control per AS9100D 8.1",
             "Configuration management must address: configuration identification, change control (impact analysis, customer/authority approval), configuration status accounting, configuration audit. Applies to hardware, software, documentation, and combined products throughout lifecycle from design through support."),
            ("Counterfeit Parts Prevention", "Detection and avoidance of counterfeit/suspect parts",
             "Must plan/implement processes to detect and prevent use of counterfeit parts. Requirements: approved supplier sources, component authentication, employee awareness training, quarantine/reporting procedures for suspect parts, notification to customer and authorities when detected. Reference AS6174/AS6496 for electronic parts."),
        ]),
        ("8.2 Requirements for Products and Services", "AS9100D 8.2: customer communication, requirement determination/review",
         "Requirements determination must include customer-specified requirements (delivery, post-delivery, product safety), requirements not stated but necessary for intended use, statutory/regulatory requirements, and any additional requirements the organization considers necessary. Must review requirements before commitment to supply, resolve differences, confirm customer requirements when not documented.",
         None, []),
        ("8.3 Design and Development", "AS9100D 8.3: D&D planning, inputs, controls, outputs, changes",
         "Design and development must consider: nature/duration/complexity, required stages (including reviews), verification/validation activities, responsibilities/authorities, resource needs, interface management between groups, customer/user involvement, subsequent production requirements, expected level of control. Inputs must include functional/performance requirements, applicable statutory/regulatory, information from previous similar designs, standards/codes of practice, potential consequences of failure.",
         None, [
            ("8.3.4 Design and Development Controls", "Design verification, validation, and review controls",
             "Controls must ensure: results to be achieved are defined, reviews evaluate ability to meet requirements, verification confirms outputs meet input requirements, validation confirms product meets intended use requirements. Must consider product safety, reliability, durability, maintainability, testability. Design reviews at planned stages — include representatives of functions concerned."),
        ]),
        ("Clause 8 — Operation (Existing)", "AS9100D Clause 8: operational planning, design, production, release",
         "Clause 8 is the core operational clause covering: operational planning and control, requirements for products/services, design and development, control of externally provided processes/products/services, production and service provision, release of products, and control of nonconforming outputs. Includes critical aerospace requirements for configuration management, product safety, prevention of counterfeit parts, and first article inspection.",
         None, [
            ("8.4 Control of External Providers", "Supplier management and flowdown requirements",
             "Determine controls for external providers based on: type/extent of control, defined criteria for evaluation/selection/monitoring/re-evaluation. Flowdown requirements: product/service requirements, approval of products/processes/equipment, competence/qualification of personnel, QMS requirements, interaction with provider's QMS, verification activities, right of access by organization and customer. Must maintain approved supplier list and monitor supplier performance."),
            ("8.5 Production and Service Provision", "Production controls including special processes and FOD",
             "Controlled conditions: documented information defining product characteristics and activities, monitoring/measuring resources, process validation for special processes (per NADCAP where applicable), actions to prevent human error (poka-yoke), production process verification, FOD prevention program, tool/equipment management including first-piece verification, control of production equipment/tooling/software programs."),
            ("8.7 Control of Nonconforming Outputs", "Nonconformance disposition: use-as-is, rework, scrap",
             "Nonconforming outputs must be identified, controlled, and prevented from unintended use/delivery. Disposition: rework, accept with/without concession (requires customer authorization for use-as-is/repair), scrap. Retain documented information on nonconformity, actions taken, concessions, authority making disposition. Report to customer when product shipped under concession."),
        ]),
        ("Clause 9 — Performance Evaluation", "AS9100D Clause 9: monitoring, measurement, analysis, evaluation",
         "Clause 9 requires: monitoring/measuring/analyzing/evaluating QMS effectiveness, customer satisfaction measurement, internal audits, and management review. Aerospace additions include: on-time delivery performance, product safety/conformity trends, and supplier performance metrics.",
         None, [
            ("9.1 Monitoring and Measurement", "KPIs for QMS performance including OTD and quality metrics",
             "Must monitor/measure: customer satisfaction, QMS process performance, product/service conformity, on-time delivery (OTD) performance. Determine methods, timing, and criteria for analysis. Use statistical techniques where appropriate. Results feed into management review inputs."),
            ("9.2 Internal Audit", "Internal audit program per AS9100D and AS9101 requirements",
             "Planned audit program considering: process importance, changes affecting organization, previous audit results. Audit criteria, scope, frequency, methods defined. Auditor objectivity/impartiality ensured. Results reported to relevant management. Corrective actions taken without undue delay. Follow-up verification of actions. Audit program per AS9101 Standard for Audit requirements."),
        ]),
        ("Clause 10 — Improvement", "AS9100D Clause 10: nonconformity, corrective action, continual improvement",
         "Clause 10 covers: nonconformity and corrective action (react, evaluate, implement, review effectiveness), and continual improvement of QMS suitability/adequacy/effectiveness. Aerospace additions: timely/effective corrective action proportional to impact, problem-solving methodology (8D, Ishikawa, 5-Why), lessons learned dissemination.",
         None, [
            ("10.2 Corrective Action", "Root cause analysis and corrective action per AS9100D",
             "React to nonconformity: take action to control/correct, deal with consequences. Evaluate need for action to eliminate cause by: reviewing/analyzing nonconformity, determining causes (8D, 5-Why, Ishikawa), determining if similar nonconformities exist. Implement action, review effectiveness, update risks/opportunities, make changes to QMS if needed. Corrective actions proportional to effects of nonconformities encountered."),
        ]),
     ]),

    # ── FAR/DFARS ──
    ("FAR/DFARS", "far_dfars",
     ["Contracts & Compliance", "Finance", "Program Management", "Business Development"],
     "2025-01-01",
     [
        ("FAR Part 15 — Contracting by Negotiation", "Cost/price analysis, proposal preparation, competitive range",
         "FAR Part 15 governs negotiated acquisitions: proposal evaluation factors, cost/price analysis requirements, competitive range determination, discussions/negotiations, source selection procedures. Contractors must provide certified cost or pricing data (per 15.403) when contract value exceeds threshold ($2M) unless exception applies (adequate price competition, prices set by law/regulation, commercial items).",
         None, [
            ("15.403 Cost or Pricing Data", "Truth in Negotiations Act (TINA) requirements",
             "Certified cost or pricing data required for negotiated contracts/modifications >$2M threshold (adjusted for inflation). Exceptions: adequate price competition, prices set by law/regulation, commercial items, waiver. Data must be accurate, complete, current as of agreement on price. Defective pricing clause (52.215-10) allows price reduction if data was defective."),
        ]),
        ("FAR Part 31 — Cost Principles", "Allowable costs, allocability, reasonableness standards",
         "FAR Part 31 establishes cost principles for determining allowable costs under government contracts. Key tests: allowability (per contract terms and regulations), allocability (benefits the contract), reasonableness (prudent business person standard). Selected costs: 31.205-6 compensation (reasonable for services rendered), 31.205-18 independent R&D/B&P, 31.205-33 professional services, 31.205-46 travel.",
         None, [
            ("31.201 Allowability Criteria", "Four tests for cost allowability",
             "A cost is allowable if it meets ALL four criteria: (1) Reasonableness — prudent business person would incur at that amount; (2) Allocability — benefits the contract or is necessary for overall business operation; (3) Complies with CAS/GAAP and contract terms; (4) Not specifically unallowable under FAR 31.205 cost principles. Burden of proof on contractor."),
        ]),
        ("FAR Part 32 — Contract Financing", "Progress payments, performance-based payments, loan guarantees",
         "FAR Part 32 covers contract financing methods: progress payments based on costs (customary 80% for large business, 90% for small), performance-based payments (preferred method tied to milestones/events), commercial item financing, advance payments, and loan guarantees. Liquidation of progress payments upon delivery. Contractors must maintain adequate accounting systems for progress payment requests.",
         None, []),
        ("FAR Part 42 — Contract Administration", "COR duties, modifications, novation, change-of-name",
         "FAR Part 42 governs contract administration: assignment of contract administration offices (CAO), contracting officer's representative (COR) duties, contract modifications (bilateral/unilateral), novation agreements (successor-in-interest), change-of-name agreements, stop-work orders, government delay of work, contract closeout procedures. ACO responsibilities include monitoring contractor performance, approving/disapproving accounting systems, and issuing determination of adequacy.",
         None, []),
        ("FAR Part 45 — Government Property", "Contractor use, management, and disposal of GFE/GFM",
         "FAR Part 45 covers government property in possession of contractors: government-furnished equipment (GFE), government-furnished material (GFM), contractor-acquired property. Requirements: property management system, records/tracking, physical inventories, maintenance, risk of loss, disposition (return, transfer, sale, donation, abandonment/destruction). Property in contractor's possession is government property regardless of how acquired under contract.",
         None, []),
        ("FAR Part 46 — Quality Assurance", "Inspection levels, acceptance, warranties, government source inspection",
         "FAR Part 46 covers quality assurance: types of contract quality requirements (standard inspection, higher-level, government source inspection), inspection and acceptance procedures, certificate of conformance, warranties (express and implied), correction of defects, inspection by higher-level authority. Government source inspection required for critical items, complex requirements, or when past performance warrants.",
         None, []),
        ("FAR Part 49 — Termination of Contracts", "T4C vs T4D, settlement proposals, continuing claims",
         "FAR Part 49 covers termination procedures: termination for convenience (T4C) — government's right to end contract when in its interest, contractor entitled to settlement (costs incurred + profit on work done + settlement expenses); termination for default (T4D) — contractor fails to perform, may be liable for excess reprocurement costs. Settlement proposals: inventory basis or total cost basis. Contractor must stop work, protect government property, terminate subcontracts.",
         None, []),
        ("FAR Part 52 — Solicitation Provisions and Contract Clauses", "Standard contract clauses and flowdown requirements",
         "FAR Part 52 contains standard provisions and clauses prescribed throughout the FAR. Key clauses: 52.215-10 (Price Reduction for Defective Pricing), 52.222-26 (Equal Opportunity), 52.223-6 (Drug-Free Workplace), 52.227-14 (Rights in Data), 52.244-6 (Subcontractor flowdown).",
         None, []),
        ("DFARS 252.204 — Safeguarding CUI", "Controlled Unclassified Information protection requirements",
         "DFARS 252.204-7012 requires contractors to: provide adequate security for covered defense information on covered contractor information systems, report cyber incidents within 72 hours, submit malicious software, preserve/protect images of affected systems. Requires compliance with NIST SP 800-171. Flows down to subcontractors handling CUI.",
         None, [
            ("252.204-7012 Safeguarding Requirements", "CUI protection and cyber incident reporting",
             "Must implement NIST SP 800-171 for CUI systems. 72-hour reporting for cyber incidents to DoD via DIBNet. Preserve affected systems for 90 days. Provide access to equipment/information for forensic analysis. Subcontractor flowdown required for all tiers handling CUI. Cloud services must meet FedRAMP Moderate or DoD Cloud SRG Impact Level 2+."),
        ]),
        ("DFARS 252.211 — Item Unique Identification", "IUID marking requirements for defense items",
         "DFARS 252.211-7003 requires item unique identification (IUID) for all delivered items with unit acquisition cost ≥$5,000, regardless of dollar value if item is serially managed/mission essential/controlled inventory, and items embedded within larger items. Data matrix marking per MIL-STD-130. Data submitted to IUID Registry. Concatenated UIIs using enterprise identifier + serial number or batch/lot.",
         None, []),
        ("DFARS 252.225 — Foreign Acquisition", "Buy American Act, specialty metals, qualifying countries",
         "DFARS 252.225 implements restrictions on foreign acquisition: Buy American Act compliance, specialty metals restrictions (252.225-7009/7014), qualifying country sources, trade agreements. Specialty metals (titanium, zirconium, hafnium, tungsten, steel alloys) must be melted/produced in US or qualifying country for DoD contracts unless exception applies.",
         None, []),
        ("DFARS 252.227 — Technical Data Rights", "Government data rights in technical data and software",
         "DFARS 252.227-7013/7014 establish data rights framework: unlimited rights (developed exclusively at government expense), government purpose rights (developed with mixed funding — 5-year restriction then unlimited), limited/restricted rights (developed exclusively at private expense). Contractors must assert rights via 252.227-7017 marking requirements. Pre-existing data rights preserved.",
         None, []),
        ("DFARS 252.246 — Quality Assurance", "First article testing and higher-level quality requirements",
         "DFARS 252.246-7001 requires first article testing (FAT) approval before production: contractor submits first article for government testing/approval, production quantities not authorized until approval. 252.246-7007 establishes higher-level contract quality requirements when standard inspection is insufficient — requires contractor QMS per AS9100 or equivalent, government source inspection, and statistical process control.",
         None, []),
     ]),

    # ── SAE AS6500 ──
    ("SAE AS6500 — Manufacturing Management", "sae_as6500",
     ["Manufacturing & Operations", "Engineering"],
     "2014-11-01",
     [
        ("Process Planning and Control", "Manufacturing process planning per AS6500",
         "AS6500 requires formal process planning: manufacturing plan documents, process flow diagrams, control plans, work instructions. Must address: material control, equipment maintenance, environmental controls, in-process verification, statistical process control (SPC), special process qualification. All manufacturing processes must be validated before production use.",
         None, [
            ("Process Validation", "First article and process capability requirements",
             "Demonstrate process capability (Cpk ≥ 1.33 minimum, 1.67 preferred for critical characteristics). First article inspection (FAI) per AS9102 required for new parts, processes, or significant changes. Process parameters documented and monitored via SPC. Special processes require NADCAP accreditation or equivalent qualification."),
        ]),
        ("Production Readiness", "Production readiness review criteria per AS6500",
         "Formal production readiness review (PRR) before rate production: tooling validated, processes qualified, operators trained/certified, supply chain qualified, quality plans approved, measurement systems validated (MSA), first articles completed. Risk assessment of production maturity using Manufacturing Readiness Level (MRL) framework.",
         None, []),
        ("Material Management", "Receiving, storage, traceability, shelf life, material review",
         "Material management requirements: receiving inspection and verification of material certifications, storage conditions per material specification (temperature, humidity, ESD controls), traceability from raw material to finished part (heat lot, batch, serial), shelf-life management for age-sensitive materials (adhesives, sealants, prepregs), material review board (MRB) for nonconforming material disposition.",
         None, []),
        ("Tooling Management", "Design validation, maintenance, FOD prevention, tool life tracking",
         "Tooling management requirements: tool design validation before production use, preventive maintenance schedules, FOD prevention controls for tooling (accounting, inspection, marking), tool life tracking for perishable tooling (cutters, drills, inserts), calibration of measurement tools per AS6500/ISO 10012, first-piece verification after tool change/rework, storage and environmental protection.",
         None, []),
        ("Supplier Process Control", "Qualification, monitoring, flowdown, sub-tier management",
         "Supplier process control: supplier qualification assessment before approval, ongoing monitoring via scorecards (quality, delivery, responsiveness), flowdown of process requirements including special process accreditation (NADCAP), sub-tier supplier management and visibility, right of access for customer/regulatory authority source inspection, supplier corrective action process, approved supplier list maintenance.",
         None, []),
     ]),

    # ── ITAR/EAR ──
    ("ITAR/EAR Export Controls", "itar_ear",
     ["Contracts & Compliance", "Engineering", "Administrative & Support", "Program Management"],
     "2024-10-01",
     [
        ("ITAR — International Traffic in Arms Regulations", "USML-controlled defense articles and services",
         "ITAR (22 CFR 120-130) controls export of defense articles on the US Munitions List (USML). Requires: State Department registration, export licenses (DSP-5 for permanent, DSP-73 for temporary), Technical Assistance Agreements (TAA) for defense services, Manufacturing License Agreements (MLA). Violations: civil penalties up to $500K per violation, criminal penalties up to $1M and 20 years imprisonment. No de minimis exception — any ITAR content makes entire item ITAR-controlled.",
         None, [
            ("ITAR Compliance Program Elements", "Required elements of an ITAR compliance program",
             "Effective ITAR compliance requires: (1) Empowered Official designation, (2) technology control plan (TCP), (3) visitor access procedures, (4) IT security for controlled data, (5) employee training and awareness, (6) voluntary disclosure procedures, (7) screening against denied parties lists (DDTC, BIS), (8) record retention (5 years), (9) regular compliance audits."),
        ]),
        ("EAR — Export Administration Regulations", "Dual-use items on Commerce Control List",
         "EAR (15 CFR 730-774) controls export of dual-use items on the Commerce Control List (CCL). Classification by Export Control Classification Number (ECCN). License requirements vary by ECCN, destination country, end-use, and end-user. License exceptions (e.g., TMP for temporary exports, TSR for technology/software under restriction). EAR99 items generally exportable without license except to embargoed destinations or denied parties.",
         None, []),
        ("USML Categories", "Key USML categories for aerospace: Cat IV, VIII, XI, XV",
         "Key USML categories for aerospace/defense: Category IV — Launch Vehicles, Guided Missiles, Ballistic Missiles, Rockets, Torpedoes, Bombs, Mines (includes UAV strike systems). Category VIII — Aircraft and Related Articles (military aircraft, engines, components, ground support equipment). Category XI — Military Electronics (C4ISR, EW, radar, military GPS). Category XV — Spacecraft and Related Articles (satellites, space-qualified components, ground control equipment). Jurisdiction determination critical — some items may be EAR-controlled instead.",
         None, []),
        ("Deemed Exports", "Technology release to foreign nationals in US, fundamental research exclusion",
         "A deemed export occurs when controlled technology/source code is released to a foreign national in the US — treated as an export to the person's home country. Requires license or license exception. Fundamental research exclusion (§734.8): basic/applied research at accredited institutions, results ordinarily published, no access/dissemination restrictions. Does not apply to proprietary/export-controlled research. Employers must screen employees and visitors against ITAR/EAR requirements.",
         None, []),
        ("TAA/MLA Details", "Agreement types, provisos, amendments, Congressional notification",
         "Technical Assistance Agreements (TAA): authorize defense services (training, technical data, maintenance) to foreign persons. Manufacturing License Agreements (MLA): authorize foreign production of defense articles. Both require: provisos/limitations, Congressional notification for agreements >$50M (MLA) or $100M (TAA) or significant military equipment >$14M. Amendments required for scope changes, additional foreign parties, or extended duration. Processing time typically 30-60 days for non-Congressional cases.",
         None, []),
     ]),

    # ── NADCAP ──
    ("NADCAP Special Process Accreditation", "nadcap",
     ["Manufacturing & Operations", "Engineering"],
     "2024-01-01",
     [
        ("AC7000 — Audit Criteria General", "NADCAP general audit requirements applicable to all special processes",
         "AC7000 establishes baseline requirements for all NADCAP accreditations: quality system documentation, personnel qualification, equipment calibration, process control documentation, nonconformance procedures, internal audit, continuous improvement. Root cause corrective action required for all findings. Merit status available after consecutive successful audits.",
         None, []),
        ("AC7004 — Welding", "NADCAP welding process accreditation requirements",
         "Covers fusion welding processes: GTAW, GMAW, PAW, EBW, LBW, resistance welding. Requirements: qualified welding procedures (AWS D17.1 for aerospace), welder qualification/certification, welding parameter monitoring, joint preparation standards, shielding gas purity, post-weld heat treatment, NDT inspection (radiographic/ultrasonic per applicable spec). Weld quality per AWS D17.1 Class A/B/C.",
         None, []),
        ("AC7101/AC7102 — Heat Treating", "NADCAP heat treatment accreditation for metals processing",
         "AC7101 (general heat treat) and AC7102 (specific alloy requirements). Covers: solution treatment, aging, annealing, normalizing, stress relief, hardening/tempering. Requirements: pyrometry per AMS 2750 (instrument calibration, SAT/TUS surveys), atmosphere control, quench system monitoring, hardness testing, metallographic examination, batch/lot traceability.",
         None, [
            ("AMS 2750 Pyrometry", "Temperature measurement and control for heat treating",
             "AMS 2750 Rev G requirements: instrument types (1-5), SAT frequency based on furnace class/instrument type, TUS requirements by furnace class (1-6) with tolerances ±5°F to ±50°F. Thermocouple types, calibration frequency, correction factors. Load thermocouples required for Class 1/2 furnaces. Furnace survey interval extensions based on successful history."),
        ]),
        ("AC7108/AC7109 — Chemical Processing", "NADCAP chemical processing and surface treatment accreditation",
         "AC7108 (chemical processing) covers: cleaning, etching, conversion coating, anodizing, passivation, chemical milling. AC7109 (coatings) covers: electroplating, electroless plating, phosphate coating. Requirements: solution analysis/control, process parameter monitoring (temperature, time, concentration, pH), thickness measurement, adhesion testing, hydrogen embrittlement relief.",
         None, []),
        ("AC7114 — Liquid Penetrant Testing", "NADCAP fluorescent/visible PT, sensitivity levels, process control",
         "AC7114 covers liquid penetrant testing accreditation: fluorescent and visible methods, sensitivity levels (½ to 4 per AMS 2644), pre-cleaning requirements, dwell times, developer application, inspection under UV-A (fluorescent) or white light (visible). Process control: penetrant material testing per ASTM E1417, UV light intensity verification (≥1000 µW/cm²), ambient light control (<2 fc for fluorescent), system performance checks (TAM/PSM panels), contamination control.",
         None, []),
        ("AC7113 — Ultrasonic Testing", "NADCAP pulse-echo, through-transmission, phased array, immersion/contact",
         "AC7113 covers ultrasonic testing accreditation: pulse-echo (A-scan, B-scan, C-scan), through-transmission, phased array, immersion and contact methods. Requirements: equipment calibration (linearity, DAC curves, reference standards), transducer characterization, scan plan documentation, gate settings, surface condition requirements, coupling medium control. Acceptance criteria per customer/spec requirements. Data recording and archival for critical components.",
         None, []),
        ("AC7110/AC7111 — Radiographic/Eddy Current", "Film/digital RT and ET for surface/subsurface detection",
         "AC7110 covers radiographic testing: film-based and digital (CR/DR) methods, source selection (X-ray/gamma), geometric unsharpness, image quality indicators (IQI/penetrameters), film density/contrast requirements, darkroom controls, film processing/storage. AC7111 covers eddy current testing: surface and subsurface detection, impedance plane analysis, frequency selection, probe/coil calibration, reference standards, conductivity measurement, liftoff compensation.",
         None, []),
        ("AC7120 — Nonmetallic Materials Testing", "Polymer/composite mechanical, thermal, environmental testing",
         "AC7120 covers testing of nonmetallic materials: mechanical testing (tensile, compression, flexural, shear, peel, lap shear per ASTM D-series), thermal analysis (DSC, TGA, DMA, TMA), environmental testing (fluid resistance, humidity, weathering), specimen preparation requirements, conditioning procedures, test fixture requirements. Critical for incoming material acceptance, process qualification, and lot acceptance of composite/adhesive/sealant materials.",
         None, []),
        ("AC7116 — Elastomer Seals", "NADCAP elastomer seal processing accreditation",
         "Covers molding and bonding of elastomeric seals for aerospace applications. Requirements: compound certification, mold validation, cure parameter control (temperature, pressure, time), dimensional inspection, hardness testing, compression set testing, fluid compatibility, lot acceptance testing per applicable seal specifications.",
         None, []),
        ("AC7118 — Composites", "NADCAP composite material processing accreditation",
         "Covers layup, cure, bonding, and repair of composite structures. Requirements: material receiving inspection (prepreg life tracking, resin content, fiber areal weight), controlled environment (cleanroom class, temperature, humidity), layup verification (ply orientation, compaction), autoclave cure monitoring (temperature, pressure, vacuum), NDI per applicable specification (ultrasonic, thermography), coupon testing per process spec.",
         None, []),
     ]),

    # ── MIL-STD Series ──
    ("MIL-STD Series", "mil_std",
     ["Engineering", "Manufacturing & Operations", "Program Management"],
     None,  # dates vary per standard — set on individual tasks where applicable
     [
        ("MIL-STD-810H — Environmental Testing", "Environmental engineering considerations and test methods",
         "MIL-STD-810H provides test methods and engineering guidance for environmental considerations in design and test. Method categories: climatic (temperature, humidity, rain, sand/dust, solar radiation), dynamic (vibration, shock, acceleration, pyroshock), pressure (altitude), and chemical (salt fog, fluid contamination). Tailoring is required — use service environment data, not just standard profiles. Part One provides engineering guidance; Part Two/Three contain test methods.",
         None, [
            ("Method 514.8 — Vibration", "Vibration test methods: sinusoidal, random, combined environments",
             "Covers: Category 1-24 vibration environments (aircraft, ground vehicles, shipboard, etc.). Test types: sinusoidal sweep (resonance search), random vibration (operational/functional), combined environments (vibration + temperature). Tailoring: use measured data from actual platform when available. Duration: endurance testing based on life cycle exposure hours. Fixture design per Method 514 Annex A guidelines."),
        ]),
        ("MIL-STD-461G — EMI/EMC Requirements", "Electromagnetic interference and compatibility requirements",
         "MIL-STD-461G establishes EMI/EMC requirements for military equipment. Emission limits: CE101/CE102 (conducted, power leads), RE101/RE102 (radiated). Susceptibility limits: CS101/CS114/CS115/CS116 (conducted), RS103 (radiated). Test setup per MIL-STD-461G: ground plane, LISN configuration, antenna positioning, ambient measurements. Applicability tailored by platform (aircraft, ship, ground, space).",
         None, []),
        ("MIL-STD-882E — System Safety", "System safety program requirements and hazard analysis",
         "MIL-STD-882E establishes system safety engineering practices: hazard severity categories (I-IV: Catastrophic to Negligible), hazard probability levels (A-F: Frequent to Eliminated), risk assessment matrix. Required analyses: Preliminary Hazard List (PHL), Preliminary Hazard Analysis (PHA), Subsystem Hazard Analysis (SSHA), System Hazard Analysis (SHA), Operating & Support Hazard Analysis (O&SHA). Software safety per MIL-STD-882E Task 207.",
         None, [
            ("Hazard Risk Assessment Matrix", "Severity vs probability risk classification",
             "Severity: I=Catastrophic (death/system loss), II=Critical (severe injury/major damage), III=Marginal (minor injury/minor damage), IV=Negligible. Probability: A=Frequent, B=Probable, C=Occasional, D=Remote, E=Improbable, F=Eliminated. Risk levels: High (IA-IIC), Serious (ID-IIIB), Medium (IE-IIIC), Low (IIF-IVF). Acceptance authority: High=PEO/DASA, Serious=Program Manager, Medium=delegated, Low=delegated."),
        ]),
        ("MIL-STD-881E — Work Breakdown Structure", "Standard WBS for defense materiel items",
         "MIL-STD-881E defines standard WBS elements for defense programs by commodity type: Aircraft Systems, Electronic/Automated Software Systems, Missile Systems, Ordnance Systems, Sea Systems, Space Systems, Surface Vehicle Systems, Unmanned Maritime Systems. Level 3+ elements tailored by program. Used for cost estimating, scheduling, EVM reporting, and technical performance measurement.",
         None, []),
        ("MIL-STD-1530 — Aircraft Structural Integrity", "ASIP requirements for aircraft structures",
         "MIL-STD-1530 establishes Aircraft Structural Integrity Program (ASIP) requirements across five tasks: Task I (Design Information), Task II (Design Analyses & Development Testing), Task III (Full-Scale Testing), Task IV (Certification & Force Management Development), Task V (Force Management Execution). Covers: damage tolerance, durability, fatigue life management, corrosion prevention, loads/environment spectra.",
         None, []),
        ("MIL-STD-130N — Marking", "UID marking, data matrix, human-readable identification",
         "MIL-STD-130N establishes requirements for identification marking of US military property. Unique identification (UID) via machine-readable 2D data matrix per ISO/IEC 16022. Marking methods: direct part marking (DPM — dot peen, laser etch, chemical etch, inkjet), labels (metallic, polyester). Content: enterprise identifier (CAGE/DUNS), serial number, part number, batch/lot. Marking location, size, contrast requirements. Verification per AS9132 (quality grade).",
         None, []),
        ("MIL-STD-1472H — Human Engineering", "Human factors design criteria for military systems",
         "MIL-STD-1472H establishes human engineering design criteria for military systems/equipment. Covers: workspace design (anthropometric data, reach envelopes, clearances), controls and displays (layout, labeling, coding, feedback), visual displays (CRT/LCD requirements, symbology, lighting), auditory displays (warning signals, voice communication), environment (illumination, noise, vibration, temperature), maintainability (access, handling, test points), safety (hazard prevention, warnings).",
         None, []),
        ("MIL-STD-31000B — Technical Data Packages", "TDP content, delivery format, model-based definition",
         "MIL-STD-31000B defines requirements for technical data packages (TDP): content (drawings, specifications, 3D models, associated lists), delivery format (2D drawings per ASME Y14 series, 3D models per ASME Y14.41/ISO 10303 STEP), TDP types (conceptual, developmental, product, process), validation requirements, intellectual property/data rights marking per DFARS 252.227. Supports transition to model-based definition (MBD) and digital engineering.",
         None, []),
     ]),

    # ── ISO Standards ──
    ("ISO Standards", "iso_standards",
     ["Administrative & Support", "Manufacturing & Operations", "Engineering"],
     None,  # dates vary per standard
     [
        ("ISO 9001:2015 — Quality Management", "Quality management system requirements (foundation for AS9100)",
         "ISO 9001:2015 establishes QMS requirements using process approach and risk-based thinking. Seven quality management principles: customer focus, leadership, engagement of people, process approach, improvement, evidence-based decision making, relationship management. AS9100 Rev D is built on ISO 9001:2015 with additional aerospace-specific requirements.",
         None, []),
        ("ISO 14001:2015 — Environmental Management", "Environmental management system requirements",
         "ISO 14001:2015 EMS framework: environmental policy, planning (aspects/impacts, legal requirements, objectives), support and operation (resources, communication, documented information, operational planning, emergency preparedness), performance evaluation (monitoring, internal audit, management review), improvement. Relevant for aerospace manufacturing: hazardous materials, emissions, waste management, chemical storage.",
         None, []),
        ("ISO 45001:2018 — Occupational Health and Safety", "OH&S management system requirements",
         "ISO 45001:2018 replaces OHSAS 18001. Framework: context of organization, worker participation, hazard identification and risk assessment, legal compliance, OH&S objectives, operational planning and control, emergency preparedness, performance evaluation, incident investigation, continual improvement. Aerospace-specific hazards: chemical exposure, noise, confined spaces, fall protection, radiation, ergonomics.",
         None, []),
        ("ISO/IEC 17025:2017 — Testing/Calibration Lab Competence", "Lab competence requirements critical for aerospace test labs",
         "ISO/IEC 17025:2017 establishes requirements for competence of testing and calibration laboratories: impartiality, confidentiality, structural requirements, resource requirements (personnel competence, facilities, equipment, metrological traceability), process requirements (review of requests/contracts, method selection/validation, sampling, handling of test items, technical records, measurement uncertainty, ensuring validity of results, reporting), management system requirements. Critical for aerospace labs performing material testing, NDT, calibration services. Accreditation typically through A2LA or NVLAP.",
         None, []),
        ("ISO 19011:2018 — Auditing Management Systems", "Guidelines for auditing management systems",
         "ISO 19011:2018 provides guidance on auditing management systems including: principles of auditing (integrity, fair presentation, due professional care, confidentiality, independence, evidence-based approach), managing an audit program (objectives, risks, resources, records), conducting an audit (planning, document review, on-site activities, reporting, follow-up), competence/evaluation of auditors. Applicable to all management system audits (ISO 9001, 14001, 45001, AS9100). Supports both internal and supplier audits.",
         None, []),
     ]),

    # ── OSHA ──
    ("OSHA 29 CFR 1910 — General Industry", "osha",
     ["Administrative & Support", "Manufacturing & Operations"],
     "2024-01-01",
     [
        ("Subpart Z — Toxic and Hazardous Substances", "Chemical exposure limits and hazard communication",
         "29 CFR 1910.1000: permissible exposure limits (PELs) for airborne contaminants — Tables Z-1 (adopted from 1968 ACGIH TLVs), Z-2 (8-hour TWA with ceiling), Z-3 (mineral dusts). 1910.1200 Hazard Communication (HazCom): Safety Data Sheets (SDS), container labeling per GHS, employee training, written hazard communication program. Aerospace relevance: chromium compounds (1910.1026 Cr(VI) PEL 5 µg/m³), cadmium (1910.1027), beryllium (1910.1024 PEL 0.2 µg/m³).",
         None, []),
        ("Subpart O — Machinery and Machine Guarding", "Machine guarding and lockout/tagout requirements",
         "29 CFR 1910.212: general machine guarding — point of operation, ingoing nip points, rotating parts, flying chips. 1910.147: Control of Hazardous Energy (Lockout/Tagout) — energy isolation procedures, lockout devices, periodic inspection, training. Applies to CNC machines, presses, lathes, mills, grinders used in aerospace manufacturing.",
         None, []),
        ("Subpart I — Personal Protective Equipment", "PPE requirements for aerospace manufacturing",
         "29 CFR 1910.132: general PPE requirements — hazard assessment, selection, training. 1910.133: eye/face protection. 1910.134: respiratory protection program — medical evaluation, fit testing, maintenance. 1910.135: head protection. 1910.136: foot protection. 1910.137: electrical protective equipment. 1910.138: hand protection. Aerospace-specific: chemical-resistant gloves for processing, respirators for composite dust/painting, hearing protection for rivet/machine shop.",
         None, []),
        ("Subpart D — Walking-Working Surfaces", "Fall protection, ladders, scaffolds, stairways",
         "29 CFR 1910.21-30: walking-working surfaces requirements. 1910.28: duty to have fall protection (unprotected sides/edges ≥4 ft, hoist areas, holes, dockboards, runways). 1910.29: fall protection systems criteria (guardrails, safety net, personal fall arrest). 1910.23: ladders (design, use, inspection). 1910.25-26: stairways. 1910.27: scaffolds (capacity, platform, access). Aerospace relevance: aircraft maintenance stands, assembly platforms, hangar ladders.",
         None, []),
        ("Subpart H — Hazardous Materials", "Flammable liquids, compressed gases, process safety management",
         "29 CFR 1910.101-126: hazardous materials. 1910.106: flammable liquids (storage, handling, use — cabinet/room/tank requirements). 1910.101: compressed gases (inspection, storage, handling). 1910.119: Process Safety Management (PSM) for highly hazardous chemicals — process hazard analysis, operating procedures, mechanical integrity, management of change, incident investigation. Aerospace: solvents, primers, fuel handling, composite resin systems, cryogenic fluids.",
         None, []),
        ("Subpart S — Electrical", "Electrical design, safety-related work practices, maintenance",
         "29 CFR 1910.301-399: electrical standards. 1910.303-308: design safety (wiring, overcurrent protection, grounding). 1910.331-335: safety-related work practices (qualified/unqualified persons, approach distances, lockout/tagout for electrical). 1910.399: definitions. NFPA 70E referenced for arc flash hazard analysis, PPE selection, energized electrical work permits. Aerospace: high-power test equipment, aircraft electrical systems maintenance, avionics test benches.",
         None, []),
        ("Subpart L — Fire Protection", "Fire brigades, extinguishers, detection/alarm, sprinkler systems",
         "29 CFR 1910.155-165: fire protection. 1910.156: fire brigades (organizational statement, training, protective equipment). 1910.157: portable fire extinguishers (selection, placement, maintenance, training). 1910.158: standpipe/hose systems. 1910.159: automatic sprinkler systems (design, maintenance, testing). 1910.160: fixed extinguishing systems. 1910.164: fire detection/alarm systems. Aerospace: hangar fire protection (NFPA 409), flammable storage areas, composite layup rooms.",
         None, []),
     ]),

    # ── NIST/CMMC ──
    ("NIST/CMMC", "nist_cmmc",
     ["Administrative & Support", "Engineering", "Contracts & Compliance"],
     None,  # dates vary per standard
     [
        ("NIST SP 800-171 Rev 2", "CUI protection requirements for non-federal systems",
         "NIST SP 800-171 contains 110 security requirements in 14 families for protecting CUI: Access Control (AC), Awareness and Training (AT), Audit and Accountability (AU), Configuration Management (CM), Identification and Authentication (IA), Incident Response (IR), Maintenance (MA), Media Protection (MP), Personnel Security (PS), Physical Protection (PE), Risk Assessment (RA), Security Assessment (CA), System and Communications Protection (SC), System and Information Integrity (SI).",
         None, [
            ("Key Control Families", "Critical NIST 800-171 control families for aerospace",
             "Access Control (AC): 22 requirements including least privilege, session controls, remote access, wireless restrictions. System & Communications Protection (SC): 16 requirements including boundary protection, CUI encryption in transit/at rest, FIPS-validated cryptography. Audit & Accountability (AU): 9 requirements including audit events, correlation, protection of audit info. Most common assessment gaps: multi-factor authentication (3.5.3), encrypted CUI (3.13.11), audit log review (3.3.1)."),
        ]),
        ("CMMC 2.0 Framework", "Cybersecurity Maturity Model Certification levels and assessment",
         "CMMC 2.0 has three levels: Level 1 (Foundational, 17 practices, self-assessment for FCI), Level 2 (Advanced, 110 practices = NIST 800-171, third-party assessment for CUI), Level 3 (Expert, 110+ practices from NIST 800-172, government-led assessment for critical programs). Assessment types: self-assessment (Level 1), C3PAO assessment (Level 2), DIBCAC assessment (Level 3). POA&Ms allowed for limited scope/duration.",
         None, []),
        ("NIST SP 800-172", "Enhanced security requirements for CUI in critical programs",
         "NIST SP 800-172 adds enhanced security requirements beyond 800-171 for high-value assets and critical programs: penetration-resistant architecture, cyber resiliency, security operations center (SOC), threat hunting, advanced access control (attribute-based/risk-adaptive), supply chain risk management, system recovery within defined time/point objectives. Required for CMMC Level 3.",
         None, []),
        ("NIST SP 800-53 Rev 5", "Security and privacy controls for federal information systems",
         "NIST SP 800-53 Rev 5 provides a comprehensive catalog of security and privacy controls organized in 20 families: AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PM, PS, PT, RA, SA, SC, SI, SR. Controls selected based on system categorization (FIPS 199 low/moderate/high). Baselines provide starting point, tailored for specific mission needs. Overlays for specialized environments (e.g., DoD, IC). Supports FedRAMP, RMF, and FISMA compliance. Broader and more granular than 800-171.",
         None, []),
        ("FIPS 140-3", "Cryptographic module validation requirements",
         "FIPS 140-3 (supersedes FIPS 140-2) establishes requirements for cryptographic modules used in federal systems. Four security levels: Level 1 (basic — approved algorithms, no physical security), Level 2 (tamper evidence, role-based authentication), Level 3 (tamper resistance, identity-based authentication, physical/logical separation), Level 4 (complete envelope of protection, environmental failure protection). Validated through CMVP (NIST/CCCS). Required for CUI encryption per DFARS 252.204-7012/NIST 800-171.",
         None, []),
     ]),

    # ── DO-178C/254/160G ──
    ("DO-178C/DO-254/DO-160G", "do_standards",
     ["Engineering"],
     None,  # dates vary per standard
     [
        ("DO-178C — Software Considerations", "Airborne software development assurance levels A-E",
         "DO-178C defines software lifecycle processes for airborne systems. Design Assurance Levels (DAL): A (Catastrophic), B (Hazardous), C (Major), D (Minor), E (No Effect). Key processes: planning, development (requirements, design, coding, integration), verification (reviews, analyses, testing), configuration management, quality assurance. Structural coverage criteria vary by DAL: MC/DC (Level A), decision coverage (Level B), statement coverage (Level C). Supplements: DO-330 (tool qualification), DO-331 (model-based), DO-332 (OO), DO-333 (formal methods).",
         None, [
            ("DAL A Requirements", "Level A software verification requirements (catastrophic failure condition)",
             "Level A (Catastrophic) requires: 100% MC/DC structural coverage, independence of verification from development, independence of QA, complete requirements-based testing, robustness testing (normal + abnormal + boundary), data coupling and control coupling analysis, tool qualification at TQL-1 for verification tools. Traceability: high-level requirements ↔ low-level requirements ↔ source code ↔ test cases ↔ test results."),
        ]),
        ("DO-254 — Hardware Considerations", "Airborne hardware development assurance levels",
         "DO-254 defines hardware lifecycle processes for airborne electronic hardware (AEH). Covers: simple/complex hardware classification, planning, requirements capture, conceptual design, detailed design, implementation, verification, production transition, configuration management. Complex hardware (FPGAs, ASICs, PLDs) requires additional verification rigor. Advanced verification methods: formal verification, elemental analysis, simulation at gate/RTL level.",
         None, []),
        ("DO-160G — Environmental Conditions", "Environmental test standard for airborne equipment",
         "DO-160G defines environmental test conditions and procedures for airborne equipment across 26 sections: temperature/altitude (Sec 4), temperature variation (Sec 5), humidity (Sec 6), shock/crash safety (Sec 7), vibration (Sec 8), explosion proofness (Sec 9), waterproofness (Sec 10), fluids susceptibility (Sec 11), sand/dust (Sec 12), fungus (Sec 13), salt spray (Sec 14), magnetic effect (Sec 15), power input (Sec 16), voltage spike (Sec 17), audio frequency conducted susceptibility (Sec 18), induced signal susceptibility (Sec 19), RF susceptibility (Sec 20), emission of RF energy (Sec 21), lightning (Sec 22-23), icing (Sec 24), ESD (Sec 25), fire/flammability (Sec 26).",
         None, []),
        ("DO-330 — Software Tool Qualification", "Tool qualification considerations for airborne software tools",
         "DO-330 defines criteria for qualifying software tools used in DO-178C/DO-254 processes. Five Tool Qualification Levels (TQL-1 to TQL-5) based on tool output impact and DAL. TQL-1 (most rigorous): tools whose output is part of airborne software and could insert errors not detected by other activities. TQL-5 (least rigorous): tools that cannot introduce errors. Qualification planning, tool operational requirements, tool verification, tool configuration management. Applies to compilers, linkers, test tools, code generators, model checkers.",
         None, []),
        ("DO-326A/DO-356A — Airworthiness Security", "Airworthiness security process and methods",
         "DO-326A (Airworthiness Security Process Specification) and DO-356A (Airworthiness Security Methods and Considerations) address cybersecurity for aircraft systems certification. Security risk assessment: threat identification, vulnerability analysis, risk determination, security requirements derivation. Security development lifecycle integrated with DO-178C/DO-254. Addresses: unauthorized access, data integrity, denial of service, system availability. Required by FAA for new type certificates and major modifications affecting security.",
         None, []),
        ("ARP4754A — Civil Aircraft/System Development", "Guidelines for development of civil aircraft and systems",
         "ARP4754A provides guidelines for civil aircraft and system development processes. Key activities: functional hazard assessment (FHA), preliminary system safety assessment (PSSA), system safety assessment (SSA), common cause analysis (CCA — zonal, particular risks, common mode). Development assurance levels (DAL A-E) assigned based on FHA. Covers: requirements validation, implementation verification, configuration management, process assurance. Interfaces with DO-178C (software) and DO-254 (hardware) for item-level development.",
         None, []),
        ("ARP4761 — Safety Assessment Process", "FHA, PSSA, SSA, CCA safety assessment methodologies",
         "ARP4761 describes safety assessment processes and methods: Functional Hazard Assessment (FHA — identify hazards, classify severity), Preliminary System Safety Assessment (PSSA — derive safety requirements, architectural strategies), System Safety Assessment (SSA — verify safety requirements met). Analysis methods: Fault Tree Analysis (FTA), Failure Mode and Effects Analysis (FMEA), Dependence Diagram (DD/RBD), Markov Analysis (MA), Common Cause Analysis (CCA — zonal safety, particular risks, common mode). Quantitative targets: catastrophic <1E-9/flight hour, hazardous <1E-7/flight hour.",
         None, []),
     ]),

    # ── ASTM ──
    ("ASTM Standards", "astm",
     ["Engineering", "Manufacturing & Operations"],
     None,  # dates vary per standard
     [
        ("ASTM E8/E8M — Tension Testing of Metals", "Standard test methods for mechanical testing",
         "ASTM E8/E8M defines tension test methods for metallic materials at room temperature. Specimen types: rectangular (sheet/plate/flat), round (bar/rod/wire). Key parameters: gauge length, crosshead speed (strain rate), extensometer class. Outputs: yield strength (0.2% offset), ultimate tensile strength, elongation, reduction of area. Testing machine requirements per ASTM E4. Extensometers per ASTM E83 Class B-1 minimum.",
         None, []),
        ("ASTM E18 — Rockwell Hardness Testing", "Hardness testing methods for metals",
         "ASTM E18 covers Rockwell hardness testing: scales (HRA, HRB, HRC, etc.), test blocks, machine verification. ASTM E10 covers Brinell hardness. ASTM E384 covers microindentation (Knoop/Vickers). Conversion tables per ASTM E140. Testing per customer specification — common aerospace: HRC for steels, HRB for aluminum alloys, Brinell for castings/forgings.",
         None, []),
        ("ASTM E1444 — Magnetic Particle Testing", "NDT method for ferromagnetic material inspection",
         "ASTM E1444/E1444M standard practice for magnetic particle testing (MT): continuous method, residual method, wet/dry particles, fluorescent/non-fluorescent. Magnetization: circular/longitudinal, AC/DC/HWDC, required field strength (30-60 A/cm or L/D ratio method). Sensitivity verification: QQI (quantitative quality indicator), Ketos ring, test ring. Demagnetization verification: residual field ≤3 Gauss. Personnel certification per NAS 410/SNT-TC-1A.",
         None, []),
        ("ASTM E165/E165M — Liquid Penetrant Testing", "Standard practice for liquid penetrant examination",
         "ASTM E165/E165M defines standard practice for liquid penetrant testing (PT): Type I fluorescent / Type II visible, Method A water washable / Method B post-emulsifiable lipophilic / Method C solvent removable / Method D post-emulsifiable hydrophilic. Covers surface preparation, penetrant application, dwell time (5-60 min based on material/defect type), excess penetrant removal, developer application, inspection, post-cleaning. Reference standard: TAM panel, nickel-chrome comparator block.",
         None, []),
        ("ASTM B117 — Salt Spray (Fog) Testing", "Standard practice for salt spray corrosion testing",
         "ASTM B117 establishes procedures for salt spray (fog) testing to evaluate relative corrosion resistance of metallic materials with or without coatings. Test conditions: 5% NaCl solution, 35°C chamber temperature, continuous fog exposure. Specimen preparation, positioning (15-30° from vertical), duration (per specification — typically 24-2000+ hours). Evaluation per ASTM D1654 (scribe failure) or ASTM B537 (rating of coated specimens). Not predictive of real-world performance — comparative test only.",
         None, []),
        ("ASTM A967/A380 — Passivation of Stainless Steel", "Passivation and cleaning of stainless steel parts",
         "ASTM A967 covers passivation treatments for stainless steel parts: nitric acid (20-50% concentration, 20-60 min, 70-140°F), citric acid (4-10% concentration, various temperatures), electropolishing. Pre-cleaning per ASTM A380 (degreasing, descaling, removal of free iron). Acceptance testing: copper sulfate test (ASTM A967 Practice E), high humidity test (Practice B), salt spray test (Practice C), free iron test (ferroxyl — ASTM A380). Critical for aerospace components requiring corrosion resistance.",
         None, []),
        ("ASTM E466 — Axial Force Controlled Fatigue", "Standard practice for conducting force-controlled fatigue tests",
         "ASTM E466 covers constant-amplitude axial fatigue testing of metallic materials: specimen design (uniform gauge, hourglass, button-head), loading parameters (maximum force, minimum force, stress ratio R, frequency), alignment requirements (<5% bending), test termination criteria (failure or runout at defined cycle count). S-N curve generation for design allowables. Related standards: E606 (strain-controlled), E647 (fatigue crack growth rate da/dN). Critical for aerospace structural materials characterization and design allowable development.",
         None, []),
     ]),

    # ── ASME Y14.5 ──
    ("ASME Y14.5 — GD&T", "asme_y14",
     ["Engineering", "Manufacturing & Operations"],
     "2019-02-01",
     [
        ("Geometric Dimensioning and Tolerancing", "GD&T per ASME Y14.5-2018 standard",
         "ASME Y14.5-2018 defines GD&T symbols and rules for engineering drawings. Geometric characteristics: form (flatness, straightness, circularity, cylindricity), orientation (perpendicularity, angularity, parallelism), location (position, concentricity, symmetry), runout (circular, total), profile (surface, line). Datum reference frames: primary/secondary/tertiary datums, datum features, datum targets. Material condition modifiers: MMC (Ⓜ), LMC (Ⓛ), RFS (default). Rule #1: envelope principle for size features.",
         None, [
            ("Positional Tolerance", "True position tolerancing and bonus tolerance calculations",
             "Position tolerance defines a zone within which the center/axis/center plane of a feature is permitted to vary from true position. Cylindrical tolerance zone for holes (diameter in feature control frame). Bonus tolerance with MMC: actual mating envelope departure from MMC adds to stated tolerance. Composite position: upper segment = pattern location, lower segment = feature-to-feature. Fixed/floating fastener formulas: T = H - F (fixed), 2T = H - F (floating)."),
            ("Profile Tolerance", "Profile of surface and line tolerancing applications",
             "Profile tolerance establishes a uniform boundary along true profile. Bilateral equal (default), bilateral unequal, unilateral. Applied to: complex contours, irregular shapes, surfaces requiring form + orientation + location control. Composite profile: upper = profile location, lower = profile form. All-around symbol (circle at leader junction) applies profile to all surfaces in the view. All-over applies to entire part surface."),
        ]),
        ("Datum Reference Frames", "Establishment, degrees of freedom, simultaneous requirements",
         "Datum reference frame (DRF) establishes coordinate system for measurements. Primary datum constrains 3 DOF (rotation), secondary constrains 2 DOF (rotation + translation), tertiary constrains 1 DOF (translation). Datum features: actual part surfaces used to establish datums. Datum targets: specified points/lines/areas on datum features. Simultaneous requirements: features referencing same DRF treated as single pattern unless noted SEPARATELY. Customized datum reference frames using movable/fixed datum targets for complex geometry.",
         None, []),
        ("Form Tolerances", "Flatness, straightness, circularity, cylindricity — when and how to apply",
         "Form tolerances control the shape of individual features independent of datums. Flatness: surface must lie between two parallel planes (applied to planar surfaces, sealing surfaces). Straightness: line element or derived median line must lie within a tolerance zone (applied to cylindrical features, edges). Circularity: cross-sectional elements must lie between two concentric circles (applied to spheres, cylinders, cones). Cylindricity: entire surface must lie between two coaxial cylinders (combines circularity, straightness, and taper control). No datum reference needed — form tolerances are self-referencing.",
         None, []),
        ("Runout Tolerances", "Circular vs total runout, application to rotating parts",
         "Runout tolerances control relationship of features to a datum axis. Circular runout: each circular element individually must not exceed tolerance when rotated 360° about datum axis (applies to surfaces perpendicular or at angle to axis). Total runout: entire surface simultaneously must not exceed tolerance during full rotation with indicator traversing along/across surface (controls circularity + straightness + taper + coaxiality). Applications: bearing journals, seal surfaces, gear bores, turbine shafts. Always requires datum axis reference.",
         None, []),
        ("Y14.100 — Engineering Drawing Practices", "Drawing types, revision control, notes and formats",
         "ASME Y14.100 establishes requirements for engineering drawing practices: drawing types (detail, assembly, installation, schematic), sheet sizes/format per Y14.1, title block content, revision history block, general notes (tolerances, material specs, finish requirements), parts lists/BOM, zone system for locating features. Revision control: letter-based (A, B, C...), revision status tracking, revision history documentation. Supersedes cancelled portions of MIL-STD-100.",
         None, []),
        ("Y14.41 — Digital Product Definition / MBD", "Model-based definition for 3D product data",
         "ASME Y14.41 establishes requirements for digital product definition using 3D model-based definition (MBD). Model must contain complete product definition: geometric shape, dimensions, tolerances (GD&T per Y14.5), annotations, supplemental geometry, material/process notes. Display requirements: saved views, annotation planes, visibility controls. Data quality: geometric accuracy, model validation, archival format (STEP AP242, QIF). Enables drawing-less manufacturing when fully implemented. Supports digital thread/digital twin concepts.",
         None, []),
     ]),

    # ── NAS 410 ──
    ("NAS 410 — NDT Personnel Qualification", "nas410",
     ["Manufacturing & Operations", "Administrative & Support"],
     "2021-06-01",
     [
        ("NDT Personnel Certification", "NAS 410 / EN 4179 NDT operator qualification requirements",
         "NAS 410 (harmonized with EN 4179) establishes qualification and certification requirements for NDT personnel in aerospace. Three levels: Level 1 (perform tests under Level 2/3 direction), Level 2 (set up/calibrate equipment, interpret/evaluate results, prepare procedures, train Level 1), Level 3 (develop procedures/techniques, interpret codes/standards, technical authority). Methods: MT, PT, UT, RT, ET, VT, and emerging methods.",
         None, [
            ("Training and Examination Requirements", "Hours and exam requirements by NDT method and level",
             "Minimum training hours vary by method and level. Example (UT): Level 1 = 40 hrs classroom + 210 hrs OJT, Level 2 = 40 hrs classroom + 630 hrs OJT. General/specific/practical examinations required. Written exams: 40 questions minimum, 80% passing score. Practical exams: demonstrate proficiency on actual parts. Re-examination allowed after additional training. Annual visual acuity exam (Jaeger J1 at 12 inches, color perception). Certification valid for 5 years, renewal by exam or continued satisfactory performance."),
        ]),
        ("Method-Specific Requirements", "RT, ET, VT specifics — equipment, technique, interpretation",
         "Method-specific requirements beyond general NAS 410: Radiographic Testing (RT) — radiation safety officer designation, dosimetry, source handling, darkroom/digital processing, film/image interpretation skills. Eddy Current Testing (ET) — impedance plane understanding, frequency selection, probe types, reference standard fabrication. Visual Testing (VT) — aided/unaided examination, lighting requirements (min 100 fc), magnification tools, surface condition assessment, acceptance criteria interpretation. Each method requires separate qualification and certification.",
         None, []),
        ("Written Practice Requirements", "Employer's written practice — scope, content, approval authority",
         "Each employer must maintain a written practice defining their NDT certification program: scope (methods/techniques covered), responsibility assignments (Level 3 technical authority, management approval), education/training/experience requirements (minimum per NAS 410 + employer additions), examination content and administration, certification/recertification procedures, documentation/record requirements, interruption-in-service provisions (>180 days requires re-demonstration). Must be reviewed/approved by Level 3 and authorized management.",
         None, []),
        ("Recertification", "Performance-based vs exam renewal, lapse procedures",
         "Recertification options: (1) Re-examination (written general + specific + practical) at 5-year intervals, or (2) performance-based (documented evidence of continued satisfactory performance + current visual acuity). Lapse provisions: certification lapses if recertification not completed by expiration date. If lapsed <180 days, may recertify by examination only. If lapsed >180 days, must complete additional training + re-examination. Employer may impose more stringent requirements. Records retained for duration of certification + one certification period.",
         None, []),
     ]),
]


def _get_pg_dsn() -> str:
    """Get PostgreSQL connection string from environment or config defaults."""
    from app.config import settings
    url = settings.database_url
    # Convert asyncpg URL to psycopg2 format
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    return url


def seed_regulatory(force: bool = False):
    """Insert regulatory neurons into existing database.

    Args:
        force: If True, delete all existing Regulatory neurons and re-seed.
    """
    dsn = _get_pg_dsn()
    conn = psycopg2.connect(dsn)
    cursor = conn.cursor()

    # Ensure standard_date column exists
    cursor.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'neurons' AND column_name = 'standard_date'"
    )
    if not cursor.fetchone():
        cursor.execute("ALTER TABLE neurons ADD COLUMN standard_date VARCHAR(20)")
        conn.commit()
        print("Migrated: added neurons.standard_date (sync)")

    # Check if Regulatory department already exists
    cursor.execute("SELECT COUNT(*) FROM neurons WHERE department = %s", (DEPARTMENT,))
    existing = cursor.fetchone()[0]

    if existing > 0 and not force:
        print(f"Regulatory department already has {existing} neurons — skipping")
        conn.close()
        return existing

    if existing > 0 and force:
        print(f"Force re-seed: deleting {existing} existing Regulatory neurons")
        cursor.execute("DELETE FROM neurons WHERE department = %s", (DEPARTMENT,))

    created = 0

    # L0: Department
    cursor.execute(
        "INSERT INTO neurons (layer, node_type, label, department, summary, created_at_query_count) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (0, "department", DEPARTMENT, DEPARTMENT, f"Department: {DEPARTMENT}", 0),
    )
    dept_id = cursor.fetchone()[0]
    created += 1

    for role_label, role_key, cross_ref_depts, standard_date, tasks in REGULATORY_TREE:
        # L1: Role (standard family)
        cursor.execute(
            "INSERT INTO neurons (parent_id, layer, node_type, label, role_key, department, summary, cross_ref_departments, standard_date, created_at_query_count) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (dept_id, 1, "role", role_label, role_key, DEPARTMENT,
             f"Role: {role_label} in {DEPARTMENT}",
             _cross_ref(cross_ref_depts), standard_date, 0),
        )
        role_id = cursor.fetchone()[0]
        created += 1

        for task_entry in tasks:
            task_label, task_summary, task_content, task_cross_ref, systems = task_entry
            cursor.execute(
                "INSERT INTO neurons (parent_id, layer, node_type, label, role_key, department, summary, content, cross_ref_departments, created_at_query_count) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (role_id, 2, "task", task_label, role_key, DEPARTMENT,
                 task_summary, task_content,
                 _cross_ref(task_cross_ref) if task_cross_ref else None, 0),
            )
            task_id = cursor.fetchone()[0]
            created += 1

            for sys_label, sys_summary, sys_content in systems:
                cursor.execute(
                    "INSERT INTO neurons (parent_id, layer, node_type, label, role_key, department, summary, content, created_at_query_count) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (task_id, 3, "system", sys_label, role_key, DEPARTMENT,
                     sys_summary, sys_content, 0),
                )
                created += 1

    conn.commit()
    conn.close()
    print(f"Seeded {created} regulatory neurons")
    return created


if __name__ == "__main__":
    seed_regulatory()
