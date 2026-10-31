"use client";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { CapStatusChip, SimBadge } from "@/components/badges";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { Facility } from "@/lib/schema/api";
import { CAPABILITY_CODES, CAPABILITY_LABELS, CAPABILITY_STATUS, type CapabilityCode, type CapabilityStatus } from "@/lib/schema/enums";
import type { FacilityPatch } from "@/lib/schema/referral";

export type FacilityToast = { ok: boolean; message: string };

export function FacilityPanel({
  facility,
  staleAfterMinutes,
  serverTime,
  onUpdated,
}: {
  facility: Facility;
  staleAfterMinutes: number;
  serverTime: string;
  onUpdated: (t: FacilityToast) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  // Isian kapasitas di-reset (key) setiap data server berubah, mis. kuota berubah karena rujukan masuk.
  const sig = `${facility.total_slots}/${facility.available_slots}/${facility.capacity_updated_at}`;

  async function patch(key: string, body: FacilityPatch, okMsg: string) {
    if (busy) return;
    setBusy(key);
    const t0 = performance.now();
    try {
      await apiFetch(`/api/facilities/${facility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onUpdated({ ok: true, message: `${okMsg} (${Math.round(performance.now() - t0)} ms).` });
    } catch (e) {
      onUpdated({ ok: false, message: e instanceof ApiClientError ? e.message : "Pembaruan gagal. Coba lagi." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="fac-panel-title" className="space-y-4 rounded-xl border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fac-panel-title" className="text-xl font-bold">
          Kesiapan {facility.short_name}
        </h2>
        <SimBadge>Status simulasi</SimBadge>
      </div>
      <p className="text-sm text-slate-700">
        Perubahan langsung memengaruhi rekomendasi di portal pelapor. Status lebih tua dari {Math.round(staleAfterMinutes / 60)} jam dianggap kedaluwarsa (tidak dianggap READY) sampai
        dikonfirmasi ulang.
      </p>

      <CapacityEditor
        key={sig}
        facility={facility}
        serverTime={serverTime}
        busy={busy === "cap"}
        disabled={busy !== null}
        onSave={(total, avail) => patch("cap", { total_slots: total, available_slots: avail }, "Kapasitas diperbarui")}
      />

      <div className="space-y-2">
        <h3 className="text-base font-bold">Status kapabilitas</h3>
        <ul className="divide-y divide-slate-200">
          {CAPABILITY_CODES.map((code: CapabilityCode) => {
            const cap = facility.capabilities.find((c) => c.code === code);
            if (!cap) {
              return (
                <li key={code} className="flex items-center justify-between gap-2 py-2 text-sm text-slate-600">
                  <span>
                    <strong>{code}</strong> – {CAPABILITY_LABELS[code]}
                  </span>
                  <span>Tidak ditawarkan (data simulasi)</span>
                </li>
              );
            }
            const stale = Date.parse(serverTime) - Date.parse(cap.updated_at) > staleAfterMinutes * 60_000;
            return (
              <li key={code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    <strong>{code}</strong> – {CAPABILITY_LABELS[code]}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <CapStatusChip status={stale ? "KEDALUWARSA" : cap.status} />
                    {stale ? `tercatat ${cap.status}, ` : ""}diperbarui {timeAgo(cap.updated_at, Date.parse(serverTime))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Status ${code}`}>
                  {CAPABILITY_STATUS.map((s: CapabilityStatus) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={cap.status === s && !stale}
                      disabled={busy !== null}
                      onClick={() => patch(`${code}:${s}`, { capabilities: [{ code, status: s }] }, `${code} → ${s}`)}
                      className={`min-w-[5.5rem] rounded-lg border-2 px-3 py-2 text-sm font-bold disabled:opacity-60 ${
                        cap.status === s && !stale ? "border-blue-800 bg-blue-700 text-white" : "border-slate-400 bg-white text-slate-900"
                      }`}
                    >
                      {busy === `${code}:${s}` ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : s}
                    </button>
                  ))}
                  {stale && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => patch(`${code}:confirm`, { capabilities: [{ code, status: cap.status }] }, `${code} dikonfirmasi ${cap.status}`)}
                      className="flex items-center gap-1 rounded-lg border-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      Konfirmasi {cap.status}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function CapacityEditor({
  facility,
  serverTime,
  busy,
  disabled,
  onSave,
}: {
  facility: Facility;
  serverTime: string;
  busy: boolean;
  disabled: boolean;
  onSave: (total: number, avail: number) => void;
}) {
  const [total, setTotal] = useState(String(facility.total_slots));
  const [avail, setAvail] = useState(String(facility.available_slots));
  const totalN = Number(total);
  const availN = Number(avail);
  const capInvalid = !Number.isInteger(totalN) || !Number.isInteger(availN) || totalN < 0 || availN < 0 || availN > totalN;
  const capDirty = totalN !== facility.total_slots || availN !== facility.available_slots;
  return (
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <h3 className="text-base font-bold">Kuota rujukan masuk</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Tersedia
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={avail}
              onChange={(e) => setAvail(e.target.value)}
              className="mt-1 block w-24 rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-base"
            />
          </label>
          <label className="text-sm font-semibold">
            Total
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="mt-1 block w-24 rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-base"
            />
          </label>
          <button
            type="button"
            disabled={disabled || capInvalid || !capDirty}
            onClick={() => onSave(totalN, availN)}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-bold text-white disabled:bg-slate-400"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Simpan kapasitas
          </button>
        </div>
        {capInvalid && (
          <p role="alert" className="text-sm font-semibold text-red-800">
            Tersedia tidak boleh negatif atau melebihi total.
          </p>
        )}
        <p className="text-xs text-slate-600">
          Diperbarui {timeAgo(facility.capacity_updated_at, Date.parse(serverTime))}. Mengubah angka ini tidak mengubah reservasi yang sedang ditahan oleh rujukan PENDING/ACCEPTED.
        </p>
      </div>
  );
}
