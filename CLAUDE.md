# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**NeuronaPQRS** — Sistema PQRS conversacional multi-agente para institución educativa.

This is a **monorepo** combining:
1. `Neurona/` — Obsidian vault (knowledge base + case log), in Spanish.
2. `apps/api/` — FastAPI backend + LangGraph agents (Python 3.14, uv).
3. `apps/web/` — Next.js 15 frontend (Node 25, pnpm).
4. `packages/mcp-obsidian/` — MCP stdio server for the Neurona vault (Python).
5. `infra/` — Docker config and vault seed data.

## Toolchain

- Python: `/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`
- uv: `/Library/Frameworks/Python.framework/Versions/3.14/bin/uv`
- Node: `/opt/homebrew/bin/node` (v25)
- pnpm: `/opt/homebrew/bin/pnpm`
- Docker: required for PostgreSQL + pgvector (`docker compose up -d`)

Always prefix `uv` commands with the full path or add it to PATH:
```
export UV=/Library/Frameworks/Python.framework/Versions/3.14/bin/uv
export PATH="/opt/homebrew/bin:$PATH"
```

## Quick start

```bash
# 1. Start DB
docker compose up -d

# 2. Backend (first run: migrations)
cd apps/api && uv sync && uv run alembic upgrade head
uv run uvicorn pae_api.main:app --reload --port 8000

# 3. MCP Obsidian (register with Claude Code)
claude mcp add mcp-obsidian -- \
  /Library/Frameworks/Python.framework/Versions/3.14/bin/uv \
  run --project packages/mcp-obsidian mcp-obsidian

# 4. Frontend
cd apps/web && pnpm install && pnpm dev
```

## Obsidian vault (Neurona/)

Notes are Markdown files. Obsidian syntax:
- `[[Note Name]]` — wikilinks
- `[[Note Name|alias]]` — aliased wikilinks
- `#tag` — inline tags
- YAML frontmatter (`---`) — note metadata
- `![[Note Name]]` — embeds

Vault folder layout:
- `00-Inbox/` — drafts, incoming
- `10-Catalogo-PQRS/` — PQRS types and categories with `required_fields` frontmatter
- `20-Casos/` — one note per PQRS case (written by the MCP server)
- `30-Conocimiento/` — reglamento, normativa, políticas
- `40-Plantillas/` — response templates
- `90-Sistema/` — runbooks, escalation queue, metrics

**Never write directly to `.obsidian/`.**

## MCP Obsidian

The `packages/mcp-obsidian` server exposes the vault as MCP tools:
`obsidian_read_note`, `obsidian_write_note`, `obsidian_search`, `obsidian_list_by_tag`,
`obsidian_update_frontmatter`, `obsidian_create_case`, `obsidian_link`.

All writes are path-traversal protected; only `ALLOWED_WRITE_DIRS` can be written.

## Agent architecture

LangGraph supervisor (`apps/api/src/pae_api/agents/graph.py`) orchestrates:
- **Intake** — collects required fields via conversation
- **Classifier** — assigns tipo/categoria/area/urgencia
- **Vision** — validates uploaded documents (via OpenRouter vision model)
- **Resolver** — RAG on Obsidian KB, generates cited response
- **Escalator** — routes to human when needed

All LLM calls go through `apps/api/src/pae_api/services/openrouter.py`.

## Environment

Copy `.env.example` → `.env` and fill in:
- `OPENROUTER_API_KEY`
- `DATABASE_URL` (postgres+asyncpg)
- `VAULT_ROOT` (absolute path to `Neurona/`)

## Conventions

- Language of UI, notes, and agent prompts: **Spanish**
- Vault name: Neurona
- Radicado format: `PQRS-YYYYMMDD-XXXXXX` (6-char random hex)
- All monetary amounts in COP
- Dates: ISO 8601 (`YYYY-MM-DD`)
