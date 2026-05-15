# Spec: Mejora del flujo de recolección de datos (Intake)

**Fecha:** 2026-05-15  
**Estado:** Aprobado  
**Alcance:** Backend — agentes LangGraph + modelo de datos

---

## Problema

El flujo de intake actual produce entre 10 y 12 turnos para radicar un caso porque:

1. **Confirmación por campo** — el agente pregunta "¿Es correcto?" después de cada dato, duplicando los turnos.
2. **Routing no determinista** — `_supervisor_route` usa `pending_fields` reportado por el LLM para decidir si llama a intake de nuevo. Si el LLM se equivoca (campo ya recolectado pero aún en `remaining_fields`), el sistema entra en loop.
3. **Extracción de un campo por turno** — cuando el usuario provee nombre + código + correo en un solo mensaje, el LLM solo extrae uno y pide los demás de nuevo.
4. **Sin tolerancia a voz** — números dictados como palabras ("cero uno dos") o correos verbalizados ("carlos arroba uni punto edu") no se normalizan.

---

## Diseño

### 1. Routing determinista

Se elimina la dependencia de `pending_fields` del LLM en el router. En su lugar, una función pura calcula los campos faltantes desde `collected_fields`:

```python
REQUIRED_FIELDS: dict[str, list[str]] = {
    "peticion":   ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_peticion"],
    "queja":      ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_situacion"],
    "reclamo":    ["nombre_solicitante", "numero_identificacion", "correo_contacto",
                   "programa_academico", "codigo_estudiante", "descripcion_reclamo"],
    "sugerencia": ["descripcion_sugerencia"],
}

def _missing_fields(state: PQRSState) -> list[str]:
    tipo = str(state.get("pqrs_tipo") or "")
    required = REQUIRED_FIELDS.get(tipo, ["nombre_solicitante", "numero_identificacion", "correo_contacto"])
    collected = state.get("collected_fields", {})
    return [f for f in required if not collected.get(f)]
```

El agente intake sigue reportando `remaining_fields` en su JSON (para saber qué preguntar), pero ese valor **no afecta el routing**.

**Lógica de routing actualizada:**

```
_missing_fields(state) → [] y tipo != "sugerencia" y confirmed=False  →  "confirm"
_missing_fields(state) → [] y tipo == "sugerencia"                    →  "resolver" / "finish"
_missing_fields(state) → [] y confirmed=True                          →  "resolver" / "finish"
_missing_fields(state) → [...]                                        →  "intake" (o "wait" si ya corrió este turno)
```

Las sugerencias son anónimas por diseño y no necesitan resumen de confirmación — van directo al resolver cuando tienen descripción.

### 2. Nodo `confirm`

Nuevo nodo LangGraph en `agents/confirm.py`. Usa el mismo modelo que intake (llamada LLM ligera).

**Primer llamado** (todos los campos listos, `awaiting_confirmation=False`):
- Genera un resumen formateado en markdown con todos los datos recolectados.
- Retorna `awaiting_confirmation=True` + el mensaje de resumen.
- El supervisor hace "wait" (intake ya corrió este turno equivalente).

**Segundo llamado** (usuario respondió, `awaiting_confirmation=True`):
- Lee el último mensaje del usuario.
- Si positivo ("sí", "confirmar", "correcto", "ok"): retorna `confirmed=True`, `awaiting_confirmation=False`.
- Si corrección ("no, mi correo es...", "corrijo el código"): extrae el dato corregido, actualiza `collected_fields`, retorna `confirmed=False`, `awaiting_confirmation=False` → el supervisor enviará a intake para el campo que falte.

**Formato del resumen:**

```
📋 Antes de radicar tu caso, verifica que los datos sean correctos:

• **Nombre:** Carlos Andrés Pérez Gómez
• **Cédula:** 1.023.456.789
• **Código estudiantil:** 20231045
• **Correo:** carlos.perez@universidad.edu.co
• **Programa:** Ingeniería de Sistemas
• **Tipo:** Reclamo — Nota de parcial de Cálculo Diferencial

¿Todo está correcto? Escribe **confirmar** o dime qué dato quieres corregir.
```

### 3. Prompt reescrito (`prompts/intake.md`)

Tres cambios respecto al prompt actual:

**Eliminado:**
- Instrucción de confirmar cada campo individualmente.
- "Confirma todos los datos antes de cerrar" (eso lo hace el nodo `confirm`).

**Agregado:**
- Instrucción explícita de extraer **todos** los campos mencionados en un mensaje, aunque sean varios.
- Agrupación de preguntas: cuando faltan datos de identidad, pedir nombre + cédula + correo juntos en un solo mensaje al usuario.
- Tolerancia a voz: si detecta patrones de número dictado o correo verbalizado, normalizarlos antes de colocarlos en `extracted_fields`.

