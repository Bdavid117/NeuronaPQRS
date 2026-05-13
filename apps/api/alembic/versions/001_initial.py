"""Initial tables + pgvector extension

Revision ID: 001
Revises:
Create Date: 2026-05-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector for future RAG embeddings
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "pqrs_case",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("radicado", sqlmodel.AutoString(), nullable=False),
        sa.Column("session_id", sqlmodel.AutoString(), nullable=False),
        sa.Column("tipo", sqlmodel.AutoString(), nullable=True),
        sa.Column("categoria", sqlmodel.AutoString(), nullable=True),
        sa.Column("area", sqlmodel.AutoString(), nullable=True),
        sa.Column("urgencia", sqlmodel.AutoString(), nullable=False, server_default="baja"),
        sa.Column("estado", sqlmodel.AutoString(), nullable=False, server_default="abierto"),
        sa.Column("requiere_revision_humana", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("plazo_respuesta", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("collected_fields", postgresql.JSONB(), nullable=True),
        sa.Column("validation_errors", postgresql.JSONB(), nullable=True),
        sa.Column("vault_note_path", sqlmodel.AutoString(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("radicado"),
    )
    op.create_index("ix_pqrs_case_radicado", "pqrs_case", ["radicado"])
    op.create_index("ix_pqrs_case_session_id", "pqrs_case", ["session_id"])

    op.create_table(
        "message",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("pqrs_case.id"), nullable=False),
        sa.Column("role", sqlmodel.AutoString(), nullable=False),
        sa.Column("content", sqlmodel.AutoString(), nullable=False),
        sa.Column("agent_name", sqlmodel.AutoString(), nullable=True),
        sa.Column("tool_calls", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_message_case_id", "message", ["case_id"])

    op.create_table(
        "attachment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("pqrs_case.id"), nullable=True),
        sa.Column("session_id", sqlmodel.AutoString(), nullable=False),
        sa.Column("filename", sqlmodel.AutoString(), nullable=False),
        sa.Column("mime_type", sqlmodel.AutoString(), nullable=False),
        sa.Column("file_path", sqlmodel.AutoString(), nullable=False),
        sa.Column("extracted_data", postgresql.JSONB(), nullable=True),
        sa.Column("validated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attachment_case_id", "attachment", ["case_id"])
    op.create_index("ix_attachment_session_id", "attachment", ["session_id"])

    op.create_table(
        "agent_run",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("pqrs_case.id"), nullable=True),
        sa.Column("agent_name", sqlmodel.AutoString(), nullable=False),
        sa.Column("model", sqlmodel.AutoString(), nullable=False),
        sa.Column("tokens_in", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tokens_out", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_run_case_id", "agent_run", ["case_id"])

    op.create_table(
        "event",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("case_id", sa.Integer(), sa.ForeignKey("pqrs_case.id"), nullable=True),
        sa.Column("type", sqlmodel.AutoString(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_event_case_id", "event", ["case_id"])


def downgrade() -> None:
    op.drop_table("event")
    op.drop_table("agent_run")
    op.drop_table("attachment")
    op.drop_table("message")
    op.drop_table("pqrs_case")
