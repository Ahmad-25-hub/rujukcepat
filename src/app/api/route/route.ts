import { listFacilities } from "@/lib/data/facilities";
import { fail, ok } from "@/lib/http";
import { routeGeometry } from "@/lib/routing";
import { LatLngSchema } from "@/lib/schema/api";

export const runtime = "nodejs";

// GET /api/route?lat=..&lng=..&hospital_id=..  → geometri rute perkiraan untuk peta.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = LatLngSchema.safeParse({
    lat: Number(url.searchParams.get("lat")),
    lng: Number(url.searchParams.get("lng")),
  });
  if (!origin.success) return fail("BAD_REQUEST", origin.error.issues[0]?.message ?? "Lokasi tidak valid.");
  const id = url.searchParams.get("hospital_id");
  const facilities = await listFacilities().catch(() => null);
  if (!facilities) return fail("FACILITY_DATA_UNAVAILABLE", "Data fasilitas tidak dapat dimuat.", 503);
  const dest = facilities.find((f) => f.id === id);
  if (!dest) return fail("NOT_FOUND", "Rumah sakit tidak ditemukan.", 404);
  try {
    return ok(await routeGeometry(origin.data, dest));
  } catch {
    return fail("ROUTING_FAILED", "Rute tidak dapat dihitung saat ini. Peta hanya menampilkan titik lokasi.", 502);
  }
}
