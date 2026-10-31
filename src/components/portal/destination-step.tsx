"use client";

import { Ban, CheckCircle2, Hospital, Loader2, Navigation, Phone, RefreshCw, Route, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CapStatusChip, SimBadge } from "@/components/badges";
import MapView, { type MapMarker } from "@/components/map-dynamic";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { formatEta, formatKm, timeAgo } from "@/lib/client/format";
import type { Candidate, MatchResult } from "@/lib/matching/match";
import type { AnalyzeResponse, Need } from "@/lib/schema/ai";
import type { ReferralResponse } from "@/lib/schema/referral";
import type { RouteStep } from "@/lib/routing/steps";
import type { ReporterLocation } from "./location-step";
import { NavigationView } from "./navigation-view";
import { RouteGuide } from "./route-guide";

type RouteGeo = { source: "OSRM" | "MOCK"; duration_s: number; distance_m: number; geometry: [number, number][]; steps: RouteStep[] };

function EtaLine({ c }: { c: Candidate }) {
  if (c.eta_seconds == null) {
    return (
      <p className="text-sm text-slate-700">
        <strong>ETA tidak tersedia</strong> · jarak garis lurus {c.straight_km.toLocaleString("id-ID")} km (bukan waktu tempuh)
      </p>
    );
  }
  return (
    <p className="text-base">
      <strong>{formatEta(c.eta_seconds)}</strong>
      {c.distance_m != null && <> · {formatKm(c.distance_m)}</>}{" "}
      <span className="text-xs text-slate-600">
        {c.eta_source === "MOCK" ? "(ETA simulasi)" : "(perkiraan rute OSRM tanpa lalu lintas langsung)"}
      </span>
    </p>
  );
}

