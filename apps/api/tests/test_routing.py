from __future__ import annotations
from pae_api.agents.graph import _missing_fields, REQUIRED_FIELDS


def _state(**kwargs):
    base = {
        "pqrs_tipo": None, "categoria": None, "area": None, "urgencia": "baja",
        "collected_fields": {}, "pending_fields": [], "validation_errors": [],
        "messages": [], "session_id": "test", "attachment_ids": [], "vision_results": [],
        "kb_citations": [], "draft_response": None, "confidence": 0.0,
        "next_agent": None, "radicado": None, "plazo_label": None, "plazo_respuesta": None,
        "requires_human": False, "agent_runs": [], "qr_code_b64": None, "case_url": None,
        "confirmed": False, "awaiting_confirmation": False,
    }
    base.update(kwargs)
    return base


def test_missing_fields_reclamo_empty():
    state = _state(pqrs_tipo="reclamo")
    missing = _missing_fields(state)
    assert "nombre_solicitante" in missing
    assert "descripcion_reclamo" in missing
    assert len(missing) == len(REQUIRED_FIELDS["reclamo"])


def test_missing_fields_reclamo_partial():
    state = _state(
        pqrs_tipo="reclamo",
        collected_fields={
            "nombre_solicitante": "Carlos",
            "numero_identificacion": "123",
            "correo_contacto": "c@uni.edu.co",
        },
    )
    missing = _missing_fields(state)
    assert "nombre_solicitante" not in missing
    assert "descripcion_reclamo" in missing
    assert "programa_academico" in missing


def test_missing_fields_reclamo_complete():
    state = _state(
        pqrs_tipo="reclamo",
        collected_fields={
            "nombre_solicitante": "Carlos",
            "numero_identificacion": "123",
            "correo_contacto": "c@uni.edu.co",
            "programa_academico": "Sistemas",
            "codigo_estudiante": "20231045",
            "descripcion_reclamo": "Nota incorrecta",
        },
    )
    assert _missing_fields(state) == []


def test_missing_fields_sugerencia():
    state = _state(
        pqrs_tipo="sugerencia",
        collected_fields={"descripcion_sugerencia": "Mejorar el campus"},
    )
    assert _missing_fields(state) == []


def test_missing_fields_unknown_tipo():
    state = _state(pqrs_tipo="desconocido")
    missing = _missing_fields(state)
    assert "nombre_solicitante" in missing


def test_pending_fields_not_used_in_routing():
    """pending_fields LLM value must NOT affect _missing_fields result."""
    state = _state(
        pqrs_tipo="reclamo",
        collected_fields={
            "nombre_solicitante": "Carlos",
            "numero_identificacion": "123",
            "correo_contacto": "c@uni.edu.co",
            "programa_academico": "Sistemas",
            "codigo_estudiante": "20231045",
            "descripcion_reclamo": "Nota incorrecta",
        },
        pending_fields=["nombre_solicitante"],  # LLM wrongly says this is pending
    )
    assert _missing_fields(state) == []


def test_missing_fields_peticion():
    state = _state(pqrs_tipo="peticion")
    missing = _missing_fields(state)
    assert "descripcion_peticion" in missing
    assert len(missing) == len(REQUIRED_FIELDS["peticion"])


def test_missing_fields_queja():
    state = _state(pqrs_tipo="queja")
    missing = _missing_fields(state)
    assert "descripcion_situacion" in missing
    assert len(missing) == len(REQUIRED_FIELDS["queja"])
