"""Semantic embedding service for neuron cortical topography.

Uses sentence-transformers to generate dense vector embeddings for neuron
content, enabling semantic similarity scoring that replaces keyword matching.

Biological analogue: cortical topographic maps where neurons encoding similar
concepts are spatially proximate. Embedding cosine similarity = synaptic
proximity in semantic space.
"""

import numpy as np
from sentence_transformers import SentenceTransformer

# Lazy-loaded singleton — model loads on first use (~80MB, ~1s on CPU)
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_text(text: str) -> list[float]:
    """Embed a single text string into a 384-dim vector."""
    model = _get_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def embed_batch(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """Embed a batch of texts efficiently."""
    model = _get_model()
    vecs = model.encode(texts, normalize_embeddings=True, batch_size=batch_size)
    return vecs.tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two normalized vectors.

    Since embeddings are L2-normalized at creation time, this is just dot product.
    """
    return float(np.dot(a, b))


def batch_cosine_similarity(query_vec: list[float], neuron_vecs: list[list[float]]) -> list[float]:
    """Compute cosine similarity between a query vector and many neuron vectors.

    Returns list of similarity scores in the same order as neuron_vecs.
    """
    q = np.array(query_vec, dtype=np.float32)
    m = np.array(neuron_vecs, dtype=np.float32)
    # Normalized vectors → dot product = cosine similarity
    scores = m @ q
    return scores.tolist()
