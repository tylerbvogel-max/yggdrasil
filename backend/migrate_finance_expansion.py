"""
Non-destructive migration: expand Finance department (L0=250) with:
1. New role: Cost Estimator (7 L2 tasks, ~31 L3 systems)
2. Expand Financial Analyst (251) with 4 new L2 tasks, ~16 L3 systems
3. Expand Cost Accountant (260) with 3 new L2 tasks, ~11 L3 systems

Sources: DoD Cost Estimating Guide v2.0 (2022), GAO-20-195G (2020), NASA CEH v4.0 (2015)
"""

import sqlite3
import datetime

DB_PATH = "yggdrasil.db"
DEPARTMENT = "Finance"
START_ID = 1004
QUERY_COUNT = 79
NOW = datetime.datetime.utcnow().isoformat()

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

max_id = cur.execute("SELECT MAX(id) FROM neurons").fetchone()[0]
assert max_id < START_ID, f"Max ID {max_id} >= START_ID {START_ID}"

next_id = START_ID


def add(parent_id, layer, node_type, label, role_key, summary=None, content=None):
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
         DEPARTMENT, role_key, QUERY_COUNT, NOW),
    )
    return nid


# =============================================================================
# FINANCIAL ANALYST (251) — 4 new L2 branches
# =============================================================================
RK_FA = "financial_analyst"

# --- L2: Program financial planning and budget formulation ---
t1 = add(251, 2, "task", "Program financial planning and budget formulation", RK_FA,
    summary="Develop and manage program budgets through federal budgeting processes",
    content="Plan and execute program financial management including budget formulation, phasing, obligation and expenditure tracking, and alignment with federal Planning, Programming, Budgeting, and Execution (PPBE) processes.")

add(t1, 3, "system", "PPBE process alignment and budget submission", RK_FA,
    summary="Navigate DoD/NASA budget formulation and execution cycles",
    content="Align program financial plans with the Planning, Programming, Budgeting, and Execution (PPBE) process. Develop budget submissions through mission directorate and agency review cycles per NPR 9420.1 (formulation) and NPR 9470.1 (execution). Translate program needs into budget line items with out-year projections. Manage between authorized and appropriated funding levels. Address four fiscal laws: annual authorization, Antideficiency Act, Misappropriation Act, and Bona Fide Need rule.")

add(t1, 3, "system", "Budget phasing and obligation-expenditure tracking", RK_FA,
    summary="Track obligations and expenditures against phased budget profiles",
    content="Develop time-phased budget profiles aligning planned obligations and expenditures with program milestones. Track obligation rates against appropriation availability periods. Monitor expenditure curves against planned disbursement schedules. Apply spreading functions (Uniform, Trapezoid, Beta, Rayleigh, Weibull) for budget phasing. Reconcile obligations vs. expenditures vs. accruals for financial reporting.")

add(t1, 3, "system", "Funding profile development and appropriation management", RK_FA,
    summary="Develop multi-year funding profiles across appropriation categories",
    content="Develop funding profiles across appropriation categories: RDT&E (Research, Development, Test & Evaluation), Procurement, O&M (Operations & Maintenance), and MILCON (Military Construction). Manage appropriation color-of-money constraints and fiscal year availability. Build Spruill Charts (program funding and quantities over time). Align funding profiles with contract types and payment schedules.")

add(t1, 3, "system", "Program financial baseline and management reserve tracking", RK_FA,
    summary="Establish and maintain program financial baselines with reserve management",
    content="Establish program financial baselines including Performance Measurement Baseline (PMB), Management Reserve (MR), and Unallocated Future Expenses (UFE). Track reserve burn-down rates and consumption trends. Establish replenishment triggers and escalation criteria. Report financial baseline status at program reviews. Ensure total budget (PMB + MR + UFE) aligns with Agency Baseline Commitment (ABC).")

add(t1, 3, "system", "Contract funding and modification financial processing", RK_FA,
    summary="Process contract funding actions and financial modifications",
    content="Process contract funding actions including incremental funding, definitization of undefinitized contract actions (UCAs), and contract modifications. Track obligation authority against contract ceiling. Manage progress payment and performance-based payment processing. Monitor contract funding status reports and remaining unfunded requirements. Coordinate de-obligation of excess funds at contract closeout.")

# --- L2: Variance analysis and Estimate at Completion ---
t2 = add(251, 2, "task", "Variance analysis and Estimate at Completion", RK_FA,
    summary="Analyze cost and schedule variances and project final program costs",
    content="Perform detailed variance analysis using Earned Value Management data, develop Estimates at Completion using multiple projection methods, and manage over-target baseline processes when program performance degrades beyond recovery.")

add(t2, 3, "system", "CPI and SPI trend analysis and interpretation", RK_FA,
    summary="Analyze cost and schedule performance indices for trend detection",
    content="Track Cost Performance Index (CPI) and Schedule Performance Index (SPI) at cumulative and current-period levels. Analyze CPI/SPI trends for early warning of cost/schedule growth. Apply the CPI stability phenomenon (cumulative CPI stabilizes by 20% completion). Compare CPI/SPI at control account, WBS element, and total program levels. Develop CPI*SPI composite index for overall health assessment. Flag adverse trends for management action.")

add(t2, 3, "system", "Estimate at Completion projection methods", RK_FA,
    summary="Develop EAC using multiple statistical and analytical methods",
    content="Develop Estimate at Completion (EAC) using multiple methods: (1) EAC = BAC/CPI (performance-based), (2) EAC = AC + (BAC-EV)/CPI (cumulative efficiency), (3) EAC = AC + (BAC-EV)/(CPI*SPI) (composite), (4) EAC = AC + independent ETC (bottom-up re-estimate). Compare methods against contractor EAC. Apply regression-based EAC for trend projection. Document EAC methodology selection rationale. Track Variance at Completion (VAC = BAC - EAC) and To-Complete Performance Index (TCPI).")

