"use client";

import { AlertTriangle, Ban, CheckCircle2, Clock, Hourglass, Loader2, RefreshCw, ShieldCheck, WifiOff, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SimBadge, UrgencyBadge } from "@/components/badges";
import { SpeakPanel } from "@/components/speak-panel";
import { SyncBadge } from "@/components/sync-badge";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { formatEta, timeAgo } from "@/lib/client/format";
import { buildGuidance } from "@/lib/client/guidance";
import { useSync } from "@/lib/client/sync";
import { RESERVATION_LABEL, STATUS_LABEL, type ReferralResponse, type ReferralView } from "@/lib/schema/referral";

const ACTIVE_REFERRAL_KEY = "rc_active_referral";
const activeListeners = new Set<() => void>();

/** Id rujukan terakhir milik perangkat ini (hanya id, bukan data pasien). */
export function setActiveReferral(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_REFERRAL_KEY, id);
    else localStorage.removeItem(ACTIVE_REFERRAL_KEY);
  } catch {
    // penyimpanan tidak tersedia; tidak masalah
  }
  activeListeners.forEach((l) => l());
}

function readActiveReferral(): string | null {
  try {
    return localStorage.getItem(ACTIVE_REFERRAL_KEY);
  } catch {
    return null;
  }
}

function subscribeActive(l: () => void) {
  activeListeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    activeListeners.delete(l);
    window.removeEventListener("storage", l);
  };
}

export function useActiveReferral(): string | null {
  return useSyncExternalStore(subscribeActive, readActiveReferral, () => null);
}

const STATUS_STYLE: Record<ReferralView["status"], { cls: string; icon: React.ReactNode }> = {
  PENDING: { cls: "border-amber-500 bg-amber-50 text-amber-950", icon: <Hourglass className="h-7 w-7" aria-hidden /> },
  ACCEPTED: { cls: "border-green-700 bg-green-50 text-green-950", icon: <CheckCircle2 className="h-7 w-7" aria-hidden /> },
  REJECTED: { cls: "border-red-700 bg-red-50 text-red-950", icon: <XCircle className="h-7 w-7" aria-hidden /> },
  CANCELLED: { cls: "border-slate-500 bg-slate-100 text-slate-900", icon: <Ban className="h-7 w-7" aria-hidden /> },
  EXPIRED: { cls: "border-slate-500 bg-slate-100 text-slate-900", icon: <Clock className="h-7 w-7" aria-hidden /> },
};

function Countdown({ expiresAt, offsetMs, onZero }: { expiresAt: string; offsetMs: number; onZero: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(expiresAt) - (now + offsetMs)) / 1000));
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onZero();
    }
  }, [left, onZero]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className="font-mono text-lg font-bold" aria-label={`Sisa waktu ${mm} menit ${ss} detik`}>
      {mm}:{ss}
    </span>
  );
}

