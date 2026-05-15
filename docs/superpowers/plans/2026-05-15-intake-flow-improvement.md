# Intake Flow Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los bucles de confirmación por campo, hacer el routing determinista y agregar normalización de voz, reduciendo los turnos de 10-12 a 6-7.

**Architecture:** (1) `normalize.py` — función pura que limpia campos extraídos por voz; (2) routing determinista en `graph.py` con `_missing_fields()` que calcula campos faltantes desde `collected_fields`; (3) nodo `confirm.py` que muestra resumen final y procesa la respuesta del usuario; (4) prompt de intake reescrito para extracción en bloque sin confirmaciones por campo.

**Tech Stack:** Python 3.14, LangGraph, SQLModel, Alembic, FastAPI, NVIDIA NIM (llama-4-maverick)

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `apps/api/src/pae_api/agents/normalize.py` | **Crear** | Normalización de campos de voz (función pura) |
| `apps/api/src/pae_api/agents/confirm.py` | **Crear** | Nodo LLM: muestra resumen y procesa confirmación |
| `apps/api/src/pae_api/agents/state.py` | Modificar | +2 campos: `confirmed`, `awaiting_confirmation` |
| `apps/api/src/pae_api/agents/graph.py` | Modificar | Routing determinista + registrar nodo `confirm` |
| `apps/api/src/pae_api/agents/intake.py` | Modificar | Aplicar `normalize_fields` antes de mezclar campos |
| `apps/api/src/pae_api/agents/prompts/intake.md` | Modificar | Reescritura: extracción en bloque, sin confirmaciones |
| `apps/api/src/pae_api/models/pqrs.py` | Modificar | +2 columnas: `confirmed`, `awaiting_confirmation` |
| `apps/api/src/pae_api/routers/chat.py` | Modificar | Persistir y restaurar campos nuevos en `init_state` |
| `apps/api/alembic/versions/005_add_confirmation.py` | **Crear** | Migración Alembic para las 2 columnas nuevas |
| `apps/api/tests/test_normalize.py` | **Crear** | Tests unitarios para `normalize_fields` |
| `apps/api/tests/test_routing.py` | **Crear** | Tests unitarios para `_missing_fields` y routing |

---

### Task 1: Normalizador de voz (`normalize.py`)

**Files:**
- Create: `apps/api/src/pae_api/agents/normalize.py`
- Create: `apps/api/tests/test_normalize.py`

- [ ] **Step 1: Escribir los tests**

```python
# apps/api/tests/test_normalize.py
from __future__ import annotations
from pae_api.agents.normalize import normalize_fields


def test_spoken_digits_in_cedula():
    result = normalize_fields({"numero_identificacion": "uno cero dos tres cuatro"})
    assert result["numero_identificacion"] == "10234"


def test_digits_with_dots_stripped():
    result = normalize_fields({"numero_identificacion": "1.023.456.789"})
    assert result["numero_identificacion"] == "1023456789"


def test_spoken_digits_in_codigo():
    result = normalize_fields({"codigo_estudiante": "dos cero dos tres cero ocho"})
    assert result["codigo_estudiante"] == "202308"


def test_email_arroba():
    result = normalize_fields({"correo_contacto": "carlos arroba universidad punto edu punto co"})
    assert result["correo_contacto"] == "carlos@universidad.edu.co"


def test_email_already_correct():
    result = normalize_fields({"correo_contacto": "carlos@uni.edu.co"})
    assert result["correo_contacto"] == "carlos@uni.edu.co"


def test_name_capitalized():
    result = normalize_fields({"nombre_solicitante": "carlos andrés pérez gómez"})
    assert result["nombre_solicitante"] == "Carlos Andrés Pérez Gómez"


def test_name_removes_filler():
    result = normalize_fields({"nombre_solicitante": "eh mi nombre es Laura"})
    assert result["nombre_solicitante"] == "Laura"


def test_non_string_value_passthrough():
    result = normalize_fields({"nombre_solicitante": None})
    assert result["nombre_solicitante"] is None


def test_unknown_field_unchanged():
    result = normalize_fields({"programa_academico": "Ingeniería de Sistemas"})
    assert result["programa_academico"] == "Ingeniería de Sistemas"


def test_telefono_spoken_digits():
    result = normalize_fields({"telefono_contacto": "tres uno cinco cero uno dos"})
    assert result["telefono_contacto"] == "315012"
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:$PATH"
uv run pytest tests/test_normalize.py -v
```

