from __future__ import annotations

import json
import re
import time
from pathlib import Path

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..logging_config import get_logger
from ..services.obsidian import search as kb_search
from ..services.openrouter import get_openrouter
from ..services.tracking import plazo_label
from .state import PQRSState

log = get_logger("resolver")

_PROMPT = (Path(__file__).parent / "prompts" / "resolver.md").read_text()
_MIN_CITATION_SCORE = 0.40
_GARBLED_RE = re.compile(r"\{{4,}")


def _sanitize_excerpt(text: str) -> str:
    """Strip Obsidian {{template}} syntax that confuses the LLM's JSON mode."""
    return re.sub(r"\{\{[^}]*\}\}", "[campo]", text)


def _is_garbled(text: str) -> bool:
    return bool(_GARBLED_RE.search(text))


async def resolver_agent(state: PQRSState) -> dict:
    settings = get_settings()
    client = get_openrouter()
    start = time.monotonic()

    tipo = state.get("pqrs_tipo", "peticion")
    categoria = state.get("categoria")
    collected = state.get("collected_fields", {})

    query = (
        collected.get("descripcion_reclamo")
        or collected.get("descripcion_situacion")
        or collected.get("descripcion_peticion")
        or collected.get("descripcion_sugerencia")
        or f"{tipo} {categoria or ''}"
    )

    citations_raw = kb_search(query, top_k=5)
    good_citations = [c for c in citations_raw if c["score"] >= _MIN_CITATION_SCORE]
    # Sanitize excerpts — Obsidian {{template}} syntax breaks json_object mode
    for c in good_citations:
        if "excerpt" in c:
            c["excerpt"] = _sanitize_excerpt(c["excerpt"])
    confidence_base = min(1.0, sum(c["score"] for c in good_citations) / max(len(good_citations), 1) * 1.2)

    plazo = plazo_label(tipo, categoria)

    context = {
        "tipo": tipo,
        "categoria": categoria,
        "area": state.get("area"),
        "urgencia": state.get("urgencia", "baja"),
        "campos": collected,
        "kb_citations": good_citations[:3],
        "plazo": plazo,
    }

    # Exclude finish_node's markdown summary (name="system") — it is not JSON and
    # confuses the model when json_object response_format is active.
    history = [
        m for m in state["messages"][-8:]
        if not (hasattr(m, "name") and m.name == "system")
    ]

    messages = [
        {"role": "system", "content": _PROMPT + "\n\nResponde ÚNICAMENTE con JSON válido. Sin texto adicional ni bloques de código."},
        {"role": "system", "content": f"Contexto del caso: {json.dumps(context, ensure_ascii=False)}"},
        *[
            {
                "role": "assistant" if m.type == "ai" else "user" if m.type == "human" else m.type,
                "content": m.content,
            }
            for m in history
        ],
    ]

    log.info(f"  KB hits={len(good_citations)}  query={query[:60]!r}")
    log.info(f"  history msgs={len(history)}  tipo={tipo}  cat={categoria}")

    resp = await client.chat(
        model=settings.model_resolver,
        messages=messages,
        temperature=0.3,
    )

    cost = client.estimate_cost(resp)
    usage = resp.get("usage", {})
    raw = resp["choices"][0]["message"]["content"] or ""

    log.debug(f"  raw response ({len(raw)} chars): {raw[:200]!r}")

    # Safety net: garbled output detection
    if _is_garbled(raw):
        log.warning(f"  ⚠ garbled output detected ({len(raw)} chars) — discarding")
        raw = ""

    def _try_parse(text: str) -> dict | None:
        try:
            return json.loads(text)
        except (json.JSONDecodeError, ValueError):
            return None

    parsed = _try_parse(raw)
    if parsed is not None:
        log.info(f"  ✅ parsed OK  confidence={parsed.get('confidence')}  draft_len={len(parsed.get('draft',''))}")
    else:
        log.warning(f"  ⚠ JSON parse failed — retrying with simplified prompt  raw={raw[:80]!r}")
        # Retry once with a minimal prompt to recover a usable draft
        retry_messages = [
            {
                "role": "system",
                "content": (
                    f"Eres un asistente PQRS. Responde SOLO con JSON válido, sin texto adicional.\n"
                    f"Formato exacto: {{\"draft\": \"<respuesta>\", \"confidence\": 0.6, \"plazo_aplicable\": \"{plazo}\"}}"
                ),
            },
            {
                "role": "user",
                "content": f"Genera una respuesta institucional para: {tipo} sobre {categoria or 'consulta general'}. Campos: {json.dumps(collected, ensure_ascii=False)[:300]}",
            },
        ]
        try:
            resp2 = await client.chat(
                model=settings.model_resolver,
                messages=retry_messages,
                temperature=0.1,
            )
            raw2 = resp2["choices"][0]["message"]["content"] or ""
            parsed = _try_parse(raw2) or {}
            log.info(f"  🔁 retry parsed={bool(parsed)}  draft_len={len(parsed.get('draft',''))}")
        except Exception as exc:
            log.warning(f"  ⚠ retry also failed: {exc}")
            parsed = {}

        if not parsed:
            parsed = {"draft": raw or "Respuesta no disponible.", "confidence": 0.3, "plazo_aplicable": plazo}

    final_confidence = float(parsed.get("confidence", confidence_base))

    run_record = {
        "agent_name": "resolver",
        "model": settings.model_resolver,
        "tokens_in": usage.get("prompt_tokens", 0),
        "tokens_out": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    requires_human = final_confidence < 0.5 or state.get("requires_human", False)

    draft = parsed.get("draft") or "Respuesta no disponible en este momento."

    return {
        "messages": [AIMessage(content=draft, name="resolver")],
        "draft_response": draft,
        "kb_citations": good_citations,
        "confidence": final_confidence,
        "plazo_label": parsed.get("plazo_aplicable", plazo),
        "requires_human": requires_human,
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
