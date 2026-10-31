import { requireStaff } from "@/lib/auth/staff";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  return ok({ staff: auth.staff });
}
