---
tipo: runbook
tags: [sistema, runbook, operaciones]
---

# Runbook: Reinicio de Agentes

## Síntomas: agentes no responden

1. Verificar que el backend está corriendo:
```bash
curl http://localhost:8000/healthz
```

2. Si el backend no responde, reiniciar:
```bash
cd apps/api && uv run uvicorn pae_api.main:app --reload --port 8000
```

3. Si hay errores de DB, verificar PostgreSQL:
```bash
docker ps | grep postgres
docker compose up -d
```

4. Si el vault no responde, verificar permisos:
```bash
ls -la Neurona/20-Casos/
```
