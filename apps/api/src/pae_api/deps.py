from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlmodel.ext.asyncio.session import AsyncSession

from .db import get_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session
