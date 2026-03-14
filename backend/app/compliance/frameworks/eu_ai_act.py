"""EU AI Act (2024/1689) — ~54 sub-requirements from key Articles."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition

FRAMEWORK = "eu_ai_act"

_EUR_LEX = "https://eur-lex.europa.eu/eli/reg/2024/1689/oj"

_CONTROLS_DATA = [
    # Article 9 — Risk Management System (12 subs)
    ("Art9.1", "Risk Management", "Establish risk management system", "Establish, implement, document and maintain a risk management system"),
    ("Art9.2a", "Risk Management", "Identify and analyze known and foreseeable risks", "Identification and analysis of known and foreseeable risks to health, safety or fundamental rights"),
    ("Art9.2b", "Risk Management", "Estimate and evaluate risks", "Estimation and evaluation of risks that may emerge during intended use and reasonably foreseeable misuse"),
    ("Art9.2c", "Risk Management", "Evaluate risks from post-market monitoring", "Evaluation of risks from post-market monitoring data analysis"),
    ("Art9.2d", "Risk Management", "Adopt risk management measures", "Adoption of appropriate and targeted risk management measures"),
    ("Art9.3", "Risk Management", "Residual risk assessment", "Ensure residual risk is acceptable when risk management measures are applied"),
    ("Art9.4", "Risk Management", "Testing for risk management", "Testing procedures to identify appropriate risk management measures"),
    ("Art9.5", "Risk Management", "Consider impact on vulnerable groups", "Due consideration to impact on persons under 18 and other vulnerable groups"),
    ("Art9.6", "Risk Management", "Technical knowledge and experience", "Risk management considering technical knowledge, experience and state of the art"),
    ("Art9.7", "Risk Management", "Testing at appropriate stages", "Testing at appropriate stages of development including before placing on market"),
    ("Art9.8", "Risk Management", "Integration with quality management", "Risk management system integrated with quality management system"),
    ("Art9.9", "Risk Management", "Continuous iterative process", "Risk management as a continuous iterative process throughout lifecycle"),
    # Article 10 — Data and Data Governance (6 subs)
    ("Art10.1", "Data Governance", "Training data governance", "High-risk AI training, validation and testing datasets subject to data governance"),
    ("Art10.2", "Data Governance", "Data quality criteria", "Training datasets shall be relevant, sufficiently representative, and to the best extent, free of errors and complete"),
    ("Art10.3", "Data Governance", "Data collection and selection", "Appropriate data collection, preparation, and selection processes"),
    ("Art10.4", "Data Governance", "Statistical properties and bias", "Examine data in view of possible biases that are likely to affect health and safety or lead to discrimination"),
    ("Art10.5", "Data Governance", "Data proportionality", "Processing of special categories of data to the extent strictly necessary for bias monitoring"),
    ("Art10.6", "Data Governance", "Dataset documentation", "Appropriate data governance and management practices for datasets"),
    # Article 11 — Technical Documentation (4+ Annex IV)
    ("Art11.1", "Technical Documentation", "Draw up technical documentation", "Technical documentation drawn up before system is placed on market and kept up to date"),
    ("Art11.2", "Technical Documentation", "SME simplified documentation", "Simplified technical documentation for SMEs including start-ups"),
    ("Art11.3", "Technical Documentation", "Single technical documentation", "Single set of technical documentation for multiple related AI systems"),
    ("Art11.AnnIV", "Technical Documentation", "Annex IV requirements", "Technical documentation contains all elements specified in Annex IV"),
    # Article 12 — Record-Keeping (4)
    ("Art12.1", "Record-Keeping", "Automatic logging capability", "High-risk AI systems designed to enable automatic recording of events (logs)"),
    ("Art12.2", "Record-Keeping", "Traceability of functioning", "Logging enables traceability of AI system functioning throughout its lifecycle"),
    ("Art12.3", "Record-Keeping", "Adequate logging periods", "Logging for period appropriate to intended purpose and applicable legal obligations"),
    ("Art12.4", "Record-Keeping", "Logging technical standards", "Logging capabilities conforming to recognized standards or common specifications"),
    # Article 13 — Transparency and Provision of Information (5)
    ("Art13.1", "Transparency", "Transparency for deployers", "High-risk AI systems designed to enable deployers to interpret output and use appropriately"),
    ("Art13.2", "Transparency", "Instructions for use", "Accompanied by instructions for use in appropriate digital format including concise, correct, clear information"),
    ("Art13.3a", "Transparency", "Provider identity and contact", "Name and contact details of the provider"),
    ("Art13.3b", "Transparency", "System characteristics and performance", "Characteristics, capabilities and limitations of performance"),
    ("Art13.3c", "Transparency", "Changes and pre-determined modifications", "Information about changes throughout lifecycle"),
    # Article 14 — Human Oversight (5)
    ("Art14.1", "Human Oversight", "Design for human oversight", "High-risk AI systems designed to be effectively overseen by natural persons"),
    ("Art14.2", "Human Oversight", "Appropriate human-machine interface", "AI system equipped with appropriate human-machine interface tools"),
    ("Art14.3a", "Human Oversight", "Understand system capacities", "Measures to enable individuals to properly understand relevant capacities and limitations"),
    ("Art14.3b", "Human Oversight", "Monitor operation", "Measures to enable individuals to remain aware of automation bias"),
    ("Art14.4", "Human Oversight", "Ability to override/reverse", "Measures to enable individuals to decide not to use, override, or reverse the AI system output"),
    # Article 15 — Accuracy, Robustness and Cybersecurity (5)
    ("Art15.1", "Accuracy & Robustness", "Appropriate level of accuracy", "High-risk AI systems designed to achieve appropriate level of accuracy, robustness and cybersecurity"),
    ("Art15.2", "Accuracy & Robustness", "Resilience against errors", "Technical redundancy solutions including backup or fail-safe plans"),
    ("Art15.3", "Accuracy & Robustness", "Robustness against manipulation", "Resilient against attempts by unauthorized third parties to alter use or performance"),
    ("Art15.4", "Accuracy & Robustness", "Cybersecurity measures", "Technical solutions to address AI-specific vulnerabilities including data poisoning and adversarial examples"),
    ("Art15.5", "Accuracy & Robustness", "Performance metrics declared", "Levels of accuracy and relevant metrics declared in instructions for use"),
    # Article 17 — Quality Management System (13)
    ("Art17.1a", "Quality Management", "Strategy for regulatory compliance", "Quality management system ensuring compliance with this regulation"),
    ("Art17.1b", "Quality Management", "Techniques and procedures for design", "Techniques, procedures and systematic actions for design, design control, design verification"),
    ("Art17.1c", "Quality Management", "Development and examination", "Techniques, procedures for development, quality control, quality assurance"),
    ("Art17.1d", "Quality Management", "Data management", "Examination, test and validation procedures for data management"),
    ("Art17.1e", "Quality Management", "Risk management system", "Risk management system as referred to in Article 9"),
    ("Art17.1f", "Quality Management", "Post-market monitoring", "Setting-up, implementation and maintenance of a post-market monitoring system"),
    ("Art17.1g", "Quality Management", "Incident reporting", "Procedures related to incident reporting in accordance with Article 73"),
    ("Art17.1h", "Quality Management", "Communication with authorities", "Handling communication with competent authorities and notified bodies"),
    ("Art17.1i", "Quality Management", "Record-keeping systems", "Systems and procedures for record keeping of all relevant documentation"),
    ("Art17.1j", "Quality Management", "Resource management", "Resource management including security-of-supply measures"),
    ("Art17.1k", "Quality Management", "Accountability framework", "An accountability framework setting out responsibilities of management and other staff"),
    ("Art17.1l", "Quality Management", "Document control", "Appropriate document control, information management system"),
    ("Art17.1m", "Quality Management", "Corrective actions", "Procedures for corrective and preventive actions"),
    # Article 50 — Transparency Obligations
    ("Art50.1", "Transparency Obligations", "AI interaction disclosure", "Providers shall ensure AI systems intended to interact with natural persons inform them of AI interaction"),
    ("Art50.2", "Transparency Obligations", "Synthetic content marking", "Providers of AI systems generating synthetic content shall ensure outputs are machine-readable and marked as artificially generated"),
    ("Art50.3", "Transparency Obligations", "Deep fake disclosure", "Deployers using deep fakes shall disclose that content has been artificially generated or manipulated"),
    ("Art50.4", "Transparency Obligations", "Emotion recognition disclosure", "Deployers using emotion recognition or biometric categorization shall inform persons of operation"),
]

_controls = [
    ControlDefinition(
        framework=FRAMEWORK,
        control_id=cid,
        title=title,
        family=family,
        description=desc,
        external_ref=_EUR_LEX,
    )
    for cid, family, title, desc in _CONTROLS_DATA
]

registry.register_framework(FRAMEWORK, _controls)
