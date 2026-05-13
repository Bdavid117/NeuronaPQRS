from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..deps import get_db
from ..models.pqrs import Attachment
from ..models.schemas import UploadResponse

router = APIRouter(prefix="/upload", tags=["files"])


@router.post("", response_model=UploadResponse)
async def upload_file(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    settings = get_settings()

    # Validate size
    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(413, f"Archivo demasiado grande. Máximo {settings.max_upload_size_mb} MB.")

    # Validate mime
    allowed_mimes = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed_mimes:
        raise HTTPException(415, f"Tipo de archivo no permitido: {file.content_type}")

    # Save file
    ext = Path(file.filename or "upload").suffix or ".bin"
    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / safe_name
    dest.write_bytes(content)

    attachment = Attachment(
        session_id=session_id,
        filename=file.filename or safe_name,
        mime_type=file.content_type or "application/octet-stream",
        file_path=str(dest),
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    return UploadResponse(attachment_id=attachment.id, filename=attachment.filename)
