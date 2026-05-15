"""Add confirmed and awaiting_confirmation to pqrs_case

Revision ID: 005
Revises: 004
Create Date: 2026-05-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pqrs_case",
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "pqrs_case",
        sa.Column("awaiting_confirmation", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("pqrs_case", "awaiting_confirmation")
    op.drop_column("pqrs_case", "confirmed")
