import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, applySeed, openDatabase, resetDemoData } from "@/lib/data/local-db";
import { rowToFacility } from "@/lib/data/facilities";
import { CAPABILITY_CODES } from "@/lib/schema/enums";

// Migrasi + seed + pembaruan fasilitas pada Postgres (PGlite, in-memory).
// Kuota hanya diubah petugas RS lewat update_facility; tidak ada pengurangan otomatis.

let db: PGlite;
const TARAKAN = "00000000-0000-4000-8000-000000000003"; // 1 slot
const PASAR_MINGGU = "00000000-0000-4000-8000-000000000004"; // 0 slot
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

describe("kuota diatur manual oleh rumah sakit", () => {
  it("update_facility mengubah kuota dan kapabilitas; nilai tidak valid ditolak", async () => {
    await db.query("select update_facility($1,$2,$3,$4,$5)", [TARAKAN, null, null, 4, 2]);
    expect(await slots()).toBe(2);
    await db.query("select update_facility($1,$2,$3,$4,$5)", [TARAKAN, null, JSON.stringify([{ code: "IGD_DASAR", status: "PENUH" }]), null, null]);
    const cap = await db.query<{ status: string }>("select status from hospital_capabilities where hospital_id = $1 and code = 'IGD_DASAR'", [TARAKAN]);
    expect(cap.rows[0].status).toBe("PENUH");
    await expect(db.query("select update_facility($1,$2,$3,$4,$5)", [TARAKAN, null, null, 1, 3])).rejects.toThrow(/INVALID_CAPACITY/);
    await expect(db.query("select update_facility($1,$2,$3,$4,$5)", [TARAKAN, null, null, null, -1])).rejects.toThrow(/INVALID_CAPACITY/);
    expect(await slots()).toBe(2);
  });

  it("reset demo memulihkan kuota seed", async () => {
    await db.query("select update_facility($1,$2,$3,$4,$5)", [PASAR_MINGGU, null, null, 9, 9]);
    await resetDemoData(db);
    expect(await slots(PASAR_MINGGU)).toBe(0);
    expect(await slots(TARAKAN)).toBe(1);
  });

  it("constraint database mencegah kapasitas negatif", async () => {
    await expect(db.query("update hospital_capacity set available_slots = -1 where hospital_id=$1", [TARAKAN])).rejects.toThrow();
  });
});
