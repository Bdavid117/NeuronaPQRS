"use client";

import { type VoiceInputState } from "@/lib/useVoiceInput";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceButtonProps {
  state: VoiceInputState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceButton({
  state,
  onStart,
  onStop,
  disabled,
  className,
}: VoiceButtonProps) {
  const isListening = state === "listening";
  const isProcessing = state === "processing";

  return (
    <button
      type="button"
      disabled={disabled || isProcessing}
      onClick={isListening ? onStop : onStart}
      title={isListening ? "Detener grabación" : "Hablar"}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none",
        "w-14 h-14",
        isListening
          ? "bg-rose-500 shadow-lg shadow-rose-500/40 scale-110"
          : isProcessing
          ? "bg-violet-500/30 cursor-wait"
          : "bg-gradient-to-br from-violet-600 to-indigo-700 shadow-lg shadow-violet-500/30 hover:scale-105 active:scale-95",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      {/* Listening pulse rings */}
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full animate-ping bg-rose-400 opacity-30" />
          <span className="absolute inset-[-6px] rounded-full border-2 border-rose-400/40 animate-pulse" />
        </>
      )}

      {isProcessing ? (
        <Loader2 size={22} className="text-white animate-spin" />
      ) : isListening ? (
        <MicOff size={22} className="text-white" />
      ) : (
        <Mic size={22} className="text-white" />
      )}
    </button>
  );
}
