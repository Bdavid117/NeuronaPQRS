import {
  AlertTriangle,
  FileText,
  Lightbulb,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const PQRS_TYPES = [
  {
    key: "peticion",
    label: "Petición",
    description: "Solicita información, documentos, certificados o acciones administrativas.",
    icon: FileText,
    iconColor: "text-blue-500",
    borderColor: "border-blue-500/30",
    prompt: "Quiero radicar una petición",
  },
  {
    key: "queja",
    label: "Queja",
    description: "Reporta inconformidad con la atención o el comportamiento de un funcionario.",
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    borderColor: "border-orange-500/30",
    prompt: "Quiero radicar una queja",
  },
  {
    key: "reclamo",
    label: "Reclamo",
    description: "Exige la corrección de una nota, proceso académico o trámite institucional.",
    icon: XCircle,
    iconColor: "text-rose-500",
    borderColor: "border-rose-500/30",
    prompt: "Quiero radicar un reclamo",
  },
  {
    key: "sugerencia",
    label: "Sugerencia",
    description: "Propón mejoras a los servicios, procesos o recursos de la institución.",
    icon: Lightbulb,
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500/30",
    prompt: "Quiero radicar una sugerencia",
  },
] as const;

const STATS = [
  { value: "3.200+", label: "Casos radicados", valueColor: "text-violet-400" },
  { value: "98%", label: "Resueltos a tiempo", valueColor: "text-emerald-400" },
  { value: "< 2 min", label: "Tiempo de respuesta IA", valueColor: "text-blue-400" },
  { value: "24/7", label: "Disponibilidad", valueColor: "text-orange-400" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0D0D1C] border-b border-white/[0.08]">
        <div className="max-w-[1440px] mx-auto px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}
            />
            <span className="text-white font-bold text-sm tracking-tight">NeuronaPQRS</span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-7">
            <span className="text-violet-400 text-sm font-medium">Inicio</span>
            <Link href="/dashboard" className="text-white/45 text-sm hover:text-white/70 transition-colors">
              Mis solicitudes
            </Link>
            <Link href="/login" className="text-white/45 text-sm hover:text-white/70 transition-colors">
              Acceder
            </Link>
          </nav>

          {/* CTA */}
          <Link
            href="/chat"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
          >
            Nueva solicitud
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
          <span className="text-violet-400 text-sm font-medium">Sistema de PQRS Universitario</span>
        </div>

        {/* H1 */}
        <h1 className="max-w-3xl">
          <span className="block text-white font-bold" style={{ fontSize: "52px", lineHeight: 1.1 }}>
            Tu voz es importante.
          </span>
          <span
            className="block font-bold"
            style={{
              fontSize: "52px",
              lineHeight: 1.1,
              background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Radica y rastrea tu PQRS en segundos.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-white/55 max-w-xl" style={{ fontSize: "18px" }}>
          Peticiones, quejas, reclamos y sugerencias atendidos por IA las 24 horas del día.
        </p>

        {/* Buttons */}
        <div className="mt-10 flex items-center gap-4 flex-wrap justify-center">
          <Link
            href="/chat"
            className="px-7 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg shadow-violet-500/20"
            style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}
          >
            Iniciar solicitud
          </Link>
          <Link
            href="/dashboard"
            className="px-7 py-3 rounded-xl text-sm font-semibold text-white/70 bg-white/5 border border-white/15 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            Ver mis casos
          </Link>
        </div>
      </section>

      {/* PQRS Type Cards */}
      <section className="px-10 pb-20 bg-[#0A0A0A]">
        <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-6">
          ¿Qué necesitas radicar?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1440px] mx-auto">
          {PQRS_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Link
                key={type.key}
                href={`/chat?prompt=${encodeURIComponent(type.prompt)}`}
                className={`group flex flex-col gap-4 p-5 rounded-xl bg-[#0D0D1C] border ${type.borderColor} hover:border-opacity-70 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30`}
              >
                <Icon size={28} className={type.iconColor} />
                <div>
                  <p className="text-white font-semibold text-base mb-1">{type.label}</p>
                  <p className="text-white/45 text-sm leading-relaxed">{type.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[#0D0D1C] border-t border-white/[0.07] py-10">
        <div className="max-w-[1440px] mx-auto px-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
              <span className={`text-3xl font-bold ${stat.valueColor}`}>{stat.value}</span>
              <span className="text-white/40 text-sm">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-white/20 border-t border-white/[0.05] tracking-wide bg-[#0A0A0A]">
        NeuronaPQRS · Sistema PQRS Institucional · Ley 1755 de 2015
      </footer>
    </div>
  );
}
