"use client";

import { ArrowRight, Keyboard, Mic, RotateCcw, Square } from "lucide-react";
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

  const remain = Math.max(0, Math.ceil(MAX_SECONDS - elapsed));
  const mmss = (v: number) => `00:${String(Math.floor(v)).padStart(2, "0")}`;

  return (
    <section aria-labelledby="rec-title" className="flex flex-1 flex-col gap-4">
      {supported !== false && (
        <div role="group" aria-label="Cara melapor" className="seg">
          <button
            type="button"
            aria-pressed={!useText}
            disabled={recording}
            onClick={() => setDraft((d) => ({ ...d, useText: false }))}
            className="seg-btn inline-flex items-center justify-center gap-2 text-[15px]"
          >
            <Mic className="h-[18px] w-[18px]" aria-hidden />
            Suara
          </button>
          <button
            type="button"
            aria-pressed={useText}
            disabled={recording}
            onClick={() => setDraft((d) => ({ ...d, useText: true }))}
            className="seg-btn inline-flex items-center justify-center gap-2 text-[15px]"
          >
            <Keyboard className="h-[18px] w-[18px]" aria-hidden />
            Ketik
          </button>
        </div>
      )}

      {!useText && (
        <div className="anim-rise card flex flex-col items-center gap-4 rounded-3xl px-[18px] py-6 text-center">
          <h1 id="rec-title" className="text-[22px] font-extrabold leading-tight tracking-tight">
            {recording ? "Merekam… ceritakan dengan tenang" : draft.audio ? "Rekaman siap ditinjau" : "Tekan dan ceritakan kondisi pasien"}
          </h1>

          <div aria-hidden className="flex h-14 w-full items-center justify-center gap-1">
            {recording ? (
              Array.from({ length: 20 }, (_, i) => <span key={i} className="wave-bar" style={{ animationDelay: `${-((i * 37) % 100) / 100}s` }} />)
            ) : draft.audio ? (
              [12, 26, 18, 34, 22, 40, 16, 30, 24, 36, 20, 28, 14, 32, 18, 10].map((h, i) => <span key={i} className="w-1 rounded bg-ink" style={{ height: h }} />)
            ) : (
              <span className="h-0.5 w-full max-w-[260px] bg-[repeating-linear-gradient(90deg,#c7ceda_0_6px,transparent_6px_12px)]" />
            )}
          </div>

          <p className="flex items-center gap-2.5 font-mono text-[30px] font-bold tracking-tight" role="status" aria-live="polite">
            {recording && <span className="anim-blink h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />}
            <span className="sr-only">{recording ? "Merekam, " : draft.audio ? "Durasi rekaman " : ""}</span>
            {recording ? mmss(elapsed) : draft.audio ? mmss(dur) : "00:00"}
            <span className="text-lg text-faint">/ 00:{String(TARGET_MAX).padStart(2, "0")}</span>
          </p>

          {recording ? (
            <>
              <span className="relative grid h-28 w-28 place-items-center">
                <span className="anim-ring absolute inset-0 rounded-full bg-brand/30" aria-hidden />
                <span className="anim-ring anim-ring-late absolute inset-0 rounded-full bg-brand/30" aria-hidden />
                <button
                  type="button"
                  onClick={stop}
                  aria-label="Berhenti merekam"
                  className="relative grid h-28 w-28 place-items-center rounded-full bg-ink text-white transition-transform active:scale-95"
                >
                  <Square className="h-8 w-8 fill-current" aria-hidden />
                </button>
              </span>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#e6eaf0]" aria-hidden>
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${elapsed >= TARGET_MIN ? "bg-ok" : "bg-brand"}`}
                  style={{ width: `${Math.min(100, (elapsed / MAX_SECONDS) * 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted">
                {elapsed < TARGET_MIN
                  ? `Target minimal ${TARGET_MIN} detik`
                  : elapsed <= TARGET_MAX
                    ? "Durasi sudah cukup — tekan kotak hitam untuk berhenti"
                    : `Berhenti otomatis dalam ${remain} detik`}
              </p>
            </>
          ) : draft.audio ? (
            <div className="flex w-full flex-col gap-3">
              <audio controls src={draft.audio.url} className="w-full" />
              <p className="text-sm text-muted">
                {dur.toFixed(1)} detik · {formatBytes(draft.audio.blob.size)} · tersimpan di perangkat ini sampai dikirim
              </p>
              {dur < TARGET_MIN && (
                <p className="notice notice-warn text-left">Rekaman lebih pendek dari {TARGET_MIN} detik; informasi mungkin kurang. Anda tetap dapat melanjutkan.</p>
              )}
              <button type="button" onClick={discard} className="btn btn-secondary self-center">
                <RotateCcw className="h-4 w-4" aria-hidden />
                Rekam ulang
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={start}
                aria-label="Mulai merekam"
                className="grid h-28 w-28 place-items-center rounded-full bg-brand text-white shadow-[0_16px_32px_-14px_rgba(196,18,47,.7)] transition hover:shadow-[0_0_0_8px_rgba(196,18,47,.12)] active:scale-95"
              >
                <Mic className="h-10 w-10" aria-hidden />
              </button>
              <p className="text-sm text-muted">
                Bicara biasa saja, {TARGET_MIN}–{TARGET_MAX} detik cukup. Jangan sebut nama asli.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="notice notice-error w-full text-left">
              {error}
            </p>
          )}
        </div>
      )}

      {useText && (
        <div className="anim-rise card flex flex-col gap-2.5 rounded-3xl p-[18px]">
          <h1 id="rec-title" className="sr-only">
            Laporan tertulis
          </h1>
          <label htmlFor="report-text" className="text-lg font-extrabold">
            Tulis kondisi pasien
          </label>
          <textarea
            id="report-text"
            rows={6}
            maxLength={2000}
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            placeholder="Contoh: Ayah saya 70 tahun tiba-tiba lemas dan keringat dingin sejak 30 menit lalu, masih bisa bicara tapi bingung."
            className="field resize-y leading-normal"
          />
          <p className="text-[13px] text-muted">
            {draft.text.length}/2000 karakter (minimal 10){!supported ? " · perekaman suara tidak didukung browser ini" : ""}
          </p>
        </div>
      )}

      <section aria-labelledby="tips-title" className="card px-[18px] py-4">
        <h2 id="tips-title" className="eyebrow mb-2.5">
          Sebutkan bila tahu
        </h2>
        <ul className="flex flex-wrap gap-2">
          {["Keluhan utama", "Sejak kapan", "Sadar atau tidak", "Napas", "Perkiraan usia", "Angka alat ukur"].map((t) => (
            <li key={t} className="rounded-full bg-ground px-3 py-2 text-sm font-semibold">
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[13px] text-muted">Yang tidak disebut tetap ditandai “tidak diketahui”, tidak ditebak.</p>
      </section>

      <PhotoPicker value={draft.photo} onChange={(photo) => setDraft((d) => ({ ...d, photo }))} />

      {status?.ai_mode === "MOCK" && status.mock_scenarios.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[#f0d08a] bg-[#fff8e6] p-3">
          <label htmlFor="scenario" className="text-sm font-bold text-warn-ink">
            Pilih skenario contoh (audio tidak dianalisis)
          </label>
          <select id="scenario" value={draft.scenario} onChange={(e) => setDraft((d) => ({ ...d, scenario: e.target.value }))} className="field">
            <option value="">Otomatis (dari kata kunci teks; default skenario proposal)</option>
            {status.mock_scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="action-bar mt-auto">
        <button type="button" disabled={!canSubmit || recording} onClick={onSubmit} className="btn btn-primary btn-lg w-full">
          {canSubmit ? "Analisis laporan" : useText ? "Tulis minimal 10 karakter" : "Rekam dulu untuk melanjutkan"}
          {canSubmit && <ArrowRight className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    </section>
  );
}
