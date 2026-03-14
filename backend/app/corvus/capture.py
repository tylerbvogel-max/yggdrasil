import asyncio
import re
import time
from dataclasses import dataclass, field
from PIL import Image
from io import BytesIO

from sqlalchemy import select, text as sql_text
from app.database import async_session
from app.models_corvus import CorvusCapture, CorvusAlertRule, CorvusCustomApp

from .ocr import extract_text, text_similarity, image_phash, image_similar
from .classifier import classify_app
from .entities import extract_entities, store_entities

SIMILARITY_THRESHOLD = 0.85  # Text dedup threshold
IMAGE_DEDUP_THRESHOLD = 8    # Hamming distance for image dedup
MAX_PENDING = 500            # Cap on pending diffs/images (drop oldest when exceeded)

# Adaptive cadence — novelty scoring
NOVELTY_WINDOW = 10          # Track last N frames for rolling novelty
MIN_CADENCE_MULT = 0.3       # Fastest: 30% of base cadence
MAX_CADENCE_MULT = 3.0       # Slowest: 300% of base cadence


@dataclass
class CaptureState:
    # Adaptive cadence — novelty scoring
    _novelty_scores: list[float] = field(default_factory=list)
    _adaptive_multiplier: float = 1.0
    _last_novelty_app: str | None = None

    # Cache of last OCR text per app for text dedup
    _last_text_by_app: dict[str, str] = field(default_factory=dict)
    # Cache of last image hash per app for image dedup
    _last_hash_by_app: dict[str, int] = field(default_factory=dict)

    # Latest frame held in memory only (never written to disk)
    latest_frame_bytes: bytes | None = None

    # Crop regions per app — values are percentages (0.0 to 1.0)
    crop_regions: dict[str, dict[str, float]] = field(default_factory=dict)

    # Configurable: "vision" sends images to Haiku, "text" sends OCR diffs
    interpretation_mode: str = "vision"

    # Text diff accumulator (used in text mode)
    _pending_diffs: list[dict] = field(default_factory=list)

    # Image accumulator (used in vision mode)
    _pending_images: list[dict] = field(default_factory=list)

    _last_app_id: str | None = None

    # Track frames received since last interpretation (regardless of dedup)
    _frames_since_interpretation: int = 0
    # Always keep the latest frame for time-cap fallback
    _latest_frame_for_interp: dict | None = None

    # Interrupt intelligence: flag when an alert fires
    last_alert_fired: bool = False

    # Time-in-current-app tracking
    _current_app_start: float = 0.0
    _current_app_id_for_time: str | None = None

    # Async lock for get-and-clear / accumulation operations
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


capture_state = CaptureState()


async def get_pending_diffs() -> list[dict]:
    """Return accumulated text diffs and clear the buffer."""
    async with capture_state.lock:
        diffs = capture_state._pending_diffs[:]
        capture_state._pending_diffs = []
    return diffs


async def get_pending_images() -> list[dict]:
    """Return accumulated images and clear the buffer."""
    async with capture_state.lock:
        images = capture_state._pending_images[:]
        # If no non-duplicate images but we received frames, include the latest as fallback
        if not images and capture_state._latest_frame_for_interp:
            images = [capture_state._latest_frame_for_interp]
        capture_state._pending_images = []
        capture_state._frames_since_interpretation = 0
        capture_state._latest_frame_for_interp = None
    return images


def get_pending_token_count() -> int:
    """Estimate tokens currently buffered for next interpretation."""
    total_chars = sum(len(d["diff_text"]) for d in capture_state._pending_diffs)
    return int(total_chars / 4)


def get_pending_image_count() -> int:
    """Return number of images buffered for next interpretation."""
    return len(capture_state._pending_images)


def get_frames_since_interpretation() -> int:
    return capture_state._frames_since_interpretation


def get_last_app_id() -> str | None:
    return capture_state._last_app_id


def get_time_in_current_app() -> float:
    """Return seconds the user has been in the current app."""
    if capture_state._current_app_start == 0.0:
        return 0.0
    return time.time() - capture_state._current_app_start


