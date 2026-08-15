"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Browser-native speech — completely free, no API key, no server. */

// Minimal typings for the Web Speech API (not in standard lib defs).
type SR = any;

function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/** Voice input — converts speech to text using the browser's SpeechRecognition. */
export function useSpeechToText(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  const supported = !!getRecognition();

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const SRClass = getRecognition();
    if (!SRClass) return;
    const rec = new SRClass();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((r: any) => r[0]?.transcript || "")
        .join(" ");
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  }, [onResult]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, start, stop };
}

/** Voice output — reads text aloud using the browser's SpeechSynthesis. */
export function speak(text: string, lang = "en-US") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // strip markdown for cleaner speech
  const clean = text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/[#*_`>|~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  u.rate = 1;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis)
    window.speechSynthesis.cancel();
}
