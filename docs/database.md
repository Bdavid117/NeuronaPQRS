# Base de datos — PostgreSQL 17 + pgvector

Conexión de desarrollo: `postgresql+asyncpg://pae:pae123@localhost:5432/pae_pqrs`

ORM: **SQLModel** (Pydantic + SQLAlchemy). Las migraciones se gestionan con **Alembic**.

---

## Esquema — 6 tablas

```
pqrs_case
    │
    ├──◀ message (n)
    ├──◀ attachment (n)
    ├──◀ agent_run (n)
    └──◀ event (n)

semantic_cache  (independiente, sin FK)
```

---

## Tabla: `pqrs_case`

Caso PQRS principal. Una fila por conversación que llega a `finish_node`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | integer PK | |
| `radicado` | varchar UNIQUE | `PQRS-YYYYMMDD-XXXXXX` |
| `session_id` | varchar INDEX | UUID de sesión del frontend |
| `tipo` | enum | `peticion` \| `queja` \| `reclamo` \| `sugerencia` |
| `categoria` | varchar | `Reclamo-Nota`, `Certificado-Academico`, etc. |
| `area` | varchar | Área responsable (ej. "Registro Académico") |
| `urgencia` | enum | `alta` \| `media` \| `baja` (default: `baja`) |
| `estado` | enum | `abierto` \| `en_proceso` \| `escalado` \| `cerrado` (default: `abierto`) |
| `requiere_revision_humana` | boolean | `true` si el escalator intervino |
| `plazo_respuesta` | date | Fecha límite calculada desde `tipo` + `categoria` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Actualizado en cada delta de estado |
| `collected_fields` | JSONB | Campos recolectados por intake (nombre, correo, etc.) |
| `validation_errors` | JSONB | Lista de errores de validación del intake |
| `vault_note_path` | varchar | Ruta relativa en el vault: `20-Casos/PQRS-…md` |

### Enums PostgreSQL

```sql
CREATE TYPE pqrstipo   AS ENUM ('peticion','queja','reclamo','sugerencia');
CREATE TYPE pqrsurgencia AS ENUM ('alta','media','baja');
CREATE TYPE pqrsestado AS ENUM ('abierto','en_proceso','escalado','cerrado');
```

---

## Tabla: `message`

Historial de conversación del chat.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | integer PK | |
| `case_id` | integer FK INDEX | → `pqrs_case.id` |
| `role` | varchar | `user` \| `assistant` \| `system` |
| `content` | text | Texto completo del mensaje |
| `agent_name` | varchar | Nombre del agente que generó el mensaje (null si es del usuario) |
| `tool_calls` | JSONB | Llamadas a herramientas MCP realizadas en el mensaje |
| `created_at` | timestamptz | |

---

## Tabla: `attachment`

Archivos adjuntos subidos por el usuario.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | integer PK | |
| `case_id` | integer FK INDEX | → `pqrs_case.id` (null hasta que el caso se crea) |
| `session_id` | varchar INDEX | Permite asociar adjuntos antes de tener `case_id` |
| `filename` | varchar | Nombre original del archivo |
| `mime_type` | varchar | `image/jpeg`, `application/pdf`, etc. |
| `file_path` | varchar | Ruta absoluta en `./uploads/` con UUID como nombre |
| `extracted_data` | JSONB | Datos extraídos por el agente vision (nombre, nota, etc.) |
| `validated` | boolean | `true` si vision confirmó que coincide con lo declarado |
| `created_at` | timestamptz | |

---

## Tabla: `agent_run`

Telemetría de cada ejecución de agente. Una fila por agente por turno de conversación.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | integer PK | |
| `case_id` | integer FK INDEX | → `pqrs_case.id` |
| `agent_name` | varchar | `intake`, `classifier`, `resolver`, etc. |
| `model` | varchar | ID completo del modelo: `anthropic/claude-sonnet-4-5` |
| `tokens_in` | integer | Tokens de entrada consumidos |
| `tokens_out` | integer | Tokens de salida generados |
| `cost_usd` | float | Costo estimado en USD |
| `duration_ms` | integer | Duración de la llamada al LLM |
| `created_at` | timestamptz | |

Los registros se guardan en `_persist_state()` al finalizar cada sesión.

---

## Tabla: `event`

Log de eventos del ciclo de vida del caso.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | integer PK | |
| `case_id` | integer FK INDEX | → `pqrs_case.id` |
| `type` | varchar | Tipo de evento: `created`, `agent_switch`, `escalated`, `closed` |
| `payload` | JSONB | Datos contextuales del evento |
| `created_at` | timestamptz | |

---

## Tabla: `semantic_cache`

Caché de respuestas del resolver para evitar llamadas LLM repetidas.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | integer PK | |
| `query_hash` | varchar INDEX | SHA-256 de `"{tipo}:{categoria}:{query.lower()}"` |
| `query_text` | text | Texto original de la consulta |
| `query_embedding` | text | Reservado para pgvector (futuro) |
| `response_text` | text | Borrador de respuesta cacheado |
| `kb_citations` | JSONB | Lista de `{path, excerpt, score}` del vault |
| `tipo` | varchar | `peticion`, `queja`, etc. |
| `categoria` | varchar | `Reclamo-Nota`, etc. (nullable) |
| `hit_count` | integer | Número de veces que este cache fue utilizado |
| `created_at` | timestamptz | |

### Uso

```python
# Antes de invocar el grafo:
cached = await get_cached_response(db, message, tipo, categoria)
if cached:
    init_state["draft_response"] = cached["response_text"]
    # El supervisor enruta directamente a finish_node

# Después de que resolver genera una respuesta nueva:
await store_response(db, message, tipo, categoria, draft, citations)
```

La colisión de hash se maneja con `try/except` + rollback: si la misma consulta llega dos veces concurrentemente, solo una se guarda.

---

## Migraciones Alembic

```
apps/api/alembic/
├── env.py
├── script.py.mako
└── versions/
    ├── 001_initial.py          Todas las tablas core + índices
    └── 002_add_semantic_cache.py  Tabla semantic_cache + extensión vector
```

### Comandos

```bash
cd apps/api

# Aplicar todas las migraciones pendientes
uv run alembic upgrade head

# Ver historial de migraciones
uv run alembic history

# Crear una nueva migración
uv run alembic revision --autogenerate -m "descripcion"

# Revertir una migración
uv run alembic downgrade -1
```

### Extensión pgvector

La migración `001_initial.py` activa la extensión de forma idempotente:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Esto permite añadir columnas `vector(1536)` en el futuro para búsqueda semántica real en `semantic_cache.query_embedding`.

---

## Índices

Creados en `001_initial.py` para las consultas más frecuentes:

| Tabla | Columna(s) | Tipo |
|---|---|---|
| `pqrs_case` | `radicado` | UNIQUE |
| `pqrs_case` | `session_id` | INDEX |
| `message` | `case_id` | INDEX |
| `attachment` | `case_id` | INDEX |
| `attachment` | `session_id` | INDEX |
| `agent_run` | `case_id` | INDEX |
| `event` | `case_id` | INDEX |
| `semantic_cache` | `query_hash` | INDEX |

---

## Conexión async

El backend usa **asyncpg** para todas las operaciones de BD. La sesión se obtiene con FastAPI dependency injection:

```python
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_sessionmaker(engine)() as session:
        yield session
```

La URL sync (`psycopg2`) solo la usa Alembic para las migraciones.