add(t2, 3, "system", "Over-target baseline and schedule management", RK_FA,
    summary="Manage OTB/OTS processes when program exceeds baseline",
    content="Execute Over-Target Baseline (OTB) and Over-Target Schedule (OTS) processes when program performance degrades beyond recovery to current baseline. Evaluate need for OTB/OTS vs. continued management within existing baseline. Develop revised PMB reflecting realistic cost-to-go. Maintain traceability from original baseline through OTB adjustments. Obtain government approval for OTB implementation. Document rationale and revised management approach per ANSI/EIA-748 guidelines.")

add(t2, 3, "system", "Earned value data validation and surveillance", RK_FA,
    summary="Validate contractor EVM data and conduct system surveillance",
    content="Validate contractor EVM system compliance with ANSI/EIA-748 32 criteria. Conduct Integrated Baseline Reviews (IBR) to verify Performance Measurement Baseline credibility at control account level. Perform ongoing EVM surveillance: verify data accuracy, assess management processes, evaluate corrective action effectiveness. Review Contract Performance Reports (CPR/IPMR Formats 1-5). Identify and investigate anomalies: retroactive changes, negative management reserve, schedule visibility issues.")

# --- L2: Financial reporting and audit preparation ---
t3 = add(251, 2, "task", "Financial reporting and audit preparation", RK_FA,
    summary="Prepare financial reports and support DCAA/GAO audit activities",
    content="Manage financial reporting requirements including cost data deliverables, audit preparation and response, and Nunn-McCurdy breach analysis for programs exceeding cost growth thresholds.")

add(t3, 3, "system", "DCAA audit preparation and response", RK_FA,
    summary="Prepare for and support Defense Contract Audit Agency audits",
    content="Prepare for DCAA audits of incurred costs, forward pricing rates, accounting system adequacy, and cost accounting standards compliance. Maintain audit-ready documentation: timekeeping records, cost pool reconciliations, rate calculations, and allocation methodology evidence. Respond to audit findings and negotiate resolution. Support pre-award accounting system surveys. Prepare incurred cost submissions within 6 months of fiscal year end per FAR 52.216-7.")

add(t3, 3, "system", "GAO audit response and best practice compliance", RK_FA,
    summary="Support GAO reviews using the 18 best practices framework",
    content="Support Government Accountability Office (GAO) reviews of program cost estimates. Map cost estimating practices against GAO's 18 best practices across four characteristics: Comprehensive, Well-Documented, Accurate, and Credible. Prepare responses to GAO findings. Maintain documentation sufficient for independent estimate reconstruction. Address GAO cost estimating assessment questions covering: estimate documentation, program definition, ground rules, data validation, estimating methods, inflation adjustment, sensitivity analysis, risk/uncertainty analysis, and crosschecks.")

add(t3, 3, "system", "Nunn-McCurdy breach analysis and reporting", RK_FA,
    summary="Monitor and report cost growth against Nunn-McCurdy thresholds",
    content="Monitor program cost growth against Nunn-McCurdy breach thresholds for Major Defense Acquisition Programs (MDAPs): significant breach at 15% (current) or 30% (original) PAUC/APUC growth, critical breach at 25% (current) or 50% (original). Prepare unit cost reports for congressional notification. Support root cause analysis using Framing Assumptions methodology. Develop corrective action plans for breached programs. Track cost growth metrics continuously to provide early warning before threshold exceedance.")

add(t3, 3, "system", "Cost and software data reporting deliverables", RK_FA,
    summary="Manage CSDR and financial data deliverables to government repositories",
    content="Manage Cost and Software Data Reporting (CSDR) deliverables: FlexFile (detailed cost/hours data), Quantity Data Report, Software Resources Data Report (SRDR), and Contractor Business Data report. Submit to Cost Assessment Data Enterprise (CADE) repository. Ensure data quality and completeness per CSDR plan. Support CADRe (Cost Analysis Data Requirement) submissions at project milestones (SRR, PDR, CDR, SIR, Launch). Maintain traceability between financial system actuals and CSDR submissions.")

# --- L2: Affordability analysis and CAIV ---
t4 = add(251, 2, "task", "Affordability analysis and cost-as-independent-variable", RK_FA,
    summary="Conduct affordability assessments and cost-constrained trade studies",
    content="Perform affordability analyses throughout program lifecycle and apply Cost As an Independent Variable (CAIV) methodology to balance performance requirements against cost constraints.")

add(t4, 3, "system", "Affordability assessment across program lifecycle", RK_FA,
    summary="Evaluate program affordability at each decision point and budget cycle",
    content="Conduct affordability assessments comparing projected program costs against available budget toplines across the Future Years Defense Program (FYDP) or equivalent planning horizon. Evaluate affordability at each Key Decision Point and major program review. Assess affordability impacts of requirements changes, schedule delays, and technical risks. Consider operations and sustainment costs as major affordability drivers, especially for long-duration programs. Present affordability analysis results to decision authorities.")

add(t4, 3, "system", "Cost-as-independent-variable trade studies", RK_FA,
    summary="Apply CAIV to converge design on cost targets rather than performance maximums",
    content="Apply Cost As an Independent Variable (CAIV) methodology: establish cost targets as design constraints, challenge performance requirements that drive cost disproportionately, evaluate cost-performance trade spaces to find optimal balance. Support design-to-cost decisions by quantifying cost impacts of performance increments. Coordinate with systems engineering on requirements prioritization (must-have vs. nice-to-have). Document trade study rationale including rejected alternatives.")

