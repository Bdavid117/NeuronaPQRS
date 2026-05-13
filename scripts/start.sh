#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NeuronaPQRS — Inicio del sistema completo
# Uso: bash scripts/start.sh
# Abre 3 pestañas: Docker, API, Frontend
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

UV=/Library/Frameworks/Python.framework/Versions/3.14/bin/uv
export PATH="/opt/homebrew/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}▶${NC} $1"; }

echo ""
echo "  NeuronaPQRS — Inicio"
echo "  ─────────────────────────────"

# ── Validar API key ───────────────────────────────────────────────────────────
if [ -f ".env" ] && grep -q "PEGA_TU_API_KEY_AQUI" .env; then
  err "Debes configurar OPENROUTER_API_KEY en .env antes de iniciar."
fi

# ── Docker ────────────────────────────────────────────────────────────────────
step "Verificando PostgreSQL"
if ! docker info &>/dev/null; then
  err "Docker no está corriendo. Inicia Docker Desktop primero."
fi

if ! docker compose ps | grep -q "running\|Up"; then
  docker compose up -d
  echo "   Esperando PostgreSQL..."
  until docker compose exec postgres pg_isready -U pae -d pae_pqrs &>/dev/null; do sleep 1; done
fi
ok "PostgreSQL listo"

# ── Detectar terminal disponible ─────────────────────────────────────────────
API_CMD="cd '$REPO_ROOT/apps/api' && $UV run uvicorn pae_api.main:app --reload --port 8000"
WEB_CMD="export PATH='/opt/homebrew/bin:\$PATH' && cd '$REPO_ROOT/apps/web' && pnpm dev"

step "Iniciando servicios"

# macOS: usar osascript para abrir terminales nuevas
if [[ "$OSTYPE" == "darwin"* ]]; then
  osascript <<EOF
tell application "Terminal"
  activate
  do script "$API_CMD"
  do script "$WEB_CMD"
end tell
EOF
  ok "Terminales abiertas (API + Frontend)"
else
  # Linux: intentar gnome-terminal o xterm
  if command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- bash -c "$API_CMD; exec bash" &
    gnome-terminal -- bash -c "$WEB_CMD; exec bash" &
  else
    warn "No se pudo abrir terminales automáticamente."
    echo "   Ejecuta en una terminal:"
    echo "   $API_CMD"
    echo ""
    echo "   Y en otra terminal:"
    echo "   $WEB_CMD"
  fi
fi

# ── URLs ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ─────────────────────────────"
echo "  Sistema iniciando…"
echo ""
echo "  🌐  Frontend:  http://localhost:3000"
echo "  ⚙️   API:       http://localhost:8000"
echo "  📖  API docs:  http://localhost:8000/docs"
echo ""
echo "  Espera ~5 segundos a que los servicios arranquen."
echo ""
