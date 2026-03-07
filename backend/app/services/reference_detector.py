"""Deterministic external reference detector.

Scans neuron content/summary for citations to regulatory standards and
technical APIs. Returns structured reference objects for storage in the
neuron's external_references JSON field.
"""

import re
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Regulatory patterns
# ---------------------------------------------------------------------------

REGULATORY_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("FAR",      re.compile(r'\bFAR\s+\d+\.\d+', re.IGNORECASE)),
    ("DFARS",    re.compile(r'\bDFARS\s+\d+\.\d+', re.IGNORECASE)),
    ("ITAR",     re.compile(r'\bITAR\s+§?\d+\.\d+', re.IGNORECASE)),
    ("EAR",      re.compile(r'\bEAR\s+§?\d+\.\d+', re.IGNORECASE)),
    ("CFR",      re.compile(r'\b\d+\s+CFR\s+\d+', re.IGNORECASE)),
    ("NIST",     re.compile(r'\bNIST\s+SP\s+\d+-\d+', re.IGNORECASE)),
    ("MIL-STD",  re.compile(r'\bMIL-STD-\d+[A-Z]?\b', re.IGNORECASE)),
    ("MIL-SPEC", re.compile(r'\bMIL-[A-Z]+-\d+\b')),
    ("AS",       re.compile(r'\bAS\s?\d{4,}[A-Z]?\b')),
    ("DO",       re.compile(r'\bDO-\d+[A-Z]?\b', re.IGNORECASE)),
    ("ASME",     re.compile(r'\bASME\s+[A-Z]\d+', re.IGNORECASE)),
    ("NADCAP",   re.compile(r'\bNADCAP\s+[A-Z]+\d*', re.IGNORECASE)),
    ("ISO",      re.compile(r'\bISO\s+\d+', re.IGNORECASE)),
    ("SAE",      re.compile(r'\bSAE\s+(?:AS|AMS|ARP|J)\d+', re.IGNORECASE)),
    ("OSHA",     re.compile(r'\bOSHA\s+\d+\.\d+', re.IGNORECASE)),
    ("ASTM",     re.compile(r'\bASTM\s+[A-Z]\d+', re.IGNORECASE)),
    ("NAS",      re.compile(r'\bNAS\s?\d{3,}\b')),
    ("CMMC",     re.compile(r'\bCMMC\b', re.IGNORECASE)),
]

# ---------------------------------------------------------------------------
# Technical patterns — more conservative to reduce false positives
# ---------------------------------------------------------------------------

TECHNICAL_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("PySpark",     re.compile(r'\b(?:DataFrame|SparkSession|pyspark\.sql\.functions)\.\w+\s*\(')),
    ("SQLAlchemy",  re.compile(r'\b(?:select|Session|mapped_column|Mapped)\s*[\(\[]')),
    ("FastAPI",     re.compile(r'\b(?:Depends|APIRouter|@router\.)\w*')),
    ("React",       re.compile(r'\buse[A-Z]\w+\s*\(')),
    ("Delta Lake",  re.compile(r'\b(?:DeltaTable\.\w+|MERGE\s+INTO|OPTIMIZE|VACUUM)\b', re.IGNORECASE)),
    ("Python",      re.compile(r'\b(?:asyncio|dataclasses|typing|collections|functools|itertools)\.\w+')),
]


@dataclass
class DetectedReference:
    pattern: str       # The matched text (e.g., "FAR 31.205-6")
    domain: str        # "regulatory" or "technical"
    family: str        # Citation family (e.g., "FAR", "PySpark")


def detect_references(text: str) -> list[DetectedReference]:
    """Scan text for external references. Returns deduplicated list."""
    if not text:
        return []

    seen: set[str] = set()
    results: list[DetectedReference] = []

    for family, pattern in REGULATORY_PATTERNS:
        for match in pattern.finditer(text):
            matched = match.group(0).strip()
            if matched not in seen:
                seen.add(matched)
                results.append(DetectedReference(
                    pattern=matched,
                    domain="regulatory",
                    family=family,
                ))

    for family, pattern in TECHNICAL_PATTERNS:
        for match in pattern.finditer(text):
            matched = match.group(0).strip()
            if matched not in seen:
                seen.add(matched)
                results.append(DetectedReference(
                    pattern=matched,
                    domain="technical",
                    family=family,
                ))

    return results


def detect_neuron_references(content: str | None, summary: str | None) -> list[dict]:
    """Scan neuron content + summary and return references as JSON-serializable dicts."""
    combined = ""
    if content:
        combined += content + "\n"
    if summary:
        combined += summary

    refs = detect_references(combined)
    return [
        {
            "pattern": r.pattern,
            "domain": r.domain,
            "family": r.family,
            "resolved_neuron_id": None,
            "resolved_at": None,
        }
        for r in refs
    ]
