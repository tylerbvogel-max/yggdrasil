"""
SOC 2 Type II Trust Services Criteria (TSC).

Source: AICPA Trust Services Criteria (2017, updated 2022).
Based on COSO Internal Control Framework mapped to IT systems.

SOC 2 has five categories:
  - Security (Common Criteria CC1-CC9) — required for all SOC 2 audits
  - Availability (A1) — optional
  - Processing Integrity (PI1) — optional
  - Confidentiality (C1) — optional
  - Privacy (P1) — optional

Each criterion maps to specific COSO principles and points of focus.
"""

SOC2_CRITERIA: list[dict] = [
    # ── CC1: Control Environment ──
    {"id": "CC1.1", "category": "Security", "title": "COSO Principle 1: Demonstrates Commitment to Integrity and Ethical Values",
     "status": "partial",
     "detail": "NASA code review standards enforce quality and integrity. Missing: formal code of ethics, ethics training, organizational values statement.",
     "points_of_focus": ["Board oversight", "Ethical standards", "Adherence assessment"]},
    {"id": "CC1.2", "category": "Security", "title": "COSO Principle 2: Board Exercises Oversight Responsibility",
     "status": "gap",
     "detail": "Single developer. No board or oversight body. Must establish governance structure with independent oversight of IT controls.",
     "points_of_focus": ["Board independence", "Expertise", "Oversight of internal control"]},
    {"id": "CC1.3", "category": "Security", "title": "COSO Principle 3: Establishes Structure, Authority, and Responsibility",
     "status": "partial",
     "detail": "System Owner, Content Author, Query Reviewer roles defined. Missing: formal organizational chart, reporting lines, authority assignments.",
     "points_of_focus": ["Reporting lines", "Defining roles", "Separation of duties"]},
    {"id": "CC1.4", "category": "Security", "title": "COSO Principle 4: Demonstrates Commitment to Competence",
     "status": "partial",
     "detail": "NASA standards require specific competencies. Missing: competency requirements, training plans, performance evaluations.",
     "points_of_focus": ["HR policies", "Competency standards", "Development plans"]},
    {"id": "CC1.5", "category": "Security", "title": "COSO Principle 5: Enforces Accountability",
     "status": "partial",
     "detail": "Code review checklist enforces standards. Git commits create accountability trail. Missing: formal performance measures for security compliance.",
     "points_of_focus": ["Accountability structure", "Performance measures", "Rewards/discipline"]},

    # ── CC2: Communication and Information ──
    {"id": "CC2.1", "category": "Security", "title": "COSO Principle 13: Uses Relevant Information",
     "status": "addressed",
     "detail": "System card documents data flows, dependencies, risks. Compliance snapshots capture system state. Evidence mappings track requirement-to-artifact links.",
     "points_of_focus": ["Internal information", "External information", "Information processing"]},
    {"id": "CC2.2", "category": "Security", "title": "COSO Principle 14: Communicates Internally",
     "status": "partial",
     "detail": "Health check endpoint, scoring alerts, compliance reports communicate system state. Missing: formal internal communication channels and procedures.",
     "points_of_focus": ["Communication methods", "Responsibility", "Policies and procedures"]},
    {"id": "CC2.3", "category": "Security", "title": "COSO Principle 15: Communicates Externally",
     "status": "gap",
     "detail": "No external communication procedures. Must establish channels for communicating with external parties about system security.",
     "points_of_focus": ["External stakeholders", "Communication methods", "Reporting channels"]},

    # ── CC3: Risk Assessment ──
    {"id": "CC3.1", "category": "Security", "title": "COSO Principle 6: Specifies Suitable Objectives",
     "status": "addressed",
     "detail": "8 KPIs with targets defined. Security objectives documented in governance. Compliance objectives tracked via snapshots.",
     "points_of_focus": ["Operations objectives", "External reporting", "Compliance objectives"]},
    {"id": "CC3.2", "category": "Security", "title": "COSO Principle 7: Identifies and Analyzes Risk",
     "status": "addressed",
     "detail": "Risk register with 15 failure modes. Likelihood x impact scoring. Risk map documented. Includes third-party risks (Anthropic API).",
     "points_of_focus": ["Entity-level risks", "Process-level risks", "Risk analysis", "Significance assessment"]},
    {"id": "CC3.3", "category": "Security", "title": "COSO Principle 8: Assesses Fraud Risk",
     "status": "partial",
     "detail": "Input guard detects adversarial/injection attempts. Missing: formal fraud risk assessment considering incentives, pressures, rationalization.",
     "points_of_focus": ["Incentives/pressures", "Opportunities", "Attitudes/rationalizations", "Fraud types"]},
    {"id": "CC3.4", "category": "Security", "title": "COSO Principle 9: Identifies and Analyzes Significant Change",
     "status": "partial",
     "detail": "Model version tracking. Compliance snapshots show trend data. Missing: formal change impact assessment process.",
     "points_of_focus": ["External environment changes", "Business model changes", "Leadership changes"]},

    # ── CC4: Monitoring Activities ──
    {"id": "CC4.1", "category": "Security", "title": "COSO Principle 16: Selects, Develops, and Performs Ongoing/Separate Evaluations",
     "status": "addressed",
     "detail": "Scoring health monitor (ongoing). Compliance audit (periodic). Evidence map verification (separate evaluation). Management review cadence tracked.",
     "points_of_focus": ["Ongoing monitoring", "Separate evaluations", "Combination of approaches"]},
    {"id": "CC4.2", "category": "Security", "title": "COSO Principle 17: Evaluates and Communicates Deficiencies",
     "status": "addressed",
     "detail": "Circuit breaker triggers on threshold violations. Compliance snapshots track deficiencies with diff. Management review captures findings and action items.",
     "points_of_focus": ["Deficiency identification", "Corrective action", "Communication to appropriate parties"]},

    # ── CC5: Control Activities ──
    {"id": "CC5.1", "category": "Security", "title": "COSO Principle 10: Selects and Develops Control Activities",
     "status": "partial",
     "detail": "Input guard, output risk tagging, scoring health monitor are control activities. Missing: formal control activity inventory with risk-to-control mapping.",
     "points_of_focus": ["Risk mitigation activities", "Technology controls", "Policy-level activities"]},
    {"id": "CC5.2", "category": "Security", "title": "COSO Principle 11: Selects and Develops General Controls over Technology",
     "status": "partial",
     "detail": "Database access via ORM. API endpoint security (input validation). Missing: network security controls, infrastructure controls, change management automation.",
     "points_of_focus": ["Technology infrastructure", "Security management", "Technology acquisition"]},
    {"id": "CC5.3", "category": "Security", "title": "COSO Principle 12: Deploys Through Policies and Procedures",
     "status": "partial",
     "detail": "CLAUDE.md, governance.md, NASA standards define policies. Missing: procedure documents, policy acknowledgment, policy review cadence.",
     "points_of_focus": ["Policy establishment", "Procedure deployment", "Timely execution"]},

    # ── CC6: Logical and Physical Access Controls ──
    {"id": "CC6.1", "category": "Security", "title": "Logical Access Security Software, Infrastructure, and Architectures",
     "status": "gap",
     "detail": "No authentication or authorization layer. No identity management. Must implement logical access controls before multi-user deployment.",
     "points_of_focus": ["User identification/authentication", "Access credentials", "Password policies", "MFA"]},
    {"id": "CC6.2", "category": "Security", "title": "Prior to Issuing System Credentials and Granting System Access, Register and Authorize New Users",
     "status": "gap",
     "detail": "No user registration or authorization process. Must implement user provisioning with appropriate approval workflows.",
     "points_of_focus": ["Registration authorization", "Account provisioning", "Credential management"]},
    {"id": "CC6.3", "category": "Security", "title": "Authorize, Modify, or Remove Access Based on Role/Responsibilities",
     "status": "gap",
     "detail": "No role-based access control. Must implement RBAC with access reviews and modification/removal procedures.",
     "points_of_focus": ["Role assignment", "Access reviews", "Access modification/removal"]},
    {"id": "CC6.4", "category": "Security", "title": "Restrict Physical Access to Facilities and Protected Information Assets",
     "status": "inherited",
     "detail": "Physical access controls inherited from hosting environment (cloud/facility).",
     "points_of_focus": ["Physical access controls", "Monitoring", "Visitor management"]},
    {"id": "CC6.5", "category": "Security", "title": "Discontinue Logical and Physical Protections over Physical Assets Only After Removal Capability",
     "status": "not_applicable",
     "detail": "Software product. Physical asset disposal is organizational responsibility.",
     "points_of_focus": ["Asset disposal", "Data destruction", "Media sanitization"]},
    {"id": "CC6.6", "category": "Security", "title": "Manage Logical Access Security Measures Against Threats from External Sources",
     "status": "partial",
     "detail": "Input guard blocks injection attacks. Localhost-only deployment limits exposure. Missing: firewall rules, network segmentation, WAF.",
     "points_of_focus": ["Boundary protection", "Threat protection", "Encryption in transit"]},
    {"id": "CC6.7", "category": "Security", "title": "Restrict Transmission, Movement, and Removal of Information to Authorized Users/Processes",
     "status": "partial",
     "detail": "Data stays local except assembled prompts to Anthropic API. No data export functionality. Missing: DLP controls, transmission authorization.",
     "points_of_focus": ["Data transmission controls", "DLP", "Encryption"]},
    {"id": "CC6.8", "category": "Security", "title": "Prevent or Detect Against Installation of Unauthorized Software",
     "status": "partial",
     "detail": "requirements.txt pins dependencies. No runtime software installation capability. Missing: software integrity verification, allowlisting.",
     "points_of_focus": ["Software installation controls", "Detection mechanisms", "Allowlisting"]},

    # ── CC7: System Operations ──
    {"id": "CC7.1", "category": "Security", "title": "Detect and Monitor for Security Events, Anomalies, and Vulnerabilities",
     "status": "partial",
     "detail": "Scoring health monitor detects quality anomalies. Input guard detects attack patterns. Missing: vulnerability scanning, security event monitoring, SIEM.",
     "points_of_focus": ["Detection mechanisms", "Event monitoring", "Vulnerability management"]},
    {"id": "CC7.2", "category": "Security", "title": "Monitor System Components for Anomalous Activity Indicative of Malicious Acts",
     "status": "partial",
     "detail": "AuditMiddleware logs all state-changing requests. Circuit breaker detects operational anomalies. Corvus alerts on patterns. Audit log summary provides error rate and endpoint activity correlation. Missing: real-time security alerting.",
     "points_of_focus": ["Anomaly detection", "Malicious activity indicators", "Alert investigation"]},
    {"id": "CC7.3", "category": "Security", "title": "Evaluate Security Events to Determine if They Could or Have Resulted in a Failure",
     "status": "partial",
     "detail": "Audit log captures all state-changing events with status codes. Error responses (4xx/5xx) flagged. P1-P4 severity classification exists. Missing: automated security event evaluation and escalation.",
     "points_of_focus": ["Event evaluation", "Impact assessment", "Root cause analysis"]},
    {"id": "CC7.4", "category": "Security", "title": "Respond to Identified Security Incidents",
     "status": "partial",
     "detail": "Circuit breaker provides automated response. Governance.md defines severity levels and procedures. Missing: dedicated incident response team, communication plan.",
     "points_of_focus": ["Incident containment", "Eradication", "Recovery", "Communication"]},
    {"id": "CC7.5", "category": "Security", "title": "Identify, Develop, and Implement Activities to Recover from Identified Security Incidents",
     "status": "gap",
     "detail": "No formal recovery procedures. Neuron checkpoints provide some state recovery. Missing: recovery plan, post-incident review process.",
     "points_of_focus": ["Recovery planning", "Post-incident review", "Lessons learned"]},

    # ── CC8: Change Management ──
    {"id": "CC8.1", "category": "Security", "title": "Authorize, Design, Develop, Configure, Document, Test, Approve, and Implement Changes",
     "status": "partial",
     "detail": "Git tracks all changes. NASA code review checklist. pytest test suite. Database migration verification. Missing: formal change approval workflow, segregation of change duties.",
     "points_of_focus": ["Change authorization", "Change testing", "Change documentation", "Change approval"]},

    # ── CC9: Risk Mitigation ──
    {"id": "CC9.1", "category": "Security", "title": "Identify and Assess Risks Related to Vendor/Business Partner Relationships",
     "status": "addressed",
     "detail": "Anthropic API vendor risk documented with likelihood, impact, and mitigation strategies. Dependency risks tracked via pinned versions.",
     "points_of_focus": ["Vendor risk assessment", "Contract requirements", "Ongoing monitoring"]},
    {"id": "CC9.2", "category": "Security", "title": "Assess and Manage Risks Associated with Vendors and Business Partners",
     "status": "partial",
     "detail": "Anthropic risk documented. Missing: formal vendor management program, regular vendor reviews, vendor SLA tracking.",
     "points_of_focus": ["Vendor management", "Performance monitoring", "Subservice organizations"]},

    # ── A1: Availability ──
    {"id": "A1.1", "category": "Availability", "title": "Maintain, Monitor, and Evaluate Current Processing Capacity",
     "status": "partial",
     "detail": "Health check endpoint monitors system status. Token usage tracked. Missing: capacity planning, demand forecasting, scalability testing.",
     "points_of_focus": ["Capacity monitoring", "Performance tracking", "Demand management"]},
    {"id": "A1.2", "category": "Availability", "title": "Authorize, Design, Develop, Implement, Operate, and Monitor Environmental Protections",
     "status": "inherited",
     "detail": "Environmental protections inherited from hosting environment.",
     "points_of_focus": ["Environmental controls", "Power management", "Fire suppression"]},
    {"id": "A1.3", "category": "Availability", "title": "Recover Operations Timely, Including Backup and Recovery Processes",
     "status": "partial",
     "detail": "Neuron checkpoints for graph state recovery. Missing: documented RTO/RPO, automated backups, backup testing, DR plan.",
     "points_of_focus": ["Backup procedures", "Recovery testing", "RTO/RPO targets", "Business continuity"]},

    # ── PI1: Processing Integrity ──
    {"id": "PI1.1", "category": "Processing Integrity", "title": "Obtain or Generate, Use, and Communicate Accurate Information",
     "status": "addressed",
     "detail": "Neuron scoring is deterministic with 5-signal formula. Output grounding checks. Faithfulness evaluation. Full provenance logged.",
     "points_of_focus": ["Data completeness", "Data accuracy", "Input validation"]},
    {"id": "PI1.2", "category": "Processing Integrity", "title": "Implement Policies and Procedures Over System Inputs to Result in Products That Meet Specifications",
     "status": "addressed",
     "detail": "Input guard validates all inputs. Classification stage verifies query intent. Length limits enforce boundaries. 24-test adversarial suite.",
     "points_of_focus": ["Input authorization", "Input validation", "Error handling"]},
    {"id": "PI1.3", "category": "Processing Integrity", "title": "Implement Policies and Procedures Over System Processing to Result in Products That Meet Specifications",
     "status": "addressed",
     "detail": "Two-stage Haiku pipeline with defined processing steps. Scoring engine with documented signal formulas. Spread activation with bounded propagation.",
     "points_of_focus": ["Processing verification", "Exception handling", "System specifications"]},
    {"id": "PI1.4", "category": "Processing Integrity", "title": "Implement Policies and Procedures to Make Available Output Complete, Accurate, and Timely",
     "status": "addressed",
     "detail": "Output includes provenance (neurons fired, scores, model used). Grounding check validates accuracy. Token budgeting ensures completeness within limits.",
     "points_of_focus": ["Output completeness", "Output accuracy", "Output timeliness"]},
    {"id": "PI1.5", "category": "Processing Integrity", "title": "Implement Policies for Storing Inputs, Items in Processing, and Outputs",
     "status": "addressed",
     "detail": "All query inputs, processing results, and outputs stored in PostgreSQL with timestamps. Neuron checkpoints preserve graph state.",
     "points_of_focus": ["Data storage", "Retention", "Archiving"]},

    # ── C1: Confidentiality ──
    {"id": "C1.1", "category": "Confidentiality", "title": "Identify and Maintain Confidential Information",
     "status": "partial",
     "detail": "PII scanning identifies sensitive data. Corvus screen data marked ephemeral. Missing: formal data classification scheme, confidentiality categories.",
     "points_of_focus": ["Information classification", "Identification procedures", "Categorization"]},
    {"id": "C1.2", "category": "Confidentiality", "title": "Dispose of Confidential Information",
     "status": "partial",
     "detail": "Corvus frames never persisted (in-memory only). Missing: data disposal procedures, retention schedule, secure deletion verification.",
     "points_of_focus": ["Disposal procedures", "Retention policies", "Secure deletion"]},

    # ── P1: Privacy ──
    {"id": "P1.1", "category": "Privacy", "title": "Provide Notice About Privacy Practices",
     "status": "gap",
     "detail": "No privacy notice. Must provide notice regarding purpose, types of data, use, retention, and disclosure of personal information.",
     "points_of_focus": ["Notice content", "Notice timing", "Notice accessibility"]},
    {"id": "P1.2", "category": "Privacy", "title": "Provide Choice and Consent",
     "status": "gap",
     "detail": "No consent mechanism. Must provide choice and obtain consent for collection, use, and disclosure of personal information.",
     "points_of_focus": ["Consent mechanisms", "Choice options", "Opt-out procedures"]},
    {"id": "P1.3", "category": "Privacy", "title": "Collect Personal Information for Identified Purposes",
     "status": "partial",
     "detail": "System collects minimal personal data (queries only, no telemetry). PII scanning detects inadvertent PII. Missing: formal purpose limitation documentation.",
     "points_of_focus": ["Purpose limitation", "Collection limitation", "Minimization"]},
    {"id": "P1.4", "category": "Privacy", "title": "Limit the Use of Personal Information to Identified Purposes",
     "status": "partial",
     "detail": "Query data used only for neuron graph augmentation. No secondary use. Missing: formal use limitation policy.",
     "points_of_focus": ["Use limitation", "Secondary use restrictions", "Compatible purposes"]},
    {"id": "P1.5", "category": "Privacy", "title": "Retain Personal Information for Identified Purposes Only",
     "status": "gap",
     "detail": "No retention policy. Queries and Corvus captures retained indefinitely. Must define and enforce retention periods.",
     "points_of_focus": ["Retention periods", "Disposal procedures", "Retention review"]},
    {"id": "P1.6", "category": "Privacy", "title": "Dispose of Personal Information After Retention Period",
     "status": "gap",
     "detail": "No data disposal procedures. Must implement mechanisms to dispose of personal information after defined retention period.",
     "points_of_focus": ["Disposal methods", "Verification", "Timeliness"]},
    {"id": "P1.7", "category": "Privacy", "title": "Disclose Personal Information to Third Parties Only for Identified Purposes",
     "status": "partial",
     "detail": "Only assembled prompts (which may contain query text) sent to Anthropic API. No other third-party sharing. Missing: formal third-party disclosure policy.",
     "points_of_focus": ["Third-party agreements", "Disclosure limitations", "Accountability"]},
    {"id": "P1.8", "category": "Privacy", "title": "Communicate Privacy Incidents and Breaches",
     "status": "gap",
     "detail": "No privacy incident notification procedures. Must establish procedures for notifying affected individuals and authorities.",
     "points_of_focus": ["Notification procedures", "Timelines", "Affected party communication"]},
]


def get_soc2_criteria() -> list[dict]:
    """Return the full SOC 2 Type II Trust Services Criteria catalog."""
    return SOC2_CRITERIA


def get_soc2_summary() -> dict:
    """Return summary statistics for SOC 2 compliance posture."""
    total = len(SOC2_CRITERIA)
    counts: dict[str, int] = {}
    category_counts: dict[str, dict[str, int]] = {}

    for crit in SOC2_CRITERIA:
        status = crit["status"]
        counts[status] = counts.get(status, 0) + 1

        cat = crit["category"]
        if cat not in category_counts:
            category_counts[cat] = {"total": 0}
        category_counts[cat]["total"] = category_counts[cat].get("total", 0) + 1
        category_counts[cat][status] = category_counts[cat].get(status, 0) + 1

    return {
        "framework": "SOC 2 Type II",
        "standard": "AICPA Trust Services Criteria (2017/2022)",
        "total_criteria": total,
        "status_counts": counts,
        "categories": category_counts,
    }
