from __future__ import annotations

import json
import time
from pathlib import Path

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..logging_config import get_logger
from ..services.nvidia_nim import get_nvidia_nim
from .state import PQRSState
from .utils import extract_json

_PROMPT = (Path(__file__).parent / "prompts" / "classifier.md").read_text()
log = get_logger("classifier")


async def classifier_agent(state: PQRSState) -> dict:
    settings = get_settings()
    client = get_nvidia_nim()
    start = time.monotonic()

    context = {
        "campos_recolectados": state.get("collected_fields", {}),
        "tipo_actual": state.get("pqrs_tipo"),
        "descripcion": state.get("collected_fields", {}).get("descripcion_detallada")
                       or state.get("collected_fields", {}).get("descripcion_reclamo")
                       or state.get("collected_fields", {}).get("descripcion_situacion")
                       or state.get("collected_fields", {}).get("descripcion_peticion", ""),
    }

    messages = [
        {"role": "system", "content": _PROMPT},
        {"role": "system", "content": f"Información del caso: {json.dumps(context, ensure_ascii=False)}"},
        *[{"role": "assistant" if m.type == "ai" else "user" if m.type == "human" else m.type, "content": m.content} for m in state["messages"][-6:]],
    ]

    resp = await client.chat(
        model=settings.model_classifier,
        messages=messages,
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    cost = client.estimate_cost(resp)
    usage = resp.get("usage", {})
    raw = resp["choices"][0]["message"]["content"] or ""

    try:
        parsed = extract_json(raw)
        log.info(f"  ✅ tipo={parsed.get('tipo')}  cat={parsed.get('categoria')}  area={parsed.get('area')}  conf={parsed.get('confidence')}")
    except (json.JSONDecodeError, ValueError) as e:
        log.warning(f"  ⚠ JSON parse failed: {e}  raw={raw[:80]!r}")
        parsed = {"tipo": state.get("pqrs_tipo") or "peticion", "categoria": "General", "area": "Secretaría General", "urgencia": "baja", "confidence": 0.5, "reasoning": ""}

    run_record = {
        "agent_name": "classifier",
        "model": settings.model_classifier,
        "tokens_in": usage.get("prompt_tokens", 0),
        "tokens_out": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    return {
        "pqrs_tipo": parsed.get("tipo") or state.get("pqrs_tipo") or "peticion",
        "categoria": parsed.get("categoria") or state.get("categoria") or "General",
        "area": parsed.get("area") or state.get("area") or "Secretaría General",
        "urgencia": parsed.get("urgencia") or "baja",
        "confidence": float(parsed.get("confidence") or 0.7),
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
