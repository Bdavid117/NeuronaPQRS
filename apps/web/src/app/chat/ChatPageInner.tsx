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
      <h3 className="font-semibold text-xs uppercase tracking-widest text-slate-500 mb-3">Información del caso</h3>
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

  const [sessionId, setSessionId] = useState<string>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("pae_session_id") ?? uuidv4()
      : uuidv4()
  );
  const sessionIdRef = useRef(sessionId);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pae_session_id");
    if (!stored) {
      localStorage.setItem("pae_session_id", sessionId);
    } else if (stored !== sessionId) {
      setSessionId(stored);
      sessionIdRef.current = stored;
    }
    sessionIdRef.current = sessionId;
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
        type HistoryItem = { sessionId: string; radicado: string; title: string; date: string; requiresHuman: boolean };
        const prev = JSON.parse(localStorage.getItem("pae_history") ?? "[]");
        const prevSafe: HistoryItem[] = Array.isArray(prev) ? prev : [];
        const updated = [item, ...prevSafe.filter((h) => h.sessionId !== sessionIdRef.current)].slice(0, 20);
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
          <Link href="/" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors" aria-label="Volver al inicio">
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
