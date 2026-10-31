"use client";

import { BellRing, Inbox, Loader2, LogOut, RefreshCw, Trash2, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLink, SimBadge, UrgencyBadge } from "@/components/badges";
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
    <div className="flex min-h-screen flex-col bg-[#eef1f5]">
      <header className="bg-ink text-[#e6ebf3]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-2.5 px-4 py-2 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <BrandLink dark compact />
            <span className="h-6 w-px bg-[#24324d] max-[520px]:hidden" aria-hidden />
            <span className="flex flex-col leading-tight">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9fb0c8]">Dashboard IGD</span>
              <span className="text-[15px] font-extrabold text-white">{staff.hospital_short_name}</span>
            </span>
            {badges.map((b) => (
              <SimBadge key={b}>{b}</SimBadge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncBadge sync={sync} showLatency dark />
            <button
              type="button"
              onClick={toggleAlarm}
              aria-pressed={alarmOn}
              className={`btn text-sm ${alarmOn ? "border-white bg-white text-ink hover:bg-[#e6ebf3]" : "border-[#34425e] bg-transparent text-[#e6ebf3] hover:bg-ink-soft"}`}
            >
              {alarmOn ? <Volume2 className="h-[18px] w-[18px]" aria-hidden /> : <VolumeX className="h-[18px] w-[18px]" aria-hidden />}
              {alarmOn ? "Alarm aktif" : "Aktifkan alarm"}
            </button>
            <button type="button" onClick={logout} aria-label="Keluar" className="btn min-w-11 border-[#34425e] bg-transparent text-sm text-[#e6ebf3] hover:bg-ink-soft">
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
              <span className="max-[520px]:sr-only">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {!online && (
        <p role="alert" className="flex items-center gap-2 bg-brand px-4 py-2 text-sm font-semibold text-white sm:px-5">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          Anda offline – daftar permintaan dan status kapasitas di layar mungkin sudah tidak mutakhir. Aksi petugas tidak akan tersimpan sampai koneksi kembali.
        </p>
      )}
      {newCount > 0 && (
        <div role="alert" className="anim-down bg-brand text-white">
          <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:px-5">
            <p className="flex items-center gap-2.5 text-base font-extrabold">
              <BellRing className="anim-bell h-[22px] w-[22px] shrink-0" aria-hidden />
              {newCount} permintaan rujukan baru menunggu konfirmasi
            </p>
            <button
              type="button"
              onClick={() => {
                setNewCount(0);
                setSelectedId(pending[0]?.id ?? null);
              }}
              className="btn border-white bg-white text-brand-ink hover:bg-brand-tint"
            >
              Lihat sekarang
            </button>
          </div>
        </div>
      )}
      {alarmNote && (
        <p role="status" className="bg-warn-tint px-4 py-2 text-sm text-warn-ink sm:px-5">
          {alarmNote}
        </p>
      )}
      {toast && (
        <p
          role={toast.ok ? "status" : "alert"}
          className={`anim-down flex items-center justify-between gap-3 px-4 py-1.5 text-sm font-semibold sm:px-5 ${toast.ok ? "bg-ok-tint text-ok-strong" : "bg-brand-tint text-[#6e0a1b]"}`}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="btn btn-ghost min-h-11 shrink-0 px-3 text-sm underline">
            Tutup
          </button>
        </p>
      )}
      {loadError && (
        <p role="alert" className="flex flex-wrap items-center gap-3 bg-brand-tint px-4 py-2 text-sm text-[#6e0a1b] sm:px-5">
          {loadError}
          <button type="button" onClick={() => void load()} className="btn btn-ghost text-sm underline">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Coba lagi
          </button>
        </p>
      )}

      <main id="main" className="mx-auto flex w-full max-w-[90rem] flex-1 flex-wrap items-start gap-4 p-4 sm:p-5">
        <section aria-labelledby="queue-title" className="anim-rise flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h1 id="queue-title" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <Inbox className="h-5 w-5 text-accent" aria-hidden />
              Permintaan masuk
            </h1>
            <span className="text-xs text-muted">diperbarui otomatis</span>
          </div>
          {referrals === null ? (
            <div role="status" className="flex flex-col gap-2">
              <span className="sr-only">Memuat…</span>
              <span className="skeleton h-24 w-full !rounded-2xl" aria-hidden />
              <span className="skeleton h-24 w-full !rounded-2xl" aria-hidden />
            </div>
          ) : (
            <>
              <h2 className="eyebrow mt-1">Menunggu konfirmasi ({pending.length})</h2>
              {pending.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#b5becc] bg-white p-4 text-sm text-ink-2">Belum ada permintaan menunggu. Halaman ini diperbarui otomatis.</p>
              )}
              <ul className="flex flex-col gap-2">
                {pending.map((r) => (
                  <QueueItem
                    key={r.id}
                    r={r}
                    fresh={newCount > 0 && r.id === pending[0]?.id}
                    selected={selected?.id === r.id}
                    nowMs={now + offsetMs}
                    onSelect={() => {
                      setSelectedId(r.id);
                      setNewCount(0);
                    }}
                  />
                ))}
              </ul>
              {processed.length > 0 && (
                <>
                  <h2 className="eyebrow mt-2">Sudah diproses ({processed.length})</h2>
                  <ul className="flex flex-col gap-2">
                    {processed.map((r) => (
                      <QueueItem key={r.id} r={r} selected={selected?.id === r.id} nowMs={now + offsetMs} onSelect={() => setSelectedId(r.id)} compact />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        <div className="anim-rise anim-d1 flex min-w-0 flex-[3_1_520px] flex-col gap-3">
          {selected ? (
            <ReferralDetail key={selected.id} referral={selected} nowOffsetMs={offsetMs} onDecision={onDecision} />
          ) : (
            referrals !== null && (
              <p className="rounded-[22px] border border-dashed border-[#b5becc] bg-white p-6 text-ink-2">Pilih permintaan di daftar untuk melihat detail.</p>
            )
          )}
          <details className="card px-[18px]">
            <summary className="flex min-h-[52px] cursor-pointer items-center text-[15px] font-bold">Status semua fasilitas (publik, simulasi)</summary>
            <div className="mb-4">
              <FacilityOverview refreshKey={sync.events} />
            </div>
          </details>
          {staff.is_demo_admin && (
            <details className="card !border-[#f3c6ce] px-[18px]">
              <summary className="flex min-h-[52px] cursor-pointer items-center gap-2 text-[15px] font-bold text-brand-ink">
                <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                Reset data demo (admin)
              </summary>
              <section aria-label="Reset data demo" className="mb-4 flex flex-col gap-2.5">
                <p className="text-sm leading-normal text-ink-2">
                  Menghapus <strong>semua</strong> rujukan, reservasi, dan riwayat kejadian, lalu mengembalikan kapasitas dan kapabilitas seluruh RS ke seed simulasi.
                  Tidak dapat dibatalkan.
                </p>
                <div className="flex flex-wrap items-end gap-2.5">
                  <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                    Ketik RESET untuk konfirmasi
                    <input value={resetText} onChange={(e) => setResetText(e.target.value)} className="field w-44" />
                  </label>
                  <button type="button" onClick={doReset} disabled={resetText !== "RESET" || resetting} className="btn btn-brand">
                    {resetting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Hapus data demo
                  </button>
                </div>
              </section>
            </details>
          )}
        </div>

        {myFacility && facilities && (
          <aside className="anim-rise anim-d2 flex min-w-0 flex-[1_1_300px] flex-col">
            <FacilityPanel
              facility={myFacility}
              staleAfterMinutes={facilities.stale_after_minutes}
              serverTime={facilities.server_time}
              onUpdated={(t) => {
                setToast(t);
                void load();
              }}
            />
          </aside>
        )}
      </main>
      <footer className="px-4 pb-4 pt-2 text-center text-xs text-muted">
        Lokasi RS © OpenStreetMap contributors · kapasitas dan kesiapan adalah simulasi · hasil AI bukan diagnosis
      </footer>
    </div>
  );
}

function QueueItem({
  r,
  selected,
  nowMs,
  onSelect,
  compact = false,
  fresh = false,
}: {
  r: ReferralView;
  selected: boolean;
  nowMs: number;
  onSelect: () => void;
  compact?: boolean;
  fresh?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-col gap-2 rounded-2xl border-2 bg-white px-3.5 py-3 text-left transition-[border-color,box-shadow] ${
          selected ? "border-accent shadow-[0_0_0_4px_#dce6ff]" : "border-line hover:border-faint"
        } ${fresh ? "anim-flash" : ""}`}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <UrgencyBadge level={r.urgency} size="sm" />
          <span className={`text-xs ${compact ? "font-bold text-ink-2" : "text-muted"}`}>{compact ? STATUS_LABEL[r.status] : timeAgo(r.created_at, nowMs)}</span>
        </span>
        <span className={`text-sm leading-snug ${compact ? "line-clamp-1 text-ink-2" : "line-clamp-2 text-ink"}`}>{r.ai_result.report.summary}</span>
        {!compact && (
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            <span className="font-bold">{r.eta_seconds != null ? `ETA ${formatEta(r.eta_seconds)}` : "ETA tidak tersedia"}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">Wajib: {r.required_needs.join(", ")}</span>
          </span>
        )}
      </button>
    </li>
  );
}
