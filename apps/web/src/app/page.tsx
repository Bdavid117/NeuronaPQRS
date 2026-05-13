import { Clock, FileText, Shield } from "lucide-react";
import Link from "next/link";
import { AgoraLogo } from "@/components/AgoraLogo";

const PQRS_TYPES = [
  {
    key: "peticion",
    label: "Petición",
    description: "Solicita información, certificados o documentos oficiales.",
    emoji: "📄",
    prompt: "Quiero radicar una petición",
    accent: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    key: "queja",
    label: "Queja",
    description: "Reporta inconformidad con la atención o un funcionario.",
    emoji: "💬",
    prompt: "Quiero radicar una queja",
    accent: "border-orange-200 hover:border-orange-400 hover:bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
  },
  {
    key: "reclamo",
    label: "Reclamo",
    description: "Exige la revisión de una nota o trámite institucional.",
    emoji: "⚖️",
    prompt: "Quiero radicar un reclamo",
    accent: "border-red-200 hover:border-red-400 hover:bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
  {
    key: "sugerencia",
    label: "Sugerencia",
    description: "Propón mejoras a los servicios o procesos institucionales.",
    emoji: "💡",
    prompt: "Quiero radicar una sugerencia",
    accent: "border-green-200 hover:border-green-400 hover:bg-green-50",
    badge: "bg-green-100 text-green-700",
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AgoraLogo size="sm" />
          </div>
          <Link href="/admin/login" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            Administración
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 bg-surface-alt">
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-600 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-primary-100">
          <span className="w-1.5 h-1.5 bg-primary-600 rounded-full" />
          Sistema PQRS — Institución Educativa
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight max-w-2xl">
          Radica tu solicitud<br className="hidden sm:block" /> en minutos
        </h1>

        <p className="text-slate-500 text-base sm:text-lg mb-8 max-w-md">
          Nuestro asistente inteligente te guía paso a paso para registrar peticiones, quejas, reclamos y sugerencias.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-primary-700 transition-colors shadow-sm"
          >
            Iniciar solicitud
          </Link>
          <Link
            href="/historial"
            className="inline-flex items-center gap-2 bg-white text-slate-700 px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors border border-slate-200"
          >
            Ver mis casos
          </Link>
        </div>
      </section>

      {/* PQRS type cards */}
      <section className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">
          ¿Qué necesitas radicar?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PQRS_TYPES.map((type) => (
            <Link
              key={type.key}
              href={`/chat?prompt=${encodeURIComponent(type.prompt)}`}
              className={`flex flex-col gap-3 p-5 rounded-2xl bg-white border transition-all duration-200 ${type.accent}`}
            >
              <span className="text-2xl">{type.emoji}</span>
              <div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${type.badge} mb-2 inline-block`}>
                  {type.label}
                </span>
                <p className="text-slate-500 text-sm leading-relaxed">{type.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface border-t border-slate-100 px-4 sm:px-8 py-12">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Clock, title: "Respuesta en 15 días hábiles", desc: "Cumplimos con la Ley 1755/2015 de derecho de petición." },
            { icon: Shield, title: "Tus datos están protegidos", desc: "Información cifrada y acceso restringido por área responsable." },
            { icon: FileText, title: "Radicado instantáneo", desc: "Recibes tu número de caso y código QR al finalizar." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <Icon size={18} className="text-primary-600" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1">{title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        ÁGORA · Sistema PQRS Institucional · Ley 1755 de 2015
      </footer>
    </div>
  );
}
