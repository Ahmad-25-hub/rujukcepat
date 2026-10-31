import { z } from "zod";
import { demoPassword, loginStaff } from "@/lib/auth/staff";
import { staffCookie } from "@/lib/auth/session";
import { fail, ok, readJson } from "@/lib/http";
import { allow, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

const LoginSchema = z.object({ email: z.string().min(3).max(120), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const rate = allow(`login:${clientKey(request)}`, Number(process.env.LOGIN_RATE_PER_MINUTE) || 10, 60_000);
  if (!rate.ok) return fail("RATE_LIMITED", `Terlalu banyak percobaan masuk. Coba lagi dalam ${rate.retryAfterSec} detik.`, 429);
  const parsed = LoginSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("BAD_REQUEST", "Email dan kata sandi wajib diisi.");
  if (!demoPassword()) {
    return fail(
      "DEMO_ACCOUNTS_NOT_CONFIGURED",
      "Akun petugas demo belum disiapkan: isi DEMO_STAFF_PASSWORD di environment server lalu jalankan ulang aplikasi.",
      503,
    );
  }
  let staff;
  try {
    staff = await loginStaff(parsed.data.email, parsed.data.password);
  } catch (e) {
    console.error("[login] gagal", (e as { code?: string }).code ?? "unknown");
    return fail("INTERNAL", "Tidak dapat memeriksa akun saat ini. Silakan coba lagi.", 500);
  }
  if (!staff) return fail("INVALID_CREDENTIALS", "Email atau kata sandi salah.", 401);
  return ok({ staff }, 200, staffCookie(staff.user_id));
}
