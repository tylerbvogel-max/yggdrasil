"""Input validation and prompt injection detection.

Runs before the classification stage to catch:
- Prompt injection patterns (role hijacking, instruction override, system prompt extraction)
- Content policy violations (PII patterns, prohibited content)
- Malformed/excessive inputs

Returns a verdict: pass, warn, or block with reasons.
"""

import re

# ── Prompt Injection Patterns ──
# Each pattern is (compiled_regex, description, severity)
_INJECTION_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    # Instruction override attempts
    (re.compile(r"ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|context)", re.I),
     "Instruction override attempt", "block"),
    (re.compile(r"disregard\s+(all\s+)?(previous|above|prior|your)\s+(instructions?|prompts?|rules?|guidelines)", re.I),
     "Instruction override attempt", "block"),
    (re.compile(r"disregard\s+your\s+(previous\s+)?(instructions?|prompts?|rules?)", re.I),
     "Instruction override attempt", "block"),
    (re.compile(r"forget\s+(everything|all|your)\s+(you|instructions?|rules?|about)", re.I),
     "Instruction override attempt", "block"),
    (re.compile(r"do\s+not\s+follow\s+(your|the|any)\s+(instructions?|rules?|guidelines)", re.I),
     "Instruction override attempt", "block"),

    # Role hijacking
    (re.compile(r"you\s+are\s+now\s+(a|an|the)\s+", re.I),
     "Role hijacking attempt", "block"),
    (re.compile(r"act\s+as\s+if\s+you\s+(are|were)\s+", re.I),
     "Role hijacking attempt", "warn"),
    (re.compile(r"pretend\s+(you\s+are|to\s+be)\s+", re.I),
     "Role hijacking attempt", "block"),
    (re.compile(r"switch\s+to\s+.{0,20}\s+mode", re.I),
     "Mode switching attempt", "warn"),

    # System prompt extraction
    (re.compile(r"(show|print|display|reveal|output|repeat|tell\s+me)\s+.{0,10}(your|the)\s+(system\s+)?(prompt|instructions?|rules?|context)", re.I),
     "System prompt extraction attempt", "block"),
    (re.compile(r"what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions?|rules?|initial)", re.I),
     "System prompt extraction attempt", "block"),
    (re.compile(r"(begin|start)\s+your\s+(response|output|answer)\s+with\s+.{0,30}(system|prompt|instruction)", re.I),
     "System prompt extraction attempt", "block"),

    # Delimiter injection
    (re.compile(r"```\s*(system|assistant|human|user)\s*\n", re.I),
     "Delimiter injection attempt", "block"),
    (re.compile(r"<\s*/?\s*(system|instruction|prompt|context)\s*>", re.I),
     "XML tag injection attempt", "block"),
    (re.compile(r"\[INST\]|\[/INST\]|\[SYSTEM\]", re.I),
     "Instruction tag injection", "block"),

    # Encoding/obfuscation attempts
    (re.compile(r"(base64|hex|rot13|encode|decode)\s+(the\s+)?(following|this|above|previous)", re.I),
     "Encoding evasion attempt", "warn"),

    # Data exfiltration
    (re.compile(r"(send|post|transmit|exfiltrate|upload)\s+.{0,30}(to|at|via)\s+(https?://|ftp://)", re.I),
     "Data exfiltration attempt", "block"),
]

# ── Content Policy Patterns ──
_CONTENT_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    # PII patterns (detect, don't block — warn so the query still works)
    (re.compile(r"\b\d{3}[-.]?\d{2}[-.]?\d{4}\b"),
     "Possible SSN detected in query", "warn"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
     "Email address detected in query", "warn"),
    (re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
     "Possible credit card number detected", "warn"),
]

# ── Risk Categories for Output Tagging ──
RISK_CATEGORIES: dict[str, list[tuple[re.Pattern, str]]] = {
    "safety_critical": [
        (re.compile(r"\b(structural\s+failure|fatigue\s+crack|catastrophic|life[- ]?threatening|crash\s+worthiness)", re.I),
         "References safety-critical failure mode"),
        (re.compile(r"\b(single\s+point\s+of\s+failure|redundancy\s+requirement|fail[- ]?safe)", re.I),
         "References safety-critical design requirement"),
    ],
    "dual_use": [
        (re.compile(r"\b(munitions|ITAR\s+controlled|classified|export[- ]?controlled|weapons?\s+system)", re.I),
         "References export-controlled or dual-use content"),
        (re.compile(r"\b(explosiv|detonat|warhead|guidance\s+system|targeting)", re.I),
         "References weapons-related content"),
    ],
    "speculative": [
        (re.compile(r"\b(I\s+think|I\s+believe|it\s+(?:seems?|appears?)\s+(?:that|like)|probably|possibly|might\s+be|could\s+be|not\s+(?:entirely\s+)?sure)\b", re.I),
         "Contains hedging/speculative language"),
        (re.compile(r"\b(disclaimer|not\s+(?:a\s+)?(?:legal|professional)\s+advice|consult\s+(?:a|an|your)\s+)", re.I),
         "Contains disclaimer language"),
    ],
}


