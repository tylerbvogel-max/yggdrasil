"""CMMC Level 2 — 110 practices from NIST SP 800-171 Rev 2."""

from app.compliance.registry import registry
from app.compliance.types import ControlDefinition
from app.data.cmmc_level2_practices import CMMC_PRACTICES

FRAMEWORK = "cmmc"

_controls = []
for entry in CMMC_PRACTICES:
    _controls.append(ControlDefinition(
        framework=FRAMEWORK,
        control_id=entry["id"],
        title=entry["title"],
        family=entry["family_name"],
        description=entry.get("detail", ""),
        external_ref=f"https://csf.tools/reference/nist-sp-800-171/r2/{entry['id']}/",
    ))

registry.register_framework(FRAMEWORK, _controls)
