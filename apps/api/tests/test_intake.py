"""Tests for intake agent — retry on malformed JSON."""
from __future__ import annotations
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import HumanMessage


def _make_intake_state(**kwargs) -> dict:
    base = {
        "pqrs_tipo": "reclamo",
        "collected_fields": {"nombre_solicitante": "Ana"},
        "pending_fields": ["numero_identificacion"],
        "validation_errors": ["Error previo"],
        "messages": [HumanMessage(content="Mi ID es 1234567")],
        "agent_runs": [],
        "requires_human": False,
    }
    base.update(kwargs)
    return base


@pytest.mark.asyncio
async def test_intake_retries_on_malformed_json_and_preserves_errors():
    """When LLM returns malformed JSON, must retry and preserve validation_errors."""
    from pae_api.agents.intake import intake_agent

    malformed_resp = {
        "choices": [{"message": {"content": "no es json {{{"}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }

    with patch("pae_api.agents.intake.get_nvidia_nim") as mock_nim:
        client = AsyncMock()
        client.chat = AsyncMock(return_value=malformed_resp)
        client.estimate_cost = MagicMock(return_value=0.0)
        mock_nim.return_value = client

        result = await intake_agent(_make_intake_state())

        # Must have retried (2 calls for 2 attempts)
        assert client.chat.await_count == 2
        # validation_errors preserved, not cleared
        assert "Error previo" in result["validation_errors"]
        # collected_fields preserves existing fields
        assert result["collected_fields"]["nombre_solicitante"] == "Ana"
        # reply is non-empty Spanish message
        assert len(result["messages"][0].content) > 10


@pytest.mark.asyncio
async def test_intake_succeeds_on_second_attempt():
    """If first attempt fails and second returns valid JSON, must use the result."""
    from pae_api.agents.intake import intake_agent

    malformed = {"choices": [{"message": {"content": "{"}}], "usage": {}}
    valid = {
        "choices": [{
            "message": {"content": '{"reply": "¿Su número?", "extracted_fields": {"numero_identificacion": "1234567"}, "remaining_fields": [], "validation_errors": [], "escalate": false, "sentiment": "neutral"}'}
        }],
        "usage": {"prompt_tokens": 20, "completion_tokens": 15},
    }

    with patch("pae_api.agents.intake.get_nvidia_nim") as mock_nim:
        client = AsyncMock()
        client.chat = AsyncMock(side_effect=[malformed, valid])
        client.estimate_cost = MagicMock(return_value=0.001)
        mock_nim.return_value = client

        result = await intake_agent(_make_intake_state())

        assert result["collected_fields"].get("numero_identificacion") == "1234567"
