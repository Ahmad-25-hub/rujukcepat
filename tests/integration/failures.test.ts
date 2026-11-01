import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/data/db";

// T15 - penanganan gagal pada jalur analisis (mode AI simulasi): persetujuan, validasi unggahan,
// keluaran AI rusak, audio tidak jelas, rate limit, dan tidak ada data
// pasien/media yang tersimpan hanya karena analisis.

process.env.DATA_MODE = "local";
process.env.LOCAL_DB_DIR = "memory://";
process.env.AI_MODE = "mock";
process.env.ROUTING_MODE = "mock";

type Handler = (req: Request) => Promise<Response>;
let analyze: Handler;
let db: Db;
let rate: typeof import("@/lib/ratelimit");

function form(fields: Record<string, string | File>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const wav = (bytes = 200, type = "audio/wav") => new File([new Uint8Array(bytes)], "laporan.wav", { type });
const post = (body: FormData) => analyze(new Request("http://localhost/api/analyze", { method: "POST", body }));

beforeAll(async () => {
  analyze = (await import("@/app/api/analyze/route")).POST as Handler;
  db = await (await import("@/lib/data/db")).getDb();
  rate = await import("@/lib/ratelimit");
});
afterAll(async () => {
  await (await import("@/lib/data/db")).resetDbHandle();
});

describe("analisis laporan - kegagalan dan pemulihan", () => {
  it("tanpa persetujuan unggah ditolak di server", async () => {
    const res = await post(form({ text: "Pasien lemas", consent: "false" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("CONSENT_REQUIRED");
    const none = await post(form({ text: "Pasien lemas" }));
    expect((await none.json()).error.code).toBe("CONSENT_REQUIRED");
  });

  it("tanpa masukan, format audio tidak didukung, dan ukuran berlebih ditolak", async () => {
    expect((await (await post(form({ consent: "true" }))).json()).error.code).toBe("NO_INPUT");
    const badType = await post(form({ consent: "true", audio: wav(200, "video/mp4") }));
    expect(badType.status).toBe(415);
    const big = await post(form({ consent: "true", audio: wav(1.6 * 1024 * 1024) }));
    expect(big.status).toBe(413);
    const longText = await post(form({ consent: "true", text: "a".repeat(2001) }));
    expect(longText.status).toBe(413);
  });

  it("keluaran AI rusak -> 422 AI_OUTPUT_INVALID dan tidak ada hasil yang dipakai", async () => {
    const res = await post(form({ consent: "true", text: "tes", mock_scenario: "rusak" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("AI_OUTPUT_INVALID");
    expect(body).not.toHaveProperty("data");
  });

  it("audio tidak jelas -> perlu peninjauan, tidak diteruskan sebagai kebutuhan pasti", async () => {
    const res = await post(form({ consent: "true", audio: wav(), mock_scenario: "tidak-jelas" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.result.input_quality).toBe("AUDIO_TIDAK_JELAS");
    expect(body.data.needs_review).toBe(true);
    expect(body.data.mode).toBe("MOCK");
  });

  it("analisis tidak menyimpan laporan atau audio ke database", async () => {
    const count = async () =>
      (await db.query<{ n: number }>("select (select count(*) from referral_requests)::int + (select count(*) from referral_events)::int as n")).rows[0].n;
    const before = await count();
    await post(form({ consent: "true", text: "Nyeri dada menjalar" }));
    await post(form({ consent: "true", audio: wav() }));
    expect(await count()).toBe(before);
    // tidak ada kolom/tabel penyimpan media pada skema
    const cols = await db.query<{ n: number }>(
      "select count(*)::int as n from information_schema.columns where table_schema = 'public' and (column_name ilike '%audio%' or column_name ilike '%photo%' or column_name ilike '%foto%')",
    );
    expect(cols.rows[0].n).toBe(0);
  });

  it("rate limit melindungi kuota AI: permintaan berlebih mendapat 429 dengan pesan", async () => {
    rate.resetRateLimits();
    for (let i = 0; i < 12; i++) expect((await post(form({ consent: "true", text: "tes", mock_scenario: "lansia-lemas" }))).status).toBe(200);
    const res = await post(form({ consent: "true", text: "tes" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    rate.resetRateLimits();
  });
});

describe("allow() - pembatas laju", () => {
  it("menghitung per kunci dan pulih setelah jendela habis", async () => {
    rate.resetRateLimits();
    const t0 = 1_000_000;
    expect(rate.allow("k1", 2, 1000, t0).ok).toBe(true);
    expect(rate.allow("k1", 2, 1000, t0 + 1).ok).toBe(true);
    const third = rate.allow("k1", 2, 1000, t0 + 2);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
    expect(rate.allow("k2", 2, 1000, t0 + 2).ok).toBe(true);
    expect(rate.allow("k1", 2, 1000, t0 + 1500).ok).toBe(true);
  });
});
