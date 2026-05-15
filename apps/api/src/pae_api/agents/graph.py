from __future__ import annotations

import base64
import io
import logging
import re
import secrets
from datetime import date
from typing import Literal

from langchain_core.messages import AIMessage
from langgraph.graph import END, StateGraph

from ..config import get_settings
from ..services.obsidian import (
    create_case as obsidian_create_case,
    update_frontmatter,
    write_note,
)
from ..services.tracking import calcular_plazo, plazo_label
from .classifier import classifier_agent
from .escalator import escalator_agent
from .intake import intake_agent
from .resolver import resolver_agent
from .resolver_auto import AUTO_RESOLVE_CATEGORIES, resolver_auto_agent
from .state import PQRSState
from .vision import vision_agent

REQUIRED_FIELDS: dict[str, list[str]] = {
    "peticion":   ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_peticion"],
    "queja":      ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_situacion"],
    "reclamo":    ["nombre_solicitante", "numero_identificacion", "correo_contacto",
                   "programa_academico", "codigo_estudiante", "descripcion_reclamo"],
    "sugerencia": ["descripcion_sugerencia"],
}


def _missing_fields(state: PQRSState) -> list[str]:
    """Compute missing required fields deterministically from collected_fields."""
    tipo = str(state.get("pqrs_tipo") or "")
    required = REQUIRED_FIELDS.get(tipo, ["nombre_solicitante", "numero_identificacion", "correo_contacto"])
    collected = state.get("collected_fields", {})
    return [f for f in required if not collected.get(f)]


def _supervisor_route(
    state: PQRSState,
) -> Literal["intake", "classifier", "vision", "resolver", "resolver_auto", "escalator", "finish", "confirm", "wait"]:
    """Pure routing logic — no LLM call needed."""
    if state.get("requires_human"):
        already_escalated = any(
            r.get("agent_name") == "escalator"
            for r in state.get("agent_runs", [])
        )
        if not already_escalated:
            return "escalator"

    # Unprocessed attachments
    attachment_ids = state.get("attachment_ids", [])
    vision_ids = {r.get("attachment_id") for r in state.get("vision_results", [])}
    if attachment_ids and set(attachment_ids) - vision_ids:
        return "vision"

    # Need classification
    if not state.get("pqrs_tipo") or not state.get("categoria"):
        return "classifier"

    # Deterministic field check — never trusts pending_fields from LLM
    missing = _missing_fields(state)
    tipo = str(state.get("pqrs_tipo") or "")

    if missing:
        intake_ran = any(r.get("agent_name") == "intake" for r in state.get("agent_runs", []))
        if intake_ran:
            return "wait"
        return "intake"

    # All required fields collected
    # Sugerencias are anonymous — skip confirmation, go directly to resolver
    if tipo == "sugerencia":
        if not state.get("draft_response"):
            return "resolver_auto" if state.get("categoria") in AUTO_RESOLVE_CATEGORIES else "resolver"
        return "finish"

    # For all other types: require user confirmation of summary
    if not state.get("confirmed"):
        confirm_ran = any(r.get("agent_name") == "confirm" for r in state.get("agent_runs", []))
        if confirm_ran:
            return "wait"
        return "confirm"

    # User confirmed — generate response
    if not state.get("draft_response"):
        if state.get("categoria") in AUTO_RESOLVE_CATEGORIES:
            return "resolver_auto"
        return "resolver"

    return "finish"


async def _wait_node(state: PQRSState) -> dict:
    """No-op node — terminates this graph turn so the user can respond."""
    return {}


async def _confirm_node(state: PQRSState) -> dict:
    """Present a summary of collected fields to the user and request confirmation."""
    collected = state.get("collected_fields", {})
    tipo = str(state.get("pqrs_tipo") or "").title()
    lines = [f"**Resumen de su {tipo}:**", ""]
    for key, val in collected.items():
        label = key.replace("_", " ").title()
        lines.append(f"- **{label}:** {val}")
    lines += ["", "¿Confirma que los datos son correctos? Responda **sí** para radicar o **no** para corregir."]
    summary = "\n".join(lines)
    return {
        "messages": [AIMessage(content=summary, name="confirm")],
        "awaiting_confirmation": True,
        "agent_runs": (state.get("agent_runs") or []) + [{"agent_name": "confirm"}],
    }


