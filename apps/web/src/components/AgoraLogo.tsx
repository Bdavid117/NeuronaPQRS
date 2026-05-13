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
      {/* Símbolo de diálogo: dos semicírculos enfrentados conectados por línea */}
      <svg
        width={icon}
        height={Math.round(icon * 0.625)}
        viewBox="0 0 32 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Semicírculo izquierdo (C abriendo a la derecha) */}
        {/* Colors are brand-fixed — use className="brightness-0 invert" for dark backgrounds */}
        <path
          d="M14 2 C6 2 6 18 14 18"
          stroke="#3730a3"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Semicírculo derecho (C invertida, abriendo a la izquierda) */}
        <path
          d="M18 2 C26 2 26 18 18 18"
          stroke="#3730a3"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Línea fina de conexión */}
        <line
          x1="14"
          y1="10"
          x2="18"
          y2="10"
          stroke="#3730a3"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
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
