from __future__ import annotations

from datetime import datetime, timezone, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..models.pqrs import AgentRun, PQRSCase, PQRSEstado
from ..models.user import User
from ..routers.auth import ALGORITHM, _verify_password, _create_token

router = APIRouter(prefix="/admin", tags=["admin"])


class UpdateStatusBody(BaseModel):
    estado: PQRSEstado


class LoginBody(BaseModel):
    username: str
    password: str


async def _get_admin_user(token: str, db: AsyncSession) -> User:
    """Decode JWT, load user, verify is_admin."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub", 0))
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido")

    result = await db.exec(select(User).where(User.id == user_id))
    user = result.first()
    if not user or not user.is_active or not user.is_admin:
        raise HTTPException(status_code=403, detail="Acceso denegado — se requiere rol admin")
    return user


def _extract_token(request: Request) -> str:
    """Extract bearer token from cookie or Authorization header."""
    token = request.cookies.get("pae_admin_token", "")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    return token


async def require_admin(
    request: Request,
    db: AsyncSession = Depends(get_session),
) -> User:
    """FastAPI dependency: validates JWT and verifies is_admin."""
    return await _get_admin_user(_extract_token(request), db)


@router.post("/login")
async def admin_login(body: LoginBody, db: AsyncSession = Depends(get_session)):
    """Authenticate admin user by email+password, return JWT."""
    result = await db.exec(select(User).where(User.email == body.username))
    user = result.first()
    if not user or not user.is_active or not user.is_admin or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"token": _create_token(user.id, user.email)}


@router.get("/cases")
async def list_cases(
    _admin: User = Depends(require_admin),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    area: Optional[str] = None,
    urgencia: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
):
    stmt = select(PQRSCase)
    if tipo:
        stmt = stmt.where(PQRSCase.tipo == tipo.lower())
    if estado:
        stmt = stmt.where(PQRSCase.estado == estado)
    if area:
        stmt = stmt.where(PQRSCase.area == area)
    if urgencia:
        stmt = stmt.where(PQRSCase.urgencia == urgencia.lower())

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    stmt = stmt.order_by(PQRSCase.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.exec(stmt)
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
                "turn_count": c.turn_count,
            }
            for c in cases
        ],
    }


@router.get("/cases/{radicado}")
async def get_case(
    radicado: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.exec(select(PQRSCase).where(PQRSCase.radicado == radicado))
    case = result.first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    return {
        "id": case.id,
        "radicado": case.radicado,
        "tipo": case.tipo,
        "categoria": case.categoria,
        "area": case.area,
        "urgencia": case.urgencia,
        "estado": case.estado,
        "requiere_revision_humana": case.requiere_revision_humana,
        "plazo_respuesta": case.plazo_respuesta.isoformat() if case.plazo_respuesta else None,
        "created_at": case.created_at.isoformat(),
        "turn_count": case.turn_count,
        "collected_fields": case.collected_fields,
        "vault_note_path": case.vault_note_path,
    }


@router.patch("/cases/{radicado}/status")
async def update_case_status(
    radicado: str,
    body: UpdateStatusBody,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    result = await db.exec(select(PQRSCase).where(PQRSCase.radicado == radicado))
    case = result.first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.estado = body.estado
    case.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "updated", "radicado": radicado, "estado": body.estado}


@router.get("/stats")
async def get_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    thirty_days_ago = now - timedelta(days=30)
    today = date.today()

    total = await db.scalar(select(func.count()).select_from(PQRSCase)) or 0
    this_week = await db.scalar(
        select(func.count()).select_from(PQRSCase).where(PQRSCase.created_at >= one_week_ago)
    ) or 0
    last_week = await db.scalar(
        select(func.count()).select_from(PQRSCase).where(
            PQRSCase.created_at >= two_weeks_ago,
            PQRSCase.created_at < one_week_ago,
        )
    ) or 0

    tipo_rows = await db.exec(
        select(PQRSCase.tipo, func.count().label("cnt"))
        .where(PQRSCase.tipo.isnot(None))
        .group_by(PQRSCase.tipo)
    )
    por_tipo = {row.tipo: row.cnt for row in tipo_rows.all()}

    urgencia_rows = await db.exec(
        select(PQRSCase.urgencia, func.count().label("cnt")).group_by(PQRSCase.urgencia)
    )
    por_urgencia = {row.urgencia: row.cnt for row in urgencia_rows.all()}

    area_rows = await db.exec(
        select(PQRSCase.area, func.count().label("cnt"))
        .where(PQRSCase.area.isnot(None))
        .group_by(PQRSCase.area)
        .order_by(func.count().desc())
        .limit(5)
    )
    por_area = [{"area": row.area, "count": row.cnt} for row in area_rows.all()]

    vencidos = await db.scalar(
        select(func.count()).select_from(PQRSCase).where(
            PQRSCase.plazo_respuesta < today,
            PQRSCase.estado != PQRSEstado.CERRADO,
        )
    ) or 0
    en_riesgo_limit = today + timedelta(days=3)
    en_riesgo = await db.scalar(
        select(func.count()).select_from(PQRSCase).where(
            PQRSCase.plazo_respuesta >= today,
            PQRSCase.plazo_respuesta <= en_riesgo_limit,
            PQRSCase.estado != PQRSEstado.CERRADO,
        )
    ) or 0
    a_tiempo = await db.scalar(
        select(func.count()).select_from(PQRSCase).where(
            PQRSCase.plazo_respuesta >= today,
            PQRSCase.plazo_respuesta > en_riesgo_limit,
            PQRSCase.estado != PQRSEstado.CERRADO,
        )
    ) or 0

    pending_human = await db.scalar(
        select(func.count()).select_from(PQRSCase).where(
            PQRSCase.requiere_revision_humana == True,
            PQRSCase.estado != PQRSEstado.CERRADO,
        )
    ) or 0

    cost_result = await db.scalar(
        select(func.sum(AgentRun.cost_usd)).where(AgentRun.created_at >= one_week_ago)
    )
    costo_semana = round(float(cost_result or 0), 4)

    days_rows = await db.exec(
        select(
            func.date_trunc("day", PQRSCase.created_at).label("day"),
            func.count().label("cnt"),
        )
        .where(PQRSCase.created_at >= thirty_days_ago)
        .group_by(func.date_trunc("day", PQRSCase.created_at))
        .order_by(func.date_trunc("day", PQRSCase.created_at))
    )
    casos_por_dia = [{"date": str(row.day)[:10], "count": row.cnt} for row in days_rows.all()]

    return {
        "total_casos": total,
        "delta_semana": this_week - last_week,
        "this_week": this_week,
        "por_tipo": por_tipo,
        "por_urgencia": por_urgencia,
        "por_area": por_area,
        "sla_status": {
            "vencidos": vencidos,
            "en_riesgo": en_riesgo,
            "a_tiempo": a_tiempo,
        },
        "pendientes_revision_humana": pending_human,
        "costo_llm_semana_usd": costo_semana,
        "casos_por_dia": casos_por_dia,
    }
