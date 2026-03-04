"""
Bolster: Add applicable standards references to all Manufacturing Engineer neurons.

Appends standards references (AS9100, AS9145, SAE, NADCAP, ISO, OSHA, etc.)
to existing content fields. Non-destructive — only appends, never overwrites.

Usage:
    cd ~/Projects/yggdrasil/backend
    source venv/bin/activate
    python bolster_mfg_standards.py
"""

import asyncio
from sqlalchemy import text
from app.database import async_session

# Map: neuron_id → standards text to append
# Only neurons with content get bolstered (L3 systems, L4 decisions, L5 outputs)
STANDARDS = {
    # ── Manufacturing Strategy & Planning ──
    697: (
        "Standards references: SAE AS6500 (Manufacturing Management Program — "
        "strategic manufacturing planning requirements); AS9100D Section 4.1 "
        "(Context of the Organization — understanding internal/external factors "
        "affecting manufacturing strategy); AS9100D Section 6.2 (Quality Objectives "
        "and Planning — aligning manufacturing goals with quality system); "
        "SAE J4000/J4001 (Lean Manufacturing Assessment — strategic lean maturity "
        "benchmarking for manufacturing systems)."
    ),
    698: (
        "Standards references: AS9100D Section 6.1 (Actions to Address Risks and "
        "Opportunities — risk-based planning methodology); AS9145 Section 4 "
        "(APQP Planning Phase — structured planning process for product quality); "
        "SAE AS6500 Section 4 (Manufacturing Management Planning — formal planning "
        "process requirements); AS9100D Section 8.1 (Operational Planning and Control "
        "— planning for product realization)."
    ),
    699: (
        "Standards references: SAE J4000 (Lean Manufacturing Assessment — "
        "manufacturing system maturity criteria from traditional to lean/flexible); "
        "SAE AS6500 (Manufacturing Management Program — system evolution and "
        "capability development requirements); AS9100D Section 8.5.6 (Control of "
        "Changes — managing transitions between manufacturing system states)."
    ),
    700: (
        "Standards references: AS9100D Section 8.1 (Operational Planning and Control "
        "— capacity and resource planning for production); AS9145 Section 5 "
        "(Product Design and Development — capacity validation during APQP); "
        "SAE AS6500 Section 5 (Manufacturing Capability — capacity assessment "
        "and planning requirements); AIAG APQP Section 2.13 (Preliminary Process "
        "Capability Study Plan)."
    ),

    # ── Manufacturing Investment Analysis ──
    702: (
        "Standards references: SAE AS6500 Section 4.3 (Manufacturing Risk Assessment "
        "— modeling and simulation for risk identification); AS9100D Section 6.1 "
        "(Actions to Address Risks and Opportunities — systematic risk evaluation "
        "for manufacturing investments); ISA-95 (Enterprise-Control System "
        "Integration — reference architecture for modeling manufacturing systems)."
    ),
    703: (
        "Standards references: SAE AS6500 Section 4.2 (Manufacturing Cost Analysis "
        "— financial evaluation of manufacturing alternatives); AS9100D Section 7.1.1 "
        "(Resources — General — determining resources needed for manufacturing "
        "operations); FAR 15.407-4 (Should-Cost Reviews — government contract "
        "investment analysis methodology)."
    ),
    704: (
        "Standards references: AS9100D Section 6.1 (Actions to Address Risks and "
        "Opportunities — risk-based decision making under uncertainty); AS9145 "
        "Section 7.3 (Risk Analysis — APQP risk assessment methods); SAE ARP4761 "
        "(Safety Assessment Process — probabilistic risk analysis techniques "
        "applicable to manufacturing investment decisions)."
    ),
    705: (
        "Standards references: SAE AS6500 Section 4 (Manufacturing Management "
        "Planning — justification framework for manufacturing technology investment); "
        "AS9100D Section 7.1.6 (Organizational Knowledge — capturing institutional "
        "knowledge to support investment decisions); AIAG APQP Section 1.12 "
        "(Management Support — securing commitment for manufacturing investments)."
    ),

    # ── Cost Estimating & Control ──
    707: (
        "Standards references: FAR Part 31 (Contract Cost Principles — allowable cost "
        "definitions for government manufacturing contracts); CAS 401-420 (Cost "
        "Accounting Standards — cost allocation and accumulation requirements); "
        "SAE AS6500 Section 4.2 (Manufacturing Cost Analysis — cost structure "
        "requirements); AS9100D Section 7.1.1 (Resources — cost planning for "
        "quality system operations)."
    ),
    708: (
        "Standards references: CAS 401 (Consistency in Estimating, Accumulating, and "
        "Reporting Costs); CAS 402 (Consistency in Allocating Costs); CAS 418 "
        "(Allocation of Direct and Indirect Costs); FAR 42.302 (Contract "
        "administration — budget monitoring and cost surveillance)."
    ),
    709: (
        "Standards references: FAR 15.404 (Proposal Analysis — cost estimating "
        "requirements for government contracts); CAS 401 (Consistency in Estimating "
        "— estimate methodology must match accumulation practice); SAE AS6500 "
        "Section 4.2 (Manufacturing Cost Analysis — cost estimating process "
        "requirements); AIAG APQP Section 1.11 (Cost/Timing/Quality Feasibility)."
    ),
    710: (
        "Standards references: MIL-HDBK-1547 (Electronic Parts and Assemblies — "
        "learning curve application guidance); FAR 15.404-1(b)(2) (Price Analysis "
        "— learning curve adjustments for production quantities); SAE AS6500 "
        "Section 5.4 (Production Readiness — learning curve integration with "
        "manufacturing maturity assessments)."
    ),
    711: (
        "Standards references: FAR 15.404-1(b) (Price Analysis Techniques — "
        "parametric and computer-assisted estimating methods); SAE AS6500 "
        "Section 4.2 (Manufacturing Cost Analysis — computer-aided cost tools); "
        "EIA-632 (Processes for Engineering a System — cost modeling integration "
        "with systems engineering)."
    ),

    # ── Manufacturing Control Systems ──
    713: (
        "Standards references: AS9100D Section 8.5.1 (Control of Production and "
        "Service Provision — manufacturing process control requirements); AS9100D "
        "Section 9.1 (Monitoring, Measurement, Analysis and Evaluation — "
        "manufacturing performance feedback); SAE AS6500 Section 5.1 "
        "(Manufacturing Process Control — process monitoring and correction)."
    ),
    714: (
        "Standards references: AS9100D Section 8.5.1(d) (Infrastructure and "
        "Environment — MRP/ERP system requirements for production control); "
        "ISA-95 / IEC 62264 (Enterprise-Control System Integration — MES/MRP "
        "integration architecture); SAE AS6500 Section 5.2 (Production Planning "
        "and Scheduling — MRP execution requirements)."
    ),
    715: (
        "Standards references: SAE J4000 (Identification and Measurement of Best "
        "Practice in Implementation of Lean Operation — JIT/TQM assessment criteria); "
        "AS9100D Section 8.5 (Production and Service Provision — integrated control "
        "requirements); ISO 9001:2015 Section 0.3 (Process Approach — control "
        "paradigm for quality management systems)."
    ),
    716: (
        "Standards references: ISA-95 / IEC 62264 (Enterprise-Control System "
        "Integration — smart manufacturing architecture); MTConnect (Manufacturing "
        "Equipment Monitoring — real-time data collection standard); OPC UA / "
        "IEC 62541 (Unified Architecture — industrial interoperability for "
        "manufacturing control); MESA MOM (Manufacturing Operations Management "
        "— MES reference model)."
    ),

    # ── Management of Manufacturing Technology ──
    718: (
        "Standards references: SAE AS6500 Section 4.1 (Manufacturing Technology "
        "Management — technology lifecycle requirements); AS9100D Section 7.1.6 "
        "(Organizational Knowledge — managing manufacturing technology knowledge); "
        "DoD Manufacturing Readiness Level (MRL) Deskbook (technology maturity "
        "assessment framework)."
    ),
    719: (
        "Standards references: DoD MRL Deskbook (Manufacturing Readiness Levels "
        "1-10 — technology maturity assessment criteria); NASA TRL Scale (Technology "
        "Readiness Levels — complementary technology assessment); SAE AS6500 "
        "Section 4.1 (Manufacturing Technology Assessment — readiness evaluation "
        "requirements); AS9145 Section 3.1 (Product/Process Planning — technology "
        "assessment in APQP context)."
    ),
    720: (
        "Standards references: SAE AS6500 Section 4.4 (Manufacturing System "
        "Specification — technology specification development); AS9100D Section 8.4 "
        "(Control of Externally Provided Processes — vendor technology evaluation); "
        "AS9100D Section 8.3.5 (Design and Development Outputs — technology "
        "verification requirements)."
    ),
    721: (
        "Standards references: SAE AS6500 Section 5.4 (Production Readiness Reviews "
        "— technology deployment verification); AS9100D Section 8.3.4 (Design and "
        "Development Controls — stage-gate reviews for technology implementation); "
        "AS9145 Section 7 (Product/Process Validation — technology acceptance "
        "testing); ASTM E2500 (Specification, Design, and Verification of "
        "Pharmaceutical and Biopharmaceutical Manufacturing Systems — IQ/OQ/PQ "
        "methodology applicable to manufacturing technology deployment)."
    ),

    # ── Design for Manufacture ──
    723: (
        "Standards references: AS9100D Section 8.3.3 (Design and Development Inputs "
        "— manufacturing feasibility as design input); AS9145 Section 4.2 "
        "(Cross-Functional Team — concurrent engineering requirement for "
        "manufacturing participation in design); SAE AS6500 Section 3.1 "
        "(Product/Process Integration — manufacturing involvement in design process); "
        "ASME Y14.5 (GD&T — dimensioning and tolerancing for manufacturability)."
    ),
    724: (
        "Standards references: AS9100D Section 8.3.5 (Design and Development Outputs "
        "— manufacturing and assembly requirements); AS9145 Section 5.4 "
        "(Manufacturability Assessment — DFM imperatives evaluation in APQP); "
        "SAE AS6500 Section 3.2 (Design for Manufacturing and Assembly — DFM "
        "process requirements); MIL-HDBK-727 (Design Guidance for Producibility)."
    ),
    725: (
        "Standards references: AIAG DFMEA Reference Manual (Design FMEA — "
        "quantitative manufacturing risk evaluation); AS9145 Section 5.5 (Design "
        "Verification — quantitative DFM verification methods); SAE AS6500 "
        "Section 3.2 (DFM Assessment — systematic evaluation criteria); "
        "ASME Y14.5 (GD&T — tolerancing for assembly efficiency analysis)."
    ),
    726: (
        "Standards references: AS9103 (Variation Management of Key Characteristics "
        "— statistical methods for reducing manufacturing variation); AIAG SPC "
        "Reference Manual (Statistical Process Control — process variation "
        "analysis techniques); AS9100D Section 8.5.1(f) (Validation of Special "
        "Processes — robust process parameter validation)."
    ),
    727: (
        "Standards references: AS9100D Section 8.3.2 (Design and Development "
        "Planning — integration of CAD/CAM/CAPP tools); SAE AS6500 Section 3.1 "
        "(Product/Process Integration — computer-aided DFM tool requirements); "
        "ISO 10303 / STEP AP242 (Product Data Exchange — CAD/CAM data "
        "interoperability for DFM analysis); EIA-649-1 (Configuration Management "
        "— DFM change control)."
    ),

    # ── Manufacturing Standards & Certification ──
    729: (
        "Standards references: ANSI Essential Requirements (Due Process for "
        "American National Standards — standards development procedures); "
        "ISO/IEC Directives (Rules for Structure and Drafting of International "
        "Standards); SAE Technical Standards Board Operating Procedures; "
        "ASTM Regulations Governing ASTM Technical Committees — committee "
        "participation and ballot procedures."
    ),
    730: (
        "Standards references: AS9100D (Aerospace QMS — primary aerospace "
        "manufacturing certification); AS9110C (MRO QMS — maintenance and "
        "repair operations); AS9120B (Aerospace Distributor QMS); IATF 16949 "
        "(Automotive QMS); NADCAP AC7004 (Welding), AC7101 (NDT), AC7102 "
        "(Heat Treating), AC7108 (Chemical Processing), AC7109 (Coatings); "
        "ISO 9001:2015 (Foundation QMS — basis for sector-specific standards); "
        "CE Marking Directives (EU Conformity — Machinery Directive 2006/42/EC)."
    ),
    731: (
        "Standards references: AS9100D Section 7.5 (Documented Information — "
        "standards library and document control requirements); AS9100D "
        "Section 8.5.1(a) (Documented Procedures and Work Instructions — "
        "internal process specification requirements); SAE AS6500 Section 6 "
        "(Process Documentation — company manufacturing standards program); "
        "NADCAP Process Specifications (requirements for maintaining special "
        "process accreditation documentation)."
    ),

    # ── Just-in-Time Manufacturing ──
    733: (
        "Standards references: SAE J4000 (Identification and Measurement of Best "
        "Practice in Implementation of Lean Operation — JIT readiness criteria and "
        "6 elements of lean assessment); SAE J4001 (Implementation of Lean "
        "Operation User Manual — detailed assessment procedures); AS9100D "
        "Section 8.5.1 (Control of Production — waste elimination in production "
        "operations); ISO 9001:2015 Section 10.3 (Continual Improvement)."
    ),
    734: (
        "Standards references: SAE J4000 Element 5 (Manufacturing Operations — "
        "setup reduction and cellular manufacturing criteria); SAE J4001 "
        "Component 5.3 (Setup/Changeover Time Reduction — SMED assessment); "
        "AS9100D Section 8.5.1(e) (Process Validation — validating flow changes "
        "and setup reductions); AIAG CQI-17 (Soldering Process Assessment — "
        "example of process-specific flow optimization standard)."
    ),
    735: (
        "Standards references: SAE J4000 Element 6 (Supply Chain — pull system "
        "and kanban assessment criteria); SAE J4001 Component 6.4 (Supplier "
        "Delivery Performance — JIT delivery requirements); AS9100D Section 8.4 "
        "(Control of Externally Provided Processes — supplier JIT integration); "
        "AIAG MMOG/LE (Materials Management Operations Guideline — supply chain "
        "pull system assessment)."
    ),
    736: (
        "Standards references: SAE J4000 Element 1 (Management/Trust — continuous "
        "improvement leadership); SAE J4001 Component 1.7 (Kaizen/CI Program — "
        "structured improvement methodology); AS9100D Section 10.3 (Continual "
        "Improvement — QMS improvement requirements); AS13000 Series (Problem "
        "Solving — AS13003 measurement, AS13004 process control methods for "
        "JIT quality improvement)."
    ),

    # ── Computer-Integrated Manufacturing ──
    738: (
        "Standards references: ISA-95 / IEC 62264 (Enterprise-Control System "
        "Integration — CIM reference architecture); ISO 10303 / STEP (Product "
        "Data Exchange — CAD/CAM/CAPP data lifecycle management); MTConnect "
        "(Manufacturing Equipment Monitoring — data collection standard for "
        "CIM systems); SAE AS6500 Section 5.3 (Manufacturing System Integration "
        "— CIM system requirements)."
    ),
    739: (
        "Standards references: ISO 10303 AP242 (Managed Model-Based 3D "
        "Engineering — CAD/CAE data exchange); ISO 14649 / STEP-NC (CNC Data "
        "Model — intelligent CNC programming standard); ISO 10218 (Robotics "
        "Safety — safety requirements for industrial robots); SAE AS6500 "
        "Section 5.3 (Manufacturing System Integration — CNC/FMS/AGV "
        "integration requirements)."
    ),
    740: (
        "Standards references: OPC UA / IEC 62541 (Unified Architecture — "
        "industrial communication protocol for CIM integration); MTConnect "
        "(Manufacturing Data Exchange — equipment interoperability); ISO 10303 "
        "STEP AP203/AP242 (Product Data Exchange — geometry and PMI transfer); "
        "IEEE 802 (Network Standards — manufacturing network infrastructure); "
        "IEC 62264 / ISA-95 (Enterprise-Control Integration — MES/ERP "
        "communication architecture)."
    ),
    741: (
        "Standards references: SAE AS6500 Section 4 (Manufacturing Management "
        "Planning — CIM strategic planning requirements); AS9100D Section 7.1.3 "
        "(Infrastructure — CIM system infrastructure requirements); DoD MRL "
        "Deskbook Thread 9 (Manufacturing Management — CIM maturity assessment); "
        "MESA MOM (Manufacturing Operations Management — MES implementation "
        "planning reference model)."
    ),

    # ── Facilities Planning & Plant Layout ──
    743: (
        "Standards references: AS9100D Section 7.1.3 (Infrastructure — facility "
        "requirements for manufacturing operations); AS9100D Section 7.1.4 "
        "(Environment for Operation of Processes — facility environment control); "
        "SAE AS6500 Section 5.5 (Facilities and Equipment — layout requirements "
        "for manufacturing process flow); OSHA 29 CFR 1910.22 (Walking-Working "
        "Surfaces — aisle and workspace requirements)."
    ),
    744: (
        "Standards references: SAE AS6500 Section 5.5 (Facilities and Equipment "
        "— computer-aided facility planning integration); ISA-95 / IEC 62264 "
        "(Enterprise-Control Integration — material flow modeling architecture); "
        "AS9100D Section 8.1 (Operational Planning — facility layout as part "
        "of manufacturing planning)."
    ),
    745: (
        "Standards references: ISO 50001 (Energy Management Systems — systematic "
        "energy management for manufacturing); AS9100D Section 7.1.3 "
        "(Infrastructure — energy-efficient facility infrastructure); "
        "ISO 14001 Section 6.1.2 (Environmental Aspects — energy consumption "
        "as significant environmental aspect); DOE SEP (Superior Energy "
        "Performance — manufacturing energy efficiency certification)."
    ),
    746: (
        "Standards references: ISO 14001 (Environmental Management Systems — "
        "environmental compliance framework for manufacturing); AS9100D "
        "Section 8.5.4 (Preservation — environmental controls for product "
        "preservation); EPA 40 CFR (Environmental Protection Regulations — "
        "air emissions, water discharge, hazardous waste); RCRA (Resource "
        "Conservation and Recovery Act — manufacturing waste management); "
        "OSHA 29 CFR 1910.1200 (Hazard Communication — chemical management)."
    ),

    # ── Equipment Planning & Maintenance ──
    748: (
        "Standards references: SAE AS6500 Section 5.5 (Facilities and Equipment "
        "— equipment selection criteria and qualification); AS9100D Section 7.1.5 "
        "(Monitoring and Measuring Resources — equipment calibration and capability "
        "requirements); AS9100D Section 8.4.1 (External Provision — vendor/OEM "
        "equipment assessment); ASTM E2500 (Equipment Specification, Design, "
        "and Verification — commissioning methodology)."
    ),
    749: (
        "Standards references: SAE AS6500 Section 5.5 (Facilities and Equipment "
        "— equipment grouping and cell design); AS9100D Section 8.5.1(d) "
        "(Infrastructure — manufacturing cell requirements); SAE J4000 "
        "Element 5 (Manufacturing Operations — cellular manufacturing and "
        "group technology assessment criteria)."
    ),
    750: (
        "Standards references: ANSI/ITSDF B56.1 (Safety Standard for Low Lift "
        "and High Lift Trucks — AGV/forklift requirements); SAE AS6500 "
        "Section 5.5 (Material Handling — material handling system integration); "
        "AS9100D Section 8.5.4 (Preservation — material handling and protection "
        "during manufacturing); OSHA 29 CFR 1910.176 (Handling Materials — "
        "general material handling safety requirements); ISO 10218 (Robotics "
        "Safety — robotic material handling safety)."
    ),
    751: (
        "Standards references: ASTM E2500 (Specification, Design, and "
        "Verification of Manufacturing Systems — IQ/OQ/PQ qualification "
        "protocol); AS9100D Section 7.1.3 (Infrastructure — installation and "
        "infrastructure qualification); SAE AS6500 Section 5.4 (Production "
        "Readiness — equipment commissioning and qualification requirements); "
        "AS9100D Section 8.5.1(f) (Validation of Processes — special process "
        "equipment validation)."
    ),
    752: (
        "Standards references: SAE JA1011 (Evaluation Criteria for RCM — "
        "reliability-centered maintenance methodology); SAE JA1012 (Guide to "
        "RCM Standard — implementation guidance); SAE AS6500 Section 5.5 "
        "(Equipment Maintenance — maintenance program requirements); AS9100D "
        "Section 7.1.3 (Infrastructure — maintenance of manufacturing "
        "infrastructure); SAE J4000 Element 5 (Manufacturing Operations — TPM "
        "assessment criteria)."
    ),

    # ── Production Planning & Control ──
    754: (
        "Standards references: AS9100D Section 8.1 (Operational Planning and "
        "Control — demand planning as input to production planning); AIAG MMOG/LE "
        "(Materials Management Operations Guideline — demand management and "
        "forecasting requirements); APICS/ASCM CPIM Body of Knowledge "
        "(Production Planning — forecasting methodologies); SAE AS6500 "
        "Section 5.2 (Production Planning — demand-based planning requirements)."
    ),
    755: (
        "Standards references: AS9100D Section 8.1 (Operational Planning — "
        "master scheduling as part of production planning); SAE AS6500 "
        "Section 5.2 (Production Planning and Scheduling — master schedule "
        "requirements); AIAG MMOG/LE Chapter 3 (Production and Scheduling — "
        "capacity planning assessment); AS9145 Section 5 (Process Design — "
        "capacity validation in APQP)."
    ),
    756: (
        "Standards references: AS9100D Section 7.1.1 (Resources — capacity "
        "determination requirements); SAE AS6500 Section 5.2 (Production "
        "Planning — capacity planning and bottleneck management); AS9100D "
        "Section 8.4.3 (Information for External Providers — purchased parts "
        "planning requirements); SAE J4000 Element 4 (Product/Process "
        "Development — capacity validation criteria)."
    ),
    757: (
        "Standards references: AS9100D Section 8.5.1 (Control of Production — "
        "shop floor control and production activity requirements); SAE AS6500 "
        "Section 5.2 (Production Scheduling — dispatching and priority rules); "
        "AS9100D Section 8.5.2 (Identification and Traceability — production "
        "tracking and reporting); ISA-95 Level 3 (Manufacturing Operations "
        "Management — shop floor scheduling and execution)."
    ),

    # ── Existing reparented chain: Process Planning (97-100) ──
    99: (
        "Standards references: AS9100D Section 8.5.1(f) (Validation of Processes "
        "— special process capability validation); AS9103 (Variation Management "
        "of Key Characteristics — Cpk/Ppk targets for key features); AS9145 "
        "Section 6 (Process Design and Development — manufacturing method "
        "selection and validation); AIAG PPAP (Production Part Approval Process "
        "— process capability demonstration); AIAG SPC Reference Manual "
        "(Statistical Process Control — capability index calculation); NADCAP "
        "checklists (special process capability requirements per process type)."
    ),
    100: (
        "Standards references: AS9100D Section 8.5.1 (Control of Production — "
        "manufacturing plan documentation requirements); AS9145 Section 6.3 "
        "(Process Flow Diagram) and 6.5 (Control Plan — manufacturing plan "
        "structure); AS9102 (First Article Inspection — FAI requirements for "
        "new manufacturing plans); NADCAP AC7004 (Welding), AC7101 (NDT), "
        "AC7108 (Chemical Processing) — special process callout requirements; "
        "SAE AS6500 Section 5.1 (Process Documentation — manufacturing plan "
        "content requirements); ASME Y14.100 (Engineering Drawing Practices — "
        "drawing references in process sheets)."
    ),

    # ── Existing reparented chain: Composite Fabrication (101-104) ──
    103: (
        "Standards references: AS9100D Section 8.5.1(f) (Validation of Special "
        "Processes — composite cure process validation); NADCAP AC7118 "
        "(Composites — composite fabrication accreditation); SAE AMS "
        "specifications (e.g., AMS 3892 — carbon fiber prepreg material "
        "specifications); ASTM D5528/D7136/D7264 (Composite Test Methods — "
        "laminate characterization); AS9103 (Variation Management — cure "
        "parameter key characteristics control)."
    ),
    104: (
        "Standards references: AS9100D Section 8.5.2 (Identification and "
        "Traceability — material lot traceability in composite travelers); "
        "NADCAP AC7118 (Composites — fabrication process accreditation "
        "requirements); NAS 410 / EN 4179 (NDT Personnel Certification — "
        "Level II/III requirements for NDI methods); ASNT SNT-TC-1A "
        "(Personnel Qualification — NDT operator certification); AS9102 "
        "(First Article Inspection — composite part FAI requirements); "
        "ASTM E2580 (Ultrasonic Testing of Flat Panel Composites); "
        "SAE ARP5606 (Composite Honeycomb NDI)."
    ),

    # ── Manufacturing Materials Management ──
    759: (
        "Standards references: AS9100D Section 8.5.4 (Preservation — inventory "
        "storage and handling requirements); SAE AS6081 (Counterfeit Electronic "
        "Parts — inventory control for suspect parts avoidance); SAE AS6500 "
        "Section 5.6 (Material Control — inventory management requirements); "
        "AIAG MMOG/LE (Materials Management Operations Guideline — inventory "
        "management assessment); SAE J4000 Element 6 (Supply Chain — JIT "
        "inventory assessment criteria)."
    ),
    760: (
        "Standards references: AS9100D Section 8.4 (Control of Externally "
        "Provided Processes — supplier evaluation and selection requirements); "
        "AS9100D Section 8.4.1 (External Providers — process capability "
        "assessment of suppliers); AS9145 Section 4.4 (Supplier APQP — "
        "supplier quality planning requirements); SAE AS6081 (Fraudulent/"
        "Counterfeit Parts — supplier authentication requirements); SAE AS6174 "
        "(Counterfeit Materiel Risk Mitigation — supplier qualification); "
        "NADCAP supplier accreditation requirements (special process supplier "
        "qualification)."
    ),
    761: (
        "Standards references: AS9100D Section 8.6 (Release of Products — "
        "incoming inspection and acceptance requirements); AS9100D Section 8.5.2 "
        "(Identification and Traceability — material identification and lot "
        "tracking); ANSI/ASQ Z1.4 (Sampling Procedures for Inspection by "
        "Attributes — incoming sampling plans); ANSI/ASQ Z1.9 (Sampling "
        "Procedures for Inspection by Variables); SAE AS6081 (Counterfeit "
        "Parts Prevention — receiving inspection for suspect parts); "
        "SAE AS6171 (Test Methods for Suspect/Counterfeit Parts); "
        "AS9100D Section 8.5.4 (Preservation — storage condition requirements)."
    ),
    762: (
        "Standards references: SAE J4000 Element 5 (Manufacturing Operations "
        "— repetitive/flow manufacturing assessment); SAE J4001 Component 5.6 "
        "(Material Presentation — line supply and point-of-use delivery); "
        "AS9100D Section 8.5.1 (Control of Production — repetitive "
        "manufacturing controls); AIAG MMOG/LE (Materials Management — "
        "line-side replenishment and kanban assessment)."
    ),

    # ── Manufacturing Process Quality ──
    764: (
        "Standards references: AS9100D Section 8.1 (Operational Planning — "
        "quality planning for manufacturing); AS9145 Section 7 (Product/Process "
        "Validation — quality planning requirements in APQP); AS9100D "
        "Section 9.1.1 (Monitoring and Measurement — quality data collection "
        "and analysis); SAE AS6500 Section 5.1 (Quality Requirements — "
        "manufacturing quality planning); AS9100D Section 9.2 (Internal "
        "Audit — manufacturing quality audit requirements)."
    ),
    765: (
        "Standards references: AS9103 (Variation Management of Key "
        "Characteristics — Cp, Cpk, Pp, Ppk requirements and reporting); "
        "AS9100D Section 8.5.1(f) (Validation of Special Processes — "
        "process capability demonstration); AIAG SPC Reference Manual "
        "(Statistical Process Control — capability study methodology); "
        "AIAG MSA Reference Manual (Measurement Systems Analysis — GR&R "
        "study requirements); AS9145 Section 7.2 (Process Capability — "
        "preliminary and production capability studies); AIAG PPAP Section "
        "4.8 (Initial Process Studies — Ppk requirements)."
    ),
    766: (
        "Standards references: SAE J1739 (Potential Failure Mode and Effects "
        "Analysis in Manufacturing — process FMEA methodology); AIAG/VDA FMEA "
        "Handbook (7-step FMEA approach — design and process FMEA); AS9145 "
        "Section 6.4 (PFMEA — process FMEA in APQP); AS9100D Section 8.3.3 "
        "(Design Inputs — FMEA as design input from manufacturing); AS13004 "
        "(Process Failure Mode and Effects Analysis and Process Control Plans); "
        "AS13000 (Problem Solving Requirements for Suppliers); "
        "SAE ARP4761 (Safety Assessment — fault tree analysis methodology)."
    ),
    767: (
        "Standards references: AS9100D Section 7.2 (Competence — quality "
        "training requirements); AS9100D Section 7.3 (Awareness — quality "
        "awareness programs); AS9100D Section 9.2 (Internal Audit — quality "
        "audit program requirements); AS9101 (Quality Management Systems "
        "Audit Requirements — registrar audit preparation); NADCAP AC7000 "
        "(Audit Criteria — special process quality system requirements)."
    ),
    768: (
        "Standards references: AS9100D Section 10.2 (Nonconformity and "
        "Corrective Action — failure cost tracking); AS9100D Section 10.3 "
        "(Continual Improvement — quality cost reduction); AS13006 "
        "(Process Control Methods — cost of quality data collection); "
        "AIAG CQI-14 (Warranty Management — external failure cost "
        "analysis); SAE AS6500 Section 5.1 (Quality Improvement — "
        "quality cost methodology)."
    ),

    # ── Manufacturing Safety & Hazard Analysis ──
    770: (
        "Standards references: OSHA 29 CFR 1910 (General Industry Standards "
        "— hazard identification requirements); ANSI/ASSP Z10 (Occupational "
        "Health and Safety Management Systems — hazard analysis methodology); "
        "ISO 45001 Section 6.1 (Actions to Address Risks — hazard "
        "identification and risk assessment); MIL-STD-882E (System Safety "
        "— hazard analysis methods: PHA, SHA, SSHA, O&SHA); SAE ARP4761 "
        "(Safety Assessment — hazard analysis techniques applicable to "
        "manufacturing processes)."
    ),
    771: (
        "Standards references: OSHA 29 CFR 1910.147 (Control of Hazardous "
        "Energy — lockout/tagout procedures); OSHA 29 CFR 1910.212 (Machine "
        "Guarding — general requirements); OSHA 29 CFR 1910.146 (Permit-"
        "Required Confined Spaces); OSHA 29 CFR 1910.1200 (Hazard "
        "Communication — GHS labeling and SDS requirements); OSHA 29 CFR "
        "1910.132-138 (PPE — personal protective equipment requirements); "
        "OSHA 29 CFR 1904 (Recording and Reporting — injury/illness "
        "recordkeeping); NFPA 70E (Electrical Safety in the Workplace — "
        "arc flash and shock protection)."
    ),
    772: (
        "Standards references: ISO 45001 (Occupational Health and Safety "
        "Management Systems — safety integration framework); ANSI/ASSP Z10 "
        "(OHS Management Systems — safety program structure); AS9100D "
        "Section 7.1.4 (Environment for Operation — process safety and "
        "ergonomic requirements); OSHA 29 CFR 1910.132 (PPE — hazard "
        "assessment for process-specific PPE selection); ANSI/HFES 100 "
        "(Human Factors Engineering — ergonomic design of workstations); "
        "MIL-STD-882E (System Safety — safety integration in engineering "
        "design and process planning)."
    ),
}


async def bolster():
    async with async_session() as db:
        updated = 0
        skipped = 0

        for neuron_id, standards_text in STANDARDS.items():
            # Get current content
            result = await db.execute(
                text("SELECT id, content, label FROM neurons WHERE id = :id"),
                {"id": neuron_id},
            )
            row = result.fetchone()
            if not row:
                print(f"  WARNING: Neuron {neuron_id} not found, skipping")
                skipped += 1
                continue

            current_content = row[1] or ""

            # Check if already bolstered
            if "Standards references:" in current_content:
                print(f"  SKIP [{neuron_id}] already has standards references: {row[2][:50]}")
                skipped += 1
                continue

            # Append standards to content
            if current_content.strip():
                new_content = current_content.rstrip() + "\n\n" + standards_text
            else:
                new_content = standards_text

            await db.execute(
                text("UPDATE neurons SET content = :content WHERE id = :id"),
                {"content": new_content, "id": neuron_id},
            )
            updated += 1
            print(f"  UPDATED [{neuron_id}] {row[2][:60]}")

        await db.commit()
        print(f"\nDone! Updated {updated} neurons, skipped {skipped}.")


if __name__ == "__main__":
    asyncio.run(bolster())