Esperado: `ERROR` — `ModuleNotFoundError: No module named 'pae_api.agents.normalize'`

- [ ] **Step 3: Crear `normalize.py`**

```python
# apps/api/src/pae_api/agents/normalize.py
from __future__ import annotations

import re

_DIGIT_WORDS: dict[str, str] = {
    "cero": "0", "uno": "1", "un": "1", "una": "1",
    "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5",
    "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
}

_NUMERIC_FIELDS = frozenset({"numero_identificacion", "codigo_estudiante", "telefono_contacto"})
_EMAIL_FIELDS = frozenset({"correo_contacto", "correo_electronico"})
_NAME_FIELDS = frozenset({"nombre_solicitante"})

_FILLER_RE = re.compile(
    r"^\s*(?:eh+|mm+|o sea|pues|bueno|este|a ver|oiga|mire|mi nombre es|me llamo)\s+",
    re.IGNORECASE,
)


def _remove_fillers(s: str) -> str:
    return _FILLER_RE.sub("", s).strip()


def _normalize_numeric(s: str) -> str:
    words = s.lower().split()
    if any(w in _DIGIT_WORDS for w in words):
        return "".join(_DIGIT_WORDS.get(w, w) for w in words if w in _DIGIT_WORDS or w.isdigit())
    return re.sub(r"[\s.\-]", "", s)


def _normalize_email(s: str) -> str:
    s = s.lower()
    s = re.sub(r"\s*arroba\s*", "@", s)
    s = re.sub(r"\s*punto\s*", ".", s)
    return re.sub(r"\s+", "", s)


def _capitalize_name(s: str) -> str:
    return " ".join(w.capitalize() for w in s.strip().split())


def normalize_fields(fields: dict[str, object]) -> dict[str, object]:
    """Normalize voice-transcribed field values before storing in collected_fields."""
    result: dict[str, object] = {}
    for key, value in fields.items():
        if not isinstance(value, str):
            result[key] = value
            continue
        v = _remove_fillers(value)
        if key in _NUMERIC_FIELDS:
            v = _normalize_numeric(v)
        elif key in _EMAIL_FIELDS:
            v = _normalize_email(v)
        elif key in _NAME_FIELDS:
            v = _capitalize_name(v)
        result[key] = v
    return result
```

- [ ] **Step 4: Ejecutar tests y verificar que pasan**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
uv run pytest tests/test_normalize.py -v
```

Esperado: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pae_api/agents/normalize.py apps/api/tests/test_normalize.py
git commit -m "feat: add voice normalization utility for intake fields"
```

---

### Task 2: Campos de estado y modelo de datos

**Files:**
- Modify: `apps/api/src/pae_api/agents/state.py`
- Modify: `apps/api/src/pae_api/models/pqrs.py`
- Create: `apps/api/alembic/versions/005_add_confirmation.py`

- [ ] **Step 1: Agregar campos a `state.py`**

Abrir `apps/api/src/pae_api/agents/state.py`. Al final de `PQRSState`, después de `case_url`, agregar:

```python
    # Confirmation flow
    confirmed: bool          # True when user approved the final summary
    awaiting_confirmation: bool  # True after summary shown, waiting for user reply
```

El archivo completo de `PQRSState` debe quedar con estos dos campos al final (antes del cierre de la clase).

- [ ] **Step 2: Agregar columnas a `models/pqrs.py`**

Abrir `apps/api/src/pae_api/models/pqrs.py`. Localizar la clase `PQRSCase` y agregar al final (antes del cierre de la clase), después del campo `turn_count`:

```python
    confirmed: bool = Field(default=False)
    awaiting_confirmation: bool = Field(default=False)
```

- [ ] **Step 3: Crear migración Alembic**

Crear `apps/api/alembic/versions/005_add_confirmation.py`:

