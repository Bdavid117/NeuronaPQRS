Inicia el entorno de desarrollo completo de NeuronaPQRS y verifica que todo esté corriendo.

Ejecuta los siguientes pasos en orden:

1. **Docker / Base de datos**
   ```bash
   docker compose up -d
   docker compose ps
   ```
   Verifica que el contenedor `pae_postgres` esté `healthy`.

2. **Backend FastAPI**
   Verifica si ya está corriendo:
   ```bash
   curl -s http://localhost:8000/healthz 2>/dev/null | python3 -m json.tool && echo "API YA CORRIENDO" || echo "API DETENIDA"
   ```
   Si no está corriendo, muéstrale al usuario:
   > Abre una terminal nueva y ejecuta:
   > ```bash
   > PYTHONPATH=/Users/whoamy/Documents/PAE-Agente/apps/api/src \
   >   /Users/whoamy/Documents/PAE-Agente/.venv/bin/uvicorn pae_api.main:app \
   >   --reload \
   >   --reload-dir /Users/whoamy/Documents/PAE-Agente/apps/api/src \
   >   --port 8000 --log-level debug
   > ```
   > Los logs aparecen con colores: 🤖 = nodo del grafo ejecutado, 💬 = mensaje del agente, 📋 = radicado generado, ❌ = error.

3. **Frontend Next.js**
   Verifica si ya está corriendo:
   ```bash
   curl -s http://localhost:3000 -o /dev/null -w "%{http_code}" 2>/dev/null || echo "FRONTEND DETENIDO"
   ```
   Si no está corriendo, muéstrale:
   > Abre otra terminal y ejecuta:
   > ```bash
   > cd apps/web && pnpm dev
   > ```

4. **Resumen**
   Muestra el estado de cada servicio y las URLs de acceso:
   - API: http://localhost:8000/docs (Swagger UI)
   - Frontend: http://localhost:3000
   - DB: `localhost:5432` (pae_pqrs)

   **Leyenda de logs del backend:**
   - `▶ session=...` — nueva petición al chat
   - `🤖 node=classifier` — clasificador ejecutándose
   - `🤖 node=intake` — agente de recolección ejecutándose
   - `🤖 node=resolver` — agente resolutor ejecutándose
   - `📋 radicado=PQRS-...` — caso radicado exitosamente
   - `✅ parsed OK` — respuesta JSON correctamente parseada
   - `⚠ garbled output` — respuesta garbled detectada y descartada
   - `❌ graph error` — error en el grafo LangGraph
