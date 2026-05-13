"use client";

import { AgentStatus } from "@/components/chat/AgentStatus";
import { MessageBubble, type Message } from "@/components/chat/MessageBubble";
import { PQRSCards } from "@/components/chat/PQRSCards";
import { UploadDropzone } from "@/components/chat/UploadDropzone";
import { VoiceButton } from "@/components/chat/VoiceButton";
import { useVoiceInput } from "@/lib/useVoiceInput";
import { useVoiceSynthesis } from "@/lib/useVoiceSynthesis";
import { streamChat, type AgentSwitchData, type DeltaData, type StateData } from "@/lib/sse";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock, Paperclip, Send, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export interface CaseInfo {
  radicado: string;
  tipo?: string;
  categoria?: string;
  urgencia?: string;
  plazo?: string;
  area?: string;
  requiresHuman?: boolean;
  confidence?: number;
}

const URGENCIA_COLORS: Record<string, string> = {
  alta:  "text-rose-400 bg-rose-500/10 border-rose-500/30",
  media: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  baja:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const TIPO_ICONS: Record<string, string> = {
  peticion:   "📄",
  queja:      "⚠️",
  reclamo:    "⚖️",
  sugerencia: "💡",
};

interface ChatStreamProps {
  sessionId: string;
  onCaseUpdate?: (caseInfo: CaseInfo) => void;
  onAgentChange?: (agentName: string) => void;
  initialPrompt?: string;
  voiceMode?: boolean;
}

export function ChatStream({ sessionId, onCaseUpdate, onAgentChange, initialPrompt, voiceMode = false }: ChatStreamProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "¡Hola! Soy el asistente virtual de PQRS de la institución.\n\n¿En qué puedo ayudarte hoy? Puedes presentar una **Petición**, **Queja**, **Reclamo** o **Sugerencia**.\n\nSelecciona una opción o escríbeme directamente.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<number[]>([]);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  // Keep a ref to the current AbortController so we can abort on unmount without
  // stale-closure issues. This prevents a running SSE stream from emitting events
  // (and calling onCaseUpdate/onAgentChange) after "Nueva consulta" replaces us.
  const abortControllerRef = useRef<AbortController | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Abort any running SSE stream when this instance unmounts (e.g. "Nueva consulta").
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Voice I/O
  const tts = useVoiceSynthesis();
  const voice = useVoiceInput({
    onResult: (transcript) => {
      sendMessageRef.current(transcript);
    },
  });

  // Stable ref for tts.speak so it's safe to omit from useEffect deps
  const speakRef = useRef(tts.speak);
  speakRef.current = tts.speak;

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
      !lastCurr?.ttsPlayed
    ) {
      speakRef.current(lastCurr.content);
      setMessages((prev) =>
        prev.map((m) => (m.id === lastCurr.id ? { ...m, ttsPlayed: true } : m))
      );
    }
    prevMessagesRef.current = curr;
  }, [messages, voiceMode]);

  // Auto-restart microphone after TTS finishes (voice conversation loop)
  const prevIsSpeakingRef = useRef(false);
  useEffect(() => {
    const wasSpeaking = prevIsSpeakingRef.current;
    prevIsSpeakingRef.current = tts.isSpeaking;
    if (wasSpeaking && !tts.isSpeaking && voiceMode && !isLoading) {
      voice.start();
    }
  }, [tts.isSpeaking, voiceMode, isLoading, voice.start]);

  const showCards = messages.length === 1 && !isLoading;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = { id: uuidv4(), role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setShowUpload(false);

      const assistantId = uuidv4();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", isStreaming: true },
      ]);

      const ac = new AbortController();
      abortControllerRef.current = ac;
      setAbortController(ac);

      try {
        const stream = streamChat(sessionId, text.trim(), pendingAttachments, ac.signal);
        setPendingAttachments([]);

        for await (const event of stream) {
          if (event.event === "delta") {
            const d = event.data as DeltaData;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + d.text } : m
              )
            );
          } else if (event.event === "agent_switch") {
            const d = event.data as AgentSwitchData;
            setCurrentAgent(d.agent);
            onAgentChange?.(d.agent);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, agentName: d.agent } : m
              )
            );
          } else if (event.event === "state") {
            const d = event.data as StateData;
            if (d.radicado) {
              const info: CaseInfo = {
                radicado: d.radicado,
                tipo: d.tipo,
                categoria: d.categoria,
                urgencia: d.urgencia,
                plazo: d.plazo,
                area: d.area,
                requiresHuman: d.requires_human ?? false,
                confidence: d.confidence,
              };
              setCaseInfo(info);
              onCaseUpdate?.(info);
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Lo siento, ocurrió un error. Por favor intenta de nuevo.", isStreaming: false }
                : m
            )
          );
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
        );
        setIsLoading(false);
        setCurrentAgent(null);
        abortControllerRef.current = null;
        setAbortController(null);
        inputRef.current?.focus();
      }
    },
    [isLoading, sessionId, pendingAttachments]
  );

  sendMessageRef.current = sendMessage;

  const hasSentInitialRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !hasSentInitialRef.current) {
      hasSentInitialRef.current = true;
      sendMessageRef.current(initialPrompt);
    }
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 scroll-smooth">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* PQRS quick-select cards — only on fresh session */}
        {showCards && (
          <PQRSCards onSelect={(prompt) => sendMessage(prompt)} />
        )}

        {/* Agent thinking indicator */}
        {isLoading && (
          <div className="pl-12">
            <AgentStatus agent={currentAgent} isThinking={isLoading} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Radicado banner — green (auto-resolved) or amber (requires human review) */}
      {caseInfo && (
        <div className={cn(
          "mx-4 mb-3 rounded-2xl overflow-hidden border",
          caseInfo.requiresHuman
            ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/25"
            : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/25"
        )}>
          <div className="px-4 py-3 flex items-start gap-3">
            {caseInfo.requiresHuman ? (
              <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("font-semibold text-sm", caseInfo.requiresHuman ? "text-amber-300" : "text-emerald-300")}>
                  {caseInfo.requiresHuman ? "Caso escalado para revisión humana" : "Caso radicado exitosamente"}
                </span>
                {caseInfo.urgencia && (
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border uppercase tracking-wider", URGENCIA_COLORS[caseInfo.urgencia] ?? "text-white/50 bg-white/5 border-white/10")}>
                    {caseInfo.urgencia}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <code className={cn("text-xs font-mono", caseInfo.requiresHuman ? "text-amber-400/80" : "text-emerald-400/80")}>
                  {caseInfo.radicado}
                </code>
                {caseInfo.tipo && (
                  <span className="text-xs text-white/50">
                    {TIPO_ICONS[caseInfo.tipo] ?? ""} {caseInfo.tipo}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                {caseInfo.plazo && (
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <Clock size={11} />
                    <span>{caseInfo.plazo}</span>
                  </div>
                )}
                {caseInfo.requiresHuman && (
                  <span className="text-xs text-amber-400/60">
                    Un agente revisará su caso en las próximas horas
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload area */}
      {showUpload && (
        <div className="mx-4 mb-2">
          <UploadDropzone
            sessionId={sessionId}
            onUploaded={(id) => setPendingAttachments((prev) => [...prev, id])}
          />
        </div>
      )}

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="mx-4 mb-2 flex gap-1.5 flex-wrap">
          {pendingAttachments.map((id) => (
            <span key={id} className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 rounded-full px-2.5 py-1 flex items-center gap-1.5">
              <Paperclip size={10} />
              Archivo #{id}
              <button
                onClick={() => setPendingAttachments((prev) => prev.filter((a) => a !== id))}
                className="hover:text-white transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      {voiceMode ? (
        /* ── Voice mode ── */
        <div className="px-4 pb-6 pt-2 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            {/* Stop TTS button */}
            {tts.isSpeaking && (
              <button
                onClick={tts.stop}
                className="p-2 rounded-full bg-white/10 text-white/60 hover:bg-white/15 transition-all"
                title="Silenciar respuesta"
              >
                <VolumeX size={18} />
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
                className="p-2 rounded-full bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all"
                title="Detener"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-white/35 max-w-xs px-2 leading-relaxed">
            {voice.state === "listening" && voice.interimTranscript
              ? <span className="text-white/60 italic">&ldquo;{voice.interimTranscript}&rdquo;</span>
              : voice.state === "listening"
              ? "Escuchando… toca para detener"
              : tts.isSpeaking
              ? "Reproduciendo respuesta…"
              : "Toca el micrófono para hablar"}
          </p>
        </div>
      ) : (
        /* ── Text mode ── */
        <div className="px-4 pb-4 pt-1">
          <div className={cn(
            "flex items-end gap-2 bg-white/[0.07] border border-white/15 rounded-2xl px-3 py-2.5 transition-all duration-200 shadow-lg",
            "focus-within:border-indigo-400/50 focus-within:bg-white/10 focus-within:shadow-indigo-500/10"
          )}>
            <button
              onClick={() => setShowUpload((v) => !v)}
              className={cn(
                "p-1.5 rounded-xl transition-all duration-200 flex-shrink-0",
                showUpload
                  ? "text-indigo-400 bg-indigo-400/15 scale-105"
                  : "text-white/35 hover:text-white/60 hover:bg-white/5"
              )}
              title="Adjuntar documento"
            >
              <Paperclip size={17} />
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje aquí…"
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent resize-none text-white placeholder-white/25 text-sm outline-none py-0.5 max-h-32 overflow-y-auto leading-relaxed disabled:opacity-50"
              style={{ minHeight: "1.75rem" }}
            />

            {isLoading ? (
              <button
                onClick={() => abortController?.abort()}
                className="flex-shrink-0 p-1.5 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all duration-200"
                title="Detener"
              >
                <X size={17} />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className={cn(
                  "flex-shrink-0 p-1.5 rounded-xl transition-all duration-200",
                  input.trim()
                    ? "bg-gradient-to-br from-indigo-600 to-violet-700 text-white hover:from-indigo-500 hover:to-violet-600 shadow-md shadow-indigo-500/20 scale-100 hover:scale-105"
                    : "text-white/20 cursor-not-allowed"
                )}
                title="Enviar (Enter)"
              >
                <Send size={17} />
              </button>
            )}
          </div>
          <p className="text-center text-[11px] text-white/20 mt-2 tracking-wide">
            Presiona Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      )}
    </div>
  );
}
