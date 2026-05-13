#!/usr/bin/env bash
# dev.sh — Levanta NeuronaPQRS completo con un solo comando
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
UV="/Library/Frameworks/Python.framework/Versions/3.14/bin/uv"
PNPM="/opt/homebrew/bin/pnpm"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
info() { echo -e "${CYAN}→${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*"; }

cleanup() {
  echo ""
  info "Apagando servicios..."
  [ -n "$API_PID" ]      && kill "$API_PID"      2>/dev/null && ok "Backend detenido"
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend detenido"
  docker compose -f "$ROOT/docker-compose.yml" stop 2>/dev/null
  ok "Docker detenido"
  exit 0
}
trap cleanup INT TERM

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   ÁGORA — Entorno de Desarrollo                ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Docker / PostgreSQL ───────────────────────────────────────────────────
info "Iniciando PostgreSQL (Docker)..."
docker compose -f "$ROOT/docker-compose.yml" up -d 2>&1 | grep -E "Start|Running|healthy|error" || true

echo -n "   Esperando que postgres esté healthy"
for i in $(seq 1 30); do
  STATUS=$(docker inspect pae-agente-postgres-1 --format '{{.State.Health.Status}}' 2>/dev/null || echo "waiting")
  if [ "$STATUS" = "healthy" ]; then
    echo ""
    ok "PostgreSQL healthy (puerto 5432)"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo ""
    err "PostgreSQL no respondió en 30 s. Revisa Docker Desktop."
    exit 1
  fi
done

# ── 2. Migraciones (solo si es necesario) ───────────────────────────────────
info "Verificando migraciones Alembic..."
cd "$ROOT/apps/api"
CURRENT=$("$UV" run alembic current 2>/dev/null | grep "head" || echo "")
if [ -z "$CURRENT" ]; then
  info "Aplicando migraciones..."
  "$UV" run alembic upgrade head 2>&1 | tail -5
  ok "Migraciones aplicadas"
else
  ok "Migraciones al día"
fi

# ── 3. Backend FastAPI ───────────────────────────────────────────────────────
info "Iniciando Backend FastAPI (puerto 8000)..."
cd "$ROOT/apps/api"
PYTHONPATH="$ROOT/apps/api/src" \
  "$UV" run uvicorn pae_api.main:app --reload --port 8000 \
  > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!

echo -n "   Esperando que la API responda"
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/healthz > /dev/null 2>&1; then
    echo ""
    ok "Backend listo → http://localhost:8000  (docs: /docs)"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo ""
    err "Backend no respondió. Revisa $LOG_DIR/api.log"
    tail -20 "$LOG_DIR/api.log"
    exit 1
  fi
done

# ── 4. Frontend Next.js ──────────────────────────────────────────────────────
info "Iniciando Frontend Next.js (puerto 3000)..."
cd "$ROOT/apps/web"
"$PNPM" dev > "$LOG_DIR/web.log" 2>&1 &
FRONTEND_PID=$!

echo -n "   Esperando que el frontend responda"
for i in $(seq 1 60); do
  CODE=$(curl -s http://localhost:3000 -o /dev/null -w "%{http_code}" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo ""
    ok "Frontend listo → http://localhost:3000"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo ""
    err "Frontend no respondió. Revisa $LOG_DIR/web.log"
    tail -20 "$LOG_DIR/web.log"
    exit 1
  fi
done

# ── 5. Resumen ───────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}Todo listo.${NC} Plataforma corriendo:"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
echo -e "  ${CYAN}API docs:${NC}  http://localhost:8000/docs"
echo -e "  ${CYAN}Logs:${NC}      $LOG_DIR/"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Presiona Ctrl+C para detener todo."
echo ""

# Abre el navegador
open "http://localhost:3000" 2>/dev/null || true

# ── 6. Mantener vivo y mostrar logs en tiempo real ──────────────────────────
wait
