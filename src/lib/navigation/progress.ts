// Logika navigasi langsung (opsi C): posisi di sepanjang rute, deteksi menyimpang, dan
// kebijakan hitung ulang rute yang hemat permintaan. Murni, tanpa I/O, berjalan di klien.

import type { RouteStep } from "@/lib/routing/steps";

export type Pt = { lat: number; lng: number };
type Pair = [number, number]; // [lat, lng]

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Jarak garis lurus dua titik dalam meter. */
export function distM(a: Pt, b: Pt): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type RouteIndex = { points: Pair[]; cum: number[]; total: number };

/** Hitung jarak kumulatif sepanjang polyline (meter). */
export function buildRouteIndex(geometry: Pair[]): RouteIndex {
  const cum = [0];
  for (let i = 1; i < geometry.length; i++) {
    cum.push(cum[i - 1] + distM({ lat: geometry[i - 1][0], lng: geometry[i - 1][1] }, { lat: geometry[i][0], lng: geometry[i][1] }));
  }
  return { points: geometry, cum, total: cum[cum.length - 1] ?? 0 };
}

export type Projection = {
  /** Jarak tegak lurus posisi ke garis rute (meter). */
  offRouteM: number;
  /** Jarak yang sudah ditempuh sepanjang rute sampai titik proyeksi (meter). */
  alongM: number;
  /** Titik proyeksi pada rute. */
  snapped: Pt;
};

/** Proyeksikan posisi ke segmen rute terdekat (pendekatan bidang lokal, cukup untuk skala kota). */
export function projectOnRoute(pos: Pt, idx: RouteIndex): Projection {
  const pts = idx.points;
  if (pts.length === 0) return { offRouteM: Infinity, alongM: 0, snapped: pos };
  if (pts.length === 1) return { offRouteM: distM(pos, { lat: pts[0][0], lng: pts[0][1] }), alongM: 0, snapped: { lat: pts[0][0], lng: pts[0][1] } };
  const mLat = 111320;
  const mLng = 111320 * Math.cos(rad(pos.lat));
  let best: Projection = { offRouteM: Infinity, alongM: 0, snapped: pos };
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = (pts[i][1] - pos.lng) * mLng;
    const ay = (pts[i][0] - pos.lat) * mLat;
    const bx = (pts[i + 1][1] - pos.lng) * mLng;
    const by = (pts[i + 1][0] - pos.lat) * mLat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const d = Math.hypot(px, py);
    if (d < best.offRouteM) {
      best = {
        offRouteM: d,
        alongM: idx.cum[i] + t * (idx.cum[i + 1] - idx.cum[i]),
        snapped: { lat: pts[i][0] + t * (pts[i + 1][0] - pts[i][0]), lng: pts[i][1] + t * (pts[i + 1][1] - pts[i][1]) },
      };
    }
  }
  return best;
}

/** Titik pada rute setelah menempuh `alongM` meter (untuk simulasi). */
export function pointAlong(idx: RouteIndex, alongM: number): Pt {
  const pts = idx.points;
  if (pts.length === 0) return { lat: 0, lng: 0 };
  const a = Math.max(0, Math.min(idx.total, alongM));
  let i = 1;
  while (i < pts.length - 1 && idx.cum[i] < a) i++;
  const seg = idx.cum[i] - idx.cum[i - 1];
  const t = seg === 0 ? 0 : (a - idx.cum[i - 1]) / seg;
  return { lat: pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), lng: pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]) };
}

/** Ambang menyimpang: lebih longgar saat akurasi GPS buruk agar tidak salah deteksi. */
export function offRouteThresholdM(accuracyM: number | null): number {
  const acc = accuracyM ?? 0;
  return Math.max(50, Math.min(acc * 1.5, 150));
}

export function hasArrived(pos: Pt, dest: Pt, accuracyM: number | null): boolean {
  return distM(pos, dest) <= Math.max(40, Math.min(accuracyM ?? 0, 80));
}

export type StepProgress = {
  /** Indeks langkah yang sedang dijalani. */
  index: number;
  /** Petunjuk berikutnya (null bila sudah di langkah terakhir). */
  next: RouteStep | null;
  /** Jarak ke manuver berikutnya (meter). */
  toNextM: number;
};

/** Tentukan langkah aktif dan jarak ke manuver berikutnya dari jarak yang sudah ditempuh. */
export function stepProgress(steps: RouteStep[], alongM: number): StepProgress | null {
  if (steps.length === 0) return null;
  let start = 0;
  for (let i = 0; i < steps.length; i++) {
    const end = start + steps[i].distance_m;
    const isLast = i === steps.length - 1;
    if (alongM < end || isLast) {
      const next = steps[i + 1] ?? null;
      return { index: i, next, toNextM: Math.max(0, end - alongM) };
    }
    start = end;
  }
  return null;
}

export const REROUTE_RULES = {
  /** Harus menyimpang terus-menerus selama ini sebelum rute dihitung ulang. */
  offRouteHoldMs: 10_000,
  /** Jeda minimum antar-permintaan hitung ulang (melindungi OSRM publik). */
  minIntervalMs: 30_000,
  /** Batas total hitung ulang per sesi navigasi. */
  maxPerSession: 8,
} as const;

export type RerouteState = { offRouteSince: number | null; lastRerouteAt: number | null; count: number };

/** Putuskan apakah rute perlu dihitung ulang sekarang. */
export function shouldReroute(s: RerouteState, now: number): boolean {
  if (s.offRouteSince == null) return false;
  if (s.count >= REROUTE_RULES.maxPerSession) return false;
  if (now - s.offRouteSince < REROUTE_RULES.offRouteHoldMs) return false;
  if (s.lastRerouteAt != null && now - s.lastRerouteAt < REROUTE_RULES.minIntervalMs) return false;
  return true;
}

/** Perkiraan sisa waktu secara proporsional terhadap sisa jarak (bukan ETA lalu lintas langsung). */
export function remainingEtaS(totalDurationS: number, totalM: number, remainingM: number): number {
  if (totalM <= 0) return 0;
  return Math.round(totalDurationS * Math.max(0, Math.min(1, remainingM / totalM)));
}
