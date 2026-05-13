"use client";

import { FileText, MessageSquareWarning, Scale, Lightbulb, ArrowRight } from "lucide-react";

const TYPES = [
  {
    key: "peticion",
    label: "Petición",
    icon: FileText,
    gradient: "from-blue-600/20 to-blue-800/20",
    border: "border-blue-500/30",
    iconColor: "text-blue-400",
    hoverBorder: "hover:border-blue-400/60",
    examples: [
      "Necesito un certificado de estudios o matrícula",
      "Quiero solicitar información sobre un trámite",
      "Requiero un paz y salvo o constancia",
    ],
    prompt:
      "Hola, necesito hacer una petición. Me gustaría que me orientaras sobre el proceso.",
  },
  {
    key: "queja",
    label: "Queja",
    icon: MessageSquareWarning,
    gradient: "from-amber-600/20 to-amber-800/20",
    border: "border-amber-500/30",
    iconColor: "text-amber-400",
    hoverBorder: "hover:border-amber-400/60",
    examples: [
      "Tuve una mala experiencia con un servicio o funcionario",
      "Fui atendido de manera inapropiada",
      "Un proceso no se realizó correctamente",
    ],
    prompt:
      "Hola, quiero presentar una queja. Tuve una situación que quisiera reportar.",
  },
  {
    key: "reclamo",
    label: "Reclamo",
    icon: Scale,
    gradient: "from-rose-600/20 to-rose-800/20",
    border: "border-rose-500/30",
    iconColor: "text-rose-400",
    hoverBorder: "hover:border-rose-400/60",
    examples: [
      "Creo que mi nota fue calificada incorrectamente",
      "Un proceso académico o administrativo no fue justo",
      "Me cobraron algo que no corresponde",
    ],
    prompt:
      "Hola, necesito hacer un reclamo formal. Hay una situación que considero debe corregirse.",
  },
  {
    key: "sugerencia",
    label: "Sugerencia",
    icon: Lightbulb,
    gradient: "from-emerald-600/20 to-emerald-800/20",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    hoverBorder: "hover:border-emerald-400/60",
    examples: [
      "Tengo una idea para mejorar un servicio",
      "Propongo un cambio en un proceso institucional",
      "Quiero aportar una sugerencia de mejora",
    ],
    prompt:
      "Hola, quiero compartir una sugerencia de mejora para la institución.",
  },
];

export function PQRSCards({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="px-4 py-3 max-w-xl mx-auto w-full">
      <p className="text-xs text-white/40 text-center mb-4 uppercase tracking-widest font-medium">
        ¿Cómo podemos ayudarte hoy?
      </p>
      <div className="flex flex-col gap-2.5">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onSelect(t.prompt)}
              className={`
                group flex items-start gap-3 p-4 rounded-2xl border text-left w-full
                bg-gradient-to-br ${t.gradient} ${t.border} ${t.hoverBorder}
                transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/30
                active:scale-[0.99]
              `}
            >
              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5 ${t.iconColor}`}>
                <Icon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white text-sm font-semibold">{t.label}</span>
                  <ArrowRight
                    size={14}
                    className="text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors"
                  />
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {t.examples.map((ex, i) => (
                    <li key={i} className="text-white/40 text-xs leading-relaxed flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-white/20 flex-shrink-0" />
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
