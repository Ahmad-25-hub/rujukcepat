import "server-only";
import { createHash, createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

// Sesi demo berbasis cookie bertanda tangan (HMAC). Keamanan bukan fokus proyek ini,
// tetapi akses lintas rumah sakit tetap ditegakkan di setiap route (lihat requireStaff).
//  - rc_rid   : id pelapor anonim (UUID acak, httpOnly) -> requester_id rujukan.
//  - rc_staff : token petugas "userId.exp.hmac".

export const REPORTER_COOKIE = "rc_rid";
export const STAFF_COOKIE = "rc_staff";
const STAFF_TTL_SECONDS = 8 * 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && !s.startsWith("<")) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET_MISSING");
  return "dev-only-secret-rujukcepat";
}

export function parseCookies(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieHeader(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Id pelapor dari cookie; bila belum ada dibuat baru dan `setCookie` berisi header Set-Cookie. */
export function reporterId(request: Request): { id: string; setCookie: string | null } {
  const existing = parseCookies(request)[REPORTER_COOKIE];
  if (existing && UUID_RE.test(existing)) return { id: existing.toLowerCase(), setCookie: null };
  const id = randomUUID();
  return { id, setCookie: cookieHeader(REPORTER_COOKIE, id, 7 * 24 * 3600) };
}

/** Id pelapor yang sudah ada (tanpa membuat baru). */
export function existingReporterId(request: Request): string | null {
  const v = parseCookies(request)[REPORTER_COOKIE];
  return v && UUID_RE.test(v) ? v.toLowerCase() : null;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function staffCookie(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + STAFF_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  return cookieHeader(STAFF_COOKIE, `${payload}.${sign(payload)}`, STAFF_TTL_SECONDS);
}

export function clearStaffCookie(): string {
  return cookieHeader(STAFF_COOKIE, "", 0);
}

export function staffUserId(request: Request): string | null {
  const raw = parseCookies(request)[STAFF_COOKIE];
  if (!raw) return null;
  const [userId, exp, mac] = raw.split(".");
  if (!userId || !exp || !mac || !UUID_RE.test(userId)) return null;
  const expected = sign(`${userId}.${exp}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return userId.toLowerCase();
}

export function hashPassword(password: string, salt = randomUUID().replace(/-/g, "")): string {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 32).toString("hex"));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** UUID deterministik untuk akun demo (agar seed idempoten). */
export function deterministicUuid(seed: string): string {
  const h = createHash("sha1").update(`rujukcepat:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
