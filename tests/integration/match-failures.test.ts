import { afterAll, beforeAll, describe, expect, it } from "vitest";

// T15 - pencocokan saat layanan rute gagal (OSRM tak terjangkau) dan keadaan tanpa kandidat.
// ROUTING_MODE=live diarahkan ke alamat yang pasti gagal: ETA tidak boleh dipalsukan.

process.env.DATA_MODE = "local";
process.env.LOCAL_DB_DIR = "memory://";
process.env.AI_MODE = "mock";
process.env.ROUTING_MODE = "live";
process.env.OSRM_BASE_URL = "http://127.0.0.1:9";
process.env.ROUTING_TIMEOUT_MS = "500";

const SENEN = { lat: -6.177, lng: 106.842 };
let match: (req: Request) => Promise<Response>;

const run = async (needs: { code: string; required: boolean; reason: string }[], location = SENEN) => {
  const res = await match(
    new Request("http://localhost/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ needs, location, location_source: "MANUAL" }),
    }),
  );
  return { status: res.status, body: await res.json() };
};

beforeAll(async () => {
  match = (await import("@/app/api/match/route")).POST as typeof match;
});
afterAll(async () => {
  await (await import("@/lib/data/db")).resetDbHandle();
});

describe("pencocokan saat rute gagal", () => {
  it("OSRM gagal -> kandidat tetap tampil urut jarak, ETA null, keterangan jelas, tanpa ETA palsu", async () => {
    const { status, body } = await run([{ code: "IGD_DASAR", required: true, reason: "uji" }]);
    expect(status).toBe(200);
    const d = body.data;
    expect(d.routing_status).toBe("FAILED");
    expect(d.routing_note).toMatch(/garis lurus/i);
    expect(d.primary).not.toBeNull();
    const all = [d.primary, ...d.alternatives];
    expect(all.every((c: { eta_seconds: number | null; distance_m: number | null }) => c.eta_seconds === null && c.distance_m === null)).toBe(true);
    const km = all.map((c: { straight_km: number }) => c.straight_km);
    expect([...km].sort((a, b) => a - b)).toEqual(km);
  });

  it("tanpa kandidat (HEMODIALISA + ANTI_BISA wajib) -> alasan per RS, bukan pelonggaran diam-diam", async () => {
    const { body } = await run([
      { code: "HEMODIALISA", required: true, reason: "uji" },
      { code: "ANTI_BISA", required: true, reason: "uji" },
    ]);
    expect(body.data.primary).toBeNull();
    expect(body.data.alternatives).toEqual([]);
    expect(body.data.no_candidate_reason).toBeTruthy();
    // Semua RS Jakarta (100) dalam radius dari Senen dinilai dan dikecualikan dengan alasan; RS Jatim di luar radius.
    expect(body.data.excluded.length).toBe(100);
    expect(body.data.out_of_range_count).toBe(100);
    expect(body.data.excluded.every((x: { reasons: string[] }) => x.reasons.length > 0)).toBe(true);
  });

  it("kapasitas nol dan status kedaluwarsa tersaring dengan alasan", async () => {
    const { body } = await run([{ code: "IGD_DASAR", required: true, reason: "uji" }]);
    const byName = Object.fromEntries(body.data.excluded.map((x: { short_name: string; reasons: string[] }) => [x.short_name, x.reasons.join(" ")]));
    expect(byName["RSUD Pasar Minggu"]).toMatch(/kapasitas|kuota/i);
  });

  it("lokasi di Jawa Timur (UPNVJT) -> hanya RS Jawa Timur yang direkomendasikan", async () => {
    const { regionOf } = await import("@/lib/regions");
    const upnvjt = { lat: -7.3338, lng: 112.7889 };
    const { status, body } = await run([{ code: "IGD_DASAR", required: true, reason: "uji" }], upnvjt);
    expect(status).toBe(200);
    const all = [body.data.primary, ...body.data.alternatives];
    expect(body.data.primary).not.toBeNull();
    expect(all.every((c: { lat: number; lng: number; straight_km: number }) => regionOf(c) === "JAWA_TIMUR" && c.straight_km <= 100)).toBe(true);
    // 100 RS Jakarta + RS Jatim yang jauh (Madura timur, Banyuwangi, dst.) di luar radius.
    expect(body.data.out_of_range_count).toBeGreaterThanOrEqual(100);
  });

  it("lokasi di luar wilayah layanan ditolak 400; payload tidak valid ditolak", async () => {
    expect((await run([{ code: "IGD_DASAR", required: true, reason: "x" }], { lat: 40, lng: -74 })).status).toBe(400);
    const bad = await match(new Request("http://localhost/api/match", { method: "POST", body: "bukan json" }));
    expect(bad.status).toBe(400);
    expect((await run([{ code: "KODE_PALSU", required: true, reason: "x" }])).status).toBe(400);
  });
});
