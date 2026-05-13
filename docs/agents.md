# Pipeline de agentes LangGraph

## Estructura del grafo

El supervisor es un `StateGraph` de LangGraph compilado como singleton (`_graph` global en `graph.py`). La lógica de enrutamiento es una función pura `_supervisor_route()` sin llamadas LLM — el estado del caso determina qué agente ejecutar.

```
__start__
    │
    ▼
_supervisor_route()
    │
    ├──▶ intake         (faltan campos o hay errores de validación)
    ├──▶ classifier     (falta tipo o categoría)
    ├──▶ vision         (hay adjuntos sin procesar)
    ├──▶ resolver_auto  (categoría estándar + confianza ≥ 0.8)
    ├──▶ resolver       (necesita generar respuesta con RAG)
    ├──▶ escalator      (requires_human = True)
    └──▶ finish         (estado completo)
            │
           END
```

Cada agente (excepto `finish`) devuelve al supervisor, que vuelve a evaluar y puede enrutar a otro agente. Se permiten ciclos: `intake → classifier → intake → resolver → finish`.

## Estado compartido — `PQRSState`

TypedDict que fluye entre todos los agentes:

```python
class PQRSState(TypedDict):
    # Conversación
    messages: list[BaseMessage]       # historial LangChain
    session_id: str

    # Clasificación
    pqrs_tipo: str | None             # peticion | queja | reclamo | sugerencia
    categoria: str | None             # Reclamo-Nota, Certificado-Academico, etc.
    area: str | None                  # área responsable de la institución
    urgencia: str                     # alta | media | baja

    # Recolección
    collected_fields: dict            # campos confirmados del usuario
    pending_fields: list[str]         # campos aún por recolectar
    validation_errors: list[str]

    # Documentos
    attachment_ids: list[int]
    vision_results: list[dict]

    # Resolución
    kb_citations: list[dict]          # [{path, excerpt, score}]
    draft_response: str | None
    confidence: float                 # 0.0–1.0

    # Control
    radicado: str | None
    plazo_label: str | None
    requires_human: bool

    # Salida de finish_node
    qr_code_b64: str | None           # PNG del QR en base64
    case_url: str | None              # URL pública del caso

    # Telemetría
    agent_runs: list[dict]            # tokens, costo, duración por agente
```

---

## Agente: intake

**Archivo:** `agents/intake.py`  
**Modelo:** `model_intake` (Claude Sonnet 4.5)  
**Propósito:** Conversar con el usuario para recolectar los campos requeridos del caso.

### Campos requeridos por tipo

| Tipo | Campos |
|---|---|
| peticion | nombre, identificación, correo, descripción |
| queja | nombre, identificación, correo, descripción, persona/dependencia implicada |
| reclamo | nombre, identificación, correo, programa, código estudiante, descripción |
| sugerencia | descripción, área relacionada |

### Comportamiento

1. Calcula `pending = required - collected_fields`
2. Envía al LLM el historial + estado actual como contexto
3. El LLM responde en JSON: `{reply, extracted_fields, remaining_fields, validation_errors, escalate, sentiment}`
4. Actualiza `collected_fields`, `pending_fields`, `validation_errors`
5. Si `escalate=true` o `sentiment="urgente"`, activa `requires_human=True`

---

## Agente: classifier

**Archivo:** `agents/classifier.py`  
**Modelo:** `model_classifier` (Claude Haiku 4.5)  
**Propósito:** Asignar tipo PQRS, categoría, área y nivel de urgencia.

### Salida esperada

```json
{
  "tipo": "reclamo",
  "categoria": "Reclamo-Nota",
  "area": "Registro Académico",
  "urgencia": "media",
  "confidence": 0.92,
  "reasoning": "..."
}
```

### Categorías válidas

`Reclamo-Nota` · `Homologacion` · `Certificado-Academico` · `Cancelacion-Matricula` · `Beca-Apoyo` · `Practica-Profesional` · `Financiero-Cartera` · `Biblioteca` · `Bienestar` · `Infraestructura` · `Servicios-TI` · `Proceso-Disciplinario`

Estas categorías corresponden exactamente a notas existentes en `Neurona/10-Catalogo-PQRS/` para que los wikilinks se resuelvan.

---

## Agente: vision

**Archivo:** `agents/vision.py`  
**Modelo:** `model_vision` (Claude Sonnet 4.5)  
**Propósito:** Analizar adjuntos (imágenes/PDFs) y extraer datos para contrastar con los campos declarados.

