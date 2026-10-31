import { createHash, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

// Hash kata sandi petugas (scrypt) dan UUID deterministik. Tanpa "server-only" agar dapat
// dipakai skrip impor akun (scripts/hospitals-import.ts); tetap hanya dijalankan di server.

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

/** UUID deterministik (agar seed dan akun idempoten). */
export function deterministicUuid(seed: string): string {
  const h = createHash("sha1").update(`rujukcepat:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
