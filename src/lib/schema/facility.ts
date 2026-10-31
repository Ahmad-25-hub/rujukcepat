import { z } from "zod";
import { CAPABILITY_CODES, CAPABILITY_STATUS } from "./enums";

// Perubahan status fasilitas oleh petugas RS. Kuota hanya berubah lewat jalur ini
// (diatur manual oleh rumah sakit), tidak berkurang otomatis karena ada pelapor yang menuju RS.

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
