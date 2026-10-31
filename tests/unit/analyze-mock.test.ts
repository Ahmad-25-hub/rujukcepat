import { beforeAll, describe, expect, it } from "vitest";

// Jalur analisis lengkap dalam mode MOCK (fixture), melewati validasi yang sama dengan LIVE.
beforeAll(() => {
  process.env.AI_MODE = "mock";
});

describe("analyzeReport (mode simulasi)", () => {
  it("skenario proposal menghasilkan hasil tervalidasi berlabel MOCK", async () => {
    const { analyzeReport } = await import("@/lib/ai/analyze");
    const r = await analyzeReport({ audio: { mimeType: "audio/wav", data: Buffer.alloc(100) }, photo: null, text: null, mockScenario: null });
    expect(r.mode).toBe("MOCK");
    expect(r.result.urgency.level).toBe("MERAH");
    expect(r.input.kind).toBe("AUDIO");
    // tanpa foto: angka gula darah tidak boleh muncul
    expect(r.result.soap.objective.some((o) => o.value === "46")).toBe(false);
    expect(r.warnings[0]).toContain("simulasi");
  });

  it("dengan foto: angka dari foto tersedia dan berlabel PHOTO_READING", async () => {
    const { analyzeReport } = await import("@/lib/ai/analyze");
    const r = await analyzeReport({
      audio: null,
      photo: { mimeType: "image/jpeg", data: Buffer.alloc(10) },
      text: "Ayah saya 70 tahun lemas dan keringat dingin",
      mockScenario: null,
    });
    expect(r.result.soap.objective.find((o) => o.value === "46")?.origin).toBe("PHOTO_READING");
  });

  it("keluaran rusak → dicoba ulang lalu AI_OUTPUT_INVALID 422", async () => {
    const { analyzeReport, AnalyzeError } = await import("@/lib/ai/analyze");
    await expect(analyzeReport({ audio: null, photo: null, text: "tes", mockScenario: "rusak" })).rejects.toMatchObject({
      code: "AI_OUTPUT_INVALID",
      status: 422,
    });
    expect(AnalyzeError).toBeDefined();
  });

  it("kata kunci teks memilih skenario yang sesuai", async () => {
    const { analyzeReport } = await import("@/lib/ai/analyze");
    const r = await analyzeReport({ audio: null, photo: null, text: "Anak digigit ular di kebun, kaki bengkak", mockScenario: null });
    expect(r.result.needs.map((n) => n.code)).toContain("ANTI_BISA");
  });
});