```python
"""Add confirmed and awaiting_confirmation to pqrs_case

Revision ID: 005
Revises: 004
Create Date: 2026-05-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pqrs_case",
        sa.Column("confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "pqrs_case",
        sa.Column("awaiting_confirmation", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("pqrs_case", "awaiting_confirmation")
    op.drop_column("pqrs_case", "confirmed")
```

- [ ] **Step 4: Aplicar migración**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:$PATH"
uv run alembic upgrade head
```

Esperado:
```
INFO  [alembic.runtime.migration] Running upgrade 004 -> 005, Add confirmed...
```

- [ ] **Step 5: Verificar columnas en DB**

```bash
docker exec pae-agente-postgres-1 psql -U pae -d pae_pqrs \
  -c "\d pqrs_case" | grep -E "confirmed|awaiting"
```

Esperado: dos líneas con `confirmed` y `awaiting_confirmation`, tipo `boolean`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/pae_api/agents/state.py \
        apps/api/src/pae_api/models/pqrs.py \
        apps/api/alembic/versions/005_add_confirmation.py
git commit -m "feat: add confirmed/awaiting_confirmation fields to state and DB"
```

---

### Task 3: Routing determinista en `graph.py`

**Files:**
- Modify: `apps/api/src/pae_api/agents/graph.py`
- Create: `apps/api/tests/test_routing.py`

- [ ] **Step 1: Escribir tests para `_missing_fields`**

```python
# apps/api/tests/test_routing.py
from __future__ import annotations
from pae_api.agents.graph import _missing_fields, REQUIRED_FIELDS


def _state(**kwargs):
    base = {
        "pqrs_tipo": None, "categoria": None, "area": None, "urgencia": "baja",
        "collected_fields": {}, "pending_fields": [], "validation_errors": [],
        "messages": [], "session_id": "test", "attachment_ids": [], "vision_results": [],
        "kb_citations": [], "draft_response": None, "confidence": 0.0,
        "next_agent": None, "radicado": None, "plazo_label": None, "plazo_respuesta": None,
        "requires_human": False, "agent_runs": [], "qr_code_b64": None, "case_url": None,
        "confirmed": False, "awaiting_confirmation": False,
    }
    base.update(kwargs)
    return base


def test_missing_fields_reclamo_empty():
    state = _state(pqrs_tipo="reclamo")
    missing = _missing_fields(state)
    assert "nombre_solicitante" in missing
    assert "descripcion_reclamo" in missing
    assert len(missing) == len(REQUIRED_FIELDS["reclamo"])


def test_missing_fields_reclamo_partial():
    state = _state(
        pqrs_tipo="reclamo",
        collected_fields={
            "nombre_solicitante": "Carlos",
            "numero_identificacion": "123",
            "correo_contacto": "c@uni.edu.co",
        },
    )
    missing = _missing_fields(state)
    assert "nombre_solicitante" not in missing
    assert "descripcion_reclamo" in missing
    assert "programa_academico" in missing


def test_missing_fields_reclamo_complete():
    state = _state(
        pqrs_tipo="reclamo",
        collected_fields={
            "nombre_solicitante": "Carlos",
            "numero_identificacion": "123",
            "correo_contacto": "c@uni.edu.co",
            "programa_academico": "Sistemas",
            "codigo_estudiante": "20231045",
            "descripcion_reclamo": "Nota incorrecta",
        },
    )
    assert _missing_fields(state) == []


def test_missing_fields_sugerencia():
    state = _state(
        pqrs_tipo="sugerencia",
        collected_fields={"descripcion_sugerencia": "Mejorar el campus"},
    )
    assert _missing_fields(state) == []


def test_missing_fields_unknown_tipo():
    state = _state(pqrs_tipo="desconocido")
    missing = _missing_fields(state)
    # Falls back to default required fields
    assert "nombre_solicitante" in missing


def test_pending_fields_not_used_in_routing():
    """pending_fields LLM value must NOT affect _missing_fields result."""
    state = _state(
        pqrs_tipo="reclamo",
        collected_fields={
            "nombre_solicitante": "Carlos",
            "numero_identificacion": "123",
            "correo_contacto": "c@uni.edu.co",
            "programa_academico": "Sistemas",
            "codigo_estudiante": "20231045",
            "descripcion_reclamo": "Nota incorrecta",
        },
        pending_fields=["nombre_solicitante"],  # LLM wrongly says this is pending
    )
    # _missing_fields must ignore pending_fields
    assert _missing_fields(state) == []
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
uv run pytest tests/test_routing.py -v
```

