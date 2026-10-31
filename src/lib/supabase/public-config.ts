// Modul ini boleh diimpor klien. Jangan tambahkan variabel rahasia server.
export function configuredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && !/[<>]/.test(trimmed) ? trimmed : null;
}

export function normalizeSupabaseUrl(value: string | undefined): string | null {
  const raw = configuredValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSupabasePublicConfig() {
  // Akses eksplisit diperlukan agar Next.js menyertakan nilai NEXT_PUBLIC_* di bundle.
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = configuredValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ?? configuredValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key || key.startsWith("sb_secret_")) return null;
  return { url, key };
}
