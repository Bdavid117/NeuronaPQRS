from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import get_settings
from ..services.nvidia_nim import get_nvidia_nim

router = APIRouter(prefix="/transcribe", tags=["voice"])


class TranscribeResponse(BaseModel):
    transcript: str
    language: str = "es"


@router.post("", response_model=TranscribeResponse)
async def transcribe_audio(audio: UploadFile = File(...)) -> TranscribeResponse:
    """
    Transcribe an audio file to text using OpenRouter's Whisper model.

    Accepts: audio/webm, audio/wav, audio/mp4, audio/mpeg (≤ 25 MB).
    Returns the Spanish transcript.

    This endpoint is a Whisper fallback for browsers where the Web Speech API
    is unavailable (e.g. Firefox, Safari).
    """
    settings = get_settings()
    client = get_nvidia_nim()

    content = await audio.read()
    max_bytes = 25 * 1024 * 1024  # Whisper hard limit
    if len(content) > max_bytes:
        raise HTTPException(413, "El archivo de audio supera el límite de 25 MB.")

    allowed_mimes = {
        "audio/webm",
        "audio/wav",
        "audio/mp4",
        "audio/mpeg",
        "audio/ogg",
        "audio/x-m4a",
    }
    mime = audio.content_type or "audio/webm"
    if mime not in allowed_mimes:
        raise HTTPException(415, f"Formato de audio no soportado: {mime}")

    try:
        transcript = await client.transcribe(
            audio_bytes=content,
            mime_type=mime,
            filename=audio.filename or "audio.webm",
            language="es",
        )
    except Exception as exc:
        raise HTTPException(502, f"Error al transcribir el audio: {exc}") from exc

    return TranscribeResponse(transcript=transcript)
