import { describe, expect, it } from "vitest";
import { noCandidateReason, rankCandidates, screenAll, screenFacility } from "@/lib/matching/match";
import type { Need } from "@/lib/schema/ai";
import type { Facility } from "@/lib/schema/api";
import { CAPABILITY_CODES, type CapabilityCode, type CapabilityStatus } from "@/lib/schema/enums";

const NOW = new Date("2026-10-31T12:00:00Z");
const FRESH = "2026-10-31T11:50:00Z";
const STALE = "2026-10-28T12:00:00Z";
const ORIGIN = { lat: -6.2, lng: 106.84 };

function fac(
  id: string,
  pos: { lat: number; lng: number },
  caps: Partial<Record<CapabilityCode, CapabilityStatus | [CapabilityStatus, string]>>,
  slots = 2,
): Facility {
  return {
    id,
    name: `RS ${id}`,
    short_name: id,
    ...pos,
    address: null,
    osm_id: null,
    location_source: "OSM",
    location_fetched_at: null,
    total_slots: 5,
    available_slots: slots,
    capacity_updated_at: FRESH,
    is_simulated: true,
    capabilities: Object.entries(caps).map(([code, v]) => {
      const [status, at] = Array.isArray(v) ? v : [v, FRESH];
      return { code: code as CapabilityCode, status, updated_at: at, is_simulated: true, source: "TEST" };
    }),
  };
}

const need = (code: CapabilityCode, required = true): Need => ({ code, required, reason: "tes" });

describe("screenFacility – kelayakan", () => {
  it("mendukung delapan kode kapabilitas", () => {
    const all = Object.fromEntries(CAPABILITY_CODES.map((c) => [c, "READY"])) as Record<CapabilityCode, CapabilityStatus>;
    const f = fac("A", ORIGIN, all);
    for (const c of CAPABILITY_CODES) {
      expect(screenFacility(f, [need(c)], ORIGIN, NOW, 120).eligible).toBe(true);
    }
  });

  it("PENUH, MAINTENANCE, tidak tersedia, dan kedaluwarsa tersaring dengan alasan", () => {
    const needs = [need("IGD_DASAR")];
    const cases: [Facility, string][] = [
      [fac("P", ORIGIN, { IGD_DASAR: "PENUH" }), "IGD_DASAR: PENUH"],
      [fac("M", ORIGIN, { IGD_DASAR: "MAINTENANCE" }), "IGD_DASAR: MAINTENANCE"],
      [fac("T", ORIGIN, { CT_SCAN: "READY" }), "IGD_DASAR: tidak tersedia"],
      [fac("S", ORIGIN, { IGD_DASAR: ["READY", STALE] }), "kedaluwarsa"],
    ];
    for (const [f, reason] of cases) {
      const s = screenFacility(f, needs, ORIGIN, NOW, 120);
      expect(s.eligible).toBe(false);
      expect(s.reasons.join(" ")).toContain(reason);
    }
  });

  it("kapasitas nol tersaring walau semua kapabilitas READY", () => {
    const s = screenFacility(fac("Z", ORIGIN, { IGD_DASAR: "READY" }, 0), [need("IGD_DASAR")], ORIGIN, NOW, 120);
    expect(s.eligible).toBe(false);
    expect(s.reasons).toContain("Kuota rujukan simulasi 0");
  });

  it("beberapa kebutuhan wajib: semua harus READY", () => {
    const f = fac("A", ORIGIN, { IGD_DASAR: "READY", CATH_LAB: "MAINTENANCE" });
    expect(screenFacility(f, [need("IGD_DASAR"), need("CATH_LAB")], ORIGIN, NOW, 120).eligible).toBe(false);
    expect(screenFacility(f, [need("IGD_DASAR"), need("CATH_LAB", false)], ORIGIN, NOW, 120).eligible).toBe(true);
  });
});

