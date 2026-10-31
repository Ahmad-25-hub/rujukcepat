import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicConfig, normalizeSupabaseUrl } from "@/lib/supabase/public-config";
import { getSupabaseServerConfig } from "@/lib/supabase/server-config";
import { createSupabasePool } from "@/lib/data/supabase-db";

afterEach(() => vi.unstubAllEnvs());

describe("konfigurasi Supabase", () => {
  it("memakai publishable key ketika anon key masih placeholder", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_uji");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "<anon-key>");
    expect(getSupabasePublicConfig()).toEqual({ url: "https://demo.supabase.co", key: "sb_publishable_uji" });
  });

  it("proyek lama masih dapat memakai anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co/");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "<publishable-key>");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-uji");
    expect(getSupabasePublicConfig()?.key).toBe("anon-uji");
  });

  it("menolak URL tidak valid, placeholder, dan secret key pada konfigurasi publik", () => {
    expect(normalizeSupabaseUrl("https://<project>.supabase.co")).toBeNull();
    expect(normalizeSupabaseUrl("https://user:password@demo.supabase.co")).toBeNull();
    expect(normalizeSupabaseUrl("https://demo.supabase.co/invalid")).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_uji");
    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("server mendukung secret key baru serta service role lama", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_uji");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-uji");
    expect(getSupabaseServerConfig()?.key).toBe("sb_secret_uji");
    vi.stubEnv("SUPABASE_SECRET_KEY", "<secret-key>");
    expect(getSupabaseServerConfig()?.key).toBe("legacy-uji");
  });

  it("tidak beralih diam-diam ke database lokal saat connection string belum diisi", () => {
    vi.stubEnv("SUPABASE_DB_URL", "<postgres-connection-string>");
    expect(() => createSupabasePool()).toThrow("SUPABASE_DB_URL_MISSING");
    vi.stubEnv("SUPABASE_DB_URL", "https://demo.supabase.co");
    expect(() => createSupabasePool()).toThrow("SUPABASE_DB_URL_INVALID");
  });
});
