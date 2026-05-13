"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceInputState = "idle" | "listening" | "processing";

interface UseVoiceInputOptions {
  onResult: (transcript: string) => void;
  lang?: string;
}

interface UseVoiceInputResult {
  state: VoiceInputState;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
  isSupported: boolean;
}

// Web Speech API types (not always exported from dom lib in all TS configs)
interface SpeechAlternative { transcript: string; confidence: number }
interface SpeechResult { readonly length: number; isFinal: boolean; [index: number]: SpeechAlternative }
interface SpeechResultList { readonly length: number; [index: number]: SpeechResult }
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechResultList;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionCtor { new (): ISpeechRecognition }

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const hasSpeechRecognition = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const hasMediaRecorder = () =>
  typeof window !== "undefined" && "MediaRecorder" in window;

/** Whisper fallback: record via MediaRecorder, send blob to /api/transcribe */
async function transcribeWithWhisper(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new Error("Transcription failed");
  const json = await res.json();
  return (json.transcript as string) ?? "";
}

export function useVoiceInput({
  onResult,
  lang = "es-CO",
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [state, setState] = useState<VoiceInputState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const isSupported = hasSpeechRecognition() || hasMediaRecorder();

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setState("idle");
    setInterimTranscript("");
  }, []);

  const startWithSpeechRecognition = useCallback(() => {
    const SpeechRecognitionImpl =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInterimTranscript(interim || final);
    };

    recognition.onspeechend = () => {
      setState("processing");
      recognition.stop();
    };

    recognition.onend = () => {
      setInterimTranscript((prev) => {
        if (prev.trim()) onResultRef.current(prev.trim());
        return "";
      });
      setState("idle");
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setState("idle");
      setInterimTranscript("");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang]);

  const startWithWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("processing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const transcript = await transcribeWithWhisper(blob);
          if (transcript) onResultRef.current(transcript);
        } catch {
          // silent fail
        } finally {
          setState("idle");
          mediaRecorderRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("listening");
    } catch {
      setState("idle");
    }
  }, []);

  const start = useCallback(() => {
    if (hasSpeechRecognition()) {
      startWithSpeechRecognition();
    } else if (hasMediaRecorder()) {
      void startWithWhisper();
    }
  }, [startWithSpeechRecognition, startWithWhisper]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return { state, interimTranscript, start, stop, isSupported };
}
