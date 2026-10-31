import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/data/db";
import type { NormalizedAiResult } from "@/lib/schema/ai";

// Uji tingkat API (route handler dipanggil langsung) di atas PGlite in-memory.
// Dua "sesi" = dua cookie jar berbeda. Mencakup T10 (kuota, idempotency, transisi),
// T11 (akses petugas per RS), dan bagian T12 (event sinkronisasi).

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
  referrals: { POST: Handler; GET: Handler };
  referral: { GET: Handler };
  cancel: { POST: Handler };
  decision: { POST: Handler };
  facilityPatch: { PATCH: Handler };
  facilities: { GET: Handler };
  login: { POST: Handler };
  reset: { POST: Handler };
};
let db: Db;
let aiResult: NormalizedAiResult;
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

/** Pelapor baru dengan cookie sendiri (cookie diterbitkan server pada pengiriman pertama). */
function reporter() {
  let cookie: string | undefined;
  return {
    async send(hospital: string, key: string, needs = [{ code: "IGD_DASAR", required: true, reason: "uji" }]) {
      const r = await call(routes.referrals.POST, "POST", {
        cookie,
        headers: { "idempotency-key": key },
        body: { hospital_id: hospital, ai_result: aiResult, needs, location: JAKARTA, location_source: "GPS" },
      });
      if (r.cookie) cookie = r.cookie;
      return r;
    },
    get cookie() {
      return cookie;
    },
  };
}

async function staffCookie(email: string) {
  const r = await call(routes.login.POST, "POST", { body: { email, password: "sandi-uji-lokal" } });
  expect(r.status).toBe(200);
  return r.cookie!;
}

const slots = async (h: string) =>
  Number((await db.query<{ n: number }>("select available_slots as n from hospital_capacity where hospital_id = $1", [h])).rows[0].n);

beforeAll(async () => {
  const [referrals, referral, cancel, decision, facilityPatch, facilities, login, reset] = await Promise.all([
    import("@/app/api/referrals/route"),
    import("@/app/api/referrals/[id]/route"),
    import("@/app/api/referrals/[id]/cancel/route"),
    import("@/app/api/referrals/[id]/decision/route"),
    import("@/app/api/facilities/[id]/route"),
    import("@/app/api/facilities/route"),
    import("@/app/api/staff/login/route"),
    import("@/app/api/demo/reset/route"),
  ]);
  routes = { referrals, referral, cancel, decision, facilityPatch, facilities, login, reset } as unknown as typeof routes;
  const { getDb } = await import("@/lib/data/db");
  db = await getDb();
  bus = await import("@/lib/sync/bus");
  const { analyzeReport } = await import("@/lib/ai/analyze");
  // RSCM hanya punya 3 kuota di seed; longgarkan agar banyak skenario dapat memakainya (reset memulihkan seed).
  await db.query("update hospital_capacity set total_slots = 50, available_slots = 50 where hospital_id = $1", [RSCM]);
  aiResult = (await analyzeReport({ audio: null, photo: null, text: "lansia lemas keringat dingin", mockScenario: null })).result;
});

afterAll(async () => {
  const { resetDbHandle } = await import("@/lib/data/db");
  await resetDbHandle();
});

