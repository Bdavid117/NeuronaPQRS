from __future__ import annotations

# TODO: Implement proactive notifications via email/WhatsApp (Twilio)
# Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE env vars


async def notify_case_update(radicado: str, tipo: str, estado: str, email: str | None) -> None:
    pass


async def notify_deadline_approaching(radicado: str, days_left: int, email: str | None) -> None:
    pass
