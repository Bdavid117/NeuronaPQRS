"use client";

import { type CaseInfo } from "@/components/chat/ChatStream";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";

const AGENT_STEPS: Array<{ key: string; label: string }> = [
  { key: "classifier", label: "Clasificación" },
  { key: "intake", label: "Recolección de datos" },
  { key: "resolver", label: "Resolución" },
  { key: "vision", label: "Verificación" },
  { key: "escalator", label: "Cierre" },
];

const URGENCIA_BADGE: Record<string, string> = {
  alta:  "bg-rose-500/15 text-rose-400 border-rose-500/30",
  media: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  baja:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

interface RightPanelProps {
  caseInfo: CaseInfo | null;
  activeAgent: string | null;
  completedAgents: string[];
}

export function RightPanel({ caseInfo, activeAgent, completedAgents }: RightPanelProps) {
  return (
    <aside className="flex flex-col h-full bg-[#0D0D1C] border-l border-[#222233] w-[304px] flex-shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#222233]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">
          Caso activo
        </p>
        {caseInfo ? (
          <p className="text-white font-bold text-[15px] font-mono">{caseInfo.radicado}</p>
        ) : (
          <p className="text-white/30 text-sm italic">Sin caso activo</p>
        )}
      </div>

      {/* Metadata card */}
      <div className="px-4 py-4">
        <div className="bg-[#0A0A18] border border-[#222233] rounded-xl overflow-hidden">
          {caseInfo ? (
            <>
              <MetaRow label="Tipo" value={caseInfo.tipo ?? "—"} valueClass="text-blue-300 capitalize" />
              <div className="border-t border-[#222233]" />
              <MetaRow label="Área" value={caseInfo.area ?? "—"} valueClass="text-white/70" />
              <div className="border-t border-[#222233]" />
              <MetaRow label="Plazo" value={caseInfo.plazo ?? "—"} valueClass="text-white/70" />
              <div className="border-t border-[#222233]" />
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[12px] text-white/40">Urgencia</span>
                {caseInfo.urgencia ? (
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wide",
                      URGENCIA_BADGE[caseInfo.urgencia] ?? "bg-white/5 text-white/50 border-white/10"
                    )}
                  >
                    {caseInfo.urgencia}
                  </span>
                ) : (
                  <span className="text-white/30 text-sm">—</span>
                )}
              </div>
              {caseInfo.confidence !== undefined && (
                <>
                  <div className="border-t border-[#222233]" />
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-white/40">Confianza IA</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            caseInfo.confidence >= 0.7 ? "bg-emerald-500" : caseInfo.confidence >= 0.5 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${Math.round(caseInfo.confidence * 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-[11px] font-semibold",
                        caseInfo.confidence >= 0.7 ? "text-emerald-400" : caseInfo.confidence >= 0.5 ? "text-amber-400" : "text-rose-400"
                      )}>
                        {Math.round(caseInfo.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
              {caseInfo.requiresHuman && (
                <div className="mx-3 mb-3 mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
                  <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                  <span className="text-[11px] text-amber-300">Pendiente revisión humana</span>
                </div>
              )}
            </>
          ) : (
            <>
              <SkeletonRow />
              <div className="border-t border-[#222233]" />
              <SkeletonRow />
              <div className="border-t border-[#222233]" />
              <SkeletonRow />
              <div className="border-t border-[#222233]" />
              <SkeletonRow />
            </>
          )}
        </div>
      </div>

      {/* Agent progress */}
      <div className="px-4 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
          Progreso del agente
        </p>
        <div className="flex flex-col gap-0.5">
          {AGENT_STEPS.map((step) => {
            const isDone = completedAgents.includes(step.key);
            const isActive = activeAgent === step.key && !isDone;
            const isPending = !isDone && !isActive;

            return (
              <div key={step.key} className="flex items-center gap-3 py-1.5 px-2">
                {isDone ? (
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                ) : isActive ? (
                  <div className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse block" />
                  </div>
                ) : (
                  <Circle size={14} className="text-white/20 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    isDone && "text-emerald-400",
                    isActive && "text-violet-300 font-semibold",
                    isPending && "text-white/30"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* CTA */}
      <div className="px-4 py-4 border-t border-[#222233]">
        {caseInfo ? (
          <Link
            href={`/r/${caseInfo.radicado}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          >
            <ExternalLink size={14} />
            Ver resumen completo
          </Link>
        ) : (
          <button
            disabled
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white/20 bg-white/5 cursor-not-allowed"
          >
            <ExternalLink size={14} />
            Ver resumen completo
          </button>
        )}
      </div>
    </aside>
  );
}

function MetaRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[12px] text-white/40">{label}</span>
      <span className={cn("text-[12px] font-medium", valueClass)}>{value}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="h-3 w-12 rounded bg-white/[0.08] animate-pulse" />
      <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
    </div>
  );
}
