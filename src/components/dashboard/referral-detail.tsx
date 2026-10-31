"use client";

import { Ban, CheckCircle2, Clock, Loader2, MapPinCheck, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { OriginChip, UrgencyBadge } from "@/components/badges";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { formatEta, timeAgo } from "@/lib/client/format";
import type { DecisionAction, ReferralResponse, ReferralView } from "@/lib/schema/referral";
import { RESERVATION_LABEL, STATUS_LABEL } from "@/lib/schema/referral";

export type DecisionResult = { ok: boolean; message: string; ms: number };

export function ReferralDetail({
  referral,
  nowOffsetMs,
  onDecision,
}: {
  referral: ReferralView;
  nowOffsetMs: number;
  onDecision: (r: DecisionResult) => void;
}) {
  const r = referral;
  const ai = r.ai_result;
  const [events, setEvents] = useState<{ type: string; at: string }[]>([]);
  const [busy, setBusy] = useState<DecisionAction | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Riwayat kejadian dari server; diambil ulang tiap rujukan berubah (updated_at).
  useEffect(() => {
    let cancelled = false;
    apiFetch<ReferralResponse>(`/api/referrals/${r.id}`).then(
      (d) => {
        if (!cancelled) setEvents(d.referral.events ?? []);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [r.id, r.updated_at]);

  async function decide(action: DecisionAction) {
    if (busy) return;
    if (action === "REVOKE" && !note.trim()) {
      setError("Isi alasan pembatalan penerimaan terlebih dahulu.");
      return;
    }
    setBusy(action);
    setError(null);
    const t0 = performance.now();
    try {
      await apiFetch<ReferralResponse>(`/api/referrals/${r.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const ms = Math.round(performance.now() - t0);
      const label = { ACCEPT: "Permintaan diterima", REJECT: "Permintaan ditolak", ARRIVED: "Pasien ditandai tiba", REVOKE: "Penerimaan dibatalkan" }[action];
      setNote("");
      onDecision({ ok: true, message: `${label}. Tersimpan di server (${ms} ms).`, ms });
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Aksi gagal. Coba lagi.";
      setError(msg);
      onDecision({ ok: false, message: msg, ms: Math.round(performance.now() - t0) });
    } finally {
      setBusy(null);
    }
  }

  const left = Math.max(0, Math.floor((Date.parse(r.expires_at) - (now + nowOffsetMs)) / 1000));
  const reqLabel = STATUS_LABEL[r.status];

  return (
    <article aria-labelledby="detail-title" className="card overflow-hidden rounded-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            ID <span className="font-mono">{r.id.slice(0, 8)}</span> · masuk {new Date(r.created_at).toLocaleTimeString("id-ID")}
          </p>
          <h2 id="detail-title" className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight">
            Permintaan rujukan · {timeAgo(r.created_at, now + nowOffsetMs)}
          </h2>
        </div>
        <UrgencyBadge level={r.urgency} size="lg" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] border-b border-[#eef1f5] [&>*]:border-[#eef1f5] [&>*:not(:last-child)]:border-r">
        <div className="px-5 py-3.5">
          <p className="text-xs font-bold text-muted">Status permintaan</p>
          <p className="mt-1 text-base font-extrabold leading-tight">{reqLabel}</p>
          {r.arrived_at && <p className="mt-1 text-xs text-ink-2">Pasien tiba {new Date(r.arrived_at).toLocaleTimeString("id-ID")}</p>}
        </div>
        <div className="px-5 py-3.5">
          <p className="flex items-center gap-1 text-xs font-bold text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {r.status === "PENDING" ? "Kedaluwarsa dalam" : "Diputuskan"}
          </p>
          <p className="mt-1 font-mono text-lg font-bold">
            {r.status === "PENDING"
              ? `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`
              : r.decided_at
                ? new Date(r.decided_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                : "—"}
          </p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-xs font-bold text-muted">Reservasi kuota</p>
          <p className="mt-1 text-base font-extrabold leading-tight">{r.reservation_status ? RESERVATION_LABEL[r.reservation_status] : "—"}</p>
          <p className="mt-1 text-[11px] text-muted">Slot simulasi, bukan konfirmasi klinis</p>
        </div>
        <div className="px-5 py-3.5">
          <p className="text-xs font-bold text-muted">ETA rute</p>
          <p className="mt-1 text-base font-extrabold leading-tight">{r.eta_seconds != null ? formatEta(r.eta_seconds) : "Tidak tersedia"}</p>
          {r.eta_seconds != null && <p className="mt-1 text-[11px] text-muted">{r.eta_source === "MOCK" ? "ETA simulasi" : "OSRM, tanpa lalu lintas langsung"}</p>}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px] px-5 py-[18px]">
        <div>
          <h3 className="eyebrow mb-1.5">Laporan · perkiraan AI</h3>
          <p className="text-[15px] leading-relaxed">{ai.report.summary}</p>
          <p className="mt-2 text-sm text-ink-2">
            <strong className="text-ink">Alasan urgensi:</strong> {ai.urgency.reason}
          </p>
          {ai.input_quality !== "OK" && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-warn-ink">
              <ShieldAlert className="h-4 w-4" aria-hidden />
              {ai.input_quality === "AUDIO_TIDAK_JELAS" ? "Audio laporan tidak jelas" : "Foto tidak terbaca"}
            </p>
          )}
        </div>
        <div>
          <h3 className="eyebrow mb-1.5">Kebutuhan layanan</h3>
          <ul className="flex flex-wrap gap-1.5">
            {r.needs.map((c) => {
              const req = r.required_needs.includes(c);
              return (
                <li key={c} className={`rounded-lg px-2 py-1 font-mono text-xs font-bold ${req ? "bg-ink text-white" : "bg-[#f1f3f6] text-ink-2"}`}>
                  {c} · {req ? "wajib" : "opsional"}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Titik asal pelapor (dibulatkan): <span className="font-mono">{r.origin.lat.toFixed(3)}, {r.origin.lng.toFixed(3)}</span>
          </p>
        </div>
      </div>

      <details className="border-t border-[#eef1f5] px-5" open>
        <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold">SOAP (perkiraan AI; asal data ditandai)</summary>
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 text-sm">
          <div>
            <p className="mb-1.5 font-bold text-muted">S · Subjective</p>
            <ul className="flex flex-col gap-1.5">
              {ai.soap.subjective.map((s, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">{s.value ?? <em className="text-muted">tidak diketahui</em>}</span>
                  <OriginChip origin={s.origin} />
                </li>
              ))}
              {ai.soap.subjective.length === 0 && <li className="text-muted">Tidak ada.</li>}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-bold text-muted">O · Objective</p>
            <ul className="flex flex-col gap-1.5">
              {ai.soap.objective.map((o, i) => (
                <li key={i} className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 ${o.value == null ? "border border-dashed border-[#c7ceda]" : "bg-soft"}`}>
                  <span className="min-w-0 text-ink-2">{o.label}</span>
                  {o.value != null ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-mono font-bold text-ink">
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
              {ai.soap.objective.length === 0 && <li className="text-muted">Tidak ada angka dilaporkan.</li>}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-bold text-muted">A · Assessment</p>
            <p className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">{ai.soap.assessment.value ?? <em className="text-muted">tidak dapat dinilai</em>}</span>
              <OriginChip origin={ai.soap.assessment.origin} />
            </p>
          </div>
          <div>
            <p className="mb-1.5 font-bold text-muted">P · Plan (koordinasi)</p>
            <ul className="list-disc pl-5">
              {ai.soap.plan.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          {ai.unknowns.length > 0 && (
            <p className="text-ink-2">
              <strong className="text-ink">Belum diketahui:</strong> {ai.unknowns.join(", ")}
            </p>
          )}
        </div>
      </details>

      {events.length > 0 && (
        <details className="border-t border-[#eef1f5] px-5">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold">Riwayat kejadian ({events.length})</summary>
          <ol className="mb-4 flex flex-col gap-1 text-xs">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-muted">{new Date(e.at).toLocaleTimeString("id-ID")}</span>
                <span>{e.type}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {(r.status === "PENDING" || (r.status === "ACCEPTED" && !r.arrived_at)) && (
        <div className={`flex flex-col gap-2.5 border-t px-5 py-4 ${r.status === "ACCEPTED" ? "border-[#cfebdd] bg-ok-tint" : "border-[#eef1f5] bg-soft"}`}>
          <div className="flex flex-wrap items-end gap-2.5">
            <label htmlFor="decision-note" className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 text-[13px] font-bold text-ink-2">
              Catatan untuk pelapor {r.status === "ACCEPTED" ? "(wajib bila membatalkan penerimaan)" : "(opsional)"}
              <input
                id="decision-note"
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder={r.status === "PENDING" ? "mis. masuk lewat pintu IGD utama" : ""}
                className="field font-medium"
              />
            </label>
            {r.status === "PENDING" ? (
              <>
                <button type="button" onClick={() => decide("REJECT")} disabled={busy !== null} className="btn btn-danger min-h-12 flex-[1_1_100px]">
                  {busy === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                  Tolak
                </button>
                <button type="button" onClick={() => decide("ACCEPT")} disabled={busy !== null} className="btn btn-ok min-h-12 flex-[2_1_180px]">
                  {busy === "ACCEPT" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  Terima rujukan
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => decide("REVOKE")} disabled={busy !== null} className="btn btn-danger min-h-12 flex-[1_1_160px]">
                  {busy === "REVOKE" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
                  Batalkan penerimaan
                </button>
                <button type="button" onClick={() => decide("ARRIVED")} disabled={busy !== null} className="btn btn-primary min-h-12 flex-[1_1_160px]">
                  {busy === "ARRIVED" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPinCheck className="h-4 w-4" aria-hidden />}
                  Tandai pasien tiba
                </button>
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="notice notice-error font-semibold">
              {error}
            </p>
          )}
          {r.decision_note && <p className="text-sm text-ink-2">Catatan tersimpan: “{r.decision_note}”</p>}
          <p className="text-xs text-ink-2">
            {r.status === "PENDING"
              ? "Menerima tidak melepas kuota. Kuota tetap ditahan sampai pasien ditandai tiba atau penerimaan dibatalkan."
              : "“Pasien tiba” menandai kuota simulasi terpakai. “Batalkan penerimaan” melepas kuota."}
          </p>
        </div>
      )}
      {r.status !== "PENDING" && !(r.status === "ACCEPTED" && !r.arrived_at) && r.decision_note && (
        <p className="border-t border-[#eef1f5] bg-soft px-5 py-3.5 text-sm text-ink-2">Catatan petugas: “{r.decision_note}”</p>
      )}
    </article>
  );
}
