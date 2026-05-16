#!/usr/bin/env python3
# apps/api/scripts/create_admin.py
"""Crea o promueve un usuario admin en la base de datos."""
from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from sqlmodel import select

from pae_api.db import get_session_factory
from pae_api.models.user import User
from pae_api.routers.auth import _hash_password


async def run(email: str, password: str, name: str) -> None:
    async with get_session_factory()() as db:
        result = await db.exec(select(User).where(User.email == email))
        user = result.first()

        if user:
            user.is_admin = True
            user.password_hash = _hash_password(password)
            await db.commit()
            print(f"✅ Usuario existente '{email}' promovido a admin y contraseña actualizada.")
        else:
            user = User(
                email=email,
                password_hash=_hash_password(password),
                name=name,
                is_admin=True,
            )
            db.add(user)
            await db.commit()
            print(f"✅ Admin '{name}' <{email}> creado exitosamente.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Crear o promover usuario admin")
    parser.add_argument("--email", required=True, help="Email del admin")
    parser.add_argument("--name", default="Administrador", help="Nombre del admin")
    parser.add_argument("--password", help="Contraseña (si no se da, se pide interactivamente)")
    args = parser.parse_args()

    if args.password:
        password = args.password
    else:
        password = getpass.getpass(f"Contraseña para {args.email}: ")

    if len(password) < 8:
        print("❌ La contraseña debe tener al menos 8 caracteres.")
        sys.exit(1)

    asyncio.run(run(args.email, password, args.name))
