import { requireStaff } from "@/lib/auth/staff";
import { fail, ok, readJson } from "@/lib/http";
import { mapDbError, resetDemo } from "@/lib/referrals/repo";
import { ResetSchema } from "@/lib/schema/referral";

export const runtime = "nodejs";

// MENGHAPUS seluruh rujukan, reservasi, dan event demo lalu memulihkan seed kapasitas/kapabilitas.
// Hanya admin demo dengan konfirmasi { "confirm": "RESET" }.
export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  if (!auth.staff.is_demo_admin) return fail("FORBIDDEN", "Hanya admin demo yang dapat mereset data demo.", 403);
  if (!ResetSchema.safeParse(await readJson(request)).success) {
    return fail("CONFIRM_REQUIRED", 'Ketik "RESET" untuk mengonfirmasi penghapusan data demo.');
  }
  try {
    await resetDemo();
    return ok({ reset: true, note: "Rujukan demo dihapus; kapasitas dan kapabilitas simulasi dikembalikan ke seed." });
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status);
  }
}
