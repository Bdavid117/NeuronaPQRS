from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from ..config import get_settings
from ..deps import get_db
from ..models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

ALGORITHM = "HS256"
_TOKEN_EXPIRE_HOURS = 24 * 7


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260_000)
    return base64.b64encode(salt + key).decode()


def _verify_password(password: str, stored: str) -> bool:
    try:
        data = base64.b64decode(stored.encode())
        salt, key = data[:16], data[16:]
        new_key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260_000)
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False


def _create_token(user_id: int, email: str) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    name: str
    email: str


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.exec(select(User).where(User.email == request.email))
    if result.first():
        raise HTTPException(status_code=400, detail="Email ya registrado")
    user = User(
        email=request.email,
        password_hash=_hash_password(request.password),
        name=request.name or request.email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(
        token=_create_token(user.id, user.email),  # type: ignore[arg-type]
        name=user.name,
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.exec(select(User).where(User.email == request.email))
    user = result.first()
    if not user or not _verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    return TokenResponse(
        token=_create_token(user.id, user.email),  # type: ignore[arg-type]
        name=user.name,
        email=user.email,
    )
