"""Add expires_at TTL to semantic_cache

Revision ID: 003
Revises: 002
Create Date: 2026-05-08
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "semantic_cache",
        sa.Column(
            "expires_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("NOW() + INTERVAL '90 days'"),
        ),
    )
    op.create_index("ix_semantic_cache_expires_at", "semantic_cache", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_semantic_cache_expires_at", table_name="semantic_cache")
    op.drop_column("semantic_cache", "expires_at")