add(t4, 3, "system", "Life-cycle cost projection and sustainment affordability", RK_FA,
    summary="Project total life-cycle costs including operations and disposal",
    content="Develop Life-Cycle Cost Estimates (LCCE) spanning development, production, operations & maintenance, and disposal phases. Apply appropriate estimating methods for each phase: parametric for early development, build-up for production, analogy for sustainment. Project operating and support costs using historical O&S data from VAMOSC/AFTOC/OSMIS databases. Assess sustainment affordability against projected out-year budgets. Track total ownership cost (TOC) metrics.")


# =============================================================================
# COST ACCOUNTANT (260) — 3 new L2 branches
# =============================================================================
RK_CA = "cost_accountant"

# --- L2: Indirect rate structure and forward pricing ---
t5 = add(260, 2, "task", "Indirect rate structure and forward pricing", RK_CA,
    summary="Develop and maintain indirect rate structures and forward pricing agreements",
    content="Manage the development, negotiation, and maintenance of indirect cost rate structures, forward pricing rate agreements, and incurred cost submissions for government contract compliance.")

add(t5, 3, "system", "Rate base development and indirect cost pool structure", RK_CA,
    summary="Design and maintain indirect cost pool and allocation base structures",
    content="Design indirect cost pool structure: overhead pools (engineering, manufacturing, material handling, G&A), service center allocations, and B&P/IR&D pools. Select appropriate allocation bases (direct labor dollars, direct labor hours, total cost input, value-added). Ensure rate structure reflects actual cost causation. Maintain consistency between rate structure and Disclosure Statement. Develop provisional billing rates for contract invoicing. Reconcile actual indirect costs to applied amounts.")

add(t5, 3, "system", "Disclosure Statement development and maintenance", RK_CA,
    summary="Maintain CAS Disclosure Statement reflecting actual accounting practices",
    content="Develop and maintain CAS Disclosure Statement (CASB DS-1 and DS-2 forms) accurately describing cost accounting practices. File amendments when practices change, within required timelines. Ensure consistency between disclosed practices and actual practices — noncompliance exposure for discrepancies. Address: direct/indirect cost definitions, home office allocations, IR&D/B&P treatment, cost of money computation, pension costs, deferred compensation. Support DCAA review of Disclosure Statement adequacy.")

add(t5, 3, "system", "Incurred cost submission and final rate negotiation", RK_CA,
    summary="Prepare annual incurred cost submissions and negotiate final indirect rates",
    content="Prepare annual incurred cost submissions within 6 months of fiscal year end per FAR 52.216-7. Include: Schedule H (home office allocation), Schedule I (corporate/segment allocations), Schedule J (cost pool composition), supporting schedules for rate calculations, and Certificate of Final Indirect Costs. Support DCAA audit of incurred costs. Negotiate final indirect rates with Administrative Contracting Officer (ACO). Process retroactive rate adjustments to affected contracts.")

add(t5, 3, "system", "Forward Pricing Rate Agreement negotiation", RK_CA,
    summary="Negotiate and maintain forward pricing rate agreements with government",
    content="Develop forward pricing rate proposals supported by rate buildup documentation, trend analysis, and projection methodology. Negotiate Forward Pricing Rate Agreements (FPRAs) or Forward Pricing Rate Recommendations (FPRRs) with DCAA/ACO. Address: projected direct and indirect rates, escalation factors, labor rate projections, overhead absorption forecasts. Maintain FPRA currency — update when significant changes occur. Use FPRAs to streamline proposal pricing and reduce negotiation cycle time.")

# --- L2: Cost Accounting Standards compliance ---
t6 = add(260, 2, "task", "Cost Accounting Standards compliance", RK_CA,
    summary="Ensure compliance with CAS requirements for government contracts",
    content="Manage compliance with Cost Accounting Standards (CAS) including applicability determinations, cost impact analysis for accounting changes, and accounting system adequacy for government contract cost accumulation.")

add(t6, 3, "system", "CAS applicability determination and clause analysis", RK_CA,
    summary="Determine CAS applicability and manage clause requirements",
    content="Determine CAS applicability: full coverage (CAS-covered contracts >$50M and $7.5M threshold), modified coverage (CAS 401/402 only for contracts $2M-$50M), and exempt categories. Analyze applicability of individual standards: CAS 401 (consistency), 402 (cost allocation), 403 (home office allocation), 404 (capitalization), 405 (unallowable costs), 406 (cost accounting periods), 407 (standard costs), 408 (compensated absence), 409 (depreciation), 410 (G&A allocation), 411 (material acquisition costs), 412/413 (pension costs), 414 (cost of money), 415 (deferred compensation), 416 (insurance), 418 (direct/indirect allocation), 420 (IR&D/B&P).")

add(t6, 3, "system", "Cost impact statement preparation for accounting changes", RK_CA,
    summary="Analyze and report cost impacts of accounting practice changes",
    content="Prepare cost impact statements when changing cost accounting practices (voluntary or required). Quantify impact on government contracts: increased costs to government, decreased costs, and cost-neutral shifts. Follow CAS Administration process: submit Disclosure Statement amendment, prepare cost impact proposal, negotiate equitable adjustment with ACO. Distinguish between required changes (CAS noncompliance correction), desirable changes (improved cost causation), and unilateral changes. Maintain records supporting impact calculations.")

