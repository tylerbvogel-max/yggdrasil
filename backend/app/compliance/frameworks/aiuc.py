"""AIUC-1 — AI Use & Compliance framework. ~50 controls across 6 domains."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition

FRAMEWORK = "aiuc"

_AIUC_REF = "https://aiuc-1.com"

_CONTROLS_DATA = [
    # Domain 1: Data & Privacy
    ("DP-1", "Data & Privacy", "Data inventory and classification", "Maintain inventory of all data used in AI systems with classification labels"),
    ("DP-2", "Data & Privacy", "Data minimization", "Collect and process only data necessary for the AI system's purpose"),
    ("DP-3", "Data & Privacy", "Consent management", "Obtain and manage consent for data collection and processing"),
    ("DP-4", "Data & Privacy", "Data subject rights", "Implement mechanisms for data access, correction, deletion requests"),
    ("DP-5", "Data & Privacy", "Data retention policies", "Define and enforce data retention and deletion schedules"),
    ("DP-6", "Data & Privacy", "Cross-border data transfers", "Ensure compliance with cross-border data transfer regulations"),
    ("DP-7", "Data & Privacy", "Privacy impact assessment", "Conduct privacy impact assessments for AI systems processing personal data"),
    ("DP-8", "Data & Privacy", "Data breach notification", "Establish procedures for data breach detection, assessment, and notification"),
    # Domain 2: Security
    ("SEC-1", "Security", "AI system access control", "Implement role-based access controls for AI systems and training data"),
    ("SEC-2", "Security", "Model security", "Protect AI models from theft, tampering, and unauthorized access"),
    ("SEC-3", "Security", "Adversarial robustness", "Test and mitigate against adversarial attacks on AI systems"),
    ("SEC-4", "Security", "Supply chain security", "Assess security risks in AI development supply chain and dependencies"),
    ("SEC-5", "Security", "Secure development lifecycle", "Integrate security practices throughout the AI development lifecycle"),
    ("SEC-6", "Security", "Incident response for AI", "Develop AI-specific incident response procedures"),
    ("SEC-7", "Security", "Data poisoning prevention", "Implement controls to detect and prevent data poisoning attacks"),
    ("SEC-8", "Security", "Encryption and data protection", "Apply encryption for AI data at rest and in transit"),
    # Domain 3: Safety
    ("SAF-1", "Safety", "Safety risk assessment", "Conduct safety risk assessments for AI systems before deployment"),
    ("SAF-2", "Safety", "Human oversight mechanisms", "Implement human-in-the-loop or human-on-the-loop controls"),
    ("SAF-3", "Safety", "Fail-safe design", "Design AI systems with graceful degradation and fail-safe mechanisms"),
    ("SAF-4", "Safety", "Testing and validation", "Comprehensive testing including edge cases, stress tests, and boundary conditions"),
    ("SAF-5", "Safety", "Continuous monitoring", "Monitor AI system behavior in production for safety-relevant anomalies"),
    ("SAF-6", "Safety", "Emergency shutdown", "Implement ability to immediately disable or override AI system outputs"),
    ("SAF-7", "Safety", "Safety documentation", "Document safety requirements, test results, and known limitations"),
    ("SAF-8", "Safety", "Child safety protections", "Implement additional safeguards for AI systems accessible to minors"),
    # Domain 4: Reliability
    ("REL-1", "Reliability", "Performance benchmarks", "Establish and maintain performance benchmarks for AI systems"),
    ("REL-2", "Reliability", "Model drift detection", "Monitor for and detect model drift in production"),
    ("REL-3", "Reliability", "Reproducibility", "Ensure AI system outputs are reproducible under same conditions"),
    ("REL-4", "Reliability", "Availability and resilience", "Maintain uptime and recovery capabilities for AI-dependent services"),
    ("REL-5", "Reliability", "Scalability planning", "Plan for scaling AI systems to meet demand without quality degradation"),
    ("REL-6", "Reliability", "Version control and rollback", "Maintain versioned models with ability to rollback to previous versions"),
    ("REL-7", "Reliability", "Dependency management", "Track and manage AI system dependencies including models and libraries"),
    ("REL-8", "Reliability", "Automated testing pipeline", "Implement automated testing for AI model updates and code changes"),
    # Domain 5: Accountability
    ("ACC-1", "Accountability", "AI governance framework", "Establish organizational AI governance structure and policies"),
    ("ACC-2", "Accountability", "Audit trails", "Maintain comprehensive audit trails for AI system decisions and changes"),
    ("ACC-3", "Accountability", "Explainability", "Provide explanations for AI system decisions at appropriate levels"),
    ("ACC-4", "Accountability", "Impact assessments", "Conduct and document impact assessments before AI system deployment"),
    ("ACC-5", "Accountability", "Complaints and redress", "Establish mechanisms for complaints about AI system decisions"),
    ("ACC-6", "Accountability", "Third-party auditing", "Support independent third-party auditing of AI systems"),
    ("ACC-7", "Accountability", "Regulatory reporting", "Meet reporting obligations to relevant regulatory authorities"),
    ("ACC-8", "Accountability", "Documentation and record-keeping", "Maintain documentation of AI system design, development, and deployment decisions"),
    # Domain 6: Society
    ("SOC-1", "Society", "Fairness and non-discrimination", "Assess and mitigate biases that could lead to discriminatory outcomes"),
    ("SOC-2", "Society", "Inclusivity and accessibility", "Design AI systems that are inclusive and accessible to diverse populations"),
    ("SOC-3", "Society", "Environmental impact", "Assess and minimize environmental impact of AI system development and operation"),
    ("SOC-4", "Society", "Labor impact assessment", "Evaluate and communicate AI impact on employment and workforce"),
    ("SOC-5", "Society", "Cultural sensitivity", "Consider cultural contexts and sensitivities in AI system design"),
    ("SOC-6", "Society", "Public communication", "Communicate clearly and honestly about AI capabilities and limitations"),
    ("SOC-7", "Society", "Community engagement", "Engage with affected communities in AI system design and deployment"),
    ("SOC-8", "Society", "Dual-use risk assessment", "Assess potential for misuse or dual-use of AI systems"),
    ("SOC-9", "Society", "Digital divide consideration", "Consider and mitigate impacts on digitally disadvantaged populations"),
]

_controls = [
    ControlDefinition(
        framework=FRAMEWORK,
        control_id=cid,
        title=title,
        family=family,
        description=desc,
        external_ref=_AIUC_REF,
    )
    for cid, family, title, desc in _CONTROLS_DATA
]

registry.register_framework(FRAMEWORK, _controls)
