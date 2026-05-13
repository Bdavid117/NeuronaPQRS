from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from ..deps import get_db
from ..models.pqrs import PQRSCase
from ..models.schemas import PQRSStatusResponse

router = APIRouter(prefix="/pqrs", tags=["pqrs"])


@router.get("/{radicado}", response_model=PQRSStatusResponse)
async def get_pqrs_status(radicado: str, db: AsyncSession = Depends(get_db)) -> PQRSStatusResponse:
    result = await db.exec(select(PQRSCase).where(PQRSCase.radicado == radicado))
    case = result.first()
    if not case:
        raise HTTPException(404, f"Caso '{radicado}' no encontrado.")

    return PQRSStatusResponse(
        radicado=case.radicado,
        tipo=case.tipo,
        categoria=case.categoria,
        area=case.area,
        urgencia=case.urgencia,
        estado=case.estado,
        created_at=case.created_at,
        plazo_respuesta=case.plazo_respuesta,
        collected_fields={k: v for k, v in (case.collected_fields or {}).items() if k not in {"numero_identificacion"}},
    )
