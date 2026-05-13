from __future__ import annotations

from datetime import date, timedelta

from ..models.pqrs import PQRSTipo


# Plazos en días hábiles (aproximados en días calendario para MVP)
_PLAZOS_DIAS_HABILES: dict[str, int] = {
    PQRSTipo.PETICION: 15,
    PQRSTipo.QUEJA: 15,
    PQRSTipo.RECLAMO: 15,
    PQRSTipo.SUGERENCIA: 15,
    "reclamo_nota": 10,
    "certificado": 5,
    "homologacion": 20,
}

_WEEKEND_DAYS = {5, 6}  # Saturday, Sunday


def add_business_days(start: date, days: int) -> date:
    """Add N business days to a date (Mon-Fri)."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() not in _WEEKEND_DAYS:
            added += 1
    return current


def calcular_plazo(tipo: str, categoria: str | None = None) -> date:
    """Return the response deadline for a PQRS type/category."""
    key = categoria.lower().replace(" ", "_") if categoria else tipo
    dias = _PLAZOS_DIAS_HABILES.get(key, _PLAZOS_DIAS_HABILES.get(tipo, 15))
    return add_business_days(date.today(), dias)


def plazo_label(tipo: str, categoria: str | None = None) -> str:
    """Return a human-readable deadline description."""
    key = categoria.lower().replace(" ", "_") if categoria else tipo
    dias = _PLAZOS_DIAS_HABILES.get(key, 15)
    deadline = calcular_plazo(tipo, categoria)
    return f"{dias} días hábiles (hasta el {deadline.strftime('%d/%m/%Y')})"
