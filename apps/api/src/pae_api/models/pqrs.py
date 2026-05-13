from __future__ import annotations

import secrets
from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class PQRSTipo(StrEnum):
    PETICION = "peticion"
    QUEJA = "queja"
    RECLAMO = "reclamo"
    SUGERENCIA = "sugerencia"


class PQRSUrgencia(StrEnum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class PQRSEstado(StrEnum):
    ABIERTO = "abierto"
    EN_PROCESO = "en_proceso"
    ESCALADO = "escalado"
    CERRADO = "cerrado"


def _gen_radicado() -> str:
    return f"PQRS-{date.today().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"


class PQRSCase(SQLModel, table=True):
    __tablename__ = "pqrs_case"

    id: int | None = Field(default=None, primary_key=True)
    radicado: str = Field(default_factory=_gen_radicado, unique=True, index=True)
    session_id: str = Field(index=True)
    tipo: PQRSTipo | None = None
    categoria: str | None = None
    area: str | None = None
    urgencia: PQRSUrgencia = PQRSUrgencia.BAJA
    estado: PQRSEstado = PQRSEstado.ABIERTO
    requiere_revision_humana: bool = False
    plazo_respuesta: date | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    collected_fields: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    validation_errors: list[str] = Field(default_factory=list, sa_column=Column(JSONB))
    vault_note_path: str | None = None
    turn_count: int = Field(default=0)


class Message(SQLModel, table=True):
    __tablename__ = "message"

    id: int | None = Field(default=None, primary_key=True)
    case_id: int = Field(foreign_key="pqrs_case.id", index=True)
    role: str  # "user" | "assistant" | "system"
    content: str
    agent_name: str | None = None
    tool_calls: list[dict] = Field(default_factory=list, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Attachment(SQLModel, table=True):
    __tablename__ = "attachment"

    id: int | None = Field(default=None, primary_key=True)
    case_id: int | None = Field(default=None, foreign_key="pqrs_case.id", index=True)
    session_id: str = Field(index=True)
    filename: str
    mime_type: str
    file_path: str
    extracted_data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    validated: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AgentRun(SQLModel, table=True):
    __tablename__ = "agent_run"

    id: int | None = Field(default=None, primary_key=True)
    case_id: int | None = Field(default=None, foreign_key="pqrs_case.id", index=True)
    agent_name: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    duration_ms: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Event(SQLModel, table=True):
    __tablename__ = "event"

    id: int | None = Field(default=None, primary_key=True)
    case_id: int | None = Field(default=None, foreign_key="pqrs_case.id", index=True)
    type: str
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow)
