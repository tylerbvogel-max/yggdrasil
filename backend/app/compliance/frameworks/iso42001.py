"""ISO/IEC 42001:2023 — AI Management System. 38 Annex A + ~25 clause requirements."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition

FRAMEWORK = "iso42001"

_ISO_REF = "https://www.iso.org/standard/81230.html"

_CONTROLS_DATA = [
    # Clause requirements (4-10)
    ("CL4.1", "Context of the Organization", "Understanding the organization and its context", "Determine external/internal issues relevant to AI management system"),
    ("CL4.2", "Context of the Organization", "Understanding the needs and expectations of interested parties", "Identify interested parties and their requirements for the AI management system"),
    ("CL4.3", "Context of the Organization", "Determining the scope of the AIMS", "Define boundaries and applicability of the AI management system"),
    ("CL4.4", "Context of the Organization", "AI management system", "Establish, implement, maintain and continually improve the AIMS"),
    ("CL5.1", "Leadership", "Leadership and commitment", "Top management demonstrates leadership and commitment to the AIMS"),
    ("CL5.2", "Leadership", "AI policy", "Establish an AI policy appropriate to the purpose of the organization"),
    ("CL5.3", "Leadership", "Organizational roles, responsibilities and authorities", "Assign and communicate responsibilities for the AIMS"),
    ("CL6.1", "Planning", "Actions to address risks and opportunities", "Determine risks and opportunities for the AIMS"),
    ("CL6.2", "Planning", "AI objectives and planning to achieve them", "Establish measurable AI objectives consistent with the AI policy"),
    ("CL7.1", "Support", "Resources", "Determine and provide resources needed for the AIMS"),
    ("CL7.2", "Support", "Competence", "Determine necessary competence for AI management"),
    ("CL7.3", "Support", "Awareness", "Ensure persons are aware of the AI policy and their contributions"),
    ("CL7.4", "Support", "Communication", "Determine internal/external communications relevant to the AIMS"),
    ("CL7.5", "Support", "Documented information", "Include documented information required by the AIMS"),
    ("CL8.1", "Operation", "Operational planning and control", "Plan, implement and control processes for the AIMS"),
    ("CL8.2", "Operation", "AI risk assessment", "Perform AI risk assessments at planned intervals"),
    ("CL8.3", "Operation", "AI risk treatment", "Implement AI risk treatment plan"),
    ("CL8.4", "Operation", "AI system impact assessment", "Conduct impact assessments for AI systems"),
    ("CL9.1", "Performance Evaluation", "Monitoring, measurement, analysis and evaluation", "Determine what needs to be monitored and measured"),
    ("CL9.2", "Performance Evaluation", "Internal audit", "Conduct internal audits at planned intervals"),
    ("CL9.3", "Performance Evaluation", "Management review", "Review the AIMS at planned intervals"),
    ("CL10.1", "Improvement", "Continual improvement", "Continually improve the suitability, adequacy and effectiveness"),
    ("CL10.2", "Improvement", "Nonconformity and corrective action", "React to nonconformities and take corrective action"),
    # Annex A controls (A.2-A.10, 9 domains)
    ("A.2.2", "AI Policies", "AI policy", "Document organizational AI policies aligned with objectives"),
    ("A.2.3", "AI Policies", "Internal use AI policy", "Policy governing internal development and use of AI"),
    ("A.2.4", "AI Policies", "Responsibility for AI systems", "Assign responsibility for AI systems throughout their lifecycle"),
    ("A.3.2", "Internal Organization", "Roles and responsibilities", "Define AI-related roles and responsibilities"),
    ("A.3.3", "Internal Organization", "Reporting", "Establish reporting mechanisms for AI-related concerns"),
    ("A.3.4", "Internal Organization", "Allocation of resources for AIMS", "Ensure adequate resources for AI management"),
    ("A.4.2", "Resources for AI Systems", "Resources for AI systems", "Provide resources for development, deployment, and operation of AI"),
    ("A.4.3", "Resources for AI Systems", "AI knowledge and skills", "Maintain required AI competencies across the organization"),
    ("A.4.4", "Resources for AI Systems", "AI tools and utilities", "Provide and maintain tools for AI development and deployment"),
    ("A.5.2", "Assessing Impacts of AI Systems", "AI system impact assessment process", "Assess impacts of AI on individuals, groups, and society"),
    ("A.5.3", "Assessing Impacts of AI Systems", "Documentation of AI system impact assessment", "Document and maintain impact assessments"),
    ("A.5.4", "Assessing Impacts of AI Systems", "AI risk assessment", "Conduct risk assessment for each AI system"),
    ("A.6.2", "AI System Lifecycle", "Responsible AI design and development", "Ensure responsible design aligned with organizational values"),
    ("A.6.2.2", "AI System Lifecycle", "Data for AI systems", "Manage data quality, provenance, and appropriateness"),
    ("A.6.2.3", "AI System Lifecycle", "Acquisition of technology, products and services", "Evaluate third-party AI components before acquisition"),
    ("A.6.2.4", "AI System Lifecycle", "AI system design and development", "Follow responsible design principles"),
    ("A.6.2.5", "AI System Lifecycle", "AI system testing", "Test AI systems for intended performance and safety"),
    ("A.6.2.6", "AI System Lifecycle", "AI system release", "Establish release criteria and approval processes"),
    ("A.7.2", "Data for AI Systems", "Data management", "Establish data management processes for AI systems"),
    ("A.7.3", "Data for AI Systems", "Data quality for AI", "Define and monitor data quality requirements"),
    ("A.7.4", "Data for AI Systems", "Data provenance", "Track data lineage and provenance"),
    ("A.7.5", "Data for AI Systems", "Data preparation", "Ensure appropriate data preparation and labeling"),
    ("A.8.2", "Information for Interested Parties", "Communication regarding use of AI", "Inform parties about AI system use and its implications"),
    ("A.8.3", "Information for Interested Parties", "External communication", "Communicate externally about AI practices"),
    ("A.8.4", "Information for Interested Parties", "Interaction with AI systems", "Ensure appropriate interaction design for AI systems"),
    ("A.9.2", "Use of AI Systems", "Intended use documentation", "Document intended use and limitations of AI systems"),
    ("A.9.3", "Use of AI Systems", "AI system operation and monitoring", "Monitor AI system performance during operation"),
    ("A.9.4", "Use of AI Systems", "Log records of AI system", "Maintain logs for AI system operations"),
    ("A.10.2", "Third-Party and Customer Relationships", "Suppliers", "Manage AI-related supplier relationships"),
    ("A.10.3", "Third-Party and Customer Relationships", "Customers", "Manage customer relationships for AI products/services"),
    ("A.10.4", "Third-Party and Customer Relationships", "Transfer or sharing of data and tools", "Control transfer of AI data and tools to third parties"),
]

_controls = [
    ControlDefinition(
        framework=FRAMEWORK,
        control_id=cid,
        title=title,
        family=family,
        description=desc,
        external_ref=_ISO_REF,
    )
    for cid, family, title, desc in _CONTROLS_DATA
]

registry.register_framework(FRAMEWORK, _controls)
