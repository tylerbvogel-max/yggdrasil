"""Audio transcription via faster-whisper (local Whisper inference)."""

import tempfile
import os
import time
from pathlib import Path

# Lazy-loaded model
_model = None
_model_size = "base"  # good balance of speed vs accuracy on CPU

# Audio transcript accumulator
_pending_transcripts: list[dict] = []
_transcript_count: int = 0


def _get_model():
    """Lazy-load the Whisper model on first use."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        print(f"[Corvus] Loading Whisper model '{_model_size}' (first use)...")
        _model = WhisperModel(
            _model_size,
            device="cpu",
            compute_type="int8",
        )
        print("[Corvus] Whisper model loaded.")
    return _model


def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str | None:
    """Transcribe audio bytes to text. Returns transcription or None."""
    global _transcript_count

    # Write to temp file — faster-whisper needs a file path
    suffix = ".webm" if "webm" in mime_type else ".wav"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(audio_bytes)
        tmp.close()

        model = _get_model()
        start = time.time()
        segments, info = model.transcribe(
            tmp.name,
            beam_size=1,       # fastest
            language="en",     # skip language detection
            vad_filter=True,   # skip silence
        )

        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        elapsed = time.time() - start
        text = " ".join(text_parts).strip()

        if text:
            _transcript_count += 1
            print(f"[Corvus] Transcribed {len(audio_bytes)//1024}KB in {elapsed:.1f}s: {text[:80]}...")
        return text if text else None

    except Exception as e:
        print(f"[Corvus] Transcription error: {e}")
        return None
    finally:
        os.unlink(tmp.name)


def add_transcript(text: str, timestamp: str):
    """Add a transcription to the pending buffer."""
    _pending_transcripts.append({
        "text": text,
        "timestamp": timestamp,
    })


def get_pending_transcripts() -> list[dict]:
    """Return accumulated transcripts and clear the buffer."""
    global _pending_transcripts
    transcripts = _pending_transcripts[:]
    _pending_transcripts = []
    return transcripts


def get_pending_transcript_count() -> int:
    return len(_pending_transcripts)


def get_total_transcript_count() -> int:
    return _transcript_count
