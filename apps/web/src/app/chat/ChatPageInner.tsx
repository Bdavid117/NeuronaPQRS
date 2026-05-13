"use client";

import { type CaseInfo, ChatStream } from "@/components/chat/ChatStream";
import { ChatSidebar, type HistoryItem } from "@/components/chat/ChatSidebar";
import { RightPanel } from "@/components/chat/RightPanel";
import { cn } from "@/lib/utils";
import { Keyboard, Mic } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export function ChatPageInner() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? undefined;

  // Start with a stable placeholder — localStorage is read in useEffect to avoid hydration mismatch
  const [sessionId, setSessionId] = useState<string>(uuidv4);
  const sessionIdRef = useRef(sessionId);

  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string>("Nueva consulta");
  const [chatKey, setChatKey] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userName, setUserName] = useState("Anónimo");

  // Read localStorage after mount — avoids SSR/client hydration mismatch
  useEffect(() => {
    const storedId = localStorage.getItem("pae_session_id");
    const id = storedId ?? sessionId;
    if (!storedId) localStorage.setItem("pae_session_id", id);
    if (id !== sessionId) {
      setSessionId(id);
      sessionIdRef.current = id;
    }

    try {
      const h = JSON.parse(localStorage.getItem("pae_history") ?? "[]");
      setHistory(h);
    } catch { /* noop */ }

    try {
      const u = JSON.parse(localStorage.getItem("pae_user") ?? "{}");
      if (u.name) setUserName(u.name as string);
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCaseUpdate = useCallback((info: CaseInfo) => {
    setCaseInfo(info);
    if (info.tipo) {
      setSessionTitle(
        info.tipo.charAt(0).toUpperCase() + info.tipo.slice(1) + " — " + info.radicado
      );
    }
    if (info.radicado) {
      setHistory((prev) => {
        const sid = sessionIdRef.current;
        const item: HistoryItem = {
          sessionId: sid,
          radicado: info.radicado,
          title: info.tipo
            ? `${info.tipo.charAt(0).toUpperCase()}${info.tipo.slice(1)}${info.categoria ? " · " + info.categoria : ""}`
            : "Consulta PQRS",
          date: new Date().toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          requiresHuman: info.requiresHuman,
        };
        const updated = [item, ...prev.filter((h) => h.sessionId !== sid)].slice(0, 20);
        localStorage.setItem("pae_history", JSON.stringify(updated));
        return updated;
      });
    }
  }, []);

  const handleAgentChange = useCallback((agentName: string) => {
    setActiveAgent(agentName);
    setCompletedAgents((prev) => {
      const STEP_ORDER = ["classifier", "intake", "resolver", "vision", "escalator"];
      const idx = STEP_ORDER.indexOf(agentName);
      if (idx <= 0) return prev;
      const newCompleted = STEP_ORDER.slice(0, idx).filter((s) => !prev.includes(s));
      return [...prev, ...newCompleted];
    });
  }, []);

  const handleNew = useCallback(() => {
    const id = uuidv4();
    localStorage.setItem("pae_session_id", id);
    setSessionId(id);
    sessionIdRef.current = id;
    setCaseInfo(null);
    setActiveAgent(null);
    setCompletedAgents([]);
    setSessionTitle("Nueva consulta");
    setChatKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-screen bg-[#0A0A0A] overflow-hidden">
      <ChatSidebar
        onNew={handleNew}
        activeSessionId={sessionId}
        history={history}
        userName={userName}
      />

      {/* Center */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#222233] bg-[#0D0D1C] flex-shrink-0">
          <span className="text-white font-semibold text-sm truncate">{sessionTitle}</span>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Voice / Text mode toggle */}
            <div className="flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setVoiceMode(false)}
                title="Modo texto"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                  !voiceMode
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/35 hover:text-white/60"
                )}
              >
                <Keyboard size={13} />
                <span className="hidden sm:inline">Texto</span>
              </button>
              <button
                onClick={() => setVoiceMode(true)}
                title="Modo voz"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
                  voiceMode
                    ? "bg-violet-500/20 text-violet-300 shadow-sm"
                    : "text-white/35 hover:text-white/60"
                )}
              >
                <Mic size={13} />
                <span className="hidden sm:inline">Voz</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-white/40">En línea</span>
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-hidden">
          <ChatStream
            key={chatKey}
            sessionId={sessionId}
            onCaseUpdate={handleCaseUpdate}
            onAgentChange={handleAgentChange}
            initialPrompt={chatKey === 0 ? initialPrompt : undefined}
            voiceMode={voiceMode}
          />
        </div>
      </div>

      <RightPanel
        caseInfo={caseInfo}
        activeAgent={activeAgent}
        completedAgents={completedAgents}
      />
    </div>
  );
}