function CandidateCard({
  c,
  label,
  selected,
  onSelect,
}: {
  c: Candidate;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full space-y-2 rounded-xl border-2 p-4 text-left ${selected ? "border-blue-700 bg-blue-50 ring-2 ring-blue-300" : "border-slate-300 bg-white"}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
          {selected && (
            <span className="flex items-center gap-1 text-sm font-bold text-blue-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Dipilih
            </span>
          )}
        </div>
        <p className="text-lg font-bold leading-tight">{c.short_name}</p>
        <p className="text-sm text-slate-600">{c.name}</p>
        <EtaLine c={c} />
        <div className="flex flex-wrap gap-1.5">
          {c.checks.map((k) => (
            <span key={k.code} className="inline-flex items-center gap-1 text-xs">
              <span className="font-semibold">
                {k.code}
                {k.required ? "*" : ""}
              </span>
              <CapStatusChip status={k.status} />
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Kuota rujukan: <strong>{c.available_slots}</strong>/{c.total_slots}
          </span>
          {c.is_simulated && <SimBadge>Kapasitas simulasi</SimBadge>}
          <span className="text-xs text-slate-600">diperbarui {timeAgo(c.capacity_updated_at)}</span>
        </div>
      </button>
    </li>
  );
}

export function DestinationStep({
  location,
  needs,
  analysis,
  online,
  selectedId,
  onSelect,
  onSent,
  onBack,
}: {
  location: ReporterLocation;
  needs: Need[];
  analysis: AnalyzeResponse;
  online: boolean;
  selectedId: string | null;
  onSelect: (c: Candidate | null) => void;
  onSent: (referralId: string) => void;
  onBack: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; conflict: boolean } | null>(null);
  // Satu kunci per percobaan pengiriman (RS + kebutuhan): klik ganda/retry jaringan memakai kunci yang sama.
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
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

  async function send(candidate: Candidate) {
    if (sending) return;
    setSending(true);
    setSendError(null);
    const sig = `${candidate.facility_id}|${needs.map((n) => `${n.code}:${n.required}`).join(",")}`;
    if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: crypto.randomUUID() };
    try {
      const d = await apiFetch<ReferralResponse>("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current.key },
        body: JSON.stringify({
          hospital_id: candidate.facility_id,
          ai_result: analysis.result,
          needs: needs.map(({ code, required, reason }) => ({ code, required, reason })),
          location: { lat: location.lat, lng: location.lng },
          location_source: location.source,
        }),
      });
      keyRef.current = null;
      onSent(d.referral.id);
    } catch (e) {
      const conflict = e instanceof ApiClientError && e.status === 409;
      setSendError({ message: e instanceof ApiClientError ? e.message : "Pengiriman gagal. Silakan coba lagi.", conflict });
      if (conflict) {
        // Kapasitas/kesiapan berubah: muat ulang kandidat dan minta pengguna memilih ulang.
        keyRef.current = null;
        onSelect(null);
        setLoading(true);
        void fetchMatch();
      }
    } finally {
      setSending(false);
    }
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
      <div role="status" className="flex items-center justify-center gap-3 rounded-xl bg-white p-10 text-lg">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Mencocokkan kebutuhan dengan kesiapan rumah sakit…
      </div>
    );
  }

  if (error || !result) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border-2 border-red-300 bg-red-50 p-4">
        <p className="text-base text-red-900">{error}</p>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="flex items-center gap-2 rounded-lg bg-red-700 px-4 py-3 font-bold text-white">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Coba lagi
          </button>
          <button type="button" onClick={onBack} className="rounded-lg border-2 border-slate-400 bg-white px-4 py-3 font-bold">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="dest-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dest-title" className="flex items-center gap-2 text-xl font-bold">
          <Hospital className="h-6 w-6 text-blue-700" aria-hidden />
          Pilih rumah sakit tujuan
        </h2>
        <button type="button" onClick={load} className="flex items-center gap-1 text-sm font-semibold text-blue-800 underline">
          <RefreshCw className="h-4 w-4" aria-hidden />
          Perbarui
        </button>
      </div>

      <div className="space-y-1 rounded-lg border border-slate-300 bg-white p-3 text-sm">
        <p className="flex items-start gap-2">
          <Route className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {result.routing_note}
            {location.source === "MANUAL" && " Dihitung dari titik yang Anda pilih secara manual."}
          </span>
        </p>
        <p className="text-xs text-slate-600">Aturan: {result.policy} Kebutuhan bertanda * wajib.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <SimBadge>Status & kapasitas RS simulasi</SimBadge>
          {result.routing_status === "MOCK" && <SimBadge>Rute simulasi</SimBadge>}
        </div>
      </div>

      <MapView origin={location} markers={markers} route={route?.geometry ?? null} fitTo={focusPoint ? [focusPoint] : fitTo} onMarkerClick={(id) => onSelect(all.find((c) => c.facility_id === id) ?? null)} className="h-80" />
      <p className="text-xs text-slate-600">
        Lokasi RS dari OpenStreetMap; tidak menyiratkan kemitraan atau penerimaan pasien.
        {route && ` Garis biru: ${route.source === "MOCK" ? "garis lurus simulasi" : "rute perkiraan OSRM"}.`}
        {routeError && ` ${routeError}`}
      </p>
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
          onStartNavigation={() => setNavigating(true)}
        />
      )}
      {navigating && selected && route && (
        <NavigationView
          hospital={{ id: selected.facility_id, short_name: selected.short_name, name: selected.name, lat: selected.lat, lng: selected.lng }}
          origin={location}
          initialRoute={{ ...route, steps: route.steps ?? [] }}
          onClose={() => setNavigating(false)}
        />
      )}

      {result.primary ? (
        <ul className="space-y-3">
          <CandidateCard c={result.primary} label="Kandidat utama" selected={selectedId === result.primary.facility_id} onSelect={() => onSelect(result.primary)} />
          {result.alternatives.map((c, i) => (
            <CandidateCard key={c.facility_id} c={c} label={`Alternatif ${i + 1}`} selected={selectedId === c.facility_id} onSelect={() => onSelect(c)} />
          ))}
          {result.alternatives.length === 0 && <li className="text-sm text-slate-700">Tidak ada alternatif lain yang memenuhi kebutuhan wajib.</li>}
          {result.other_eligible_count > 0 && <li className="text-sm text-slate-700">{result.other_eligible_count} RS layak lain lebih jauh tidak ditampilkan.</li>}
        </ul>
      ) : (
        <div role="alert" className="space-y-3 rounded-xl border-2 border-red-400 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-lg font-bold text-red-900">
            <Ban className="h-5 w-5" aria-hidden />
            Tidak ada kandidat yang sesuai
          </p>
          <p className="text-base text-red-950">{result.no_candidate_reason}</p>
          <ul className="list-disc space-y-1 pl-5 text-base text-red-950">
            <li>
              Hubungi layanan darurat <a href="tel:119" className="font-bold underline">119</a> / <a href="tel:112" className="font-bold underline">112</a>.
            </li>
            <li>Tinjau kembali kebutuhan (mis. jadikan opsional bila tidak mutlak).</li>
            <li>Coba lagi beberapa saat; status fasilitas dapat berubah.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onBack} className="rounded-lg bg-red-700 px-4 py-3 font-bold text-white">
              Tinjau kebutuhan
            </button>
            <a href="tel:119" className="flex items-center gap-2 rounded-lg border-2 border-red-700 bg-white px-4 py-3 font-bold text-red-800">
              <Phone className="h-4 w-4" aria-hidden />
              Telepon 119
            </a>
          </div>
        </div>
      )}

      {result.excluded.length > 0 && (
        <details className="rounded-xl border border-slate-300 bg-white p-3">
          <summary className="cursor-pointer text-base font-semibold">RS yang dikecualikan ({result.excluded.length}) dan alasannya</summary>
          <ul className="mt-2 divide-y divide-slate-200">
            {result.excluded.map((x) => (
              <li key={x.facility_id} className="py-2 text-sm">
                <p className="font-semibold">{x.short_name}</p>
                <p className="text-slate-700">{x.reasons.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {selected && (
        <div className="space-y-3 rounded-xl border-2 border-blue-700 bg-white p-4">
          <p className="flex items-center gap-2 text-base font-bold">
            <Navigation className="h-5 w-5 text-blue-700" aria-hidden />
            Tujuan dipilih: {selected.short_name}
          </p>
          <p className="text-sm text-slate-700">
            Pilihan ini <strong>belum</strong> merupakan konfirmasi rumah sakit. Rumah sakit baru mengetahui setelah permintaan rujukan dikirim, dan penerimaan
            tetap diputuskan petugas IGD.
          </p>
          {sendError && (
            <p role="alert" className="rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm text-red-950">
              {sendError.message}
              {sendError.conflict && " Daftar tujuan sudah diperbarui."}
            </p>
          )}
          {!online && (
            <p role="alert" className="text-sm font-semibold text-red-800">
              Anda offline. Rujukan tidak dapat dikirim sampai koneksi kembali; tidak ada antrean offline.
            </p>
          )}
          <button
            type="button"
            onClick={() => void send(selected)}
            disabled={sending || !online}
            aria-busy={sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-6 py-4 text-lg font-bold text-white hover:bg-red-800 disabled:bg-slate-400"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
            {sending ? "Mengirim…" : sendError && !sendError.conflict ? "Coba kirim lagi" : "Kirim permintaan rujukan"}
          </button>
          <p className="text-xs text-slate-600">
            Mengirim akan menahan satu kuota simulasi di {selected.short_name} sampai petugas menjawab. Server memeriksa ulang kesiapan dan kapasitas saat pengiriman.
          </p>
        </div>
      )}

      <button type="button" onClick={onBack} className="w-full rounded-xl border-2 border-slate-500 bg-white px-4 py-3 text-base font-bold">
        Kembali ke ringkasan
      </button>
    </section>
  );
}
