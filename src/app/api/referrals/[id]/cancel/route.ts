import { fail, ok } from "@/lib/http";
import { loadWithAccess, stripInternal } from "@/lib/referrals/access";
import { applyTransition, mapDbError } from "@/lib/referrals/repo";

export const runtime = "nodejs";

// Pelapor membatalkan permintaan yang masih PENDING; reservasi dilepas tepat sekali.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await loadWithAccess(request, id, { owner: true });
  if ("response" in access) return access.response;
  try {
    const referral = await applyTransition(id, "CANCEL", access.referral.requester_id);
    return ok({ referral: stripInternal(referral), server_time: new Date().toISOString() });
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status);
  }
}