export function StatusStep({
  referralId,
  supabaseChannels,
  onBack,
  onNew,
  onGone,
}: {
  referralId: string;
  supabaseChannels: string[] | null;
  onBack: (() => void) | null;
  onNew: () => void;
  onGone: () => void;
}) {
  const [data, setData] = useState<{ referral: ReferralView; offsetMs: number } | null>(null);
  const [error, setError] = useState<{ message: string; gone: boolean } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [online, setOnline] = useState(true);

  const load = useCallback(
    () =>
      apiFetch<ReferralResponse>(`/api/referrals/${referralId}`).then(
        (d) => {
          setData({ referral: d.referral, offsetMs: Date.parse(d.server_time) - Date.now() });
          setError(null);
        },
        (e) => {
          const gone = e instanceof ApiClientError && (e.status === 404 || e.status === 403 || e.status === 401);
          setError({ message: e instanceof ApiClientError ? e.message : "Status rujukan tidak dapat dimuat.", gone });
        },
      ),
    [referralId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  const sync = useSync({ onChange: () => void load(), supabaseChannels });

  async function cancel() {
    setCancelling(true);
    try {
      const d = await apiFetch<ReferralResponse>(`/api/referrals/${referralId}/cancel`, { method: "POST" });
      setData({ referral: d.referral, offsetMs: Date.parse(d.server_time) - Date.now() });
      setError(null);
      setConfirmCancel(false);
    } catch (e) {
      setError({ message: e instanceof ApiClientError ? e.message : "Pembatalan gagal. Coba lagi.", gone: false });
      void load();
    } finally {
      setCancelling(false);
    }
  }

  if (!data) {
    if (error) {
      return (
        <div role="alert" className="space-y-3 rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-base text-red-900">{error.message}</p>
          <div className="flex gap-2">
            {!error.gone && (
              <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-3 font-bold text-white">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Coba lagi
              </button>
            )}
            <button type="button" onClick={error.gone ? onGone : onNew} className="rounded-lg border-2 border-slate-400 bg-white px-4 py-3 font-bold">
              {error.gone ? "Mulai laporan baru" : "Kembali"}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div role="status" className="flex items-center justify-center gap-3 rounded-xl bg-white p-10 text-lg">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Memuat status rujukan…
      </div>
    );
  }

  const r = data.referral;
  const st = STATUS_STYLE[r.status];
  const terminal = r.status !== "PENDING" && r.status !== "ACCEPTED";

  return (
    <section aria-labelledby="status-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="status-title" className="text-xl font-bold">
          Status permintaan rujukan
        </h2>
        <SyncBadge sync={sync} />
      </div>

      {!online && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">
          <WifiOff className="h-4 w-4" aria-hidden />
          Anda offline – status di bawah mungkin sudah tidak mutakhir.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          {error.message}
        </p>
      )}

      <div className={`space-y-2 rounded-xl border-2 p-4 ${st.cls}`} aria-live="polite">
        <p className="flex items-center gap-3 text-2xl font-extrabold">
          {st.icon}
          {STATUS_LABEL[r.status]}
        </p>
        <p className="text-base">
          Tujuan: <strong>{r.hospital.name}</strong>
        </p>
        {r.status === "PENDING" && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Clock className="h-4 w-4" aria-hidden />
            Kedaluwarsa dalam <Countdown key={r.id} expiresAt={r.expires_at} offsetMs={data.offsetMs} onZero={() => void load()} />
            <span>bila belum dikonfirmasi petugas.</span>
          </p>
        )}
        {r.decision_note && (
          <p className="text-sm">
            Catatan petugas: <em>{r.decision_note}</em>
          </p>
        )}
        {r.status === "ACCEPTED" && (
          <p className="text-sm">
            Diterima {timeAgo(r.decided_at ?? r.updated_at)}. {r.arrived_at ? "Petugas telah menandai pasien tiba." : "Kuota tetap ditahan sampai petugas menandai pasien tiba atau membatalkan penerimaan."}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-slate-300 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Status permintaan</p>
          <p className="text-base font-semibold">{STATUS_LABEL[r.status]}</p>
          <p className="text-xs text-slate-600">Keputusan petugas IGD; bukan hasil AI.</p>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-300 bg-white p-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
            Kuota rujukan <SimBadge>Simulasi</SimBadge>
          </p>
          <p className="text-base font-semibold">{r.reservation_status ? RESERVATION_LABEL[r.reservation_status] : "Tidak ada reservasi"}</p>
          <p className="text-xs text-slate-600">Penguncian slot simulasi, bukan konfirmasi penerimaan klinis.</p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-300 bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Ringkasan laporan (perkiraan AI)</p>
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge level={r.urgency} />
          {r.eta_seconds != null ? (
            <span className="text-sm">
              <strong>{formatEta(r.eta_seconds)}</strong> {r.eta_source === "MOCK" ? "(ETA simulasi)" : "(perkiraan rute OSRM tanpa lalu lintas langsung)"}
            </span>
          ) : (
            <span className="text-sm text-slate-700">ETA tidak tersedia</span>
          )}
        </div>
        <p className="text-sm">{r.ai_result.report.summary}</p>
        <p className="flex items-start gap-2 text-xs text-slate-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Hasil AI adalah perkiraan awal yang perlu ditinjau tenaga kesehatan, bukan diagnosis dan bukan bukti rumah sakit menerima pasien.
        </p>
      </div>

      <SpeakPanel lines={buildGuidance(r)} />

      {r.status === "PENDING" && (
        <div className="space-y-2">
          {!confirmCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="w-full rounded-xl border-2 border-red-700 bg-white px-4 py-3 text-base font-bold text-red-800"
            >
              Batalkan permintaan
            </button>
          ) : (
            <div role="alertdialog" aria-label="Konfirmasi pembatalan" className="space-y-2 rounded-xl border-2 border-red-700 bg-red-50 p-3">
              <p className="text-base font-semibold text-red-950">Batalkan permintaan rujukan ke {r.hospital.short_name}? Kuota simulasi akan dilepas.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={cancelling || !online}
                  className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-3 font-bold text-white disabled:bg-slate-400"
                >
                  {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Ya, batalkan
                </button>
                <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-lg border-2 border-slate-500 bg-white px-4 py-3 font-bold">
                  Tidak
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {terminal && onBack && (
        <button type="button" onClick={onBack} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-base font-bold text-white">
          Pilih tujuan lain
        </button>
      )}
      <button type="button" onClick={onNew} className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 text-base font-bold">
        Buat laporan baru
      </button>

      <p className="flex items-center gap-2 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Status ini dibaca dari server; tidak disimpan offline.
      </p>
    </section>
  );
}
