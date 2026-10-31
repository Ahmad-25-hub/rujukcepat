import type { ApiResult } from "@/lib/schema/api";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** fetch + pembongkaran { ok, data | error }. Error jaringan diberi pesan yang jelas. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiClientError("ABORTED", "Dibatalkan.", 0);
    throw new ApiClientError("NETWORK", "Koneksi ke server gagal. Periksa jaringan lalu coba lagi.", 0);
  }
  let body: ApiResult<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError("BAD_RESPONSE", `Respons server tidak valid (HTTP ${res.status}).`, res.status);
  }
  if (!body.ok) throw new ApiClientError(body.error.code, body.error.message, res.status);
  return body.data;
}

export type ServiceStatus = {
  ai_mode: "LIVE" | "MOCK";
  ai_model: string | null;
  ai_configured: boolean;
  routing_mode: "LIVE" | "MOCK";
  data_mode: "LOCAL" | "SUPABASE";
  stale_after_minutes: number;
  mock_scenarios: { id: string; label: string }[];
  server_time: string;
};
