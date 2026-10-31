"use client";

import { Ban, Check, CircleCheck, ExternalLink, Loader2, Navigation, Phone, RefreshCw, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CapStatusChip } from "@/components/badges";
import MapView, { type MapMarker } from "@/components/map-dynamic";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { formatEta, formatKm, timeAgo } from "@/lib/client/format";
import type { Candidate, MatchResult } from "@/lib/matching/match";
import type { Need } from "@/lib/schema/ai";
import { externalNavLinks, type RouteStep } from "@/lib/routing/steps";
import type { ReporterLocation } from "./location-step";
import { NavigationView } from "./navigation-view";
import { RouteGuide } from "./route-guide";

type RouteGeo = { source: "OSRM" | "MOCK"; duration_s: number; distance_m: number; geometry: [number, number][]; steps: RouteStep[] };

function EtaLine({ c }: { c: Candidate }) {
  if (c.eta_seconds == null) {
    return (
      <p className="text-sm text-ink-2">
        <strong>ETA tidak tersedia</strong> · jarak garis lurus {c.straight_km.toLocaleString("id-ID")} km (bukan waktu tempuh)
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-[26px] font-extrabold tracking-tight">{formatEta(c.eta_seconds)}</span>
      {c.distance_m != null && <span className="text-sm text-ink-2">{formatKm(c.distance_m)}</span>}
      <span className="text-xs text-muted">{c.eta_source === "MOCK" ? "ETA simulasi" : "perkiraan rute OSRM, tanpa lalu lintas langsung"}</span>
    </p>
  );
}

function CandidateCard({
  c,
  label,
  index,
  selected,
  onSelect,
}: {
  c: Candidate;
  label: string;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const pct = c.total_slots > 0 ? Math.round((c.available_slots / c.total_slots) * 100) : 0;
  return (
    <li className="anim-rise" style={{ animationDelay: `${0.06 * index}s` }}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-col gap-2.5 rounded-[20px] border-2 bg-white p-4 text-left transition-[border-color,box-shadow] ${
          selected ? "border-accent shadow-[0_0_0_4px_#dce6ff,0_18px_36px_-24px_rgba(29,78,216,.6)]" : "border-line hover:border-faint"
        }`}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-brand text-white" : "border-2 border-ink bg-white text-ink"}`}
            >
              {index + 1}
            </span>
            <span className="eyebrow">{label}</span>
          </span>
          {selected && (
            <span className="flex items-center gap-1 text-[13px] font-extrabold text-accent">
              <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> Dipilih
            </span>
          )}
        </span>
        <span className="block">
          <span className="block text-[19px] font-extrabold leading-tight tracking-tight">{c.short_name}</span>
          <span className="block text-[13px] text-muted">{c.name}</span>
        </span>
        <EtaLine c={c} />
        <span className="flex flex-wrap gap-1.5">
          {c.checks.map((k) => (
            <span key={k.code} className="inline-flex items-center gap-1 text-xs">
              <span className="font-mono font-bold">
                {k.code}
                {k.required ? "*" : ""}
              </span>
              <CapStatusChip status={k.status} />
            </span>
          ))}
        </span>
        <span className="flex w-full items-center gap-2.5 border-t border-[#eef1f5] pt-2.5">
          <span className="shrink-0 text-[13px] text-ink-2">Kuota pasien</span>
          <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6eaf0]">
            <span className={`block h-full rounded-full ${pct < 25 ? "bg-[#c25a0c]" : "bg-ok"}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="shrink-0 font-mono text-sm font-bold">
            {c.available_slots}/{c.total_slots}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {c.is_simulated && <span className="sim-badge">Kapasitas simulasi</span>}
          diperbarui {timeAgo(c.capacity_updated_at)}
        </span>
      </button>
    </li>
  );
}

export function DestinationStep({
  location,
  needs,
  online,
  selectedId,
  onSelect,
  onArrived,
  onBack,
}: {
  location: ReporterLocation;
  needs: Need[];
  online: boolean;
  selectedId: string | null;
  onSelect: (c: Candidate | null) => void;
  /** Pelapor menekan "Sudah sampai" di layar navigasi. */
  onArrived: (c: Candidate) => void;
  onBack: () => void;
}) {
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [routeState, setRouteState] = useState<{ id: string; geo: RouteGeo | null; error: string | null } | null>(null);

  const fetchMatch = useCallback(
    () =>
      apiFetch<MatchResult>("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needs: needs.map(({ code, required, reason }) => ({ code, required, reason })),
          location: { lat: location.lat, lng: location.lng },
          location_source: location.source,
        }),
      })
        .then(
          (data) => {
            setResult(data);
            setError(null);
            onSelect(data.primary);
          },
          (e) => {
            setError(e instanceof ApiClientError ? e.message : "Pencocokan gagal. Silakan coba lagi.");
            setResult(null);
          },
        )
        .finally(() => setLoading(false)),
    // onSelect sengaja tidak masuk dependensi agar tidak memicu ulang pencocokan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needs, location],
  );

  function load() {
    setLoading(true);
    void fetchMatch();
  }

  useEffect(() => {
    void fetchMatch();
  }, [fetchMatch]);

  const all = useMemo(() => (result ? [result.primary, ...result.alternatives].filter((c): c is Candidate => !!c) : []), [result]);
  const selected = all.find((c) => c.facility_id === selectedId) ?? null;
  const current = routeState && selected && routeState.id === selected.facility_id ? routeState : null;
  const route = current?.geo ?? null;
  const routeError = current?.error ?? null;

  useEffect(() => {
    if (!selected) return;
    const id = selected.facility_id;
    const ctrl = new AbortController();
    apiFetch<RouteGeo>(`/api/route?lat=${location.lat}&lng=${location.lng}&hospital_id=${id}`, { signal: ctrl.signal })
      .then((geo) => setRouteState({ id, geo, error: null }))
      .catch((e) => {
        if (e instanceof ApiClientError && e.code === "ABORTED") return;
        setRouteState({ id, geo: null, error: e instanceof ApiClientError ? e.message : "Rute tidak dapat dihitung." });
      });
    return () => ctrl.abort();
  }, [selected, location]);

  const markers: MapMarker[] = useMemo(() => {
    if (!result) return [];
    return all.map((c, i) => ({
      id: c.facility_id,
      lat: c.lat,
      lng: c.lng,
      label: `${c.short_name}${i === 0 ? " (utama)" : ""}`,
      kind: c.facility_id === selectedId ? "selected" : i === 0 ? "primary" : "alternative",
    }));
  }, [result, all, selectedId]);

  const fitTo = useMemo<[number, number][]>(
    () => [[location.lat, location.lng], ...all.map((c) => [c.lat, c.lng] as [number, number])],
    [all, location],
  );

  if (loading) {
    return (
      <div role="status" className="card flex flex-col gap-4 rounded-3xl p-5">
        <p className="flex items-center gap-3 text-base font-semibold">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Mencocokkan kebutuhan dengan kesiapan rumah sakit…
        </p>
        <span className="skeleton h-48 w-full !rounded-2xl" aria-hidden />
        <span className="skeleton h-24 w-full !rounded-2xl" aria-hidden />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div role="alert" className="card flex flex-col gap-3 rounded-3xl !border-[#f3c6ce] p-5">
        <p className="text-base text-[#6e0a1b]">{error}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Coba lagi
          </button>
          <button type="button" onClick={onBack} className="btn btn-secondary">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const count = (result.primary ? 1 : 0) + result.alternatives.length;

  return (
    <section aria-labelledby="dest-title" className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="anim-rise flex min-w-0 flex-[1_1_340px] flex-col gap-2.5 lg:sticky lg:top-28">
          <div className="relative">
            <MapView
              origin={location}
              markers={markers}
              route={route?.geometry ?? null}
              fitTo={focusPoint ? [focusPoint] : fitTo}
              onMarkerClick={(id) => onSelect(all.find((c) => c.facility_id === id) ?? null)}
              className="h-64 sm:h-80"
            />
            <div className="pointer-events-none absolute right-2.5 top-2.5 z-[500] flex max-w-[60%] flex-wrap justify-end gap-1.5">
              <span className="sim-badge">Status &amp; kapasitas simulasi</span>
              {result.routing_status === "MOCK" && <span className="sim-badge">Rute simulasi</span>}
            </div>
          </div>
          <p className="px-1 text-xs leading-normal text-muted">
            Lokasi RS dari OpenStreetMap; tidak menyiratkan kemitraan atau penerimaan pasien.
            {route && ` Garis biru: ${route.source === "MOCK" ? "garis lurus simulasi" : "rute perkiraan OSRM"}.`}
            {routeError && ` ${routeError}`}
          </p>
          <details className="card px-3.5">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-bold">
              <Route className="h-[18px] w-[18px]" aria-hidden />
              Cara rumah sakit dipilih
            </summary>
            <div className="mb-3.5 space-y-1.5 text-sm leading-relaxed text-ink-2">
              <p>
                {result.routing_note}
                {location.source === "MANUAL" && " Dihitung dari titik yang Anda pilih secara manual."}
              </p>
              <p className="text-xs text-muted">Aturan: {result.policy} Kebutuhan bertanda * wajib.</p>
            </div>
          </details>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h1 id="dest-title" className="anim-rise text-[22px] font-extrabold leading-tight tracking-tight">
              {result.primary ? `${count} IGD cocok untuk kebutuhan ini` : "Belum ada IGD yang cocok"}
            </h1>
            <button type="button" onClick={load} aria-label="Perbarui pencocokan" title="Perbarui" className="btn btn-ghost btn-icon shrink-0">
              <RefreshCw className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {result.primary ? (
            <ul className="flex flex-col gap-2.5">
              <CandidateCard c={result.primary} index={0} label="Kandidat utama" selected={selectedId === result.primary.facility_id} onSelect={() => onSelect(result.primary)} />
              {result.alternatives.map((c, i) => (
                <CandidateCard key={c.facility_id} c={c} index={i + 1} label={`Alternatif ${i + 1}`} selected={selectedId === c.facility_id} onSelect={() => onSelect(c)} />
              ))}
              {result.alternatives.length === 0 && <li className="px-1 text-sm text-ink-2">Tidak ada alternatif lain yang memenuhi kebutuhan wajib.</li>}
              {result.other_eligible_count > 0 && <li className="px-1 text-sm text-ink-2">{result.other_eligible_count} RS layak lain lebih jauh tidak ditampilkan.</li>}
            </ul>
          ) : (
            <div role="alert" className="card flex flex-col gap-3 rounded-3xl !border-[#f3c6ce] p-5">
              <p className="flex items-center gap-2 text-lg font-extrabold text-brand-ink">
                <Ban className="h-5 w-5" aria-hidden />
                Tidak ada kandidat yang sesuai
              </p>
              <p className="text-base text-ink-2">{result.no_candidate_reason}</p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-2">
                <li>
                  Hubungi layanan darurat{" "}
                  <a href="tel:119" className="font-bold text-brand-ink underline">
                    119
                  </a>{" "}
                  /{" "}
                  <a href="tel:112" className="font-bold text-brand-ink underline">
                    112
                  </a>
                  .
                </li>
                <li>Tinjau kembali kebutuhan (mis. jadikan opsional bila tidak mutlak).</li>
                <li>Coba lagi beberapa saat; status fasilitas dapat berubah.</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onBack} className="btn btn-primary">
                  Tinjau kebutuhan
                </button>
                <a href="tel:119" className="btn btn-danger">
                  <Phone className="h-4 w-4" aria-hidden />
                  Telepon 119
                </a>
              </div>
            </div>
          )}

          {selected && route && (
            <RouteGuide
              hospitalName={selected.short_name}
              origin={location}
              dest={{ lat: selected.lat, lng: selected.lng }}
              steps={route.steps ?? []}
              source={route.source}
              durationS={route.duration_s}
              distanceM={route.distance_m}
              onFocusStep={setFocusPoint}
            />
          )}

          {selected && (
            <p className="px-1 text-xs leading-normal text-muted">
              Ini rekomendasi berdasarkan kesiapan dan kuota yang diperbarui petugas {selected.short_name}, bukan jaminan pasien diterima. Bila memungkinkan, hubungi
              IGD sebelum berangkat.
            </p>
          )}
          {result.excluded.length > 0 && (
            <details className="rounded-2xl border border-dashed border-[#c7ceda] bg-[#fafbfc] px-3.5">
              <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold text-ink-2">Tidak disarankan ({result.excluded.length}) dan alasannya</summary>
              <ul className="mb-3 flex flex-col gap-1.5 text-sm text-ink-2">
                {result.excluded.map((x) => (
                  <li key={x.facility_id}>
                    <strong className="text-ink">{x.short_name}</strong> · {x.reasons.join(" · ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {navigating && selected && route && (
        <NavigationView
          hospital={{ id: selected.facility_id, short_name: selected.short_name, name: selected.name, lat: selected.lat, lng: selected.lng }}
          origin={location}
          initialRoute={{ ...route, steps: route.steps ?? [] }}
          onClose={() => setNavigating(false)}
          onArrived={() => {
            setNavigating(false);
            onArrived(selected);
          }}
        />
      )}

      <div className="action-bar mt-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
        {!online && (
          <p role="alert" className="notice notice-error font-semibold">
            Anda offline. Daftar rumah sakit dan rute tidak dapat diperbarui sampai koneksi kembali.
          </p>
        )}
        {selected && routeError ? (
          // Rute gagal dihitung: arahkan ke aplikasi peta perangkat, tetap sediakan "Sudah sampai".
          <>
            <a
              href={externalNavLinks(location, { lat: selected.lat, lng: selected.lng }).google}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-brand btn-lg w-full"
            >
              <ExternalLink className="h-5 w-5" aria-hidden />
              Buka rute di Google Maps
            </a>
            <button type="button" onClick={() => onArrived(selected)} className="btn btn-secondary btn-lg w-full">
              <CircleCheck className="h-5 w-5" aria-hidden />
              Sudah sampai
            </button>
          </>
        ) : selected ? (
          <>
            <button type="button" onClick={() => setNavigating(true)} disabled={!route} aria-busy={!route} className="btn btn-brand btn-lg w-full">
              {route ? <Navigation className="h-5 w-5" aria-hidden /> : <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              <span>{route ? `Navigasi ke ${selected.short_name}` : "Menghitung rute…"}</span>
            </button>
            <p className="text-center text-xs leading-normal text-muted">Tekan “Sudah sampai” di layar navigasi setelah tiba di IGD.</p>
          </>
        ) : (
          <button type="button" onClick={onBack} className="btn btn-secondary btn-lg w-full">
            Kembali ke ringkasan
          </button>
        )}
      </div>
      </div>
    </section>
  );
}