add(t6, 3, "system", "Accounting system adequacy and DFARS compliance", RK_CA,
    summary="Maintain accounting system adequacy for government contract cost accumulation",
    content="Maintain accounting system meeting DFARS 252.242-7006 adequacy criteria: proper segregation of direct/indirect costs, accumulation at contract/task level, exclusion of unallowable costs per FAR Part 31, timely recording, consistent allocation methodology, and audit trail capability. Support DCAA accounting system audits and pre-award surveys. Address deficiency findings and develop corrective action plans. Ensure system integrates timekeeping, purchasing, accounts payable, and general ledger functions for government contract compliance.")

add(t6, 3, "system", "Unallowable cost identification and exclusion", RK_CA,
    summary="Identify and exclude unallowable costs per FAR Part 31",
    content="Implement processes to identify and exclude costs unallowable under FAR 31.205: entertainment, alcoholic beverages, bad debts, contributions/donations, fines/penalties, goodwill, interest (with exceptions), lobbying, organizational costs, patent costs (in some cases), and expressly unallowable costs. Maintain unallowable cost screening in accounting system. Apply directly associated cost provisions (FAR 31.201-6). Ensure penalties avoidance for claiming expressly unallowable costs per FAR 42.709. Train personnel on allowability determination.")

# --- L2: Contract pricing and profit/fee analysis ---
t7 = add(260, 2, "task", "Contract pricing and profit/fee analysis", RK_CA,
    summary="Support contract pricing development and profit/fee negotiations",
    content="Support contract pricing activities including cost element development for proposals, weighted guidelines profit/fee analysis, and should-cost analysis for government cost evaluations.")

add(t7, 3, "system", "Weighted guidelines profit-fee analysis", RK_CA,
    summary="Apply DoD weighted guidelines method for profit/fee determination",
    content="Apply DoD Weighted Guidelines (WGL) method per DFARS 215.404-71 for profit/fee negotiation: assign values across profit factors — technical risk (contractor effort: material, labor, overhead, subcontract type/complexity), contract type risk (cost risk by contract type), facilities capital employed, and cost efficiency factor. Calculate total profit objective as weighted composite. Compare against historical profit rates for similar contract types. Support profit/fee negotiation positions with documented rationale. Address performance-based fee structures for CPAF/CPIF contracts.")

add(t7, 3, "system", "Price-to-cost reconciliation and analysis", RK_CA,
    summary="Reconcile contractor proposed prices to estimated costs for negotiations",
    content="Reconcile contractor proposed prices to government cost estimates for negotiation support. Decompose contractor pricing: direct labor rates × hours by category, material costs (BOM, raw material, purchased parts), subcontract costs, other direct costs, indirect rates applied, profit/fee. Identify and analyze pricing discrepancies. Evaluate labor rate reasonableness against Bureau of Labor Statistics data and historical actuals. Assess material pricing against market data. Support Truth in Negotiations Act (TINA/10 USC 3702) defective pricing analysis when applicable.")

add(t7, 3, "system", "Should-cost analysis and cost reduction initiatives", RK_CA,
    summary="Conduct should-cost analysis to identify cost reduction opportunities",
    content="Conduct should-cost analysis to establish what a product or service should cost under efficient production conditions. Analyze contractor cost structure for inefficiencies: excess overhead rates, uncompetitive subcontracting, underutilized capacity, inefficient manufacturing processes. Develop cost reduction recommendations and negotiate savings into contract pricing. Support government should-cost teams. Apply should-cost techniques to major subcontracts and material purchases. Track should-cost savings realization against negotiated targets.")


# =============================================================================
# COST ESTIMATOR (new role under Finance L0=250)
# =============================================================================
RK_CE = "cost_estimator"

ce_role = add(250, 1, "role", "Cost Estimator", RK_CE,
    summary="Develop credible, defensible cost estimates for defense and aerospace programs",
    content="Specialist role responsible for developing life-cycle cost estimates using analogy, parametric, and engineering build-up methods. Manages the full cost estimating process from program definition through documentation, including risk/uncertainty analysis via Monte Carlo simulation, JCL analysis, and economic trade studies. Operates within DoD CAPE, NASA CAD, and GAO frameworks.")

# --- L2: Cost estimating process management ---
t8 = add(ce_role, 2, "task", "Cost estimating process management", RK_CE,
    summary="Manage the 12-step cost estimating process from initiation to documentation",
    content="Execute the 12-step cost estimating process aligned across DoD (CAPE 9-step), GAO (12-step), and NASA (12-task) frameworks. Manage cost estimate development from customer request through final documentation and presentation.")

add(t8, 3, "system", "Cost estimate plan development", RK_CE,
    summary="Develop the cost estimate plan defining scope, approach, team, and schedule",
    content="Develop Cost Estimate Plan defining: policy basis, purpose and scope, estimate structure (WBS/CES alignment), process and approach by cost element, team assignments and responsibilities, data collection plan, travel requirements, review schedule, and deliverables timeline. Identify stakeholders and coordination requirements. Establish estimate classification: Independent Cost Estimate (ICE), Component Cost Estimate (CCE), Program Office Estimate (POE), Service Cost Estimate (SCE), or Independent Government Cost Estimate (IGCE).")

add(t8, 3, "system", "Ground rules and assumptions development", RK_CE,
    summary="Establish ground rules, assumptions, and framing assumptions for the estimate",
    content="Develop three categories of estimate basis: (1) Ground Rules — program manager's domain constraints: production quantities, schedule, base year, recurring/nonrecurring segregation, government-furnished equipment. (2) Assumptions — analyst-developed bridges for unknowns: software reuse percentages, technology maturity, inflation rates, FMS impacts, phase overlaps. (3) Framing Assumptions (DoD) — 3-5 critical foundational assumptions from PARCA/ADA root cause analysis of Nunn-McCurdy breaches. Document all assumptions with rationale and sensitivity indicators.")

