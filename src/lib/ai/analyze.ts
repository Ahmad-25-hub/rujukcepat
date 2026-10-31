import "server-only";
import { config } from "@/lib/config";
import type { AnalyzeResponse } from "@/lib/schema/ai";
import { geminiGenerate, ProviderError, type MediaInput } from "./gemini";
import { mockGenerate, pickScenario, type MockScenario } from "./mock";
import { normalizeAiOutput, parseJsonLoose } from "./normalize";

export type AnalyzeInput = {
  audio: MediaInput | null;
  photo: MediaInput | null;
  text: string | null;
  mockScenario: MockScenario | null;
  signal?: AbortSignal;
};

export class AnalyzeError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const PROVIDER_MESSAGES: Record<ProviderError["code"], [number, string]> = {
  AI_NOT_CONFIGURED: [503, "Layanan AI belum dikonfigurasi di server (GEMINI_API_KEY). Gunakan mode simulasi atau hubungi admin demo."],
  AI_TIMEOUT: [504, "Layanan AI terlalu lama merespons. Rekaman Anda masih tersimpan; silakan coba lagi."],
  AI_PROVIDER_ERROR: [502, "Layanan AI sedang gagal atau kuota habis. Rekaman Anda masih tersimpan; silakan coba lagi."],
  AI_EMPTY: [502, "Layanan AI tidak mengembalikan hasil. Silakan coba lagi."],
};

/** Panggil penyedia → parse → validasi schema, dengan satu kali retry bila keluaran tidak valid. */
export async function analyzeReport(input: AnalyzeInput): Promise<AnalyzeResponse> {
  const t0 = performance.now();
  let providerMs = 0;
  const hasPhoto = input.photo !== null;
  const mode = config.aiMode === "mock" ? "MOCK" : "LIVE";
  const scenario = pickScenario(input.text, input.mockScenario);
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const p0 = performance.now();
    let raw: string;
    try {
      raw =
        mode === "MOCK"
          ? await mockGenerate({ scenario, text: input.text, hasPhoto })
          : await geminiGenerate({ audio: input.audio, photo: input.photo, text: input.text, signal: input.signal });
    } catch (e) {
      if (e instanceof ProviderError) {
        // Pesan penyedia berisi kode/status HTTP, bukan isi laporan.
        console.warn("[analyze] penyedia gagal:", e.message.slice(0, 200));
        const [status, msg] = PROVIDER_MESSAGES[e.code];
        throw new AnalyzeError(e.code, status, msg);
      }
      throw e;
    } finally {
      providerMs += performance.now() - p0;
    }

    let json: unknown;
    try {
      json = parseJsonLoose(raw);
    } catch {
      lastIssues = ["(root): bukan JSON yang valid"];
      continue;
    }
    const norm = normalizeAiOutput(json, { hasPhoto });
    if (!norm.ok) {
      lastIssues = norm.issues;
      continue;
    }
    const warnings = [...norm.warnings];
    if (attempt > 0) warnings.unshift("Keluaran AI pertama tidak valid; hasil ini dari percobaan ulang otomatis.");
    if (mode === "MOCK") warnings.unshift(`Mode AI simulasi: hasil berasal dari fixture "${scenario}", bukan analisis audio.`);
    return {
      result: norm.result,
      warnings,
      needs_review: norm.needs_review,
      timing: { provider_ms: Math.round(providerMs), total_ms: Math.round(performance.now() - t0) },
      mode,
      model: mode === "LIVE" ? config.geminiModel : null,
      input: {
        kind: input.audio ? "AUDIO" : "TEXT",
        audio_bytes: input.audio?.data.length ?? null,
        photo_bytes: input.photo?.data.length ?? null,
      },
    };
  }
  console.warn("[analyze] AI_OUTPUT_INVALID", { issues: lastIssues.length });
  throw new AnalyzeError(
    "AI_OUTPUT_INVALID",
    422,
    "Hasil AI tidak sesuai format setelah dicoba ulang, sehingga tidak dipakai untuk pencocokan. Silakan coba lagi atau rekam ulang.",
  );
}