class InputGuardResult:
    """Result of input validation."""
    def __init__(self):
        self.verdict: str = "pass"  # "pass" | "warn" | "block"
        self.flags: list[dict] = []  # [{pattern, description, severity}]

    def add_flag(self, description: str, severity: str, pattern: str = ""):
        self.flags.append({
            "description": description,
            "severity": severity,
            "pattern": pattern,
        })
        # Escalate verdict
        if severity == "block":
            self.verdict = "block"
        elif severity == "warn" and self.verdict == "pass":
            self.verdict = "warn"

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict,
            "flags": self.flags,
            "flag_count": len(self.flags),
        }


def check_input(message: str) -> InputGuardResult:
    """Run all input checks on a user message. Returns InputGuardResult."""
    assert isinstance(message, str), f"message must be a string, got {type(message).__name__}"
    result = InputGuardResult()

    # Length checks
    if len(message.strip()) == 0:
        result.add_flag("Empty input", "block")
        return result

    if len(message) > 10000:
        result.add_flag(f"Input too long ({len(message)} chars, max 10000)", "block")
        return result

    # Excessive repetition (possible resource exhaustion)
    words = message.split()
    if len(words) > 20:
        unique_ratio = len(set(w.lower() for w in words)) / len(words)
        if unique_ratio < 0.15:
            result.add_flag(f"Excessive repetition (unique word ratio: {unique_ratio:.2f})", "warn")

    # Prompt injection patterns
    for pattern, description, severity in _INJECTION_PATTERNS:
        match = pattern.search(message)
        if match:
            result.add_flag(description, severity, match.group(0)[:80])

    # Content policy patterns
    for pattern, description, severity in _CONTENT_PATTERNS:
        match = pattern.search(message)
        if match:
            result.add_flag(description, severity, match.group(0)[:80])

    assert result.verdict in ("pass", "warn", "block"), f"Invalid verdict: {result.verdict}"
    return result


def check_output_risk(response_text: str) -> list[dict]:
    """Tag output with risk categories. Returns list of risk flags."""
    assert isinstance(response_text, str), f"response_text must be a string, got {type(response_text).__name__}"
    flags: list[dict] = []
    for category, patterns in RISK_CATEGORIES.items():
        for pattern, description in patterns:
            match = pattern.search(response_text)
            if match:
                flags.append({
                    "category": category,
                    "description": description,
                    "excerpt": match.group(0)[:80],
                })
                break  # One flag per category is enough
    return flags


def check_output_grounding(response_text: str, assembled_prompt: str | None) -> dict:
    """Compare response against assembled neuron context to estimate grounding.

    Returns a grounding assessment with a 0-1 confidence score.
    Higher score = more terms in the response also appear in the neuron context.
    """
    if not assembled_prompt or not response_text:
        return {"grounded": False, "confidence": 0.0, "reason": "No assembled context available"}

    # Extract meaningful terms from response (4+ chars, not stopwords)
    stopwords = {"that", "this", "with", "from", "have", "been", "were", "will", "would",
                 "could", "should", "their", "there", "they", "than", "then", "also",
                 "which", "when", "what", "where", "more", "some", "such", "each",
                 "about", "into", "over", "after", "before", "between", "under", "other"}

    def extract_terms(text: str) -> set[str]:
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
        return {w for w in words if w not in stopwords}

    response_terms = extract_terms(response_text)
    context_terms = extract_terms(assembled_prompt)

    if not response_terms:
        return {"grounded": True, "confidence": 1.0, "reason": "No substantive terms to check"}

    overlap = response_terms & context_terms
    confidence = len(overlap) / len(response_terms) if response_terms else 0

    # Also check for specific claims that aren't in context
    # Look for references, standards, numbers that appear in response but not context
    ref_pattern = re.compile(r'\b(?:FAR|DFARS|MIL-STD|AS\d+|NADCAP|ISO\s*\d+|AMS\s*\d+|SAE\s+\w+)\b[\s\-]?[\d.]*', re.I)
    response_refs = set(ref_pattern.findall(response_text))
    context_refs = set(ref_pattern.findall(assembled_prompt))
    ungrounded_refs = response_refs - context_refs

    assert 0.0 <= confidence <= 1.0, f"confidence out of range: {confidence}"

    return {
        "grounded": confidence > 0.3 and len(ungrounded_refs) == 0,
        "confidence": round(confidence, 3),
        "overlap_terms": len(overlap),
        "response_terms": len(response_terms),
        "ungrounded_references": list(ungrounded_refs)[:10],
        "reason": (
            f"{len(overlap)}/{len(response_terms)} terms grounded in context"
            + (f", {len(ungrounded_refs)} ungrounded references" if ungrounded_refs else "")
        ),
    }
