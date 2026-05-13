export interface AgoraLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { icon: 24, text: 14, gap: "gap-2" },
  md: { icon: 32, text: 18, gap: "gap-2.5" },
  lg: { icon: 48, text: 28, gap: "gap-3" },
};

export function AgoraLogo({ size = "md", className = "" }: AgoraLogoProps) {
  const { icon, text, gap } = SIZES[size];

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {/* Pórtico clásico: dos pilares + arco — evoca la ágora griega */}
      <svg
        width={icon}
        height={Math.round(icon * 0.75)}
        viewBox="0 0 32 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Colors are brand-fixed — use className="brightness-0 invert" for dark backgrounds */}
        {/* Pilar izquierdo */}
        <line x1="8" y1="21" x2="8" y2="12" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
        {/* Pilar derecho */}
        <line x1="24" y1="21" x2="24" y2="12" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" />
        {/* Arco superior */}
        <path d="M8,12 Q16,3 24,12" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Base */}
        <line x1="4" y1="21" x2="28" y2="21" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Texto ÁGORA */}
      <span
        style={{ fontSize: text, lineHeight: 1 }}
        className="font-bold tracking-widest text-[#1e1b4b] select-none"
      >
        ÁGORA
      </span>
    </div>
  );
}
