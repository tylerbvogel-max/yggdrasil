import pytesseract
from PIL import Image
from io import BytesIO


def extract_text(image_bytes: bytes) -> str:
    """Extract text from a JPEG frame using Tesseract OCR."""
    image = Image.open(BytesIO(image_bytes))
    text = pytesseract.image_to_string(image)
    return text.strip()


def image_phash(image_bytes: bytes) -> int:
    """Compute a simple 64-bit average hash for image dedup."""
    img = Image.open(BytesIO(image_bytes)).convert("L").resize((8, 8), Image.LANCZOS)
    pixels = list(img.getdata())
    avg = sum(pixels) / len(pixels)
    return sum(1 << i for i, p in enumerate(pixels) if p >= avg)


def image_similar(hash_a: int, hash_b: int, threshold: int = 8) -> bool:
    """True if Hamming distance <= threshold (out of 64 bits)."""
    xor = hash_a ^ hash_b
    return bin(xor).count("1") <= threshold


def text_similarity(text_a: str, text_b: str) -> float:
    if not text_a and not text_b:
        return 1.0
    if not text_a or not text_b:
        return 0.0
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a and not words_b:
        return 1.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union) if union else 1.0
