"""NASA NPR 7150.2D + JPL Power of Ten — ~20 rules for safety-critical software."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition

FRAMEWORK = "nasa"

_CONTROLS_DATA = [
    # JPL Power of Ten (Holzmann's 10 rules)
    ("JPL-1", "Power of Ten", "No recursion", "Restrict all code to very simple control flow — do not use direct or indirect recursion"),
    ("JPL-2", "Power of Ten", "Fixed upper bound for loops", "All loops must have a fixed upper bound to prevent runaway code"),
    ("JPL-3", "Power of Ten", "No dynamic memory allocation after init", "Do not use dynamic memory allocation after initialization"),
    ("JPL-4", "Power of Ten", "Function length limit", "No function should be longer than 60 lines of code"),
    ("JPL-5", "Power of Ten", "Assertion density", "Use a minimum of two assertions per function on average"),
    ("JPL-6", "Power of Ten", "Smallest scope for data", "Declare data objects at the smallest possible level of scope"),
    ("JPL-7", "Power of Ten", "Check return values", "Check the return value of all non-void functions, or cast to void to indicate intent"),
    ("JPL-8", "Power of Ten", "Restricted pointer use", "Limit use of the preprocessor to file inclusion and simple conditional compilation"),
    ("JPL-9", "Power of Ten", "Zero compiler warnings", "All code must compile with all warnings enabled and must produce zero warnings"),
    ("JPL-10", "Power of Ten", "Static analysis", "All code must be checked with at least one static analysis tool daily"),
    # NPR 7150.2D Requirements
    ("NPR-1", "NPR 7150.2D", "Software safety analysis", "Perform safety analysis including hazard identification and mitigation for safety-critical code"),
    ("NPR-2", "NPR 7150.2D", "Configuration management", "Every change must be traceable via git with descriptive commit messages"),
    ("NPR-3", "NPR 7150.2D", "Secure coding practices", "Validate inputs, sanitize outputs, no hardcoded credentials, no injection vectors"),
    ("NPR-4", "NPR 7150.2D", "Formal inspection", "Non-trivial changes require structured review against acceptance criteria before merge"),
    ("NPR-5", "NPR 7150.2D", "Testing and verification", "New features require verification evidence — smoke tests for endpoints, eval for LLM changes"),
    ("NPR-6", "NPR 7150.2D", "Software classification", "Classify and treat safety-relevant software with heightened review requirements"),
    ("NPR-7", "NPR 7150.2D", "Metrics and measurement", "Track token usage, model costs, pipeline latency. Keep cost projections visible"),
    ("NPR-8", "NPR 7150.2D", "Third-party software management", "Evaluate LLM model updates, dependency upgrades, SDK updates for behavioral impact"),
    ("NPR-9", "NPR 7150.2D", "Documentation", "Public endpoints have docstrings, schema changes include migration logic, prompts document intent"),
    ("NPR-10", "NPR 7150.2D", "Safety-critical coding standards", "Apply Power of Ten rules proportional to software criticality classification"),
]

_controls = [
    ControlDefinition(
        framework=FRAMEWORK,
        control_id=cid,
        title=title,
        family=family,
        description=desc,
        external_ref="https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7150_002D_" if family == "NPR 7150.2D" else "https://spinroot.com/p10/",
    )
    for cid, family, title, desc in _CONTROLS_DATA
]

registry.register_framework(FRAMEWORK, _controls)
