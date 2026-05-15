from __future__ import annotations

import json
import time
from pathlib import Path

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..logging_config import get_logger
from ..services.obsidian import search as kb_search
from ..services.nvidia_nim import get_nvidia_nim
from .normalize import normalize_fields
from .state import PQRSState
from .utils import extract_json

_PROMPT = (Path(__file__).parent / "prompts" / "intake.md").read_text()
log = get_logger("intake")

# Required fields by PQRS tipo (loaded from KB at runtime if available)
_BASE_REQUIRED: dict[str, list[str]] = {
    "peticion": ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_peticion"],
    "queja": ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_situacion", "persona_o_dependencia_implicada"],
    "reclamo": ["nombre_solicitante", "numero_identificacion", "correo_contacto", "programa_academico", "codigo_estudiante", "descripcion_reclamo"],
    "sugerencia": ["descripcion_sugerencia", "area_relacionada"],
}


async def intake_agent(state: PQRSState) -> dict:
    settings = get_settings()
    client = get_nvidia_nim()
    start = time.monotonic()

    # Determine pending fields
    tipo = state.get("pqrs_tipo") or ""
    required = _BASE_REQUIRED.get(tipo, ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_detallada"])
    collected = state.get("collected_fields", {})
    pending = [f for f in required if f not in collected or not collected[f]]

    # Build context for the LLM
    context = {
        "tipo_pqrs": tipo or "aún no determinado",
        "campos_recolectados": collected,
        "campos_pendientes": pending,
        "errores_validacion": state.get("validation_errors", []),
    }

    messages = [
        {"role": "system", "content": _PROMPT},
        {"role": "system", "content": f"Estado actual: {json.dumps(context, ensure_ascii=False)}"},
        *[{"role": "assistant" if m.type == "ai" else "user" if m.type == "human" else m.type, "content": m.content} for m in state["messages"]],
    ]

    resp = await client.chat(
        model=settings.model_intake,
        messages=messages,
        temperature=0.5,
        response_format={"type": "json_object"},
    )

    cost = client.estimate_cost(resp)
    usage = resp.get("usage", {})
    raw = resp["choices"][0]["message"]["content"] or ""

    try:
        parsed = extract_json(raw)
        log.info(f"  extracted={list(parsed.get('extracted_fields', {}).keys())}  pending={parsed.get('remaining_fields', [])}")
    except (json.JSONDecodeError, ValueError) as e:
        log.warning(f"  ⚠ JSON parse failed: {e}  raw={raw[:80]!r}")
        parsed = {"reply": raw or "¿Podría proporcionarme más información?", "extracted_fields": {}, "remaining_fields": pending, "validation_errors": [], "escalate": False, "sentiment": "neutral"}

    reply = parsed.get("reply", "¿Podría proporcionarme más información?")
    raw_extracted = parsed.get("extracted_fields", {})
    normalized_extracted = normalize_fields(raw_extracted)
    new_fields = {**collected, **normalized_extracted}
    new_pending = parsed.get("remaining_fields", pending)
    new_errors = parsed.get("validation_errors", [])
    escalate = parsed.get("escalate", False) or parsed.get("sentiment") == "urgente"
    log.info(f"  reply={reply[:80]!r}  escalate={escalate}")

    run_record = {
        "agent_name": "intake",
        "model": settings.model_intake,
        "tokens_in": usage.get("prompt_tokens", 0),
        "tokens_out": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    return {
        "messages": [AIMessage(content=reply, name="intake")],
        "collected_fields": new_fields,
        "pending_fields": new_pending,
        "validation_errors": new_errors,
        "requires_human": state.get("requires_human", False) or escalate,
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
