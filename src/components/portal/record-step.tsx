"use client";

import { Keyboard, Mic, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isRecordingSupported, pickRecorderMime } from "@/lib/client/audio";
import { formatBytes } from "@/lib/client/format";
import type { ServiceStatus } from "@/lib/client/api";
import { PhotoPicker, type PhotoDraft } from "./photo-picker";

export type AudioDraft = { blob: Blob; url: string; durationS: number; mime: string };
export type ReportDraft = {
  audio: AudioDraft | null;
  text: string;
  useText: boolean;
  photo: PhotoDraft | null;
  scenario: string;
};

const MAX_SECONDS = 30;
const TARGET_MIN = 10;
const TARGET_MAX = 15;

export function RecordStep({
  draft,
  setDraft,
  status,
  onSubmit,
}: {
  draft: ReportDraft;
  setDraft: (fn: (d: ReportDraft) => ReportDraft) => void;
  status: ServiceStatus | null;
  onSubmit: () => void;
}) {
  // Komponen ini hanya dirender di klien (setelah langkah persetujuan).
  const [supported] = useState<boolean>(() => typeof window !== "undefined" && isRecordingSupported());
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const useText = draft.useText || !supported;

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Buka pengaturan izin situs (ikon gembok di bilah alamat) untuk mengizinkan mikrofon, atau ketik laporan di bawah."
          : name === "NotFoundError"
            ? "Mikrofon tidak ditemukan di perangkat ini. Silakan ketik laporan."
            : "Mikrofon tidak dapat dipakai. Silakan coba lagi atau ketik laporan.",
      );
      return;
    }
    streamRef.current = stream;
    const mime = pickRecorderMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      const durationS = Math.round((performance.now() - startRef.current) / 100) / 10;
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks, { type });
      setRecording(false);
      if (blob.size === 0) {
        setError("Rekaman kosong. Silakan coba lagi.");
        return;
      }
      setDraft((d) => {
        if (d.audio) URL.revokeObjectURL(d.audio.url);
        return { ...d, audio: { blob, url: URL.createObjectURL(blob), durationS, mime: type } };
      });
    };
    recRef.current = rec;
    startRef.current = performance.now();
    setElapsed(0);
    rec.start(250);
    setRecording(true);
    timerRef.current = setInterval(() => {
      const s = (performance.now() - startRef.current) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS && rec.state === "recording") rec.stop();
    }, 200);
  }

  function stop() {
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  function discard() {
    setDraft((d) => {
      if (d.audio) URL.revokeObjectURL(d.audio.url);
      return { ...d, audio: null };
    });
  }

  const canSubmit = useText ? draft.text.trim().length >= 10 : !!draft.audio;
  const dur = draft.audio?.durationS ?? 0;

  return (
    <section aria-labelledby="rec-title" className="space-y-5">
      <h2 id="rec-title" className="flex items-center gap-2 text-xl font-bold">
        <Mic className="h-6 w-6 text-blue-700" aria-hidden />
        Ceritakan kondisi pasien
      </h2>
      <p className="text-base text-slate-700">
        Rekam {TARGET_MIN}-{TARGET_MAX} detik: keluhan utama, sejak kapan, usia perkiraan, dan angka alat ukur bila ada. Jangan sebut nama asli.
      </p>

      {!useText && (
        <div className="space-y-4 rounded-xl border-2 border-slate-300 bg-white p-4">
          {recording ? (
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-red-700" role="status" aria-live="polite">
                <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" aria-hidden />
                <span className="text-lg font-bold">Merekam… {elapsed.toFixed(0)} detik</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
                <div className={`h-full ${elapsed >= TARGET_MIN ? "bg-green-600" : "bg-red-500"}`} style={{ width: `${Math.min(100, (elapsed / MAX_SECONDS) * 100)}%` }} />
              </div>
              <p className="text-sm text-slate-600">
                {elapsed < TARGET_MIN ? `Target minimal ${TARGET_MIN} detik` : elapsed <= TARGET_MAX ? "Durasi sudah cukup" : `Berhenti otomatis pada ${MAX_SECONDS} detik`}
              </p>
              <button type="button" onClick={stop} className="mx-auto flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-4 text-lg font-bold text-white">
                <Square className="h-5 w-5" aria-hidden />
                Berhenti
              </button>
            </div>
          ) : draft.audio ? (
            <div className="space-y-3">
              <p className="text-base font-semibold" role="status">
                Rekaman {dur.toFixed(1)} detik ({formatBytes(draft.audio.blob.size)})
              </p>
              {dur < TARGET_MIN && <p className="text-sm text-amber-800">Rekaman lebih pendek dari {TARGET_MIN} detik; informasi mungkin kurang. Anda tetap dapat melanjutkan.</p>}
              <audio controls src={draft.audio.url} className="w-full" />
              <button type="button" onClick={discard} className="flex items-center gap-2 rounded-lg border-2 border-slate-400 px-4 py-2 font-semibold">
                <RotateCcw className="h-4 w-4" aria-hidden />
                Rekam ulang
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={start}
              className="mx-auto flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-full bg-red-700 text-lg font-bold text-white shadow-lg disabled:bg-slate-400"
            >
              <Mic className="h-10 w-10" aria-hidden />
              Rekam
            </button>
          )}
          {error && (
            <p role="alert" className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-base text-red-900">
              {error}
            </p>
          )}
        </div>
      )}

      {useText && (
        <div className="space-y-2">
          <label htmlFor="report-text" className="flex items-center gap-2 text-base font-bold">
            <Keyboard className="h-5 w-5" aria-hidden />
            Laporan tertulis (cadangan bila suara tidak dapat dipakai)
          </label>
          <textarea
            id="report-text"
            rows={5}
            maxLength={2000}
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            placeholder="Contoh: Ayah saya 70 tahun tiba-tiba lemas dan keringat dingin sejak 30 menit lalu, masih bisa bicara tapi bingung."
            className="w-full rounded-xl border-2 border-slate-400 p-3 text-base"
          />
          <p className="text-xs text-slate-600">{draft.text.length}/2000 karakter (minimal 10)</p>
        </div>
      )}

      {supported !== false && (
        <button type="button" onClick={() => setDraft((d) => ({ ...d, useText: !d.useText }))} className="text-base font-semibold text-blue-800 underline">
          {useText ? "Kembali ke rekaman suara" : "Tidak bisa bicara? Ketik laporan"}
        </button>
      )}

      <PhotoPicker value={draft.photo} onChange={(photo) => setDraft((d) => ({ ...d, photo }))} />

      {status?.ai_mode === "MOCK" && status.mock_scenarios.length > 0 && (
        <div className="space-y-1 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
          <label htmlFor="scenario" className="text-sm font-bold text-amber-950">
            Skenario AI simulasi (mode mock aktif – audio tidak dianalisis)
          </label>
          <select
            id="scenario"
            value={draft.scenario}
            onChange={(e) => setDraft((d) => ({ ...d, scenario: e.target.value }))}
            className="w-full rounded-lg border border-amber-500 bg-white p-2 text-base"
          >
            <option value="">Otomatis (dari kata kunci teks; default skenario proposal)</option>
            {status.mock_scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit || recording}
        onClick={onSubmit}
        className="w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Kirim untuk diringkas
      </button>
    </section>
  );
}
