import { z } from "zod";
import { CAPABILITY_CODES, DATA_ORIGIN, INPUT_QUALITY, URGENCY } from "./enums";

// Kontrak keluaran AI (SPEC §5.1, AGENTS §4). Nilai null = tidak diketahui.

const Origin = z.enum(DATA_ORIGIN);

export const SourcedText = z.object({
  value: z.string().max(500).nullable(),
  origin: Origin,
  note: z.string().max(200).nullable().optional(),
});

export const ObjectiveItem = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(50).nullable(),
  unit: z.string().max(30).nullable(),
  origin: Origin,
});

// Kode masih string mentah di sini; normalisasi & penyaringan dilakukan setelah parse.
export const RawNeed = z.object({
  code: z.string().max(40),
  required: z.boolean(),
  reason: z.string().max(200),
});

export const AiResultSchema = z.object({
  report: z.object({
    transcript: z.string().max(2000),
    summary: z.string().max(500),
    language: z.string().max(10).nullable(),
  }),
  soap: z.object({
    subjective: z.array(SourcedText).max(15),
    objective: z.array(ObjectiveItem).max(15),
    assessment: SourcedText,
    plan: z.array(z.string().max(200)).max(8),
  }),
  urgency: z.object({
    level: z.enum(URGENCY).nullable(),
    reason: z.string().max(300),
  }),
  needs: z.array(RawNeed).max(8),
  unknowns: z.array(z.string().max(100)).max(20),
  input_quality: z.enum(INPUT_QUALITY),
});
export type AiResult = z.infer<typeof AiResultSchema>;

export const NeedSchema = z.object({
  code: z.enum(CAPABILITY_CODES),
  required: z.boolean(),
  reason: z.string().max(200),
});
export type Need = z.infer<typeof NeedSchema>;

// Hasil setelah normalisasi server: kebutuhan hanya berisi kode yang valid.
export const NormalizedAiResultSchema = AiResultSchema.extend({
  needs: z.array(NeedSchema).min(1).max(8),
});
export type NormalizedAiResult = z.infer<typeof NormalizedAiResultSchema>;

export const AnalyzeResponseSchema = z.object({
  result: NormalizedAiResultSchema,
  warnings: z.array(z.string()),
  needs_review: z.boolean(),
  timing: z.object({ provider_ms: z.number(), total_ms: z.number() }),
  mode: z.enum(["LIVE", "MOCK"]),
  model: z.string().nullable(),
  input: z.object({
    kind: z.enum(["AUDIO", "TEXT"]),
    audio_bytes: z.number().nullable(),
  }),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
