from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .db import create_all_tables
from .logging_config import get_logger, setup_logging
from .models.user import User as _User  # noqa: F401 — registers table with SQLModel metadata
from .rate_limit import RateLimitMiddleware
from .routers import chat, files, pqrs, transcribe
from .routers import auth
from .routers import admin as admin_router

setup_logging()
log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 NeuronaPQRS API starting up")
    await create_all_tables()
    log.info("✅ Database tables ready")
    yield
    log.info("🛑 NeuronaPQRS API shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="NeuronaPQRS API",
        description="Sistema PQRS conversacional multi-agente para instituciones educativas",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(RateLimitMiddleware)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        t0 = time.monotonic()
        response = await call_next(request)
        ms = int((time.monotonic() - t0) * 1000)
        status = response.status_code
        color = "\033[32m" if status < 400 else "\033[31m"
        log.info(
            f"{request.method} {request.url.path} → {color}{status}\033[0m  ({ms}ms)"
        )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(chat.router)
    app.include_router(files.router)
    app.include_router(pqrs.router)
    app.include_router(transcribe.router)
    app.include_router(admin_router.router)

    @app.get("/healthz", tags=["health"])
    async def health():
        return {"status": "ok", "version": "0.1.0"}

    return app


app = create_app()
