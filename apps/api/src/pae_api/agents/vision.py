from __future__ import annotations

import base64
import json
import time
from pathlib import Path

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..services.nvidia_nim import get_nvidia_nim
from .state import PQRSState

_PROMPT = (Path(__file__).parent / "prompts" / "vision.md").read_text()


def _image_to_b64(file_path: str) -> tuple[str, str]:
    """Return (base64_data, mime_type)."""
    path = Path(file_path)
    ext = path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf", ".webp": "image/webp"}
    mime = mime_map.get(ext, "image/jpeg")
    data = base64.b64encode(path.read_bytes()).decode()
    return data, mime


async def vision_agent(state: PQRSState, db_session=None) -> dict:
    from ..models.pqrs import Attachment
    from sqlmodel import select

    settings = get_settings()
    client = get_nvidia_nim()
    start = time.monotonic()

    attachment_ids = state.get("attachment_ids", [])
    existing_results = state.get("vision_results", [])
    processed_ids = {r.get("attachment_id") for r in existing_results}
    unprocessed = [aid for aid in attachment_ids if aid not in processed_ids]

    if not unprocessed or db_session is None:
        return {}

    new_results = list(existing_results)
    all_errors: list[str] = list(state.get("validation_errors", []))
    run_records: list[dict] = []

    for aid in unprocessed:
        result = await db_session.exec(select(Attachment).where(Attachment.id == aid))
        attachment = result.first()
        if not attachment:
            continue

        try:
            b64_data, mime = _image_to_b64(attachment.file_path)
        except FileNotFoundError:
            all_errors.append(f"Archivo adjunto {aid} no encontrado.")
            continue

        messages = [
            {"role": "system", "content": _PROMPT},
            {"role": "system", "content": f"Campos ya declarados por el usuario: {json.dumps(state.get('collected_fields', {}), ensure_ascii=False)}"},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Por favor analiza este documento."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_data}"}},
                ],
            },
        ]

        resp = await client.chat(
            model=settings.model_vision,
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        cost = client.estimate_cost(resp)
        usage = resp.get("usage", {})
        raw = resp["choices"][0]["message"]["content"]

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"doc_type": "unknown", "extracted": {}, "validation_errors": [], "confidence": 0.5}

        vision_result = {
            "attachment_id": aid,
            "doc_type": parsed.get("doc_type", "unknown"),
            "extracted": parsed.get("extracted", {}),
            "validation_errors": parsed.get("validation_errors", []),
            "confidence": parsed.get("confidence", 0.5),
        }
        new_results.append(vision_result)
        all_errors.extend(parsed.get("validation_errors", []))

        run_records.append({
            "agent_name": "vision",
            "model": settings.model_vision,
            "tokens_in": usage.get("prompt_tokens", 0),
            "tokens_out": usage.get("completion_tokens", 0),
            "cost_usd": cost,
            "duration_ms": int((time.monotonic() - start) * 1000),
        })

    reply_text = "He revisado el(los) documento(s) adjunto(s)."
    if all_errors:
        reply_text += f" Encontré algunas inconsistencias que necesito que aclaremos: {'; '.join(all_errors)}"
    else:
        reply_text += " Todo parece estar en orden."

    return {
        "messages": [AIMessage(content=reply_text, name="vision")],
        "vision_results": new_results,
        "validation_errors": list(set(all_errors)),
        "agent_runs": state.get("agent_runs", []) + run_records,
    }
