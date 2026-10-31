import { fail, ok, readJson } from "@/lib/http";
import { loadWithAccess, stripInternal } from "@/lib/referrals/access";
import { applyTransition, mapDbError } from "@/lib/referrals/repo";
import { DecisionSchema } from "@/lib/schema/referral";

export const runtime = "nodejs";

// Keputusan petugas IGD RS terkait: ACCEPT / REJECT / ARRIVED / REVOKE.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = DecisionSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("BAD_REQUEST", "Aksi tidak dikenal. Gunakan ACCEPT, REJECT, ARRIVED, atau REVOKE.");
  const access = await loadWithAccess(request, id, { staff: true });
  if ("response" in access) return access.response;
  if (parsed.data.action === "REVOKE" && !parsed.data.note) {
    return fail("NOTE_REQUIRED", "Pembatalan penerimaan memerlukan alasan.");
  }
  try {
    const referral = await applyTransition(id, parsed.data.action, access.staff!.user_id, parsed.data.note);
    return ok({ referral: stripInternal(referral), server_time: new Date().toISOString() });
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status);
  }
}
