"use client";

import { cn } from "@/lib/utils";

const FLOW: Array<{ key: string; label: string; color: string; glow: string }> = [
  { key: "intake",     label: "Recepción",    color: "bg-blue-500",    glow: "shadow-blue-500/40" },
  { key: "classifier", label: "Clasificación",color: "bg-violet-500",  glow: "shadow-violet-500/40" },
  { key: "vision",     label: "Documentos",   color: "bg-amber-500",   glow: "shadow-amber-500/40" },
  { key: "resolver",   label: "Resolución",   color: "bg-emerald-500", glow: "shadow-emerald-500/40" },
  { key: "escalator",  label: "Escalamiento", color: "bg-rose-500",    glow: "shadow-rose-500/40" },
];

const DESCRIPTIONS: Record<string, string> = {
  intake:     "Recolectando información…",
  classifier: "Clasificando tu solicitud…",
  vision:     "Analizando documentos adjuntos…",
  resolver:   "Consultando la base de conocimiento…",
  escalator:  "Derivando a un funcionario…",
};

export function AgentStatus({ agent, isThinking }: { agent: string | null; isThinking: boolean }) {
  if (!isThinking) return null;

  const currentIdx = FLOW.findIndex((s) => s.key === agent);
  const current = currentIdx >= 0 ? FLOW[currentIdx] : null;

  return (
    <div className="flex flex-col gap-2 w-fit">
      {/* Active step pill */}
      {current && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 backdrop-blur-sm border border-slate-200 dark:border-white/15 text-xs text-slate-700 dark:text-white/80 shadow-lg",
          current.glow
        )}>
          <span className={cn("w-2 h-2 rounded-full animate-pulse shadow-sm", current.color, current.glow)} />
          <span className="font-semibold">{current.label}</span>
          <span className="text-slate-400 dark:text-white/40">·</span>
          <span className="text-slate-500 dark:text-white/60">{DESCRIPTIONS[agent ?? ""] ?? "Procesando…"}</span>
        </div>
      )}

      {/* Mini step dots */}
      {currentIdx >= 0 && (
        <div className="flex items-center gap-1.5 px-1">
          {FLOW.slice(0, currentIdx + 1).map((step, i) => (
            <div key={step.key} className="flex items-center gap-1.5">
              <div className={cn(
                "rounded-full transition-all duration-300",
                i === currentIdx
                  ? cn("w-2 h-2 animate-pulse shadow-sm", step.color, step.glow)
                  : "w-1.5 h-1.5 bg-slate-300 dark:bg-white/30"
              )} />
              {i < currentIdx && (
                <div className="w-3 h-px bg-slate-200 dark:bg-white/20 rounded" />
              )}
            </div>
          ))}
        </div>
      )}

      {!current && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/10 backdrop-blur-sm border border-slate-200 dark:border-white/15 text-xs text-slate-500 dark:text-white/60">
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          <span>Procesando…</span>
        </div>
      )}
    </div>
  );
}
