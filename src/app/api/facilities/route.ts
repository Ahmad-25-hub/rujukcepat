import { config } from "@/lib/config";
import { listFacilities } from "@/lib/data/facilities";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status fasilitas publik (simulasi) tanpa data pasien.
export async function GET() {
  try {
    const facilities = await listFacilities();
    return ok({ facilities, stale_after_minutes: config.staleAfterMinutes, server_time: new Date().toISOString() });
  } catch (e) {
    console.error("[facilities] gagal", (e as { code?: string }).code ?? (e instanceof Error ? e.name : "unknown"));
    return fail("FACILITY_DATA_UNAVAILABLE", "Data fasilitas tidak dapat dimuat.", 503);
  }
}
