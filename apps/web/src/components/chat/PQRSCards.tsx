"use client";

import { FileText, MessageSquareWarning, Scale, Lightbulb, ArrowRight } from "lucide-react";

const TYPES = [
  {
    key: "peticion",
    label: "Petición",
    icon: FileText,
    gradient: "from-blue-600/20 to-blue-800/20 dark:from-blue-600/35 dark:to-blue-800/35",
    border: "border-blue-300/60 dark:border-blue-500/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-white/5",
    hoverBorder: "hover:border-blue-500 dark:hover:border-blue-400/60",
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
    gradient: "from-amber-600/20 to-amber-800/20 dark:from-amber-600/35 dark:to-amber-800/35",
    border: "border-amber-300/60 dark:border-amber-500/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-white/5",
    hoverBorder: "hover:border-amber-500 dark:hover:border-amber-400/60",
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
    gradient: "from-rose-600/20 to-rose-800/20 dark:from-rose-600/35 dark:to-rose-800/35",
    border: "border-rose-300/60 dark:border-rose-500/30",
    iconColor: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-50 dark:bg-white/5",
    hoverBorder: "hover:border-rose-500 dark:hover:border-rose-400/60",
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
    gradient: "from-emerald-600/20 to-emerald-800/20 dark:from-emerald-600/35 dark:to-emerald-800/35",
    border: "border-emerald-300/60 dark:border-emerald-500/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-white/5",
    hoverBorder: "hover:border-emerald-500 dark:hover:border-emerald-400/60",
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
      <p className="text-xs text-slate-500 dark:text-white/55 text-center mb-4 uppercase tracking-widest font-medium">
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
                transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/30
                active:scale-[0.99]
              `}
            >
              <div className={`w-9 h-9 rounded-xl ${t.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5 ${t.iconColor}`}>
                <Icon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-900 dark:text-white text-sm font-semibold">{t.label}</span>
                  <ArrowRight
                    size={14}
                    className="text-slate-400 dark:text-white/35 group-hover:text-slate-600 dark:group-hover:text-white/50 flex-shrink-0 transition-colors"
                  />
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {t.examples.map((ex, i) => (
                    <li key={i} className="text-slate-600 dark:text-white/55 text-xs leading-relaxed flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 dark:bg-white/35 flex-shrink-0" />
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
