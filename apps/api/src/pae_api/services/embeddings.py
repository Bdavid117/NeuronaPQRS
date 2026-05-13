from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer as _ST

# paraphrase-multilingual-MiniLM-L12-v2:
#   - 384 dimensions, ~120 MB download, runs on CPU
#   - Excellent Spanish support, completely free (no API key needed)
_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_model: "_ST | None" = None


def get_model() -> "_ST":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def embed(text: str) -> list[float]:
    """Return a unit-normalized 384-d embedding for the given text."""
    return get_model().encode(text, normalize_embeddings=True).tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Dot product of two unit-normalized vectors equals cosine similarity."""
    return sum(x * y for x, y in zip(a, b))


def serialize(vec: list[float]) -> str:
    return json.dumps(vec)


def deserialize(s: str) -> list[float]:
    return json.loads(s)
