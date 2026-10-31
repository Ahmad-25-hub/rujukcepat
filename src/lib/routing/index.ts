import "server-only";
import { config } from "@/lib/config";
import { haversineKm } from "@/lib/geo";
import type { LatLng } from "@/lib/schema/api";

// Adapter rute/ETA. LIVE = OSRM (perkiraan rute tanpa lalu lintas langsung).
// MOCK = perkiraan simulasi dari jarak garis lurus, selalu berlabel "simulasi".

export type EtaSource = "OSRM" | "MOCK";
export type EtaEntry = { duration_s: number; distance_m: number } | null;
export type TableResult = { source: EtaSource; entries: EtaEntry[] };
export type RouteResult = {
  source: EtaSource;
  duration_s: number;
  distance_m: number;
  geometry: [number, number][]; // [lat, lng]
};

export class RoutingError extends Error {}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: EtaEntry }>();

function key(o: LatLng, d: LatLng) {
  return `${o.lat.toFixed(3)},${o.lng.toFixed(3)}>${d.lat.toFixed(5)},${d.lng.toFixed(5)}`;
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.routingTimeoutMs),
    headers: { "User-Agent": "RujukCepat-demo/0.1" },
    cache: "no-store",
  });
  if (!res.ok) throw new RoutingError(`OSRM HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "Ok") throw new RoutingError(`OSRM ${json.code}`);
  return json;
}

function mockEntry(o: LatLng, d: LatLng): EtaEntry {
  const km = haversineKm(o, d) * 1.35;
  return { duration_s: Math.round((km / 25) * 3600), distance_m: Math.round(km * 1000) };
}

/** ETA dari satu asal ke banyak tujuan. Melempar RoutingError bila layanan gagal. */
export async function etaTable(origin: LatLng, destinations: LatLng[]): Promise<TableResult> {
  if (destinations.length === 0) return { source: config.routingMode === "mock" ? "MOCK" : "OSRM", entries: [] };
  if (config.routingMode === "mock") {
    return { source: "MOCK", entries: destinations.map((d) => mockEntry(origin, d)) };
  }
  const now = Date.now();
  const entries: EtaEntry[] = new Array(destinations.length).fill(null);
  const missing: number[] = [];
  destinations.forEach((d, i) => {
    const c = cache.get(key(origin, d));
    if (c && now - c.at < CACHE_TTL_MS) entries[i] = c.value;
    else missing.push(i);
  });
  if (missing.length) {
    const coords = [origin, ...missing.map((i) => destinations[i])].map((p) => `${p.lng},${p.lat}`).join(";");
    const json = await fetchJson(
      `${config.osrmBaseUrl}/table/v1/driving/${coords}?sources=0&annotations=duration,distance`,
    );
    missing.forEach((destIdx, j) => {
      const dur = json.durations?.[0]?.[j + 1];
      const dist = json.distances?.[0]?.[j + 1];
      const value: EtaEntry = typeof dur === "number" && typeof dist === "number" ? { duration_s: Math.round(dur), distance_m: Math.round(dist) } : null;
      entries[destIdx] = value;
      cache.set(key(origin, destinations[destIdx]), { at: now, value });
    });
  }
  return { source: "OSRM", entries };
}

/** Geometri rute untuk peta. */
export async function routeGeometry(origin: LatLng, dest: LatLng): Promise<RouteResult> {
  if (config.routingMode === "mock") {
    const e = mockEntry(origin, dest)!;
    return { source: "MOCK", ...e, geometry: [[origin.lat, origin.lng], [dest.lat, dest.lng]] };
  }
  const json = await fetchJson(
    `${config.osrmBaseUrl}/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=simplified&geometries=geojson`,
  );
  const r = json.routes?.[0];
  if (!r) throw new RoutingError("OSRM tanpa rute");
  return {
    source: "OSRM",
    duration_s: Math.round(r.duration),
    distance_m: Math.round(r.distance),
    geometry: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
  };
}