Esperado: `ImportError` — `cannot import name '_missing_fields'` (aún no existe)

- [ ] **Step 3: Agregar `REQUIRED_FIELDS` y `_missing_fields` a `graph.py`**

Al inicio del archivo `apps/api/src/pae_api/agents/graph.py`, después de los imports existentes y antes de `_CONTACT_FIELDS`, agregar:

```python
REQUIRED_FIELDS: dict[str, list[str]] = {
    "peticion":   ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_peticion"],
    "queja":      ["nombre_solicitante", "numero_identificacion", "correo_contacto", "descripcion_situacion"],
    "reclamo":    ["nombre_solicitante", "numero_identificacion", "correo_contacto",
                   "programa_academico", "codigo_estudiante", "descripcion_reclamo"],
    "sugerencia": ["descripcion_sugerencia"],
}


def _missing_fields(state: PQRSState) -> list[str]:
    """Compute missing required fields deterministically from collected_fields."""
    tipo = str(state.get("pqrs_tipo") or "")
    required = REQUIRED_FIELDS.get(tipo, ["nombre_solicitante", "numero_identificacion", "correo_contacto"])
    collected = state.get("collected_fields", {})
    return [f for f in required if not collected.get(f)]
```

- [ ] **Step 4: Reemplazar `_supervisor_route` completo**

Reemplazar toda la función `_supervisor_route` en `graph.py` con:

```python
def _supervisor_route(
    state: PQRSState,
) -> Literal["intake", "classifier", "vision", "resolver", "resolver_auto", "escalator", "finish", "confirm", "wait"]:
    """Pure routing logic — no LLM call needed."""
    if state.get("requires_human"):
        already_escalated = any(
            r.get("agent_name") == "escalator"
            for r in state.get("agent_runs", [])
        )
        if not already_escalated:
            return "escalator"

    # Unprocessed attachments
    attachment_ids = state.get("attachment_ids", [])
    vision_ids = {r.get("attachment_id") for r in state.get("vision_results", [])}
    if attachment_ids and set(attachment_ids) - vision_ids:
        return "vision"

    # Need classification
    if not state.get("pqrs_tipo") or not state.get("categoria"):
        return "classifier"

    # Deterministic field check — never trusts pending_fields from LLM
    missing = _missing_fields(state)
    tipo = str(state.get("pqrs_tipo") or "")

    if missing:
        intake_ran = any(r.get("agent_name") == "intake" for r in state.get("agent_runs", []))
        if intake_ran:
            return "wait"
        return "intake"

    # All required fields collected
    # Sugerencias are anonymous — skip confirmation, go directly to resolver
    if tipo == "sugerencia":
        if not state.get("draft_response"):
            return "resolver_auto" if state.get("categoria") in AUTO_RESOLVE_CATEGORIES else "resolver"
        return "finish"

    # For all other types: require user confirmation of summary
    if not state.get("confirmed"):
        confirm_ran = any(r.get("agent_name") == "confirm" for r in state.get("agent_runs", []))
        if confirm_ran:
            return "wait"
        return "confirm"

    # User confirmed — generate response
    if not state.get("draft_response"):
        if state.get("categoria") in AUTO_RESOLVE_CATEGORIES:
            return "resolver_auto"
        return "resolver"

    return "finish"
```

- [ ] **Step 5: Ejecutar tests de routing**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
uv run pytest tests/test_routing.py -v
```

Esperado: `6 passed`

- [ ] **Step 6: Commit parcial (sin registrar confirm node aún)**

```bash
git add apps/api/src/pae_api/agents/graph.py apps/api/tests/test_routing.py
git commit -m "feat: deterministic routing with _missing_fields, add confirm route"
```

---

### Task 4: Nodo `confirm`

**Files:**
- Create: `apps/api/src/pae_api/agents/confirm.py`
- Modify: `apps/api/src/pae_api/agents/graph.py` (registrar nodo y rutas)

- [ ] **Step 1: Crear `confirm.py`**

```python
# apps/api/src/pae_api/agents/confirm.py
from __future__ import annotations

