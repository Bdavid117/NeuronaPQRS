"""Add semantic_cache table

Revision ID: 002
Revises: 001
Create Date: 2026-05-07
"""
from __future__ import annotations

import sqlalchemy as sa
import sqlmodel
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector extension should already exist from migration 001,
    # but CREATE EXTENSION IF NOT EXISTS is idempotent.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "semantic_cache",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("query_hash", sqlmodel.AutoString(), nullable=False),
        sa.Column("query_text", sqlmodel.AutoString(), nullable=False),
        # Embedding stored as Text (nullable) — real Vector column can be
        # added via a follow-up migration once pgvector Python binding is confirmed.
        sa.Column("query_embedding", sa.Text(), nullable=True),
        sa.Column("response_text", sqlmodel.AutoString(), nullable=False),
        sa.Column("kb_citations", postgresql.JSONB(), nullable=True),
        sa.Column("tipo", sqlmodel.AutoString(), nullable=False),
        sa.Column("categoria", sqlmodel.AutoString(), nullable=True),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_semantic_cache_query_hash", "semantic_cache", ["query_hash"])


def downgrade() -> None:
    op.drop_index("ix_semantic_cache_query_hash", table_name="semantic_cache")
    op.drop_table("semantic_cache")
