import { describe, expect, it } from "vitest";
import {
  buildRouteIndex,
  distM,
  hasArrived,
  offRouteThresholdM,
  pointAlong,
  projectOnRoute,
  remainingEtaS,
  REROUTE_RULES,
  shouldReroute,
  stepProgress,
} from "@/lib/navigation/progress";
import { buildSteps, instructionFor, externalNavLinks, formatStepDistance } from "@/lib/routing/steps";

// Rute lurus ke timur ±1,1 km di Jakarta, lalu ke utara ±550 m.
const ROUTE: [number, number][] = [
  [-6.2, 106.8],
  [-6.2, 106.81],
  [-6.195, 106.81],
];
const idx = buildRouteIndex(ROUTE);

describe("proyeksi posisi pada rute", () => {
  it("panjang rute sesuai jarak segmen", () => {
    expect(idx.total).toBeGreaterThan(1500);
    expect(idx.total).toBeLessThan(1800);
  });

  it("posisi di atas rute: menyimpang ≈ 0 dan jarak tempuh bertambah", () => {
    const p = projectOnRoute({ lat: -6.2, lng: 106.805 }, idx);
    expect(p.offRouteM).toBeLessThan(1);
    expect(p.alongM).toBeGreaterThan(500);
    expect(p.alongM).toBeLessThan(600);
  });

  it("posisi 100 m dari rute terdeteksi menyimpang ±100 m", () => {
    const p = projectOnRoute({ lat: -6.2009, lng: 106.805 }, idx);
    expect(p.offRouteM).toBeGreaterThan(90);
    expect(p.offRouteM).toBeLessThan(110);
  });

  it("memilih segmen terdekat pada belokan (tidak melompat ke segmen salah)", () => {
    const p = projectOnRoute({ lat: -6.1975, lng: 106.8101 }, idx);
    expect(p.alongM).toBeGreaterThan(idx.cum[1]);
  });

  it("pointAlong kembali ke titik yang sama dengan proyeksi", () => {
    const pos = pointAlong(idx, 800);
    const back = projectOnRoute(pos, idx);
    expect(Math.abs(back.alongM - 800)).toBeLessThan(2);
    expect(back.offRouteM).toBeLessThan(2);
  });
});

describe("ambang menyimpang & tiba", () => {
  it("ambang melonggar saat akurasi GPS buruk dan dibatasi", () => {
    expect(offRouteThresholdM(null)).toBe(50);
    expect(offRouteThresholdM(20)).toBe(50);
    expect(offRouteThresholdM(60)).toBe(90);
    expect(offRouteThresholdM(500)).toBe(150);
  });

  it("tiba bila dalam radius 40 m (atau akurasi, maks 80 m)", () => {
    const dest = { lat: -6.195, lng: 106.81 };
    expect(hasArrived({ lat: -6.1951, lng: 106.81 }, dest, 10)).toBe(true);
    expect(hasArrived({ lat: -6.196, lng: 106.81 }, dest, 10)).toBe(false);
    expect(distM(dest, dest)).toBe(0);
  });
});

describe("kebijakan hitung ulang rute (hemat permintaan)", () => {
  const t0 = 1_000_000;
  it("tidak hitung ulang bila di jalur atau baru sebentar menyimpang", () => {
    expect(shouldReroute({ offRouteSince: null, lastRerouteAt: null, count: 0 }, t0)).toBe(false);
    expect(shouldReroute({ offRouteSince: t0 - 3000, lastRerouteAt: null, count: 0 }, t0)).toBe(false);
  });
  it("hitung ulang setelah menyimpang cukup lama", () => {
    expect(shouldReroute({ offRouteSince: t0 - REROUTE_RULES.offRouteHoldMs, lastRerouteAt: null, count: 0 }, t0)).toBe(true);
  });
  it("menghormati jeda minimum dan batas per sesi", () => {
    const off = t0 - 60_000;
    expect(shouldReroute({ offRouteSince: off, lastRerouteAt: t0 - 5000, count: 1 }, t0)).toBe(false);
    expect(shouldReroute({ offRouteSince: off, lastRerouteAt: t0 - REROUTE_RULES.minIntervalMs, count: 1 }, t0)).toBe(true);
    expect(shouldReroute({ offRouteSince: off, lastRerouteAt: null, count: REROUTE_RULES.maxPerSession }, t0)).toBe(false);
  });
});

describe("petunjuk belok", () => {
  const raw = [
    { distance: 400, duration: 60, name: "Jl. Merdeka", maneuver: { type: "depart", location: [106.8, -6.2] as [number, number] } },
    { distance: 700, duration: 90, name: "Jl. Sudirman", maneuver: { type: "turn", modifier: "left", location: [106.804, -6.2] as [number, number] } },
    { distance: 0, duration: 0, name: "", maneuver: { type: "arrive", location: [106.81, -6.195] as [number, number] } },
  ];

  it("menghasilkan kalimat Indonesia", () => {
    const steps = buildSteps(raw);
    expect(steps.map((s) => s.instruction)).toEqual([
      "Mulai berkendara di Jl. Merdeka",
      "Belok kiri ke Jl. Sudirman",
      "Tiba di tujuan",
    ]);
    expect(steps[1].at).toEqual([-6.2, 106.804]);
  });

  it("bundaran memuat nomor jalan keluar", () => {
    const r = instructionFor({ distance: 50, duration: 10, name: "Jl. A", maneuver: { type: "roundabout", exit: 2, location: [0, 0] } }, false);
    expect(r.text).toContain("jalan keluar ke-2");
  });

  it("langkah tanpa jarak dilewati kecuali mulai/tiba", () => {
    const steps = buildSteps([
      raw[0],
      { distance: 0, duration: 0, name: "", maneuver: { type: "turn", modifier: "right", location: [0, 0] as [number, number] } },
      raw[2],
    ]);
    expect(steps).toHaveLength(2);
  });

  it("kemajuan langkah: jarak ke manuver berikutnya", () => {
    const steps = buildSteps(raw);
    const p0 = stepProgress(steps, 100)!;
    expect(p0.index).toBe(0);
    expect(p0.next?.instruction).toBe("Belok kiri ke Jl. Sudirman");
    expect(Math.round(p0.toNextM)).toBe(300);
    const p1 = stepProgress(steps, 600)!;
    expect(p1.index).toBe(1);
    const last = stepProgress(steps, 5000)!;
    expect(last.next).toBeNull();
    expect(stepProgress([], 10)).toBeNull();
  });

  it("tautan aplikasi peta memuat koordinat tujuan", () => {
    const l = externalNavLinks({ lat: -6.2, lng: 106.8 }, { lat: -6.19, lng: 106.85 });
    expect(l.google).toContain("destination=-6.19,106.85");
    expect(l.waze).toContain("ll=-6.19,106.85");
    expect(formatStepDistance(342)).toBe("340 m");
  });
});

describe("sisa ETA", () => {
  it("proporsional terhadap sisa jarak dan terbatasi", () => {
    expect(remainingEtaS(600, 5000, 2500)).toBe(300);
    expect(remainingEtaS(600, 5000, 9000)).toBe(600);
    expect(remainingEtaS(600, 0, 100)).toBe(0);
  });
});
