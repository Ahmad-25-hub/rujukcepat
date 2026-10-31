import { requireStaff } from "@/lib/auth/staff";
import { listFacilities } from "@/lib/data/facilities";
import { fail, isUuid, ok, readJson } from "@/lib/http";
import { mapDbError, updateFacility } from "@/lib/facilities/repo";
import { FacilityPatchSchema } from "@/lib/schema/facility";

export const runtime = "nodejs";

// Petugas memperbarui kapabilitas/kapasitas RS-nya sendiri (simulasi). RS lain ditolak 403.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return fail("NOT_FOUND", "Rumah sakit tidak ditemukan.", 404);
  if (auth.staff.hospital_id !== id) {
    return fail("FORBIDDEN", "Anda hanya dapat mengubah status rumah sakit tempat Anda bertugas.", 403);
  }
  const parsed = FacilityPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Permintaan tidak valid.");
  try {
    await updateFacility(id, auth.staff.user_id, parsed.data);
    const facility = (await listFacilities()).find((f) => f.id === id) ?? null;
    return ok({ facility, server_time: new Date().toISOString() });
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status);
  }
}
