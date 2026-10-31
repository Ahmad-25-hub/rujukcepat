// Bentuk respons API seragam: { ok: true, data } | { ok: false, error: { code, message } }.

export function ok<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return Response.json({ ok: false, error: { code, message } }, { status });
}
