import { describe, expect, it } from "vitest";
import { igdState, summarizeReadiness } from "@/lib/facilities/readiness";
import type { Facility } from "@/lib/schema/api";
import type { CapabilityCode, CapabilityStatus } from "@/lib/schema/enums";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const FRESH = "2026-10-31T11:50:00Z";
const STALE = "2026-10-28T12:00:00Z";

function fac(
  id: string,
  caps: Partial<Record<CapabilityCode, CapabilityStatus | [CapabilityStatus, string, string?]>>,
  slots = 2,
  capacityAt = "2026-10-31T11:00:00Z",
): Facility {
  return {
    id,
    name: `RS ${id}`,
    short_name: id,
    lat: -6.2,
    lng: 106.84,
    address: null,
    osm_id: null,
    location_source: "OSM",
    location_fetched_at: null,
    total_slots: 5,
    available_slots: slots,
    capacity_updated_at: capacityAt,
    is_simulated: true,
    capabilities: Object.entries(caps).map(([code, v]) => {
      const [status, at, source] = Array.isArray(v) ? v : [v, FRESH];
      return { code: code as CapabilityCode, status, updated_at: at, is_simulated: true, source: source ?? "SEED_SIMULASI" };
    }),
  };
}

describe("igdState", () => {
  it("siap hanya bila IGD_DASAR READY, segar, dan kuota > 0", () => {
    expect(igdState(fac("A", { IGD_DASAR: "READY" }), NOW, 120)).toBe("SIAP");
    expect(igdState(fac("B", { IGD_DASAR: "READY" }, 0), NOW, 120)).toBe("PENUH");
    expect(igdState(fac("C", { IGD_DASAR: "PENUH" }), NOW, 120)).toBe("PENUH");
    expect(igdState(fac("D", { IGD_DASAR: "MAINTENANCE" }), NOW, 120)).toBe("MAINTENANCE");
    expect(igdState(fac("E", { CT_SCAN: "READY" }), NOW, 120)).toBe("TIDAK_TERSEDIA");
  });

  it("status kedaluwarsa tidak ditampilkan sebagai siap", () => {
    expect(igdState(fac("A", { IGD_DASAR: ["READY", STALE] }), NOW, 120)).toBe("KEDALUWARSA");
  });
});

describe("summarizeReadiness", () => {
  const list = [
    fac("Penuh", { IGD_DASAR: "READY", CT_SCAN: "READY" }, 0),
    fac("Siap1", { IGD_DASAR: "READY", CT_SCAN: "READY", CATH_LAB: ["READY", STALE] }, 1),
    fac("Lama", { IGD_DASAR: ["READY", STALE] }),
    fac("Siap2", { IGD_DASAR: "READY", ICU_VENTILATOR: ["READY", "2026-10-31T11:58:00Z", "DASHBOARD_SIMULASI"] }, 3),
  ];
  const s = summarizeReadiness(list, NOW, 120);

  it("menghitung siap, penuh, dan lainnya serta mengurutkan yang siap lebih dulu", () => {
    expect([s.total, s.ready, s.full, s.other]).toEqual([4, 2, 1, 1]);
    expect(s.items.map((i) => i.facility.id)).toEqual(["Siap2", "Siap1", "Penuh", "Lama"]);
  });

  it("layanan siap per kode mengabaikan kuota nol dan status kedaluwarsa", () => {
    expect(s.readyByCapability.IGD_DASAR).toBe(2);
    expect(s.readyByCapability.CT_SCAN).toBe(1);
    expect(s.readyByCapability.CATH_LAB).toBe(0);
    expect(s.readyByCapability.ICU_VENTILATOR).toBe(1);
  });

  it("pembaruan terbaru beserta asalnya", () => {
    expect(s.latestAt).toBe("2026-10-31T11:58:00.000Z");
    expect(s.latestKind).toBe("STAFF");
    const cap = summarizeReadiness([fac("K", { IGD_DASAR: "READY" }, 1, "2026-10-31T11:59:00Z")], NOW, 120);
    expect(cap.latestKind).toBe("CAPACITY");
    expect(summarizeReadiness([], NOW, 120)).toMatchObject({ total: 0, latestAt: null, latestKind: null });
  });
});
