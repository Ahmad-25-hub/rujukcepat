import type { Facility } from "@/lib/schema/api";
import { CAPABILITY_CODES, type CapabilityCode } from "@/lib/schema/enums";

// Ringkasan kesiapan IGD untuk beranda (data publik, tanpa data pasien).
// "Siap" memakai syarat yang sama dengan pencocokan: IGD_DASAR READY, status belum
// kedaluwarsa, dan kuota > 0. Status kedaluwarsa tidak pernah dihitung sebagai siap.

export type IgdState = "SIAP" | "PENUH" | "MAINTENANCE" | "KEDALUWARSA" | "TIDAK_TERSEDIA";

/** Asal pembaruan terbaru: kapabilitas dari dashboard petugas, dari seed, atau perubahan kuota. */
export type LatestKind = "STAFF" | "SEED" | "CAPACITY";

export type FacilityReadiness = { facility: Facility; state: IgdState };

export type ReadinessSummary = {
  total: number;
  ready: number;
  full: number;
  /** Maintenance, kedaluwarsa, atau tanpa IGD_DASAR. */
  other: number;
  items: FacilityReadiness[];
  latestAt: string | null;
  latestKind: LatestKind | null;
  /** Jumlah RS yang siap untuk tiap kode kapabilitas (READY, segar, kuota > 0). */
  readyByCapability: Record<CapabilityCode, number>;
};

function isStale(updatedAt: string, now: number, staleAfterMinutes: number) {
  return now - Date.parse(updatedAt) > staleAfterMinutes * 60_000;
}

export function igdState(f: Facility, now: number, staleAfterMinutes: number): IgdState {
  const igd = f.capabilities.find((c) => c.code === "IGD_DASAR");
  if (!igd) return "TIDAK_TERSEDIA";
  if (isStale(igd.updated_at, now, staleAfterMinutes)) return "KEDALUWARSA";
  if (igd.status === "MAINTENANCE") return "MAINTENANCE";
  if (igd.status === "PENUH" || f.available_slots <= 0) return "PENUH";
  return "SIAP";
}

const STATE_ORDER: Record<IgdState, number> = { SIAP: 0, PENUH: 1, MAINTENANCE: 2, KEDALUWARSA: 3, TIDAK_TERSEDIA: 4 };

export function summarizeReadiness(facilities: Facility[], now: number, staleAfterMinutes: number): ReadinessSummary {
  const items = facilities
    .map((facility) => ({ facility, state: igdState(facility, now, staleAfterMinutes) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.facility.available_slots - a.facility.available_slots);

  const readyByCapability = Object.fromEntries(CAPABILITY_CODES.map((c) => [c, 0])) as Record<CapabilityCode, number>;
  let latest = -Infinity;
  let latestKind: LatestKind | null = null;

  for (const f of facilities) {
    const t = Date.parse(f.capacity_updated_at);
    if (t > latest) {
      latest = t;
      latestKind = "CAPACITY";
    }
    for (const c of f.capabilities) {
      const ct = Date.parse(c.updated_at);
      if (ct > latest) {
        latest = ct;
        latestKind = c.source === "DASHBOARD_SIMULASI" ? "STAFF" : "SEED";
      }
      if (c.status === "READY" && f.available_slots > 0 && !isStale(c.updated_at, now, staleAfterMinutes)) readyByCapability[c.code] += 1;
    }
  }

  const ready = items.filter((i) => i.state === "SIAP").length;
  const full = items.filter((i) => i.state === "PENUH").length;
  return {
    total: items.length,
    ready,
    full,
    other: items.length - ready - full,
    items,
    latestAt: Number.isFinite(latest) ? new Date(latest).toISOString() : null,
    latestKind,
    readyByCapability,
  };
}
