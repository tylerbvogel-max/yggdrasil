"""Semantic pre-filter: in-memory embedding cache for fast cosine candidate selection.

Biological analogue: cortical topographic maps. Instead of routing queries through
the org-chart hierarchy (department → role → task), we compute semantic proximity
in embedding space. Neurons close in meaning to the query get selected regardless
of their department assignment.

Cache architecture:
- On first query, loads all ~2K neuron embeddings (~3MB as float32 matrix)
- Subsequent queries do a single matrix multiply (~1ms) to rank all neurons
- Cache invalidates when new neurons are embedded (via invalidate())

Feature-flagged via settings.semantic_prefilter_enabled.
"""

import json
import threading
import numpy as np

from app.config import settings


class _EmbeddingCache:
    """Thread-safe in-memory cache of neuron embeddings as a numpy matrix."""

    def __init__(self):
        self._lock = threading.Lock()
        self._neuron_ids: list[int] = []
        self._matrix: np.ndarray | None = None  # shape (N, 384), float32
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load(self, neuron_ids: list[int], embeddings: list[list[float]]):
        """Load embedding matrix from DB results. Called once at startup or on invalidate."""
        with self._lock:
            self._neuron_ids = neuron_ids
            self._matrix = np.array(embeddings, dtype=np.float32)
            self._loaded = True

    def invalidate(self):
        """Force reload on next query (e.g. after embedding new neurons)."""
        with self._lock:
            self._loaded = False
            self._matrix = None
            self._neuron_ids = []

    def query(self, query_vec: list[float], top_n: int, min_similarity: float) -> list[tuple[int, float]]:
        """Return top-N (neuron_id, similarity) pairs above min_similarity.

        Uses matrix dot product for speed (~1ms for 2K neurons × 384 dims).
        """
        with self._lock:
            if not self._loaded or self._matrix is None or len(self._neuron_ids) == 0:
                return []

            q = np.array(query_vec, dtype=np.float32)
            scores = self._matrix @ q  # (N,) cosine similarities

            # Filter by minimum similarity
            mask = scores >= min_similarity
            valid_indices = np.where(mask)[0]

            if len(valid_indices) == 0:
                return []

            # Get top-N from valid indices
            valid_scores = scores[valid_indices]
            if len(valid_indices) <= top_n:
                top_local = np.argsort(-valid_scores)
            else:
                # Partial sort for efficiency
                top_local = np.argpartition(-valid_scores, top_n)[:top_n]
                top_local = top_local[np.argsort(-valid_scores[top_local])]

            results = []
            for idx in top_local:
                global_idx = valid_indices[idx]
                results.append((self._neuron_ids[global_idx], float(scores[global_idx])))

            return results


# Module-level singleton
_cache = _EmbeddingCache()


async def ensure_cache_loaded(db):
    """Load the embedding cache from DB if not already loaded."""
    if _cache.is_loaded:
        return

    from sqlalchemy import text
    result = await db.execute(
        text("SELECT id, embedding FROM neurons WHERE is_active = true AND embedding IS NOT NULL")
    )
    rows = result.all()

    neuron_ids = []
    embeddings = []
    for nid, emb_json in rows:
        try:
            vec = json.loads(emb_json)
            neuron_ids.append(nid)
            embeddings.append(vec)
        except (json.JSONDecodeError, TypeError):
            continue

    if neuron_ids:
        _cache.load(neuron_ids, embeddings)
        print(f"Semantic cache loaded: {len(neuron_ids)} neuron embeddings ({_cache._matrix.nbytes / 1024:.0f} KB)")
    else:
        print("Semantic cache: no embeddings found")


def invalidate_cache():
    """Call after embedding new neurons to force reload."""
    _cache.invalidate()


async def semantic_prefilter(
    db,
    query_embedding: list[float],
    top_n_override: int | None = None,
) -> list[tuple[int, float]]:
    """Return top-N neuron candidates ranked by semantic similarity.

    Returns list of (neuron_id, similarity_score) tuples, sorted descending.
    Uses top_n_override if provided, else settings.semantic_prefilter_top_n.
    """
    await ensure_cache_loaded(db)

    top_n = top_n_override if top_n_override is not None else settings.semantic_prefilter_top_n

    return _cache.query(
        query_embedding,
        top_n=top_n,
        min_similarity=settings.semantic_prefilter_min_similarity,
    )
