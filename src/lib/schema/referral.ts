import { z } from "zod";
import { NeedSchema, NormalizedAiResultSchema } from "./ai";
import { LatLngSchema } from "./api";
import { CAPABILITY_CODES, CAPABILITY_STATUS, REFERRAL_STATUS, RESERVATION_STATUS, URGENCY } from "./enums";

// Kontrak rujukan (SPEC §8-§9). Status permintaan dan status reservasi kuota
// adalah dua informasi yang berbeda dan selalu dibawa terpisah.

export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

export const CreateReferralSchema = z.object({
  hospital_id: z.uuid(),
  ai_result: NormalizedAiResultSchema,
  needs: z.array(NeedSchema).min(1).max(8),
  location: LatLngSchema,
  location_source: z.enum(["GPS", "MANUAL"]),
});
export type CreateReferralInput = z.infer<typeof CreateReferralSchema>;

export const DECISION_ACTIONS = ["ACCEPT", "REJECT", "ARRIVED", "REVOKE"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const DecisionSchema = z.object({
  action: z.enum(DECISION_ACTIONS),
  note: z.string().trim().max(300).optional(),
});

export const CancelSchema = z.object({ reason: z.string().trim().max(300).optional() }).optional();

export const FacilityPatchSchema = z
  .object({
    capabilities: z
      .array(z.object({ code: z.enum(CAPABILITY_CODES), status: z.enum(CAPABILITY_STATUS) }))
      .max(8)
      .optional(),
    total_slots: z.number().int().min(0).max(500).optional(),
    available_slots: z.number().int().min(0).max(500).optional(),
  })
  .refine((v) => v.capabilities?.length || v.total_slots !== undefined || v.available_slots !== undefined, {
    message: "Tidak ada perubahan yang dikirim.",
  });
export type FacilityPatch = z.infer<typeof FacilityPatchSchema>;

export const ResetSchema = z.object({ confirm: z.literal("RESET") });

/** Tampilan rujukan untuk klien (pelapor pemilik atau petugas RS terkait). */
export const ReferralViewSchema = z.object({
  id: z.string(),
  status: z.enum(REFERRAL_STATUS),
  // Informasi terpisah dari status permintaan: penguncian kuota simulasi.
  reservation_status: z.enum(RESERVATION_STATUS).nullable(),
  release_reason: z.string().nullable(),
  hospital: z.object({ id: z.string(), name: z.string(), short_name: z.string() }),
  urgency: z.enum(URGENCY).nullable(),
  needs: z.array(z.enum(CAPABILITY_CODES)),
  required_needs: z.array(z.enum(CAPABILITY_CODES)),
  eta_seconds: z.number().nullable(),
  eta_source: z.enum(["OSRM", "MOCK"]).nullable(),
  origin: z.object({ lat: z.number(), lng: z.number() }),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string(),
  decided_at: z.string().nullable(),
  decision_note: z.string().nullable(),
  arrived_at: z.string().nullable(),
  ai_result: NormalizedAiResultSchema,
  events: z.array(z.object({ type: z.string(), at: z.string() })).optional(),
});
export type ReferralView = z.infer<typeof ReferralViewSchema>;

export type ReferralResponse = { referral: ReferralView; server_time: string };

export const STATUS_LABEL: Record<(typeof REFERRAL_STATUS)[number], string> = {
  PENDING: "Menunggu konfirmasi petugas",
  ACCEPTED: "Diterima petugas IGD",
  REJECTED: "Ditolak petugas IGD",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
};

export const RESERVATION_LABEL: Record<(typeof RESERVATION_STATUS)[number], string> = {
  HELD: "Kuota simulasi ditahan",
  RELEASED: "Kuota simulasi dilepas",
  CONSUMED: "Kuota simulasi terpakai (pasien tiba)",
};
