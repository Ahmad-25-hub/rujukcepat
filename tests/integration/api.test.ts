import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/data/db";

// Uji tingkat API (route handler dipanggil langsung) di atas PGlite in-memory.
// Portal hanya merekomendasikan RS; kuota diatur manual oleh petugas RS lewat dashboard.
// Mencakup akses petugas per RS, kuota manual, event sinkronisasi, dan reset demo.

process.env.DATA_MODE = "local";
process.env.LOCAL_DB_DIR = "memory://";
process.env.AI_MODE = "mock";
process.env.ROUTING_MODE = "mock";
process.env.DEMO_STAFF_PASSWORD = "sandi-uji-lokal";
process.env.SESSION_SECRET = "rahasia-uji";
process.env.LOGIN_RATE_PER_MINUTE = "10000"; // banyak login uji; pembatas laju diuji terpisah

const RSCM = "00000000-0000-4000-8000-000000000001";
const TARAKAN = "00000000-0000-4000-8000-000000000003"; // 1 slot
const PASAR_MINGGU = "00000000-0000-4000-8000-000000000004"; // 0 slot
const JAKARTA = { lat: -6.2, lng: 106.82 };

type Handler = (req: Request, ctx?: { params: Promise<{ id: string }> }) => Promise<Response>;
type Json = { ok: boolean; data?: any; error?: { code: string; message: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any

let routes: {
  facilityPatch: { PATCH: Handler };
  facilities: { GET: Handler };
  match: { POST: Handler };
  login: { POST: Handler };
  me: { GET: Handler };
  reset: { POST: Handler };
};
let db: Db;
let bus: typeof import("@/lib/sync/bus");

async function call(
  handler: Handler,
  method: string,
  opts: { cookie?: string; body?: unknown; headers?: Record<string, string>; id?: string } = {},
) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const req = new Request("http://localhost/api/x", {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, opts.id ? { params: Promise.resolve({ id: opts.id }) } : undefined);
  const setCookie = res.headers.get("set-cookie");
  const json = (await res.json()) as Json;
  return { status: res.status, json, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

async function staffCookie(email: string) {
  const r = await call(routes.login.POST, "POST", { body: { email, password: "sandi-uji-lokal" } });
  expect(r.status).toBe(200);
  return r.cookie!;
}

const slots = async (h: string) =>
  Number((await db.query<{ n: number }>("select available_slots as n from hospital_capacity where hospital_id = $1", [h])).rows[0].n);

const matchBody = { needs: [{ code: "IGD_DASAR", required: true, reason: "uji" }], location: JAKARTA, location_source: "GPS" };

beforeAll(async () => {
  const [facilityPatch, facilities, match, login, me, reset] = await Promise.all([
    import("@/app/api/facilities/[id]/route"),
    import("@/app/api/facilities/route"),
    import("@/app/api/match/route"),
    import("@/app/api/staff/login/route"),
    import("@/app/api/staff/me/route"),
    import("@/app/api/demo/reset/route"),
  ]);
  routes = { facilityPatch, facilities, match, login, me, reset } as unknown as typeof routes;
  const { getDb } = await import("@/lib/data/db");
  db = await getDb();
  bus = await import("@/lib/sync/bus");
});

afterAll(async () => {
  const { resetDbHandle } = await import("@/lib/data/db");
  await resetDbHandle();
});

describe("akses petugas", () => {
  it("login: sandi salah ditolak, benar menerbitkan cookie", async () => {
    expect((await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "salah" } })).status).toBe(401);
    expect((await call(routes.login.POST, "POST", { body: { email: "tidakada@rujukcepat.demo", password: "x" } })).status).toBe(401);
    const ok = await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "sandi-uji-lokal" } });
    expect(ok.json.data.staff.hospital_short_name).toBe("RSCM");
    expect(ok.json.data.staff).not.toHaveProperty("password_hash");
  });

  it.each([undefined, "<string-acak-panjang>", "   "])("login produksi tanpa session secret valid mengembalikan JSON yang dapat ditangani (%s)", async (secret) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", secret);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "sandi-uji-lokal" } });
      expect(response.status).toBe(503);
      expect(response.json).toEqual({ ok: false, error: {
        code: "STAFF_SESSION_NOT_CONFIGURED",
        message: "Konfigurasi sesi petugas belum lengkap. Hubungi pengelola.",
      } });
      expect(response.cookie).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      log.mockRestore();
    }
  });

  it("sesi petugas wajib; cookie yang dipalsukan ditolak", async () => {
    expect((await call(routes.me.GET, "GET", {})).status).toBe(401);
    const fake = "rc_staff=" + encodeURIComponent("11111111-1111-4111-8111-111111111111.9999999999.palsu");
    expect((await call(routes.me.GET, "GET", { cookie: fake })).status).toBe(401);
    const me = await call(routes.me.GET, "GET", { cookie: await staffCookie("fatmawati@rujukcepat.demo") });
    expect(me.json.data.staff.hospital_short_name).toBe("RSUP Fatmawati");
  });

  it("petugas hanya dapat mengubah fasilitas RS-nya; kapasitas tidak valid ditolak", async () => {
    const staff = await staffCookie("rscm@rujukcepat.demo");
    expect((await call(routes.facilityPatch.PATCH, "PATCH", { id: RSCM, body: { total_slots: 3 } })).status).toBe(401);
    expect((await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: TARAKAN, body: { total_slots: 9 } })).status).toBe(403);
    expect((await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: RSCM, body: { total_slots: 3, available_slots: 5 } })).json.error?.code).toBe("INVALID_CAPACITY");
    expect((await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: RSCM, body: {} })).status).toBe(400);
    // kapabilitas yang tidak ditawarkan RS (RSCM tidak punya ANTI_BISA di seed)
    expect((await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: RSCM, body: { capabilities: [{ code: "ANTI_BISA", status: "READY" }] } })).json.error?.code).toBe("CAPABILITY_NOT_OFFERED");
    const okPatch = await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: RSCM, body: { total_slots: 8, available_slots: 8 } });
    expect(okPatch.status).toBe(200);
    expect(okPatch.json.data.facility.total_slots).toBe(8);
    const list = await call(routes.facilities.GET, "GET", {});
    expect(list.json.data.facilities.find((f: { id: string }) => f.id === RSCM).available_slots).toBe(8);
  });
});

