"use client";

import { AlertTriangle, CircleCheck, Crosshair, ExternalLink, FlaskConical, Flag, Loader2, Navigation, RefreshCw, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { type LivePosition, type MapMarker } from "@/components/map-dynamic";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { formatEta, formatKm } from "@/lib/client/format";
import {
  buildRouteIndex,
  hasArrived,
  offRouteThresholdM,
  pointAlong,
  projectOnRoute,
  remainingEtaS,
  REROUTE_RULES,
  shouldReroute,
  stepProgress,
  type Pt,
  type RouteIndex,
} from "@/lib/navigation/progress";
import { externalNavLinks, formatStepDistance, type RouteStep } from "@/lib/routing/steps";
import { StepIcon } from "./route-guide";

export type RouteData = {
  source: "OSRM" | "MOCK";
  duration_s: number;
  distance_m: number;
  geometry: [number, number][];
  steps: RouteStep[];
};

type GpsStatus = "waiting" | "tracking" | "denied" | "unsupported";
type Gps = { status: GpsStatus; pos: LivePosition | null };

const SIM_SPEED_MPS = 25; // ±90 km/jam, agar demo singkat
const SIM_OFFSET_DEG = 0.0016; // ±180 m, memicu deteksi menyimpang

const GPS_DENIED =
  "Izin lokasi ditolak. Buka pengaturan izin situs di browser (ikon gembok di bilah alamat) lalu coba lagi, atau gunakan aplikasi peta di perangkat Anda.";

function spokenDistance(m: number) {
  return formatStepDistance(m).replace(/ km$/, " kilometer").replace(/ m$/, " meter");
}

function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function speak(text: string) {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "id-ID";
  window.speechSynthesis.speak(u);
}

export function NavigationView({
  hospital,
  origin,
  initialRoute,
  onClose,
  onArrived,
}: {
  hospital: { id: string; short_name: string; name: string; lat: number; lng: number };
  origin: Pt;
  initialRoute: RouteData;
  onClose: () => void;
  /** Pengguna menyatakan sudah sampai (tombol), terlepas dari deteksi GPS. */
  onArrived: () => void;
}) {
  const [route, setRoute] = useState<RouteData>(initialRoute);
  const idx = useMemo(() => buildRouteIndex(route.geometry), [route]);
  const idxRef = useRef<RouteIndex>(idx);
  const routeRef = useRef<RouteData>(initialRoute);

  const [gps, setGps] = useState<Gps>(() => ({
    status: typeof navigator !== "undefined" && "geolocation" in navigator ? "waiting" : "unsupported",
    pos: null,
  }));
  const [gpsIssue, setGpsIssue] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [simulate, setSimulate] = useState(false);
  const [offRoute, setOffRoute] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [rerouteNote, setRerouteNote] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const [voice, setVoice] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const offRouteSince = useRef<number | null>(null);
  const lastRerouteAt = useRef<number | null>(null);
  const rerouteCount = useRef(0);
  const reroutingRef = useRef(false);
  const arrivedRef = useRef(false);
  const voiceRef = useRef(false);
  const lastSpokenStep = useRef<number | null>(null);
  const simAlong = useRef(0);
  const simOffset = useRef<Pt>({ lat: 0, lng: 0 });
  const titleRef = useRef<HTMLHeadingElement>(null);

  const applyRoute = useCallback((r: RouteData) => {
    routeRef.current = r;
    idxRef.current = buildRouteIndex(r.geometry);
    setRoute(r);
    lastSpokenStep.current = null;
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const doReroute = useCallback(
    async (p: LivePosition) => {
      reroutingRef.current = true;
      setRerouting(true);
      lastRerouteAt.current = Date.now();
      rerouteCount.current += 1;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const data = await apiFetch<RouteData>(`/api/route?lat=${p.lat}&lng=${p.lng}&hospital_id=${hospital.id}`, { signal: ctrl.signal });
        applyRoute({ ...data, steps: data.steps ?? [] });
        offRouteSince.current = null;
        setOffRoute(false);
        setRerouteNote(null);
        simAlong.current = 0;
        simOffset.current = { lat: 0, lng: 0 };
        if (voiceRef.current) speak("Rute baru dihitung.");
      } catch (e) {
        if (!(e instanceof ApiClientError && e.code === "ABORTED")) {
          setRerouteNote(
            `${e instanceof ApiClientError ? e.message : "Rute baru gagal dihitung."} Anda masih bisa mengikuti garis lama atau membuka aplikasi peta.`,
          );
        }
      } finally {
        reroutingRef.current = false;
        setRerouting(false);
      }
    },
    [applyRoute, hospital.id],
  );

  const handlePosition = useCallback(
    (p: LivePosition) => {
      if (arrivedRef.current) return;
      setGps({ status: "tracking", pos: p });
      setGpsIssue(null);
      const now = Date.now();
      const dest = { lat: hospital.lat, lng: hospital.lng };
      if (hasArrived(p, dest, p.accuracy)) {
        arrivedRef.current = true;
        setArrived(true);
        stopWatching();
        if (voiceRef.current) speak(`Anda telah tiba di ${hospital.short_name}.`);
        return;
      }
      const proj = projectOnRoute(p, idxRef.current);
      const goodFix = p.accuracy == null || p.accuracy <= 100;
      // Pembacaan berakurasi buruk diabaikan: status keluar jalur dan hitungannya dipertahankan.
      if (goodFix) {
        if (proj.offRouteM > offRouteThresholdM(p.accuracy)) {
          if (offRouteSince.current == null) offRouteSince.current = now;
          setOffRoute(true);
          if (rerouteCount.current >= REROUTE_RULES.maxPerSession) {
            setRerouteNote("Batas hitung ulang rute sesi ini tercapai. Gunakan tombol aplikasi peta di bawah.");
          }
        } else {
          offRouteSince.current = null;
          setOffRoute(false);
        }
      }
      if (!reroutingRef.current && shouldReroute({ offRouteSince: offRouteSince.current, lastRerouteAt: lastRerouteAt.current, count: rerouteCount.current }, now)) {
        void doReroute(p);
        return;
      }
      if (voiceRef.current) {
        const sp = stepProgress(routeRef.current.steps, proj.alongM);
        if (sp?.next && sp.toNextM <= 250 && lastSpokenStep.current !== sp.index) {
          lastSpokenStep.current = sp.index;
          speak(`Dalam ${spokenDistance(sp.toNextM)}, ${sp.next.instruction}`);
        }
      }
    },
    [doReroute, hospital.lat, hospital.lng, hospital.short_name, stopWatching],
  );

  const beginWatch = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    stopWatching();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => handlePosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGps({ status: "denied", pos: null });
          stopWatching();
        } else {
          setGpsIssue("Sinyal GPS lemah atau terputus. Posisi terakhir dipertahankan; tetap ikuti garis biru.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  }, [handlePosition, stopWatching]);

  // GPS nyata (bila tidak sedang simulasi).
  useEffect(() => {
    if (simulate) return;
    beginWatch();
    return () => stopWatching();
  }, [simulate, beginWatch, stopWatching]);

  // Simulasi perjalanan di sepanjang rute (berlabel jelas di UI).
  useEffect(() => {
    if (!simulate) return;
    const t = setInterval(() => {
      simAlong.current += SIM_SPEED_MPS;
      const base = pointAlong(idxRef.current, simAlong.current);
      handlePosition({ lat: base.lat + simOffset.current.lat, lng: base.lng + simOffset.current.lng, accuracy: 8 });
    }, 1000);
    return () => clearInterval(t);
  }, [simulate, handlePosition]);

  // Jaga layar tetap menyala selama navigasi (bila didukung).
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible" || arrivedRef.current) return;
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) void s.release();
        else wakeLock.current = s;
      } catch {
        // tidak didukung / ditolak: navigasi tetap berjalan
      }
    };
    void acquire();
    const onVis = () => void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, []);

  // Bersihkan: permintaan rute, suara; Escape menutup; status jaringan.
  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("keydown", onKey);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      abortRef.current?.abort();
      if (speechSupported()) window.speechSynthesis.cancel();
    };
  }, [onClose]);

  function retryGps() {
    setGps({ status: "waiting", pos: null });
    setGpsIssue(null);
    beginWatch();
  }

  function toggleSimulate() {
    const on = !simulate;
    simAlong.current = 0;
    simOffset.current = { lat: 0, lng: 0 };
    offRouteSince.current = null;
    arrivedRef.current = false;
    setArrived(false);
    setOffRoute(false);
    setGps({ status: "waiting", pos: null });
    setSimulate(on);
  }

  function toggleVoice() {
    const on = !voice;
    voiceRef.current = on;
    lastSpokenStep.current = null;
    setVoice(on);
    if (on) speak(`Panduan suara aktif. Menuju ${hospital.short_name}.`);
    else if (speechSupported()) window.speechSynthesis.cancel();
  }

  const pos = gps.pos;
  const proj = pos ? projectOnRoute(pos, idx) : null;
  const alongM = proj?.alongM ?? 0;
  const remainingM = Math.max(0, idx.total - alongM);
  const eta = remainingEtaS(route.duration_s, idx.total, remainingM);
  const sp = stepProgress(route.steps, alongM);
  const links = externalNavLinks(pos ?? origin, hospital);

  const markers: MapMarker[] = [{ id: hospital.id, lat: hospital.lat, lng: hospital.lng, label: hospital.short_name, kind: "selected" }];

  let banner: React.ReactNode;
  if (arrived) {
    banner = (
      <div className="flex items-center gap-3">
        <Flag className="h-8 w-8 shrink-0" aria-hidden />
        <div>
          <p className="text-xl font-extrabold">Anda telah tiba di {hospital.short_name}</p>
          <p className="text-sm text-[#c9d2e0]">Tekan “Sudah sampai” untuk menampilkan ringkasan bagi petugas IGD.</p>
        </div>
      </div>
    );
  } else if (gps.status === "denied" || gps.status === "unsupported") {
    banner = (
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-6 w-6 shrink-0" aria-hidden />
        <div>
          <p className="text-lg font-bold">GPS tidak tersedia</p>
          <p className="text-sm text-[#e6ebf3]">
            {gps.status === "denied" ? GPS_DENIED : "Browser ini tidak mendukung lokasi langsung. Gunakan tombol aplikasi peta di bawah."}
          </p>
        </div>
      </div>
    );
  } else if (!pos) {
    banner = (
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 shrink-0 animate-spin" aria-hidden />
        <p className="text-lg font-bold">{simulate ? "Memulai simulasi…" : "Mencari sinyal GPS…"}</p>
      </div>
    );
  } else if (rerouting) {
    banner = (
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 shrink-0 animate-spin" aria-hidden />
        <p className="text-lg font-bold">Anda keluar jalur. Menghitung ulang rute…</p>
      </div>
    );
  } else if (offRoute) {
    banner = (
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-6 w-6 shrink-0" aria-hidden />
        <p className="text-lg font-bold">Anda keluar jalur. Kembali ke garis biru atau tunggu rute baru.</p>
      </div>
    );
  } else if (sp?.next) {
    banner = (
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-white/15 p-2">
          <StepIcon step={sp.next} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold leading-tight">{formatStepDistance(sp.toNextM)}</p>
          <p className="text-lg font-semibold">{sp.next.instruction}</p>
        </div>
      </div>
    );
  } else {
    banner = (
      <div className="flex items-center gap-3">
        <Navigation className="h-6 w-6 shrink-0" aria-hidden />
        <p className="text-lg font-bold">
          {route.steps.length ? `Lurus menuju ${hospital.short_name}` : `Ikuti garis biru menuju ${hospital.short_name}`}
        </p>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="nav-title" className="fixed inset-0 z-[2000] flex flex-col bg-white">
      <header className="bg-ink px-4 py-3 text-white">
        <h2 id="nav-title" ref={titleRef} tabIndex={-1} className="sr-only">
          Navigasi ke {hospital.name}
        </h2>
        <div aria-live="polite">{banner}</div>
      </header>

      <div className="relative min-h-0 flex-1">
        <MapView
          origin={pos ? undefined : origin}
          originLabel="Titik awal laporan"
          live={pos}
          follow={follow && !!pos}
          onUserPan={() => setFollow(false)}
          markers={markers}
          route={route.geometry}
          fitTo={pos ? undefined : [[origin.lat, origin.lng], [hospital.lat, hospital.lng]]}
          className="h-full rounded-none border-0"
        />
        <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex flex-col items-start gap-1">
          {simulate && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e2b33b] bg-warn-tint px-2 py-0.5 text-xs font-bold text-warn-ink">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              Simulasi GPS – bukan posisi nyata
            </span>
          )}
          {route.source === "MOCK" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e2b33b] bg-warn-tint px-2 py-0.5 text-xs font-bold text-warn-ink">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              Rute simulasi
            </span>
          )}
          {!online && (
            <span className="btn btn-brand">
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
              Offline – peta & rute baru tidak dapat dimuat
            </span>
          )}
        </div>
        {!follow && pos && !arrived && (
          <button
            type="button"
            onClick={() => setFollow(true)}
            className="btn btn-primary"
          >
            <Crosshair className="h-5 w-5" aria-hidden />
            Pusatkan
          </button>
        )}
      </div>

      <footer className="space-y-2 border-t border-line bg-white p-3">
        {(gpsIssue || rerouteNote || (pos?.accuracy != null && pos.accuracy > 100)) && (
          <p role="status" className="notice notice-warn">
            {rerouteNote ?? gpsIssue ?? `Akurasi GPS rendah (± ${Math.round(pos?.accuracy ?? 0)} m); deteksi keluar jalur ditunda.`}
          </p>
        )}
        {!arrived && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-lg">
              <strong>{formatKm(remainingM)}</strong> lagi · <strong>{formatEta(eta)}</strong>
            </p>
            <p className="text-xs text-muted">{route.source === "MOCK" ? "Perkiraan simulasi" : "Perkiraan, tanpa lalu lintas langsung"}</p>
          </div>
        )}

        {(gps.status === "denied" || gps.status === "unsupported" || rerouteNote || offRoute) && (
          <div className="grid grid-cols-2 gap-2">
            <a href={links.google} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Google Maps
            </a>
            <a href={links.waze} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Waze
            </a>
          </div>
        )}

        <button type="button" onClick={onArrived} className={`btn btn-lg w-full bg-ok text-white hover:bg-ok-strong ${arrived ? "anim-pop" : ""}`}>
          <CircleCheck className="h-5 w-5" aria-hidden />
          Sudah sampai
        </button>

        <div className="flex flex-wrap gap-2">
          {gps.status === "denied" && !simulate && (
            <button type="button" onClick={retryGps} className="btn btn-secondary">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Coba GPS lagi
            </button>
          )}
          {speechSupported() ? (
            <button type="button" onClick={toggleVoice} aria-pressed={voice} className="btn btn-secondary">
              {voice ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
              Suara {voice ? "aktif" : "mati"}
            </button>
          ) : (
            <span className="self-center text-xs text-muted">Panduan suara tidak didukung browser ini; ikuti teks di atas.</span>
          )}
          <button type="button" onClick={toggleSimulate} aria-pressed={simulate} className="btn border-[#e2b33b] bg-[#fff8e6] text-sm text-warn-ink hover:bg-warn-tint">
            <FlaskConical className="h-4 w-4" aria-hidden />
            {simulate ? "Matikan simulasi" : "Simulasi perjalanan (demo)"}
          </button>
          {simulate && !arrived && (
            <button
              type="button"
              onClick={() => {
                simOffset.current = { lat: SIM_OFFSET_DEG, lng: SIM_OFFSET_DEG };
              }}
              className="btn border-[#e2b33b] bg-white text-sm text-warn-ink hover:bg-[#fff8e6]"
            >
              Simulasikan keluar jalur
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            <X className="h-4 w-4" aria-hidden />
            {arrived ? "Tutup peta" : "Hentikan navigasi"}
          </button>
        </div>
        <details className="text-[11px] text-muted">
          <summary className="cursor-pointer">Privasi, batasan ETA, dan atribusi</summary>
          <p className="mt-1">
            Posisi GPS hanya diproses di perangkat ini; server hanya menerima koordinat untuk menghitung ulang rute dan tidak menyimpannya.
            {route.source === "MOCK" ? " ETA simulasi." : " ETA OSRM tidak memakai lalu lintas langsung; sisa waktu dihitung proporsional dari sisa jarak."} Peta © OpenStreetMap contributors.
          </p>
        </details>
      </footer>
    </div>
  );
}
