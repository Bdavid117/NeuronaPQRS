# NeuronaPQRS — Plan de Mejoramiento Integral

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar NeuronaPQRS en un sistema profesional con UI Intercom-inspired mobile-first, panel de administración, vault reconstruido y agentes más rápidos.

**Architecture:** Backend FastAPI intacto salvo 2 endpoints admin nuevos. Frontend Next.js 16 completamente rediseñado de dark a light theme. Vault Obsidian reconstruido desde cero con seed limpio. Optimizaciones de agentes en capa de Python sin tocar el grafo LangGraph.

**Tech Stack:** Next.js 16.2.5, React 19, TailwindCSS v4 (@theme directive), Geist fonts, FastAPI, SQLModel, LangGraph, Python 3.14, uv

---

## Mapa de archivos

### Capa 1 — Bug fixes de voz
| Acción | Archivo |
|---|---|
| Modify | `apps/web/src/components/chat/MessageBubble.tsx:8-14` |
| Modify | `apps/web/src/components/chat/ChatStream.tsx:92-118` |
| Modify | `apps/web/src/lib/useVoiceInput.ts:148-168` |
| Modify | `apps/api/src/pae_api/agents/graph.py:196-229` |

### Capa 2 — Diseño y frontend
| Acción | Archivo |
|---|---|
| Modify | `apps/web/src/app/globals.css` |
| Modify | `apps/web/src/app/layout.tsx` |
| Modify | `apps/web/src/app/page.tsx` |
| Modify | `apps/web/src/components/chat/MessageBubble.tsx` |
| Modify | `apps/web/src/components/chat/ChatStream.tsx` |
| Modify | `apps/web/src/app/chat/page.tsx` |
| Modify | `apps/web/src/app/chat/ChatPageInner.tsx` |
| Create | `apps/web/src/components/ui/StatusBadge.tsx` |
| Create | `apps/web/src/components/ui/MetricCard.tsx` |
| Create | `apps/web/src/components/ui/VoiceOrb.tsx` |
| Modify | `apps/web/src/components/chat/VoiceButton.tsx` |

### Capa 3 — Admin backend
| Acción | Archivo |
|---|---|
| Create | `apps/api/src/pae_api/routers/admin.py` |
| Modify | `apps/api/src/pae_api/main.py` |
| Modify | `apps/api/src/pae_api/config.py` |
| Modify | `.env` y `.env.example` |

### Capa 4 — Admin frontend
| Acción | Archivo |
|---|---|
| Modify | `apps/web/src/middleware.ts` |
| Create | `apps/web/src/app/api/admin/login/route.ts` |
| Create | `apps/web/src/app/admin/login/page.tsx` |
| Create | `apps/web/src/app/admin/page.tsx` |
| Create | `apps/web/src/app/admin/layout.tsx` |
| Create | `apps/web/src/app/admin/cases/[radicado]/page.tsx` |
| Create | `apps/web/src/app/api/admin/cases/route.ts` |
| Create | `apps/web/src/app/api/admin/cases/[radicado]/route.ts` |

### Capa 5 — Vault rebuild
| Acción | Archivo |
|---|---|
| Rewrite | `infra/seed_vault.py` |
| Delete content | `Neurona/20-Casos/` (todos los .md) |
| Delete content | `Neurona/50-Usuarios/` (todos los .md) |

### Capa 6 — Optimización de agentes
| Acción | Archivo |
|---|---|
| Modify | `apps/api/src/pae_api/agents/resolver_auto.py` |
| Modify | `apps/api/src/pae_api/services/openrouter.py` |

---

## Task 1: Corregir bug de TTS doble (respuesta de voz duplicada)

**Files:**
- Modify: `apps/web/src/components/chat/MessageBubble.tsx:8-14`
- Modify: `apps/web/src/components/chat/ChatStream.tsx:92-108`

**Causa raíz:** El `useEffect` de auto-speak se dispara cada vez que `messages` cambia. Si `setMessages` se llama varias veces antes de que `prevMessagesRef` se actualice (race condition durante el SSE), `speak()` puede llamarse más de una vez para el mismo mensaje.

- [ ] **Step 1: Añadir `ttsPlayed` a la interfaz `Message`**

En `apps/web/src/components/chat/MessageBubble.tsx`, cambiar líneas 8-14:

```typescript
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  isStreaming?: boolean;
  ttsPlayed?: boolean;   // ← añadir esta línea
}
```

- [ ] **Step 2: Modificar el useEffect de auto-speak en `ChatStream.tsx`**

Reemplazar líneas 91-108 (bloque `// Auto-speak the last assistant message...`):

```typescript
// Auto-speak the last assistant message when it finishes streaming (voice mode only)
const prevMessagesRef = useRef<Message[]>([]);
useEffect(() => {
  if (!voiceMode) return;
  const prev = prevMessagesRef.current;
  const curr = messages;
  const lastPrev = prev[prev.length - 1];
  const lastCurr = curr[curr.length - 1];
  if (
    lastPrev?.isStreaming &&
    !lastCurr?.isStreaming &&
    lastCurr?.role === "assistant" &&
    lastCurr?.content &&
    !lastCurr?.ttsPlayed          // ← solo hablar si no fue reproducido
  ) {
    speakRef.current(lastCurr.content);
    setMessages((prev) =>
      prev.map((m) => (m.id === lastCurr.id ? { ...m, ttsPlayed: true } : m))
    );
  }
  prevMessagesRef.current = curr;
}, [messages, voiceMode]);
```

- [ ] **Step 3: Verificar manualmente**

Iniciar el frontend (`pnpm dev` en `apps/web/`), activar modo voz, enviar un mensaje y verificar que la respuesta se reproduce **exactamente una vez**. Enviar un segundo mensaje y confirmar que tampoco se duplica.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/MessageBubble.tsx apps/web/src/components/chat/ChatStream.tsx
git commit -m "fix: prevent TTS double-speak with ttsPlayed deduplication flag"
```

---

## Task 2: Corregir bugs restantes del sistema de voz

**Files:**
- Modify: `apps/web/src/components/chat/ChatStream.tsx:110-118`
- Modify: `apps/web/src/lib/useVoiceInput.ts:148-168`
- Modify: `apps/api/src/pae_api/agents/graph.py:195-229`

- [ ] **Step 1: Auto-stop micrófono al cambiar a modo texto**

En `ChatStream.tsx`, añadir el siguiente `useEffect` **después** del bloque `// Auto-restart microphone after TTS finishes` (después de la línea 118):

```typescript
// Stop microphone when switching from voice to text mode
useEffect(() => {
  if (!voiceMode && voice.state !== "idle") {
    voice.stop();
  }
}, [voiceMode, voice.state, voice.stop]);
```

- [ ] **Step 2: Añadir try/catch a `voice.start()` tras TTS**

Reemplazar líneas 110-118 (bloque `// Auto-restart microphone after TTS finishes`):

```typescript
// Auto-restart microphone after TTS finishes (voice conversation loop)
const prevIsSpeakingRef = useRef(false);
useEffect(() => {
  const wasSpeaking = prevIsSpeakingRef.current;
  prevIsSpeakingRef.current = tts.isSpeaking;
  if (wasSpeaking && !tts.isSpeaking && voiceMode && !isLoading) {
    try {
      voice.start();
    } catch (err) {
      console.warn("NeuronaPQRS: Failed to restart mic after TTS:", err);
    }
  }
}, [tts.isSpeaking, voiceMode, isLoading, voice.start]);
```

- [ ] **Step 3: Feedback de error en transcripción Whisper**

