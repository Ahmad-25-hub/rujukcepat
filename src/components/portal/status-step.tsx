"use client";

import { AlertTriangle, Ban, CheckCircle2, Clock, Hourglass, Loader2, RefreshCw, ShieldCheck, WifiOff, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { UrgencyBadge } from "@/components/badges";
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

const STATUS_STYLE: Record<ReferralView["status"], { cls: string; iconCls: string; icon: React.ReactNode }> = {
  PENDING: { cls: "card", iconCls: "", icon: <Hourglass className="h-7 w-7" aria-hidden /> },
  ACCEPTED: { cls: "bg-ok text-white", iconCls: "bg-white text-ok", icon: <CheckCircle2 className="h-9 w-9" aria-hidden /> },
  REJECTED: { cls: "card !border-[#f3b8c2]", iconCls: "bg-brand-tint text-brand", icon: <XCircle className="h-7 w-7" aria-hidden /> },
  CANCELLED: { cls: "card", iconCls: "bg-[#eef1f5] text-ink-2", icon: <Ban className="h-7 w-7" aria-hidden /> },
  EXPIRED: { cls: "card", iconCls: "bg-[#eef1f5] text-ink-2", icon: <Clock className="h-7 w-7" aria-hidden /> },
};

/** Cincin hitung mundur: teks mm:ss tetap ada, cincin hanya pelengkap visual. */
function Countdown({ expiresAt, createdAt, offsetMs, onZero }: { expiresAt: string; createdAt: string; offsetMs: number; onZero: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(expiresAt) - (now + offsetMs)) / 1000));
  const total = Math.max(1, (Date.parse(expiresAt) - Date.parse(createdAt)) / 1000);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      onZero();
    }
  }, [left, onZero]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const C = 2 * Math.PI * 48;
  return (
    <div className="relative h-[132px] w-[132px]">
      <svg width="132" height="132" viewBox="0 0 120 120" aria-hidden className="-rotate-90">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#f1e4c4" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="#c78a00"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(1, left / total))}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[28px] font-bold tracking-tight" aria-label={`Sisa waktu ${mm} menit ${ss} detik`}>
          {mm}:{ss}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">sisa waktu</span>
      </span>
    </div>
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
        <div role="alert" className="space-y-3 rounded-xl border-2 border-[#f3c6ce] bg-brand-tint p-4">
          <p className="text-base text-brand-ink">{error.message}</p>
          <div className="flex gap-2">
            {!error.gone && (
              <button type="button" onClick={() => void load()} className="btn btn-brand">
                <RefreshCw className="h-4 w-4" aria-hidden />
                Coba lagi
              </button>
            )}
            <button type="button" onClick={error.gone ? onGone : onNew} className="btn btn-secondary">
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
  const accepted = r.status === "ACCEPTED";

  return (
    <section aria-labelledby="status-title" className="flex flex-1 flex-col gap-3.5">
      <div className="flex justify-end">
        <SyncBadge sync={sync} />
      </div>

      {!online && (
        <p role="alert" className="notice notice-error font-semibold">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Anda offline – status di bawah mungkin sudah tidak mutakhir.
        </p>
      )}
      {error && (
        <p role="alert" className="notice notice-warn">
          {error.message}
        </p>
      )}

      <div
        key={r.status}
        className={`anim-rise flex flex-col items-center gap-3.5 rounded-3xl px-[18px] py-6 text-center ${st.cls}`}
        aria-live="polite"
      >
        {r.status === "PENDING" ? (
          <Countdown key={r.id} expiresAt={r.expires_at} createdAt={r.created_at} offsetMs={data.offsetMs} onZero={() => void load()} />
        ) : (
          <span className={`anim-pop grid place-items-center rounded-full ${accepted ? "h-[76px] w-[76px]" : "h-14 w-14 !rounded-2xl"} ${st.iconCls}`}>{st.icon}</span>
        )}
        <div>
          <h1 id="status-title" className="text-2xl font-extrabold leading-tight tracking-tight">
            {STATUS_LABEL[r.status]}
          </h1>
          <p className={`mt-1.5 text-base ${accepted ? "text-white/90" : "text-ink-2"}`}>
            {r.status === "PENDING" ? (
              <>
                IGD <strong className="text-ink">{r.hospital.name}</strong> sudah menerima pemberitahuan pra-kedatangan.
              </>
            ) : (
              <>
                Tujuan: <strong>{r.hospital.name}</strong>
              </>
            )}
          </p>
        </div>
        {r.status === "PENDING" && (
          <p className="max-w-md text-[13px] leading-normal text-muted">
            Jika belum dikonfirmasi petugas sebelum waktu habis, permintaan kedaluwarsa dan kuota simulasi dilepas. Anda dapat memilih RS lain.
          </p>
        )}
        {accepted && (
          <p className="text-sm text-white/90">
            Diterima {timeAgo(r.decided_at ?? r.updated_at)}.{" "}
            {r.arrived_at ? "Petugas telah menandai pasien tiba." : "Kuota tetap ditahan sampai petugas menandai pasien tiba atau membatalkan penerimaan."}
          </p>
        )}
        {r.decision_note && (
          <p className={`rounded-xl px-3 py-2 text-sm ${accepted ? "bg-white/15 text-white" : "bg-soft text-ink-2"}`}>
            Catatan petugas: “{r.decision_note}”
          </p>
        )}
      </div>

      <div className="anim-rise anim-d1 grid grid-cols-3 gap-2">
        <div className="card !rounded-2xl px-3 py-2.5">
          <p className="text-xs font-bold text-muted">Permintaan</p>
          <p className="mt-1 text-[15px] font-extrabold leading-tight">{STATUS_LABEL[r.status].split(" ")[0]}</p>
        </div>
        <div className="card !rounded-2xl px-3 py-2.5">
          <p className="text-xs font-bold text-muted">Kuota simulasi</p>
          <p className="mt-1 text-[15px] font-extrabold leading-tight">
            {r.reservation_status ? { HELD: "Ditahan", RELEASED: "Dilepas", CONSUMED: "Terpakai" }[r.reservation_status] : "—"}
          </p>
        </div>
        <div className="card !rounded-2xl px-3 py-2.5">
          <p className="text-xs font-bold text-muted">Urgensi (AI)</p>
          <p className="mt-1 text-[15px] font-extrabold leading-tight">{r.urgency ?? "Tinjau"}</p>
        </div>
      </div>
      <p className="-mt-1 px-1 text-xs text-muted">
        Status permintaan adalah keputusan petugas IGD. {r.reservation_status ? RESERVATION_LABEL[r.reservation_status] : "Tidak ada reservasi"}: penguncian slot
        simulasi, bukan konfirmasi klinis.
      </p>

      <section aria-labelledby="trip-title" className="anim-rise anim-d2 flex flex-col gap-3 rounded-[22px] bg-ink p-4 text-[#e6ebf3]">
        <h2 id="trip-title" className="eyebrow !text-[#9fb0c8]">
          Perjalanan ke {r.hospital.short_name}
        </h2>
        {r.eta_seconds != null ? (
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-[28px] font-extrabold tracking-tight text-white">{formatEta(r.eta_seconds)}</span>
            <span className="text-sm text-[#b7c3d6]">{r.eta_source === "MOCK" ? "ETA simulasi" : "perkiraan rute OSRM tanpa lalu lintas langsung"}</span>
          </p>
        ) : (
          <p className="text-base font-semibold text-white">ETA tidak tersedia</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge level={r.urgency} size="sm" />
          <a href="tel:119" className="btn ml-auto border-[#34425e] bg-transparent text-white hover:bg-[#1a2640]">
            Telepon 119
          </a>
        </div>
        <p className="text-sm leading-normal text-[#c9d2e0]">{r.ai_result.report.summary}</p>
        <p className="flex items-start gap-2 text-xs text-[#9fb0c8]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Hasil AI adalah perkiraan awal yang perlu ditinjau tenaga kesehatan, bukan diagnosis dan bukan bukti rumah sakit menerima pasien.
        </p>
      </section>

      <SpeakPanel lines={buildGuidance(r)} title="Panduan sambil menunggu" />

      {r.status === "PENDING" &&
        (!confirmCancel ? (
          <button type="button" onClick={() => setConfirmCancel(true)} className="btn btn-danger btn-lg w-full">
            Batalkan permintaan
          </button>
        ) : (
          <div role="alertdialog" aria-label="Konfirmasi pembatalan" className="anim-rise flex flex-col gap-2.5 rounded-2xl border border-[#f3c6ce] bg-brand-tint p-3.5">
            <p className="text-base font-semibold text-[#6e0a1b]">Batalkan permintaan rujukan ke {r.hospital.short_name}? Kuota simulasi akan dilepas.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={cancel} disabled={cancelling || !online} className="btn btn-brand flex-1">
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Ya, batalkan
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="btn btn-secondary flex-1">
                Tidak
              </button>
            </div>
          </div>
        ))}

      {terminal && onBack && (
        <button type="button" onClick={onBack} className="btn btn-primary btn-lg w-full">
          Pilih tujuan lain
        </button>
      )}
      <button type="button" onClick={onNew} className="btn btn-ghost w-full">
        Buat laporan baru
      </button>

      <p className="flex items-center justify-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Status ini dibaca dari server; tidak disimpan offline.
      </p>
    </section>
  );
}
