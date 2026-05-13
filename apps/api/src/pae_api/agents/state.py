from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class PQRSState(TypedDict):
    """Full conversation state threaded through the LangGraph supervisor."""

    # Conversation
    messages: Annotated[list[BaseMessage], add_messages]
    session_id: str

    # PQRS metadata (filled progressively by agents)
    pqrs_tipo: str | None          # peticion | queja | reclamo | sugerencia
    categoria: str | None          # e.g. "Reclamo-Nota", "Certificado-Academico"
    area: str | None               # responsible area
    urgencia: str                  # alta | media | baja

    # Field collection
    collected_fields: dict[str, Any]
    pending_fields: list[str]
    validation_errors: list[str]

    # Attachments
    attachment_ids: list[int]
    vision_results: list[dict[str, Any]]

    # Resolution
    kb_citations: list[dict[str, Any]]   # [{path, excerpt, score}]
    draft_response: str | None
    confidence: float                     # 0.0–1.0

    # Control
    next_agent: str | None               # which agent the supervisor should call
    radicado: str | None
    plazo_label: str | None
    plazo_respuesta: str | None          # ISO date string, persisted to DB
    requires_human: bool

    # Telemetry
    agent_runs: list[dict[str, Any]]

    # QR / case URL (set by finish_node)
    qr_code_b64: str | None
    case_url: str | None
