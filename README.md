# NeuronaPQRS

Sistema PQRS conversacional multi-agente para instituciones educativas. Los estudiantes presentan peticiones, quejas, reclamos y sugerencias a través de un chat con IA que guía la recolección de datos, valida documentos, genera respuestas citadas y radica el caso — sin formularios.

```
┌─────────────────────────────────────────────────────────────────┐
│  Estudiante habla o escribe  ──▶  Agentes IA  ──▶  Caso radicado │
│                                                                  │
│  Texto  o  🎤 Voz (Web Speech API / Whisper)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Inicio rápido

### Requisitos

- **Docker Desktop** (activo)
- **Python 3.14** — `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- **Node 25** — `/opt/homebrew/bin/node`
- **pnpm** — `/opt/homebrew/bin/pnpm`
- **uv** — `/Library/Frameworks/Python.framework/Versions/3.14/bin/uv`

### 1. API key de OpenRouter

Regístrate en [openrouter.ai](https://openrouter.ai), crea una key y pégala en `.env`:

```env
OPENROUTER_API_KEY=sk-or-tu-key-aqui
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Edita OPENROUTER_API_KEY y VAULT_ROOT (ruta absoluta a Neurona/)
```

### 3. Setup inicial (una sola vez)

```bash
bash scripts/setup.sh
```

Instala dependencias Python y Node, aplica las migraciones Alembic y siembra el vault Obsidian.

### 4. Levantar todo

```bash
bash dev.sh
```

Arranca Docker/PostgreSQL → aplica migraciones → Backend FastAPI → Frontend Next.js → abre el navegador.

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API / Swagger | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 (`pae`/`pae123`) |

---

## Estructura del proyecto

```
PAE-Agente/
├── Neurona/                   Base de conocimiento (vault Obsidian)
│   ├── 10-Catalogo-PQRS/      Tipos, categorías y campos requeridos
│   ├── 20-Casos/              Una nota por caso radicado
│   ├── 30-Conocimiento/       Reglamento, normativa, plazos, áreas
│   ├── 40-Plantillas/         Plantillas de respuesta automática
│   └── 90-Sistema/            Cola de escalamiento, runbooks
├── apps/
│   ├── api/                   Backend — FastAPI + LangGraph
│   │   ├── src/pae_api/
│   │   │   ├── agents/        Agentes IA (intake, classifier, resolver…)
│   │   │   ├── models/        Modelos SQLModel (DB + esquemas Pydantic)
│   │   │   ├── routers/       Endpoints FastAPI
│   │   │   └── services/      OpenRouter, Obsidian, caché, notificaciones
│   │   └── alembic/           Migraciones de base de datos
│   └── web/                   Frontend — Next.js 15
│       └── src/
│           ├── app/           Rutas Next.js (/, /chat, /r/[radicado])
│           ├── components/    Componentes React (chat, voice, layout)
│           └── lib/           Hooks de voz, SSE, utilidades
├── packages/
│   └── mcp-obsidian/          Servidor MCP para el vault Obsidian
├── infra/                     Seed del vault y helpers de infraestructura
├── docs/                      Documentación técnica detallada
├── dev.sh                     Script único para levantar todo
├── docker-compose.yml
└── .env.example
```

---

## Documentación técnica

| Documento | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Arquitectura completa y flujo de datos |
| [docs/agents.md](docs/agents.md) | Pipeline de agentes LangGraph |
| [docs/api.md](docs/api.md) | Referencia de endpoints REST + SSE |
| [docs/frontend.md](docs/frontend.md) | Estructura de la UI y componentes |
| [docs/voice-system.md](docs/voice-system.md) | Sistema de interacción por voz |
| [docs/knowledge-base.md](docs/knowledge-base.md) | Estructura del vault Obsidian |
| [docs/database.md](docs/database.md) | Esquema de base de datos |
| [docs/deployment.md](docs/deployment.md) | Guía de despliegue en producción |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, lucide-react |
| Backend | FastAPI, Python 3.14, asyncio |
| Agentes IA | LangGraph (grafo supervisor multi-agente) |
| LLMs | OpenRouter → Claude Sonnet 4.5, Claude Haiku 4.5, Whisper |
| Base de conocimiento | Obsidian vault via MCP propio |
| Base de datos | PostgreSQL 17 + pgvector |
| Empaquetado Python | uv (workspace monorepo) |
| Empaquetado Node | pnpm |

---

## Comandos útiles

```bash
# Levantar todo
bash dev.sh

# Solo el backend (modo desarrollo)
cd apps/api
uv run uvicorn pae_api.main:app --reload --port 8000

# Solo el frontend
cd apps/web
pnpm dev

# Aplicar migraciones
cd apps/api
uv run alembic upgrade head

# Limpiar datos de prueba
cd apps/api
uv run python reset_db_data.py

# Tests
cd apps/api
uv run pytest

# Makefile shortcuts
make help
make test
make api
make web
```

---

Licencia MIT · 2026
