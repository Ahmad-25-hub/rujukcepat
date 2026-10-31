import "server-only";
import { getDb } from "@/lib/data/db";
import { fail } from "@/lib/http";
import { deterministicUuid, hashPassword, staffUserId, verifyPassword } from "./session";

// Akun petugas demo: satu per RS contoh proposal + satu admin demo (untuk reset).
// Kata sandi berasal dari env DEMO_STAFF_PASSWORD (tidak disimpan di repo).

export type Staff = {
  user_id: string;
  hospital_id: string;
  hospital_name: string;
  hospital_short_name: string;
  display_name: string;
  email: string;
  is_demo_admin: boolean;
};

export const DEMO_ACCOUNTS = [
  { email: "rscm@rujukcepat.demo", hospital: "00000000-0000-4000-8000-000000000001", name: "Petugas IGD RSCM (demo)", admin: false },
  { email: "fatmawati@rujukcepat.demo", hospital: "00000000-0000-4000-8000-000000000002", name: "Petugas IGD RSUP Fatmawati (demo)", admin: false },
  { email: "tarakan@rujukcepat.demo", hospital: "00000000-0000-4000-8000-000000000003", name: "Petugas IGD RSUD Tarakan (demo)", admin: false },
  { email: "pasarminggu@rujukcepat.demo", hospital: "00000000-0000-4000-8000-000000000004", name: "Petugas IGD RSUD Pasar Minggu (demo)", admin: false },
  { email: "pon@rujukcepat.demo", hospital: "00000000-0000-4000-8000-000000000005", name: "Petugas IGD RS PON (demo)", admin: false },
  { email: "admin@rujukcepat.demo", hospital: "00000000-0000-4000-8000-000000000001", name: "Admin demo (RSCM)", admin: true },
] as const;

export function demoPassword(): string | null {
  const p = process.env.DEMO_STAFF_PASSWORD;
  return p && !p.startsWith("<") ? p : null;
}

/** Buat/sinkronkan akun demo dari env. Idempoten. Mengembalikan jumlah akun, atau 0 bila sandi belum diatur. */
export async function ensureDemoStaff(): Promise<number> {
  const password = demoPassword();
  if (!password) return 0;
  const db = await getDb();
  // Cukup sekali per proses/koneksi/kata sandi (hash scrypt tidak murah).
  const g = globalThis as unknown as { __rujukStaffSynced?: { db: unknown; password: string } };
  if (g.__rujukStaffSynced?.db === db && g.__rujukStaffSynced.password === password) return DEMO_ACCOUNTS.length;
  for (const a of DEMO_ACCOUNTS) {
    const id = deterministicUuid(a.email);
    await db.query(
      `insert into staff_members (user_id, hospital_id, display_name, is_demo_admin)
       values ($1,$2,$3,$4)
       on conflict (user_id) do update set hospital_id = excluded.hospital_id,
         display_name = excluded.display_name, is_demo_admin = excluded.is_demo_admin`,
      [id, a.hospital, a.name, a.admin],
    );
    const cur = await db.query<{ password_hash: string }>("select password_hash from staff_credentials where user_id = $1", [id]);
    if (!cur.rows[0] || !verifyPassword(password, cur.rows[0].password_hash)) {
      await db.query(
        `insert into staff_credentials (user_id, email, password_hash) values ($1,$2,$3)
         on conflict (user_id) do update set password_hash = excluded.password_hash, email = excluded.email`,
        [id, a.email, hashPassword(password)],
      );
    }
  }
  g.__rujukStaffSynced = { db, password };
  return DEMO_ACCOUNTS.length;
}

export async function loadStaff(userId: string): Promise<Staff | null> {
  const db = await getDb();
  const { rows } = await db.query<Staff>(
    `select s.user_id, s.hospital_id, h.name as hospital_name, h.short_name as hospital_short_name,
            s.display_name, c.email, s.is_demo_admin
       from staff_members s
       join hospitals h on h.id = s.hospital_id
       join staff_credentials c on c.user_id = s.user_id
      where s.user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function loginStaff(email: string, password: string): Promise<Staff | null> {
  await ensureDemoStaff();
  const db = await getDb();
  const { rows } = await db.query<{ user_id: string; password_hash: string }>(
    "select user_id, password_hash from staff_credentials where lower(email) = lower($1)",
    [email.trim()],
  );
  const row = rows[0];
  if (!row) {
    // Hitung hash palsu agar waktu respons serupa.
    verifyPassword(password, "scrypt$00$00");
    return null;
  }
  if (!verifyPassword(password, row.password_hash)) return null;
  return loadStaff(row.user_id);
}

export async function currentStaff(request: Request): Promise<Staff | null> {
  const id = staffUserId(request);
  return id ? loadStaff(id) : null;
}

/** Untuk route petugas: kembalikan petugas atau respons 401. */
export async function requireStaff(request: Request): Promise<{ staff: Staff } | { response: Response }> {
  const staff = await currentStaff(request);
  if (!staff) return { response: fail("UNAUTHORIZED", "Masuk sebagai petugas terlebih dahulu.", 401) };
  return { staff };
}
