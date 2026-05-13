from __future__ import annotations

import time

from langchain_core.messages import AIMessage

from ..services.obsidian import read_note
from .state import PQRSState

# Categories that have pre-defined Obsidian templates and can be resolved
# without an LLM call.
AUTO_RESOLVE_CATEGORIES: set[str] = {
    "Certificado-Academico",
    "Biblioteca",
    "Servicios-TI",
    "Bienestar",
}

# Fallback templates used when the Obsidian note is not found.
_FALLBACK_TEMPLATES: dict[str, str] = {
    "Certificado-Academico": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Hemos recibido su solicitud de certificado académico con radicado **{radicado}**. "
        "El proceso de expedición toma entre 3 y 5 días hábiles. "
        "Le notificaremos al correo registrado cuando el documento esté disponible.\n\n"
        "Atentamente,\nRegistraduría Académica"
    ),
    "Biblioteca": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Su solicitud relacionada con Biblioteca ha sido radicada bajo el número **{radicado}**. "
        "Nuestro equipo atenderá su requerimiento en un plazo máximo de 2 días hábiles.\n\n"
        "Atentamente,\nBiblioteca Universitaria"
    ),
    "Servicios-TI": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Su solicitud de Servicios TI ha sido registrada con el radicado **{radicado}**. "
        "El equipo de soporte técnico dará respuesta dentro de 1 a 3 días hábiles.\n\n"
        "Atentamente,\nDirección de Tecnologías de la Información"
    ),
    "Bienestar": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Su solicitud de servicios de Bienestar Universitario ha sido radicada bajo el número **{radicado}**. "
        "Nuestro equipo la atenderá en un plazo máximo de 5 días hábiles.\n\n"
        "Atentamente,\nBienestar Universitario"
    ),
}

_DEFAULT_FALLBACK = (
    "Estimado/a {nombre_solicitante},\n\n"
    "Su solicitud ha sido registrada exitosamente con el radicado **{radicado}**. "
    "Le daremos respuesta en los plazos establecidos.\n\n"
    "Atentamente,\nNeuronaPQRS"
)


def _fill_template(template: str, collected: dict, radicado: str) -> str:
    """Replace known placeholders in the template with collected field values."""
    nombre = (
        collected.get("nombre_solicitante")
        or collected.get("nombre")
        or "Estudiante"
    )
    return (
        template
        .replace("{nombre_solicitante}", nombre)
        .replace("{radicado}", radicado)
        .replace("{nombre}", nombre)
    )


async def resolver_auto_agent(state: PQRSState) -> dict:
    """
    Zero-token resolver for standard PQRS categories.

    Called when ``categoria`` is in ``AUTO_RESOLVE_CATEGORIES``.
    Reads a Markdown template from the Obsidian vault (``40-Plantillas/<categoria>.md``).
    Falls back to a hardcoded string when the note is absent.
    Returns the same shape as ``resolver_agent`` so the supervisor graph treats
    them interchangeably.
    """
    start = time.monotonic()

    categoria = state.get("categoria", "")
    collected = state.get("collected_fields", {})
    # Radicado may not exist yet at this point; use a placeholder.
    radicado = state.get("radicado") or "PQRS-PENDIENTE"

    # Try to load the template from Obsidian
    template_text: str | None = None
    try:
        note = read_note(f"40-Plantillas/{categoria}.md")
        template_text = note.get("body")
    except Exception:
        template_text = None

    if not template_text:
        template_text = _FALLBACK_TEMPLATES.get(categoria, _DEFAULT_FALLBACK)

    draft = _fill_template(template_text, collected, radicado)

    run_record = {
        "agent_name": "resolver_auto",
        "model": "none",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    return {
        "messages": [AIMessage(content=draft, name="resolver_auto")],
        "draft_response": draft,
        "kb_citations": [],
        "confidence": 0.85,
        "requires_human": False,
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
