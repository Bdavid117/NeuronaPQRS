"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVoiceSynthesisResult {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/** Strip markdown formatting before speaking so the TTS doesn't read symbols aloud. */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")          // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")   // bold
    .replace(/\*(.+?)\*/g, "$1")       // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/^[-*]\s/gm, "")          // list bullets
    .replace(/\n{2,}/g, ". ")          // paragraph breaks
    .replace(/\n/g, " ")
    .trim();
}

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "es-CO") ??
    voices.find((v) => v.lang === "es-US") ??
    voices.find((v) => v.lang.startsWith("es")) ??
    null
  );
}

export function useVoiceSynthesis(): UseVoiceSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Voices load asynchronously — trigger a re-render when they arrive
  useEffect(() => {
    if (!isSupported) return;
    const handler = () => {
      /* force a re-render so pickSpanishVoice() can find loaded voices */
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text.trim()) return;
      window.speechSynthesis.cancel(); // stop any ongoing speech

      const clean = stripMarkdown(text);
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "es-CO";
      utterance.rate = 1.05;
      utterance.pitch = 1;

      const voice = pickSpanishVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