describe("T10 - pengiriman rujukan dan kuota", () => {
  it("wajib Idempotency-Key dan payload valid", async () => {
    const r = reporter();
    const noKey = await call(routes.referrals.POST, "POST", {
      body: { hospital_id: TARAKAN, ai_result: aiResult, needs: [{ code: "IGD_DASAR", required: true, reason: "x" }], location: JAKARTA, location_source: "GPS" },
    });
    expect(noKey.json.error?.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    const bad = await call(routes.referrals.POST, "POST", { headers: { "idempotency-key": "kunci-uji-0001" }, body: { hospital_id: "bukan-uuid" } });
    expect(bad.status).toBe(400);
    const outside = await call(routes.referrals.POST, "POST", {
      headers: { "idempotency-key": "kunci-uji-0002" },
      body: { hospital_id: TARAKAN, ai_result: aiResult, needs: [{ code: "IGD_DASAR", required: true, reason: "x" }], location: { lat: 0, lng: 0 }, location_source: "GPS" },
    });
    expect(outside.status).toBe(400);
    void r;
  });

  it("kirim -> PENDING + reservasi HELD (bukan ACCEPTED), kuota berkurang satu, ETA dihitung server", async () => {
    const before = await slots(RSCM);
    const a = reporter();
    const r = await a.send(RSCM, "kunci-kirim-0001");
    expect(r.status).toBe(201);
    const ref = r.json.data.referral;
    expect(ref.status).toBe("PENDING");
    expect(ref.reservation_status).toBe("HELD");
    expect(ref.hospital.id).toBe(RSCM);
    expect(ref.eta_source).toBe("MOCK");
    expect(ref.origin).toEqual({ lat: -6.2, lng: 106.82 });
    expect(await slots(RSCM)).toBe(before - 1);
    expect(a.cookie).toMatch(/^rc_rid=/);
  });

  it("retry dengan kunci sama (klik ganda berurutan) -> rujukan yang sama, kuota tidak berkurang dua kali", async () => {
    const a = reporter();
    const first = await a.send(RSCM, "kunci-retry-0001");
    const after1 = await slots(RSCM);
    const again = await a.send(RSCM, "kunci-retry-0001");
    expect(again.status).toBe(200);
    expect(again.json.data.created).toBe(false);
    expect(again.json.data.referral.id).toBe(first.json.data.referral.id);
    expect(await slots(RSCM)).toBe(after1);
  });

  it("klik ganda serentak dengan kunci sama -> satu rujukan, satu reservasi", async () => {
    const a = reporter();
    await a.send(RSCM, "kunci-awal-0001"); // menerbitkan cookie pelapor
    const before = await slots(RSCM);
    const results = await Promise.all([1, 2, 3].map(() => call(routes.referrals.POST, "POST", {
      cookie: a.cookie,
      headers: { "idempotency-key": "kunci-serentak-01" },
      body: { hospital_id: RSCM, ai_result: aiResult, needs: [{ code: "IGD_DASAR", required: true, reason: "x" }], location: JAKARTA, location_source: "GPS" },
    })));
    expect(new Set(results.map((x) => x.json.data.referral.id)).size).toBe(1);
    expect(results.filter((x) => x.status === 201)).toHaveLength(1);
    expect(await slots(RSCM)).toBe(before - 1);
  });

  it("dua pelapor berbeda memperebutkan satu kuota (Tarakan) -> satu 201, satu 409, kuota 0 tidak negatif", async () => {
    expect(await slots(TARAKAN)).toBe(1);
    const [a, b] = [reporter(), reporter()];
    const [ra, rb] = await Promise.all([a.send(TARAKAN, "kunci-rebut-a001"), b.send(TARAKAN, "kunci-rebut-b001")]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = ra.status === 409 ? ra : rb;
    expect(loser.json.error?.code).toBe("NO_CAPACITY");
    expect(await slots(TARAKAN)).toBe(0);
    const held = await db.query<{ n: number }>("select count(*)::int as n from quota_reservations where hospital_id = $1 and status = 'HELD'", [TARAKAN]);
    expect(held.rows[0].n).toBe(1);
  });

  it("RS dengan kapasitas nol ditolak 409 NO_CAPACITY", async () => {
    const r = await reporter().send(PASAR_MINGGU, "kunci-nol-0001");
    expect(r.status).toBe(409);
    expect(r.json.error?.code).toBe("NO_CAPACITY");
  });

  it("kesiapan berubah sebelum kirim -> 409 CAPABILITY_CHANGED dan kuota tidak terkunci", async () => {
    const before = await slots(RSCM);
    const staff = await staffCookie("rscm@rujukcepat.demo");
    const patch = await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: RSCM, body: { capabilities: [{ code: "CATH_LAB", status: "PENUH" }] } });
    expect(patch.status).toBe(200);
    const r = await reporter().send(RSCM, "kunci-berubah-01", [{ code: "CATH_LAB", required: true, reason: "x" }]);
    expect(r.status).toBe(409);
    expect(r.json.error?.code).toBe("CAPABILITY_CHANGED");
    expect(await slots(RSCM)).toBe(before);
    await call(routes.facilityPatch.PATCH, "PATCH", { cookie: staff, id: RSCM, body: { capabilities: [{ code: "CATH_LAB", status: "READY" }] } });
  });

  it("menolak -> kuota dilepas tepat satu kali; penolakan kedua 409 dan kuota tidak bertambah lagi", async () => {
    const a = reporter();
    const created = await a.send(RSCM, "kunci-tolak-0001");
    const id = created.json.data.referral.id as string;
    const afterCreate = await slots(RSCM);
    const staff = await staffCookie("rscm@rujukcepat.demo");
    const rej = await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "REJECT", note: "Penuh" } });
    expect(rej.status).toBe(200);
    expect(rej.json.data.referral.status).toBe("REJECTED");
    expect(rej.json.data.referral.reservation_status).toBe("RELEASED");
    expect(await slots(RSCM)).toBe(afterCreate + 1);
    const again = await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "REJECT" } });
    expect(again.status).toBe(409);
    expect(again.json.error?.code).toBe("INVALID_TRANSITION");
    expect(await slots(RSCM)).toBe(afterCreate + 1);
  });

  it("menerima tidak melepas kuota; pasien tiba -> CONSUMED; REVOKE setelah tiba ditolak", async () => {
    const a = reporter();
    const created = await a.send(RSCM, "kunci-terima-0001");
    const id = created.json.data.referral.id as string;
    const afterCreate = await slots(RSCM);
    const staff = await staffCookie("rscm@rujukcepat.demo");
    const acc = await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "ACCEPT" } });
    expect(acc.json.data.referral.status).toBe("ACCEPTED");
    expect(acc.json.data.referral.reservation_status).toBe("HELD");
    expect(await slots(RSCM)).toBe(afterCreate);
    const arr = await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "ARRIVED" } });
    expect(arr.json.data.referral.reservation_status).toBe("CONSUMED");
    expect(arr.json.data.referral.arrived_at).toBeTruthy();
    expect((await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "ARRIVED" } })).status).toBe(409);
    expect((await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "REVOKE", note: "salah" } })).status).toBe(409);
    expect(await slots(RSCM)).toBe(afterCreate);
  });

  it("REVOKE sebelum tiba melepas kuota dan butuh alasan", async () => {
    const created = await reporter().send(RSCM, "kunci-revoke-001");
    const id = created.json.data.referral.id as string;
    const staff = await staffCookie("rscm@rujukcepat.demo");
    await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "ACCEPT" } });
    const afterAccept = await slots(RSCM);
    expect((await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "REVOKE" } })).json.error?.code).toBe("NOTE_REQUIRED");
    const rev = await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "REVOKE", note: "Ruang tidak tersedia" } });
    expect(rev.json.data.referral.status).toBe("CANCELLED");
    expect(rev.json.data.referral.reservation_status).toBe("RELEASED");
    expect(await slots(RSCM)).toBe(afterAccept + 1);
  });

  it("pelapor membatalkan PENDING -> kuota dilepas sekali; pelapor lain ditolak 403", async () => {
    const a = reporter();
    const created = await a.send(RSCM, "kunci-batal-0001");
    const id = created.json.data.referral.id as string;
    const intruder = reporter();
    await intruder.send(RSCM, "kunci-penyusup-01");
    const afterCreate = await slots(RSCM);
    expect((await call(routes.cancel.POST, "POST", { cookie: intruder.cookie, id })).status).toBe(403);
    const ok = await call(routes.cancel.POST, "POST", { cookie: a.cookie, id });
    expect(ok.json.data.referral.status).toBe("CANCELLED");
    expect(await slots(RSCM)).toBe(afterCreate + 1);
    expect((await call(routes.cancel.POST, "POST", { cookie: a.cookie, id })).status).toBe(409);
    expect(await slots(RSCM)).toBe(afterCreate + 1);
  });

  it("lewat expires_at -> EXPIRED saat dibaca, kuota dilepas tepat sekali", async () => {
    const a = reporter();
    const created = await a.send(RSCM, "kunci-expiry-0001");
    const id = created.json.data.referral.id as string;
    const afterCreate = await slots(RSCM);
    await db.query("update referral_requests set expires_at = now() - interval '1 second' where id = $1", [id]);
    const g1 = await call(routes.referral.GET, "GET", { cookie: a.cookie, id });
    expect(g1.json.data.referral.status).toBe("EXPIRED");
    expect(g1.json.data.referral.reservation_status).toBe("RELEASED");
    await call(routes.referral.GET, "GET", { cookie: a.cookie, id });
    expect(await slots(RSCM)).toBe(afterCreate + 1);
    const staff = await staffCookie("rscm@rujukcepat.demo");
    expect((await call(routes.decision.POST, "POST", { cookie: staff, id, body: { action: "ACCEPT" } })).status).toBe(409);
  });
});

