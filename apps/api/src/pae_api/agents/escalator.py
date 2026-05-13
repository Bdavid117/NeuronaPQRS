from __future__ import annotations

import json
import time
from datetime import date
from pathlib import Path

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..services.obsidian import write_note
from ..services.nvidia_nim import get_nvidia_nim
from .state import PQRSState
from .utils import extract_json

_PROMPT = (Path(__file__).parent / "prompts" / "escalator.md").read_text()


async def escalator_agent(state: PQRSState) -> dict:
    settings = get_settings()
    client = get_nvidia_nim()
    start = time.monotonic()

    radicado = state.get("radicado", "PQRS-PENDIENTE")
    urgencia = state.get("urgencia", "media")
    tipo = state.get("pqrs_tipo", "solicitud")

    context = {
        "radicado": radicado,
        "tipo": tipo,
        "urgencia": urgencia,
        "area": state.get("area"),
        "confidence": state.get("confidence", 0.0),
        "motivo": "Derivado por el sistema automáticamente.",
    }

    messages = [
        {"role": "system", "content": _PROMPT},
        {"role": "system", "content": f"Contexto: {json.dumps(context, ensure_ascii=False)}"},
        *[{"role": "assistant" if m.type == "ai" else "user" if m.type == "human" else m.type, "content": m.content} for m in state["messages"][-4:]],
    ]

    resp = await client.chat(
        model=settings.model_escalator,
        messages=messages,
        temperature=0.4,
        response_format={"type": "json_object"},
    )

    cost = client.estimate_cost(resp)
    usage = resp.get("usage", {})
    raw = resp["choices"][0]["message"]["content"] or ""

    try:
        parsed = extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        parsed = {
            "reply": "Tu caso ha sido derivado a un funcionario que te contactará pronto.",
            "motivo_escalamiento": "Derivación automática",
            "urgencia_final": urgencia,
            "cola_entry": f"- [ ] {radicado} | {tipo} | {urgencia} | automático | {date.today().isoformat()}",
        }

    # Append to escalation queue in Obsidian
    cola_entry = parsed.get("cola_entry", f"- [ ] {radicado} | {date.today().isoformat()}")
    try:
        write_note("90-Sistema/cola.md", f"\n{cola_entry}", mode="append")
    except FileNotFoundError:
        write_note("90-Sistema/cola.md", f"# Cola de Escalamiento\n\n{cola_entry}\n", mode="create")

    run_record = {
        "agent_name": "escalator",
        "model": settings.model_escalator,
        "tokens_in": usage.get("prompt_tokens", 0),
        "tokens_out": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    return {
        "messages": [AIMessage(content=parsed.get("reply", ""), name="escalator")],
        "requires_human": True,
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