import json
import time

from langchain_core.messages import AIMessage

from ..config import get_settings
from ..logging_config import get_logger
from ..services.nvidia_nim import get_nvidia_nim
from .state import PQRSState
from .utils import extract_json

log = get_logger("confirm")

_FIELD_LABELS: dict[str, str] = {
    "nombre_solicitante": "Nombre",
    "numero_identificacion": "Cédula / ID",
    "tipo_identificacion": "Tipo de documento",
    "codigo_estudiante": "Código estudiantil",
    "correo_contacto": "Correo",
    "telefono_contacto": "Teléfono",
    "programa_academico": "Programa",
    "descripcion_reclamo": "Descripción",
    "descripcion_peticion": "Descripción",
    "descripcion_situacion": "Descripción",
    "descripcion_detallada": "Descripción",
}


def _build_summary(collected: dict, tipo: str, categoria: str | None) -> str:
    lines = ["📋 Antes de radicar tu caso, verifica que los datos sean correctos:\n"]
    for key, label in _FIELD_LABELS.items():
        val = collected.get(key)
        if val:
            short_val = str(val)[:200]
            lines.append(f"• **{label}:** {short_val}")
    if tipo:
        tipo_display = tipo.capitalize()
        cat_display = f" — {categoria}" if categoria else ""
        lines.append(f"• **Tipo:** {tipo_display}{cat_display}")
    lines.append("\n¿Todo está correcto? Escribe **confirmar** o dime qué dato quieres corregir.")
    return "\n".join(lines)


