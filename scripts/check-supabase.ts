// Uji konfigurasi + layanan nyata tanpa mencetak kunci, laporan, atau mengubah data.
// Realtime memakai pesan teknis sementara pada kanal acak, bukan kanal rujukan.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, configuredValue } from "../src/lib/supabase/public-config";
import { getSupabaseServerConfig } from "../src/lib/supabase/server-config";
import { createSupabasePool } from "../src/lib/data/supabase-db";

try { process.loadEnvFile(".env.local"); } catch { /* env proses juga didukung */ }

async function main() {
  let ready = true;
  const settings = getSupabasePublicConfig();
  if (!settings) {
    console.error("BELUM: isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
    ready = false;
  } else {
    try {
      const response = await fetch(`${settings.url}/auth/v1/settings`, { headers: { apikey: settings.key }, signal: AbortSignal.timeout(10000) });
      console.log(`URL + kunci publik: HTTP ${response.status} ${response.ok ? "LULUS" : "GAGAL"}`);
      ready &&= response.ok;
    } catch {
      console.error("GAGAL: endpoint Supabase tidak terjangkau.");
      ready = false;
    }
  }

  if (!configuredValue(process.env.SUPABASE_DB_URL)) {
    console.log("BELUM: SUPABASE_DB_URL belum diisi; penyimpanan, migrasi, dan kuota Supabase belum diuji.");
    ready = false;
  } else {
    const pool = createSupabasePool();
    try {
      const result = await pool.query<{ hospitals: number; capacity: number }>(`select
        (select count(*)::int from public.facility_public_status) as hospitals,
        (select count(*)::int from public.hospital_capacity) as capacity`);
      await pool.query("select user_id, password_hash from public.staff_credentials limit 0");
      const permissions = await pool.query<{ n: number; unsafe: boolean }>(`select count(*)::int as n,
        coalesce(bool_or(has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE')), false) as unsafe
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('create_referral', 'transition_referral', 'update_facility', 'release_reservation', 'expire_stale_referrals')
      `);
      const hasData = result.rows[0].hospitals > 0 && result.rows[0].capacity > 0;
      console.log(`PostgreSQL + schema: LULUS (${result.rows[0].hospitals} RS). Seed: ${hasData ? "LULUS" : "BELUM"}.`);
      const safeFunctions = permissions.rows[0].n === 5 && !permissions.rows[0].unsafe;
      console.log(`Fungsi transaksi khusus server: ${safeFunctions ? "LULUS" : "GAGAL; jalankan supabase:setup"}.`);
      ready &&= hasData && safeFunctions;
    } catch {
      console.error("GAGAL: koneksi/schema PostgreSQL. Periksa SUPABASE_DB_URL lalu jalankan npm run supabase:setup.");
      ready = false;
    } finally {
      await pool.end();
    }
  }

  const serverSettings = getSupabaseServerConfig();
  let serverKeyValid = false;
  if (!serverSettings) {
    console.log("BELUM: SUPABASE_SECRET_KEY (atau SERVICE_ROLE_KEY lama) diperlukan untuk menguji broadcast server Realtime.");
    ready = false;
  } else {
    try {
      const response = await fetch(`${serverSettings.url}/rest/v1/`, {
        headers: { apikey: serverSettings.key }, signal: AbortSignal.timeout(10000),
      });
      console.log(`Secret key server: HTTP ${response.status} ${response.ok ? "LULUS" : "GAGAL (periksa key project yang sama)"}`);
      serverKeyValid = response.ok;
      ready &&= response.ok;
    } catch {
      console.error("GAGAL: verifikasi secret key server tidak terjangkau.");
      ready = false;
    }
  }

  if (!settings || !serverSettings || !serverKeyValid) {
    console.log("BELUM: uji Realtime memerlukan konfigurasi publik dan secret key server yang valid.");
    ready = false;
  } else {
    const receiver = createClient(settings.url, settings.key, { auth: { persistSession: false } });
    const sender = createClient(serverSettings.url, serverSettings.key, { auth: { persistSession: false } });
    const topic = `rc:connection-check:${randomUUID()}`;
    const channel = receiver.channel(topic);
    const outgoing = sender.channel(topic);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), 15000);
        channel.on("broadcast", { event: "check" }, (event) => {
          if (event.payload?.check === topic) resolve();
        }).subscribe((status) => {
          if (status === "SUBSCRIBED") void outgoing.httpSend("check", { check: topic }).catch(reject);
          else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) reject(new Error("REALTIME_ERROR"));
        });
      });
      console.log("Realtime server → klien (kunci publik): LULUS.");
    } catch {
      console.error("GAGAL: broadcast Realtime. Periksa secret key dan pengaturan kanal publik Realtime.");
      ready = false;
    } finally {
      clearTimeout(timer);
      await Promise.allSettled([receiver.removeAllChannels(), sender.removeAllChannels()]);
      receiver.realtime.disconnect();
      sender.realtime.disconnect();
    }
  }
  console.log(`Mode aplikasi: ${process.env.DATA_MODE === "supabase" ? "SUPABASE" : "LOKAL (belum dialihkan)"}.`);
  console.log(ready ? "Koneksi layanan Supabase siap. Uji alur dua sesi tetap diperlukan." : "Koneksi Supabase belum lengkap; lihat bagian BELUM/GAGAL di atas.");
  if (!ready) process.exitCode = 1;
}

main().catch(() => {
  console.error("Pemeriksaan gagal. Periksa format konfigurasi Supabase; nilai rahasia tidak dicetak.");
  process.exitCode = 1;
});
