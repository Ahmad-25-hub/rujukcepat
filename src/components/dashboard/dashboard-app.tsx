"use client";

import { Loader2, LogOut, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandLink } from "@/components/badges";
import { SyncBadge } from "@/components/sync-badge";
import { ApiClientError, apiFetch, type ServiceStatus } from "@/lib/client/api";
import { useOnline } from "@/lib/client/online";
import { useSync } from "@/lib/client/sync";
import type { Facility } from "@/lib/schema/api";
import { FacilityOverview } from "./facility-overview";
import { FacilityPanel, type FacilityToast } from "./facility-panel";

// Dashboard petugas: mengatur kesiapan layanan dan kuota RS-nya sendiri secara manual.
// Portal hanya merekomendasikan RS; tidak ada permintaan rujukan yang perlu dikonfirmasi.

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

export function DashboardApp() {
  const router = useRouter();
  const online = useOnline();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [facilities, setFacilities] = useState<FacilitiesData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<FacilityToast | null>(null);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(
    () =>
      apiFetch<FacilitiesData>("/api/facilities").then(
        (facs) => {
          setFacilities(facs);
          setLoadError(null);
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
    if (staff) void load();
  }, [staff, load]);

  const supabaseChannels = status?.data_mode === "SUPABASE" && staff ? ["rc:facilities"] : null;
  const sync = useSync({ onChange: () => void load(), supabaseChannels, enabled: !!staff });

  const myFacility = facilities?.facilities.find((f) => f.id === staff?.hospital_id) ?? null;

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
      setToast({ ok: true, message: "Data direset: kapasitas dan kapabilitas semua RS dikembalikan ke nilai awal." });
      await load();
    } catch (e) {
      setToast({ ok: false, message: e instanceof ApiClientError ? e.message : "Reset gagal." });
    } finally {
      setResetting(false);
    }
  }

  if (!staff) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-3 text-lg">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Memeriksa sesi petugas…
      </div>
    );
  }

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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncBadge sync={sync} showLatency dark />
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
          Anda offline – status kapasitas di layar mungkin sudah tidak mutakhir. Perubahan tidak akan tersimpan sampai koneksi kembali.
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
        <div className="anim-rise flex min-w-0 flex-[1_1_360px] flex-col gap-3">
          <h1 className="text-xl font-extrabold tracking-tight">Atur kesiapan dan kuota {staff.hospital_short_name}</h1>
          <p className="text-sm leading-normal text-ink-2">
            Portal pelapor hanya merekomendasikan RS yang layanannya READY dan kuotanya lebih dari 0. Tidak ada permintaan yang perlu dikonfirmasi; perbarui
            data ini setiap kali kondisi IGD berubah.
          </p>
          {myFacility && facilities ? (
            <FacilityPanel
              facility={myFacility}
              staleAfterMinutes={facilities.stale_after_minutes}
              serverTime={facilities.server_time}
              onUpdated={(t) => {
                setToast(t);
                void load();
              }}
            />
          ) : (
            !loadError && <span className="skeleton h-96 w-full !rounded-[22px]" aria-hidden />
          )}
        </div>

        <div className="anim-rise anim-d1 flex min-w-0 flex-[2_1_520px] flex-col gap-3">
          <section aria-labelledby="overview-title" className="card px-[18px] pb-4">
            <h2 id="overview-title" className="flex min-h-[52px] items-center text-[15px] font-bold">
              Status semua fasilitas
            </h2>
            <FacilityOverview refreshKey={sync.events} />
          </section>
          {staff.is_demo_admin && (
            <details className="card !border-[#f3c6ce] px-[18px]">
              <summary className="flex min-h-[52px] cursor-pointer items-center gap-2 text-[15px] font-bold text-brand-ink">
                <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                Reset data (admin)
              </summary>
              <section aria-label="Reset data" className="mb-4 flex flex-col gap-2.5">
                <p className="text-sm leading-normal text-ink-2">
                  Mengembalikan kapasitas dan kapabilitas <strong>seluruh</strong> RS ke nilai awal; semua perubahan petugas hilang. Tidak dapat dibatalkan.
                </p>
                <div className="flex flex-wrap items-end gap-2.5">
                  <label className="flex flex-col gap-1.5 text-[13px] font-bold">
                    Ketik RESET untuk konfirmasi
                    <input value={resetText} onChange={(e) => setResetText(e.target.value)} className="field w-44" />
                  </label>
                  <button type="button" onClick={doReset} disabled={resetText !== "RESET" || resetting} className="btn btn-brand">
                    {resetting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Reset data
                  </button>
                </div>
              </section>
            </details>
          )}
        </div>
      </main>
      <footer className="px-4 pb-4 pt-2 text-center text-xs text-muted">
        Lokasi RS © OpenStreetMap contributors · hasil AI bukan diagnosis
      </footer>
    </div>
  );
}
