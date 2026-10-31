// Migrasi Supabase tanpa reset. Seed hanya bila tabel RS kosong.
// Jalankan: npm run supabase:setup. Tidak memuat shim auth lokal.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createSupabasePool } from "../src/lib/data/supabase-db";

try { process.loadEnvFile(".env.local"); } catch { /* env proses juga didukung */ }

async function main() {
  const pool = createSupabasePool();
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Lock di dalam transaksi juga bekerja melalui transaction pooler.
      await client.query("select pg_advisory_xact_lock(727855, 1)");
      await client.query(`create table if not exists public._rujuk_migrations (
        name text primary key, checksum text not null, applied_at timestamptz not null default now()
      ); alter table public._rujuk_migrations enable row level security;`);
      const dir = path.join(process.cwd(), "supabase", "migrations");
      for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
        const sql = readFileSync(path.join(dir, name), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const previous = await client.query<{ checksum: string }>("select checksum from public._rujuk_migrations where name = $1", [name]);
        if (previous.rows[0]) {
          if (previous.rows[0].checksum !== checksum) throw new Error("MIGRATION_CHANGED");
          console.log(`Lewati migrasi: ${name} (sudah diterapkan)`);
          continue;
        }
        await client.query(sql);
        await client.query("insert into public._rujuk_migrations (name, checksum) values ($1, $2)", [name, checksum]);
        console.log(`Migrasi disiapkan: ${name}`);
      }
      const count = await client.query<{ n: number }>("select count(*)::int as n from public.hospitals");
      if (count.rows[0].n === 0) {
        await client.query(readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8"));
        console.log("Seed awal: 10 RS dengan kapasitas/kapabilitas SIMULASI.");
      } else {
        console.log("Seed dilewati: data RS sudah ada; kapasitas dan rujukan dipertahankan.");
      }
      await client.query("notify pgrst, 'reload schema'");
      await client.query("commit");
      console.log("Setup Supabase tersimpan. Jalankan npm run check:supabase, lalu aktifkan DATA_MODE=supabase dan mulai ulang Next.js.");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // Jangan cetak message/detail pg yang bisa memuat connection string atau payload.
  const known = ["SUPABASE_DB_URL_MISSING", "SUPABASE_DB_URL_INVALID", "MIGRATION_CHANGED"];
  const message = error instanceof Error ? error.message : "";
  const code = (error as { code?: string })?.code;
  console.error(`Setup gagal: ${known.includes(message) ? message : code && /^[A-Z0-9_]+$/.test(code) ? code : "DATABASE_ERROR"}. Periksa connection string/password database dan migrasi. Transaksi dibatalkan.`);
  process.exitCode = 1;
});