### Flujo

1. Para cada `attachment_id` sin procesar, carga el archivo
2. Envía al modelo de visión junto con los `collected_fields` actuales
3. Extrae datos del documento (nombre, código, calificación, etc.)
4. Valida que coincidan con lo declarado en la conversación
5. Añade resultado a `vision_results`

---

## Agente: resolver

**Archivo:** `agents/resolver.py`  
**Modelo:** `model_resolver` (Claude Sonnet 4.5)  
**Propósito:** Generar una respuesta citada usando RAG sobre el vault Obsidian.

### Flujo

1. Construye query de búsqueda desde la descripción del caso
2. Busca en el vault con `obsidian.search(query, top_k=5)`
3. Filtra citas con `score ≥ 0.40`
4. Envía al LLM el contexto del caso + fragmentos del vault
5. LLM genera `{draft, citations, confidence, plazo_aplicable}`
6. Si `confidence < 0.5`, activa `requires_human=True` → escalator

---

## Agente: resolver_auto

**Archivo:** `agents/resolver_auto.py`  
**Modelo:** ninguno (0 tokens LLM)  
**Propósito:** Respuesta instantánea para categorías estándar usando plantillas Obsidian.

### Categorías elegibles

```python
AUTO_RESOLVE_CATEGORIES = {
    "Certificado-Academico",
    "Biblioteca",
    "Servicios-TI",
}
```

### Flujo

1. Lee la plantilla en `Neurona/40-Plantillas/{categoria}.md`
2. Sustituye `{nombre_solicitante}` y `{radicado}` con los valores recolectados
3. Si la nota no existe, usa plantilla hardcodeada de respaldo
4. Devuelve `draft_response` con `confidence=0.85` y `requires_human=False`

**Ahorro:** Elimina la llamada al LLM resolver (~1,500 tokens, ~0.8 s).

---

## Agente: escalator

**Archivo:** `agents/escalator.py`  
**Modelo:** `model_escalator` (Claude Haiku 4.5)  
**Propósito:** Notificar al usuario que su caso requiere atención humana y añadirlo a la cola de escalamiento.

### Flujo

1. Genera mensaje de derivación en español
2. Appende entrada a `Neurona/90-Sistema/cola.md`:
   ```
   - [ ] PQRS-20260507-A3F9C1 | reclamo | alta | automático | 2026-05-07
   ```
3. Devuelve `{messages, requires_human: True}`

---

## Agente: finish_node

**Archivo:** `agents/graph.py` (función `finish_node`)  
**Modelo:** ninguno (0 tokens LLM)  
**Propósito:** Persistir el caso, generar radicado y QR.

### Acciones

1. Genera radicado `PQRS-YYYYMMDD-{6 chars hex}` si no existe
2. Crea nota en `Neurona/20-Casos/{radicado}.md` con:
   - Campos recolectados separados de la descripción
   - Borrador de respuesta
   - Wikilinks a fuentes consultadas (`[[30-Conocimiento/...]]`)
3. Appende sección `## Resolución automática` a la nota
4. Actualiza frontmatter: `estado: resuelto_automaticamente`
5. Genera QR PNG (base64) con URL `{APP_URL}/r/{radicado}`
6. Calcula plazo usando `tracking.calcular_plazo(tipo, categoria)`

---

## Telemetría por agente

Cada agente registra en `agent_runs`:

```python
{
    "agent_name": "resolver",
    "model": "anthropic/claude-sonnet-4-5",
    "tokens_in": 1842,
    "tokens_out": 387,
    "cost_usd": 0.000621,
    "duration_ms": 1250,
}
```

Estos registros se almacenan en la tabla `agent_run` de PostgreSQL al finalizar la sesión.

---

## Modelos configurables

En `.env` (o `Settings`):

```env
MODEL_INTAKE=anthropic/claude-sonnet-4-5
MODEL_CLASSIFIER=anthropic/claude-haiku-4-5
MODEL_VISION=anthropic/claude-sonnet-4-5
MODEL_RESOLVER=anthropic/claude-sonnet-4-5
MODEL_ESCALATOR=anthropic/claude-haiku-4-5
```

Cualquier modelo compatible con OpenRouter funciona. Haiku para tareas de clasificación (costo bajo), Sonnet para tareas de generación (calidad alta).