def _upsert_user_node(collected: dict, session_id: str, radicado: str) -> None:
    """Create or update a 50-Usuarios node and link it to the case."""
    nombre = collected.get("nombre_solicitante") or collected.get("nombre")
    identificacion = str(collected.get("numero_identificacion") or collected.get("codigo_estudiante") or "")
    correo = collected.get("correo_contacto") or collected.get("correo_electronico") or ""
    telefono = collected.get("telefono_contacto") or ""

    if nombre and identificacion:
        safe_name = re.sub(r"[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]", "-", nombre)[:30].strip("-")
        safe_id = re.sub(r"[^0-9a-zA-Z]", "", identificacion)[:12]
        node_stem = f"{safe_name}-{safe_id}"
        tipo = "identificado"
    else:
        node_stem = f"Anonimo-{session_id[:8]}"
        tipo = "anonimo"

    user_path = f"50-Usuarios/{node_stem}.md"
    case_link = f"- [[20-Casos/{radicado}]]\n"

    try:
        from mcp_obsidian.vault import note_exists
        if note_exists(user_path):
            write_note(user_path, case_link, mode="append")
        else:
            frontmatter_lines = [
                "---",
                f"tipo: {tipo}",
                f"nombre: \"{nombre or 'Anónimo'}\"",
                f"identificacion: \"{identificacion}\"",
                f"correo: \"{correo}\"",
                f"telefono: \"{telefono}\"",
                f"primera_solicitud: {date.today().isoformat()}",
                f"tags: [usuario, {tipo}]",
                "---",
                "",
                "## Casos PQRS",
                "",
                case_link,
            ]
            write_note(user_path, "\n".join(frontmatter_lines), mode="create")

        # Add user backlink to case note
        write_note(
            f"20-Casos/{radicado}.md",
            f"\n## Solicitante\n[[50-Usuarios/{node_stem}]]\n",
            mode="append",
        )
    except Exception:
        pass  # non-critical


