import { beforeAll, describe, expect, it } from "vitest";

// Jalur analisis lengkap dalam mode MOCK (fixture), melewati validasi yang sama dengan LIVE.
beforeAll(() => {
  process.env.AI_MODE = "mock";
});

describe("analyzeReport (mode simulasi)", () => {
  it("skenario proposal menghasilkan hasil tervalidasi berlabel MOCK", async () => {
    const { analyzeReport } = await import("@/lib/ai/analyze");
    const r = await analyzeReport({ audio: { mimeType: "audio/wav", data: Buffer.alloc(100) }, text: null, mockScenario: null });
    expect(r.mode).toBe("MOCK");
    expect(r.result.urgency.level).toBe("MERAH");
    expect(r.input.kind).toBe("AUDIO");
    // angka gula darah tidak disebut pelapor sehingga tidak boleh muncul
    expect(r.result.soap.objective.some((o) => o.value === "46")).toBe(false);
    expect(r.warnings[0]).toContain("Hasil contoh");
  });

  it("keluaran rusak → dicoba ulang lalu AI_OUTPUT_INVALID 422", async () => {
    const { analyzeReport, AnalyzeError } = await import("@/lib/ai/analyze");
    await expect(analyzeReport({ audio: null, text: "tes", mockScenario: "rusak" })).rejects.toMatchObject({
      code: "AI_OUTPUT_INVALID",
      status: 422,
    });
    expect(AnalyzeError).toBeDefined();
  });

  it("kata kunci teks memilih skenario yang sesuai", async () => {
    const { analyzeReport } = await import("@/lib/ai/analyze");
    const r = await analyzeReport({ audio: null, text: "Anak digigit ular di kebun, kaki bengkak", mockScenario: null });
    expect(r.result.needs.map((n) => n.code)).toContain("ANTI_BISA");
  });
});
