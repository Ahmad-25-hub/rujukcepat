// Bentuk respons API seragam: { ok: true, data } | { ok: false, error: { code, message } }.

export function ok<T>(data: T, status = 200, setCookie?: string | null) {
  const res = Response.json({ ok: true, data }, { status });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}

export function fail(code: string, message: string, status = 400, setCookie?: string | null) {
  const res = Response.json({ ok: false, error: { code, message } }, { status });
  if (setCookie) res.headers.append("Set-Cookie", setCookie);
  return res;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

/** Baca body JSON; null bila bukan JSON valid. */
export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
