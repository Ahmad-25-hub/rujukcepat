import { clearStaffCookie } from "@/lib/auth/session";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  return ok({ signed_out: true }, 200, clearStaffCookie());
}
