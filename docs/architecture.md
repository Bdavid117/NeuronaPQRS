# Arquitectura del sistema

## Visión general

NeuronaPQRS es un sistema multi-capa en el que el frontend en tiempo real se comunica con un grafo de agentes IA a través de Server-Sent Events (SSE). Cada mensaje del usuario atraviesa el pipeline de agentes y el resultado se persiste en dos almacenes: PostgreSQL (datos estructurados) y el vault Obsidian (base de conocimiento y casos narrativos).

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Navegador)                          │
│                                                                      │
│  Landing (/)  ──▶  Chat (/chat)  ──▶  Estado del caso (/r/radicado) │
│                         │                                            │
│         Texto  /  🎤 Web Speech API  /  Whisper fallback             │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ HTTPS  (SSE stream + REST)
┌─────────────────────────▼────────────────────────────────────────────┐
│                     FASTAPI  (puerto 8000)                           │
│                                                                      │
│   POST /chat  ──▶  StreamingResponse (text/event-stream)            │
│   GET  /pqrs/{radicado}                                              │
│   POST /upload                                                       │
│   POST /transcribe  (Whisper voz → texto)                           │
│   GET  /healthz                                                      │
└─────────────────────────┬────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────────┐
│                   LANGGRAPH SUPERVISOR                               │
│                                                                      │
│   __start__                                                          │
│       │                                                              │
│       ▼  _supervisor_route()  (lógica pura, sin LLM)                │
│       │                                                              │
│  ┌────┴────┐  ┌──────────┐  ┌────────┐  ┌──────────────┐  ┌──────┐ │
│  │ intake  │  │classifier│  │ vision │  │   resolver   │  │escal.│ │
│  │         │  │          │  │        │  │  resolver_   │  │      │ │
│  │ Claude  │  │  Haiku   │  │ Sonnet │  │  auto (0tok) │  │Haiku │ │
│  └────┬────┘  └────┬─────┘  └───┬────┘  └──────┬───────┘  └──┬───┘ │
│       └───────────┴────────────┴──────────────┴─────────────┘   │
│                                    │                              │
│                               finish_node                         │
│                         (radicado + QR + Obsidian)                │
└──────────────────────────────┬────────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           ▼                                       ▼
┌──────────────────────┐              ┌─────────────────────────────┐
│   PostgreSQL 17      │              │    Obsidian Vault (Neurona/) │
│   + pgvector         │              │                             │
│                      │              │  10-Catalogo-PQRS/          │
│  pqrs_case           │              │  20-Casos/ (un nodo/caso)   │
│  message             │              │  30-Conocimiento/ (RAG)     │
│  attachment          │◀── MCP ─────▶│  40-Plantillas/             │
│  agent_run           │              │  90-Sistema/cola.md         │
│  event               │              │                             │
│  semantic_cache      │              └─────────────────────────────┘
└──────────────────────┘
```

## Flujo de una solicitud completa

```
1. Usuario escribe (o habla) su solicitud
        │
2. Frontend envía POST /chat con {session_id, message}
        │
3. FastAPI verifica caché semántica (SHA-256 hash)
        │ HIT ──▶ inyecta draft_response en estado inicial
        │ MISS ──▶ continúa al grafo
        │
4. LangGraph arranca con init_state
        │
5. _supervisor_route() decide primer agente:
   ┌────────────────────────────────────────────────────┐
   │ ¿requires_human?              → escalator          │
   │ ¿adjuntos sin procesar?       → vision             │
   │ ¿campos pendientes o errores? → intake             │
   │ ¿sin tipo o categoría?        → classifier         │
   │ ¿sin draft y categoría auto?  → resolver_auto      │
   │ ¿sin draft?                   → resolver           │
   │ todo completo                 → finish             │
   └────────────────────────────────────────────────────┘
        │
6. Cada agente devuelve un delta de estado
   FastAPI emite SSE: delta / agent_switch / state / done
        │
7. finish_node:
   a. Genera radicado PQRS-YYYYMMDD-XXXXXX
   b. Crea nota en Obsidian 20-Casos/{radicado}.md
   c. Appende sección "Resolución automática"
   d. Actualiza frontmatter de la nota
   e. Genera QR code (base64 PNG) con URL del caso
   f. Emite SSE state {radicado, tipo, area, urgencia, plazo, case_url}
        │
8. _persist_state() guarda en PostgreSQL
        │
9. Si draft_response es nuevo, store_response() lo guarda en caché
        │
10. SSE done {session_id} — frontend cierra el stream
```

## Comunicación SSE

El endpoint `POST /chat` devuelve un `StreamingResponse` de tipo `text/event-stream`. Cada evento tiene el formato:

```
data: {"event": "<tipo>", "data": {...}}\n\n
```

| Tipo de evento | Cuándo se emite | Payload |
|---|---|---|
| `delta` | Cada fragmento de texto del agente | `{text: string}` |
| `agent_switch` | Cuando cambia el agente activo | `{agent: string}` |
| `state` | Al radicar el caso | `{radicado, tipo, area, urgencia, plazo, case_url}` |
| `done` | Al finalizar el stream | `{session_id}` |
| `error` | En caso de excepción | `{message: string}` |

## Caché semántica

Antes de invocar el grafo, el router comprueba si existe una respuesta cacheada para la consulta:

```
hash = SHA-256("{tipo}:{categoria}:{query.strip().lower()}")
```

Si el hash está en `semantic_cache`, se inyecta `draft_response` en el `init_state`. El grafo salta intake/classifier/resolver y va directo a `finish`. El ahorro típico: 2-4 llamadas LLM y 2-5 segundos de latencia.

## Modo de voz

```
Navegador
  │
  ├─ Web Speech API (Chrome/Edge) ──▶ transcript ──▶ sendMessage()
  │
  └─ MediaRecorder (Firefox/Safari) ──▶ audio blob
       ──▶ POST /api/transcribe (proxy Next.js)
       ──▶ POST /transcribe (FastAPI → OpenRouter Whisper)
       ──▶ transcript ──▶ sendMessage()

Respuesta del agente ──▶ SpeechSynthesis API (TTS, voz española)
```
