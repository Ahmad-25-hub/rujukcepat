import { analyzeReport, AnalyzeError } from "@/lib/ai/analyze";
import { isMockScenario } from "@/lib/ai/mock";
import { fail, ok } from "@/lib/http";
import { allow, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac"];
const MAX_AUDIO = 1.5 * 1024 * 1024;
const MAX_TEXT = 2000;

function baseType(t: string) {
  return t.split(";")[0].trim().toLowerCase();
}

// Batas pemakaian per klien untuk melindungi kuota layanan AI gratis.
const ANALYZE_MAX_PER_MINUTE = Number(process.env.ANALYZE_RATE_PER_MINUTE) || 12;

export async function POST(request: Request) {
  const rate = allow(`analyze:${clientKey(request)}`, ANALYZE_MAX_PER_MINUTE, 60_000);
  if (!rate.ok) {
    return fail("RATE_LIMITED", `Terlalu banyak permintaan analisis. Coba lagi dalam ${rate.retryAfterSec} detik.`, 429);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("BAD_REQUEST", "Format unggahan tidak valid (harus multipart/form-data).");
  }
  if (form.get("consent") !== "true") {
    return fail("CONSENT_REQUIRED", "Persetujuan pemrosesan laporan diperlukan sebelum mengunggah.");
  }

  const audioFile = form.get("audio");
  const textRaw = form.get("text");
  const text = typeof textRaw === "string" && textRaw.trim() ? textRaw.trim() : null;

  let audio = null;
  if (audioFile instanceof File && audioFile.size > 0) {
    const type = baseType(audioFile.type);
    if (!AUDIO_TYPES.includes(type)) return fail("UNSUPPORTED_AUDIO", `Format audio ${type || "tidak dikenal"} tidak didukung.`, 415);
    if (audioFile.size > MAX_AUDIO) return fail("AUDIO_TOO_LARGE", "Rekaman terlalu besar (maks 1,5 MB / ±30 detik).", 413);
    audio = { mimeType: type === "audio/x-wav" ? "audio/wav" : type, data: Buffer.from(await audioFile.arrayBuffer()) };
  }
  if (!audio && !text) return fail("NO_INPUT", "Kirim rekaman suara atau laporan tertulis.");
  if (text && text.length > MAX_TEXT) return fail("TEXT_TOO_LONG", "Laporan tertulis maksimal 2000 karakter.", 413);

  const scenario = form.get("mock_scenario");
  try {
    const data = await analyzeReport({
      audio,
      text,
      mockScenario: isMockScenario(scenario) ? scenario : null,
      signal: request.signal,
    });
    return ok(data);
  } catch (e) {
    if (e instanceof AnalyzeError) {
      console.warn("[analyze] gagal", e.code);
      return fail(e.code, e.message, e.status);
    }
    console.error("[analyze] error tak terduga", e instanceof Error ? e.name : "unknown");
    return fail("INTERNAL", "Terjadi kesalahan server saat memproses laporan. Silakan coba lagi.", 500);
  }
}
