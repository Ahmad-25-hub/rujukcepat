"use client";

import { Check, ChevronLeft, Clock, Loader2, RefreshCw, TriangleAlert, WifiOff, X } from "lucide-react";
import Link from "next/link";
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
import { setActiveReferral, StatusStep, useActiveReferral } from "./status-step";
import { effectiveNeeds, ReviewStep, type NeedEdits } from "./review-step";

type Step = "prepare" | "record" | "processing" | "review" | "destination" | "status";
const STEPS: { id: Step; label: string }[] = [
  { id: "prepare", label: "Persiapan" },
  { id: "record", label: "Laporan kondisi" },
  { id: "review", label: "Tinjau ringkasan" },
  { id: "destination", label: "Pilih rumah sakit" },
  { id: "status", label: "Status rujukan" },
];

type Stage = "prepare" | "upload" | "done";

export function ReportWizard() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [step, setStep] = useState<Step>("prepare");
  const [consent, setConsent] = useState(false);
  const [location, setLocation] = useState<ReporterLocation | null>(null);
  const [draft, setDraftState] = useState<ReportDraft>({ audio: null, text: "", useText: false, photo: null, scenario: "" });
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [edits, setEdits] = useState<NeedEdits>({});
  const [stage, setStage] = useState<Stage>("prepare");
  const [procError, setProcError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [online, setOnline] = useState(true);
  const [referralId, setReferralId] = useState<string | null>(null);
  const lastReferralId = useActiveReferral();
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

  function rememberReferral(id: string | null) {
    setReferralId(id);
    setActiveReferral(id);
  }

  function startNew() {
    rememberReferral(null);
    setAnalysis(null);
    setEdits({});
    setSelected(null);
    setDraftState({ audio: null, text: "", useText: false, photo: null, scenario: "" });
    setStep(consent && location ? "record" : "prepare");
  }

  const supabaseChannels = status?.data_mode === "SUPABASE" && referralId ? ["rc:facilities", `rc:referral:${referralId}`] : null;

  const banner: string[] = [];
  banner.push("Demo – data simulasi");
  if (status?.ai_mode === "MOCK") banner.push("AI simulasi");
  if (status?.routing_mode === "MOCK") banner.push("Rute simulasi");
  if (status?.data_mode === "LOCAL") banner.push("Database lokal");

  const viewStep = step === "processing" ? "record" : step;
  const currentIdx = STEPS.findIndex((s) => s.id === viewStep);
  const current = STEPS[currentIdx];
  const back: (() => void) | "home" | null =
    step === "prepare"
      ? "home"
      : step === "record"
        ? () => setStep("prepare")
        : step === "review"
          ? () => setStep("record")
          : step === "destination"
            ? () => setStep("review")
            : step === "status"
              ? "home"
              : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className={`mx-auto flex flex-col gap-2 px-3 pb-2.5 pt-2 ${step === "destination" ? "max-w-6xl" : "max-w-2xl"}`}>
          <div className="flex items-center gap-2">
            {back === "home" ? (
              <Link href="/" aria-label="Kembali ke beranda" className="btn btn-ghost btn-icon shrink-0">
                <ChevronLeft className="h-[22px] w-[22px]" aria-hidden />
              </Link>
            ) : back ? (
              <button type="button" onClick={back} aria-label="Kembali ke langkah sebelumnya" className="btn btn-ghost btn-icon shrink-0">
                <ChevronLeft className="h-[22px] w-[22px]" aria-hidden />
              </button>
            ) : (
              <span className="w-2" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted">
                Langkah {currentIdx + 1} dari {STEPS.length}
              </p>
              <p className="truncate text-base font-extrabold tracking-tight">{step === "processing" ? "Menganalisis laporan" : current.label}</p>
            </div>
            <a href="tel:119" className="btn btn-secondary shrink-0 px-3 text-sm text-brand-ink">
              119
            </a>
          </div>
          <ol aria-label="Kemajuan laporan" className="grid grid-cols-5 gap-1 px-1">
            {STEPS.map((s, i) => (
              <li key={s.id} aria-current={i === currentIdx ? "step" : undefined} className="relative h-1 overflow-hidden rounded-full bg-[#dce1e9]">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-500 ease-out ${i <= currentIdx ? "w-full" : "w-0"}`}
                  aria-hidden
                />
                <span className="sr-only">
                  {s.label}
                  {i < currentIdx ? " (selesai)" : i === currentIdx ? " (saat ini)" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      {!online && (
        <p role="alert" className="flex items-center justify-center gap-2 bg-brand px-4 py-2 text-center text-sm font-semibold text-white">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          Anda offline – laporan tidak dapat dianalisis dan data kapasitas tidak dapat diperbarui.
        </p>
      )}

      <main id="main" className={`mx-auto flex w-full flex-1 flex-col gap-4 px-4 pb-6 pt-4 ${step === "destination" ? "max-w-6xl" : "max-w-2xl"}`}>
        <ModeBanner items={banner} />
        {statusError && (
          <p role="alert" className="notice notice-warn">
            Status layanan tidak dapat dimuat; mode AI/rute mungkin tidak terlihat.
          </p>
        )}
        {status && status.ai_mode === "LIVE" && !status.ai_configured && (
          <p role="alert" className="notice notice-error">
            Layanan AI belum dikonfigurasi di server (GEMINI_API_KEY). Analisis akan gagal sampai kunci diisi atau mode simulasi diaktifkan.
          </p>
        )}

        <div ref={headingRef} tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {step === "prepare" && (
            <div className="flex flex-1 flex-col gap-4">
              <div className="anim-rise">
                <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">Dua hal sebelum mulai</h1>
                <p className="mt-1.5 text-base leading-relaxed text-ink-2">Setelah ini langsung ke rekaman.</p>
              </div>
              {lastReferralId && (
                <button
                  type="button"
                  onClick={() => {
                    setReferralId(lastReferralId);
                    setStep("status");
                  }}
                  className="anim-rise flex min-h-[60px] items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 text-left transition-colors hover:bg-[#eef1f5]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn-tint text-warn-ink">
                    <Clock className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block text-xs font-semibold text-muted">Rujukan terakhir di perangkat ini</span>
                    <span className="block text-[15px] font-bold">Lihat status permintaan</span>
                  </span>
                </button>
              )}
              <ConsentStep status={status} checked={consent} onChange={setConsent} />
              <LocationStep value={location} onChange={setLocation} />
              <div className="action-bar mt-auto">
                <button type="button" disabled={!consent || !location} onClick={() => setStep("record")} className="btn btn-primary btn-lg w-full">
                  {!consent ? "Setujui pemrosesan data dulu" : !location ? "Tentukan lokasi dulu" : "Lanjut ke laporan"}
                </button>
              </div>
            </div>
          )}

          {step === "record" && <RecordStep draft={draft} setDraft={setDraft} status={status} onSubmit={analyze} />}

          {step === "processing" && (
            <section aria-live="polite" aria-labelledby="proc-title" className="anim-rise flex flex-col gap-[18px]">
              {!procError ? (
                <>
                  <div className="card relative overflow-hidden rounded-3xl p-5" aria-hidden>
                    <div className="scan-line" />
                    <div className="flex flex-col gap-4">
                      {["S", "O", "A", "P"].map((l, i) => (
                        <div key={l} className="flex items-center gap-2.5">
                          <span className={`grid h-7 w-7 place-items-center rounded-lg text-[13px] font-extrabold ${i < 2 ? "bg-ink text-white" : "bg-[#dce1e9] text-ink-2"}`}>{l}</span>
                          <span className="skeleton h-3" style={{ width: ["100%", "60%", "75%", "45%"][i] }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <h1 id="proc-title" className="text-[22px] font-extrabold tracking-tight">
                    Menyusun ringkasan terstruktur
                  </h1>
                  <ol className="flex flex-col gap-1">
                    <ProcRow state={stage === "prepare" ? "active" : "done"} label="Menyiapkan laporan" />
                    <ProcRow state={stage === "prepare" ? "todo" : stage === "upload" ? "active" : "done"} label="Mengunggah dan menganalisis" />
                    <ProcRow state={stage === "done" ? "done" : "todo"} label="Memvalidasi format hasil" />
                  </ol>
                  <p className="text-[13px] leading-normal text-muted">Hasil yang tidak lolos validasi tidak dipakai untuk pencocokan rumah sakit.</p>
                  <button type="button" onClick={() => abortRef.current?.abort()} className="btn btn-secondary btn-lg">
                    <X className="h-[18px] w-[18px]" aria-hidden />
                    Batal
                  </button>
                </>
              ) : (
                <div role="alert" className="card flex flex-col gap-3.5 rounded-3xl !border-[#f3c6ce] p-5">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-tint text-brand">
                    <TriangleAlert className="h-6 w-6" aria-hidden />
                  </span>
                  <h1 id="proc-title" className="text-[22px] font-extrabold tracking-tight">
                    Laporan belum berhasil diproses
                  </h1>
                  <p className="text-base leading-relaxed text-ink-2">{procError}</p>
                  <p className="text-sm text-muted">Rekaman/teks Anda masih tersimpan di perangkat ini dan tidak hilang.</p>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={analyze} className="btn btn-primary btn-lg flex-[2_1_180px]">
                      <RefreshCw className="h-[18px] w-[18px]" aria-hidden />
                      Coba lagi
                    </button>
                    <button type="button" onClick={() => setStep("record")} className="btn btn-secondary btn-lg flex-[1_1_140px]">
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
              analysis={analysis}
              online={online}
              selectedId={selected?.facility_id ?? null}
              onSelect={setSelected}
              onSent={(id) => {
                rememberReferral(id);
                setStep("status");
              }}
              onBack={() => setStep("review")}
            />
          )}

          {step === "status" && referralId && (
            <StatusStep
              referralId={referralId}
              supabaseChannels={supabaseChannels}
              onBack={analysis && location ? () => setStep("destination") : null}
              onNew={startNew}
              onGone={() => {
                rememberReferral(null);
                setStep("prepare");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ProcRow({ state, label }: { state: "done" | "active" | "todo"; label: string }) {
  return (
    <li className={`flex min-h-12 items-center gap-3 ${state === "todo" ? "text-muted" : ""}`}>
      {state === "done" ? (
        <span className="anim-pop grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok text-white">
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
        </span>
      ) : state === "active" ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink" aria-hidden />
        </span>
      ) : (
        <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-[#b5becc]" aria-hidden />
      )}
      <span className={`flex-1 text-base ${state === "active" ? "font-extrabold" : "font-semibold"}`}>{label}</span>
      <span className={`text-[13px] font-bold ${state === "done" ? "text-ok" : "text-ink-2"}`}>{state === "done" ? "Selesai" : state === "active" ? "Sedang" : ""}</span>
    </li>
  );
}
