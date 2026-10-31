"use client";

import { Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModeBanner } from "@/components/badges";
import { ApiClientError, apiFetch, type ServiceStatus } from "@/lib/client/api";
import { toWav16k } from "@/lib/client/audio";
import type { Candidate } from "@/lib/matching/match";
import type { AnalyzeResponse } from "@/lib/schema/ai";
import { ConsentStep } from "./consent-step";
import { DestinationStep } from "./destination-step";
import { LocationStep, type ReporterLocation } from "./location-step";
import { RecordStep, type ReportDraft } from "./record-step";
import { effectiveNeeds, ReviewStep, type NeedEdits } from "./review-step";

type Step = "consent" | "location" | "record" | "processing" | "review" | "destination";
const STEPS: { id: Step; label: string }[] = [
  { id: "consent", label: "Persetujuan" },
  { id: "location", label: "Lokasi" },
  { id: "record", label: "Laporan" },
  { id: "review", label: "Tinjau" },
  { id: "destination", label: "Tujuan" },
];

type Stage = "prepare" | "upload" | "done";

export function ReportWizard() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [step, setStep] = useState<Step>("consent");
  const [location, setLocation] = useState<ReporterLocation | null>(null);
  const [draft, setDraftState] = useState<ReportDraft>({ audio: null, text: "", useText: false, photo: null, scenario: "" });
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [edits, setEdits] = useState<NeedEdits>({});
  const [stage, setStage] = useState<Stage>("prepare");
  const [procError, setProcError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [online, setOnline] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const setDraft = useCallback((fn: (d: ReportDraft) => ReportDraft) => setDraftState(fn), []);

  useEffect(() => {
    apiFetch<ServiceStatus>("/api/status").then(setStatus, () => setStatusError(true));
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const needs = useMemo(() => (analysis ? effectiveNeeds(analysis.result.needs, edits) : []), [analysis, edits]);

  async function analyze() {
    setStep("processing");
    setProcError(null);
    setStage("prepare");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const form = new FormData();
      form.set("consent", "true");
      if (draft.useText || !draft.audio) {
        form.set("text", draft.text.trim());
      } else if (draft.audio) {
        let audio: Blob = draft.audio.blob;
        try {
          audio = await toWav16k(draft.audio.blob);
        } catch {
          // Browser tidak dapat mendekode: kirim format asli.
        }
        const ext = audio.type.includes("wav") ? "wav" : audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
        form.set("audio", audio, `laporan.${ext}`);
      }
      if (draft.photo) form.set("photo", draft.photo.blob, "foto.jpg");
      if (draft.scenario) form.set("mock_scenario", draft.scenario);
      if (ctrl.signal.aborted) return;
      setStage("upload");
      const data = await apiFetch<AnalyzeResponse>("/api/analyze", { method: "POST", body: form, signal: ctrl.signal });
      setStage("done");
      setAnalysis(data);
      setEdits({});
      setSelected(null);
      setStep("review");
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "ABORTED") {
        setStep("record");
        return;
      }
      setProcError(e instanceof ApiClientError ? e.message : "Terjadi kesalahan saat memproses laporan.");
    } finally {
      abortRef.current = null;
    }
  }

  const banner: string[] = [];
  banner.push("Demo – data simulasi");
  if (status?.ai_mode === "MOCK") banner.push("AI simulasi");
  if (status?.routing_mode === "MOCK") banner.push("Rute simulasi");
  if (status?.data_mode === "LOCAL") banner.push("Database lokal");

  const currentIdx = STEPS.findIndex((s) => s.id === (step === "processing" ? "record" : step));

  return (
    <div className="flex flex-1 flex-col">
      <ModeBanner items={banner} />
      {!online && (
        <p role="alert" className="bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white">
          Anda offline – laporan tidak dapat dianalisis dan data kapasitas tidak dapat diperbarui.
        </p>
      )}
      {statusError && (
        <p role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
          Status layanan tidak dapat dimuat; mode AI/rute mungkin tidak terlihat.
        </p>
      )}
      {status && status.ai_mode === "LIVE" && !status.ai_configured && (
        <p role="alert" className="bg-red-100 px-4 py-2 text-center text-sm text-red-900">
          Layanan AI belum dikonfigurasi di server (GEMINI_API_KEY). Analisis akan gagal sampai kunci diisi atau mode simulasi diaktifkan.
        </p>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-5">
        <nav aria-label="Langkah laporan">
          <ol className="flex gap-1">
            {STEPS.map((s, i) => (
              <li key={s.id} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= currentIdx ? "bg-blue-700" : "bg-slate-300"}`} aria-hidden />
                <span className={`mt-1 block text-center text-[11px] sm:text-xs ${i === currentIdx ? "font-bold text-blue-800" : "text-slate-600"}`} aria-current={i === currentIdx ? "step" : undefined}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <div ref={headingRef} tabIndex={-1} className="outline-none">
          {step === "consent" && <ConsentStep status={status} onAccept={() => setStep("location")} />}

          {step === "location" && <LocationStep value={location} onChange={setLocation} onNext={() => setStep("record")} />}

          {step === "record" && <RecordStep draft={draft} setDraft={setDraft} status={status} onSubmit={analyze} />}

          {step === "processing" && (
            <section aria-live="polite" className="space-y-4 rounded-xl border-2 border-slate-300 bg-white p-6">
              {!procError ? (
                <>
                  <ol className="space-y-3 text-lg">
                    <li className="flex items-center gap-3">
                      {stage === "prepare" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <span aria-hidden>✓</span>}
                      Menyiapkan laporan
                    </li>
                    <li className={`flex items-center gap-3 ${stage === "prepare" ? "text-slate-400" : ""}`}>
                      {stage === "upload" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <span aria-hidden>{stage === "done" ? "✓" : "○"}</span>}
                      Mengunggah, menganalisis, dan memvalidasi format
                    </li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    className="flex items-center gap-2 rounded-lg border-2 border-slate-400 px-4 py-2 font-semibold"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Batal
                  </button>
                </>
              ) : (
                <div role="alert" className="space-y-3">
                  <p className="text-lg font-bold text-red-800">Laporan belum berhasil diproses</p>
                  <p className="text-base">{procError}</p>
                  <p className="text-sm text-slate-600">Rekaman/teks Anda masih tersimpan di perangkat ini dan tidak hilang.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={analyze} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-bold text-white">
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      Coba lagi
                    </button>
                    <button type="button" onClick={() => setStep("record")} className="rounded-lg border-2 border-slate-400 px-4 py-3 font-bold">
                      Ubah laporan
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === "review" && analysis && (
            <ReviewStep analysis={analysis} edits={edits} setEdits={setEdits} onMatch={() => setStep("destination")} onRedo={() => setStep("record")} />
          )}

          {step === "destination" && analysis && location && (
            <DestinationStep
              location={location}
              needs={needs}
              selectedId={selected?.facility_id ?? null}
              onSelect={setSelected}
              onBack={() => setStep("review")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