**Flujo sugerido en el prompt:**
1. Saluda y confirma el tipo de PQRS.
2. Pide en un solo mensaje: nombre completo, número de identificación y correo.
3. Pide programa académico y código estudiantil juntos (si aplica al tipo).
4. Pide la descripción detallada.
5. No confirmar campos — el resumen final lo hace el sistema.

### 4. Normalizador de voz (`agents/normalize.py`)

Función pura `normalize_fields(fields: dict[str, str]) -> dict[str, str]` sin dependencias externas (solo `re`).

Se aplica a `extracted_fields` en `intake.py` **antes** de mezclarlos con `collected_fields`.

**Reglas implementadas:**

| Patrón detectado | Transformación |
|---|---|
| Palabras numéricas en nombre de campo numérico | `"cero uno dos"` → `"012"` |
| `"arroba"` en campo de correo | `"@"` |
| `"punto"` en campo de correo | `"."` |
| Guiones o espacios extra en cédula | `"1.023.456.789"` → `"1023456789"` |
| Muletillas al inicio/fin | `"eh mi nombre es Carlos"` → `"Carlos"` |
| Capitalización de nombres | `"carlos andrés"` → `"Carlos Andrés"` |

Campos numéricos reconocidos: `numero_identificacion`, `codigo_estudiante`, `telefono_contacto`.  
Campos de correo: `correo_contacto`, `correo_electronico`.  
Campos de nombre: `nombre_solicitante`.

### 5. Cambios de modelo y persistencia

**`models/pqrs.py`** — dos columnas nuevas con default `False`:

```python
confirmed: bool = Field(default=False)
awaiting_confirmation: bool = Field(default=False)
```

**`routers/chat.py` — `init_state`:**

```python
"confirmed": existing_case.confirmed if existing_case else False,
"awaiting_confirmation": existing_case.awaiting_confirmation if existing_case else False,
```

**`routers/chat.py` — `_persist_state`:**

```python
case.confirmed = state.get("confirmed", False)
case.awaiting_confirmation = state.get("awaiting_confirmation", False)
```

**Migración Alembic:** `ALTER TABLE pqrs_case ADD COLUMN confirmed BOOLEAN DEFAULT FALSE NOT NULL; ADD COLUMN awaiting_confirmation BOOLEAN DEFAULT FALSE NOT NULL;`

---

## Archivos afectados

| Archivo | Tipo de cambio |
|---|---|
| `agents/state.py` | +2 campos: `confirmed`, `awaiting_confirmation` |
| `agents/graph.py` | `REQUIRED_FIELDS`, `_missing_fields()`, routing actualizado, nodo `confirm` registrado |
| `agents/intake.py` | Llamar `normalize_fields()` antes de mezclar campos; eliminar lógica de confirmación |
| `agents/prompts/intake.md` | Reescritura completa |
| `agents/normalize.py` | **Archivo nuevo** — función pura sin LLM |
| `agents/confirm.py` | **Archivo nuevo** — nodo LLM de resumen + procesamiento de respuesta |
| `models/pqrs.py` | +2 columnas con default False |
| `routers/chat.py` | `init_state` y `_persist_state` actualizados |
| `alembic/versions/` | Migración nueva |

---

## Flujo de turnos esperado

| Turno | Usuario | Sistema |
|---|---|---|
| 1 | "Quiero un reclamo sobre mi nota de Cálculo" | classifier + intake: saluda, pide nombre + cédula + correo |
| 2 | "Carlos Pérez, CC 1023456789, carlos@uni.edu.co" | intake: extrae 3 campos, pide código + programa |
| 3 | "Código 20231045, Ingeniería de Sistemas" | intake: extrae 2 campos, pide descripción |
| 4 | descripción detallada | intake: extrae descripción → todos los campos listos |
| 5 | ← resumen para confirmar | confirm: muestra resumen |
| 6 | "Confirmar" | confirm: `confirmed=True` |
| 7 | ← radicado + respuesta | resolver + finish |

**Total: 6-7 turnos** (vs 10-12 actuales). Con datos dados en bloque puede reducirse a 4-5.

---

## Consideraciones

- `pending_fields` en el estado se mantiene como campo informativo para el agente intake (sabe qué preguntar), pero **nunca** se usa en el routing.
- Los casos existentes en DB con `confirmed=NULL` funcionan igual que `confirmed=False` por el default.
- El nodo `confirm` no se activa para `sugerencias` — son anónimas y van directo al resolver cuando tienen descripción. El routing lo maneja explícitamente con `tipo == "sugerencia"`.
- Si el usuario corrige un dato en el resumen, el nodo `confirm` extrae la corrección y resetea `awaiting_confirmation=False` para que el supervisor envíe a intake a recolectar solo el campo corregido.