describe("kuota diatur manual oleh rumah sakit", () => {
  it("pencarian rekomendasi berulang tidak mengurangi kuota", async () => {
    const before = await slots(TARAKAN);
    for (let i = 0; i < 3; i++) {
      const r = await call(routes.match.POST, "POST", { body: matchBody });
      expect(r.status).toBe(200);
      const ids = [r.json.data.primary, ...r.json.data.alternatives].filter(Boolean).map((c: { facility_id: string }) => c.facility_id);
      expect(ids).toContain(TARAKAN);
    }
    expect(await slots(TARAKAN)).toBe(before);
  });

  it("RS dengan kuota 0 tidak direkomendasikan, lalu muncul lagi setelah petugas menaikkan kuota", async () => {
    const ids = async () => {
      const r = await call(routes.match.POST, "POST", { body: matchBody });
      return [r.json.data.primary, ...r.json.data.alternatives].filter(Boolean).map((c: { facility_id: string }) => c.facility_id) as string[];
    };
    const excluded = (await call(routes.match.POST, "POST", { body: matchBody })).json.data.excluded as { facility_id: string; reasons: string[] }[];
    expect(excluded.find((x) => x.facility_id === PASAR_MINGGU)?.reasons.join(" ")).toMatch(/Kuota/);
    expect(await ids()).not.toContain(PASAR_MINGGU);

    const staff = await staffCookie("pasarminggu@rujukcepat.demo");
    expect((await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: PASAR_MINGGU, body: { total_slots: 2, available_slots: 2 } })).status).toBe(200);
    // Kapabilitas Pasar Minggu bisa saja tidak READY di seed; yang diuji di sini alasan kuota hilang.
    const after = (await call(routes.match.POST, "POST", { body: matchBody })).json.data;
    const stillExcluded = (after.excluded as { facility_id: string; reasons: string[] }[]).find((x) => x.facility_id === PASAR_MINGGU);
    expect(stillExcluded?.reasons.join(" ") ?? "").not.toMatch(/Kuota/);
  });
});

describe("event sinkronisasi dan reset demo", () => {
  it("perubahan fasilitas memicu event publik tanpa data pasien", async () => {
    const events: { type: string; hospital_id: string }[] = [];
    const unsub = bus.subscribe((e) => events.push(e));
    const staff = await staffCookie("tarakan@rujukcepat.demo");
    await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: TARAKAN, body: { total_slots: 2, available_slots: 1 } });
    expect(events.some((e) => e.type === "facility" && e.hospital_id === TARAKAN)).toBe(true);
    expect(Object.keys(bus.publicEvent(events[0] as never)).sort()).toEqual(["at", "hospital_id", "seq", "type"]);
    unsub();
  });

  it("reset demo: butuh admin + konfirmasi, memulihkan kuota seed", async () => {
    const staff = await staffCookie("rscm@rujukcepat.demo");
    expect((await call(routes.reset.POST, "POST", { cookie: staff, body: { confirm: "RESET" } })).status).toBe(403);
    expect((await call(routes.reset.POST, "POST", {})).status).toBe(401);
    const admin = await staffCookie("admin@rujukcepat.demo");
    expect((await call(routes.reset.POST, "POST", { cookie: admin, body: {} })).json.error?.code).toBe("CONFIRM_REQUIRED");
    const res = await call(routes.reset.POST, "POST", { cookie: admin, body: { confirm: "RESET" } });
    expect(res.status).toBe(200);
    expect(await slots(RSCM)).toBe(3);
    expect(await slots(TARAKAN)).toBe(1);
    expect(await slots(PASAR_MINGGU)).toBe(0);
    // akun demo tetap ada setelah reset
    expect((await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "sandi-uji-lokal" } })).status).toBe(200);
  });
});
