from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any

import sqlalchemy as sa
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..logging_config import get_logger
from .embeddings import cosine_similarity, deserialize, embed, serialize

log = get_logger("cache")

# Cosine similarity threshold for a semantic cache hit (1.0 = identical).
# 0.88 is tight enough to avoid false matches while catching paraphrases.
_SIM_THRESHOLD = 0.88


class SemanticCache(SQLModel, table=True):
    __tablename__ = "semantic_cache"

    id: int | None = Field(default=None, primary_key=True)
    query_hash: str = Field(index=True)
    query_text: str
    # Stored as JSON string — pgvector native binding not required
    query_embedding: str | None = Field(
        default=None,
        sa_column=Column(sa.Text, nullable=True),
    )
    response_text: str
    kb_citations: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSONB))
    tipo: str
    categoria: str | None = None
    hit_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(
        default_factory=lambda: datetime.utcnow() + timedelta(days=90)
    )


def _make_hash(tipo: str, categoria: str | None, query: str) -> str:
    raw = f"{tipo}:{categoria or ''}:{query.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_cached_response(
    db: AsyncSession,
    query: str,
    tipo: str,
    categoria: str | None,
) -> dict | None:
    """
    Two-stage cache lookup:
      1. Exact SHA-256 hash match (O(1), no model call)
      2. Semantic cosine similarity among entries for the same tipo/categoria

    Returns ``{draft_response, kb_citations, confidence}`` or ``None``.
    """
    # ── Stage 1: exact hash ────────────────────────────────────────────────
    now = datetime.utcnow()
    key = _make_hash(tipo, categoria, query)
    result = await db.exec(
        select(SemanticCache).where(
            SemanticCache.query_hash == key,
            SemanticCache.expires_at > now,
        )
    )
    entry = result.first()

    if entry is not None:
        entry.hit_count += 1
        db.add(entry)
        await db.commit()
        log.info(f"  💾 cache HIT (exact)  tipo={tipo}  cat={categoria}")
        return {
            "draft_response": entry.response_text,
            "kb_citations": entry.kb_citations,
            "confidence": 0.90,
        }

    # ── Stage 2: semantic similarity ───────────────────────────────────────
    result = await db.exec(
        select(SemanticCache).where(
            SemanticCache.tipo == tipo,
            SemanticCache.categoria == categoria,
            SemanticCache.query_embedding.isnot(None),  # type: ignore[union-attr]
            SemanticCache.expires_at > now,
        )
    )
    candidates = result.all()

    if not candidates:
        return None

    try:
        query_vec = embed(query)
    except Exception as exc:
        log.warning(f"  ⚠ embedding failed: {exc}")
        return None

    best_sim = 0.0
    best_entry: SemanticCache | None = None
    for candidate in candidates:
        try:
            cand_vec = deserialize(candidate.query_embedding)  # type: ignore[arg-type]
            sim = cosine_similarity(query_vec, cand_vec)
            if sim > best_sim:
                best_sim = sim
                best_entry = candidate
        except Exception:
            continue

    if best_entry is not None and best_sim >= _SIM_THRESHOLD:
        best_entry.hit_count += 1
        db.add(best_entry)
        await db.commit()
        log.info(f"  💾 cache HIT (semantic sim={best_sim:.3f})  tipo={tipo}  cat={categoria}")
        return {
            "draft_response": best_entry.response_text,
            "kb_citations": best_entry.kb_citations,
            "confidence": round(0.7 + best_sim * 0.2, 3),  # scales 0.88→0.876 … 1.0→0.9
        }

    log.debug(f"  💾 cache MISS  best_sim={best_sim:.3f}  candidates={len(candidates)}")
    return None


async def store_response(
    db: AsyncSession,
    query: str,
    tipo: str,
    categoria: str | None,
    draft: str,
    citations: list,
) -> None:
    """Persist a resolver response with its embedding for future semantic lookups."""
    key = _make_hash(tipo, categoria, query)

    existing = await db.exec(select(SemanticCache).where(SemanticCache.query_hash == key))
    if existing.first() is not None:
        return

    embedding_json: str | None = None
    try:
        embedding_json = serialize(embed(query))
    except Exception as exc:
        log.warning(f"  ⚠ failed to embed query for cache: {exc}")

    entry = SemanticCache(
        query_hash=key,
        query_text=query,
        query_embedding=embedding_json,
        response_text=draft,
        kb_citations=list(citations),
        tipo=tipo,
        categoria=categoria,
    )
    db.add(entry)
    try:
        await db.commit()
        log.debug(f"  💾 cache STORE  tipo={tipo}  cat={categoria}  has_embedding={embedding_json is not None}")
    except Exception:
        await db.rollback()
