// Verifikasi Gemini LIVE (T04): model tersedia + audio sintetis → JSON tervalidasi.
// Jalankan: npm run check:gemini [path-audio.wav]
// Membaca GEMINI_API_KEY & GEMINI_MODEL dari .env.local. Hanya data sintetis.
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local opsional bila variabel sudah di-environment
  }
  process.env.AI_MODE = "live";
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  if (!key || key.startsWith("<")) {
    console.error("GEMINI_API_KEY belum diisi di .env.local");
    process.exit(2);
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const names: string[] = [];
  for await (const m of await ai.models.list()) if (m.name) names.push(m.name.replace(/^models\//, ""));
  const available = names.includes(model);
  console.log(`Model ${model}: ${available ? "TERSEDIA" : "TIDAK DITEMUKAN"} (${names.length} model terdaftar)`);
  if (!available) {
    console.log("Kandidat flash:", names.filter((n) => n.includes("flash")).join(", "));
    process.exit(1);
  }

  const file = process.argv[2] ?? "tests/fixtures/audio/lansia-lemas-sintetis.wav";
  const audio = { mimeType: "audio/wav", data: readFileSync(file) };
  const { analyzeReport } = await import("../src/lib/ai/analyze");
  const t0 = performance.now();
  const r = await analyzeReport({ audio, text: null, mockScenario: null });
  console.log(
    JSON.stringify(
      {
        file,
        audio_bytes: audio.data.length,
        mode: r.mode,
        model: r.model,
        timing: r.timing,
        wall_ms: Math.round(performance.now() - t0),
        input_quality: r.result.input_quality,
        urgency: r.result.urgency.level,
        needs: r.result.needs.map((n) => `${n.code}${n.required ? "*" : ""}`),
        summary: r.result.report.summary,
        objective: r.result.soap.objective.map((o) => [o.label, o.value, o.origin]),
        warnings: r.warnings,
        needs_review: r.needs_review,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("GAGAL:", e?.code ?? "", e?.message ?? e);
  process.exit(1);
});
