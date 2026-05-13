"use client";

import { AgoraLogo } from "@/components/AgoraLogo";
import { cn } from "@/lib/utils";
import { Clock, ExternalLink, FileText, MessageSquare, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface HistoryItem {
  sessionId: string;
  radicado?: string;
  title: string;
  date: string;
}

interface CaseData {
  radicado: string;
  tipo?: string;
  categoria?: string;
  area?: string;
  urgencia?: string;
  estado?: string;
  plazo_respuesta?: string;
}

const ESTADO_BADGE: Record<string, string> = {
  abierto:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
  en_proceso: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  escalado:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  cerrado:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const ESTADO_LABEL: Record<string, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  escalado: "Escalado",
  cerrado: "Cerrado",
};

const URGENCIA_DOT: Record<string, string> = {
  alta: "bg-rose-400",
  media: "bg-amber-400",
  baja: "bg-emerald-400",
};

function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem("pae_history") ?? "[]"));
    } catch {
      setItems([]);
    }
  }, []);
  return items;
}

function useUserName() {
  const [name, setName] = useState("Anónimo");
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("pae_user") ?? "{}");
      if (u.name) setName(u.name as string);
    } catch { /* noop */ }
  }, []);
  return name;
}

async function fetchCase(radicado: string): Promise<CaseData | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/pqrs/${radicado}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const history = useHistory();
  const userName = useUserName();
  const [caseData, setCaseData] = useState<Record<string, CaseData>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (history.length === 0) { setLoading(false); return; }
    const radicados = history.filter((h) => h.radicado).map((h) => h.radicado!);
    Promise.all(radicados.map((r) => fetchCase(r).then((d) => ({ r, d })))).then((results) => {
      const map: Record<string, CaseData> = {};
      for (const { r, d } of results) {
        if (d) map[r] = d;
      }
      setCaseData(map);
      setLoading(false);
    });
  }, [history]);

  const filtered = history.filter((h) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      h.title.toLowerCase().includes(q) ||
      (h.radicado?.toLowerCase() ?? "").includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0D0D1C] border-b border-white/[0.08]">
        <div className="max-w-[1100px] mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <AgoraLogo size="sm" className="brightness-0 invert" />
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            <Link href="/" className="text-white/45 text-sm hover:text-white/70 transition-colors">
              Inicio
            </Link>
            <span className="text-violet-400 text-sm font-medium">Mis solicitudes</span>
          </nav>
          <Link
            href="/chat"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
          >
            <Plus size={14} />
            Nueva solicitud
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-white font-bold text-2xl">Mis solicitudes</h1>
            <p className="text-white/40 text-sm mt-1">
              {userName !== "Anónimo" ? `Hola, ${userName}. ` : ""}
              {history.length === 0
                ? "No tienes solicitudes registradas aún."
                : `${history.length} solicitud${history.length !== 1 ? "es" : ""} registrada${history.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {history.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por radicado o tipo…"
                className="bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all w-64"
              />
            </div>
          )}
        </div>

        {/* Content */}
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <FileText size={24} className="text-white/20" />
            </div>
            <div>
              <p className="text-white/60 font-medium">Aún no tienes solicitudes</p>
              <p className="text-white/30 text-sm mt-1">
                Cuando radiques una PQRS, aparecerá aquí para que puedas hacerle seguimiento.
              </p>
            </div>
            <Link
              href="/chat"
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
            >
              <MessageSquare size={14} />
              Radicar mi primera PQRS
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.length === 0 ? (
              <p className="text-white/30 text-sm py-8 text-center">
                No se encontraron resultados para &ldquo;{search}&rdquo;
              </p>
            ) : (
              filtered.map((item) => {
                const data = item.radicado ? caseData[item.radicado] : undefined;
                const estado = data?.estado ?? "abierto";
                return (
                  <div
                    key={item.sessionId}
                    className="bg-[#0D0D1C] border border-[#222233] rounded-xl p-5 flex items-center gap-5 hover:border-violet-500/30 transition-all duration-200"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={16} className="text-violet-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">{item.title}</p>
                        {data?.urgencia && (
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", URGENCIA_DOT[data.urgencia] ?? "bg-white/20")} title={`Urgencia: ${data.urgencia}`} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {item.radicado && (
                          <code className="text-[11px] text-violet-400/70 font-mono">{item.radicado}</code>
                        )}
                        {data?.area && (
                          <span className="text-[11px] text-white/35">{data.area}</span>
                        )}
                        <span className="text-[11px] text-white/25 flex items-center gap-1">
                          <Clock size={10} />
                          {item.date}
                        </span>
                      </div>
                    </div>

                    {/* Estado badge */}
                    {!loading && (
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wide flex-shrink-0",
                          ESTADO_BADGE[estado] ?? "bg-white/5 text-white/40 border-white/10"
                        )}
                      >
                        {ESTADO_LABEL[estado] ?? estado}
                      </span>
                    )}

                    {/* Link */}
                    {item.radicado && (
                      <Link
                        href={`/r/${item.radicado}`}
                        className="flex-shrink-0 p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                        title="Ver detalle"
                      >
                        <ExternalLink size={15} />
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-[11px] text-white/20 border-t border-white/[0.05] bg-[#0A0A0A]">
        ÁGORA · Sistema PQRS Institucional · Ley 1755 de 2015
      </footer>
    </div>
  );
}
