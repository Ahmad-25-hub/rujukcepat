import { AiResultSchema, type NormalizedAiResult, type Need } from "@/lib/schema/ai";
import { isCapabilityCode } from "@/lib/schema/enums";

// Validasi + normalisasi keluaran AI (SPEC §5.2). Murni, tanpa I/O.

export type NormalizeOk = {
  ok: true;
  result: NormalizedAiResult;
  warnings: string[];
  needs_review: boolean;
};
export type NormalizeErr = { ok: false; error: "AI_OUTPUT_INVALID"; issues: string[] };

// Pola dosis/terapi: angka + satuan obat, atau kata dosis.
const DOSE_PATTERN =
  /(\d+([.,]\d+)?\s*(mg(?!\s*\/\s*dl)|mcg|µg|ug|ml|cc|tablet|tab|kapsul|unit|iu|gram|gr|g)\b)|\bdosis\b|\b(berikan|suntik(kan)?|minum(kan)?)\s+\w*\s*(obat|insulin|dextrose|glukosa)/i;

export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(trimmed);
}

export function normalizeAiOutput(raw: unknown): NormalizeOk | NormalizeErr {
  const parsed = AiResultSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "AI_OUTPUT_INVALID",
      issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }
  const r = structuredClone(parsed.data);
  const warnings: string[] = [];
  let needsReview = false;

  // 1. Normalisasi kode kapabilitas; buang yang tidak dikenal; gabungkan duplikat.
  const needs = new Map<string, Need>();
  for (const n of r.needs) {
    const code = n.code.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (!isCapabilityCode(code)) {
      warnings.push(`Kode kapabilitas tidak dikenal dibuang: "${n.code}".`);
      continue;
    }
    const prev = needs.get(code);
    needs.set(code, {
      code,
      required: (prev?.required ?? false) || n.required,
      reason: prev?.reason || n.reason,
    });
  }
  if (needs.size === 0) {
    needs.set("IGD_DASAR", {
      code: "IGD_DASAR",
      required: true,
      reason: "Kebutuhan tidak dapat ditentukan dari laporan; IGD dasar dipakai sementara dan perlu ditinjau.",
    });
    warnings.push("Kebutuhan kapabilitas kosong; IGD_DASAR ditambahkan sebagai kebutuhan wajib sementara.");
    needsReview = true;
  }
  if (![...needs.values()].some((n) => n.required)) {
    // Kandidat harus punya minimal satu kebutuhan wajib agar kecocokan tidak kosong makna.
    const first = needs.has("IGD_DASAR") ? needs.get("IGD_DASAR")! : [...needs.values()][0];
    first.required = true;
    warnings.push(`Tidak ada kebutuhan wajib; ${first.code} dijadikan wajib dan perlu ditinjau.`);
    needsReview = true;
  }

  // 2. Item Plan yang memuat dosis/terapi dibuang.
  const plan = r.soap.plan.filter((p) => {
    if (DOSE_PATTERN.test(p)) {
      warnings.push("Satu item Plan memuat dosis/terapi dan dihapus.");
      return false;
    }
    return true;
  });

  // 3. Assessment selalu interpretasi AI.
  const assessment = { ...r.soap.assessment, origin: r.soap.assessment.value == null ? ("UNKNOWN" as const) : ("AI_INTERPRETATION" as const) };

  if (r.urgency.level === null) needsReview = true;
  if (r.input_quality !== "OK") needsReview = true;

  const result: NormalizedAiResult = {
    ...r,
    soap: { ...r.soap, assessment, plan },
    needs: [...needs.values()],
  };
  return { ok: true, result, warnings, needs_review: needsReview };
}
