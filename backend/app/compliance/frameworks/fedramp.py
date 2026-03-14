"""FedRAMP Moderate baseline — 259 controls from NIST SP 800-53 Rev 5."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition
from app.data.fedramp_moderate_baseline import FEDRAMP_MODERATE_CONTROLS, CONTROL_FAMILIES

FRAMEWORK = "fedramp"

_controls = []
for entry in FEDRAMP_MODERATE_CONTROLS:
    family_code = entry["family"]
    family_name = CONTROL_FAMILIES.get(family_code, family_code)
    ctrl_id = entry["id"]
    _controls.append(ControlDefinition(
        framework=FRAMEWORK,
        control_id=ctrl_id,
        title=entry["title"],
        family=family_name,
        description=entry.get("detail", ""),
        external_ref=f"https://csrc.nist.gov/projects/cprt/catalog#/cprt/framework/version/SP_800_53_5_1_1/home/select/control/{ctrl_id}",
    ))

registry.register_framework(FRAMEWORK, _controls)
