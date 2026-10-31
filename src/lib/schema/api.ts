import { z } from "zod";
import { CAPABILITY_CODES, CAPABILITY_STATUS } from "./enums";
import { NeedSchema } from "./ai";

// Batas wilayah Jabodetabek untuk validasi koordinat pelapor.
export const SERVICE_BOUNDS = { minLat: -6.8, maxLat: -5.9, minLng: 106.3, maxLng: 107.3 };

export const LatLngSchema = z
  .object({ lat: z.number(), lng: z.number() })
  .refine(
    (p) =>
      p.lat >= SERVICE_BOUNDS.minLat &&
      p.lat <= SERVICE_BOUNDS.maxLat &&
      p.lng >= SERVICE_BOUNDS.minLng &&
      p.lng <= SERVICE_BOUNDS.maxLng,
    { message: "Lokasi di luar wilayah layanan demo (Jabodetabek)." },
  );
export type LatLng = z.infer<typeof LatLngSchema>;

export const MatchRequestSchema = z.object({
  needs: z.array(NeedSchema).min(1).max(8),
  location: LatLngSchema,
  location_source: z.enum(["GPS", "MANUAL"]),
});
export type MatchRequest = z.infer<typeof MatchRequestSchema>;

// Baris view facility_public_status (tanpa data pasien).
export const FacilityCapabilitySchema = z.object({
  code: z.enum(CAPABILITY_CODES),
  status: z.enum(CAPABILITY_STATUS),
  updated_at: z.string(),
  is_simulated: z.boolean(),
  source: z.string(),
});
export const FacilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  short_name: z.string(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  osm_id: z.string().nullable(),
  location_source: z.string(),
  location_fetched_at: z.string().nullable(),
  total_slots: z.number().int(),
  available_slots: z.number().int(),
  capacity_updated_at: z.string(),
  is_simulated: z.boolean(),
  capabilities: z.array(FacilityCapabilitySchema),
});
export type Facility = z.infer<typeof FacilitySchema>;

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResult<T> = ApiOk<T> | ApiErr;
