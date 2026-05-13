from __future__ import annotations

import hmac
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..models.pqrs import PQRSCase, PQRSEstado

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateStatusBody(BaseModel):
    estado: PQRSEstado


class LoginBody(BaseModel):
    username: str
    password: str


def _verify_admin(request: Request) -> None:
    """Simple token-based admin auth — checks Authorization header or cookie."""
    settings = get_settings()
    secret = settings.admin_token_secret

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and hmac.compare_digest(auth[7:], secret):
        return

    cookie = request.cookies.get("pae_admin_token", "")
    if hmac.compare_digest(cookie, secret):
        return

    raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/cases")
async def list_cases(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    area: Optional[str] = None,
    urgencia: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    _verify_admin(request)

    stmt = select(PQRSCase)
    if tipo:
        stmt = stmt.where(PQRSCase.tipo == tipo)
    if estado:
        stmt = stmt.where(PQRSCase.estado == estado)
    if area:
        stmt = stmt.where(PQRSCase.area == area)
    if urgencia:
        stmt = stmt.where(PQRSCase.urgencia == urgencia)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await session.scalar(count_stmt) or 0

    stmt = stmt.order_by(PQRSCase.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await session.exec(stmt)
    cases = result.all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "cases": [
            {
                "id": c.id,
                "radicado": c.radicado,
                "tipo": c.tipo,
                "categoria": c.categoria,
                "area": c.area,
                "urgencia": c.urgencia,
                "estado": c.estado,
                "requiere_revision_humana": c.requiere_revision_humana,
                "plazo_respuesta": c.plazo_respuesta.isoformat() if c.plazo_respuesta else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in cases
        ],
    }


@router.patch("/cases/{radicado}/status")
async def update_case_status(
    radicado: str,
    body: UpdateStatusBody,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    _verify_admin(request)

    result = await session.exec(select(PQRSCase).where(PQRSCase.radicado == radicado))
    case = result.first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.estado = body.estado
    case.updated_at = datetime.utcnow()
    await session.commit()
    return {"status": "updated", "radicado": radicado, "estado": body.estado}


@router.post("/login")
async def admin_login(body: LoginBody, request: Request):
    settings = get_settings()
    user_ok = hmac.compare_digest(body.username, settings.admin_username)
    pass_ok = hmac.compare_digest(body.password, settings.admin_password)
    if user_ok and pass_ok:
        return {"token": settings.admin_token_secret}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")
