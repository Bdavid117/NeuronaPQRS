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
from .state import PQRSState, REQUIRED_FIELDS as _BASE_REQUIRED
from .utils import extract_json

_PROMPT = (Path(__file__).parent / "prompts" / "intake.md").read_text()
log = get_logger("intake")


async def _call_and_parse(client, model: str, messages: list) -> tuple[dict, dict]:
    """Single LLM call + JSON parse. Raises ValueError on parse failure."""
    resp = await client.chat(
        model=model,
        messages=messages,
        temperature=0.5,
        response_format={"type": "json_object"},
    )
    raw = resp["choices"][0]["message"]["content"] or ""
    parsed = extract_json(raw)  # raises json.JSONDecodeError or ValueError on failure
    return parsed, resp


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

    parsed: dict = {}
    resp: dict = {}
    try:
        for attempt in range(2):
            try:
                parsed, resp = await _call_and_parse(client, settings.model_intake, messages)
                break  # success — exit loop
            except (json.JSONDecodeError, ValueError) as e:
                log.warning(f"  ⚠ JSON parse failed (attempt {attempt + 1}/2): {e}")
                if attempt == 1:
                    raise  # exhausted retries — fall through to outer except
    except Exception:
        log.error("  ✗ intake LLM call or parse failed — using fallback response", exc_info=True)
        parsed = {
            "reply": "Disculpe, tuve un problema procesando su respuesta. ¿Podría repetir la información?",
            "extracted_fields": {},
            "remaining_fields": pending,
            "validation_errors": state.get("validation_errors", []),  # PRESERVE, do not clear
            "escalate": False,
            "sentiment": "neutral",
        }
        resp = {}

    cost = client.estimate_cost(resp) if resp else 0.0
    usage = resp.get("usage", {}) if resp else {}
    log.info(f"  extracted={list(parsed.get('extracted_fields', {}).keys())}  pending={parsed.get('remaining_fields', [])}")

    reply = parsed.get("reply", "¿Podría proporcionarme más información?")
    raw_extracted = parsed.get("extracted_fields", {})
    normalized_extracted = normalize_fields(raw_extracted)
    new_fields = {**collected, **normalized_extracted}
    new_pending = parsed.get("remaining_fields", pending)
    new_errors = parsed.get("validation_errors", [])
    escalate = parsed.get("escalate", False) or parsed.get("sentiment") == "urgente"

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
