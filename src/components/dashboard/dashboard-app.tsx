"use client";

import { BellRing, Inbox, Loader2, LogOut, RefreshCw, Trash2, Volume2, VolumeX, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimBadge, UrgencyBadge } from "@/components/badges";
import { SyncBadge } from "@/components/sync-badge";
import { alarmSupported, playAlarm, unlockAlarm } from "@/lib/client/alarm";
import { ApiClientError, apiFetch, type ServiceStatus } from "@/lib/client/api";
import { formatEta, timeAgo } from "@/lib/client/format";
import { useOnline } from "@/lib/client/online";
import { useSync } from "@/lib/client/sync";
import type { Facility } from "@/lib/schema/api";
import type { ReferralView } from "@/lib/schema/referral";
import { STATUS_LABEL } from "@/lib/schema/referral";
import { FacilityOverview } from "./facility-overview";
import { FacilityPanel, type FacilityToast } from "./facility-panel";
import { ReferralDetail, type DecisionResult } from "./referral-detail";

type Staff = {
  user_id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_short_name: string;
  display_name: string;
  email: string;
  is_demo_admin: boolean;
};
type FacilitiesData = { facilities: Facility[]; stale_after_minutes: number; server_time: string };
type ReferralsData = { referrals: ReferralView[]; server_time: string };

const ALARM_KEY = "rc_alarm_on";

