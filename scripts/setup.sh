#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NeuronaPQRS — Setup inicial (correr una sola vez)
# Uso: bash scripts/setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

UV=/Library/Frameworks/Python.framework/Versions/3.14/bin/uv
export PATH="/opt/homebrew/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}▶${NC} $1"; }

echo ""
echo "  NeuronaPQRS — Setup"
echo "  ─────────────────────────────"

# ── 1. Verificar .env ─────────────────────────────────────────────────────────
step "Verificando variables de entorno"
if [ ! -f ".env" ]; then
  cp .env.example .env
  warn ".env creado desde .env.example — edita OPENROUTER_API_KEY antes de iniciar"
fi

if grep -q "PEGA_TU_API_KEY_AQUI" .env; then
  warn "Recuerda editar OPENROUTER_API_KEY en .env antes de usar el sistema"
else
  ok ".env configurado"
fi

# ── 2. Docker / PostgreSQL ────────────────────────────────────────────────────
step "Levantando PostgreSQL con Docker"
if ! docker info &>/dev/null; then
  err "Docker no está corriendo. Inicia Docker Desktop y vuelve a ejecutar este script."
fi

docker compose up -d
echo "   Esperando que PostgreSQL esté listo..."
until docker compose exec postgres pg_isready -U pae -d pae_pqrs &>/dev/null; do
  sleep 1
done
ok "PostgreSQL listo (puerto 5432)"

# ── 3. Dependencias Python ────────────────────────────────────────────────────
step "Instalando dependencias Python (uv workspace)"
$UV sync
ok "Dependencias Python instaladas"

# ── 4. Migraciones ────────────────────────────────────────────────────────────
step "Aplicando migraciones de base de datos"
cd apps/api
$UV run alembic upgrade head
cd "$REPO_ROOT"
ok "Tablas creadas en PostgreSQL"

# ── 5. Seed del vault Obsidian ────────────────────────────────────────────────
step "Sembrando notas iniciales en Neurona/"
python3 infra/seed_vault.py
ok "Vault de Obsidian inicializado"

# ── 6. Dependencias Node / Next.js ────────────────────────────────────────────
step "Instalando dependencias Node.js (pnpm)"
cd apps/web
pnpm install --frozen-lockfile
cd "$REPO_ROOT"
ok "Dependencias del frontend instaladas"

# ── Resumen ───────────────────────────────────────────────────────────────────
echo ""
echo "  ─────────────────────────────"
echo "  Setup completado ✓"
echo ""
echo "  Próximos pasos:"
if grep -q "PEGA_TU_API_KEY_AQUI" .env; then
  echo "  1. Edita .env y reemplaza OPENROUTER_API_KEY"
  echo "  2. Ejecuta:  bash scripts/start.sh"
else
  echo "  1. Ejecuta:  bash scripts/start.sh"
fi
echo ""
