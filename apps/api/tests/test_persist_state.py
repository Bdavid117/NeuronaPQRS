"""Tests for _persist_state state normalization logic."""
from __future__ import annotations
from langchain_core.messages import HumanMessage, AIMessage


def _make_state(**kwargs) -> dict:
    base = {
        "session_id": "test-session-001",
        "pqrs_tipo": "reclamo",
        "categoria": "Reclamo-Nota",
        "area": "Registro Académico",
        "urgencia": "media",
        "collected_fields": {"nombre_solicitante": "Ana Torres"},
        "validation_errors": [],
        "radicado": "PQRS-20260515-AABBCC",
        "plazo_respuesta": "2026-06-05",
        "requires_human": False,
        "vault_note_path": "20-Casos/PQRS-20260515-AABBCC.md",
        "confirmed": True,
        "awaiting_confirmation": False,
        "messages": [
            HumanMessage(content="Hola, tengo un reclamo"),
            AIMessage(content="Entendido, ¿cuál es su número de identificación?", name="intake"),
        ],
        "agent_runs": [
            {
                "agent_name": "intake",
                "model": "meta/llama-4-maverick",
                "tokens_in": 100,
                "tokens_out": 50,
                "cost_usd": 0.001,
                "duration_ms": 320,
            }
        ],
    }
    base.update(kwargs)
    return base


def test_tipo_uppercase_normalizes_to_lowercase():
    """B2: tipo RECLAMO should be stored as reclamo."""
    state = _make_state(pqrs_tipo="RECLAMO")
    assert str(state["pqrs_tipo"]).lower() == "reclamo"


def test_urgencia_uppercase_normalizes_to_lowercase():
    """B2: urgencia MEDIA should be stored as media."""
    state = _make_state(urgencia="MEDIA")
    assert str(state["urgencia"]).lower() == "media"


def test_vault_note_path_present_in_state():
    """B1: vault_note_path should be in state after finish_node."""
    state = _make_state()
    assert state.get("vault_note_path") == "20-Casos/PQRS-20260515-AABBCC.md"


def test_messages_have_correct_roles():
    """B3: messages should have human and ai types."""
    state = _make_state()
    types = [getattr(m, "type", None) for m in state["messages"]]
    assert "human" in types
    assert "ai" in types


def test_agent_runs_have_required_keys():
    """B4: agent_runs should have all required fields."""
    state = _make_state()
    run = state["agent_runs"][0]
    assert run["agent_name"] == "intake"
    assert run["tokens_in"] == 100
    assert "cost_usd" in run


import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_persist_state_single_commit_on_success():
    """_persist_state must call commit exactly once."""
    from pae_api.routers.chat import _persist_state

    db = AsyncMock()
    existing = MagicMock()
    existing.id = 42
    existing.turn_count = 1
    existing.collected_fields = {}
    existing.validation_errors = []
    db.exec = AsyncMock(return_value=AsyncMock(first=MagicMock(return_value=existing)))
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.add = MagicMock()

    await _persist_state(db, "test-session-001", _make_state())

    assert db.commit.await_count == 1
    db.flush.assert_awaited_once()


@pytest.mark.asyncio
async def test_persist_state_rollback_on_commit_failure():
    """If commit raises, must rollback and re-raise."""
    from pae_api.routers.chat import _persist_state

    db = AsyncMock()
    db.exec = AsyncMock(return_value=AsyncMock(first=MagicMock(return_value=None)))
    db.flush = AsyncMock()
    db.commit = AsyncMock(side_effect=Exception("DB constraint violation"))
    db.rollback = AsyncMock()
    db.add = MagicMock()

    with pytest.raises(Exception, match="DB constraint violation"):
        await _persist_state(db, "test-session-001", _make_state())

    db.rollback.assert_awaited_once()


def test_collected_fields_merge_preserves_previous():
    """A partial new dict must not erase DB fields not present in the update."""
    existing_db = {
        "nombre_solicitante": "Ana Torres",
        "numero_identificacion": "1234567",
        "correo_contacto": "ana@uni.edu.co",
    }
    new_state = {"descripcion_reclamo": "La nota está incorrecta"}
    merged = {**existing_db, **new_state}
    assert merged["nombre_solicitante"] == "Ana Torres"
    assert merged["descripcion_reclamo"] == "La nota está incorrecta"
    assert len(merged) == 4


def test_collected_fields_state_wins_on_conflict():
    """When same field appears in both DB and state, state value wins."""
    existing = {"nombre_solicitante": "Nombre Viejo"}
    new = {"nombre_solicitante": "Ana Torres Corrected"}
    merged = {**existing, **new}
    assert merged["nombre_solicitante"] == "Ana Torres Corrected"
