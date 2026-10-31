"use client";

import { Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Panduan suara (Web Speech API speechSynthesis). Hanya diputar saat pengguna menekan tombol
// (menghindari pemblokiran autoplay), dapat dihentikan, dan teks selalu tetap tampil.

const noop = () => () => {};
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export function SpeakPanel({ lines, title = "Panduan suara" }: { lines: string[]; title?: string }) {
  const canSpeak = useSyncExternalStore(noop, supported, () => false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  function stop() {
    runId.current += 1;
    if (supported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function play() {
    if (!supported()) return;
    setError(null);
    window.speechSynthesis.cancel();
    const id = ++runId.current;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.toLowerCase().startsWith("id")) ?? null;
    const text = lines.join(" ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID";
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => {
      if (runId.current === id) setSpeaking(false);
    };
    u.onerror = (e) => {
      if (runId.current !== id) return;
      setSpeaking(false);
      if (e.error !== "canceled" && e.error !== "interrupted") {
        setError("Suara tidak dapat diputar di perangkat ini. Silakan baca teks di bawah.");
      }
    };
    setSpeaking(true);
    window.speechSynthesis.speak(u);
    if (!voice) setError("Suara Bahasa Indonesia tidak ditemukan di perangkat ini; pelafalan mungkin tidak sesuai. Teks tetap tersedia di bawah.");
  }

  useEffect(
    () => () => {
      if (supported()) window.speechSynthesis.cancel();
    },
    [],
  );

  return (
    <section aria-labelledby="speak-title" className="space-y-3 card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="speak-title" className="flex items-center gap-2 text-base font-bold">
          <Volume2 className="h-5 w-5 text-accent" aria-hidden />
          {title}
        </h3>
        {canSpeak ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={play}
              disabled={speaking || lines.length === 0}
              className="btn btn-primary"
            >
              <Volume2 className="h-4 w-4" aria-hidden />
              Putar
            </button>
            <button
              type="button"
              onClick={stop}
              disabled={!speaking}
              className="btn btn-secondary"
            >
              <Square className="h-4 w-4" aria-hidden />
              Berhenti
            </button>
          </div>
        ) : null}
      </div>
      {!canSpeak && (
        <p role="note" className="flex items-start gap-2 rounded-lg bg-[#fff8e6] p-3 text-sm text-warn-ink">
          <VolumeX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Browser ini tidak mendukung suara (speechSynthesis). Silakan baca panduan tertulis di bawah.
        </p>
      )}
      {speaking && (
        <p role="status" className="text-sm font-semibold text-accent">
          Sedang membacakan panduan…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-warn-ink">
          {error}
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <p className="text-xs text-muted">Ringkasan ini hanya untuk serah terima informasi, bukan diagnosis atau instruksi pengobatan.</p>
    </section>
  );
}
