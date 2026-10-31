import { ok } from "@/lib/http";
import { loadWithAccess, stripInternal } from "@/lib/referrals/access";

export const runtime = "nodejs";

// Status rujukan + status reservasi (terpisah). Dipakai portal/dashboard untuk rekonsiliasi dan fallback polling.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await loadWithAccess(request, id, { owner: true, staff: true });
  if ("response" in access) return access.response;
  return ok({ referral: stripInternal(access.referral), server_time: new Date().toISOString() });
}
