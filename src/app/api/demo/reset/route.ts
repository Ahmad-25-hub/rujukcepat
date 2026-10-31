import { requireStaff } from "@/lib/auth/staff";
import { fail, ok, readJson } from "@/lib/http";
import { mapDbError, resetDemo } from "@/lib/facilities/repo";
import { ResetSchema } from "@/lib/schema/facility";

export const runtime = "nodejs";

// Memulihkan seed kapasitas/kapabilitas semua RS (perubahan petugas hilang) dan menghapus sisa data rujukan lama.
// Hanya admin demo dengan konfirmasi { "confirm": "RESET" }.
export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  if (!auth.staff.is_demo_admin) return fail("FORBIDDEN", "Hanya admin yang dapat mereset data.", 403);
  if (!ResetSchema.safeParse(await readJson(request)).success) {
    return fail("CONFIRM_REQUIRED", 'Ketik "RESET" untuk mengonfirmasi penghapusan data.');
  }
  try {
    await resetDemo();
    return ok({ reset: true, note: "Kapasitas dan kapabilitas dikembalikan ke nilai awal." });
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status);
  }
}
