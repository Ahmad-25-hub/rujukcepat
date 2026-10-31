"use client";

import { AlertTriangle, ClipboardList, Info, RotateCcw, Search } from "lucide-react";
import { OriginChip, SimBadge, UrgencyBadge } from "@/components/badges";
import type { AnalyzeResponse, Need } from "@/lib/schema/ai";
import { CAPABILITY_CODES, CAPABILITY_LABELS, type CapabilityCode } from "@/lib/schema/enums";

export type NeedChoice = "REQUIRED" | "OPTIONAL" | "IGNORE";
export type NeedEdits = Partial<Record<CapabilityCode, NeedChoice>>;

/** Gabungkan kebutuhan AI dengan pilihan pengguna. */
export function effectiveNeeds(ai: Need[], edits: NeedEdits): (Need & { edited: boolean })[] {
  const out: (Need & { edited: boolean })[] = [];
  const seen = new Set<string>();
  for (const n of ai) {
    seen.add(n.code);
    const c = edits[n.code];
    if (c === "IGNORE") continue;
    const required = c ? c === "REQUIRED" : n.required;
    out.push({ ...n, required, edited: c !== undefined && required !== n.required });
  }
  for (const [code, c] of Object.entries(edits) as [CapabilityCode, NeedChoice][]) {
    if (seen.has(code) || c === "IGNORE") continue;
    out.push({ code, required: c === "REQUIRED", reason: "Ditambahkan oleh pelapor saat peninjauan.", edited: true });
  }
  return out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-4">
      <h3 className="text-base font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

export function ReviewStep({
  analysis,
  edits,
  setEdits,
  onMatch,
  onRedo,
}: {
  analysis: AnalyzeResponse;
  edits: NeedEdits;
  setEdits: (e: NeedEdits) => void;
  onMatch: () => void;
  onRedo: () => void;
}) {
  const r = analysis.result;
  const needs = effectiveNeeds(r.needs, edits);
  const hasRequired = needs.some((n) => n.required);
  const unclear = r.input_quality === "AUDIO_TIDAK_JELAS";
  const aiCodes = new Set(r.needs.map((n) => n.code));
  const addable = CAPABILITY_CODES.filter((c) => !aiCodes.has(c) && !edits[c]);

  return (
    <section aria-labelledby="review-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="review-title" className="flex items-center gap-2 text-xl font-bold">
          <ClipboardList className="h-6 w-6 text-blue-700" aria-hidden />
          Tinjau ringkasan
        </h2>
        {analysis.mode === "MOCK" && <SimBadge>AI simulasi</SimBadge>}
      </div>

      <p className="flex items-start gap-2 rounded-lg border-2 border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Ini perkiraan AI untuk membantu koordinasi – bukan diagnosis, dan bukan bukti rumah sakit menerima pasien. Periksa sebelum melanjutkan.
      </p>

      {(analysis.needs_review || unclear) && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-base text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Perlu peninjauan</p>
            {unclear ? (
              <p>Laporan suara tidak jelas. Sebaiknya rekam ulang di tempat yang lebih tenang atau ketik laporan.</p>
            ) : r.input_quality === "FOTO_TIDAK_TERBACA" ? (
              <p>Foto tidak terbaca; angka dari foto tidak dipakai. Laporan suara tetap dapat dilanjutkan.</p>
            ) : (
              <p>Sebagian hasil tidak dapat dipastikan (mis. urgensi atau kebutuhan). Tinjau kebutuhan di bawah sebelum mencari rumah sakit.</p>
            )}
          </div>
        </div>
      )}

      <Section title="Perkiraan urgensi">
        <UrgencyBadge level={r.urgency.level} />
        <p className="text-base">{r.urgency.reason}</p>
        <OriginChip origin="AI_INTERPRETATION" />
      </Section>

      <Section title="Laporan">
        <p className="text-base">{r.report.summary}</p>
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold">Transkrip {r.report.language ? `(${r.report.language})` : ""}</summary>
          <p className="mt-1 whitespace-pre-wrap">{r.report.transcript}</p>
        </details>
      </Section>

      <Section title="S – Subjective (keluhan)">
        {r.soap.subjective.length === 0 ? (
          <p className="text-slate-600">Tidak ada keluhan yang tertangkap.</p>
        ) : (
          <ul className="space-y-2">
            {r.soap.subjective.map((s, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-2">
                <span className="text-base">{s.value ?? <em className="text-slate-500">Tidak diketahui</em>}</span>
                <OriginChip origin={s.origin} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="O – Objective (angka/temuan)">
        {r.soap.objective.length === 0 ? (
          <p className="text-slate-600">Tidak ada angka yang dilaporkan.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {r.soap.objective.map((o, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-base">
                  <span className="font-semibold">{o.label}:</span>{" "}
                  {o.value != null ? `${o.value}${o.unit ? ` ${o.unit}` : ""}` : <em className="text-slate-500">tidak diketahui</em>}
                </span>
                <OriginChip origin={o.value == null ? "UNKNOWN" : o.origin} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="A – Assessment (perkiraan AI)">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-base">{r.soap.assessment.value ?? <em className="text-slate-500">Tidak dapat dinilai</em>}</p>
          <OriginChip origin={r.soap.assessment.origin} />
        </div>
      </Section>

      <Section title="P – Plan (koordinasi)">
        <ul className="list-disc space-y-1 pl-5 text-base">
          {r.soap.plan.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-600">Plan dibatasi pada langkah koordinasi; tanpa dosis atau terapi.</p>
      </Section>

      {r.unknowns.length > 0 && (
        <Section title="Belum diketahui">
          <ul className="flex flex-wrap gap-2">
            {r.unknowns.map((u, i) => (
              <li key={i} className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm">
                {u}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Kebutuhan fasilitas">
        <p className="text-sm text-slate-700">
          <strong>Wajib</strong>: RS harus READY untuk kebutuhan ini. <strong>Opsional</strong>: hanya memengaruhi urutan. Anda dapat mengubahnya.
        </p>
        <ul className="space-y-3">
          {r.needs.map((n) => {
            const choice: NeedChoice = edits[n.code] ?? (n.required ? "REQUIRED" : "OPTIONAL");
            return (
              <li key={n.code} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {n.code} <span className="font-normal text-slate-700">– {CAPABILITY_LABELS[n.code]}</span>
                    </p>
                    <p className="text-sm text-slate-700">{n.reason}</p>
                  </div>
                  <select
                    aria-label={`Kebutuhan ${n.code}`}
                    value={choice}
                    onChange={(e) => {
                      const v = e.target.value as NeedChoice;
                      const def: NeedChoice = n.required ? "REQUIRED" : "OPTIONAL";
                      const next = { ...edits };
                      if (v === def) delete next[n.code];
                      else next[n.code] = v;
                      setEdits(next);
                    }}
                    className="rounded-lg border-2 border-slate-400 bg-white p-2 text-base"
                  >
                    <option value="REQUIRED">Wajib</option>
                    <option value="OPTIONAL">Opsional</option>
                    <option value="IGNORE">Abaikan</option>
                  </select>
                </div>
                {edits[n.code] && <p className="mt-1 text-xs font-semibold text-blue-800">Diubah oleh pelapor (AI: {n.required ? "wajib" : "opsional"})</p>}
              </li>
            );
          })}
          {(Object.entries(edits) as [CapabilityCode, NeedChoice][])
            .filter(([c]) => !aiCodes.has(c))
            .map(([code, c]) => (
              <li key={code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div>
                  <p className="font-bold">
                    {code} <span className="font-normal text-slate-700">– {CAPABILITY_LABELS[code]}</span>
                  </p>
                  <p className="text-xs font-semibold text-blue-800">Ditambahkan oleh pelapor</p>
                </div>
                <select
                  aria-label={`Kebutuhan tambahan ${code}`}
                  value={c}
                  onChange={(e) => {
                    const next = { ...edits };
                    if (e.target.value === "IGNORE") delete next[code];
                    else next[code] = e.target.value as NeedChoice;
                    setEdits(next);
                  }}
                  className="rounded-lg border-2 border-slate-400 bg-white p-2 text-base"
                >
                  <option value="REQUIRED">Wajib</option>
                  <option value="OPTIONAL">Opsional</option>
                  <option value="IGNORE">Hapus</option>
                </select>
              </li>
            ))}
        </ul>
        {addable.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">Tambah kebutuhan:</span>
            <select
              value=""
              onChange={(e) => e.target.value && setEdits({ ...edits, [e.target.value]: "OPTIONAL" })}
              className="rounded-lg border-2 border-slate-400 bg-white p-2"
            >
              <option value="">Pilih…</option>
              {addable.map((c) => (
                <option key={c} value={c}>
                  {c} – {CAPABILITY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        {!hasRequired && (
          <p role="alert" className="font-semibold text-red-800">
            Minimal satu kebutuhan harus wajib agar pencocokan bermakna.
          </p>
        )}
      </Section>

      {analysis.warnings.length > 0 && (
        <details className="rounded-lg border border-slate-300 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Catatan validasi server ({analysis.warnings.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-slate-500">
        Waktu: penyedia AI {analysis.timing.provider_ms} ms, server total {analysis.timing.total_ms} ms · mode {analysis.mode}
        {analysis.model ? ` · ${analysis.model}` : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onRedo} className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-500 bg-white px-4 py-4 text-lg font-bold">
          <RotateCcw className="h-5 w-5" aria-hidden />
          Ubah / rekam ulang
        </button>
        <button
          type="button"
          disabled={!hasRequired}
          onClick={onMatch}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Search className="h-5 w-5" aria-hidden />
          {unclear ? "Tetap cari RS" : "Cari rumah sakit"}
        </button>
      </div>
    </section>
  );
}
