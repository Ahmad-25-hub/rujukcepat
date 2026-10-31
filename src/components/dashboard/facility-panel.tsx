"use client";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { CapStatusChip } from "@/components/badges";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { Facility } from "@/lib/schema/api";
import { CAPABILITY_CODES, CAPABILITY_LABELS, CAPABILITY_STATUS, type CapabilityCode, type CapabilityStatus } from "@/lib/schema/enums";
import type { FacilityPatch } from "@/lib/schema/facility";

// Label pendek + warna status terpilih; nilai lengkap tetap di title dan pembaca layar.
const SEG_LABEL: Record<CapabilityStatus, string> = { READY: "Ready", PENUH: "Penuh", MAINTENANCE: "Maint." };
const SEG_ON: Record<CapabilityStatus, string> = {
  READY: "!bg-ok !text-white",
  PENUH: "!bg-brand !text-white",
  MAINTENANCE: "!bg-signal-yellow !text-[#3b2a00]",
};

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
  // Isian kapasitas di-reset (key) setiap data server berubah, mis. diubah petugas lain di RS yang sama.
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
    <section aria-labelledby="fac-panel-title" className="card flex flex-col gap-4 rounded-[22px] p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fac-panel-title" className="text-lg font-extrabold tracking-tight">
          Kesiapan {facility.short_name}
        </h2>
      </div>
      <p className="-mt-2 text-[13px] leading-normal text-ink-2">
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

      <div>
        <h3 className="eyebrow mb-1">Status kapabilitas</h3>
        <ul className="divide-y divide-[#eef1f5]">
          {CAPABILITY_CODES.map((code: CapabilityCode) => {
            const cap = facility.capabilities.find((c) => c.code === code);
            if (!cap) {
              return (
                <li key={code} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 py-2.5 text-sm text-muted">
                  <span>
                    <strong className="font-mono text-[13px]">{code}</strong>
                  </span>
                  <span className="text-xs">Tidak ditawarkan</span>
                </li>
              );
            }
            const stale = Date.parse(serverTime) - Date.parse(cap.updated_at) > staleAfterMinutes * 60_000;
            return (
              <li key={code} className="flex flex-col gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm" title={CAPABILITY_LABELS[code]}>
                    <strong className="font-mono text-[13px]">{code}</strong>
                    <span className="sr-only"> – {CAPABILITY_LABELS[code]}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <CapStatusChip status={stale ? "KEDALUWARSA" : cap.status} />
                    {stale ? `tercatat ${cap.status}, ` : ""}diperbarui {timeAgo(cap.updated_at, Date.parse(serverTime))}
                  </p>
                </div>
                <div className="seg" role="group" aria-label={`Status ${code}`}>
                  {CAPABILITY_STATUS.map((s: CapabilityStatus) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={cap.status === s && !stale}
                      disabled={busy !== null}
                      onClick={() => patch(`${code}:${s}`, { capabilities: [{ code, status: s }] }, `${code} → ${s}`)}
                      title={s}
                      className={`seg-btn !text-[13px] ${cap.status === s && !stale ? SEG_ON[s] : ""}`}
                    >
                      {busy === `${code}:${s}` ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : SEG_LABEL[s]}
                    </button>
                  ))}
                  {stale && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => patch(`${code}:confirm`, { capabilities: [{ code, status: cap.status }] }, `${code} dikonfirmasi ${cap.status}`)}
                      className="btn col-span-full border-[#e2b33b] bg-[#fff8e6] text-sm text-warn-ink hover:bg-warn-tint"
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
      <div className="flex flex-col gap-2.5 rounded-2xl bg-soft p-3.5">
        <h3 className="eyebrow">Kuota pasien rujukan</h3>
        <p className="flex items-baseline gap-1" aria-hidden>
          <span className="text-[34px] font-extrabold leading-none tracking-tight">{facility.available_slots}</span>
          <span className="text-lg font-bold text-muted">/ {facility.total_slots} tersedia</span>
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">
            Tersedia
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={avail}
              onChange={(e) => setAvail(e.target.value)}
              className="field mt-1 w-24"
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
              className="field mt-1 w-24"
            />
          </label>
          <button
            type="button"
            disabled={disabled || capInvalid || !capDirty}
            onClick={() => onSave(totalN, availN)}
            className="btn btn-primary"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Simpan kapasitas
          </button>
        </div>
        {capInvalid && (
          <p role="alert" className="text-sm font-semibold text-brand-ink">
            Tersedia tidak boleh negatif atau melebihi total.
          </p>
        )}
        <p className="text-xs text-muted">
          Diperbarui {timeAgo(facility.capacity_updated_at, Date.parse(serverTime))}. Kuota tidak berkurang otomatis saat pelapor memilih RS ini; perbarui angka ini setiap kali kondisi IGD berubah. Kuota 0 membuat RS tidak
          direkomendasikan.
        </p>
      </div>
  );
}
