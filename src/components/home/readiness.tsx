"use client";

import { ArrowRight, ChevronDown, ChevronUp, CircleCheck, CircleHelp, RefreshCw, Wrench, XCircle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import MapView, { type MapMarker } from "@/components/map-dynamic";
import { CountUp } from "@/components/motion";
import type { SyncState } from "@/lib/client/sync";
import { timeAgo } from "@/lib/client/format";
import type { IgdState, LatestKind, ReadinessSummary } from "@/lib/facilities/readiness";
import { useFacilityFeed } from "./facility-feed";

// Tampilan kesiapan IGD di beranda: ringkasan kecil (di atas foto hero) dan panel lengkap
// (daftar + peta). Keduanya membaca umpan yang sama dari /api/facilities.

const STATE: Record<IgdState, { label: string; cls: string; dot: string; marker: MapMarker["kind"]; icon: ReactNode }> = {
  SIAP: { label: "Siap", cls: "border-[#a9dcc3] bg-ok-tint text-ok-strong", dot: "bg-ok", marker: "ready", icon: <CircleCheck className="h-3.5 w-3.5" aria-hidden /> },
  PENUH: { label: "Penuh", cls: "border-[#f3b8c2] bg-brand-tint text-[#8e0d24]", dot: "bg-brand", marker: "full", icon: <XCircle className="h-3.5 w-3.5" aria-hidden /> },
  MAINTENANCE: { label: "Perawatan", cls: "border-[#f0d08a] bg-warn-tint text-warn-ink", dot: "bg-warn", marker: "unknown", icon: <Wrench className="h-3.5 w-3.5" aria-hidden /> },
  KEDALUWARSA: { label: "Belum diperbarui", cls: "border-dashed border-faint bg-[#f1f3f6] text-ink-2", dot: "bg-faint", marker: "unknown", icon: <CircleHelp className="h-3.5 w-3.5" aria-hidden /> },
  TIDAK_TERSEDIA: { label: "Tanpa IGD", cls: "border-line-strong bg-[#f1f3f6] text-ink-2", dot: "bg-faint", marker: "unknown", icon: <XCircle className="h-3.5 w-3.5" aria-hidden /> },
};

const LATEST_LABEL: Record<LatestKind, string> = {
  STAFF: "Diperbarui petugas RS",
  CAPACITY: "Kuota diperbarui",
  SEED: "Data awal simulasi",
};

const STATE_EXPLAINED: { state: IgdState; text: string }[] = [
  { state: "SIAP", text: "IGD dasar aktif dan masih ada kuota. Bisa direkomendasikan." },
  { state: "PENUH", text: "Kuota habis atau IGD sedang penuh. Tidak direkomendasikan." },
  { state: "MAINTENANCE", text: "Layanan sedang dalam perawatan atau perbaikan." },
  { state: "KEDALUWARSA", text: "Petugas belum memperbarui status. Tidak dianggap siap." },
];

/** Jumlah RS yang tampil di daftar beranda sebelum tombol "Lihat semua" ditekan. Peta tetap memuat semua. */
const LIST_PREVIEW = 30;

export function StateChip({ state }: { state: IgdState }) {
  const s = STATE[state];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

/** Penjelasan arti setiap status dengan bahasa sederhana. */
export function StateLegend() {
  return (
    <dl className="flex flex-col gap-3">
      {STATE_EXPLAINED.map((s) => (
        <div key={s.state} className="flex items-start gap-3">
          <dt className="w-[132px] shrink-0">
            <StateChip state={s.state} />
          </dt>
          <dd className="text-[14px] leading-snug text-ink-2">{s.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ringkasan kecil di atas foto hero. */
export function ReadinessSnapshot() {
  const { summary, error, sync, now, reload, loading } = useFacilityFeed();
  return (
    <div className="w-full rounded-2xl border border-line bg-white p-4 shadow-[0_24px_60px_-24px_rgba(11,19,36,.45)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-2">Kesiapan IGD saat ini</p>
        <LiveStatus state={sync.state} />
      </div>
      {error && !summary ? (
        <div role="alert" className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-2">
          <span>Data belum dapat dimuat.</span>
          <button type="button" onClick={reload} className="btn btn-secondary min-h-9 px-3 text-[13px]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Coba lagi
          </button>
        </div>
      ) : !summary ? (
        <div className="mt-3 flex flex-col gap-2" aria-hidden>
          <span className="skeleton h-9 w-40" />
          <span className="skeleton h-3 w-52" />
          <span className="skeleton h-1.5 w-full" />
        </div>
      ) : (
        <>
          <p className="mt-1.5 flex items-baseline gap-2">
            <CountUp value={summary.ready} className="text-[40px] font-bold leading-none tracking-[-0.03em] text-ink" />
            <span className="text-base font-semibold text-ink-2">dari {summary.total} IGD siap</span>
          </p>
          {summary.latestAt && summary.latestKind && (
            <p className="mt-1 text-[12.5px] text-muted">
              {LATEST_LABEL[summary.latestKind]} · {timeAgo(summary.latestAt, now)}
            </p>
          )}
          <StackBar summary={summary} className="mt-3" />
          <a href="#kesiapan" className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-accent hover:underline">
            Lihat daftar rumah sakit
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </>
      )}
    </div>
  );
}

/** Panel lengkap: ringkasan, peta statis, dan daftar seluruh RS. */
export function ReadinessPanel() {
  const { summary, error, sync, now, reload, loading } = useFacilityFeed();
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  if (error && !summary) {
    return (
      <div role="alert" className="card flex flex-col items-start gap-3 p-6 text-ink-2">
        <p className="font-semibold text-ink">Data kesiapan IGD belum dapat dimuat.</p>
        <p className="text-sm">{error}</p>
        <button type="button" onClick={reload} className="btn btn-secondary">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Coba lagi
        </button>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="card flex flex-col gap-3 p-5" aria-busy aria-label="Memuat kesiapan IGD">
        <span className="skeleton h-8 w-52" />
        <span className="skeleton h-56 w-full !rounded-xl" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    );
  }

  const markers: MapMarker[] = summary.items.map((i) => ({
    id: i.facility.id,
    lat: i.facility.lat,
    lng: i.facility.lng,
    label: `${i.facility.short_name} – ${STATE[i.state].label}`,
    kind: STATE[i.state].marker,
  }));
  const full = summary.items.filter((i) => i.state === "PENUH").map((i) => i.facility.short_name);
  const hidden = Math.max(0, summary.items.length - LIST_PREVIEW);
  const listed = showAll ? summary.items : summary.items.slice(0, LIST_PREVIEW);

  const toggleList = () => {
    // Saat diciutkan, kembalikan pandangan ke awal daftar agar pengguna tidak tertinggal di bawah.
    if (showAll) listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    setShowAll((v) => !v);
  };

  return (
    <div className="card overflow-hidden !rounded-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="flex items-baseline gap-2">
            <CountUp value={summary.ready} className="text-[32px] font-bold leading-none tracking-[-0.03em]" />
            <span className="text-[15px] font-semibold text-ink-2">dari {summary.total} IGD siap dan punya kuota</span>
          </p>
          {summary.latestAt && summary.latestKind && (
            <p className="mt-1 text-[13px] text-muted">
              {LATEST_LABEL[summary.latestKind]} · {timeAgo(summary.latestAt, now)}
            </p>
          )}
        </div>
        <LiveStatus state={sync.state} />
      </div>

      <div className="border-b border-line p-3">
        <MapView
          markers={markers}
          fitTo={markers.map((m) => [m.lat, m.lng] as [number, number])}
          interactive={false}
          className="h-56 sm:h-64 !rounded-xl"
        />
      </div>

      {full.length > 0 && (
        <p className="flex items-start gap-2 border-b border-line bg-brand-tint/60 px-5 py-2.5 text-[13px] leading-snug text-[#6e0a1b]">
          <XCircle className="mt-px h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span>
            <strong>Penuh:</strong> {full.join(", ")}. Tidak direkomendasikan sampai petugas membuka kuota.
          </span>
        </p>
      )}

      <ul ref={listRef} id="daftar-kesiapan" className="scroll-mt-20 divide-y divide-line" aria-label="Status IGD per rumah sakit">
        {listed.map((i) => {
          const f = i.facility;
          const pct = f.total_slots ? (f.available_slots / f.total_slots) * 100 : 0;
          return (
            <li key={f.id} className="flex min-h-[52px] items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATE[i.state].dot}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold" title={f.name}>
                {f.short_name}
              </span>
              <span className="hidden w-24 items-center gap-2 sm:flex" aria-hidden>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9edf2]">
                  <span className={`absolute inset-y-0 left-0 rounded-full ${i.state === "SIAP" ? "bg-ok" : "bg-faint"}`} style={{ width: `${pct}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-xs text-ink-2 sm:w-[68px]">
                {f.available_slots}/{f.total_slots}
                <span className="sr-only"> kuota tersedia</span>
              </span>
              <span className="shrink-0 text-right sm:w-[132px]">
                <StateChip state={i.state} />
              </span>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={toggleList}
            aria-expanded={showAll}
            aria-controls="daftar-kesiapan"
            className="btn btn-secondary w-full"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden />
                Tampilkan lebih sedikit
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden />
                Lihat semua {summary.items.length} rumah sakit ({hidden} lainnya)
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-soft px-5 py-3">
        <p className="text-xs leading-relaxed text-muted">Sumber: dashboard petugas RS RujukCepat · Lokasi © OpenStreetMap contributors</p>
        <span className="sim-badge">Data simulasi</span>
      </div>
    </div>
  );
}

function StackBar({ summary, className = "" }: { summary: ReadinessSummary; className?: string }) {
  const { ready, full, other } = summary;
  return (
    <div className={className}>
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-[#e9edf2]" aria-hidden>
        <span className="bar-grow bg-ok" style={{ flexGrow: ready }} />
        <span className="bar-grow bg-brand" style={{ flexGrow: full }} />
        <span className="bar-grow bg-faint" style={{ flexGrow: other }} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
          {ready} siap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
          {full} penuh
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-faint" aria-hidden />
          {other} lainnya
        </span>
      </p>
    </div>
  );
}

export function LiveStatus({ state }: { state: SyncState }) {
  const s = {
    live: { label: "Langsung", dot: "bg-ok anim-live", cls: "text-ok-strong" },
    connecting: { label: "Menyambung", dot: "bg-faint anim-blink", cls: "text-ink-2" },
    limited: { label: "Tiap 5 detik", dot: "bg-warn", cls: "text-warn-ink" },
  }[state];
  return (
    <span role="status" className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${s.cls}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
