import { connection } from "next/server";
import { config } from "@/lib/config";
import { MOCK_SCENARIOS } from "@/lib/ai/mock";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

// Mode layanan yang sedang aktif, agar UI dapat menampilkan badge simulasi.
export async function GET() {
  await connection();
  return ok({
    ai_mode: config.aiMode === "mock" ? "MOCK" : "LIVE",
    ai_model: config.aiMode === "mock" ? null : config.geminiModel,
    ai_configured: config.aiMode === "mock" || Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("<")),
    routing_mode: config.routingMode === "mock" ? "MOCK" : "LIVE",
    data_mode: config.dataMode === "supabase" ? "SUPABASE" : "LOCAL",
    stale_after_minutes: config.staleAfterMinutes,
    mock_scenarios:
      config.aiMode === "mock"
        ? Object.entries(MOCK_SCENARIOS).map(([id, s]) => ({ id, label: s.label }))
        : [],
    server_time: new Date().toISOString(),
  });
}