def _update_novelty(is_duplicate: bool, app_switched: bool, text_sim: float):
    """Score how novel this frame is (0.0 = boring, 1.0 = very novel)."""
    score = 0.0
    if app_switched:
        score = 1.0  # app switch = maximum novelty
    elif is_duplicate:
        score = 0.0
    else:
        # Novelty based on how different the text is (inverse of similarity)
        score = max(0.0, 1.0 - text_sim)

    capture_state._novelty_scores.append(score)
    if len(capture_state._novelty_scores) > NOVELTY_WINDOW:
        capture_state._novelty_scores.pop(0)

    # Rolling average novelty
    avg_novelty = sum(capture_state._novelty_scores) / len(capture_state._novelty_scores) if capture_state._novelty_scores else 0.5

    # Map novelty to cadence multiplier:
    # High novelty (>0.5) → shorter cadence (faster)
    # Low novelty (<0.2) → longer cadence (slower)
    if avg_novelty > 0.5:
        capture_state._adaptive_multiplier = MIN_CADENCE_MULT + (1.0 - MIN_CADENCE_MULT) * (1.0 - avg_novelty) * 2
    elif avg_novelty < 0.2:
        capture_state._adaptive_multiplier = 1.0 + (MAX_CADENCE_MULT - 1.0) * (1.0 - avg_novelty * 5)
    else:
        capture_state._adaptive_multiplier = 1.0

    capture_state._adaptive_multiplier = max(MIN_CADENCE_MULT, min(MAX_CADENCE_MULT, capture_state._adaptive_multiplier))


def get_adaptive_multiplier() -> float:
    return capture_state._adaptive_multiplier


def get_novelty_state() -> dict:
    """Return current adaptive cadence state for the dashboard."""
    avg = sum(capture_state._novelty_scores) / len(capture_state._novelty_scores) if capture_state._novelty_scores else 0.0
    return {
        "multiplier": round(capture_state._adaptive_multiplier, 2),
        "avg_novelty": round(avg, 3),
        "samples": len(capture_state._novelty_scores),
    }


def _compute_diff(old_text: str, new_text: str) -> str:
    """Extract lines in new_text that aren't in old_text."""
    if not old_text:
        return new_text

    old_lines = set(old_text.splitlines())
    new_lines = new_text.splitlines()

    diff_lines = [line for line in new_lines if line.strip() and line not in old_lines]

    return "\n".join(diff_lines)


def _apply_crop(frame_bytes: bytes, app_id: str) -> bytes:
    """Crop frame to the saved region for this app. Returns cropped JPEG bytes."""
    region = capture_state.crop_regions.get(app_id)
    if not region:
        return frame_bytes

    img = Image.open(BytesIO(frame_bytes))
    w, h = img.size
    left = int(w * region.get("left", 0))
    top = int(h * region.get("top", 0))
    right = int(w * region.get("right", 1))
    bottom = int(h * region.get("bottom", 1))

    if left >= right or top >= bottom:
        return frame_bytes

    cropped = img.crop((left, top, right, bottom))
    buf = BytesIO()
    cropped.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


