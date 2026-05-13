"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, MessageSquare, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryItem {
  sessionId: string;
  radicado?: string;
  title: string;
  date: string;
  requiresHuman?: boolean;
}

export function HistorialInner() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pae_history") ?? "[]";
      setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
    setMounted(true);
  }, []);

  const removeItem = (sessionId: string) => {
    const updated = history.filter((h) => h.sessionId !== sessionId);
    setHistory(updated);
    localStorage.setItem("pae_history", JSON.stringify(updated));
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.setItem("pae_history", "[]");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-[#222233] bg-[#0D0D1C] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft size={15} />
            Volver al chat
          </Link>
          <span className="text-white/15 text-sm">|</span>
          <h1 className="text-sm font-semibold text-white">Mi historial de PQRS</h1>
        </div>
        {mounted && history.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 text-xs text-rose-400/60 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={13} />
            Limpiar todo
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
        {!mounted ? null : history.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
              <Clock size={24} className="text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-white/50 text-sm font-medium">Sin historial aún</p>
              <p className="text-white/25 text-xs mt-1">
                Tus casos radicados aparecerán aquí. Solo tú puedes eliminarlos.
              </p>
            </div>
            <Link
              href="/chat"
              className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              Presentar una solicitud
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/30 uppercase tracking-widest font-medium mb-1">
              {history.length} {history.length === 1 ? "caso" : "casos"} registrados
            </p>
            {history.map((item) => (
              <div
                key={item.sessionId}
                className="flex items-start gap-3 p-4 rounded-2xl border border-[#222233] bg-[#0D0D1C] hover:border-[#333355] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={15} className="text-white/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{item.title}</span>
                    {item.requiresHuman && (
                      <span className="flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wide flex-shrink-0">
                        <AlertTriangle size={9} />
                        Revisión humana
                      </span>
                    )}
                  </div>
                  {item.radicado && (
                    <p className="text-xs text-violet-400/70 font-mono mt-0.5">{item.radicado}</p>
                  )}
                  <p className="text-[11px] text-white/25 mt-1">{item.date}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.radicado && (
                    <Link
                      href={`/r/${item.radicado}`}
                      className="text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors px-2.5 py-1 rounded-lg border border-violet-500/20 hover:border-violet-500/40"
                    >
                      Ver caso
                    </Link>
                  )}
                  <button
                    onClick={() => removeItem(item.sessionId)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/25 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Eliminar del historial"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
