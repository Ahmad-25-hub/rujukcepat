import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, applySeed, openDatabase, resetDemoData } from "@/lib/data/local-db";
import { rowToFacility } from "@/lib/data/facilities";
import { CAPABILITY_CODES } from "@/lib/schema/enums";

// Migrasi + seed + fungsi transaksi pada Postgres (PGlite, in-memory).
// Catatan: PGlite memakai satu koneksi sehingga "serentak" di sini = dua panggilan
// yang dikirim bersamaan lalu diserialkan; penguncian baris FOR UPDATE tetap
// perlu diuji ulang di Supabase sungguhan pada T10/T16.

let db: PGlite;
const TARAKAN = "00000000-0000-4000-8000-000000000003"; // 1 slot
const PASAR_MINGGU = "00000000-0000-4000-8000-000000000004"; // 0 slot
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function create(requester: string, key: string, hospital = TARAKAN, required = "{IGD_DASAR}") {
  return db.query<{ r: { referral_id: string; created: boolean } }>(
    "select create_referral($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as r",
    [requester, key, hospital, JSON.stringify({ demo: true }), "MERAH", required, required, 600, "OSRM", -6.2, 106.8, 600, 1440],
  );
}
const slots = async (h = TARAKAN) =>
  (await db.query<{ n: number }>("select available_slots as n from hospital_capacity where hospital_id = $1", [h])).rows[0].n;

beforeAll(async () => {
  db = await openDatabase();
});
afterAll(async () => {
  await db.close();
});

describe("migrasi dan seed", () => {
  it("anon/authenticated tidak dapat memanggil fungsi transaksi yang melewati otorisasi route", async () => {
    const { rows } = await db.query<{ name: string; anon_execute: boolean; authenticated_execute: boolean }>(`
      select p.proname as name,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in (
        'create_referral', 'transition_referral', 'update_facility', 'release_reservation', 'expire_stale_referrals')
    `);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => !r.anon_execute && !r.authenticated_execute)).toBe(true);
  });

  it("migrasi & seed dapat dijalankan ulang tanpa error/duplikasi", async () => {
    await applyMigrations(db);
    await applySeed(db);
    await applySeed(db);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from hospitals");
    expect(rows[0].n).toBe(10);
  });

  it("view publik memuat kedelapan kode, PENUH, MAINTENANCE, kapasitas nol, dan penanda simulasi", async () => {
    const { rows } = await db.query<Record<string, unknown>>("select * from facility_public_status");
    const fs = rows.map(rowToFacility);
    const codes = new Set(fs.flatMap((f) => f.capabilities.map((c) => c.code)));
    expect([...codes].sort()).toEqual([...CAPABILITY_CODES].sort());
    const statuses = new Set(fs.flatMap((f) => f.capabilities.map((c) => c.status)));
    expect(statuses).toEqual(new Set(["READY", "PENUH", "MAINTENANCE"]));
    expect(fs.some((f) => f.available_slots === 0)).toBe(true);
    expect(fs.every((f) => f.is_simulated && f.capabilities.every((c) => c.is_simulated))).toBe(true);
    expect(fs.every((f) => f.location_source === "OSM" && f.osm_id)).toBe(true);
    // view tidak membuka kolom data pasien
    expect(Object.keys(rows[0])).not.toContain("ai_result");
  });
});

describe("transaksi rujukan & kuota", () => {
  it("dua permintaan untuk satu kuota: hanya satu berhasil, kapasitas tidak negatif", async () => {
    await resetDemoData(db);
    expect(await slots()).toBe(1);
    const results = await Promise.allSettled([create(USER_A, "a-1"), create(USER_B, "b-1")]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    expect(okCount).toBe(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason.message)).toContain("NO_CAPACITY");
    expect(await slots()).toBe(0);
  });

  it("retry dengan idempotency key sama tidak membuat reservasi ganda", async () => {
    await resetDemoData(db);
    const first = await create(USER_A, "retry-1");
    const second = await create(USER_A, "retry-1");
    expect(first.rows[0].r.created).toBe(true);
    expect(second.rows[0].r).toEqual({ referral_id: first.rows[0].r.referral_id, created: false });
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from quota_reservations");
    expect(rows[0].n).toBe(1);
  });

  it("kapasitas nol dan kapabilitas yang tidak READY ditolak di server", async () => {
    await resetDemoData(db);
    await expect(create(USER_A, "k-zero", PASAR_MINGGU)).rejects.toThrow("NO_CAPACITY");
    // Tarakan: HEMODIALISA MAINTENANCE
    await expect(create(USER_A, "k-hd", TARAKAN, "{HEMODIALISA}")).rejects.toThrow("CAPABILITY_CHANGED");
  });

  it("pelepasan kuota tepat satu kali", async () => {
    await resetDemoData(db);
    const id = (await create(USER_A, "rel-1")).rows[0].r.referral_id;
    expect(await slots()).toBe(0);
    await db.query("select transition_referral($1,'REJECT',null,'penuh')", [id]);
    expect(await slots()).toBe(1);
    const again = await db.query<{ s: boolean }>("select release_reservation($1,'lagi') as s", [id]);
    expect(again.rows[0].s).toBe(false);
    expect(await slots()).toBe(1);
  });

  it("menekan kirim menghasilkan PENDING, ACCEPTED tidak melepas kuota, transisi ilegal ditolak", async () => {
    await resetDemoData(db);
    const id = (await create(USER_A, "life-1")).rows[0].r.referral_id;
    const st = await db.query<{ status: string }>("select status from referral_requests where id=$1", [id]);
    expect(st.rows[0].status).toBe("PENDING");
    await db.query("select transition_referral($1,'ACCEPT',null,null)", [id]);
    expect(await slots()).toBe(0);
    await expect(db.query("select transition_referral($1,'REJECT',null,null)", [id])).rejects.toThrow("INVALID_TRANSITION");
    await db.query("select transition_referral($1,'ARRIVED',null,null)", [id]);
    const res = await db.query<{ status: string }>("select status from quota_reservations where referral_id=$1", [id]);
    expect(res.rows[0].status).toBe("CONSUMED");
    expect(await slots()).toBe(0);
  });

  it("expiry malas melepas kuota PENDING yang kedaluwarsa", async () => {
    await resetDemoData(db);
    const id = (await create(USER_A, "exp-1")).rows[0].r.referral_id;
    await db.query("update referral_requests set expires_at = now() - interval '1 second' where id=$1", [id]);
    const n = await db.query<{ n: number }>("select expire_stale_referrals(null) as n");
    expect(n.rows[0].n).toBe(1);
    expect(await slots()).toBe(1);
    const st = await db.query<{ status: string }>("select status from referral_requests where id=$1", [id]);
    expect(st.rows[0].status).toBe("EXPIRED");
  });

  it("constraint database mencegah kapasitas negatif", async () => {
    await expect(db.query("update hospital_capacity set available_slots = -1 where hospital_id=$1", [TARAKAN])).rejects.toThrow();
  });
});