describe("T11 - akses petugas dan pelapor", () => {
  it("login: sandi salah ditolak, benar menerbitkan cookie", async () => {
    expect((await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "salah" } })).status).toBe(401);
    expect((await call(routes.login.POST, "POST", { body: { email: "tidakada@rujukcepat.demo", password: "x" } })).status).toBe(401);
    const ok = await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "sandi-uji-lokal" } });
    expect(ok.json.data.staff.hospital_short_name).toBe("RSCM");
    expect(ok.json.data.staff).not.toHaveProperty("password_hash");
  });

  it("antrean petugas hanya berisi rujukan RS-nya dan butuh login", async () => {
    const a = reporter();
    const created = await a.send(RSCM, "kunci-antrean-001");
    const id = created.json.data.referral.id as string;
    expect((await call(routes.referrals.GET, "GET", {})).status).toBe(401);
    const rscm = await call(routes.referrals.GET, "GET", { cookie: await staffCookie("rscm@rujukcepat.demo") });
    expect(rscm.json.data.referrals.some((x: { id: string }) => x.id === id)).toBe(true);
    const fatmawati = await call(routes.referrals.GET, "GET", { cookie: await staffCookie("fatmawati@rujukcepat.demo") });
    expect(fatmawati.json.data.referrals.some((x: { id: string }) => x.id === id)).toBe(false);
    expect(JSON.stringify(rscm.json)).not.toContain("requester_id");
  });

  it("petugas RS lain, pelapor lain, dan tanpa sesi tidak dapat membaca atau memutuskan rujukan", async () => {
    const owner = reporter();
    const created = await owner.send(RSCM, "kunci-lintas-0001");
    const id = created.json.data.referral.id as string;
    const other = await staffCookie("fatmawati@rujukcepat.demo");
    expect((await call(routes.referral.GET, "GET", { cookie: other, id })).status).toBe(403);
    expect((await call(routes.decision.POST, "POST", { cookie: other, id, body: { action: "ACCEPT" } })).status).toBe(403);
    expect((await call(routes.referral.GET, "GET", { id })).status).toBe(401);
    expect((await call(routes.decision.POST, "POST", { id, body: { action: "ACCEPT" } })).status).toBe(401);
    const stranger = reporter();
    await stranger.send(RSCM, "kunci-asing-00001");
    expect((await call(routes.referral.GET, "GET", { cookie: stranger.cookie, id })).status).toBe(403);
    // pelapor pemilik bukan petugas: tidak boleh memutuskan
    expect((await call(routes.decision.POST, "POST", { cookie: owner.cookie, id, body: { action: "ACCEPT" } })).status).toBe(403);
    // pemilik dan petugas RS yang tepat dapat membaca
    expect((await call(routes.referral.GET, "GET", { cookie: owner.cookie, id })).status).toBe(200);
    expect((await call(routes.referral.GET, "GET", { cookie: await staffCookie("rscm@rujukcepat.demo"), id })).status).toBe(200);
  });

  it("cookie petugas yang dipalsukan ditolak", async () => {
    const fake = "rc_staff=" + encodeURIComponent("11111111-1111-4111-8111-111111111111.9999999999.palsu");
    expect((await call(routes.referrals.GET, "GET", { cookie: fake })).status).toBe(401);
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

describe("T12 - event sinkronisasi dan reset demo", () => {
  it("perubahan tersimpan memicu event ke petugas RS terkait dan ke pelapor pemilik saja", async () => {
    const events: { type: string; hospital_id: string; referral_id: string | null; requester_id: string | null }[] = [];
    const unsub = bus.subscribe((e) => events.push(e));
    const a = reporter();
    const created = await a.send(RSCM, "kunci-event-00001");
    const id = created.json.data.referral.id as string;
    expect(events.some((e) => e.type === "referral" && e.hospital_id === RSCM && e.referral_id === id && e.requester_id)).toBe(true);
    expect(events.some((e) => e.type === "facility" && e.hospital_id === RSCM)).toBe(true);
    const before = events.length;
    await call(routes.decision.POST, "POST", { cookie: await staffCookie("rscm@rujukcepat.demo"), id, body: { action: "ACCEPT" } });
    expect(events.length).toBeGreaterThan(before);
    // event publik tidak membawa requester_id
    expect(JSON.stringify(bus.publicEvent(events[0] as never))).not.toContain("requester_id");
    unsub();
  });

  it("reset demo: butuh admin + konfirmasi, menghapus rujukan, memulihkan kuota seed", async () => {
    const staff = await staffCookie("rscm@rujukcepat.demo");
    expect((await call(routes.reset.POST, "POST", { cookie: staff, body: { confirm: "RESET" } })).status).toBe(403);
    expect((await call(routes.reset.POST, "POST", {})).status).toBe(401);
    const admin = await staffCookie("admin@rujukcepat.demo");
    expect((await call(routes.reset.POST, "POST", { cookie: admin, body: {} })).json.error?.code).toBe("CONFIRM_REQUIRED");
    const res = await call(routes.reset.POST, "POST", { cookie: admin, body: { confirm: "RESET" } });
    expect(res.status).toBe(200);
    const n = await db.query<{ n: number }>("select count(*)::int as n from referral_requests");
    expect(n.rows[0].n).toBe(0);
    expect(await slots(RSCM)).toBe(3);
    expect(await slots(TARAKAN)).toBe(1);
    // akun demo tetap ada setelah reset
    expect((await call(routes.login.POST, "POST", { body: { email: "rscm@rujukcepat.demo", password: "sandi-uji-lokal" } })).status).toBe(200);
  });
});
