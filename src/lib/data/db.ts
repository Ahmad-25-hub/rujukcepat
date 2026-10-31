import "server-only";
import path from "node:path";
import { config } from "@/lib/config";
import { applySeed, openDatabase } from "./local-db";

// Akses SQL seragam untuk dua mode data:
//  - local    : PGlite (Postgres WASM) di LOCAL_DB_DIR ("memory://" = in-memory, dipakai tes).
//  - supabase : koneksi langsung ke Postgres Supabase (SUPABASE_DB_URL) memakai SQL yang sama.
// Seluruh logika atomik (kuota, transisi) ada di fungsi SQL pada supabase/migrations.

export type Db = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
};

const g = globalThis as unknown as { __rujukDbHandle?: Promise<Db> };

async function openSupabaseDb(): Promise<Db> {
  const url = process.env.SUPABASE_DB_URL;
  if (!url || url.startsWith("<")) throw new Error("SUPABASE_DB_URL_MISSING");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  return {
    query: async (sql, params) => {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    exec: async (sql) => pool.query(sql),
  };
}

async function openLocalDb(): Promise<Db> {
  const dirEnv = process.env.LOCAL_DB_DIR || ".data/pglite";
  const dir = dirEnv === "memory://" ? undefined : path.resolve(/*turbopackIgnore: true*/ process.cwd(), dirEnv);
  return (await openDatabase(dir)) as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!g.__rujukDbHandle) {
    g.__rujukDbHandle = (config.dataMode === "supabase" ? openSupabaseDb() : openLocalDb()).catch((e) => {
      g.__rujukDbHandle = undefined;
      throw e;
    });
  }
  return g.__rujukDbHandle;
}

/** Tutup koneksi dan lupakan handle (dipakai tes). */
export async function resetDbHandle() {
  const h = g.__rujukDbHandle;
  g.__rujukDbHandle = undefined;
  if (h) {
    const db = (await h) as Db & { close?: () => Promise<void>; end?: () => Promise<void> };
    await db.close?.();
  }
}

/** Hapus semua rujukan/reservasi/event demo lalu jalankan ulang seed. MENGHAPUS data demo. */
export async function resetDemoDataOn(db: Db) {
  await db.exec("delete from referral_events; delete from quota_reservations; delete from referral_requests;");
  await applySeed(db as unknown as Parameters<typeof applySeed>[0]);
}
