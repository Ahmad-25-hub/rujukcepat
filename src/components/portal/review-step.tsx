"use client";

import { Info, RotateCcw, Search, TriangleAlert } from "lucide-react";
import { OriginChip, UrgencyHero } from "@/components/badges";
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

function SoapRow({ letter, title, ai = false, children }: { letter: string; title: string; ai?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 border-b border-[#eef1f5] px-[18px] py-3.5 last:border-b-0">
      <span
        aria-hidden
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] font-extrabold ${ai ? "bg-[#fff1e6] text-[#8a3b00]" : "bg-ink text-white"}`}
      >
        {letter}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1.5 text-[13px] font-bold text-muted">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const CHOICE_LABEL: Record<NeedChoice, string> = { REQUIRED: "Wajib", OPTIONAL: "Opsional", IGNORE: "Abaikan" };

function NeedSeg({ code, value, onChange, removeLabel = "Abaikan" }: { code: string; value: NeedChoice; onChange: (v: NeedChoice) => void; removeLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={`Tingkat kebutuhan ${code}`} className="seg">
      {(["REQUIRED", "OPTIONAL", "IGNORE"] as NeedChoice[]).map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={`seg-btn ${value === k && k === "REQUIRED" ? "!bg-ink !text-white" : ""} ${value === k && k === "IGNORE" ? "!text-brand-ink" : ""}`}
        >
          {k === "IGNORE" ? removeLabel : CHOICE_LABEL[k]}
        </button>
      ))}
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
    <section aria-labelledby="review-title" className="flex flex-1 flex-col gap-3.5">
      <h1 id="review-title" className="sr-only">
        Tinjau ringkasan
      </h1>

      {(analysis.needs_review || unclear) && (
        <div role="alert" className="notice notice-warn anim-rise !text-[15px]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">Perlu peninjauan</p>
            {unclear ? (
              <p>Laporan suara tidak jelas. Sebaiknya rekam ulang di tempat yang lebih tenang atau ketik laporan.</p>
            ) : (
              <p>Sebagian hasil tidak dapat dipastikan (mis. urgensi atau kebutuhan). Tinjau kebutuhan di bawah sebelum mencari rumah sakit.</p>
            )}
          </div>
        </div>
      )}

      <UrgencyHero level={r.urgency.level} reason={r.urgency.reason} />

      <p className="anim-rise anim-d1 flex items-start gap-2.5 px-1 text-sm leading-normal text-ink-2">
        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent" aria-hidden />
        Perkiraan AI untuk koordinasi — bukan diagnosis dan bukan bukti rumah sakit menerima pasien. Periksa sebelum melanjutkan.
      </p>

      <section aria-labelledby="soap-title" className="anim-rise anim-d2 card overflow-hidden rounded-[22px]">
        <div className="flex flex-col gap-2.5 border-b border-[#eef1f5] px-[18px] pb-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="soap-title" className="text-lg font-extrabold">
              Ringkasan SOAP
            </h2>
          </div>
          <p className="text-[15px] leading-relaxed">{r.report.summary}</p>
          <ul aria-label="Keterangan asal data" className="flex flex-wrap gap-1.5">
            <li>
              <OriginChip origin="USER_STATEMENT" />
            </li>
            <li>
              <OriginChip origin="AI_INTERPRETATION" />
            </li>
            <li>
              <OriginChip origin="UNKNOWN" />
            </li>
          </ul>
        </div>

        <SoapRow letter="S" title="Subjective · keluhan">
          {r.soap.subjective.length === 0 ? (
            <p className="text-muted">Tidak ada keluhan yang tertangkap.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {r.soap.subjective.map((s, i) => (
                <li key={i} className="flex items-start justify-between gap-2.5 text-[15px] leading-snug">
                  <span className="min-w-0 flex-1">{s.value ?? <em className="text-muted">Tidak diketahui</em>}</span>
                  <OriginChip origin={s.origin} />
                </li>
              ))}
            </ul>
          )}
        </SoapRow>

        <SoapRow letter="O" title="Objective · angka dan temuan">
          {r.soap.objective.length === 0 ? (
            <p className="text-muted">Tidak ada angka yang dilaporkan.</p>
          ) : (
            <dl className="flex flex-col gap-1.5">
              {r.soap.objective.map((o, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 ${o.value == null ? "border border-dashed border-[#c7ceda]" : "bg-soft"}`}
                >
                  <dt className="min-w-0 text-sm text-ink-2">{o.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5">
                    {o.value != null ? (
                      <>
                        <span className="font-mono text-[15px] font-bold">
                          {o.value}
                          {o.unit ? ` ${o.unit}` : ""}
                        </span>
                        <OriginChip origin={o.origin} />
                      </>
                    ) : (
                      <em className="text-sm text-muted">tidak diketahui</em>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </SoapRow>

        <SoapRow letter="A" title="Assessment · perkiraan AI" ai>
          <div className="flex items-start justify-between gap-2.5">
            <p className="min-w-0 flex-1 text-[15px] leading-normal">{r.soap.assessment.value ?? <em className="text-muted">Tidak dapat dinilai</em>}</p>
            <OriginChip origin={r.soap.assessment.origin} />
          </div>
        </SoapRow>

        <SoapRow letter="P" title="Plan · koordinasi">
          <ul className="flex list-disc flex-col gap-1 pl-[18px] text-[15px] leading-normal">
            {r.soap.plan.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Plan dibatasi pada langkah koordinasi; tanpa dosis atau terapi.</p>
        </SoapRow>

        <details className="group border-t border-[#eef1f5] px-[18px]">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold">Transkrip asli {r.report.language ? `(${r.report.language})` : ""}</summary>
          <p className="mb-3.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{r.report.transcript}</p>
        </details>
      </section>

      {r.unknowns.length > 0 && (
        <section aria-labelledby="unk-title" className="anim-rise anim-d3 px-0.5">
          <h2 id="unk-title" className="eyebrow mb-2">
            Belum diketahui
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {r.unknowns.map((u, i) => (
              <li key={i} className="rounded-full border border-dashed border-faint px-2.5 py-1.5 text-[13px] font-semibold text-ink-2">
                {u}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="need-title" className="anim-rise anim-d4 card flex flex-col gap-3 rounded-[22px] px-[18px] py-4">
        <div>
          <h2 id="need-title" className="text-lg font-extrabold">
            Kebutuhan fasilitas
          </h2>
          <p className="mt-1 text-sm leading-normal text-ink-2">
            <strong>Wajib</strong> harus READY di rumah sakit. <strong>Opsional</strong> hanya memengaruhi urutan. Anda dapat mengubahnya.
          </p>
        </div>
        <ul className="flex flex-col gap-2.5">
          {r.needs.map((n) => {
            const def: NeedChoice = n.required ? "REQUIRED" : "OPTIONAL";
            const choice: NeedChoice = edits[n.code] ?? def;
            return (
              <li key={n.code} className="flex flex-col gap-2.5 rounded-2xl border border-line p-3">
                <div>
                  <p className="flex flex-wrap items-baseline gap-1.5">
                    <span className="rounded-md bg-[#f1f3f6] px-1.5 py-0.5 font-mono text-[13px] font-bold">{n.code}</span>
                    <span className="text-[15px] font-bold">{CAPABILITY_LABELS[n.code]}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-normal text-muted">{n.reason}</p>
                </div>
                <NeedSeg
                  code={n.code}
                  value={choice}
                  onChange={(v) => {
                    const next = { ...edits };
                    if (v === def) delete next[n.code];
                    else next[n.code] = v;
                    setEdits(next);
                  }}
                />
                {edits[n.code] && <p className="text-xs font-bold text-accent-ink">Diubah oleh pelapor · saran AI: {n.required ? "wajib" : "opsional"}</p>}
              </li>
            );
          })}
          {(Object.entries(edits) as [CapabilityCode, NeedChoice][])
            .filter(([c]) => !aiCodes.has(c))
            .map(([code, c]) => (
              <li key={code} className="anim-rise flex flex-col gap-2.5 rounded-2xl border border-[#c9d7fb] bg-accent-tint/60 p-3">
                <div>
                  <p className="flex flex-wrap items-baseline gap-1.5">
                    <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[13px] font-bold">{code}</span>
                    <span className="text-[15px] font-bold">{CAPABILITY_LABELS[code]}</span>
                  </p>
                  <p className="mt-1 text-xs font-bold text-accent-ink">Ditambahkan oleh pelapor</p>
                </div>
                <NeedSeg
                  code={code}
                  value={c}
                  removeLabel="Hapus"
                  onChange={(v) => {
                    const next = { ...edits };
                    if (v === "IGNORE") delete next[code];
                    else next[code] = v;
                    setEdits(next);
                  }}
                />
              </li>
            ))}
        </ul>
        {addable.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            Tambah kebutuhan
            <select value="" onChange={(e) => e.target.value && setEdits({ ...edits, [e.target.value]: "OPTIONAL" })} className="field font-medium">
              <option value="">Pilih kapabilitas…</option>
              {addable.map((c) => (
                <option key={c} value={c}>
                  {c} – {CAPABILITY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        {!hasRequired && (
          <p role="alert" className="notice notice-error font-semibold">
            Minimal satu kebutuhan harus wajib agar pencocokan bermakna.
          </p>
        )}
      </section>

      {analysis.warnings.length > 0 && (
        <details className="card px-4 text-sm">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold">Catatan validasi server ({analysis.warnings.length})</summary>
          <ul className="mb-3 list-disc space-y-1 pl-5 text-ink-2">
            {analysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <p className="px-1 text-xs text-muted">
        Penyedia AI {analysis.timing.provider_ms} ms · server {analysis.timing.total_ms} ms · mode {analysis.mode}
        {analysis.model ? ` · ${analysis.model}` : ""}
      </p>

      <div className="action-bar mt-auto flex gap-2.5">
        <button type="button" onClick={onRedo} aria-label="Ubah atau rekam ulang" title="Ubah / rekam ulang" className="btn btn-secondary btn-lg w-14 shrink-0 !px-0">
          <RotateCcw className="h-[22px] w-[22px]" aria-hidden />
        </button>
        <button type="button" disabled={!hasRequired} onClick={onMatch} className="btn btn-primary btn-lg flex-1">
          <Search className="h-5 w-5" aria-hidden />
          {!hasRequired ? "Pilih kebutuhan wajib" : unclear ? "Tetap cari RS" : "Cari rumah sakit"}
        </button>
      </div>
    </section>
  );
}