describe("screenAll + rankCandidates – urutan", () => {
  const near = { lat: -6.201, lng: 106.841 };
  const mid = { lat: -6.22, lng: 106.86 };
  const far = { lat: -6.3, lng: 106.9 };

  it("tidak ada kandidat → kosong, semua dikecualikan, tanpa pelonggaran", () => {
    const fs = [fac("A", near, { IGD_DASAR: "READY" }), fac("B", mid, { IGD_DASAR: "PENUH", CATH_LAB: "READY" })];
    const needs = [need("IGD_DASAR"), need("CATH_LAB")];
    const r = screenAll(fs, needs, ORIGIN, NOW, 120, 5);
    expect(r.toRoute).toHaveLength(0);
    expect(r.excluded).toHaveLength(2);
    expect(noCandidateReason(needs, r.excluded)).toContain("IGD_DASAR, CATH_LAB");
  });

  it("urut ETA berkendara, bukan jarak garis lurus", () => {
    const fs = [fac("Dekat", near, { IGD_DASAR: "READY" }), fac("Jauh", far, { IGD_DASAR: "READY" })];
    const { toRoute } = screenAll(fs, [need("IGD_DASAR")], ORIGIN, NOW, 120, 5);
    expect(toRoute.map((s) => s.facility.id)).toEqual(["Dekat", "Jauh"]);
    // misal jalan ke "Dekat" macet/memutar: ETA lebih lama
    const ranked = rankCandidates(toRoute, [{ duration_s: 1800, distance_m: 9000 }, { duration_s: 900, distance_m: 15000 }], "OSRM");
    expect(ranked.map((c) => c.short_name)).toEqual(["Jauh", "Dekat"]);
    expect(ranked[0]).toMatchObject({ eta_seconds: 900, eta_source: "OSRM" });
  });

  it("rute gagal → ETA null (bukan ETA palsu), urut jarak garis lurus", () => {
    const fs = [fac("Jauh", far, { IGD_DASAR: "READY" }), fac("Dekat", near, { IGD_DASAR: "READY" })];
    const { toRoute } = screenAll(fs, [need("IGD_DASAR")], ORIGIN, NOW, 120, 5);
    const ranked = rankCandidates(toRoute, null, null);
    expect(ranked.map((c) => c.short_name)).toEqual(["Dekat", "Jauh"]);
    expect(ranked.every((c) => c.eta_seconds === null && c.eta_source === null)).toBe(true);
  });

  it("rute sebagian gagal → kandidat ber-ETA didahulukan", () => {
    const fs = [fac("A", near, { IGD_DASAR: "READY" }), fac("B", far, { IGD_DASAR: "READY" })];
    const { toRoute } = screenAll(fs, [need("IGD_DASAR")], ORIGIN, NOW, 120, 5);
    const ranked = rankCandidates(toRoute, [null, { duration_s: 2000, distance_m: 20000 }], "OSRM");
    expect(ranked.map((c) => c.short_name)).toEqual(["B", "A"]);
  });

  it("ETA seri dipecah oleh kebutuhan opsional terpenuhi lalu slot", () => {
    const fs = [
      fac("TanpaICU", near, { IGD_DASAR: "READY" }, 4),
      fac("DenganICU", mid, { IGD_DASAR: "READY", ICU_VENTILATOR: "READY" }, 1),
    ];
    const { toRoute } = screenAll(fs, [need("IGD_DASAR"), need("ICU_VENTILATOR", false)], ORIGIN, NOW, 120, 5);
    const same = { duration_s: 600, distance_m: 5000 };
    const ranked = rankCandidates(toRoute, [same, same], "OSRM");
    expect(ranked[0].short_name).toBe("DenganICU");
    expect(ranked[1].optional_missing).toEqual(["ICU_VENTILATOR"]);
  });

  it("hanya maksimal N kandidat terdekat yang dirutekan", () => {
    const fs = Array.from({ length: 8 }, (_, i) => fac(`R${i}`, { lat: -6.2 - i * 0.01, lng: 106.84 }, { IGD_DASAR: "READY" }));
    const r = screenAll(fs, [need("IGD_DASAR")], ORIGIN, NOW, 120, 5);
    expect(r.toRoute).toHaveLength(5);
    expect(r.otherEligible).toBe(3);
  });
});