En `apps/web/src/lib/useVoiceInput.ts`, cambiar el bloque `recorder.onstop` (líneas 148-168). Añadir el tipo de retorno al hook y un estado de error:

Primero, añadir `"error"` al tipo `VoiceInputState` en la línea 5:
```typescript
export type VoiceInputState = "idle" | "listening" | "processing" | "error";
```

Luego, en `startWithWhisper`, reemplazar el bloque `recorder.onstop`:
```typescript
recorder.onstop = async () => {
  stream.getTracks().forEach((t) => t.stop());
  setState("processing");
  try {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const transcript = await transcribeWithWhisper(blob);
    if (transcript) onResultRef.current(transcript);
  } catch (err) {
    console.warn("NeuronaPQRS: Whisper transcription failed:", err);
    setState("error");
    setTimeout(() => setState("idle"), 2000); // volver a idle tras 2s
    mediaRecorderRef.current = null;
    return;
  } finally {
    if (mediaRecorderRef.current !== null) {
      setState("idle");
      mediaRecorderRef.current = null;
    }
  }
};
```

- [ ] **Step 4: Loguear error de vault Obsidian en finish_node**

En `apps/api/src/pae_api/agents/graph.py`, reemplazar el bloque `except (FileExistsError, Exception):` (líneas 195-229):

```python
    vault_path: str | None = None
    try:
        obsidian_create_case(radicado, metadata, "\n".join(body_lines))
        vault_path = f"20-Casos/{radicado}.md"

        # Register user/session node and link it to this case
        _upsert_user_node(collected, state.get("session_id", ""), radicado)

        # append resolution section to case note
        draft_response = state.get("draft_response", "")
        if draft_response:
            resolution_section = (
                f"\n\n## Resolución automática\n\n{draft_response}\n\n"
                f"**Radicado:** {radicado}\n"
                f"**Fecha:** {date.today().isoformat()}\n"
            )
            try:
                write_note(f"20-Casos/{radicado}.md", resolution_section, mode="append")
            except Exception:
                pass  # non-critical

        # Update frontmatter to mark case resolved
        try:
            update_frontmatter(
                f"20-Casos/{radicado}.md",
                {
                    "estado": "resuelto_automaticamente",
                    "fecha_resolucion": date.today().isoformat(),
                },
            )
        except Exception:
            pass  # non-critical

    except FileExistsError:
        vault_path = None
    except Exception as exc:
        import logging
        logging.getLogger("pae_api.agents.graph").error(
            "finish_node: failed to write case %s to vault: %s", radicado, exc
        )
        vault_path = None
```

- [ ] **Step 5: Actualizar el indicador de estado de voz en `ChatStream.tsx`**

En el JSX del modo voz (líneas 362-371), añadir el caso de error:

```typescript
{voice.state === "error"
  ? <span className="text-rose-400/80">Error de transcripción. Intenta de nuevo.</span>
  : voice.state === "listening" && voice.interimTranscript
  ? <span className="text-white/60 italic">&ldquo;{voice.interimTranscript}&rdquo;</span>
  : voice.state === "listening"
  ? "Escuchando… toca para detener"
  : tts.isSpeaking
  ? "Reproduciendo respuesta…"
  : "Toca el micrófono para hablar"}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/ChatStream.tsx apps/web/src/lib/useVoiceInput.ts apps/api/src/pae_api/agents/graph.py
git commit -m "fix: voice auto-stop on mode switch, Whisper error feedback, vault error logging"
```

---

## Task 3: Nuevo sistema de diseño — light theme (TailwindCSS v4)

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Contexto:** TailwindCSS v4 usa la directiva `@theme` en CSS para definir tokens de diseño personalizados. No existe `tailwind.config.ts`. Los colores definidos en `@theme` generan clases como `bg-primary-600`, `text-slate-700`, etc.

- [ ] **Step 1: Reemplazar `globals.css` completamente**

```css
@import "tailwindcss";

@theme {
  /* Paleta primaria — azul institucional */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;

  /* Superficies */
  --color-surface: #f1f5f9;
  --color-surface-alt: #f8fafc;

  /* Urgencia */
  --color-urgencia-alta: #dc2626;
  --color-urgencia-media: #d97706;
  --color-urgencia-baja: #16a34a;

  /* Sombras suaves */
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07);
  --shadow-card-hover: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --border: #e2e8f0;
  --muted: #64748b;
}

html, body, #__next {
  height: 100%;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar suave */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
```

- [ ] **Step 2: Actualizar `layout.tsx` — idioma y fuentes**

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuronaPQRS — Sistema PQRS Institucional",
  description: "Radica peticiones, quejas, reclamos y sugerencias de forma rápida y segura.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-slate-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar que el servidor arranca sin errores de CSS**

```bash
cd apps/web && pnpm dev
```
Abrir `http://localhost:3000`. El fondo debe ser blanco (no negro).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx
git commit -m "feat: new light design system with TailwindCSS v4 @theme tokens"
```

---

## Task 4: Rediseñar la landing page (`/`)

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Reemplazar `page.tsx` completamente**

```typescript
import { Clock, FileText, Shield } from "lucide-react";
import Link from "next/link";

