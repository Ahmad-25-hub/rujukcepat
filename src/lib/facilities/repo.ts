import "server-only";
import { getDb, resetDemoDataOn } from "@/lib/data/db";
import { notifyChange } from "@/lib/sync/bus";
import type { FacilityPatch } from "@/lib/schema/facility";

// Perubahan data fasilitas oleh petugas. Validasi kapasitas/kapabilitas ada di fungsi SQL
// update_facility; modul ini hanya memanggil dan memetakan galat.

export class RepoError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const DB_ERRORS: Record<string, { status: number; message: string }> = {
  HOSPITAL_NOT_FOUND: { status: 404, message: "Rumah sakit tidak ditemukan." },
  CAPABILITY_NOT_OFFERED: { status: 400, message: "Rumah sakit ini tidak menawarkan layanan tersebut pada daftar fasilitas." },
  INVALID_CAPACITY: { status: 400, message: "Kapasitas tidak valid: tidak boleh negatif dan tersedia tidak boleh melebihi total." },
};

export function mapDbError(e: unknown): RepoError {
  if (e instanceof RepoError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  for (const [code, info] of Object.entries(DB_ERRORS)) {
    if (msg.includes(code)) return new RepoError(code, info.message, info.status);
  }
  console.error("[repo] galat database", (e as { code?: string }).code ?? "unknown");
  return new RepoError("DB_ERROR", "Terjadi kesalahan pada database. Silakan coba lagi.", 500);
}

export async function updateFacility(hospitalId: string, actor: string, patch: FacilityPatch): Promise<void> {
  const db = await getDb();
  try {
    await db.query("select update_facility($1,$2,$3,$4,$5)", [
      hospitalId,
      actor,
      patch.capabilities ? JSON.stringify(patch.capabilities) : null,
      patch.total_slots ?? null,
      patch.available_slots ?? null,
    ]);
  } catch (e) {
    throw mapDbError(e);
  }
  notifyChange({ hospital_id: hospitalId });
}

/** Kembalikan kapasitas dan kapabilitas seluruh RS ke seed simulasi. */
export async function resetDemo(): Promise<void> {
  const db = await getDb();
  try {
    await resetDemoDataOn(db);
  } catch (e) {
    throw mapDbError(e);
  }
  const { rows } = await db.query<{ id: string }>("select id from hospitals");
  for (const h of rows) notifyChange({ hospital_id: String(h.id) });
}