add(t8, 3, "system", "Cost Analysis Requirements Description utilization", RK_CE,
    summary="Extract program definition from CARD and technical baseline documents",
    content="Utilize the Cost Analysis Requirements Description (CARD) as the primary source for program definition in DoD estimates. Extract: system description, performance characteristics, program schedule, acquisition strategy, production quantities, logistics concept, and manpower requirements. For NASA, use CADRe (Cost Analysis Data Requirement) capturing programmatic/technical/cost data at milestones. Supplement with contractor proposals, technical specifications, and subject matter expert interviews. Develop kickoff meeting questions per DoD CEG Sample Questions (Appendix D).")

add(t8, 3, "system", "Estimate documentation and basis of estimate", RK_CE,
    summary="Document cost estimates with full traceability and defensibility",
    content="Document cost estimates following standard organization: executive summary, program description, estimate structure dictionary, ground rules and assumptions, data sources, methodology by cost element, cost model description, results summary, risk analysis results, crosschecks, and recommendations. Develop Basis of Estimate (BoE) with sufficient detail for independent reconstruction. Apply GAO documentation best practices: traceable, defensible, repeatable. Support Air Force documentation checklist (ACAT I/II/III formats). Archive supporting data and models.")

add(t8, 3, "system", "Cost estimate presentation and defense", RK_CE,
    summary="Present and defend cost estimates to decision authorities and review boards",
    content="Prepare cost estimate briefings using standard visualization tools: Sand Charts (cost by year and phase), Pareto Charts (rank-ordered cost contributors), Tornado Charts (sensitivity/what-if), Cost Element Charts (cross-estimate comparison), Spruill Charts (funding and quantities), and S-Curves (probability vs. cost). Defend estimate methodology, data choices, and risk analysis results before Cost Review Boards (CRB), program decision authorities, and congressional staffers. Address challenges to assumptions, methods, and results with documented rationale.")

# --- L2: Cost estimating methodologies ---
t9 = add(ce_role, 2, "task", "Cost estimating methodologies", RK_CE,
    summary="Apply analogy, parametric, build-up, and extrapolation methods for cost estimation",
    content="Select and apply appropriate cost estimating methods based on program maturity, data availability, and estimate purpose. Master four core methods plus supporting techniques.")

add(t9, 3, "system", "Analogy method application", RK_CE,
    summary="Estimate costs by adjusting historical costs of comparable systems",
    content="Apply analogy method: identify comparable historical system, quantify technical and programmatic differences, develop adjustment factors for complexity, size, performance, and technology. Use single-system analogy for early-phase estimates when limited data exists. Document comparability rationale and adjustment factor derivation. Best suited for Pre-Phase A/Phase A estimates, ROM development, and crosscheck validation. Limitations: subjectivity of adjustment factors, sensitivity to system selection, difficulty with novel technologies.")

add(t9, 3, "system", "Parametric method and CER development", RK_CE,
    summary="Develop and apply Cost Estimating Relationships using regression analysis",
    content="Develop Cost Estimating Relationships (CERs) and Schedule Estimating Relationships (SERs) using regression analysis. 7-step process: form hypothesis, collect data, evaluate data, perform regression, test relationship, select equation, validate. Apply linear (Cost = a + b*X) and log-linear (Cost = a * X^b) forms. Evaluate fit statistics: t-statistic, F-statistic, R-squared, standard error, confidence/prediction intervals, MAD. Address multicollinearity, outliers, and heteroscedasticity. Apply CERs from established models: NAFCOM, PRICE TruePlanning, SEER-H, SEER-SEM.")

add(t9, 3, "system", "Engineering build-up method", RK_CE,
    summary="Develop bottom-up estimates from labor, material, and overhead components",
    content="Apply engineering build-up (grassroots) method: decompose to lowest WBS level, estimate labor hours by skill category, apply labor rates, estimate material quantities and unit costs, add other direct costs (travel, test support, facilities), apply indirect rates (overhead, G&A, FCCM). Use Delphi method for expert elicitation when engineering data is limited. Best suited for mature programs (Phase C/D), production estimates, and proposal development. Advantages: detailed audit trail, direct mapping to work scope. Limitations: time-intensive, may miss cross-element integration costs.")

add(t9, 3, "system", "Extrapolation from actuals and EVM-based projection", RK_CE,
    summary="Project costs using actual expenditure data and EVM performance trends",
    content="Apply extrapolation from actuals for in-progress programs: use actual cost data (ACWP) plus Estimate to Complete (ETC) based on CPI/SPI performance trends. Apply EVM-based methods: ETC = (BAC-BCWP)/CPI, ETC = (BAC-BCWP)/(CPI*SPI), or independent bottom-up ETC. Evaluate performance stability before selecting projection method. Use CSDR FlexFile actual cost data for completed activities. Compare against contractor EAC and independent projections. Best suited for programs past 20% completion with stable performance metrics.")

add(t9, 3, "system", "Learning curve analysis and cost improvement modeling", RK_CE,
    summary="Model production cost reduction using learning curve theory",
    content="Apply learning curve (cost improvement curve) theory: Unit Cost = T1 * X^b, where T1 is first unit cost, X is unit number, b = ln(slope)/ln(2). Determine appropriate slope from historical data — typical aerospace manufacturing slopes: 75-95% depending on labor content, complexity, and production breaks. Distinguish unit theory vs. cumulative average theory. Adjust for: lot buys, production rate changes, production breaks, design changes, and multi-contract learning. Apply learning to labor hours; material learning typically less steep. Validate slopes against CADE/CSDR historical data.")

