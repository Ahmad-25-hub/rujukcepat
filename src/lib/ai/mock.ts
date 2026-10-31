import lansiaLemas from "../../../tests/fixtures/ai/lansia-lemas.json";
import nyeriDada from "../../../tests/fixtures/ai/nyeri-dada.json";
import kecelakaan from "../../../tests/fixtures/ai/kecelakaan.json";
import persalinan from "../../../tests/fixtures/ai/persalinan.json";
import gigitanUlar from "../../../tests/fixtures/ai/gigitan-ular.json";
import tidakJelas from "../../../tests/fixtures/ai/tidak-jelas.json";

// Adapter AI SIMULASI (AI_MODE=mock). Tidak memahami audio: hasil diambil dari
// fixture sintetis berdasarkan skenario yang dipilih atau kata kunci teks.
// Keluaran tetap melewati validasi yang sama dengan mode LIVE.

export const MOCK_SCENARIOS = {
  "lansia-lemas": { label: "Lansia 70 th lemas & keringat dingin (skenario proposal)", data: lansiaLemas },
  "nyeri-dada": { label: "Nyeri dada menjalar (butuh CATH_LAB)", data: nyeriDada },
  kecelakaan: { label: "Kecelakaan motor, cedera kepala (trauma + CT)", data: kecelakaan },
  persalinan: { label: "Persalinan prematur (PONEK_NICU)", data: persalinan },
  "gigitan-ular": { label: "Gigitan ular (ANTI_BISA)", data: gigitanUlar },
  "tidak-jelas": { label: "Audio tidak jelas (uji pemulihan)", data: tidakJelas },
  rusak: { label: "Keluaran AI rusak (uji JSON tidak valid)", data: null },
} as const;
export type MockScenario = keyof typeof MOCK_SCENARIOS;

export function isMockScenario(v: unknown): v is MockScenario {
  return typeof v === "string" && v in MOCK_SCENARIOS;
}

const KEYWORDS: [RegExp, MockScenario][] = [
  [/dada|jantung/i, "nyeri-dada"],
  [/jatuh|kecelakaan|tabrak|motor|terbentur/i, "kecelakaan"],
  [/hamil|ketuban|melahirkan|persalinan|kontraksi/i, "persalinan"],
  [/ular|gigit/i, "gigitan-ular"],
  [/lemas|keringat|gula|lansia/i, "lansia-lemas"],
];

export function pickScenario(text: string | null, requested: MockScenario | null): MockScenario {
  if (requested) return requested;
  if (text) {
    for (const [re, s] of KEYWORDS) if (re.test(text)) return s;
    if (text.trim().length < 15) return "tidak-jelas";
  }
  return "lansia-lemas";
}

/** Mengembalikan teks mentah seperti respons penyedia. */
export async function mockGenerate(opts: {
  scenario: MockScenario;
  text: string | null;
  hasPhoto: boolean;
}): Promise<string> {
  await new Promise((r) => setTimeout(r, 600));
  const entry = MOCK_SCENARIOS[opts.scenario];
  if (!entry.data) return '{"report": {"transcript": "terpotong...", "summary": 42'; // JSON rusak
  const data = structuredClone(entry.data) as Record<string, unknown> & {
    report: { transcript: string };
    soap: { objective: { origin: string; value: string | null; unit: string | null }[] };
    unknowns: string[];
    input_quality: string;
  };
  if (opts.text) data.report.transcript = opts.text.slice(0, 2000);
  if (!opts.hasPhoto) {
    // Tanpa foto, tidak ada angka yang "terbaca dari foto".
    for (const o of data.soap.objective) {
      if (o.origin === "PHOTO_READING") {
        data.unknowns.push(`${(o as unknown as { label: string }).label} (tidak ada foto)`);
        o.value = null;
        o.origin = "UNKNOWN";
      }
    }
  }
  return JSON.stringify(data);
}