export function DashboardApp() {
  const router = useRouter();
  const online = useOnline();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [referrals, setReferrals] = useState<ReferralView[] | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [alarmOn, setAlarmOn] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(ALARM_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const [alarmNote, setAlarmNote] = useState<string | null>(null);
  const [toast, setToast] = useState<FacilityToast | null>(null);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const alarmRef = useRef(false);

  useEffect(() => {
    alarmRef.current = alarmOn;
  }, [alarmOn]);

  const load = useCallback(
    () =>
      Promise.all([apiFetch<ReferralsData>("/api/referrals"), apiFetch<FacilitiesData>("/api/facilities")]).then(
        ([refs, facs]) => {
      setReferrals(refs.referrals);
      setOffsetMs(Date.parse(refs.server_time) - Date.now());
      setFacilities(facs);
      setLoadError(null);
      const pendingIds = refs.referrals.filter((r) => r.status === "PENDING").map((r) => r.id);
      if (seen.current === null) {
        seen.current = new Set(refs.referrals.map((r) => r.id));
      } else {
        const fresh = pendingIds.filter((id) => !seen.current!.has(id));
        refs.referrals.forEach((r) => seen.current!.add(r.id));
        if (fresh.length) {
          setNewCount((n) => n + fresh.length);
          if (alarmRef.current) {
            void playAlarm().then((played) => {
              if (!played) setAlarmNote("Alarm suara diblokir browser; gunakan notifikasi visual ini. Tekan “Aktifkan alarm” lagi.");
            });
          }
        }
      }
        },
        (e) => {
          if (e instanceof ApiClientError && e.status === 401) {
            router.replace("/dashboard/login");
            return;
          }
          setLoadError(e instanceof ApiClientError ? e.message : "Data dashboard tidak dapat dimuat.");
        },
      ),
    [router],
  );

  useEffect(() => {
    apiFetch<{ staff: Staff }>("/api/staff/me").then(
      (d) => setStaff(d.staff),
      () => router.replace("/dashboard/login"),
    );
    apiFetch<ServiceStatus>("/api/status").then(setStatus, () => undefined);
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  const supabaseChannels = status?.data_mode === "SUPABASE" && staff ? ["rc:facilities", `rc:hospital:${staff.hospital_id}`] : null;
  const sync = useSync({ onChange: () => void load(), supabaseChannels, enabled: !!staff });

  // Judul tab menandai permintaan baru yang belum dilihat.
  useEffect(() => {
    document.title = newCount > 0 ? `(${newCount}) Permintaan baru – RujukCepat` : "Dashboard IGD – RujukCepat";
  }, [newCount]);

  const pending = useMemo(() => (referrals ?? []).filter((r) => r.status === "PENDING"), [referrals]);
  const processed = useMemo(() => (referrals ?? []).filter((r) => r.status !== "PENDING"), [referrals]);
  const selected = useMemo(() => {
    if (!referrals) return null;
    return referrals.find((r) => r.id === selectedId) ?? pending[0] ?? processed[0] ?? null;
  }, [referrals, selectedId, pending, processed]);
  const myFacility = facilities?.facilities.find((f) => f.id === staff?.hospital_id) ?? null;

  async function toggleAlarm() {
    if (alarmOn) {
      setAlarmOn(false);
      setAlarmNote(null);
      try {
        localStorage.setItem(ALARM_KEY, "0");
      } catch {
        // abaikan
      }
      return;
    }
    const unlocked = await unlockAlarm();
    setAlarmOn(true);
    try {
      localStorage.setItem(ALARM_KEY, "1");
    } catch {
      // abaikan
    }
    if (unlocked) {
      setAlarmNote(null);
      void playAlarm();
    } else {
      setAlarmNote(
        alarmSupported()
          ? "Browser memblokir audio. Notifikasi visual tetap aktif; coba tekan tombol ini lagi atau izinkan suara untuk situs ini."
          : "Browser ini tidak mendukung alarm suara. Notifikasi visual tetap aktif.",
      );
    }
  }

  async function logout() {
    await apiFetch("/api/staff/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/dashboard/login");
  }

  async function doReset() {
    setResetting(true);
    try {
      await apiFetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: resetText }),
      });
      setResetText("");
      seen.current = null;
      setToast({ ok: true, message: "Data demo direset: semua rujukan dihapus, kapasitas dan kapabilitas dikembalikan ke seed simulasi." });
      await load();
    } catch (e) {
      setToast({ ok: false, message: e instanceof ApiClientError ? e.message : "Reset gagal." });
    } finally {
      setResetting(false);
    }
  }

  function onDecision(r: DecisionResult) {
    setToast({ ok: r.ok, message: r.message });
    void load();
  }

  if (!staff) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-3 text-lg">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Memeriksa sesi petugas…
      </div>
    );
  }

  const badges = ["Demo – data simulasi"];
  if (status?.data_mode === "LOCAL") badges.push("Database lokal");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/" className="text-lg font-extrabold">
            RujukCepat
          </Link>
          <span className="text-sm text-slate-200">
            Dashboard IGD · <strong>{staff.hospital_short_name}</strong>
          </span>
          {badges.map((b) => (
            <SimBadge key={b}>{b}</SimBadge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncBadge sync={sync} showLatency />
          <button
            type="button"
            onClick={toggleAlarm}
            aria-pressed={alarmOn}
            className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-800"
          >
            {alarmOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
            {alarmOn ? "Alarm aktif" : "Aktifkan alarm"}
          </button>
          <button type="button" onClick={logout} className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-800">
            <LogOut className="h-4 w-4" aria-hidden />
            Keluar
          </button>
        </div>
      </header>

      {!online && (
        <p role="alert" className="flex items-center gap-2 bg-red-700 px-4 py-2 text-sm font-semibold text-white sm:px-6">
          <WifiOff className="h-4 w-4" aria-hidden />
          Anda offline – daftar permintaan dan status kapasitas di layar mungkin sudah tidak mutakhir. Aksi petugas tidak akan tersimpan sampai koneksi kembali.
        </p>
      )}
      {newCount > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 bg-red-700 px-4 py-3 text-white sm:px-6">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <BellRing className="h-6 w-6 animate-pulse" aria-hidden />
            {newCount} permintaan rujukan baru menunggu konfirmasi
          </p>
          <button
            type="button"
            onClick={() => {
              setNewCount(0);
              setSelectedId(pending[0]?.id ?? null);
            }}
            className="rounded-lg bg-white px-4 py-2 font-bold text-red-800"
          >
            Lihat sekarang
          </button>
        </div>
      )}
      {alarmNote && (
        <p role="status" className="bg-amber-100 px-4 py-2 text-sm text-amber-950 sm:px-6">
          {alarmNote}
        </p>
      )}
      {toast && (
        <p role={toast.ok ? "status" : "alert"} className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-semibold sm:px-6 ${toast.ok ? "bg-green-100 text-green-950" : "bg-red-100 text-red-950"}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="underline">
            Tutup
          </button>
        </p>
      )}
      {loadError && (
        <p role="alert" className="flex flex-wrap items-center gap-3 bg-red-100 px-4 py-2 text-sm text-red-950 sm:px-6">
          {loadError}
          <button type="button" onClick={() => void load()} className="flex items-center gap-1 font-bold underline">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Coba lagi
          </button>
        </p>
      )}

      <main id="main" className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[22rem_1fr]">
        <section aria-labelledby="queue-title" className="space-y-3">
          <h1 id="queue-title" className="flex items-center gap-2 text-xl font-bold">
            <Inbox className="h-6 w-6 text-blue-700" aria-hidden />
            Permintaan masuk
          </h1>
          {referrals === null ? (
            <p role="status" className="flex items-center gap-2 text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Memuat…
            </p>
          ) : (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Menunggu konfirmasi ({pending.length})</h2>
              {pending.length === 0 && <p className="rounded-lg border border-dashed border-slate-400 bg-white p-4 text-sm text-slate-700">Belum ada permintaan menunggu. Halaman ini diperbarui otomatis.</p>}
              <ul className="space-y-2">
                {pending.map((r) => (
                  <QueueItem key={r.id} r={r} selected={selected?.id === r.id} nowMs={now + offsetMs} onSelect={() => { setSelectedId(r.id); setNewCount(0); }} />
                ))}
              </ul>
              {processed.length > 0 && (
                <>
                  <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-slate-600">Sudah diproses ({processed.length})</h2>
                  <ul className="space-y-2">
                    {processed.map((r) => (
                      <QueueItem key={r.id} r={r} selected={selected?.id === r.id} nowMs={now + offsetMs} onSelect={() => setSelectedId(r.id)} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        <div className="space-y-4">
          {selected ? (
            <ReferralDetail key={selected.id} referral={selected} nowOffsetMs={offsetMs} onDecision={onDecision} />
          ) : (
            referrals !== null && <p className="rounded-xl border border-dashed border-slate-400 bg-white p-6 text-slate-700">Pilih permintaan di sebelah kiri untuk melihat detail.</p>
          )}
          {myFacility && facilities && (
            <FacilityPanel facility={myFacility} staleAfterMinutes={facilities.stale_after_minutes} serverTime={facilities.server_time} onUpdated={(t) => { setToast(t); void load(); }} />
          )}
          <details className="rounded-xl border border-slate-300 bg-white p-4">
            <summary className="cursor-pointer text-base font-bold">Status semua fasilitas (publik, simulasi)</summary>
            <div className="mt-3">
              <FacilityOverview refreshKey={sync.events} />
            </div>
          </details>
          {staff.is_demo_admin && (
            <section aria-labelledby="reset-title" className="space-y-2 rounded-xl border-2 border-red-400 bg-red-50 p-4">
              <h2 id="reset-title" className="flex items-center gap-2 text-lg font-bold text-red-900">
                <Trash2 className="h-5 w-5" aria-hidden />
                Reset data demo (admin)
              </h2>
              <p className="text-sm text-red-950">
                Menghapus <strong>semua</strong> rujukan, reservasi, dan riwayat kejadian, lalu mengembalikan kapasitas dan kapabilitas seluruh RS ke seed simulasi. Tidak dapat dibatalkan.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm font-semibold">
                  Ketik RESET untuk konfirmasi
                  <input value={resetText} onChange={(e) => setResetText(e.target.value)} className="mt-1 block w-40 rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-base" />
                </label>
                <button type="button" onClick={doReset} disabled={resetText !== "RESET" || resetting} className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 font-bold text-white disabled:bg-slate-400">
                  {resetting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Hapus data demo
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
      <footer className="px-4 py-3 text-center text-xs text-slate-600">
        Lokasi RS © OpenStreetMap contributors · kapasitas dan kesiapan adalah simulasi · hasil AI bukan diagnosis
      </footer>
    </div>
  );
}

function QueueItem({ r, selected, nowMs, onSelect }: { r: ReferralView; selected: boolean; nowMs: number; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full space-y-1 rounded-xl border-2 p-3 text-left ${selected ? "border-blue-700 bg-blue-50 ring-2 ring-blue-300" : "border-slate-300 bg-white"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <UrgencyBadge level={r.urgency} />
          <span className="text-xs text-slate-600">{timeAgo(r.created_at, nowMs)}</span>
        </div>
        <p className="line-clamp-2 text-sm">{r.ai_result.report.summary}</p>
        <p className="text-xs text-slate-700">
          {STATUS_LABEL[r.status]} · {r.eta_seconds != null ? formatEta(r.eta_seconds) : "ETA tidak tersedia"}
        </p>
        <p className="text-xs text-slate-600">Wajib: {r.required_needs.join(", ")}</p>
      </button>
    </li>
  );
}
