// Impor RS OSM (supabase/seed-osm.sql) ke database aktif (DATA_MODE di .env.local) dan buat akun
// petugas untuk setiap RS yang belum punya akun demo. Menulis daftar login ke akunRumahsakit.md.
//   npm run hospitals:import            (DATA_MODE=supabase: jalankan npm run supabase:setup dulu untuk migrasi 0005)
//   npm run hospitals:import -- --akun-saja   (lewati seed; hanya sinkron akun + tulis ulang md)
// Kata sandi dibuat acak SEKALI lalu disimpan di data/akun-rumahsakit.local.json (gitignored) agar
// lokal dan Supabase memakai kata sandi yang sama. Database hanya menyimpan hash scrypt.
// Menjalankan seed ulang MENGEMBALIKAN kapabilitas/kuota RS impor ke nilai bawaan (perubahan petugas hilang).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomInt } from "node:crypto";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* env proses juga didukung */
}

const STORE = "data/akun-rumahsakit.local.json";
const MD = "akunRumahsakit.md";
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

type Account = { email: string; password: string };

function newPassword() {
  return Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

async function main() {
  const seedOnly = !process.argv.includes("--akun-saja");
  const { getDb, resetDbHandle } = await import("../src/lib/data/db");
  const { config } = await import("../src/lib/config");
  const { DEMO_ACCOUNTS } = await import("../src/lib/auth/staff");
  const { deterministicUuid, hashPassword, verifyPassword } = await import("../src/lib/auth/password");
  const { regionOf, regionLabel } = await import("../src/lib/regions");

  const db = await getDb();
  console.log(`Database: ${config.dataMode.toUpperCase()}`);
  if (seedOnly) {
    await db.exec(readFileSync(path.join(process.cwd(), "supabase", "seed-osm.sql"), "utf8"));
    console.log("Seed RS OSM diterapkan (supabase/seed-osm.sql).");
  }

  const { rows: hospitals } = await db.query<{ id: string; name: string; short_name: string; lat: number; lng: number; phone: string | null }>(
    "select id, name, short_name, lat, lng, phone from hospitals order by short_name",
  );
  const demoHospitals = new Set<string>(DEMO_ACCOUNTS.filter((a) => !a.admin).map((a) => a.hospital));

  const store: Record<string, Account> = existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {};
  const usedEmails = new Set(Object.values(store).map((a) => a.email));
  for (const a of DEMO_ACCOUNTS) usedEmails.add(a.email);

  let created = 0;
  let updated = 0;
  for (const h of hospitals) {
    if (demoHospitals.has(h.id)) continue;
    let acc = store[h.id];
    if (!acc) {
      const base = slug(h.short_name) || "rs";
      let email = `${base}@rujukcepat.demo`;
      for (let n = 2; usedEmails.has(email); n++) email = `${base}-${n}@rujukcepat.demo`;
      usedEmails.add(email);
      acc = store[h.id] = { email, password: newPassword() };
    }
    const userId = deterministicUuid(acc.email);
    await db.query(
      `insert into staff_members (user_id, hospital_id, display_name, is_demo_admin) values ($1,$2,$3,false)
       on conflict (user_id) do update set hospital_id = excluded.hospital_id, display_name = excluded.display_name`,
      [userId, h.id, `Petugas IGD ${h.short_name}`],
    );
    const cur = await db.query<{ password_hash: string; email: string }>("select password_hash, email from staff_credentials where user_id = $1", [userId]);
    if (cur.rows[0] && cur.rows[0].email === acc.email && verifyPassword(acc.password, cur.rows[0].password_hash)) continue;
    await db.query(
      `insert into staff_credentials (user_id, email, password_hash) values ($1,$2,$3)
       on conflict (user_id) do update set email = excluded.email, password_hash = excluded.password_hash`,
      [userId, acc.email, hashPassword(acc.password)],
    );
    if (cur.rows[0]) updated++;
    else created++;
  }
  writeFileSync(STORE, JSON.stringify(store, null, 1) + "\n");

  // Tulis daftar login (gitignored).
  const byId = new Map(hospitals.map((h) => [h.id, h]));
  const rows = Object.entries(store)
    .filter(([id]) => byId.has(id))
    .map(([id, a]) => ({ h: byId.get(id)!, a, region: regionOf(byId.get(id)!) }))
    .sort((x, y) => (x.region ?? "").localeCompare(y.region ?? "") || x.h.short_name.localeCompare(y.h.short_name));
  const md: string[] = [
    "# Akun petugas rumah sakit RujukCepat",
    "",
    `> **RAHASIA – jangan di-commit/dibagikan publik.** File ini ada di \`.gitignore\`. Dibuat oleh \`npm run hospitals:import\` pada ${new Date().toISOString()}.`,
    "> Database hanya menyimpan hash; kata sandi asli hanya ada di file ini dan `data/akun-rumahsakit.local.json`.",
    "",
    "Login di `/dashboard/login`. Setiap akun hanya dapat mengubah kesiapan layanan dan kuota RS-nya sendiri.",
    "Kapabilitas dan kuota RS impor adalah **bawaan impor** (lihat `supabase/seed-osm.sql`), bukan laporan RS; perbarui lewat dashboard.",
    "",
    "## Akun demo lama",
    "",
    "Kata sandi akun berikut = nilai `DEMO_STAFF_PASSWORD` di `.env.local` (tidak ditulis di sini).",
    "",
    "| Email | Rumah sakit |",
    "| --- | --- |",
    ...DEMO_ACCOUNTS.map((a) => `| \`${a.email}\` | ${byId.get(a.hospital)?.short_name ?? a.hospital}${a.admin ? " (admin, boleh reset demo)" : ""} |`),
  ];
  for (const region of ["JAKARTA", "JAWA_TIMUR"] as const) {
    const list = rows.filter((r) => r.region === region);
    md.push("", `## ${regionLabel(region)} (${list.length} akun)`, "", "| No | Rumah sakit | Email | Kata sandi |", "| --- | --- | --- | --- |");
    list.forEach((r, i) => md.push(`| ${i + 1} | ${r.h.short_name.replace(/\|/g, "/")} | \`${r.a.email}\` | \`${r.a.password}\` |`));
  }
  const other = rows.filter((r) => !r.region);
  if (other.length) {
    md.push("", "## Di luar wilayah layanan", "", "| Rumah sakit | Email | Kata sandi |", "| --- | --- | --- |");
    other.forEach((r) => md.push(`| ${r.h.short_name} | \`${r.a.email}\` | \`${r.a.password}\` |`));
  }
  writeFileSync(MD, md.join("\n") + "\n");

  const { rows: cnt } = await db.query<{ n: number }>("select count(*)::int as n from hospitals");
  console.log(`RS di database: ${cnt[0].n}. Akun baru: ${created}, diperbarui: ${updated}, total akun impor: ${rows.length}.`);
  console.log(`Ditulis: ${MD} dan ${STORE} (keduanya gitignored).`);
  await resetDbHandle();
}

main().catch((e: unknown) => {
  const code = (e as { code?: string })?.code;
  console.error(`Impor gagal: ${e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : code ?? (e instanceof Error ? e.message.slice(0, 200) : "unknown")}`);
  process.exitCode = 1;
});
