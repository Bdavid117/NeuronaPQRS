# Frontend — Next.js 15

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15 | Framework React (App Router) |
| TypeScript | 5 | Tipado estático |
| TailwindCSS | 3 | Estilos utilitarios |
| lucide-react | latest | Iconos |
| pnpm | — | Gestor de paquetes |

## Estructura de archivos

```
apps/web/src/
├── app/
│   ├── page.tsx                     Landing (/)
│   ├── layout.tsx                   Root layout (fuentes, metadata)
│   ├── globals.css                  Variables CSS globales
│   ├── chat/
│   │   ├── page.tsx                 Wrapper con Suspense
│   │   └── ChatPageInner.tsx        Layout de 3 columnas (client)
│   ├── r/
│   │   └── [radicado]/
│   │       └── page.tsx             Estado del caso
│   └── api/
│       └── transcribe/
│           └── route.ts             Proxy → FastAPI /transcribe
├── components/
│   └── chat/
│       ├── ChatStream.tsx           Motor del chat + SSE
│       ├── ChatSidebar.tsx          Panel izquierdo
│       ├── RightPanel.tsx           Panel derecho
│       └── VoiceButton.tsx          Botón micrófono
└── lib/
    ├── useVoiceInput.ts             Hook STT (Web Speech + Whisper)
    └── useVoiceSynthesis.ts         Hook TTS (SpeechSynthesis)
```

---

## Rutas

### `/` — Landing

Componente servidor (`app/page.tsx`).

- Navbar con logo, enlaces de navegación y botón "Nueva solicitud" → `/chat`
- Hero con badge de estado, título en degradado, subtítulo y dos CTAs
- Cuatro tarjetas PQRS: cada una enlaza a `/chat?prompt=<texto>` para pre-llenar el chat
- Barra de estadísticas: 3.200+ casos, 98% a tiempo, <2 min respuesta, 24/7

### `/chat` — Chat principal

Arquitectura de dos piezas para cumplir la restricción de `useSearchParams` en Next.js 15:

**`app/chat/page.tsx`** (servidor):
```tsx
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}
```

**`app/chat/ChatPageInner.tsx`** (cliente):
- Lee `?prompt=` de la URL con `useSearchParams()` y lo pasa como `initialPrompt` a `<ChatStream>`
- Gestiona el estado compartido entre las tres columnas:
  - `caseInfo` — radicado, tipo, área, urgencia, plazo
  - `activeAgent` — nombre del agente que está procesando
  - `completedAgents` — agentes ya ejecutados
  - `voiceMode` — alterna entre entrada de texto y voz
- Toggle Texto/Voz en la barra superior
- Indicador de estado online

Layout de 3 columnas:
```
┌──────────┬────────────────────┬──────────┐
│ Sidebar  │    ChatStream      │  Right   │
│ (izq.)   │    (centro)        │  Panel   │
│ 280px    │    flex-grow       │  320px   │
└──────────┴────────────────────┴──────────┘
```

### `/r/[radicado]` — Estado del caso

Componente servidor. Hace `fetch GET /pqrs/{radicado}` en el servidor al renderizar.

- Cabecera: radicado + badge de estado + badge de urgencia + plazo
- Timeline de 4 pasos con línea vertical (verde=completado, violeta=en curso, gris=pendiente):
  1. Caso radicado
  2. Clasificado por IA
  3. En revisión (con el área responsable)
  4. Respuesta emitida
- Sidebar derecho: tarjeta de metadatos, sección de documentos adjuntos, botón "Descargar expediente"
- Colores de estado: `abierto`=azul, `en_proceso`=violeta, `escalado`=naranja, `cerrado`=verde

---

## Componentes

### `ChatStream`

Motor principal del chat. Gestiona el ciclo completo de vida de una conversación.

**Props:**
```typescript
interface ChatStreamProps {
  sessionId: string;
  onCaseUpdate?: (info: CaseInfo) => void;
  onAgentChange?: (agent: string) => void;
  initialPrompt?: string;
  voiceMode?: boolean;
}
```

**Estado interno:**
- `messages` — historial de mensajes con `isStreaming` y `agentName`
- `input` — texto del textarea
- `loading` — petición en curso
- `currentAgent` — nombre del agente activo durante streaming
- `attachments` — archivos subidos (id + nombre)

**Flujo de mensaje:**
1. Usuario escribe o habla
2. `sendMessage()` hace `POST /api/chat` (proxy Next.js → FastAPI)
3. Lee el stream SSE con un `ReadableStreamReader`
4. Eventos `delta` → acumula texto en el último mensaje
5. Evento `agent_switch` → actualiza `currentAgent` y llama `onAgentChange`
6. Evento `state` → llama `onCaseUpdate` con el radicado y metadata
7. Evento `done` → cierra el stream, marca `isStreaming=false`
8. Si `voiceMode`, el hook TTS habla el último mensaje al terminar

**Modo voz:**
- Muestra `<VoiceButton>` + preview del transcript interino + botón para detener TTS
- El texto de la respuesta se limpia de markdown antes de sintetizarse

**Modo texto:**
- Textarea + botón enviar / abortar (mientras carga)
- Drag & drop de archivos

### `ChatSidebar`

Panel izquierdo fijo.

- Logo NeuronaPQRS con degradado violeta
- Botón "Nueva consulta" (degradado) → recarga `<ChatStream>` con nueva sesión
- Lista de historial de casos recientes (mock; 4 ítems con border violeta en el activo)
- Fila de usuario con avatar, nombre "Estudiante" y enlace de salida

### `RightPanel`

Panel derecho. Recibe el estado del caso desde `ChatPageInner`.

**Props:**
```typescript
interface RightPanelProps {
  caseInfo: CaseInfo | null;
  activeAgent: string | null;
  completedAgents: string[];
}
```

- Cabecera con el radicado activo o "Sin caso activo"
- Tarjeta de metadatos con filas skeleton cuando no hay caso:
  - Tipo PQRS, Área, Plazo, Urgencia
- Progreso de agentes (5 pasos):
  - completado → `CheckCircle2` verde
  - activo → punto con animación `pulse` violeta
  - pendiente → `Circle` gris
- Botón "Ver resumen completo" → `/r/{radicado}` (solo visible cuando hay radicado)

Orden de agentes mostrado: classifier → intake → resolver → vision → escalator

### `VoiceButton`

Botón de micrófono con feedback visual por estado.

| Estado | Visual |
|---|---|
| `idle` | Ícono micrófono, fondo degradado violeta |
| `listening` | Fondo rojo, anillo ping animado, borde pulsante |
| `processing` | Spinner circular |

---

## Hooks

### `useVoiceInput`

Ver documentación completa en [voice-system.md](voice-system.md).

### `useVoiceSynthesis`

Ver documentación completa en [voice-system.md](voice-system.md).

---

## Variables de entorno (frontend)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Solo las variables con prefijo `NEXT_PUBLIC_` se exponen al navegador.

## Comandos

```bash
cd apps/web

# Desarrollo
pnpm dev          # http://localhost:3000

# Build de producción
pnpm build
pnpm start

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```
