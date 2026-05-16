# NeuronaPQRS — Fase 2: Bug Fixes, Admin DB y Dashboard Analytics

**Fecha:** 2026-05-15
**Alcance:** Plan integrado en 3 fases secuenciales.

---

## Fase 1 — Bug Fixes Críticos + Migración is_admin

### Bugs a corregir

**B1 — `vault_note_path` no se persiste en DB**
- Archivo: `apps/api/src/pae_api/routers/chat.py` → `_persist_state`
- Fix: agregar `if state.get("vault_note_path"): case.vault_note_path = state["vault_note_path"]`
- Impacto: todos los `pqrs_case` tienen `vault_note_path = NULL` actualmente

**B2 — `pqrs_tipo` guardado en mayúsculas en DB**
- Archivo: `apps/api/src/pae_api/routers/chat.py` → `_persist_state`
- Fix: `case.tipo = state["pqrs_tipo"].lower()` y lo mismo para `urgencia`, `estado`
- Impacto: filtros del admin panel no coinciden con los valores del enum

**B3 — Mensajes no se guardan en tabla `message`**
- Archivo: `apps/api/src/pae_api/routers/chat.py` → `_persist_state`
- Fix: al final de cada turno, iterar `final_state["messages"]` y hacer INSERT de los mensajes nuevos (human + AI) vinculados a `case_id`
- Impacto: tabla `message` siempre vacía — historial de conversación perdido

**B4 — `agent_run` nunca se persiste**
- Archivo: `apps/api/src/pae_api/routers/chat.py` → `_persist_state`
- Fix: iterar `state.get("agent_runs", [])` y hacer bulk INSERT en `agent_run` al finalizar el turno
- Impacto: tabla `agent_run` vacía — sin telemetría real ni datos de costo LLM

**B5 — Archivos `.bak` en vault**
- Causa: `obsidian_create_case` crea backup al detectar conflicto de radicado duplicado
- Fix: en `finish_node` de `graph.py`, verificar si la nota ya existe antes de llamar a `obsidian_create_case`; usar `update_frontmatter` si ya existe
- Impacto: archivos basura en `Neurona/20-Casos/`

**B6 — Migración `is_admin` a `pae_user`**
- Nueva migración: `apps/api/alembic/versions/006_add_is_admin.py`
- Agrega columna `is_admin boolean NOT NULL DEFAULT false` a tabla `pae_user`
- Actualizar modelo `User` en `apps/api/src/pae_api/models/user.py`

---

## Fase 2 — Admin User en DB + Sync DB↔Vault

### Admin user en base de datos

**Modelo User actualizado:**
```python
class User(SQLModel, table=True):
    ...
    is_admin: bool = Field(default=False)
```

**Script CLI de creación:**
- Archivo: `apps/api/scripts/create_admin.py`
- Uso: `uv run python scripts/create_admin.py --email admin@agora.edu --name "Administrador"`
- Hashea contraseña (misma función PBKDF2 de `auth.py`), crea usuario con `is_admin=True`

**Router admin actualizado:**
- `routers/admin.py`: reemplazar `_verify_admin()` (que verifica contra config secrets) por verificación JWT + flag `is_admin` en DB
- El login de admin usa el endpoint existente `POST /auth/login`
- Middleware de verificación: decodifica JWT → busca `user_id` en DB → verifica `is_admin=True`
- El frontend `apps/web/src/app/api/admin/login/route.ts` ajusta su llamada al endpoint correcto

### Flujo de sync DB↔Vault (estado objetivo)

```
Chat turn → graph → finish_node
                         │
                         ├── Vault: 20-Casos/{radicado}.md       [ya funciona]
                         ├── Vault: 50-Usuarios/{nombre-id}.md   [ya funciona]
                         ├── DB: pqrs_case.vault_note_path       [fix B1]
                         ├── DB: message (cada turno)            [fix B3]
                         └── DB: agent_run                       [fix B4]
```

---

## Fase 3 — Dashboard Analytics

### Endpoint de estadísticas

`GET /admin/stats` (requiere auth admin)

Devuelve en una sola respuesta:
```json
{
  "total_casos": 43,
  "delta_semana": +5,
  "por_tipo": {"peticion": 10, "queja": 8, "reclamo": 20, "sugerencia": 5},
  "por_urgencia": {"alta": 3, "media": 15, "baja": 25},
  "por_area": [{"area": "Registro Académico", "count": 18}, ...],
  "sla_status": {"vencidos": 2, "en_riesgo": 5, "a_tiempo": 36},
  "pendientes_revision_humana": 4,
  "costo_llm_semana_usd": 0.83,
  "casos_por_dia": [{"date": "2026-05-09", "count": 3}, ...]
}
```

Las queries usan `sqlalchemy` directamente sobre `pqrs_case` y `agent_run`.

### Componente frontend

- Archivo nuevo: `apps/web/src/app/admin/(panel)/stats/page.tsx`
- Componente: `apps/web/src/components/admin/AdminDashboard.tsx`
- Dependencia: `recharts` (instalar vía pnpm)
- Layout: grid 2 columnas, cards numéricas arriba, charts abajo
- Charts:
  - Pie chart: distribución por tipo
  - Bar chart horizontal: top áreas
  - Line chart: casos por día (últimos 30 días)
  - Traffic-light: SLA status

### Enlace en nav admin

Agregar link "📊 Dashboard" en `apps/web/src/app/admin/(panel)/layout.tsx`.

---

## Arquitectura de datos (post-fases)

```
pqrs_case ──────── vault_note_path → Neurona/20-Casos/{radicado}.md
    │
    ├── message (N) ─── historial conversación
    ├── agent_run (N) ── telemetría LLM
    ├── attachment (N) ─ documentos subidos
    └── event (N) ───── auditoría

pae_user ────────── is_admin → acceso panel admin
```

---

## Consideraciones

- Todos los bugs son en `routers/chat.py` — el riesgo de regresión es localizado
- Las migraciones son aditivas (solo agrega columnas) — sin riesgo de pérdida de datos
- `recharts` es ~60KB gzipped — impacto mínimo en bundle
- El script `create_admin.py` debe ejecutarse una sola vez en cada entorno (dev y prod)
- Los `.bak` existentes en vault deben limpiarse manualmente antes de correr las correcciones
