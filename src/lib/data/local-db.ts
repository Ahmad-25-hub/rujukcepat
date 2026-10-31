import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

// Database lokal PGlite (Postgres WASM) untuk DATA_MODE=local.
// Menjalankan migrasi Supabase yang sama + shim auth, lalu seed bila kosong.
// Data di sini adalah SIMULASI lokal, bukan Supabase.

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// Path dibatasi ke folder supabase/ agar tracing build tidak menyertakan seluruh proyek.
function readSql(...parts: string[]) {
  return readFileSync(path.join(process.cwd(), "supabase", ...parts), "utf8");
}

export async function applyMigrations(db: PGlite) {
  await db.exec(readSql("local", "auth-shim.sql"));
  await db.exec(
    "create table if not exists _local_migrations (name text primary key, applied_at timestamptz default now())",
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const done = await db.query("select 1 from _local_migrations where name = $1", [f]);
    if (done.rows.length) continue;
    await db.transaction(async (tx) => {
      await tx.exec(readSql("migrations", f));
      await tx.query("insert into _local_migrations (name) values ($1)", [f]);
    });
  }
}

/** Seed simulasi: 10 RS awal (seed.sql) + RS impor OSM Jakarta & Jawa Timur (seed-osm.sql). */
export async function applySeed(db: PGlite) {
  await db.exec(readSql("seed.sql"));
  await db.exec(readSql("seed-osm.sql"));
}

/** Hapus sisa data rujukan lama lalu jalankan ulang seed. Menghapus data demo. */
export async function resetDemoData(db: PGlite) {
  await db.exec(
    "delete from referral_events; delete from quota_reservations; delete from referral_requests;",
  );
  await applySeed(db);
}

export async function openDatabase(dataDir?: string) {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  await applyMigrations(db);
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from hospitals");
  if (rows[0].n === 0) await applySeed(db);
  return db;
}
