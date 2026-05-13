"""
Limpia todos los datos de las tablas PQRS sin tocar el esquema.
Ejecutar con: uv run python reset_db_data.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from sqlalchemy import create_engine, text
from pae_api.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url_sync)

TABLES = ["message", "attachment", "agent_run", "event", "pqrs_case"]

with engine.begin() as conn:
    for table in TABLES:
        conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        print(f"  ✓ {table} vaciada")

print("\nBase de datos limpia. Esquema y extensiones intactos.")
