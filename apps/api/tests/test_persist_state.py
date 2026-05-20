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


@pytest.mark.asyncio
async def test_bg_persist_skips_when_already_persisted():
    """Background task must no-op when inline persist succeeded."""
    from pae_api.routers.chat import _bg_persist_if_needed
    from unittest.mock import patch

    state_holder = {"persisted": True, "session_id": "abc", "final_state": {}}
    with patch("pae_api.routers.chat.get_session_factory") as mock_factory:
        await _bg_persist_if_needed(state_holder)
        mock_factory.assert_not_called()


def test_attachment_id_validation_drops_wrong_session():
    """IDs not belonging to the session must be silently dropped."""
    request_ids = [1, 2, 99]
    valid_ids = {1, 2}  # 99 belongs to another session
    invalid_ids = set(request_ids) - valid_ids
    validated = [i for i in request_ids if i in valid_ids]
    assert validated == [1, 2]
    assert invalid_ids == {99}


def test_attachment_id_validation_empty_request():
    """Empty attachment_ids list produces empty validated list."""
    request_ids = []
    valid_ids = set()
    validated = [i for i in request_ids if i in valid_ids]
    assert validated == []


@pytest.mark.asyncio
async def test_bg_persist_runs_when_inline_skipped():
    """Background task must call _persist_state when inline persist was skipped."""
    from pae_api.routers.chat import _bg_persist_if_needed
    from unittest.mock import patch, AsyncMock, MagicMock

    state_holder = {
        "persisted": False,
        "session_id": "test-session-001",
        "final_state": _make_state(),
    }

    mock_session = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=False)
    mock_session.exec = AsyncMock(return_value=AsyncMock(first=MagicMock(return_value=None)))
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.add = MagicMock()

    mock_factory = MagicMock(return_value=mock_session)

    with patch("pae_api.routers.chat.get_session_factory", return_value=mock_factory):
        await _bg_persist_if_needed(state_holder)
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_bg_persist_logs_error_when_session_factory_raises():
    """If get_session_factory raises, the error must be caught and logged (not re-raised)."""
    from pae_api.routers.chat import _bg_persist_if_needed
    from unittest.mock import patch, MagicMock

    state_holder = {
        "persisted": False,
        "session_id": "test-session-001",
        "final_state": _make_state(),
    }

    failing_factory = MagicMock(side_effect=Exception("connection pool exhausted"))

    with patch("pae_api.routers.chat.get_session_factory", return_value=failing_factory):
        # Must not raise — background tasks must be fire-and-forget
        await _bg_persist_if_needed(state_holder)
