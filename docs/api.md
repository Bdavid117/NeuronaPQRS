# Referencia de API — REST y SSE

Base URL (desarrollo): `http://localhost:8000`  
Documentación interactiva: `http://localhost:8000/docs`

---

## POST /chat

Endpoint principal. Recibe el mensaje del usuario y devuelve un stream SSE con la respuesta de los agentes.

### Request

`Content-Type: application/json`

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Necesito solicitar un certificado de notas",
  "attachment_ids": []
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `session_id` | string | sí | UUID de sesión; si no existe, se crea un caso nuevo |
| `message` | string | sí | Texto del usuario |
| `attachment_ids` | int[] | no | IDs de adjuntos subidos previamente |

### Response

`Content-Type: text/event-stream`

Cada línea tiene el formato:

```
data: {"event": "<tipo>", "data": {...}}\n\n
```

#### Tipos de evento

| Evento | Cuándo | Payload |
|---|---|---|
| `delta` | Cada fragmento de texto del agente | `{"text": "string"}` |
| `agent_switch` | Al cambiar de agente | `{"agent": "intake" \| "classifier" \| "vision" \| "resolver" \| "resolver_auto" \| "escalator" \| "finish"}` |
| `state` | Al radicar el caso (finish_node) | `{"radicado", "tipo", "area", "urgencia", "plazo", "case_url", "qr_code_b64"}` |
| `done` | Al finalizar el stream | `{"session_id": "string"}` |
| `error` | En caso de excepción no recuperable | `{"message": "string"}` |

#### Payload completo de `state`

```json
{
  "radicado": "PQRS-20260507-A3F9C1",
  "tipo": "reclamo",
  "categoria": "Reclamo-Nota",
  "area": "Registro Académico",
  "urgencia": "media",
  "plazo": "2026-05-22",
  "case_url": "http://localhost:3000/r/PQRS-20260507-A3F9C1",
  "qr_code_b64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### Caché semántica

Antes de invocar el grafo, el router calcula:

```
hash = SHA-256("{tipo}:{categoria}:{message.strip().lower()}")
```

Si existe en `semantic_cache`, inyecta `draft_response` en el estado inicial y el grafo salta directamente a `finish_node` (ahorro de 2–4 llamadas LLM).

---

## GET /pqrs/{radicado}

Devuelve el estado actual de un caso por su radicado.

### Path parameter

| Parámetro | Ejemplo |
|---|---|
| `radicado` | `PQRS-20260507-A3F9C1` |

### Response `200 OK`

```json
{
  "radicado": "PQRS-20260507-A3F9C1",
  "tipo": "reclamo",
  "categoria": "Reclamo-Nota",
  "area": "Registro Académico",
  "urgencia": "media",
  "estado": "abierto",
  "created_at": "2026-05-07T14:32:00Z",
  "plazo_respuesta": "2026-05-22",
  "collected_fields": {
    "nombre": "Ana Torres",
    "correo": "ana@universidad.edu",
    "programa": "Ingeniería de Sistemas",
    "descripcion": "..."
  }
}
```

> `numero_identificacion` se omite de la respuesta por privacidad.

### Response `404`

```json
{"detail": "Caso no encontrado"}
```

---

## POST /upload

Sube un archivo (imagen o PDF) asociado a una sesión.

### Request

`Content-Type: multipart/form-data`

| Campo | Tipo | Descripción |
|---|---|---|
| `session_id` | string | UUID de la sesión activa |
| `file` | file | Imagen o PDF (máx. 10 MB) |

MIME types aceptados: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`

### Response `200 OK`

```json
{
  "attachment_id": 42,
  "filename": "evidencia.pdf",
  "status": "uploaded"
}
```

El `attachment_id` se pasa en el siguiente `POST /chat` para que el agente vision lo procese.

---

## POST /transcribe

Transcribe un audio a texto usando Whisper vía OpenRouter. Usado como fallback por el frontend en Firefox/Safari.

### Request

`Content-Type: multipart/form-data`

| Campo | Tipo | Descripción |
|---|---|---|
| `audio` | file | Audio grabado (máx. 25 MB) |

MIME types aceptados: `audio/webm`, `audio/wav`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/x-m4a`

### Response `200 OK`

```json
{
  "transcript": "Necesito solicitar un certificado de notas para el segundo semestre",
  "language": "es"
}
```

---

## GET /healthz

Health check para monitoreo y balanceadores de carga.

### Response `200 OK`

```json
{"status": "ok"}
```

---

## Códigos de error comunes

| Código | Causa |
|---|---|
| 400 | Body inválido o MIME type no permitido |
| 404 | Caso no encontrado |
| 413 | Archivo excede el límite de tamaño |
| 422 | Validación Pydantic fallida |
| 500 | Error interno del grafo o del LLM |

---

## Proxy Next.js → FastAPI

El frontend Next.js expone `/api/transcribe` como proxy del endpoint FastAPI para evitar problemas de CORS desde el navegador:

```
POST /api/transcribe  (Next.js)
    └─▶ POST /transcribe  (FastAPI :8000)
```

Implementado en `apps/web/src/app/api/transcribe/route.ts`.
