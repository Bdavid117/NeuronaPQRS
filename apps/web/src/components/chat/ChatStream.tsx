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
import { AlertTriangle, CheckCircle2, Clock, Paperclip, QrCode, Send, Thermometer, VolumeX, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
  alta:  "text-red-700 bg-red-50 border-red-200",
  media: "text-amber-700 bg-amber-50 border-amber-200",
  baja:  "text-green-700 bg-green-50 border-green-200",
};

const TIPO_ICONS: Record<string, string> = {
  peticion:   "📄",
  queja:      "⚠️",
  reclamo:    "⚖️",
  sugerencia: "💡",
};

const FRUSTRATION_KEYWORDS = [
  "mal", "terrible", "horrible", "pésimo", "fatal", "inaceptable",
  "urgente", "urgentemente", "desesperado", "desesperante",
  "injusto", "injusticia", "abuso", "descaro", "vergüenza",
  "incompetente", "incompetencia", "molesto", "fastidio", "enojado",
  "furioso", "indignado", "harto", "cansado", "insoportable",
];

function detectFrustration(text: string): boolean {
  const lower = text.toLowerCase();
  const matches = FRUSTRATION_KEYWORDS.filter((kw) => lower.includes(kw));
  return matches.length >= 2;
}

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
        "¡Hola! Soy ÁGORA, el asistente virtual de PQRS de la institución.\n\n¿En qué puedo ayudarte hoy? Puedes presentar una **Petición**, **Queja**, **Reclamo** o **Sugerencia**.\n\nSelecciona una opción o escríbeme directamente.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<number[]>([]);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isFrustrated, setIsFrustrated] = useState(false);
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
  const { state: voiceState, start: voiceStart, stop: voiceStop, interimTranscript: voiceInterim } = useVoiceInput({
    onResult: (transcript) => {
      sendMessageRef.current(transcript);
    },
  });

  // Stable ref for tts.speak so it's safe to omit from useEffect deps
  const speakRef = useRef(tts.speak);
  speakRef.current = tts.speak;

  // Auto-speak the last assistant message when it finishes streaming (voice mode only)
  const ttsPlayedIds = useRef<Set<string>>(new Set());
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
      !ttsPlayedIds.current.has(lastCurr.id)
    ) {
      ttsPlayedIds.current.add(lastCurr.id);
      speakRef.current(lastCurr.content);
    }
    prevMessagesRef.current = curr;
  }, [messages, voiceMode]);

  // Auto-restart microphone after TTS finishes (voice conversation loop)
  const prevIsSpeakingRef = useRef(false);
  useEffect(() => {
    const wasSpeaking = prevIsSpeakingRef.current;
    prevIsSpeakingRef.current = tts.isSpeaking;
    if (wasSpeaking && !tts.isSpeaking && voiceMode && !isLoading) {
      try {
        voiceStart();
      } catch (err) {
        console.warn("ÁGORA: Failed to restart mic after TTS:", err);
      }
    }
  }, [tts.isSpeaking, voiceMode, isLoading, voiceStart]);

  // Stop microphone when switching from voice to text mode
  useEffect(() => {
    if (!voiceMode && voiceState !== "idle") {
      voiceStop();
    }
  }, [voiceMode, voiceState, voiceStop]);

  // Voice summary when case is filed (radicado appears for the first time)
  const prevRadicadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceMode) return;
    if (caseInfo?.radicado && !prevRadicadoRef.current) {
      const summary = `Tu caso ha sido radicado exitosamente con el número ${caseInfo.radicado}. ${
        caseInfo.tipo ? `Tipo: ${caseInfo.tipo}. ` : ""
      }${caseInfo.urgencia ? `Urgencia: ${caseInfo.urgencia}. ` : ""}${
        caseInfo.plazo ? `Plazo de respuesta: ${caseInfo.plazo}. ` : ""
      }Guarda tu número de radicado para dar seguimiento.`;
      speakRef.current(summary);
    }
    prevRadicadoRef.current = caseInfo?.radicado ?? null;
  }, [caseInfo, voiceMode]);

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
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 scroll-smooth bg-surface-alt">
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
                <button
                  onClick={() => setShowQR((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md px-1.5 py-0.5 bg-white hover:bg-slate-50 transition-colors"
                  title="Ver código QR"
                >
                  <QrCode size={10} />
                  QR
                </button>
              </div>
              {caseInfo.plazo && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                  <Clock size={11} />
                  <span>Plazo: {caseInfo.plazo}</span>
                </div>
              )}
              {showQR && (
                <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200 inline-block">
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/r/${caseInfo.radicado}`}
                    size={96}
                    level="M"
                  />
                  <p className="text-[9px] text-slate-400 text-center mt-1">Escanea para ver tu caso</p>
                </div>
              )}
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
                aria-label="Eliminar archivo"
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
              state={voiceState}
              onStart={voiceStart}
              onStop={voiceStop}
              disabled={isLoading || tts.isSpeaking}
            />
            {isLoading && (
              <button
                onClick={() => abortControllerRef.current?.abort()}
                className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                title="Detener"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-slate-400 max-w-xs leading-relaxed">
            {voiceState === "error"
              ? <span className="text-rose-400">Error de transcripción. Intenta de nuevo.</span>
              : voiceState === "listening" && voiceInterim
              ? <span className="text-slate-600 italic">&ldquo;{voiceInterim}&rdquo;</span>
              : voiceState === "listening"
              ? "Escuchando… toca para detener"
              : tts.isSpeaking
              ? "Reproduciendo respuesta…"
              : "Toca el micrófono para hablar"}
          </p>
        </div>
      ) : (
        /* ── Text mode ── */
        <div className="px-4 pb-4 pt-1">
          {isFrustrated && (
            <div className="mb-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <Thermometer size={14} className="flex-shrink-0" />
              <span>Detectamos que tu situación puede ser urgente. Tu caso será marcado para atención prioritaria.</span>
            </div>
          )}
          <div className={cn(
            "flex items-end gap-2 bg-white border rounded-2xl px-3 py-2.5 transition-all duration-200 shadow-sm",
            isFrustrated
              ? "border-amber-400 focus-within:border-amber-500 focus-within:shadow-md"
              : "border-slate-200 focus-within:border-primary-400 focus-within:shadow-md"
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
              onChange={(e) => {
                setInput(e.target.value);
                setIsFrustrated(detectFrustration(e.target.value));
              }}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje aquí…"
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-transparent resize-none text-slate-900 placeholder-slate-400 text-sm outline-none py-0.5 max-h-32 overflow-y-auto leading-relaxed disabled:opacity-50"
              style={{ minHeight: "1.75rem" }}
            />

            {isLoading ? (
              <button
                onClick={() => abortControllerRef.current?.abort()}
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
    </div>
  );
}