const PQRS_TYPES = [
  {
    key: "peticion",
    label: "Petición",
    description: "Solicita información, certificados o documentos oficiales.",
    emoji: "📄",
    prompt: "Quiero radicar una petición",
    accent: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    key: "queja",
    label: "Queja",
    description: "Reporta inconformidad con la atención o un funcionario.",
    emoji: "💬",
    prompt: "Quiero radicar una queja",
    accent: "border-orange-200 hover:border-orange-400 hover:bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
  },
  {
    key: "reclamo",
    label: "Reclamo",
    description: "Exige la revisión de una nota o trámite institucional.",
    emoji: "⚖️",
    prompt: "Quiero radicar un reclamo",
    accent: "border-red-200 hover:border-red-400 hover:bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
  {
    key: "sugerencia",
    label: "Sugerencia",
    description: "Propón mejoras a los servicios o procesos institucionales.",
    emoji: "💡",
    prompt: "Quiero radicar una sugerencia",
    accent: "border-green-200 hover:border-green-400 hover:bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">NeuronaPQRS</span>
          </div>
          <Link href="/admin/login" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            Administración
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 bg-surface-alt">
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-primary-100">
          <span className="w-1.5 h-1.5 bg-primary-600 rounded-full" />
          Sistema PQRS — Institución Educativa
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight max-w-2xl">
          Radica tu solicitud<br className="hidden sm:block" /> en minutos
        </h1>

        <p className="text-slate-500 text-base sm:text-lg mb-8 max-w-md">
          Nuestro asistente inteligente te guía paso a paso para registrar peticiones, quejas, reclamos y sugerencias.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-primary-700 transition-colors shadow-sm"
          >
            Iniciar solicitud
          </Link>
          <Link
            href="/historial"
            className="inline-flex items-center gap-2 bg-white text-slate-700 px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors border border-slate-200"
          >
            Ver mis casos
          </Link>
        </div>
      </section>

      {/* PQRS type cards */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">
          ¿Qué necesitas radicar?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PQRS_TYPES.map((type) => (
            <Link
              key={type.key}
              href={`/chat?prompt=${encodeURIComponent(type.prompt)}`}
              className={`flex flex-col gap-3 p-5 rounded-2xl bg-white border transition-all duration-200 ${type.accent}`}
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <span className="text-2xl">{type.emoji}</span>
              <div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${type.badge} mb-2 inline-block`}>
                  {type.label}
                </span>
                <p className="text-slate-500 text-sm leading-relaxed">{type.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface border-t border-slate-100 px-4 sm:px-8 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Clock, title: "Respuesta en 15 días hábiles", desc: "Cumplimos con la Ley 1755/2015 de derecho de petición." },
            { icon: Shield, title: "Tus datos están protegidos", desc: "Información cifrada y acceso restringido por área responsable." },
            { icon: FileText, title: "Radicado instantáneo", desc: "Recibes tu número de caso y código QR al finalizar." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <Icon size={18} className="text-primary-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1">{title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        NeuronaPQRS · Sistema PQRS Institucional · Ley 1755 de 2015
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verificar en navegador**

- Abrir `http://localhost:3000`
- Verificar que los 4 cards de PQRS aparecen con colores diferenciados
- Verificar que en móvil (< 640px) los cards son 1 columna
- Verificar que el header es sticky y tiene blur

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: redesign landing page with Intercom-inspired light theme"
```

---

## Task 5: Rediseñar MessageBubble para light theme

**Files:**
- Modify: `apps/web/src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Reemplazar `MessageBubble.tsx` completamente**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  isStreaming?: boolean;
  ttsPlayed?: boolean;
}

const AGENT_META: Record<string, { label: string; color: string; dot: string }> = {
  intake:       { label: "Recepción",    color: "text-blue-600",   dot: "bg-blue-500" },
  classifier:   { label: "Clasificador", color: "text-violet-600", dot: "bg-violet-500" },
  vision:       { label: "Verificación", color: "text-amber-600",  dot: "bg-amber-500" },
  resolver:     { label: "Resolución",   color: "text-emerald-600",dot: "bg-emerald-500" },
  resolver_auto:{ label: "Auto-Res.",    color: "text-teal-600",   dot: "bg-teal-500" },
  escalator:    { label: "Escalamiento", color: "text-rose-600",   dot: "bg-rose-500" },
};

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const agent = message.agentName ? AGENT_META[message.agentName] : null;

  return (
    <div className={cn("flex gap-3 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
        isUser
          ? "bg-primary-600"
          : "bg-white border border-slate-200"
      )}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-slate-500" />}
      </div>

      {/* Bubble + meta */}
      <div className={cn("max-w-[78%] flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {/* Agent label */}
        {!isUser && agent && (
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", agent.dot)} />
            <span className={cn("text-[11px] font-semibold uppercase tracking-widest", agent.color)}>
              {agent.label}
            </span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "px-4 py-3 text-sm leading-relaxed break-words",
          isUser
            ? "bg-primary-600 text-white rounded-2xl rounded-tr-sm shadow-sm"
            : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm"
        )}>
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <div className="prose prose-slate prose-sm max-w-none
              prose-p:my-1 prose-p:leading-relaxed
              prose-strong:text-slate-900 prose-strong:font-semibold
              prose-ul:my-1.5 prose-ul:pl-4
              prose-ol:my-1.5 prose-ol:pl-4
              prose-li:my-0.5
              prose-code:bg-slate-100 prose-code:text-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
              prose-blockquote:border-l-2 prose-blockquote:border-primary-300 prose-blockquote:pl-3 prose-blockquote:text-slate-500
              prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-h1:text-slate-900 prose-h2:text-slate-900
              prose-hr:border-slate-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse rounded-sm align-middle" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar visualmente**

Abrir `/chat` y enviar un mensaje. Los mensajes del usuario deben ser azul (`bg-primary-600`), los del asistente deben ser blancos con borde gris. Sin fondo oscuro en las burbujas.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/MessageBubble.tsx
git commit -m "feat: redesign MessageBubble for light theme"
```

---

## Task 6: Rediseñar `ChatStream.tsx` — light theme completo

**Files:**
- Modify: `apps/web/src/components/chat/ChatStream.tsx`

- [ ] **Step 1: Actualizar constantes de color**

En `ChatStream.tsx`, reemplazar las constantes `URGENCIA_COLORS` y `TIPO_ICONS` (líneas 27-38):

```typescript
const URGENCIA_COLORS: Record<string, string> = {
  alta:  "text-red-700 bg-red-50 border-red-200",
  media: "text-amber-700 bg-amber-50 border-amber-200",
  baja:  "text-green-700 bg-green-50 border-green-200",
};

const TIPO_ICONS: Record<string, string> = {
  peticion:   "📄",
  queja:      "💬",
  reclamo:    "⚖️",
  sugerencia: "💡",
};
```

- [ ] **Step 2: Actualizar el radicado banner (líneas 252-302)**

Reemplazar el bloque `{/* Radicado banner */}` completo:

```typescript
{caseInfo && (
  <div className={cn(
    "mx-4 mb-3 rounded-xl border p-4",
    caseInfo.requiresHuman
      ? "bg-amber-50 border-amber-200"
      : "bg-emerald-50 border-emerald-200"
  )}>
    <div className="flex items-start gap-3">
      {caseInfo.requiresHuman ? (
        <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold text-sm mb-1", caseInfo.requiresHuman ? "text-amber-800" : "text-emerald-800")}>
          {caseInfo.requiresHuman ? "Caso escalado para revisión humana" : "Caso radicado exitosamente"}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
            {caseInfo.radicado}
          </code>
          {caseInfo.tipo && (
            <span className="text-xs text-slate-500">
              {TIPO_ICONS[caseInfo.tipo] ?? ""} {caseInfo.tipo}
            </span>
          )}
          {caseInfo.urgencia && (
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider", URGENCIA_COLORS[caseInfo.urgencia] ?? "text-slate-600 bg-slate-50 border-slate-200")}>
              {caseInfo.urgencia}
            </span>
          )}
        </div>
        {caseInfo.plazo && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
            <Clock size={11} />
            <span>Plazo: {caseInfo.plazo}</span>
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Actualizar el área de input — texto (líneas 373-433)**

Reemplazar el bloque de modo texto (`/* ── Text mode ── */`):

```typescript
) : (
  /* ── Text mode ── */
  <div className="px-4 pb-4 pt-1">
    <div className={cn(
      "flex items-end gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2.5 transition-all duration-200 shadow-sm",
      "focus-within:border-primary-400 focus-within:shadow-primary-100 focus-within:shadow-md"
    )}>
      <button
        onClick={() => setShowUpload((v) => !v)}
        className={cn(
          "p-1.5 rounded-lg transition-all duration-200 flex-shrink-0",
          showUpload
            ? "text-primary-600 bg-primary-50"
            : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
        )}
        title="Adjuntar documento"
      >
        <Paperclip size={16} />
      </button>

      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu mensaje aquí…"
        rows={1}
        disabled={isLoading}
        className="flex-1 bg-transparent resize-none text-slate-900 placeholder-slate-400 text-sm outline-none py-0.5 max-h-32 overflow-y-auto leading-relaxed disabled:opacity-50"
        style={{ minHeight: "1.75rem" }}
      />

      {isLoading ? (
        <button
          onClick={() => abortController?.abort()}
          className="flex-shrink-0 p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all duration-200"
          title="Detener"
        >
          <X size={16} />
        </button>
      ) : (
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          className={cn(
            "flex-shrink-0 p-1.5 rounded-lg transition-all duration-200",
            input.trim()
              ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
              : "text-slate-300 cursor-not-allowed"
          )}
          title="Enviar (Enter)"
        >
          <Send size={16} />
        </button>
      )}
    </div>
    <p className="text-center text-[11px] text-slate-400 mt-2">
      Enter para enviar · Shift+Enter para nueva línea
    </p>
  </div>
)}
```

- [ ] **Step 4: Actualizar modo voz (líneas 333-372)**

Reemplazar el bloque de modo voz (`/* ── Voice mode ── */`):

```typescript
{voiceMode ? (
  /* ── Voice mode ── */
  <div className="px-4 pb-6 pt-2 flex flex-col items-center gap-3 bg-slate-50 border-t border-slate-100">
    <div className="flex items-center gap-4">
      {tts.isSpeaking && (
        <button
          onClick={tts.stop}
          className="p-2 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
          title="Silenciar respuesta"
        >
          <VolumeX size={16} />
        </button>
      )}
      <VoiceButton
        state={voice.state}
        onStart={voice.start}
        onStop={voice.stop}
        disabled={isLoading || tts.isSpeaking}
      />
      {isLoading && (
        <button
          onClick={() => abortController?.abort()}
          className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-all"
          title="Detener"
        >
          <X size={16} />
        </button>
      )}
    </div>
    <p className="text-center text-xs text-slate-400 max-w-xs leading-relaxed">
      {voice.state === "error"
        ? <span className="text-red-500">Error de transcripción. Intenta de nuevo.</span>
        : voice.state === "listening" && voice.interimTranscript
        ? <span className="text-slate-600 italic">&ldquo;{voice.interimTranscript}&rdquo;</span>
        : voice.state === "listening"
        ? "Escuchando… toca para detener"
        : tts.isSpeaking
        ? "Reproduciendo respuesta…"
        : "Toca el micrófono para hablar"}
    </p>
  </div>
```

- [ ] **Step 5: Actualizar el área de mensajes (línea 231)**

Cambiar:
```typescript
<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 scroll-smooth">
```
Por:
```typescript
<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 scroll-smooth bg-surface-alt">
```

- [ ] **Step 6: Verificar visualmente**

Abrir `/chat`, enviar mensajes y verificar el diseño light. Activar modo voz y confirmar que el área de voz tiene fondo gris claro.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/chat/ChatStream.tsx
git commit -m "feat: update ChatStream for light theme design system"
```

---

## Task 7: Rediseñar `ChatPageInner.tsx` — mobile-first layout

**Files:**
- Modify: `apps/web/src/app/chat/ChatPageInner.tsx`
- Modify: `apps/web/src/app/chat/page.tsx`

- [ ] **Step 1: Reemplazar `ChatPageInner.tsx`**

```typescript
"use client";

import { type CaseInfo, ChatStream } from "@/components/chat/ChatStream";
import { cn } from "@/lib/utils";
import { ChevronLeft, Keyboard, Mic, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";

function CaseInfoPanel({ caseInfo }: { caseInfo: CaseInfo | null }) {
  if (!caseInfo) return null;
  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm text-sm">
      <h3 className="font-semibold text-slate-900 mb-3 text-xs uppercase tracking-widest text-slate-500">Información del caso</h3>
      <dl className="space-y-1.5">
        {caseInfo.radicado && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Radicado</dt>
            <dd className="font-mono text-xs text-slate-900 font-semibold">{caseInfo.radicado}</dd>
          </div>
        )}
        {caseInfo.tipo && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Tipo</dt>
            <dd className="text-slate-900 capitalize">{caseInfo.tipo}</dd>
          </div>
        )}
        {caseInfo.categoria && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Categoría</dt>
            <dd className="text-slate-900 text-right">{caseInfo.categoria}</dd>
          </div>
        )}
        {caseInfo.area && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Área</dt>
            <dd className="text-slate-900 text-right">{caseInfo.area}</dd>
          </div>
        )}
        {caseInfo.urgencia && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Urgencia</dt>
            <dd className={cn("text-xs font-semibold capitalize", {
              "text-red-600": caseInfo.urgencia === "alta",
              "text-amber-600": caseInfo.urgencia === "media",
              "text-green-600": caseInfo.urgencia === "baja",
            })}>{caseInfo.urgencia}</dd>
          </div>
        )}
        {caseInfo.plazo && (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Plazo</dt>
            <dd className="text-slate-900">{caseInfo.plazo}</dd>
          </div>
        )}
      </dl>
      {caseInfo.radicado && (
        <Link
          href={`/r/${caseInfo.radicado}`}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium py-2 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Ver página del caso →
        </Link>
      )}
    </div>
  );
}

export function ChatPageInner() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? undefined;

  const [sessionId, setSessionId] = useState<string>(uuidv4);
  const sessionIdRef = useRef(sessionId);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);

  useEffect(() => {
    const storedId = localStorage.getItem("pae_session_id");
    const id = storedId ?? sessionId;
    if (!storedId) localStorage.setItem("pae_session_id", id);
    if (id !== sessionId) {
      setSessionId(id);
      sessionIdRef.current = id;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCaseUpdate = useCallback((info: CaseInfo) => {
    setCaseInfo(info);
    if (info.radicado) {
      const item = {
        sessionId: sessionIdRef.current,
        radicado: info.radicado,
        title: info.tipo
          ? `${info.tipo.charAt(0).toUpperCase()}${info.tipo.slice(1)}${info.categoria ? " · " + info.categoria : ""}`
          : "Consulta PQRS",
        date: new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }),
        requiresHuman: info.requiresHuman,
      };
      try {
        const prev = JSON.parse(localStorage.getItem("pae_history") ?? "[]");
        const updated = [item, ...prev.filter((h: typeof item) => h.sessionId !== sessionIdRef.current)].slice(0, 20);
        localStorage.setItem("pae_history", JSON.stringify(updated));
      } catch { /* noop */ }
    }
  }, []);

  const handleNew = useCallback(() => {
    const id = uuidv4();
    localStorage.setItem("pae_session_id", id);
    setSessionId(id);
    sessionIdRef.current = id;
    setCaseInfo(null);
    setChatKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-surface-alt">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">N</span>
            </div>
            <span className="font-semibold text-slate-900 text-sm">NeuronaPQRS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice / Text toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setVoiceMode(false)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                !voiceMode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Keyboard size={12} />
              <span className="hidden sm:inline">Texto</span>
            </button>
            <button
              onClick={() => setVoiceMode(true)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                voiceMode ? "bg-primary-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Mic size={12} />
              <span className="hidden sm:inline">Voz</span>
            </button>
          </div>

          <button
            onClick={handleNew}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
            title="Nueva consulta"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>
      </header>

      {/* Main area — mobile: 1 col, desktop: 2 col */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatStream
            key={chatKey}
            sessionId={sessionId}
            onCaseUpdate={handleCaseUpdate}
            onAgentChange={() => {}}
            initialPrompt={chatKey === 0 ? initialPrompt : undefined}
            voiceMode={voiceMode}
          />
        </div>

        {/* Right panel — only on desktop (md+) */}
        <aside className="hidden md:flex flex-col w-72 lg:w-80 border-l border-slate-200 bg-white p-4 gap-4 overflow-y-auto flex-shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Estado del caso</h2>
            {caseInfo ? (
              <CaseInfoPanel caseInfo={caseInfo} />
            ) : (
              <div className="text-sm text-slate-400 bg-slate-50 rounded-xl p-4 text-center">
                El caso aparecerá aquí cuando se radique.
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Ayuda rápida</h2>
            <div className="space-y-2 text-xs text-slate-500">
              <p>• Puedes adjuntar documentos con el ícono de clip</p>
              <p>• El asistente te guiará para completar tu solicitud</p>
              <p>• Guarda tu radicado para hacer seguimiento</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar el skeleton de carga en `page.tsx`**

```typescript
import { Suspense } from "react";
import { ChatPageInner } from "./ChatPageInner";

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageSkeleton() {
  return (
    <div className="flex h-screen bg-surface-alt items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
    </div>
  );
}
```

- [ ] **Step 3: Verificar responsive**

- En móvil (< 768px): solo la columna de chat, sin panel derecho
- En desktop (≥ 768px): chat + panel derecho visible con info del caso
- El toggle Texto/Voz funciona correctamente

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/chat/ChatPageInner.tsx apps/web/src/app/chat/page.tsx
git commit -m "feat: mobile-first chat layout with case info right panel"
```

---

## Task 8: Backend admin — router y endpoints

**Files:**
- Create: `apps/api/src/pae_api/routers/admin.py`
- Modify: `apps/api/src/pae_api/config.py`
- Modify: `apps/api/src/pae_api/main.py`

- [ ] **Step 1: Añadir credenciales admin a `config.py`**

Añadir al final de la clase `Settings` (antes del `@field_validator`):

```python
    # Admin
    admin_username: str = "admin"
    admin_password: str = "change-me-in-production"
    admin_token_secret: str = "admin-token-secret-change-in-production"
```

- [ ] **Step 2: Crear `admin.py`**

```python
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_session
from ..models.pqrs import PQRSCase, PQRSEstado

router = APIRouter(prefix="/admin", tags=["admin"])


def _verify_admin(request: Request) -> None:
    """Simple token-based admin auth — checks Authorization header or cookie."""
    settings = get_settings()
    secret = settings.admin_token_secret

    # Check Authorization: Bearer <secret>
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and auth[7:] == secret:
        return

    # Check cookie
    cookie = request.cookies.get("pae_admin_token", "")
    if cookie == secret:
        return

    raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/cases")
async def list_cases(
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tipo: Optional[str] = None,
    estado: Optional[str] = None,
    area: Optional[str] = None,
    urgencia: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    _verify_admin(request)

    stmt = select(PQRSCase)
    if tipo:
        stmt = stmt.where(PQRSCase.tipo == tipo)
    if estado:
        stmt = stmt.where(PQRSCase.estado == estado)
    if area:
        stmt = stmt.where(PQRSCase.area == area)
    if urgencia:
        stmt = stmt.where(PQRSCase.urgencia == urgencia)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await session.scalar(count_stmt) or 0

    stmt = stmt.order_by(PQRSCase.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await session.exec(stmt)
    cases = result.all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "cases": [
            {
                "id": c.id,
                "radicado": c.radicado,
                "tipo": c.tipo,
                "categoria": c.categoria,
                "area": c.area,
                "urgencia": c.urgencia,
                "estado": c.estado,
                "requiere_revision_humana": c.requiere_revision_humana,
                "plazo_respuesta": c.plazo_respuesta.isoformat() if c.plazo_respuesta else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in cases
        ],
    }


@router.patch("/cases/{radicado}/status")
async def update_case_status(
    radicado: str,
    body: dict,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    _verify_admin(request)

    result = await session.exec(select(PQRSCase).where(PQRSCase.radicado == radicado))
    case = result.first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    new_estado = body.get("estado")
    if new_estado and new_estado in [e.value for e in PQRSEstado]:
        case.estado = new_estado  # type: ignore[assignment]
        await session.commit()
        return {"status": "updated", "radicado": radicado, "estado": new_estado}

    raise HTTPException(status_code=400, detail=f"Invalid estado: {new_estado}")


@router.post("/login")
async def admin_login(body: dict, request: Request):
    settings = get_settings()
    username = body.get("username", "")
    password = body.get("password", "")
    if username == settings.admin_username and password == settings.admin_password:
        return {"token": settings.admin_token_secret}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")
```

- [ ] **Step 3: Registrar el router en `main.py`**

Cambiar la línea de imports de routers:
```python
from .routers import auth, chat, files, pqrs, transcribe
from .routers import admin as admin_router
```

Y añadir dentro de `create_app()`, después de `app.include_router(transcribe.router)`:
```python
    app.include_router(admin_router.router)
```

- [ ] **Step 4: Reiniciar el backend y verificar**

```bash
cd apps/api && uv run uvicorn pae_api.main:app --reload --port 8000
```

```bash
curl -s http://localhost:8000/admin/cases -H "Authorization: Bearer admin-token-secret-change-in-production" | python3 -m json.tool
```
Esperado: `{"total": 0, "page": 1, "per_page": 20, "cases": []}` (o casos existentes)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pae_api/routers/admin.py apps/api/src/pae_api/config.py apps/api/src/pae_api/main.py
git commit -m "feat: add admin REST endpoints (list cases, update status, login)"
```

---

## Task 9: Admin auth — login page + cookie + middleware

**Files:**
- Create: `apps/web/src/app/api/admin/login/route.ts`
- Create: `apps/web/src/app/admin/login/page.tsx`
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Crear la API route de login `route.ts`**

```typescript
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const { token } = await res.json();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pae_admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
```

- [ ] **Step 2: Actualizar `middleware.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteger rutas /admin/* (excepto la página de login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("pae_admin_token");
    if (!token?.value) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 3: Crear la página de login `/admin/login/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Error de conexión. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-alt flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 text-sm">NeuronaPQRS</h1>
              <p className="text-xs text-slate-500">Panel de Administración</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder-slate-400"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 placeholder-slate-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar el flujo de autenticación**

1. Ir a `http://localhost:3000/admin` — debe redirigir a `/admin/login`
2. Ingresar con `admin` / `change-me-in-production`
3. Debe redirigir al dashboard de admin (que aún no existe — verás 404, esto es esperado)
4. Abrir DevTools → Application → Cookies → verificar que `pae_admin_token` existe

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/admin/login/route.ts apps/web/src/app/admin/login/page.tsx apps/web/src/middleware.ts
git commit -m "feat: admin auth with httpOnly cookie and protected /admin/* routes"
```

---

## Task 10: Admin dashboard principal

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/app/api/admin/cases/route.ts`

- [ ] **Step 1: Crear la API proxy route `apps/web/src/app/api/admin/cases/route.ts`**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${API_URL}/admin/cases${searchParams ? "?" + searchParams : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Crear `apps/web/src/app/admin/layout.tsx`**

```typescript
import Link from "next/link";
import { LayoutDashboard, ListChecks, LogOut } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-surface-alt">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">N</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">NeuronaPQRS</p>
              <p className="text-[10px] text-slate-500">Administración</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
          >
            <LayoutDashboard size={15} className="text-slate-500" />
            Dashboard
          </Link>
          <Link
            href="/admin?estado=abierto"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ListChecks size={15} className="text-slate-500" />
            Casos abiertos
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 w-full transition-colors"
            >
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Crear `apps/web/src/app/admin/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const URGENCIA_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-green-100 text-green-700",
};

const ESTADO_COLORS: Record<string, string> = {
  abierto: "bg-blue-100 text-blue-700",
  en_proceso: "bg-violet-100 text-violet-700",
  escalado: "bg-orange-100 text-orange-700",
  cerrado: "bg-slate-100 text-slate-600",
  resuelto_automaticamente: "bg-green-100 text-green-700",
};

interface CaseRow {
  id: number;
  radicado: string;
  tipo: string | null;
  categoria: string | null;
  area: string | null;
  urgencia: string;
  estado: string;
  requiere_revision_humana: boolean;
  plazo_respuesta: string | null;
  created_at: string;
}

interface CasesResponse {
  total: number;
  page: number;
  per_page: number;
  cases: CaseRow[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ tipo: "", estado: "", urgencia: "" });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (filters.tipo) params.set("tipo", filters.tipo);
    if (filters.estado) params.set("estado", filters.estado);
    if (filters.urgencia) params.set("urgencia", filters.urgencia);

    fetch(`/api/admin/cases?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [page, filters]);

  const metrics = data
    ? [
        { label: "Total casos", value: data.total },
        { label: "Esta página", value: data.cases.length },
        { label: "Requieren revisión", value: data.cases.filter((c) => c.requiere_revision_humana).length },
        { label: "Abiertos", value: data.cases.filter((c) => c.estado === "abierto").length },
      ]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Gestión de casos PQRS</p>
      </div>

      {/* Metrics */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metrics.map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Filtros</span>
          {[
            { key: "tipo", options: ["", "peticion", "queja", "reclamo", "sugerencia"], label: "Tipo" },
            { key: "estado", options: ["", "abierto", "en_proceso", "escalado", "cerrado"], label: "Estado" },
            { key: "urgencia", options: ["", "alta", "media", "baja"], label: "Urgencia" },
          ].map(({ key, options, label }) => (
            <select
              key={key}
              value={filters[key as keyof typeof filters]}
              onChange={(e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">{label}: todos</option>
              {options.filter(Boolean).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Radicado", "Tipo", "Categoría", "Área", "Urgencia", "Estado", "Fecha", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Cargando…</td></tr>
              ) : data?.cases.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No hay casos con estos filtros.</td></tr>
              ) : (
                data?.cases.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-slate-700">{c.radicado}</code>
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{c.tipo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.categoria ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{c.area ?? "—"}</td>
                    <td className="px-4 py-3">
                      {c.urgencia && (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${URGENCIA_COLORS[c.urgencia] ?? "bg-slate-100 text-slate-600"}`}>
                          {c.urgencia}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${ESTADO_COLORS[c.estado] ?? "bg-slate-100 text-slate-600"}`}>
                        {c.estado.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/cases/${c.radicado}`}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > data.per_page && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Mostrando {(page - 1) * data.per_page + 1}–{Math.min(page * data.per_page, data.total)} de {data.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.per_page >= data.total}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar el dashboard**

1. Ir a `http://localhost:3000/admin`
2. Verificar que la tabla de casos se carga
3. Probar los filtros de tipo, estado y urgencia
4. Verificar que la paginación funciona si hay más de 20 casos

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/ apps/web/src/app/api/admin/
git commit -m "feat: admin dashboard with case table, filters, and pagination"
```

---

## Task 11: Admin — vista de caso individual

**Files:**
- Create: `apps/web/src/app/admin/cases/[radicado]/page.tsx`
- Create: `apps/web/src/app/api/admin/cases/[radicado]/route.ts`

- [ ] **Step 1: Crear la API proxy route para caso individual**

`apps/web/src/app/api/admin/cases/[radicado]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ radicado: string }> }
) {
  const { radicado } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("pae_admin_token")?.value ?? "";
  const body = await request.json();

  const res = await fetch(`${API_URL}/admin/cases/${radicado}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 2: Crear la página de detalle**

`apps/web/src/app/admin/cases/[radicado]/page.tsx`:

```typescript
"use client";

import { useState, use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const ESTADOS = ["abierto", "en_proceso", "escalado", "cerrado"];

export default function AdminCaseDetail({ params }: { params: Promise<{ radicado: string }> }) {
  const { radicado } = use(params);
  const [estado, setEstado] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleStatusChange(newEstado: string) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/cases/${radicado}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: newEstado }),
      });
      if (res.ok) {
        setEstado(newEstado);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{radicado}</h1>
          <p className="text-sm text-slate-500">Detalle del caso</p>
        </div>
      </div>

      {/* Status changer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Actualizar estado</h2>
        <div className="flex gap-2 flex-wrap">
          {ESTADOS.map((e) => (
            <button
              key={e}
              onClick={() => handleStatusChange(e)}
              disabled={saving || estado === e}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border capitalize ${
                estado === e
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {e.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {saved && <p className="text-xs text-green-600 mt-2">✓ Estado actualizado</p>}
        {saving && <p className="text-xs text-slate-400 mt-2">Guardando…</p>}
      </div>

      {/* Links */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Acciones</h2>
        <div className="space-y-2">
          <Link
            href={`/r/${radicado}`}
            target="_blank"
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver página pública del caso →
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

1. En el dashboard, hacer clic en "Ver →" de cualquier caso
2. Verificar que carga la página de detalle con el radicado correcto
3. Cambiar el estado y verificar que la API responde con 200

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/cases/ apps/web/src/app/api/admin/cases/
git commit -m "feat: admin case detail page with status updater"
```

---

## Task 12: Reconstruir el vault Obsidian desde cero

**Files:**
- Modify: `infra/seed_vault.py`

**⚠️ ADVERTENCIA:** Este task borra `20-Casos/` y `50-Usuarios/` completamente. Verificar que hay backup o que los datos son de prueba antes de ejecutar.

- [ ] **Step 1: Verificar qué hay en el vault ahora**

```bash
ls /Users/whoamy/Documents/PAE-Agente/Neurona/20-Casos/
ls /Users/whoamy/Documents/PAE-Agente/Neurona/50-Usuarios/
```

- [ ] **Step 2: Borrar casos y usuarios de prueba**

```bash
rm -f /Users/whoamy/Documents/PAE-Agente/Neurona/20-Casos/*.md
rm -f /Users/whoamy/Documents/PAE-Agente/Neurona/50-Usuarios/*.md
```

- [ ] **Step 3: Reemplazar `infra/seed_vault.py` completamente**

```python
#!/usr/bin/env python3
"""
Seed script para NeuronaPQRS vault.
Ejecutar desde la raíz del proyecto:
  python infra/seed_vault.py

Crea la estructura limpia de carpetas y archivos semilla.
NO borra casos ni usuarios existentes (hace eso manualmente antes si necesario).
"""

from __future__ import annotations
import os
from pathlib import Path

VAULT_ROOT = Path(__file__).parents[1] / "Neurona"

FOLDERS = [
    "00-Inbox",
    "10-Catalogo/Academico",
    "10-Catalogo/Administrativo",
    "20-Casos",
    "30-Conocimiento/Legal",
    "30-Conocimiento/Institucional",
    "30-Conocimiento/Procedimientos",
    "40-Plantillas",
    "50-Usuarios",
    "60-Metricas/mensual",
    "90-Sistema/Runbooks",
]

SEED_FILES: dict[str, str] = {
    # ── Catálogo tipos ─────────────────────────────────────────────────────────
    "10-Catalogo/Tipos.md": """---
tags: [catalogo, tipos]
---

# Tipos de PQRS

| Tipo | Descripción | Plazo |
|---|---|---|
| Petición | Solicitud de información, documentos o servicios | 15 días hábiles |
| Queja | Inconformidad con la atención o conducta | 15 días hábiles |
| Reclamo | Exigencia de revisión o corrección | 15 días hábiles |
| Sugerencia | Propuesta de mejora institucional | Acuse en 15 días hábiles |

Base legal: Ley 1755 de 2015 — Derecho de Petición.
""",

    # ── Categorías académicas ──────────────────────────────────────────────────
    "10-Catalogo/Academico/Reclamo-Nota.md": """---
categoria: Reclamo-Nota
tipo: reclamo
area: Registro Académico
plazo_dias: 15
required_fields_extra: [asignatura, docente, periodo_academico, nota_reclamada]
tags: [catalogo, academico, reclamo]
---

# Reclamo de Nota

Solicitud de revisión de una calificación académica.

## Campos requeridos
- `asignatura`: nombre de la materia
- `docente`: nombre del profesor
- `periodo_academico`: ej. 2026-1
- `nota_reclamada`: calificación cuestionada
""",

    "10-Catalogo/Academico/Certificado-Academico.md": """---
categoria: Certificado-Academico
tipo: peticion
area: Registro Académico
plazo_dias: 5
required_fields_extra: [tipo_certificado, destino]
auto_resolve: true
tags: [catalogo, academico, peticion]
---

# Certificado Académico

Solicitud de certificados de notas, matrícula, graduación o asistencia.

## Campos requeridos
- `tipo_certificado`: notas | matricula | graduacion | asistencia
- `destino`: uso del documento (becas, visa, laboral, etc.)
""",

    "10-Catalogo/Academico/Homologacion.md": """---
categoria: Homologacion
tipo: peticion
area: Registro Académico
plazo_dias: 15
required_fields_extra: [asignaturas_homologar, institucion_origen]
tags: [catalogo, academico, peticion]
---

# Homologación de Materias

Solicitud de reconocimiento de materias cursadas en otra institución.
""",

    "10-Catalogo/Administrativo/Servicios-TI.md": """---
categoria: Servicios-TI
tipo: peticion
area: Dirección de TI
plazo_dias: 3
required_fields_extra: [sistema_afectado, descripcion_problema]
auto_resolve: true
tags: [catalogo, administrativo, ti]
---

# Servicios de Tecnología

Soporte técnico, credenciales, acceso a sistemas, correo institucional.

## Campos requeridos
- `sistema_afectado`: nombre del sistema o plataforma
- `descripcion_problema`: descripción del inconveniente
""",

    "10-Catalogo/Administrativo/Biblioteca.md": """---
categoria: Biblioteca
tipo: peticion
area: Biblioteca
plazo_dias: 2
required_fields_extra: [servicio_solicitado]
auto_resolve: true
tags: [catalogo, administrativo, biblioteca]
---

# Servicios de Biblioteca

Préstamo, renovación, reserva de salas, acceso a bases de datos.
""",

    "10-Catalogo/Administrativo/Financiero-Cartera.md": """---
categoria: Financiero-Cartera
tipo: reclamo
area: Cartera y Tesorería
plazo_dias: 15
required_fields_extra: [concepto_cobro, monto, periodo]
tags: [catalogo, administrativo, financiero]
---

# Reclamo Financiero

Inconformidades con cobros, descuentos, becas o pagos de matrícula.
""",

    "10-Catalogo/Administrativo/Bienestar.md": """---
categoria: Bienestar
tipo: peticion
area: Bienestar Universitario
plazo_dias: 5
required_fields_extra: [servicio_bienestar]
tags: [catalogo, administrativo, bienestar]
---

# Servicios de Bienestar

Subsidios, apoyo psicológico, deportes, cultura, salud estudiantil.
""",

    # ── Conocimiento legal ─────────────────────────────────────────────────────
    "30-Conocimiento/Legal/Ley-1755-2015.md": """---
tipo: normativa
tags: [legal, derecho-peticion]
---

# Ley 1755 de 2015 — Derecho de Petición

## Artículos clave

**Art. 14** — Términos para resolver:
- Peticiones de información: **15 días hábiles**
- Peticiones de documentos: **10 días hábiles**
- Consultas: **30 días hábiles**

**Art. 16** — Peticiones incompletas:
Si la petición no reúne los requisitos, la entidad tiene **10 días hábiles** para informar al solicitante.

**Art. 20** — Desatención:
La no respuesta en los plazos legales constituye causal de mala conducta del funcionario.

## Aplicación en NeuronaPQRS
- Todo PQRS recibe radicado inmediato
- El plazo legal se calcula desde la fecha de radicación
- Se notifica al solicitante el vencimiento aproximado
""",

    # ── Conocimiento institucional ─────────────────────────────────────────────
    "30-Conocimiento/Institucional/Reglamento-Estudiantil.md": """---
tipo: reglamento
tags: [institucional, reglamento, academico]
---

# Reglamento Estudiantil

## Artículo 47 — Derecho de revisión de calificaciones

Todo estudiante tiene derecho a solicitar la revisión de una calificación dentro de los **5 días hábiles** siguientes a su publicación oficial.

El proceso:
1. Presentar solicitud escrita ante el docente o el PQRS
2. El docente tiene **3 días hábiles** para responder
3. Si no hay acuerdo, pasa al Comité de Evaluación
4. El Comité resuelve en **5 días hábiles adicionales**

## Artículo 52 — Cancelación de materias

Se puede cancelar materias hasta la semana 6 del semestre sin repercusión académica.
A partir de la semana 7, se requiere concepto del Director de Programa.
""",

    "30-Conocimiento/Institucional/Plazos-Respuesta.md": """---
tipo: procedimiento
tags: [institucional, plazos, sla]
---

# Plazos de Respuesta por Área

| Área | Tipo de caso | Plazo hábil |
|---|---|---|
| Registro Académico | Certificados | 5 días |
| Registro Académico | Reclamo nota | 15 días |
| Registro Académico | Homologación | 15 días |
| Cartera y Tesorería | Reclamo cobro | 15 días |
| Bienestar | Solicitudes | 5 días |
| Dirección de TI | Soporte técnico | 3 días |
| Biblioteca | Servicios | 2 días |
| Rectoría | Quejas graves | 15 días |

Base legal: Ley 1755/2015.
""",

    # ── Plantillas de respuesta ────────────────────────────────────────────────
    "40-Plantillas/Certificado-Academico.md": """---
categoria: Certificado-Academico
tipo: peticion
tags: [plantilla, auto-resolve]
---

Estimado/a {nombre_solicitante},

Hemos recibido su solicitud de certificado académico (tipo: **{tipo_certificado}**) registrada con el radicado **{radicado}**.

El proceso de expedición toma entre **3 y 5 días hábiles**. Le notificaremos al correo institucional registrado cuando el documento esté disponible para descarga en el portal estudiantil.

Si necesita el certificado con urgencia, puede comunicarse directamente con Registro Académico indicando su radicado.

Atentamente,
**Registro y Control Académico**
NeuronaPQRS · Sistema PQRS Institucional
""",

    "40-Plantillas/Servicios-TI.md": """---
categoria: Servicios-TI
tipo: peticion
tags: [plantilla, auto-resolve]
---

Estimado/a {nombre_solicitante},

Su solicitud de soporte técnico relacionada con **{sistema_afectado}** ha sido registrada con el radicado **{radicado}**.

Nuestro equipo de TI atenderá su requerimiento en un plazo máximo de **3 días hábiles**. Recibirá actualizaciones al correo institucional.

Si es urgente (sistema crítico caído), puede llamar a la línea de soporte: ext. 200.

Atentamente,
**Dirección de Tecnologías de la Información**
NeuronaPQRS · Sistema PQRS Institucional
""",

    "40-Plantillas/Biblioteca.md": """---
categoria: Biblioteca
tipo: peticion
tags: [plantilla, auto-resolve]
---

Estimado/a {nombre_solicitante},

Su solicitud de servicios de Biblioteca ha sido radicada bajo el número **{radicado}**.

Nuestro equipo atenderá su requerimiento en un plazo máximo de **2 días hábiles**.

Para consultas inmediatas sobre disponibilidad de material o reserva de salas, puede contactar directamente a la Biblioteca en el horario de atención (L-V 7am–8pm, S 8am–2pm).

Atentamente,
**Biblioteca Universitaria**
NeuronaPQRS · Sistema PQRS Institucional
""",

    # ── Sistema ────────────────────────────────────────────────────────────────
    "90-Sistema/Escalamiento.md": """---
tipo: sistema
tags: [sistema, escalamiento]
---

# Cola de Escalamiento

Casos que requieren revisión humana son registrados aquí por el agente Escalator.

| Radicado | Motivo | Área destino | Fecha |
|---|---|---|---|
| _(vacío — se llena automáticamente)_ | | | |

## Criterios de escalamiento
- Urgencia alta + reclamo
- Solicitudes que mencionan acciones legales
- Queja contra directivos
- Solicitudes de reposición de matrícula > 1 semestre
""",

    "90-Sistema/Runbooks/Reinicio-Agentes.md": """---
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

## Síntoma: doble respuesta en modo voz
Ver `docs/voice-system.md` sección "Known Issues".
""",

    "60-Metricas/Resumen.md": """---
tipo: metricas
actualizado: 2026-05-12
tags: [sistema, metricas]
---

# Métricas del Sistema PQRS

Este archivo se actualiza automáticamente por el agente de analytics.

## Resumen general

| Métrica | Valor |
|---|---|
| Total casos radicados | 0 |
| Resueltos automáticamente | 0 |
| Escalados a humano | 0 |
| Tiempo promedio (minutos) | — |

## Categorías más frecuentes
_(sin datos aún)_

## Estado del sistema
Sistema en producción desde 2026-05-12.
""",
}


def main() -> None:
    print(f"🌱  Seeding vault at {VAULT_ROOT}")

    # Create folders
    for folder in FOLDERS:
        path = VAULT_ROOT / folder
        path.mkdir(parents=True, exist_ok=True)
        print(f"  📁  {folder}/")

    # Write seed files
    for rel_path, content in SEED_FILES.items():
        full_path = VAULT_ROOT / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        if not full_path.exists():
            full_path.write_text(content, encoding="utf-8")
            print(f"  📝  {rel_path}")
        else:
            print(f"  ⏭️   {rel_path} (ya existe, omitido)")

    print("\n✅  Vault seeded successfully.")
    print(f"   Folders: {len(FOLDERS)}")
    print(f"   Files:   {len(SEED_FILES)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Ejecutar el seed**

```bash
cd /Users/whoamy/Documents/PAE-Agente && python infra/seed_vault.py
```

Esperado: líneas `📁` y `📝` para cada carpeta y archivo. Sin errores.

- [ ] **Step 5: Verificar la estructura**

```bash
find Neurona -name "*.md" | head -30
```

Deben aparecer las rutas `10-Catalogo/Academico/`, `30-Conocimiento/`, `40-Plantillas/`, etc.

- [ ] **Step 6: Commit**

```bash
git add infra/seed_vault.py Neurona/
git commit -m "feat: rebuild Obsidian vault from scratch with clean seed data"
```

---

## Task 13: Optimización de agentes

**Files:**
- Modify: `apps/api/src/pae_api/agents/resolver_auto.py`
- Modify: `apps/api/src/pae_api/services/openrouter.py`

- [ ] **Step 1: Expandir `AUTO_RESOLVE_CATEGORIES` en `resolver_auto.py`**

Reemplazar el bloque de constantes en las líneas 12-39:

```python
# Categories that have pre-defined Obsidian templates and can be resolved
# without an LLM call.
AUTO_RESOLVE_CATEGORIES: set[str] = {
    "Certificado-Academico",
    "Biblioteca",
    "Servicios-TI",
    "Bienestar",          # ← nuevo: usa 40-Plantillas/Bienestar.md
}

# Fallback templates used when the Obsidian note is not found.
_FALLBACK_TEMPLATES: dict[str, str] = {
    "Certificado-Academico": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Hemos recibido su solicitud de certificado académico con radicado **{radicado}**. "
        "El proceso de expedición toma entre 3 y 5 días hábiles. "
        "Le notificaremos al correo registrado cuando el documento esté disponible.\n\n"
        "Atentamente,\nRegistraduría Académica"
    ),
    "Biblioteca": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Su solicitud relacionada con Biblioteca ha sido radicada bajo el número **{radicado}**. "
        "Nuestro equipo atenderá su requerimiento en un plazo máximo de 2 días hábiles.\n\n"
        "Atentamente,\nBiblioteca Universitaria"
    ),
    "Servicios-TI": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Su solicitud de Servicios TI ha sido registrada con el radicado **{radicado}**. "
        "El equipo de soporte técnico dará respuesta dentro de 1 a 3 días hábiles.\n\n"
        "Atentamente,\nDirección de Tecnologías de la Información"
    ),
    "Bienestar": (
        "Estimado/a {nombre_solicitante},\n\n"
        "Su solicitud de servicios de Bienestar Universitario ha sido radicada bajo el número **{radicado}**. "
        "Nuestro equipo la atenderá en un plazo máximo de 5 días hábiles.\n\n"
        "Atentamente,\nBienestar Universitario"
    ),
}
```

- [ ] **Step 2: Añadir timeouts en `openrouter.py`**

Buscar el método que hace la llamada al LLM (generalmente `chat_completion` o similar). Añadir `timeout=10.0` a la llamada `httpx.AsyncClient`. Si ya usa `httpx`, añadir `timeout` al cliente.

Primero, ver el archivo:

```bash
cat apps/api/src/pae_api/services/openrouter.py | head -80
```

Luego, en la instanciación del cliente `AsyncClient` o en la llamada `post()`, añadir `timeout=httpx.Timeout(10.0, connect=5.0)`. El patrón exacto depende del código actual. El objetivo es que ninguna llamada a OpenRouter espere más de 10 segundos.

Si el cliente se instancia en el constructor:
```python
self._client = httpx.AsyncClient(
    base_url=self.base_url,
    timeout=httpx.Timeout(10.0, connect=5.0),  # ← añadir
    headers={"Authorization": f"Bearer {self.api_key}"},
)
```

Si el timeout ya existe y es mayor, reducir a 10.0.

- [ ] **Step 3: Verificar que el sistema sigue funcionando**

```bash
cd apps/api && uv run uvicorn pae_api.main:app --reload --port 8000
```

Enviar una solicitud de certificado académico desde `/chat`. El sistema debe resolverse **sin llamada LLM** (solo `resolver_auto`) y el radicado debe generarse más rápido que antes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/pae_api/agents/resolver_auto.py apps/api/src/pae_api/services/openrouter.py
git commit -m "perf: expand resolver_auto categories and add LLM call timeouts"
```

---

## Auto-revisión del plan

### Cobertura del spec
| Requisito del spec | Task que lo implementa |
|---|---|
| Bug TTS doble | Task 1 |
| Bugs voz restantes | Task 2 |
| Sistema de diseño light | Task 3 |
| Landing rediseñada | Task 4 |
| Chat componentes light | Tasks 5, 6 |
| Layout mobile-first | Task 7 |
| Endpoints admin backend | Task 8 |
| Admin auth | Task 9 |
| Dashboard admin con tabla | Task 10 |
| Vista caso admin | Task 11 |
| Vault desde cero | Task 12 |
| resolver_auto expandido | Task 13 |
| Timeouts agentes | Task 13 |

### Consistencia de tipos
- `Message.ttsPlayed?: boolean` definido en Task 1 (`MessageBubble.tsx`) y usado en Task 1 (`ChatStream.tsx`) — coherente
- `VoiceInputState` extiende con `"error"` en Task 2 (`useVoiceInput.ts`) y renderizado en Task 6 (`ChatStream.tsx`) — coherente
- `CaseRow` definida en Task 10 y usada solo en Task 10 — coherente
- `PQRSEstado` del modelo SQLModel usado directamente en `admin.py` Task 8 — coherente

### Sin placeholders
- Todos los steps tienen código completo o comandos exactos
- No hay "TBD", "TODO" ni "similar al anterior"