async def finish_node(state: PQRSState) -> dict:
    """Persist the case to Obsidian, generate radicado, QR code and summary message."""
    radicado = state.get("radicado") or f"PQRS-{date.today().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    plazo = calcular_plazo(state.get("pqrs_tipo", "peticion"), state.get("categoria"))
    label = plazo_label(state.get("pqrs_tipo", "peticion"), state.get("categoria"))

    def _str(v, default=None):
        if v is None:
            return default
        return v.value if hasattr(v, "value") else str(v)

    metadata = {
        "tipo": _str(state.get("pqrs_tipo")),
        "categoria": state.get("categoria"),
        "area": _str(state.get("area")),
        "urgencia": _str(state.get("urgencia"), "baja"),
        "plazo_respuesta": str(plazo),
        "estado": "abierto",
        "requiere_revision_humana": state.get("requires_human", False),
    }

    collected = state.get("collected_fields", {})

    # Separate descriptive fields from structured metadata fields
    desc_keys = {"descripcion_reclamo", "descripcion_situacion", "descripcion_peticion", "descripcion_sugerencia"}
    meta_fields = {k: v for k, v in collected.items() if k not in desc_keys}
    descripcion = (
        collected.get("descripcion_reclamo")
        or collected.get("descripcion_situacion")
        or collected.get("descripcion_peticion")
        or collected.get("descripcion_sugerencia", "")
    )

    body_lines = ["## Información recolectada\n"]
    if meta_fields:
        body_lines += [f"- **{k}**: {v}" for k, v in meta_fields.items()]
    else:
        body_lines.append("_(campos recolectados durante la conversación)_")

    body_lines += ["", "## Descripción\n", descripcion or "_(sin descripción registrada)_"]

    if state.get("draft_response"):
        body_lines += ["\n## Respuesta borrador\n", state["draft_response"]]

    kb_citations = state.get("kb_citations", [])
    if kb_citations:
        body_lines.append("\n## Fuentes consultadas\n")
        for cit in kb_citations:
            note_path = cit.get("path", "")
            # Strip vault-relative extension for wikilink
            link_target = note_path.replace(".md", "") if note_path else ""
            excerpt = cit.get("excerpt", "")[:120].replace("\n", " ")
            if link_target:
                body_lines.append(f"- [[{link_target}]] — {excerpt}")

    vault_path: str | None = None
    try:
        obsidian_create_case(radicado, metadata, "\n".join(body_lines))
        vault_path = f"20-Casos/{radicado}.md"

        # Register user/session node and link it to this case
        _upsert_user_node(collected, state.get("session_id", ""), radicado)

        # Improvement 4: append resolution section to case note
        draft_response = state.get("draft_response", "")
        if draft_response:
            resolution_section = (
                f"\n\n## Resolución automática\n\n{draft_response}\n\n"
                f"**Radicado:** {radicado}\n"
                f"**Fecha:** {date.today().isoformat()}\n"
            )
            try:
                write_note(f"20-Casos/{radicado}.md", resolution_section, mode="append")
            except Exception:
                pass  # non-critical

        # Update frontmatter to mark case resolved
        try:
            update_frontmatter(
                f"20-Casos/{radicado}.md",
                {
                    "estado": "resuelto_automaticamente",
                    "fecha_resolucion": date.today().isoformat(),
                },
            )
        except Exception:
            pass  # non-critical

    except FileExistsError:
        vault_path = None
    except Exception as exc:
        logging.getLogger("pae_api.agents.graph").error(
            "finish_node: failed to write case %s to vault: %s", radicado, exc
        )
        vault_path = None

    # Improvement 3: generate QR code for case status URL
    settings = get_settings()
    app_url = settings.app_url
    case_url = f"{app_url}/r/{radicado}"
    qr_b64: str | None = None
    try:
        import qrcode  # type: ignore[import-untyped]

        qr = qrcode.QRCode(version=1, box_size=4, border=2)
        qr.add_data(case_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception:
        qr_b64 = None  # non-critical — degrade gracefully

    summary = (
        f"✅ **Su caso ha sido radicado exitosamente.**\n\n"
        f"**Radicado:** `{radicado}`\n"
        f"**Tipo:** {state.get('pqrs_tipo', '').title()}\n"
        f"**Categoría:** {state.get('categoria', '')}\n"
        f"**Área responsable:** {state.get('area', '')}\n"
        f"**Plazo de respuesta:** {label}\n\n"
        f"Recibirá respuesta en el correo registrado antes de la fecha límite."
    )

    return {
        "messages": [AIMessage(content=summary, name="system")],
        "radicado": radicado,
        "plazo_label": label,
        "plazo_respuesta": str(plazo),
        "vault_note_path": vault_path,
        "qr_code_b64": qr_b64,
        "case_url": case_url,
    }


def build_graph() -> StateGraph:
    builder = StateGraph(PQRSState)

    # Nodes
    builder.add_node("intake", intake_agent)
    builder.add_node("classifier", classifier_agent)
    builder.add_node("vision", vision_agent)
    builder.add_node("resolver", resolver_agent)
    builder.add_node("resolver_auto", resolver_auto_agent)
    builder.add_node("escalator", escalator_agent)
    builder.add_node("confirm", _confirm_node)
    builder.add_node("finish", finish_node)
    builder.add_node("wait", _wait_node)

    _all_routes = {
        "intake": "intake",
        "classifier": "classifier",
        "vision": "vision",
        "resolver": "resolver",
        "resolver_auto": "resolver_auto",
        "escalator": "escalator",
        "finish": "finish",
        "confirm": "confirm",
        "wait": "wait",
    }

    # Entry: always route from __start__
    builder.set_conditional_entry_point(_supervisor_route, _all_routes)

    # After each agent, route again
    for node in ("intake", "classifier", "vision", "resolver", "resolver_auto", "escalator", "confirm"):
        builder.add_conditional_edges(node, _supervisor_route, _all_routes)

    builder.add_edge("finish", END)
    builder.add_edge("wait", END)
    return builder.compile()


# Singleton compiled graph
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