async def process_frame(
    frame_bytes: bytes,
    timestamp: str,
    width: int,
    height: int,
) -> dict:
    """Process an incoming frame: OCR, classify, dedup, accumulate for interpretation."""
    capture_state.latest_frame_bytes = frame_bytes
    capture_state._frames_since_interpretation += 1

    # Full OCR for app classification (needs URL bar)
    full_ocr_text = extract_text(frame_bytes)
    app_id = classify_app(full_ocr_text)

    # Crop if we have a region for this app
    if app_id and app_id in capture_state.crop_regions:
        cropped_bytes = _apply_crop(frame_bytes, app_id)
        ocr_text = extract_text(cropped_bytes)
    else:
        cropped_bytes = frame_bytes
        ocr_text = full_ocr_text

    if app_id is None:
        app_id = "other"

    app_switched = capture_state._last_app_id is not None and app_id != capture_state._last_app_id
    capture_state._last_app_id = app_id

    # Track time in current app for interrupt intelligence
    if app_switched or capture_state._current_app_id_for_time != app_id:
        capture_state._current_app_start = time.time()
        capture_state._current_app_id_for_time = app_id

    # Dedup — use image hash in vision mode, text similarity in text mode
    is_duplicate = False
    if capture_state.interpretation_mode == "vision":
        cropped_hash = image_phash(cropped_bytes)
        last_hash = capture_state._last_hash_by_app.get(app_id)
        if last_hash is not None:
            is_duplicate = image_similar(last_hash, cropped_hash, IMAGE_DEDUP_THRESHOLD)
        capture_state._last_hash_by_app[app_id] = cropped_hash
    else:
        last_text = capture_state._last_text_by_app.get(app_id, "")
        if last_text:
            similarity = text_similarity(last_text, ocr_text)
            if similarity > SIMILARITY_THRESHOLD:
                is_duplicate = True

    # Compute text similarity for novelty scoring (even in vision mode)
    text_sim = text_similarity(capture_state._last_text_by_app.get(app_id, ""), ocr_text) if capture_state._last_text_by_app.get(app_id) else 0.0
    _update_novelty(is_duplicate, app_switched, text_sim)

    capture_state._last_text_by_app[app_id] = ocr_text

    # Always keep latest frame for time-cap fallback (vision mode)
    if capture_state.interpretation_mode == "vision":
        capture_state._latest_frame_for_interp = {
            "timestamp": timestamp,
            "app_id": app_id,
            "image_bytes": cropped_bytes,
            "ocr_text": ocr_text,
        }

    # Accumulate for interpretation (both modes), with bounded growth
    if not is_duplicate:
        async with capture_state.lock:
            if capture_state.interpretation_mode == "vision":
                capture_state._pending_images.append({
                    "timestamp": timestamp,
                    "app_id": app_id,
                    "image_bytes": cropped_bytes,
                    "ocr_text": ocr_text,
                })
                while len(capture_state._pending_images) > MAX_PENDING:
                    capture_state._pending_images.pop(0)
            else:
                diff_text = _compute_diff(capture_state._last_text_by_app.get(app_id, ""), ocr_text)
                if diff_text.strip():
                    capture_state._pending_diffs.append({
                        "timestamp": timestamp,
                        "app_id": app_id,
                        "diff_text": diff_text,
                    })
                    while len(capture_state._pending_diffs) > MAX_PENDING:
                        capture_state._pending_diffs.pop(0)

    # Store OCR text in database (always, for dashboard log)
    capture_id = None
    async with async_session() as db:
        cap = CorvusCapture(
            timestamp=timestamp,
            app_id=app_id,
            ocr_text=ocr_text,
            width=width,
            height=height,
            is_duplicate=is_duplicate,
        )
        db.add(cap)
        await db.flush()
        capture_id = cap.id
        await db.commit()

    # Extract and store entities (non-duplicate frames only)
    if not is_duplicate:
        entities = extract_entities(ocr_text)
        if entities:
            await store_entities(entities, app_id, timestamp, capture_id)

    # Evaluate alert rules against OCR text
    alerts = await _check_alert_rules(ocr_text, app_id)

    # Set alert flag for interrupt intelligence
    if alerts:
        capture_state.last_alert_fired = True

    return {
        "status": "duplicate" if is_duplicate else "stored",
        "app_id": app_id,
        "app_switched": app_switched,
        "ocr_length": len(ocr_text),
        "alerts": alerts,
    }


async def _check_alert_rules(text: str, app_id: str) -> list[dict]:
    """Check OCR text against alert rules. Returns matched rules."""
    async with async_session() as db:
        result = await db.execute(
            select(CorvusAlertRule).where(CorvusAlertRule.enabled == True)
        )
        rules = result.scalars().all()
        matches = []
        text_lower = text.lower()
        for r in rules:
            if r.app_filter and r.app_filter != app_id:
                continue
            pattern = r.pattern
            try:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    matches.append({"rule_id": r.id, "pattern": pattern})
            except re.error:
                if pattern.lower() in text_lower:
                    matches.append({"rule_id": r.id, "pattern": pattern})
        return matches


async def load_custom_apps():
    """Load custom app patterns from DB into classifier."""
    from .classifier import set_custom_apps
    async with async_session() as db:
        result = await db.execute(select(CorvusCustomApp))
        rows = result.scalars().all()
        apps = [{"label": r.label, "url_patterns": r.url_patterns, "text_patterns": r.text_patterns} for r in rows]
        set_custom_apps(apps)
        if apps:
            print(f"[Corvus] Loaded {len(apps)} custom app(s)")
