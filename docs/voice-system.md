# Sistema de voz

El sistema de voz tiene dos sentidos: entrada (habla → texto) y salida (texto → habla). Ambos se implementan exclusivamente en el frontend usando APIs del navegador, con un fallback al servidor solo cuando el navegador no tiene soporte nativo.

## Arquitectura

```
ENTRADA (STT)
─────────────────────────────────────────────────────────
Chrome / Edge  ──▶  Web Speech API  ──▶  transcript final
                                              │
Firefox/Safari ──▶  MediaRecorder            │
                         │                   │
                    audio blob               │
                         │                   │
               POST /api/transcribe          │
               (proxy Next.js)               │
                         │                   │
               POST /transcribe              │
               (FastAPI)                     │
                         │                   │
               OpenRouter Whisper            │
                         │                   ▼
                    transcript ──────▶  sendMessage()
                                              │
                                    Pipeline de agentes
                                              │
                                        respuesta
SALIDA (TTS)                                  │
─────────────────────────────────────────────▼
SpeechSynthesis API  ◀──  strip markdown  ◀──  texto
      │
  Voz española
  (es-CO > es-US > es-*)
```

---

## Entrada de voz — `useVoiceInput`

**Archivo:** `apps/web/src/lib/useVoiceInput.ts`

### API del hook

```typescript
function useVoiceInput(options: {
  onResult: (transcript: string) => void;
  lang?: string;  // default: "es-CO"
}): {
  state: "idle" | "listening" | "processing";
  interimTranscript: string;
  start: () => void;
  stop: () => void;
  isSupported: boolean;
}
```

### Estados

```
idle ──start()──▶ listening ──speech ends──▶ processing ──result──▶ idle
                                                              └──error──▶ idle
```

- **`idle`** — sin actividad
- **`listening`** — grabando / reconociendo
- **`processing`** — esperando resultado final (solo en modo Whisper)

### Estrategia de selección

```typescript
if (hasSpeechRecognition()) {
  startWithSpeechRecognition();  // Web Speech API nativa
} else if (hasMediaRecorder()) {
  startWithWhisper();            // MediaRecorder → Whisper
}
```

### Modo 1: Web Speech API (Chrome, Edge)

```typescript
recognition.lang = "es-CO";
recognition.continuous = false;
recognition.interimResults = true;
recognition.maxAlternatives = 1;
```

- `onresult` acumula fragmentos intermedios en `interimTranscript` mientras el usuario habla
- `onspeechend` para el reconocedor y pasa a `processing`
- `onend` extrae el transcript final y llama `onResult(transcript)`

El transcript interino se muestra en la UI en tiempo real mientras el usuario habla.

### Modo 2: MediaRecorder + Whisper (Firefox, Safari)

1. `navigator.mediaDevices.getUserMedia({ audio: true })` solicita permiso de micrófono
2. `MediaRecorder` graba chunks en `audio/webm`
3. Al detener, concatena los chunks en un `Blob`
4. `POST /api/transcribe` (proxy Next.js) con el blob
5. El proxy reenvía a `POST /transcribe` en FastAPI
6. FastAPI llama a OpenRouter con `openai/whisper-1`, idioma español
7. Devuelve `{ transcript, language: "es" }`

### Cleanup

El `useEffect` de cleanup aborta/detiene cualquier grabación activa al desmontar el componente.

---

## Salida de voz — `useVoiceSynthesis`

**Archivo:** `apps/web/src/lib/useVoiceSynthesis.ts`

### API del hook

```typescript
function useVoiceSynthesis(): {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}
```

### Limpieza de markdown

Antes de sintetizar, el texto pasa por `stripMarkdown()` que elimina:

| Patrón | Eliminado |
|---|---|
| `## Heading` | `##`, `###`, etc. |
| `**negrita**` | `**` |
| `*cursiva*` | `*` |
| `` `código` `` | comillas inversas |
| `[texto](url)` | el link completo, deja solo el texto |
| `\n` | reemplazado por espacio |

### Selección de voz

```typescript
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  // Prioridad: es-CO > es-US > cualquier es-*
}
```

Parámetros de síntesis:
- `rate`: 1.05 (ligeramente más rápido que el defecto)
- `pitch`: 1.0 (tono natural)

### Integración en `ChatStream`

Al terminar el streaming de un mensaje (transición `isStreaming: true → false`), el componente llama automáticamente a `speak(lastMessage.content)` cuando `voiceMode === true`.

El usuario puede interrumpir la síntesis con el botón "Detener" que aparece en la interfaz mientras habla el agente.

---

## Endpoint de transcripción — FastAPI

**Archivo:** `apps/api/src/pae_api/routers/transcribe.py`

```
POST /transcribe
Content-Type: multipart/form-data
```

| Campo | Tipo | Límite |
|---|---|---|
| `audio` | UploadFile | máx. 25 MB |

MIME types aceptados: `audio/webm`, `audio/wav`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/x-m4a`

Respuesta:
```json
{
  "transcript": "Necesito solicitar un certificado de notas",
  "language": "es"
}
```

### Proxy Next.js

**Archivo:** `apps/web/src/app/api/transcribe/route.ts`

El navegador no puede hacer fetch directamente a `localhost:8000` desde producción (CORS). El proxy Next.js recibe el blob de audio y lo reenvía:

```
Browser  ──POST /api/transcribe──▶  Next.js Route Handler
                                            │
                                  POST /transcribe
                                            ▼
                                       FastAPI :8000
```

---

## Método `transcribe()` en OpenRouter

**Archivo:** `apps/api/src/pae_api/services/openrouter.py`

```python
async def transcribe(
    self,
    audio_bytes: bytes,
    mime_type: str,
    filename: str,
    language: str = "es",
) -> str:
    files = {"file": (filename, audio_bytes, mime_type)}
    data = {"model": "openai/whisper-1", "language": language}
    resp = await self._http.post("/audio/transcriptions", files=files, data=data)
    return resp.json().get("text", "")
```

---

## Soporte por navegador

| Función | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Web Speech API (STT) | ✅ | ✅ | ❌ | ❌ |
| MediaRecorder (Whisper) | ✅ | ✅ | ✅ | ✅ (iOS 14.5+) |
| SpeechSynthesis (TTS) | ✅ | ✅ | ✅ | ✅ |
| Voz española nativa | ✅ | ✅ | ✅ | ✅ |

En todos los navegadores modernos el sistema funciona completamente. La diferencia es que Chrome/Edge usan reconocimiento nativo (más rápido, sin llamada al servidor), mientras Firefox/Safari graban audio y lo envían a Whisper.

---

## Flujo completo en modo voz

```
1. Usuario activa modo Voz (toggle en la barra superior)
2. Usuario hace clic en VoiceButton
3. useVoiceInput.start()
   ├─ Chrome/Edge: Web Speech API escucha
   │     └─ muestra interimTranscript en tiempo real
   └─ Firefox/Safari: MediaRecorder graba
4. Usuario termina de hablar
   ├─ Chrome/Edge: onend → transcript → sendMessage()
   └─ Firefox/Safari: stop() → blob → POST /transcribe → transcript → sendMessage()
5. sendMessage() envía POST /chat → stream SSE
6. Los deltas de texto se acumulan en el mensaje del asistente
7. Al terminar el stream: useVoiceSynthesis.speak(respuesta)
8. El agente habla la respuesta en español
9. El usuario puede interrumpir con el botón "Detener"
10. Ciclo se repite desde el paso 2
```