# --- L2: Data collection and normalization ---
t10 = add(ce_role, 2, "task", "Data collection and normalization", RK_CE,
    summary="Collect, validate, and normalize cost data from government and industry sources",
    content="Manage cost data acquisition from government repositories, contractor reports, and historical databases. Validate data quality, normalize for inflation, accounting differences, and quantity effects.")

add(t10, 3, "system", "CADE and CSDR data systems utilization", RK_CE,
    summary="Access and utilize DoD cost data repositories for estimating",
    content="Utilize Cost Assessment Data Enterprise (CADE) as the primary DoD cost data repository. Access datasets: CSDR (Cost and Software Data Reporting) for contractor-reported cost/schedule data, EVM data for performance trends, O&S data for sustainment costs, SRDR (Software Resources Data Report) for software-specific metrics. Access component-level repositories: VAMOSC (Navy), AFTOC (Air Force), OSMIS (Army) for operations and support data. Use DAMIR for acquisition reporting and FPDS for contract information. For NASA, use ONCE (One NASA Cost Engineering) database of completed CADRe submissions.")

add(t10, 3, "system", "Data validation and quality assessment", RK_CE,
    summary="Validate data completeness, accuracy, and applicability for estimating",
    content="Validate cost data across four dimensions: completeness (are all costs captured?), accuracy (do reported costs match actuals?), applicability (is the data relevant to the program being estimated?), and timeliness (how current is the data?). Cross-reference contractor-reported data against financial system actuals. Identify and investigate outliers. Assess data bias — optimistic vs. pessimistic reporting. Verify WBS mapping consistency across data sources. Document data limitations and impact on estimate confidence.")

add(t10, 3, "system", "Inflation and escalation adjustment", RK_CE,
    summary="Normalize historical costs for inflation and convert between dollar-year bases",
    content="Normalize historical cost data for inflation using appropriate indices: OSD Comptroller Deflators (DoD), NASA New Start Inflation Index (NNSI), Bureau of Labor Statistics indices (BLS), or program-specific escalation rates. Convert between dollar-year bases: Base Year (BY$), Constant Year (CY$), Current/Then-Year (TY$). Apply compound inflation for multi-year conversions. Distinguish between inflation (general price level changes) and escalation (specific commodity/labor rate changes). Follow CAPE Inflation and Escalation Best Practices (2021).")

add(t10, 3, "system", "Technical baseline description development", RK_CE,
    summary="Define system technical characteristics driving cost estimates",
    content="Develop technical baseline description defining cost-driving characteristics: system weight, size, performance parameters, technology readiness levels, software size (SLOC/function points), complexity factors, integration requirements, and test program scope. Map technical parameters to WBS elements for CER application. Identify analogous systems and quantify technical differences. Coordinate with systems engineering for requirements decomposition. Track requirements changes that impact cost estimates.")

# --- L2: Cost risk and uncertainty analysis ---
t11 = add(ce_role, 2, "task", "Cost risk and uncertainty analysis", RK_CE,
    summary="Quantify cost risk and uncertainty using probabilistic methods",
    content="Apply probabilistic analysis methods to quantify cost estimate uncertainty, generate confidence level distributions, and support risk-informed decision making.")

add(t11, 3, "system", "Monte Carlo simulation for cost estimates", RK_CE,
    summary="Execute Monte Carlo simulation to generate probabilistic cost distributions",
    content="Execute Monte Carlo simulation to quantify total estimate uncertainty: define input distributions for each cost element (triangular, beta, lognormal, uniform), specify correlations between cost elements, run 10,000+ iterations to generate output distribution. Interpret results: point estimate percentile, confidence intervals, key risk drivers. Use tools: Crystal Ball, @RISK, ACEIT Risk, Python (scipy/numpy). Apply both inputs-based method (vary CER inputs) and outputs-based method (vary cost element totals). Document simulation setup, assumptions, and limitations.")

add(t11, 3, "system", "S-curve development and confidence level reporting", RK_CE,
    summary="Generate cumulative probability distributions for cost estimates",
    content="Generate S-curves (cumulative distribution functions) showing probability of achieving various cost levels. Report key percentiles: 20th (optimistic), 50th (most likely), 70th (program baseline), 80th (budget level). Calculate Coefficient of Variation (CV = standard deviation / mean) as estimate uncertainty metric. Compare S-curves across estimate versions to show uncertainty evolution. Present S-curves to decision authorities with clear explanation of confidence levels. Apply Method of Moments as alternative to full Monte Carlo when simulation is impractical.")

add(t11, 3, "system", "Sensitivity analysis execution", RK_CE,
    summary="Identify cost drivers through systematic parameter variation",
    content="Execute sensitivity analysis: vary each uncertain parameter one-at-a-time across its plausible range while holding others at baseline. Rank results in Tornado Chart format showing which parameters have greatest cost impact. Identify top cost drivers for management attention and risk mitigation. Limitations: does not capture interaction effects between parameters, may miss compounding risks. Use as input to risk analysis — top sensitivity drivers should have well-justified probability distributions. Document parameter ranges and rationale.")

add(t11, 3, "system", "Probability distribution selection and fitting", RK_CE,
    summary="Select appropriate probability distributions for cost risk analysis inputs",
    content="Select probability distributions for cost elements based on data availability and risk characteristics: Triangular (most common — min/most likely/max), Beta (flexible shape for bounded ranges), Lognormal (right-skewed for cost growth), Uniform (equal probability across range), Normal (symmetric uncertainty). Fit distributions to historical data using goodness-of-fit tests (Kolmogorov-Smirnov, Chi-squared, Anderson-Darling). Address correlation specification: positive correlations between cost elements increase total variance. Avoid common errors: symmetric distributions for inherently skewed costs, zero correlation assumption, over-narrow ranges.")

