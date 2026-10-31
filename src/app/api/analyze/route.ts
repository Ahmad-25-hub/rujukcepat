import { analyzeReport, AnalyzeError } from "@/lib/ai/analyze";
import { isMockScenario } from "@/lib/ai/mock";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

const AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac"];
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AUDIO = 1.5 * 1024 * 1024;
const MAX_PHOTO = 1.5 * 1024 * 1024;
const MAX_TEXT = 2000;

function baseType(t: string) {
  return t.split(";")[0].trim().toLowerCase();
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("BAD_REQUEST", "Format unggahan tidak valid (harus multipart/form-data).");
  }
  if (form.get("consent") !== "true") {
    return fail("CONSENT_REQUIRED", "Persetujuan pemrosesan audio/foto diperlukan sebelum mengunggah.");
  }

  const audioFile = form.get("audio");
  const photoFile = form.get("photo");
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

  let photo = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    const type = baseType(photoFile.type);
    if (!PHOTO_TYPES.includes(type)) return fail("UNSUPPORTED_PHOTO", "Foto harus JPEG, PNG, atau WebP.", 415);
    if (photoFile.size > MAX_PHOTO) return fail("PHOTO_TOO_LARGE", "Foto terlalu besar (maks 1,5 MB setelah kompresi).", 413);
    photo = { mimeType: type, data: Buffer.from(await photoFile.arrayBuffer()) };
  }

  const scenario = form.get("mock_scenario");
  try {
    const data = await analyzeReport({
      audio,
      photo,
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
