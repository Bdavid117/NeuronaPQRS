from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

_WINDOW_SECONDS = 60
_MAX_REQUESTS = 12  # per IP per minute on /chat

# In-memory store: {ip: [timestamp, ...]}
_counters: dict[str, list[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple sliding-window rate limiter for POST /chat."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and request.url.path in ("/chat",):
            ip = request.client.host if request.client else "unknown"
            now = time.monotonic()
            window = _counters[ip]
            # Evict timestamps outside the rolling window
            _counters[ip] = [t for t in window if now - t < _WINDOW_SECONDS]
            if len(_counters[ip]) >= _MAX_REQUESTS:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Límite de {_MAX_REQUESTS} mensajes por minuto alcanzado. Intente más tarde."},
                )
            _counters[ip].append(now)

        return await call_next(request)
