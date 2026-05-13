from __future__ import annotations

import json
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import get_settings


class OpenRouterClient:
    """Async OpenRouter client with streaming, retries, and cost tracking."""

    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.openrouter_base_url
        self._api_key = settings.openrouter_api_key
        self._http = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "HTTP-Referer": "https://github.com/pae-agente/neurapqrs",
                "X-Title": "NeuronaPQRS",
            },
            timeout=httpx.Timeout(10.0, connect=5.0),
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        temperature: float = 0.3,
        max_tokens: int = 2048,
        tools: list[dict] | None = None,
        response_format: dict | None = None,
    ) -> dict[str, Any]:
        """Non-streaming chat completion. Returns full response dict."""
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            body["tools"] = tools
        if response_format:
            body["response_format"] = response_format

        resp = await self._http.post("/chat/completions", json=body)
        resp.raise_for_status()
        return resp.json()

    async def stream(
        self,
        model: str,
        messages: list[dict[str, Any]],
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion. Yields text chunks."""
        body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        async with self._http.stream("POST", "/chat/completions", json=body) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                try:
                    chunk = json.loads(raw)
                    delta = chunk["choices"][0].get("delta", {})
                    text = delta.get("content") or ""
                    if text:
                        yield text
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        filename: str = "audio.webm",
        language: str = "es",
    ) -> str:
        """
        Transcribe audio using the OpenAI Whisper endpoint exposed via OpenRouter.

        Returns the plain-text transcript.
        """
        files = {"file": (filename, audio_bytes, mime_type)}
        data = {"model": "openai/whisper-1", "language": language}
        resp = await self._http.post("/audio/transcriptions", files=files, data=data)
        resp.raise_for_status()
        return resp.json().get("text", "")

    def estimate_cost(self, response: dict) -> float:
        usage = response.get("usage", {})
        # Rough estimate — real pricing varies by model
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        return round((prompt_tokens * 0.000003 + completion_tokens * 0.000015), 6)


_client: OpenRouterClient | None = None


def get_openrouter() -> OpenRouterClient:
    global _client
    if _client is None:
        _client = OpenRouterClient()
    return _client
