import { requireStaff } from "@/lib/auth/staff";
import { reporterId } from "@/lib/auth/session";
import { fail, ok, readJson } from "@/lib/http";
import { createReferral, listHospitalReferrals, mapDbError } from "@/lib/referrals/repo";
import { CreateReferralSchema, IDEMPOTENCY_KEY_RE } from "@/lib/schema/referral";

export const runtime = "nodejs";
export const maxDuration = 15;

/** Kirim permintaan rujukan: PENDING + reservasi kuota HELD secara atomik. Bukan ACCEPTED. */
export async function POST(request: Request) {
  const key = request.headers.get("idempotency-key") ?? "";
  if (!IDEMPOTENCY_KEY_RE.test(key)) {
    return fail("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key (8-100 karakter) diperlukan untuk mencegah pengiriman ganda.");
  }
  const parsed = CreateReferralSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return fail("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Permintaan rujukan tidak valid.");
  }
  const { id: requesterId, setCookie } = reporterId(request);
  try {
    const { referral, created } = await createReferral(requesterId, key, parsed.data);
    const { requester_id: _omit, ...view } = referral;
    void _omit;
    return ok({ referral: view, created, server_time: new Date().toISOString() }, created ? 201 : 200, setCookie);
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status, setCookie);
  }
}

/** Antrean rujukan untuk RS petugas yang sedang masuk. */
export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if ("response" in auth) return auth.response;
  try {
    const list = await listHospitalReferrals(auth.staff.hospital_id);
    return ok({
      referrals: list.map(({ requester_id: _r, ...v }) => {
        void _r;
        return v;
      }),
      server_time: new Date().toISOString(),
    });
  } catch (e) {
    const err = mapDbError(e);
    return fail(err.code, err.message, err.status);
  }
}
