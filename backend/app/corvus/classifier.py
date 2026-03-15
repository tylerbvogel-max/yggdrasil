import re
import json
from types import MappingProxyType

# URL patterns — definitive identification. If a URL matches, that's the app.
# These are checked first and override everything else.
URL_PATTERNS = MappingProxyType({
    "teams": [
        r"teams\.microsoft\.\w+",
        r"gov\.teams\.microsoft",
    ],
    "outlook": [
        r"outlook\.office\.\w+",
        r"outlook\.live\.\w+",
        r"outlook\.office365\.\w+",
    ],
    "jira": [
        r"atlassian\.net",
        r"jira\.\w+\.\w+",
    ],
    "databricks": [
        r"databricks\.com",
        r"\.cloud\.databricks\.\w+",
    ],
})

# Fallback text patterns — only used if no URL matched.
# These are weaker signals and require multiple matches to be confident.
FALLBACK_PATTERNS = MappingProxyType({
    "teams": [
        r"microsoft teams",
        r"(?:chat|activity|calendar|calls)\s+(?:chat|activity|calendar|calls)",
        r"search\s+\(ctrl\+alt\+e\)",
        r"teams and channels",
    ],
    "outlook": [
        r"(?:inbox|drafts|sent items|junk email|deleted items)",
        r"(?:new mail|reply all|forward)",
        r"focused\s+other",
    ],
    "jira": [
        r"(?:backlog|sprint|kanban)\s+board",
        r"create\s+issue",
        r"story\s+points",
    ],
    "databricks": [
        r"(?:workspace|clusters|jobs|sql\s+editor|notebooks)",
        r"(?:spark|delta|lakehouse)",
    ],
})

# Minimum fallback matches required to classify (prevents false positives)
FALLBACK_MIN_MATCHES = 2

# Custom apps loaded from DB — populated by load_custom_apps()
_custom_url_patterns: dict[str, list[str]] = {}
_custom_text_patterns: dict[str, list[str]] = {}


def set_custom_apps(apps: list[dict]):
    """Update the in-memory custom app patterns from DB records."""
    global _custom_url_patterns, _custom_text_patterns
    _custom_url_patterns = {}
    _custom_text_patterns = {}
    for app in apps:
        label = app["label"]
        try:
            url_pats = json.loads(app.get("url_patterns", "[]"))
            text_pats = json.loads(app.get("text_patterns", "[]"))
        except (json.JSONDecodeError, TypeError):
            url_pats, text_pats = [], []
        if url_pats:
            _custom_url_patterns[label] = url_pats
        if text_pats:
            _custom_text_patterns[label] = text_pats


def classify_app(ocr_text: str) -> str | None:
    """Identify which known app is visible from OCR'd text.
    Custom apps are checked first, then hardcoded URL patterns,
    then fallback text patterns."""
    if not ocr_text:
        return None

    text_lower = ocr_text.lower()

    # First: check custom app URL patterns (user-defined, highest priority)
    for app_label, patterns in _custom_url_patterns.items():
        for pattern in patterns:
            try:
                if re.search(pattern, text_lower):
                    return app_label
            except re.error:
                if pattern.lower() in text_lower:
                    return app_label

    # Second: check custom app text patterns (require 2+ matches)
    custom_scores = {}
    for app_label, patterns in _custom_text_patterns.items():
        match_count = sum(1 for p in patterns if _safe_search(p, text_lower))
        if match_count >= FALLBACK_MIN_MATCHES:
            custom_scores[app_label] = match_count
    if custom_scores:
        return max(custom_scores, key=custom_scores.get)

    # Third: hardcoded URL patterns (definitive)
    for app_id, patterns in URL_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                return app_id

    # Fourth: hardcoded fallback text patterns (require multiple matches)
    scores = {}
    for app_id, patterns in FALLBACK_PATTERNS.items():
        match_count = sum(1 for p in patterns if re.search(p, text_lower))
        if match_count >= FALLBACK_MIN_MATCHES:
            scores[app_id] = match_count

    if not scores:
        return None

    return max(scores, key=scores.get)


def _safe_search(pattern: str, text: str) -> bool:
    """Regex search with fallback to substring match."""
    try:
        return bool(re.search(pattern, text, re.IGNORECASE))
    except re.error:
        return pattern.lower() in text
