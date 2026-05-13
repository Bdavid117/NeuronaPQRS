UV = /Library/Frameworks/Python.framework/Versions/3.14/bin/uv
export PATH := /opt/homebrew/bin:$(PATH)
REPO_ROOT := $(shell pwd)

.PHONY: help setup start stop api web test test-mcp test-api db migrate seed

help: ## Mostrar esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────────────────────────────
setup: ## Instalar todo y crear las tablas (primera vez)
	@bash scripts/setup.sh

# ── Base de datos ──────────────────────────────────────────────────────────────
db: ## Levantar PostgreSQL (Docker)
	docker compose up -d
	@echo "Esperando PostgreSQL..."
	@until docker compose exec postgres pg_isready -U pae -d pae_pqrs; do sleep 1; done
	@echo "PostgreSQL listo ✓"

migrate: ## Aplicar migraciones Alembic
	cd apps/api && $(UV) run alembic upgrade head

seed: ## Sembrar notas iniciales en Neurona/
	python3 infra/seed_vault.py

# ── Desarrollo ─────────────────────────────────────────────────────────────────
api: ## Iniciar backend FastAPI (con reload)
	cd apps/api && $(UV) run uvicorn pae_api.main:app --reload --port 8000

web: ## Iniciar frontend Next.js
	cd apps/web && pnpm dev

start: ## Abrir API y frontend en terminales nuevas (macOS)
	@bash scripts/start.sh

stop: ## Detener PostgreSQL
	docker compose down

# ── Tests ──────────────────────────────────────────────────────────────────────
test: test-mcp test-api ## Correr todos los tests

test-mcp: ## Tests del servidor MCP Obsidian
	cd packages/mcp-obsidian && $(UV) run pytest tests/ -v

test-api: ## Tests del backend FastAPI
	cd apps/api && $(UV) run pytest tests/ -v

# ── Utilidades ─────────────────────────────────────────────────────────────────
typecheck: ## Verificar tipos TypeScript en el frontend
	cd apps/web && pnpm tsc --noEmit

lint-py: ## Lint Python (ruff)
	$(UV) run ruff check apps/api/src packages/mcp-obsidian/src

fmt-py: ## Formatear Python (ruff)
	$(UV) run ruff format apps/api/src packages/mcp-obsidian/src
