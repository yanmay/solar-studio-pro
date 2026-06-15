// Web Speech API wrapper — voice-to-text for search input.
// Supports Indian English + Hindi (Devanagari output).
// Gracefully no-ops if the browser lacks SpeechRecognition.

import { useCallback, useEffect, useRef, useState } from "react";

// Non-standard Web Speech API types — not in lib.dom.d.ts
interface SRResult {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
}
interface SREvent extends Event {
  results: ArrayLike<SRResult>;
  resultIndex: number;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  }
}

function getSR(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export interface VoiceSearchState {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  error: string | null;
  start: (lang?: string) => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceSearch(): VoiceSearchState {
  const Ctor = getSR();
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);

  const stop = useCallback(() => {
    try { recogRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const start = useCallback((lang: string = "en-IN") => {
    if (!Ctor) {
      setError("Voice input not supported in this browser.");
      return;
    }
    try {
      const sr = new Ctor();
      sr.lang = lang;
      sr.continuous = false;
      sr.interimResults = true;
      sr.maxAlternatives = 1;
      sr.onresult = (e) => {
        let finalStr = "";
        let interimStr = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const text = r[0].transcript;
          if (r.isFinal) finalStr += text;
          else interimStr += text;
        }
        if (finalStr) setTranscript((prev) => (prev ? prev + " " : "") + finalStr.trim());
        setInterim(interimStr);
      };
      sr.onerror = (e) => {
        const code = e.error || "unknown";
        setError(
          code === "not-allowed"
            ? "Microphone permission denied. Enable mic in browser settings."
            : code === "no-speech"
            ? "No speech detected. Try again."
            : code === "network"
            ? "Voice recognition needs internet. Check connection."
            : `Voice error: ${code}`,
        );
        setListening(false);
      };
      sr.onend = () => { setListening(false); setInterim(""); };
      recogRef.current = sr;
      setTranscript("");
      setInterim("");
      setError(null);
      setListening(true);
      sr.start();
    } catch (err) {
      setError((err as Error).message);
      setListening(false);
    }
  }, [Ctor]);

  const reset = useCallback(() => { setTranscript(""); setInterim(""); setError(null); }, []);

  // Cleanup on unmount
  useEffect(() => () => { try { recogRef.current?.abort(); } catch { /* ignore */ } }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
