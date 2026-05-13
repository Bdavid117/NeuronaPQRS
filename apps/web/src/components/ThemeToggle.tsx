"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={cn(
        "p-1.5 rounded-lg transition-colors",
        "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
        "dark:text-white/40 dark:hover:text-white/70 dark:hover:bg-white/[0.06]",
        className
      )}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Cambiar tema"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
