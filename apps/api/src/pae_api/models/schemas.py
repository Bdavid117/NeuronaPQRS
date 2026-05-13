from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: str
    message: str
    attachment_ids: list[int] = Field(default_factory=list)


class AttachmentInfo(BaseModel):
    id: int
    filename: str
    mime_type: str
    extracted_data: dict[str, Any]
    validated: bool


class UploadResponse(BaseModel):
    attachment_id: int
    filename: str
    status: str = "uploaded"


class PQRSStatusResponse(BaseModel):
    radicado: str
    tipo: str | None
    categoria: str | None
    area: str | None
    urgencia: str
    estado: str
    created_at: datetime
    plazo_respuesta: date | None
    collected_fields: dict[str, Any]


class SSEEvent(BaseModel):
    """Represents a single Server-Sent Event payload (serialized to JSON)."""
    event: str  # "delta" | "agent_switch" | "tool_call" | "state" | "error" | "done"
    data: Any
