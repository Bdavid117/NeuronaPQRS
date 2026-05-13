"use client";

import { cn } from "@/lib/utils";
import { Clock, History, LogOut, MessageSquare, Plus, User } from "lucide-react";
import Link from "next/link";

export interface HistoryItem {
  sessionId: string;
  radicado?: string;
  title: string;
  date: string;
  requiresHuman?: boolean;
}

interface ChatSidebarProps {
  onNew: () => void;
  activeSessionId?: string;
  history?: HistoryItem[];
  userName?: string;
}

function handleLogout() {
  document.cookie = "pae_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  localStorage.removeItem("pae_user");
}

export function ChatSidebar({ onNew, activeSessionId, history = [], userName = "Anónimo" }: ChatSidebarProps) {
  return (
    <aside className="flex flex-col h-full bg-[#0D0D1C] border-r border-[#222233] w-[260px] flex-shrink-0">
      {/* Logo row */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#222233]">
        <div
          className="w-8 h-8 rounded-full flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}
        />
        <span className="text-white font-bold text-sm tracking-tight">NeuronaPQRS</span>
      </div>

      {/* New consultation button */}
      <div className="px-4 pt-4 pb-3">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
        >
          <Plus size={16} />
          Nueva consulta
        </button>
      </div>

      {/* Recents */}
      <div className="px-4 pb-2 flex-1 overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2 px-1">
          Recientes
        </p>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-2">
            <Clock size={22} className="text-white/15" />
            <p className="text-[11px] text-white/25 text-center leading-relaxed">
              Tus consultas aparecerán aquí una vez que radiques tu primera PQRS.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {history.map((item) => {
              const isActive = item.sessionId === activeSessionId;
              return (
                <button
                  key={item.sessionId}
                  onClick={onNew}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                    isActive
                      ? "border-l-2 border-violet-500 bg-violet-500/10 rounded-l-none pl-[10px]"
                      : "hover:bg-white/5 border-l-2 border-transparent rounded-l-none pl-[10px]"
                  )}
                >
                  <MessageSquare
                    size={14}
                    className={cn(
                      "flex-shrink-0 mt-0.5",
                      isActive ? "text-violet-400" : "text-white/30 group-hover:text-white/50"
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={cn(
                          "text-xs font-medium truncate",
                          isActive ? "text-white" : "text-white/50 group-hover:text-white/70"
                        )}
                      >
                        {item.title}
                      </p>
                      {item.requiresHuman && (
                        <span className="flex-shrink-0 text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-px uppercase tracking-wide">
                          Rev.
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/25 mt-0.5">{item.date}</p>
                    {item.radicado && (
                      <p className="text-[10px] text-violet-400/60 font-mono mt-0.5">{item.radicado}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* User row */}
      <div className="px-4 py-4 border-t border-[#222233] flex-shrink-0">
        <Link
          href="/historial"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/35 hover:text-white/60 hover:bg-white/5 transition-all text-xs font-medium mb-3"
        >
          <History size={13} />
          Mi historial de PQRS
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <User size={13} className="text-white/60" />
            </div>
            <span className="text-xs text-white/50 font-medium truncate max-w-[100px]">{userName}</span>
          </div>
          <Link
            href="/login"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            <LogOut size={12} />
            Salir
          </Link>
        </div>
      </div>
    </aside>
  );
}
