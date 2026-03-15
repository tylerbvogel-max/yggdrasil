"""Control registry — singleton that maps frameworks, controls, and evidence providers."""

from __future__ import annotations

import logging

from app.compliance.types import ControlDefinition, EvidenceProvider

logger = logging.getLogger(__name__)


class ControlRegistry:
    def __init__(self) -> None:
        self._controls: dict[str, dict[str, ControlDefinition]] = {}
        self._providers: dict[str, EvidenceProvider] = {}
        self._control_to_providers: dict[str, list[str]] = {}

    def register_framework(self, framework: str, controls: list[ControlDefinition]) -> None:
        self._controls.setdefault(framework, {})
        for c in controls:
            assert c.framework == framework, f"Control {c.control_id} framework mismatch"
            self._controls[framework][c.control_id] = c

    def register_provider(self, provider: EvidenceProvider) -> None:
        assert provider.id not in self._providers, f"Duplicate provider: {provider.id}"
        self._providers[provider.id] = provider
        for fw, ctrl_ids in provider.controls.items():
            for cid in ctrl_ids:
                key = f"{fw}:{cid}"
                self._control_to_providers.setdefault(key, [])
                self._control_to_providers[key].append(provider.id)

    def get_providers(self, framework: str | None = None) -> list[EvidenceProvider]:
        if framework is None:
            return list(self._providers.values())
        result = []
        seen = set()
        for p in self._providers.values():
            if framework in p.controls and p.id not in seen:
                result.append(p)
                seen.add(p.id)
        return result

    def get_controls(self, framework: str | None = None) -> list[ControlDefinition]:
        if framework is None:
            return [c for fw in self._controls.values() for c in fw.values()]
        return list(self._controls.get(framework, {}).values())

    def get_providers_for_control(self, framework: str, control_id: str) -> list[EvidenceProvider]:
        key = f"{framework}:{control_id}"
        return [self._providers[pid] for pid in self._control_to_providers.get(key, []) if pid in self._providers]

    def derive_control_status(self, framework: str, control_id: str, latest_results: dict[str, bool | None], attestations: dict[str, bool] | None = None) -> str:
        """Derive status from provider results and attestations.

        Returns: passed, failed, partial, attested, acknowledged, untested
        """
        key = f"{framework}:{control_id}"
        provider_ids = self._control_to_providers.get(key, [])
        if not provider_ids:
            return "untested"

        statuses: list[bool | None] = []
        for pid in provider_ids:
            provider = self._providers.get(pid)
            if provider is None:
                continue
            if pid in latest_results:
                statuses.append(latest_results[pid])
            elif attestations and pid in attestations:
                statuses.append(attestations[pid])
            else:
                statuses.append(None)

        if not statuses:
            return "untested"

        passed_count = sum(1 for s in statuses if s is True)
        failed_count = sum(1 for s in statuses if s is False)
        none_count = sum(1 for s in statuses if s is None)

        if none_count == len(statuses):
            return "untested"
        if failed_count > 0 and passed_count == 0:
            return "failed"
        if failed_count > 0:
            return "partial"
        if passed_count == len(statuses):
            # All passed — check if any providers have rationales (adapted rules)
            all_have_rationale = all(
                self._providers.get(pid) and self._providers[pid].rationale
                for pid in provider_ids if pid in latest_results
            )
            if all_have_rationale:
                return "acknowledged"
            return "passed"
        # Some passed, rest untested — check if any are manual attestations
        if attestations:
            attested_count = sum(1 for pid in provider_ids if pid in attestations)
            if attested_count > 0 and failed_count == 0:
                return "attested"
        return "partial"

    @property
    def framework_names(self) -> list[str]:
        return list(self._controls.keys())

    @property
    def provider_count(self) -> int:
        return len(self._providers)

    @property
    def control_count(self) -> int:
        return sum(len(ctrls) for ctrls in self._controls.values())


registry = ControlRegistry()


def load_all() -> None:
    """Import all framework catalogs and provider modules to populate the registry."""
    from app.compliance.frameworks import fedramp, cmmc, soc2, iso42001, eu_ai_act, nasa, aiuc  # noqa: F401
    from app.compliance.providers import (  # noqa: F401
        security_headers, audit_log, error_handling, config_checks,
        static_analysis, code_artifacts, doc_artifacts, system_banner,
        cors_check, manual, audit_scan, git_checks,
    )
    logger.info(
        "Compliance registry loaded: %d frameworks, %d controls, %d providers",
        len(registry.framework_names), registry.control_count, registry.provider_count,
    )
