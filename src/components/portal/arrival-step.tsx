"use client";

import { AlertTriangle, CircleCheck, ShieldCheck } from "lucide-react";
import { OriginChip, UrgencyBadge } from "@/components/badges";
import { SpeakPanel } from "@/components/speak-panel";
import type { Candidate } from "@/lib/matching/match";
import type { Need, NormalizedAiResult } from "@/lib/schema/ai";
import { CAPABILITY_LABELS } from "@/lib/schema/enums";

// Layar setelah pelapor menekan "Sudah sampai": ringkasan serah terima untuk petugas IGD.
// Hanya ditampilkan di perangkat ini; tidak dikirim atau disimpan di server.

const URGENCY_TEXT = { MERAH: "merah", KUNING: "kuning", HIJAU: "hijau" } as const;

/** Teks serah terima yang juga dibacakan TTS. Hanya isi laporan, tanpa diagnosis atau terapi. */
export function buildHandover(r: NormalizedAiResult, needs: Need[], hospital: string): string[] {
  const lines = [`Ringkasan laporan untuk petugas IGD ${hospital}. Ini perkiraan AI dari laporan pelapor, bukan diagnosis.`];
  if (r.report.summary) lines.push(r.report.summary);
  lines.push(r.urgency.level ? `Perkiraan urgensi ${URGENCY_TEXT[r.urgency.level]}. ${r.urgency.reason}` : "Urgensi perlu peninjauan petugas.");
  const objective = r.soap.objective.filter((o) => o.value != null).map((o) => `${o.label} ${o.value}${o.unit ? ` ${o.unit}` : ""}`);
  if (objective.length) lines.push(`Angka yang dilaporkan: ${objective.join(", ")}.`);
  const required = needs.filter((n) => n.required).map((n) => CAPABILITY_LABELS[n.code]);
  if (required.length) lines.push(`Kebutuhan layanan: ${required.join(", ")}.`);
  if (r.unknowns.length) lines.push(`Belum diketahui: ${r.unknowns.join(", ")}.`);
  return lines;
}

export function ArrivalStep({
  hospital,
  result,
  needs,
  onNew,
  onBack,
}: {
  hospital: Candidate;
  result: NormalizedAiResult;
  needs: Need[];
  onNew: () => void;
  onBack: () => void;
}) {
  const soap = result.soap;
  return (
    <section aria-labelledby="arrival-title" className="flex flex-col gap-4">
      <div className="anim-rise flex items-center gap-3 rounded-3xl bg-ok-tint p-4 text-ok-strong">
        <CircleCheck className="h-9 w-9 shrink-0" aria-hidden />
        <div>
          <h1 id="arrival-title" className="text-[22px] font-extrabold leading-tight tracking-tight">
            Sudah sampai di {hospital.short_name}
          </h1>
          <p className="text-sm">Tunjukkan atau bacakan ringkasan ini kepada petugas IGD.</p>
        </div>
      </div>

      <section aria-label="Ringkasan untuk petugas IGD" className="anim-rise anim-d1 card flex flex-col gap-3 rounded-[22px] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge level={result.urgency.level} size="sm" />
          <span className="text-xs text-muted">perkiraan AI</span>
        </div>
        <p className="text-base leading-relaxed">{result.report.summary}</p>
        {result.urgency.reason && <p className="text-sm text-ink-2">{result.urgency.reason}</p>}

        <dl className="grid gap-3 border-t border-[#eef1f5] pt-3 text-sm">
          <div>
            <dt className="mb-1 font-bold text-muted">S · Keluhan</dt>
            <dd>
              {soap.subjective.length === 0 ? (
                <em className="text-muted">Tidak ada.</em>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {soap.subjective.map((s, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">{s.value ?? <em className="text-muted">tidak diketahui</em>}</span>
                      <OriginChip origin={s.origin} />
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 font-bold text-muted">O · Angka dilaporkan</dt>
            <dd>
              {soap.objective.length === 0 ? (
                <em className="text-muted">Tidak ada angka dilaporkan.</em>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {soap.objective.map((o, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-[10px] bg-soft px-2.5 py-1.5">
                      <span className="min-w-0 text-ink-2">{o.label}</span>
                      {o.value != null ? (
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="font-mono font-bold">
                            {o.value}
                            {o.unit ? ` ${o.unit}` : ""}
                          </span>
                          <OriginChip origin={o.origin} />
                        </span>
                      ) : (
                        <em className="shrink-0 text-muted">tidak diketahui</em>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 font-bold text-muted">A · Perkiraan</dt>
            <dd className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">{soap.assessment.value ?? <em className="text-muted">tidak dapat dinilai</em>}</span>
              <OriginChip origin={soap.assessment.origin} />
            </dd>
          </div>
          {needs.length > 0 && (
            <div>
              <dt className="mb-1 font-bold text-muted">Kebutuhan layanan</dt>
              <dd className="flex flex-wrap gap-1.5">
                {needs.map((n) => (
                  <span key={n.code} className="rounded-lg bg-soft px-2 py-1 text-xs">
                    <span className="font-mono font-bold">
                      {n.code}
                      {n.required ? "*" : ""}
                    </span>{" "}
                    {CAPABILITY_LABELS[n.code]}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {result.unknowns.length > 0 && (
            <div>
              <dt className="mb-1 font-bold text-muted">Belum diketahui</dt>
              <dd className="text-ink-2">{result.unknowns.join(", ")}</dd>
            </div>
          )}
        </dl>
        <p className="flex items-start gap-2 text-xs text-muted">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Hasil AI adalah perkiraan awal yang perlu ditinjau tenaga kesehatan, bukan diagnosis.
        </p>
      </section>

      <SpeakPanel lines={buildHandover(result, needs, hospital.short_name)} title="Bacakan ringkasan" />

      <button type="button" onClick={onNew} className="btn btn-primary btn-lg w-full">
        Buat laporan baru
      </button>
      <button type="button" onClick={onBack} className="btn btn-ghost w-full">
        Kembali ke daftar rumah sakit
      </button>
      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Ringkasan ini hanya ada di perangkat ini dan tidak dikirim ke rumah sakit.
      </p>
    </section>
  );
}
