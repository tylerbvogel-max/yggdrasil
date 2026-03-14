"""SOC 2 Type II Trust Services Criteria — 51 criteria."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition
from app.data.soc2_type2_criteria import SOC2_CRITERIA

FRAMEWORK = "soc2"

_controls = []
for entry in SOC2_CRITERIA:
    _controls.append(ControlDefinition(
        framework=FRAMEWORK,
        control_id=entry["id"],
        title=entry["title"],
        family=entry["category"],
        description=entry.get("detail", ""),
        external_ref="https://us.aicpa.org/interestareas/frc/assuranceadvisoryservices/trustservicescriteria",
    ))

registry.register_framework(FRAMEWORK, _controls)
