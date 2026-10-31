import "server-only";
import type { ThinkingLevel } from "@google/genai";

// Konfigurasi server dari environment variable (lihat .env.example).

function int(name: string, fallback: number) {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  dataMode: (process.env.DATA_MODE === "supabase" ? "supabase" : "local") as "local" | "supabase",
  aiMode: (process.env.AI_MODE === "mock" ? "mock" : "live") as "live" | "mock",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  // LOW menjaga latensi ±3 dtk; MINIMAL tidak didukung model 3.x flash.
  geminiThinkingLevel: (["LOW", "MEDIUM", "HIGH"].includes(process.env.GEMINI_THINKING_LEVEL ?? "")
    ? process.env.GEMINI_THINKING_LEVEL
    : "LOW") as ThinkingLevel,
  geminiTimeoutMs: int("GEMINI_TIMEOUT_MS", 20000),
  routingMode: (process.env.ROUTING_MODE === "mock" ? "mock" : "live") as "live" | "mock",
  osrmBaseUrl: (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(/\/$/, ""),
  routingTimeoutMs: int("ROUTING_TIMEOUT_MS", 4000),
  matchMaxRouted: int("MATCH_MAX_ROUTED", 5),
  // Radius garis lurus dari pasien; RS di luar radius tidak dinilai (mis. Jakarta vs Jawa Timur).
  matchMaxKm: int("MATCH_MAX_KM", 100),
  staleAfterMinutes: int("STALE_AFTER_MINUTES", 43200),
};
