import "server-only";

// Pembatas laju sederhana dalam memori (per proses). Melindungi kuota Gemini gratis dan
// membatasi percobaan login demo. Bukan pengganti pembatasan di tingkat infrastruktur;
// pada serverless tiap instans punya penghitung sendiri (keterbatasan dicatat di README).

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __rujukRate?: Map<string, Bucket> };
const buckets = (g.__rujukRate ??= new Map<string, Bucket>());

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip") || "lokal";
}

/** true bila masih diizinkan. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  return { ok: b.count <= max, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

export function resetRateLimits() {
  buckets.clear();
}
