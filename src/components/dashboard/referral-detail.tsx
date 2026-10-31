"use client";

import { Ban, CheckCircle2, Clock, Loader2, MapPinCheck, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { OriginChip, SimBadge, UrgencyBadge } from "@/components/badges";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { formatEta, timeAgo } from "@/lib/client/format";
import type { DecisionAction, ReferralResponse, ReferralView } from "@/lib/schema/referral";
import { RESERVATION_LABEL, STATUS_LABEL } from "@/lib/schema/referral";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-slate-300 bg-white p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h4>
      {children}
    </div>
  );
}

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
    <article aria-labelledby="detail-title" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="detail-title" className="text-xl font-bold">
            Permintaan rujukan · {timeAgo(r.created_at, now + nowOffsetMs)}
          </h2>
          <p className="text-xs text-slate-600">ID {r.id.slice(0, 8)} · diterima {new Date(r.created_at).toLocaleTimeString("id-ID")}</p>
        </div>
        <UrgencyBadge level={r.urgency} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Block title="Status permintaan">
          <p className="text-lg font-bold">{reqLabel}</p>
          {r.status === "PENDING" && (
            <p className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4" aria-hidden />
              Kedaluwarsa dalam{" "}
              <span className="font-mono font-bold">
                {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
              </span>
            </p>
          )}
          {r.decision_note && <p className="text-sm">Catatan: {r.decision_note}</p>}
          {r.arrived_at && <p className="text-sm">Pasien tiba {new Date(r.arrived_at).toLocaleTimeString("id-ID")}</p>}
        </Block>
        <Block title="Reservasi kuota (terpisah)">
          <p className="text-lg font-bold">{r.reservation_status ? RESERVATION_LABEL[r.reservation_status] : "—"}</p>
          <SimBadge>Kuota simulasi</SimBadge>
          <p className="text-xs text-slate-600">Penguncian slot, bukan konfirmasi penerimaan klinis.</p>
        </Block>
      </div>

      <Block title="ETA & asal">
        {r.eta_seconds != null ? (
          <p className="text-base">
            <strong>{formatEta(r.eta_seconds)}</strong>{" "}
            <span className="text-xs text-slate-600">{r.eta_source === "MOCK" ? "(ETA simulasi)" : "(perkiraan rute OSRM tanpa lalu lintas langsung)"}</span>
          </p>
        ) : (
          <p className="text-base">ETA tidak tersedia</p>
        )}
        <p className="text-xs text-slate-600">
          Titik asal pelapor (dibulatkan): {r.origin.lat.toFixed(3)}, {r.origin.lng.toFixed(3)}
        </p>
      </Block>

      <Block title="Ringkasan laporan (perkiraan AI, bukan diagnosis)">
        <p className="text-base">{ai.report.summary}</p>
        <p className="text-sm">
          <strong>Alasan urgensi:</strong> {ai.urgency.reason}
        </p>
        {ai.input_quality !== "OK" && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            {ai.input_quality === "AUDIO_TIDAK_JELAS" ? "Audio laporan tidak jelas" : "Foto tidak terbaca"}
          </p>
        )}
      </Block>

      <Block title="Kebutuhan layanan">
        <ul className="flex flex-wrap gap-2">
          {r.needs.map((c) => (
            <li key={c} className="rounded border border-slate-400 bg-slate-50 px-2 py-0.5 text-sm font-semibold">
              {c}
              {r.required_needs.includes(c) ? " · wajib" : " · opsional"}
            </li>
          ))}
        </ul>
      </Block>

      <details className="rounded-lg border border-slate-300 bg-white p-3" open>
        <summary className="cursor-pointer text-sm font-bold">SOAP (perkiraan AI; asal data ditandai)</summary>
        <div className="mt-2 space-y-2 text-sm">
          <div>
            <p className="font-semibold">S – Subjective</p>
            <ul className="space-y-1">
              {ai.soap.subjective.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{s.value ?? <em>tidak diketahui</em>}</span>
                  <OriginChip origin={s.origin} />
                </li>
              ))}
              {ai.soap.subjective.length === 0 && <li className="text-slate-600">Tidak ada.</li>}
            </ul>
          </div>
          <div>
            <p className="font-semibold">O – Objective</p>
            <ul className="space-y-1">
              {ai.soap.objective.map((o, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {o.label}: {o.value != null ? `${o.value}${o.unit ? ` ${o.unit}` : ""}` : <em>tidak diketahui</em>}
                  </span>
                  <OriginChip origin={o.value == null ? "UNKNOWN" : o.origin} />
                </li>
              ))}
              {ai.soap.objective.length === 0 && <li className="text-slate-600">Tidak ada angka dilaporkan.</li>}
            </ul>
          </div>
          <div>
            <p className="font-semibold">A – Assessment</p>
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span>{ai.soap.assessment.value ?? <em>tidak dapat dinilai</em>}</span>
              <OriginChip origin={ai.soap.assessment.origin} />
            </p>
          </div>
          <div>
            <p className="font-semibold">P – Plan (koordinasi)</p>
            <ul className="list-disc pl-5">
              {ai.soap.plan.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          {ai.unknowns.length > 0 && (
            <p>
              <strong>Belum diketahui:</strong> {ai.unknowns.join(", ")}
            </p>
          )}
        </div>
      </details>

      {events.length > 0 && (
        <details className="rounded-lg border border-slate-300 bg-white p-3">
          <summary className="cursor-pointer text-sm font-bold">Riwayat kejadian ({events.length})</summary>
          <ol className="mt-2 space-y-0.5 text-xs">
            {events.map((e, i) => (
              <li key={i}>
                {new Date(e.at).toLocaleTimeString("id-ID")} – {e.type}
              </li>
            ))}
          </ol>
        </details>
      )}

      {(r.status === "PENDING" || (r.status === "ACCEPTED" && !r.arrived_at)) && (
        <div className="space-y-2 rounded-xl border-2 border-blue-700 bg-blue-50 p-3">
          <label htmlFor="decision-note" className="block text-sm font-semibold">
            Catatan untuk pelapor {r.status === "ACCEPTED" ? "(wajib bila membatalkan penerimaan)" : "(opsional)"}
          </label>
          <input
            id="decision-note"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-base"
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-800">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {r.status === "PENDING" ? (
              <>
                <button type="button" onClick={() => decide("ACCEPT")} disabled={busy !== null} className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-3 font-bold text-white disabled:bg-slate-400">
                  {busy === "ACCEPT" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  Terima
                </button>
                <button type="button" onClick={() => decide("REJECT")} disabled={busy !== null} className="flex items-center gap-2 rounded-lg bg-red-700 px-5 py-3 font-bold text-white disabled:bg-slate-400">
                  {busy === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                  Tolak
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => decide("ARRIVED")} disabled={busy !== null} className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:bg-slate-400">
                  {busy === "ARRIVED" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPinCheck className="h-4 w-4" aria-hidden />}
                  Pasien tiba
                </button>
                <button type="button" onClick={() => decide("REVOKE")} disabled={busy !== null} className="flex items-center gap-2 rounded-lg border-2 border-red-700 bg-white px-5 py-3 font-bold text-red-800 disabled:opacity-50">
                  {busy === "REVOKE" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
                  Batalkan penerimaan
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-700">
            {r.status === "PENDING"
              ? "Menerima tidak melepas kuota. Kuota tetap ditahan sampai pasien ditandai tiba atau penerimaan dibatalkan."
              : "“Pasien tiba” menandai kuota simulasi terpakai. “Batalkan penerimaan” melepas kuota."}
          </p>
        </div>
      )}
    </article>
  );
}
