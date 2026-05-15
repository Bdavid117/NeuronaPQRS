from __future__ import annotations

import json
import time

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..logging_config import get_logger
from ..services.nvidia_nim import get_nvidia_nim
from .state import PQRSState
from .utils import extract_json

log = get_logger("confirm")

_FIELD_LABELS: dict[str, str] = {
    "nombre_solicitante": "Nombre",
    "numero_identificacion": "Cédula / ID",
    "tipo_identificacion": "Tipo de documento",
    "codigo_estudiante": "Código estudiantil",
    "correo_contacto": "Correo",
    "telefono_contacto": "Teléfono",
    "programa_academico": "Programa",
    "descripcion_reclamo": "Descripción",
    "descripcion_peticion": "Descripción",
    "descripcion_situacion": "Descripción",
    "descripcion_sugerencia": "Descripción",
    "descripcion_detallada": "Descripción",
}


def _build_summary(collected: dict, tipo: str, categoria: str | None) -> str:
    lines = ["📋 Antes de radicar tu caso, verifica que los datos sean correctos:\n"]
    for key, label in _FIELD_LABELS.items():
        val = collected.get(key)
        if val:
            short_val = str(val)[:200]
            lines.append(f"• **{label}:** {short_val}")
    if tipo:
        tipo_display = tipo.capitalize()
        cat_display = f" — {categoria}" if categoria else ""
        lines.append(f"• **Tipo:** {tipo_display}{cat_display}")
    lines.append("\n¿Todo está correcto? Escribe **confirmar** o dime qué dato quieres corregir.")
    return "\n".join(lines)


async def confirm_agent(state: PQRSState) -> dict:
    collected = state.get("collected_fields", {})
    tipo = str(state.get("pqrs_tipo") or "")
    categoria = state.get("categoria")
    awaiting = state.get("awaiting_confirmation", False)

    # First call: show summary and wait
    if not awaiting:
        summary = _build_summary(collected, tipo, categoria)
        log.info("  confirm: showing summary")
        return {
            "messages": [AIMessage(content=summary, name="confirm")],
            "awaiting_confirmation": True,
            "agent_runs": (state.get("agent_runs") or []) + [{"agent_name": "confirm"}],
        }

    # Second call: user responded — parse their message
    settings = get_settings()
    client = get_nvidia_nim()
    start = time.monotonic()

    messages = state.get("messages", [])
    last_human = next(
        (m.content for m in reversed(messages) if getattr(m, "type", None) == "human"),
        "",
    )

    prompt = (
        f'El usuario respondió al resumen de su caso PQRS: "{last_human}"\n\n'
        "Determina si el usuario CONFIRMA los datos o CORRIGE algún dato.\n\n"
        "- CONFIRMA si dice: sí, confirmo, correcto, ok, todo bien, adelante, así es, perfecto, confirmar.\n"
        "- CORRIGE si menciona un dato incorrecto o diferente.\n\n"
        "Si confirma, responde con:\n"
        '{"action": "confirm", "reply": "Perfecto, procedo a radicar tu caso.", "correction": {}}\n\n'
        "Si corrige, extrae el campo corregido. Los campos válidos son: "
        "nombre_solicitante, numero_identificacion, tipo_identificacion, codigo_estudiante, "
        "correo_contacto, telefono_contacto, programa_academico, descripcion_reclamo, "
        "descripcion_peticion, descripcion_situacion.\n"
        'Responde con: {"action": "correct", "reply": "Entendido, he actualizado el dato. ¿Confirmas el resto?", '
        '"correction": {"nombre_campo": "valor_corregido"}}\n\n'
        "Responde SOLO con JSON válido, sin texto adicional."
    )

    resp = await client.chat(
        model=settings.model_intake,
        messages=[
            {
                "role": "system",
                "content": "Eres un asistente que interpreta respuestas de confirmación de datos PQRS. Responde SOLO con JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    cost = client.estimate_cost(resp)
    usage = resp.get("usage", {})
    raw = resp["choices"][0]["message"]["content"] or ""

    run_record = {
        "agent_name": "confirm",
        "model": settings.model_intake,
        "tokens_in": usage.get("prompt_tokens", 0),
        "tokens_out": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    try:
        parsed = extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        log.warning(f"  confirm: JSON parse failed, assuming confirmation. raw={raw[:60]!r}")
        parsed = {"action": "confirm", "reply": "Perfecto, procedo a radicar tu caso.", "correction": {}}

    action = parsed.get("action", "confirm")
    reply = parsed.get("reply", "Perfecto.")
    correction: dict = parsed.get("correction") or {}

    log.info(f"  confirm: action={action}  correction_keys={list(correction.keys())}")

    if action == "confirm":
        return {
            "messages": [AIMessage(content=reply, name="confirm")],
            "confirmed": True,
            "awaiting_confirmation": False,
            "agent_runs": state.get("agent_runs", []) + [run_record],
        }

    # Apply correction and return to intake on next turn
    new_collected = {**collected, **correction}
    return {
        "messages": [AIMessage(content=reply, name="confirm")],
        "confirmed": False,
        "awaiting_confirmation": False,
        "collected_fields": new_collected,
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
