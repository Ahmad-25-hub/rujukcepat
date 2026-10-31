// Satu sumber enum untuk server, UI, migrasi, seed, dan pengujian.
// Dicerminkan sebagai enum Postgres di supabase/migrations/0001_init.sql.

export const CAPABILITY_CODES = [
  "IGD_DASAR",
  "CATH_LAB",
  "CT_SCAN",
  "ICU_VENTILATOR",
  "PONEK_NICU",
  "TRAUMA_BEDAH",
  "HEMODIALISA",
  "ANTI_BISA",
] as const;
export type CapabilityCode = (typeof CAPABILITY_CODES)[number];

export const CAPABILITY_LABELS: Record<CapabilityCode, string> = {
  IGD_DASAR: "Layanan IGD dasar",
  CATH_LAB: "Laboratorium kateterisasi jantung",
  CT_SCAN: "Pemeriksaan CT scan",
  ICU_VENTILATOR: "Perawatan intensif dengan ventilator",
  PONEK_NICU: "Obstetri neonatal emergensi & NICU",
  TRAUMA_BEDAH: "Penanganan trauma & bedah",
  HEMODIALISA: "Layanan hemodialisis",
  ANTI_BISA: "Layanan antibisa",
};

// null pada urgensi berarti "Perlu peninjauan".
export const URGENCY = ["MERAH", "KUNING", "HIJAU"] as const;
export type Urgency = (typeof URGENCY)[number];

export const CAPABILITY_STATUS = ["READY", "PENUH", "MAINTENANCE"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUS)[number];

export const DATA_ORIGIN = [
  "USER_STATEMENT",
  "PHOTO_READING",
  "AI_INTERPRETATION",
  "UNKNOWN",
] as const;
export type DataOrigin = (typeof DATA_ORIGIN)[number];

export const DATA_ORIGIN_LABELS: Record<DataOrigin, string> = {
  USER_STATEMENT: "Anda katakan",
  PHOTO_READING: "Terbaca dari foto",
  AI_INTERPRETATION: "Perkiraan AI",
  UNKNOWN: "Tidak diketahui",
};

export const INPUT_QUALITY = ["OK", "AUDIO_TIDAK_JELAS", "FOTO_TIDAK_TERBACA"] as const;
export type InputQuality = (typeof INPUT_QUALITY)[number];

export function isCapabilityCode(v: string): v is CapabilityCode {
  return (CAPABILITY_CODES as readonly string[]).includes(v);
}
