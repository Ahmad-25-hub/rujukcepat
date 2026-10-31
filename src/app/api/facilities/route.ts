import { connection } from "next/server";
import { config } from "@/lib/config";
import { listFacilities } from "@/lib/data/facilities";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

// Status fasilitas publik (simulasi) tanpa data pasien.
export async function GET() {
  await connection();
  try {
    const facilities = await listFacilities();
    return ok({ facilities, stale_after_minutes: config.staleAfterMinutes, server_time: new Date().toISOString() });
  } catch (e) {
    console.error("[facilities] gagal", e instanceof Error ? e.message.split(":")[0] : "unknown");
    return fail("FACILITY_DATA_UNAVAILABLE", "Data fasilitas tidak dapat dimuat.", 503);
  }
}
