"""Core types for the Unified Compliance Audit Suite."""

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Awaitable, Callable


class EvidenceType(str, enum.Enum):
    automated_test = "automated_test"
    code_artifact = "code_artifact"
    config_check = "config_check"
    doc_artifact = "doc_artifact"
    static_analysis = "static_analysis"
    manual_attestation = "manual_attestation"


@dataclass
class EvidenceResult:
    provider_id: str
    passed: bool
    detail: dict[str, Any]
    collected_at: datetime
    duration_ms: int


@dataclass
class EvidenceProvider:
    id: str
    title: str
    description: str
    evidence_type: EvidenceType
    test_fn: Callable[..., Awaitable[EvidenceResult]] | None
    code_refs: list[str]
    controls: dict[str, list[str]]  # framework → [control_ids]
    rationale: str | None = None  # Why this rule was adapted for the architecture


@dataclass
class ControlDefinition:
    framework: str
    control_id: str
    title: str
    family: str
    description: str
    external_ref: str = ""
