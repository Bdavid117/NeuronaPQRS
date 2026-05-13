import { AgoraLogo } from "@/components/AgoraLogo";
import { AlertTriangle, ChevronLeft, FileText } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ radicado: string }>;
}

interface CaseData {
  radicado: string;
  tipo?: string;
  categoria?: string;
  area?: string;
  urgencia?: string;
  estado?: string;
  plazo_respuesta?: string;
  created_at?: string;
  updated_at?: string;
  attachments?: Array<{ id: number; filename: string }>;
}

async function getCaseStatus(radicado: string): Promise<CaseData | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/pqrs/${radicado}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const ESTADO_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  abierto:    { label: "Abierto",    dot: "bg-blue-400",   badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  en_proceso: { label: "En proceso", dot: "bg-violet-400", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  escalado:   { label: "Escalado",   dot: "bg-amber-400",  badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  cerrado:    { label: "Cerrado",    dot: "bg-emerald-400",badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
};

const URGENCIA_BADGE: Record<string, string> = {
  alta:  "bg-rose-500/15 text-rose-400 border-rose-500/30",
  media: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  baja:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateOffset(iso: string, offsetMs: number) {
  return new Date(new Date(iso).getTime() + offsetMs).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RadicadoPage({ params }: PageProps) {
  const { radicado } = await params;
  const data = await getCaseStatus(radicado);

  const estadoCfg = data?.estado ? (ESTADO_CONFIG[data.estado] ?? ESTADO_CONFIG["abierto"]) : null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0D0D1C] border-b border-white/[0.08]">
        <div className="max-w-[1440px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgoraLogo size="sm" className="brightness-0 invert" />
          </div>
          <nav className="hidden md:flex items-center gap-7">
            <Link href="/" className="text-white/45 text-sm hover:text-white/70 transition-colors">
              Inicio
            </Link>
            <Link href="/dashboard" className="text-white/45 text-sm hover:text-white/70 transition-colors">
              Mis solicitudes
            </Link>
            <span className="text-violet-400 text-sm font-medium">Estado</span>
            <Link href="#" className="text-white/45 text-sm hover:text-white/70 transition-colors">
              Contacto
            </Link>
          </nav>
          <Link
            href="/chat"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
          >
            Nueva solicitud
          </Link>
        </div>
      </header>

      {!data ? (
        <NotFound radicado={radicado} />
      ) : (
        <>
          {/* Case header */}
          <div className="bg-[#0D0D1C] border-b border-white/[0.08] px-8 py-5">
            <div className="max-w-[1440px] mx-auto flex items-start justify-between gap-4 flex-wrap">
              <div>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors mb-2"
                >
                  <ChevronLeft size={13} />
                  Mis solicitudes
                </Link>
                <h1 className="text-white font-bold text-[22px] font-mono">{data.radicado}</h1>
                {(data.tipo || data.categoria || data.area) && (
                  <p className="text-white/40 text-sm mt-0.5 capitalize">
                    {[data.tipo, data.categoria, data.area].filter(Boolean).join(" — ")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {estadoCfg && (
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${estadoCfg.badge}`}>
                    <span className={`w-2 h-2 rounded-full ${estadoCfg.dot}`} />
                    {estadoCfg.label}
                  </span>
                )}
                {data.plazo_respuesta && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-white/50 text-sm">
                    Vence: {formatDate(data.plazo_respuesta)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 max-w-[1440px] mx-auto w-full">
            {/* Left: Timeline */}
            <div className="flex-1 px-8 py-8 min-w-0">
              <h2 className="text-white font-bold text-base mb-6">Línea de tiempo</h2>
              <TimelineList data={data} />
            </div>

            {/* Right: Details */}
            <aside className="w-[340px] flex-shrink-0 border-l border-[#222233] bg-[#0D0D1C] px-6 py-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-4">
                Detalles del caso
              </p>
              <div className="bg-[#0A0A18] border border-[#222233] rounded-xl overflow-hidden mb-6">
                <DetailRow label="Tipo" value={data.tipo ?? "—"} valueClass="text-blue-300 capitalize" />
                <div className="border-t border-[#222233]" />
                <DetailRow label="Área" value={data.area ?? "—"} />
                <div className="border-t border-[#222233]" />
                <DetailRow label="Radicado" value={data.radicado} valueClass="text-violet-300 font-mono text-xs" />
                <div className="border-t border-[#222233]" />
                <DetailRow label="Vence" value={formatDate(data.plazo_respuesta)} />
                {data.urgencia && (
                  <>
                    <div className="border-t border-[#222233]" />
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[12px] text-white/40">Urgencia</span>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wide ${
                          URGENCIA_BADGE[data.urgencia] ?? "bg-white/5 text-white/50 border-white/10"
                        }`}
                      >
                        {data.urgencia}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
                Documentos adjuntos
              </p>
              {(!data.attachments || data.attachments.length === 0) ? (
                <p className="text-white/25 text-sm italic">Sin adjuntos</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                      <FileText size={14} className="text-white/40 flex-shrink-0" />
                      <span className="text-xs text-white/60 truncate">{att.filename}</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="mt-6 w-full py-2.5 rounded-xl border border-violet-500/30 text-violet-400 text-sm font-semibold hover:bg-violet-500/10 transition-all duration-200">
                Descargar expediente
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function TimelineList({ data }: { data: CaseData }) {
  const isCerrado = data.estado === "cerrado";
  const isInProgress = data.estado === "en_proceso" || data.estado === "escalado";

  const items = [
    {
      title: "Caso radicado",
      date: data.created_at ? formatDateOffset(data.created_at, 0) : "—",
      description: "Tu PQRS fue recibida y registrada en el sistema.",
      dotClass: "bg-emerald-400",
      show: true,
    },
    {
      title: "Clasificado por IA",
      date: data.created_at ? formatDateOffset(data.created_at, 60_000) : "—",
      description: `El agente identificó tu caso como ${data.tipo ?? "solicitud"}.`,
      dotClass: "bg-emerald-400",
      show: Boolean(data.tipo),
    },
    {
      title: `En revisión${data.area ? ` — ${data.area}` : ""}`,
      date: data.updated_at ? formatDateOffset(data.updated_at, 0) : "—",
      description: "Tu solicitud está siendo analizada por el equipo responsable.",
      dotClass: "bg-violet-400",
      show: isInProgress,
    },
    {
      title: "Respuesta emitida",
      date: "Pendiente",
      description: "Se emitirá una respuesta formal a tu solicitud.",
      dotClass: "bg-white/20",
      show: true,
      dimmed: !isCerrado,
    },
  ].filter((item) => item.show);

  return (
    <div className="flex flex-col">
      {items.map((item, idx) => (
        <div key={idx} className={`flex gap-4 ${item.dimmed ? "opacity-35" : ""}`}>
          {/* Dot + connector */}
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${item.dotClass}`} />
            {idx < items.length - 1 && (
              <div className="w-px flex-1 bg-white/10 my-1" style={{ minHeight: "40px" }} />
            )}
          </div>
          {/* Content */}
          <div className="pb-6">
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="text-white font-semibold text-sm">{item.title}</p>
              <p className="text-white/30 text-xs">{item.date}</p>
            </div>
            <p className="text-white/45 text-sm mt-1 leading-relaxed">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailRow({
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
      <span className={`text-[12px] font-medium text-white/70 ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

function NotFound({ radicado }: { radicado: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle size={40} className="text-amber-400/60" />
        <h2 className="text-white font-semibold text-lg">Radicado no encontrado</h2>
        <p className="text-white/40 text-sm max-w-xs">
          No existe ningún caso con el radicado{" "}
          <code className="text-violet-400 font-mono">{radicado}</code>.
        </p>
      </div>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
