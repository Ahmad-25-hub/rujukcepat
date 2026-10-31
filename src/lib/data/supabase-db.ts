import "server-only";
import { Pool } from "pg";
import { configuredValue } from "../supabase/public-config";

/** SQL hanya dari server. Publishable key bukan kata sandi PostgreSQL. */
export function createSupabasePool() {
  const connectionString = configuredValue(process.env.SUPABASE_DB_URL);
  if (!connectionString) throw new Error("SUPABASE_DB_URL_MISSING");
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_DB_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.password) throw new Error("SUPABASE_DB_URL_INVALID");
  // pg mengutamakan parameter SSL di URL; gunakan kebijakan SSL eksplisit di bawah.
  for (const name of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(name);
  return new Pool({
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    // SSL require, sesuai koneksi sebelumnya. CA opsional mengaktifkan verifikasi sertifikat.
    ssl: process.env.SUPABASE_DB_CA_CERT
      ? { ca: process.env.SUPABASE_DB_CA_CERT.replace(/\\n/g, "\n"), rejectUnauthorized: true }
      : { rejectUnauthorized: false },
  });
}