add(t11, 3, "system", "Risk event modeling and discrete risk integration", RK_CE,
    summary="Model discrete risk events and integrate with continuous uncertainty",
    content="Model discrete risk events from program risk register: assign probability of occurrence and cost/schedule impact if realized. Integrate discrete risks with continuous cost uncertainty in simulation — discrete risks fire probabilistically each iteration, adding impact to base cost. Avoid double-counting between discrete risks and continuous uncertainty ranges. Distinguish risk (identifiable events) from uncertainty (general estimating imprecision). Map risk events to WBS elements. Use risk-adjusted cost as basis for management reserve and UFE allocation.")

# --- L2: Joint Cost and Schedule Confidence Level ---
t12 = add(ce_role, 2, "task", "Joint Cost and Schedule Confidence Level analysis", RK_CE,
    summary="Perform JCL analysis coupling cost and schedule risks probabilistically",
    content="Execute Joint Cost and Schedule Confidence Level (JCL) analysis to provide integrated probabilistic assessment of program cost and schedule, required for DoD and NASA programs above cost thresholds.")

add(t12, 3, "system", "JCL 6-step process execution", RK_CE,
    summary="Execute the standard 6-step JCL analysis process",
    content="Execute JCL 6-step process: (0) Identify goals — define analysis scope, schedule network, cost elements, and risk register. (1) Develop summary analysis schedule — logic-linked network capturing critical path and key milestones. (2) Load cost onto schedule activities — classify as Time-Dependent (TD, varies with duration) or Time-Independent (TI, fixed regardless of duration). (3) Incorporate risk list — map discrete risks to schedule activities with probability and impact. (4) Conduct uncertainty analysis — apply distributions to cost and duration elements. (5) Calculate and view results — run Monte Carlo, generate scatterplots and frontier lines.")

add(t12, 3, "system", "Cost-loaded schedule development", RK_CE,
    summary="Build resource-loaded schedules linking cost elements to schedule activities",
    content="Develop cost-loaded schedule integrating WBS cost elements with Integrated Master Schedule (IMS) activities. Classify cost elements as Time-Dependent (labor, facilities — cost scales with duration) or Time-Independent (hardware, materials — fixed cost regardless of schedule). Map cost estimates to schedule activities maintaining traceability to WBS. Validate schedule logic: network completeness, realistic durations, proper dependency types (FS, FF, SS, SF). Ensure critical path is identified and resource-constrained.")

add(t12, 3, "system", "Discrete risk and uncertainty integration in JCL", RK_CE,
    summary="Integrate discrete risks and continuous uncertainty for JCL simulation",
    content="Integrate discrete risks from program risk register into JCL model: each risk has probability of occurrence and impact on cost/schedule activities if realized. Apply continuous uncertainty distributions (triangular: low/most-likely/high) to cost elements and activity durations separately from discrete risks. Avoid double-counting: discrete risks represent specific identified threats, uncertainty represents general estimating imprecision. Run Monte Carlo generating cost-schedule scatterplot showing joint probability distribution.")

add(t12, 3, "system", "JCL scatterplot interpretation and confidence reporting", RK_CE,
    summary="Interpret JCL results and report confidence levels to decision authorities",
    content="Interpret JCL scatterplot: each point represents one simulation iteration (cost, completion date). Draw frontier lines at 50% and 70% confidence levels. Four quadrants: both cost and schedule within target (lower-left, favorable), cost overrun only, schedule delay only, both exceeded (upper-right, worst case). Report joint probability of meeting both cost and schedule targets simultaneously. NASA policy: 70% JCL for Agency Baseline Commitment, 50% minimum for Management Agreement at KDP C. DoD: JCL required for programs >$250M LCC. Present results with sensitivity to key assumptions.")

# --- L2: Cost models and tools ---
t13 = add(ce_role, 2, "task", "Cost models and tools", RK_CE,
    summary="Build, maintain, and apply cost models using standard tools and frameworks",
    content="Design, build, and maintain cost models using spreadsheet and specialized cost estimating tools. Apply standard cost metrics, phasing methods, and WBS/CES alignment frameworks.")

add(t13, 3, "system", "Cost model design and best practices", RK_CE,
    summary="Design cost models with proper structure, documentation, and audit trail",
    content="Design cost models following best practices: color-coding convention (blue=input, black=formula, green=reference), named ranges for traceability, conditional formatting for validation, modular structure separating inputs/calculations/outputs. Avoid embedded macros and complex nested formulas that impair auditability. Maintain version control and change log. Link model structure to WBS/CES. Support multiple estimate scenarios (optimistic/baseline/pessimistic). Enable sensitivity analysis through parameterized inputs. Document all formulas and data sources within the model.")

add(t13, 3, "system", "Phasing and spreading functions", RK_CE,
    summary="Apply time-phasing methods to distribute costs across fiscal years",
    content="Apply cost phasing methods to distribute point estimates across fiscal years: Uniform (equal distribution), Trapezoid (ramp-up, steady-state, ramp-down), Beta distribution (flexible shape via alpha/beta parameters), Rayleigh curve (front-loaded for development activities), Weibull distribution (flexible skewness). Apply Cost Informed by Schedule Method (CISM) linking cost phasing to schedule logic. Use dynamic phasing adjusting to schedule changes. Convert between obligation and expenditure phasing. Maintain consistency between phased estimate and IMS milestones.")