async def confirm_agent(state: PQRSState) -> dict:
    collected = state.get("collected_fields", {})
    tipo = str(state.get("pqrs_tipo") or "")
    categoria = state.get("categoria")
    awaiting = state.get("awaiting_confirmation", False)

    # First call: show summary and wait
    if not awaiting:
        summary = _build_summary(collected, tipo, categoria)
        log.info("  confirm: showing summary")
        return {
            "messages": [AIMessage(content=summary, name="confirm")],
            "awaiting_confirmation": True,
        }

    # Second call: user responded — parse their message
    settings = get_settings()
    client = get_nvidia_nim()
    start = time.monotonic()

    messages = state.get("messages", [])
    last_human = next(
        (m.content for m in reversed(messages) if getattr(m, "type", None) == "human"),
        "",
    )

    prompt = (
        f'El usuario respondió al resumen de su caso PQRS: "{last_human}"\n\n'
        "Determina si el usuario CONFIRMA los datos o CORRIGE algún dato.\n\n"
        "- CONFIRMA si dice: sí, confirmo, correcto, ok, todo bien, adelante, así es, perfecto, confirmar.\n"
        "- CORRIGE si menciona un dato incorrecto o diferente.\n\n"
        "Si confirma, responde con:\n"
        '{"action": "confirm", "reply": "Perfecto, procedo a radicar tu caso.", "correction": {}}\n\n'
        "Si corrige, extrae el campo corregido. Los campos válidos son: "
        "nombre_solicitante, numero_identificacion, tipo_identificacion, codigo_estudiante, "
        "correo_contacto, telefono_contacto, programa_academico, descripcion_reclamo, "
        "descripcion_peticion, descripcion_situacion.\n"
        'Responde con: {"action": "correct", "reply": "Entendido, he actualizado el dato. ¿Confirmas el resto?", '
        '"correction": {"nombre_campo": "valor_corregido"}}\n\n'
        "Responde SOLO con JSON válido, sin texto adicional."
    )

    resp = await client.chat(
        model=settings.model_intake,
        messages=[
            {
                "role": "system",
                "content": "Eres un asistente que interpreta respuestas de confirmación de datos PQRS. Responde SOLO con JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    cost = client.estimate_cost(resp)
    usage = resp.get("usage", {})
    raw = resp["choices"][0]["message"]["content"] or ""

    run_record = {
        "agent_name": "confirm",
        "model": settings.model_intake,
        "tokens_in": usage.get("prompt_tokens", 0),
        "tokens_out": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "duration_ms": int((time.monotonic() - start) * 1000),
    }

    try:
        parsed = extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        log.warning(f"  confirm: JSON parse failed, assuming confirmation. raw={raw[:60]!r}")
        parsed = {"action": "confirm", "reply": "Perfecto, procedo a radicar tu caso.", "correction": {}}

    action = parsed.get("action", "confirm")
    reply = parsed.get("reply", "Perfecto.")
    correction: dict = parsed.get("correction") or {}

    log.info(f"  confirm: action={action}  correction_keys={list(correction.keys())}")

    if action == "confirm":
        return {
            "messages": [AIMessage(content=reply, name="confirm")],
            "confirmed": True,
            "awaiting_confirmation": False,
            "agent_runs": state.get("agent_runs", []) + [run_record],
        }

    # Apply correction and return to intake on next turn
    new_collected = {**collected, **correction}
    return {
        "messages": [AIMessage(content=reply, name="confirm")],
        "confirmed": False,
        "awaiting_confirmation": False,
        "collected_fields": new_collected,
        "agent_runs": state.get("agent_runs", []) + [run_record],
    }
```

- [ ] **Step 2: Registrar nodo `confirm` en `graph.py`**

En `graph.py`, agregar el import al inicio del bloque de imports de agentes:

```python
from .confirm import confirm_agent
```

En `build_graph()`, dentro de la sección `# Nodes`, agregar después de `builder.add_node("wait", _wait_node)`:

```python
    builder.add_node("confirm", confirm_agent)
```

En `_all_routes`, agregar la entrada:

```python
        "confirm": "confirm",
```

En el loop de conditional edges (después de `escalator`), agregar `"confirm"` a la lista:

```python
    for node in ("intake", "classifier", "vision", "resolver", "resolver_auto", "escalator", "confirm"):
        builder.add_conditional_edges(node, _supervisor_route, _all_routes)
```

El `Literal` del type hint de `_supervisor_route` ya incluye `"confirm"` del paso anterior (Task 3, Step 4).

- [ ] **Step 3: Verificar que el API arranca sin errores**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:$PATH"
uv run python -c "from pae_api.agents.graph import build_graph; g = build_graph(); print('Graph OK:', list(g.nodes.keys()))"
```

Esperado: `Graph OK: ['__start__', 'intake', 'classifier', 'vision', 'resolver', 'resolver_auto', 'escalator', 'finish', 'wait', 'confirm']`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/pae_api/agents/confirm.py apps/api/src/pae_api/agents/graph.py
git commit -m "feat: add confirm node for end-of-flow data summary"
```

---

### Task 5: Actualizar `intake.py` y prompt

**Files:**
- Modify: `apps/api/src/pae_api/agents/intake.py`
- Modify: `apps/api/src/pae_api/agents/prompts/intake.md`

- [ ] **Step 1: Reescribir `prompts/intake.md`**

Reemplazar el contenido completo del archivo con:

```markdown
Eres el asistente de recepción del sistema PQRS de una institución educativa universitaria.
Tu único propósito es recopilar la información necesaria para radicar una PQRS.
**IDIOMA: Responde siempre en español. Nunca uses inglés bajo ninguna circunstancia.**

## Regla principal — extracción en bloque
Cuando el usuario proporcione varios datos en un mismo mensaje, extráelos TODOS de una vez
en `extracted_fields`. Nunca pidas un campo que ya fue dado en el mismo mensaje.
Ejemplo: "me llamo Juan, mi cédula es 123456 y mi correo es juan@uni.edu.co"
→ extraer nombre_solicitante, numero_identificacion Y correo_contacto en un solo paso.

## Sin confirmaciones por campo
NO preguntes "¿Es correcto?" después de cada dato. El sistema mostrará un resumen
completo al final para que el usuario confirme todo de una vez. Tu labor es solo recolectar.

## Manejo de errores de voz
Si detectas un número dictado como palabras ("cero uno dos tres"), transfórmalo
a dígitos en `extracted_fields` ("0123"). Si ves "arroba" o "punto" en un correo,
sustitúyelos por "@" y "." respectivamente.

## Límites de contexto
Si el usuario hace preguntas ajenas al proceso PQRS, di amablemente que solo
puedes ayudar con ese proceso y reitera el campo pendiente.

## Escalamiento
Si menciona acoso, discriminación, emergencia de salud o riesgo personal:
`"escalate": true, "sentiment": "urgente"`.

## Flujo sugerido (adapta al tipo de PQRS)
1. Saluda y confirma el tipo de PQRS si aún no es claro.
2. Pide en UN solo mensaje los datos de identidad que falten:
   nombre completo + número de cédula/código + correo electrónico.
3. Si aplica (reclamos/quejas): pide programa académico y código estudiantil juntos.
4. Pide la descripción detallada de la situación.
5. No hagas más preguntas — el sistema mostrará el resumen para confirmación.

## Corrección de datos
Si el usuario corrige un dato previamente dado, actualiza solo ese campo en
`extracted_fields` y continúa sin pedir confirmación del mismo.

## Formato de respuesta (JSON estricto — siempre en español)
```json
{
  "reply": "texto que ve el usuario en español",
  "extracted_fields": {"campo": "valor"},
  "remaining_fields": ["campo1", "campo2"],
  "validation_errors": [],
  "escalate": false,
  "sentiment": "neutral | frustrado | urgente"
}
```
```

- [ ] **Step 2: Modificar `intake.py` para aplicar `normalize_fields`**

Agregar el import al inicio de `intake.py`, después de los imports existentes:

```python
from .normalize import normalize_fields
```

En la función `intake_agent`, localizar la línea:

```python
    new_fields = {**collected, **parsed.get("extracted_fields", {})}
```

Reemplazarla con:

```python
    raw_extracted = parsed.get("extracted_fields", {})
    normalized_extracted = normalize_fields(raw_extracted)
    new_fields = {**collected, **normalized_extracted}
```

- [ ] **Step 3: Verificar que el API arranca**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
uv run python -c "from pae_api.agents.intake import intake_agent; print('intake OK')"
```

Esperado: `intake OK`

- [ ] **Step 4: Ejecutar todos los tests**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
uv run pytest tests/ -v
```

Esperado: todos los tests pasan (incluyendo los de normalize y routing).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pae_api/agents/intake.py \
        apps/api/src/pae_api/agents/prompts/intake.md
git commit -m "feat: apply voice normalization in intake, rewrite prompt for batch extraction"
```

---

### Task 6: Persistencia en `chat.py`

**Files:**
- Modify: `apps/api/src/pae_api/routers/chat.py`

- [ ] **Step 1: Actualizar `init_state` para restaurar campos nuevos**

En `chat.py`, dentro de `_sse_stream`, localizar el bloque `init_state: PQRSState = {` y agregar al final del diccionario (antes del cierre `}`), después de `"case_url": None`:

```python
        "confirmed": existing_case.confirmed if existing_case else False,
        "awaiting_confirmation": existing_case.awaiting_confirmation if existing_case else False,
```

- [ ] **Step 2: Actualizar `_persist_state` para guardar campos nuevos**

En `_persist_state`, agregar antes de `case.turn_count = ...`:

```python
    case.confirmed = bool(state.get("confirmed", False))
    case.awaiting_confirmation = bool(state.get("awaiting_confirmation", False))
```

- [ ] **Step 3: Verificar arranque del API**

```bash
cd /Users/whoamy/Documents/PAE-Agente/apps/api
export PATH="/Library/Frameworks/Python.framework/Versions/3.14/bin:/opt/homebrew/bin:$PATH"
uv run python -c "from pae_api.routers.chat import router; print('chat router OK')"
```

Esperado: `chat router OK`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/pae_api/routers/chat.py
git commit -m "feat: persist confirmed/awaiting_confirmation in chat state"
```

---

### Task 7: Test de integración del flujo completo

**Files:**
- API corriendo en `localhost:8000`

- [ ] **Step 1: Reiniciar la API para cargar todos los cambios**

```bash
kill $(lsof -ti :8000) 2>/dev/null
cd /Users/whoamy/Documents/PAE-Agente && \
  PYTHONPATH=apps/api/src \
  /Library/Frameworks/Python.framework/Versions/3.14/bin/uv run \
  --project apps/api \
  uvicorn pae_api.main:app --reload \
  --reload-dir apps/api/src \
  --port 8000 --log-level info \
  >> .dev-logs/api.log 2>&1 &
sleep 5 && curl -s http://localhost:8000/healthz | python3 -m json.tool
```

Esperado: `{"status": "ok", "version": "0.1.0"}`

- [ ] **Step 2: Ejecutar flujo de prueba completo**

```python
# Ejecutar como: python3 /tmp/test_flujo.py
import subprocess, json, time

BASE = "http://localhost:8000"
SESSION = f"test-nuevo-flujo-{int(time.time())}"
print(f"Sesión: {SESSION}\n")

def chat(msg, timeout=90):
    print(f">> {msg[:100]}")
    r = subprocess.run(
        ["curl", "-s", "-N", "-X", "POST", f"{BASE}/chat",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"session_id": SESSION, "message": msg})],
        capture_output=True, text=True, timeout=timeout,
    )
    agents, reply = [], ""
    for line in r.stdout.splitlines():
        if line.startswith("data:"):
            try:
                obj = json.loads(line[5:].strip())
                ev = obj.get("event", "")
                if ev == "agent_switch":
                    agents.append(obj["data"]["agent"])
                elif ev == "delta":
                    reply += obj["data"].get("text", "")
            except Exception:
                pass
    print(f"  [{' → '.join(agents)}]")
    print(f"  {reply[:200]}")
    print()
    return reply

# Turno 1: inicio
chat("Quiero presentar un reclamo sobre mi nota de Cálculo")
time.sleep(1)

# Turno 2: datos de identidad en bloque
chat("Me llamo Ana Torres, cédula 987654321, correo ana.torres@uni.edu.co")
time.sleep(1)

# Turno 3: código y programa juntos
chat("Código 20220134, Ingeniería Industrial")
time.sleep(1)

# Turno 4: descripción
chat("El 3 de mayo presenté el parcial con la profesora García. Respondí todos los puntos correctamente pero me pusieron 2.5. Solicito revisión formal.")
time.sleep(1)

# Turno 5: el sistema muestra resumen (confirmar)
r = chat("confirmar")

# Verificar que el radicado se generó
if "PQRS-" in r or "radicado" in r.lower():
    print("✅ RADICADO GENERADO — flujo completo exitoso")
else:
    print("⚠ Radicado no detectado en respuesta — revisar logs")
```

Guardar como `/tmp/test_flujo.py` y ejecutar:

```bash
python3 /tmp/test_flujo.py
```

Verificaciones esperadas:
- Turno 2: el agente extrae `nombre_solicitante`, `numero_identificacion` Y `correo_contacto` sin pedir confirmación individual
- Turno 4: después de la descripción, el agente muestra el resumen (nodo `confirm`)
- Turno 5: al escribir "confirmar", el sistema radica el caso
- Total de turnos: 5-6 (no 10-12)

- [ ] **Step 3: Verificar caso en Obsidian vault**

```bash
ls -la /Users/whoamy/Documents/PAE-Agente/Neurona/20-Casos/ | grep "$(date +%Y%m%d)"
```

Esperado: aparece un archivo `PQRS-YYYYMMDD-XXXXXX.md` con fecha de hoy.

- [ ] **Step 4: Verificar caso en DB**

```bash
docker exec pae-agente-postgres-1 psql -U pae -d pae_pqrs \
  -c "SELECT radicado, tipo, estado, confirmed, turn_count FROM pqrs_case ORDER BY created_at DESC LIMIT 3;"
```

Esperado: el caso más reciente tiene `confirmed = t` y `turn_count` entre 5 y 7.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "test: full PQRS flow integration — 5-turn intake with confirm node"
```
