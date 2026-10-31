import "server-only";
import { configuredValue, normalizeSupabaseUrl } from "./public-config";

export function getSupabaseServerConfig() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = configuredValue(process.env.SUPABASE_SECRET_KEY)
    ?? configuredValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return url && key ? { url, key } : null;
}