add(t13, 3, "system", "Cost metrics framework and standard definitions", RK_CE,
    summary="Apply DoD/NASA standard cost metrics for program cost reporting",
    content="Apply standard cost metric hierarchy: Flyaway/Sailaway/Rollaway cost (unit recurring production), Weapon System Cost (+ nonrecurring production), Procurement Cost (+ initial spares and support), Program Acquisition Cost (+ RDT&E), Life-Cycle Cost (+ O&S), Total Ownership Cost (+ infrastructure and indirect support). Report unit metrics: Average Unit Procurement Cost (APUC), Program Acquisition Unit Cost (PAUC), Average Unit Manufacturing Cost (AUMC). Track metrics against Nunn-McCurdy thresholds and Selected Acquisition Report baselines.")

add(t13, 3, "system", "WBS and Cost Element Structure alignment", RK_CE,
    summary="Align Work Breakdown Structure with Cost Element Structure for estimating",
    content="Align Program WBS (per MIL-STD-881E) with Cost Element Structure (CES) for consistent cost accumulation and reporting. Map WBS product elements to CES cost categories: direct labor, direct material, subcontract, other direct, overhead, G&A. Develop WBS dictionary defining scope boundaries for each element. Extend WBS to contract level (CWBS) for contractor cost reporting. Apply NASA standard WBS for space flight projects. Ensure WBS supports EVM control account structure, CSDR reporting, and financial system cost accumulation. Reference DoD CEG WBS/CES examples (Appendix E) for aircraft, ground vehicle, missile, ship, electronics, and space systems.")

# --- L2: Economic analysis and trade studies ---
t14 = add(ce_role, 2, "task", "Economic analysis and trade studies", RK_CE,
    summary="Conduct economic analyses and cost-based trade studies for program decisions",
    content="Apply economic analysis methods for investment decisions including net present value analysis, make-vs-buy determinations, and cost-based trade studies supporting acquisition strategy.")

add(t14, 3, "system", "Net present value and discounted cash flow analysis", RK_CE,
    summary="Apply NPV and DCF methods for investment decision evaluation",
    content="Apply Net Present Value (NPV) analysis for comparing investment alternatives: discount future costs and benefits to present value using OMB Circular A-94 real discount rates. Calculate NPV = sum of [Cash Flow_t / (1+r)^t] for each year. Use Equivalent Uniform Annual Cost (EUAC) for comparing alternatives with different lifespans. Apply Savings-to-Investment Ratio (SIR) as secondary metric. Distinguish between real and nominal discount rates. Address sunk cost exclusion, opportunity cost inclusion, and terminal value estimation. Present results with sensitivity to discount rate assumptions.")

add(t14, 3, "system", "Make-vs-buy and lease-vs-buy analysis", RK_CE,
    summary="Conduct sourcing and acquisition mode trade studies",
    content="Conduct make-vs-buy analysis comparing in-house development/production costs against procurement: include all relevant costs (direct, indirect, facilities, opportunity costs) for both options. Assess non-cost factors: schedule risk, technical control, workforce availability, industrial base health, intellectual property. Conduct lease-vs-buy analysis per OMB Circular A-94: compare NPV of lease payments against purchase price plus maintenance minus residual value. Document decision rationale including quantitative and qualitative factors.")

add(t14, 3, "system", "What-if analysis and scenario-based cost assessment", RK_CE,
    summary="Evaluate cost impacts of alternative program scenarios",
    content="Conduct what-if analysis varying multiple parameters simultaneously to evaluate alternative program scenarios: quantity changes, schedule acceleration/deceleration, technology insertion, requirements relaxation, contractor base changes. Develop scenario matrix with cost results for each combination. Compare against baseline estimate to quantify decision impacts. Support Analysis of Alternatives (AoA) with cost estimates for each alternative. Present scenario results using Cost Element Charts comparing alternatives across WBS elements. Document scenario assumptions and limitations.")

add(t14, 3, "system", "OMB Circular A-94 compliance for economic analysis", RK_CE,
    summary="Apply federal economic analysis requirements per OMB guidance",
    content="Apply OMB Circular A-94 requirements for benefit-cost and cost-effectiveness analysis: use real discount rates published annually by OMB for public investment and regulatory analysis. Distinguish between cost-effectiveness analysis (comparing alternatives achieving same objective) and benefit-cost analysis (monetizing benefits for comparison against costs). Apply 7% real rate for internal federal investments, 3% for public benefit analysis (or current OMB-published rates). Address time-value-of-money, inflation adjustment, risk-adjusted returns, and distributional analysis. Document compliance with OMB and agency-specific economic analysis guidance.")


# =============================================================================
conn.commit()

total_added = next_id - START_ID
print(f"Successfully added {total_added} new neurons (IDs {START_ID}-{next_id - 1})")

# Breakdown
roles_added = 1  # Cost Estimator
l2_added = sum(1 for _ in [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13, t14])
l3_added = total_added - roles_added - l2_added
print(f"  {roles_added} new role (Cost Estimator)")
print(f"  {l2_added} new L2 tasks")
print(f"  {l3_added} new L3 systems")

# Verify
total = cur.execute("SELECT COUNT(*) FROM neurons").fetchone()[0]
fin_count = cur.execute("SELECT COUNT(*) FROM neurons WHERE department='Finance'").fetchone()[0]
print(f"\nTotal neurons in DB: {total}")
print(f"Total Finance neurons: {fin_count}")

# Show structure
for role_id, role_name in [(251, "Financial Analyst"), (260, "Cost Accountant"), (ce_role, "Cost Estimator")]:
    tasks = cur.execute("SELECT id, label FROM neurons WHERE parent_id=? ORDER BY id", (role_id,)).fetchall()
    print(f"\n{role_name} ({len(tasks)} L2 tasks):")
    for t in tasks:
        children = cur.execute("SELECT COUNT(*) FROM neurons WHERE parent_id=?", (t[0],)).fetchone()[0]
        print(f"  [{t[0]}] {t[1]} ({children} L3)")

conn.close()
