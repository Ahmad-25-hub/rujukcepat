// Pengukuran skenario inti terhadap server yang sedang berjalan (T16). Data sintetis saja.
//   npm run dev   (atau npm run build && npm start)  lalu, di terminal lain:
//   BASE_URL=http://localhost:3000 DEMO_STAFF_PASSWORD=... RUNS=5 npm run measure
//   AUDIO=1  -> kirim tests/fixtures/audio/lansia-lemas-sintetis.wav (bukan teks)
//   PHOTO=1  -> sertakan tests/fixtures/photo/glukometer-46-sintetis.jpg
// Mengukur dua "sesi" (pelapor dan petugas) lewat HTTP + SSE. Hasil dicetak sebagai tabel dan
// ditulis ke docs/hasil-ukur-<mode>.json. Mode MOCK dan LIVE dipisahkan; jangan dicampur dalam klaim.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(process.env.RUNS) || 5;
const PASSWORD = process.env.DEMO_STAFF_PASSWORD || "";
const SENEN = { lat: -6.177, lng: 106.842 };
const RSCM = "00000000-0000-4000-8000-000000000001";
const TARAKAN = "00000000-0000-4000-8000-000000000003";

type Jar = { cookie: string };
const jar = (): Jar => ({ cookie: "" });
const ms = (t0: number) => Math.round(performance.now() - t0);

async function call(j: Jar, p: string, init: RequestInit = {}) {
  const res = await fetch(BASE + p, { ...init, headers: { ...(init.headers as Record<string, string>), ...(j.cookie ? { cookie: j.cookie } : {}) } });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) {
    const jarMap = new Map(j.cookie.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
    for (const s of set) {
      const kv = s.split(";")[0];
      jarMap.set(kv.split("=")[0], kv);
    }
    j.cookie = [...jarMap.values()].join("; ");
  }
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}
const postJson = (j: Jar, p: string, data: unknown, headers: Record<string, string> = {}) =>
  call(j, p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(data) });

/** Buka SSE dan catat waktu terima tiap event "change". */
function openStream(j: Jar) {
  const events: { recvAt: number; at: number; type: string; referral_id: string | null }[] = [];
  const ctrl = new AbortController();
  let ready: () => void = () => {};
  const hello = new Promise<void>((r) => (ready = r));
  void (async () => {
    const res = await fetch(BASE + "/api/stream", { headers: { cookie: j.cookie }, signal: ctrl.signal });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (block.includes("event: hello")) ready();
        if (block.includes("event: change")) {
          const data = JSON.parse(block.split("\n").find((l) => l.startsWith("data: "))!.slice(6));
          events.push({ recvAt: Date.now(), at: data.at, type: data.type, referral_id: data.referral_id });
        }
      }
    }
  })().catch(() => undefined);
  return { events, hello, close: () => ctrl.abort() };
}

const waitFor = async (cond: () => boolean, timeoutMs = 3000) => {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, 2));
  }
  return true;
};
const stats = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: a.length, min: s[0], median: q(0.5), p95: q(0.95), max: s[s.length - 1] };
};

async function main() {
  if (!PASSWORD) throw new Error("Set DEMO_STAFF_PASSWORD (kata sandi akun demo) untuk mengukur sisi petugas.");
  const st = (await call(jar(), "/api/status")).body.data;
  const mode = st.ai_mode === "MOCK" ? "MOCK" : "LIVE";
  console.log(`Server ${BASE} | AI ${st.ai_mode}${st.ai_model ? ` (${st.ai_model})` : ""} | rute ${st.routing_mode} | data ${st.data_mode}`);

  const staff = jar();
  const login = await postJson(staff, "/api/staff/login", { email: "rscm@rujukcepat.demo", password: PASSWORD });
  if (login.status !== 200) throw new Error(`Login petugas gagal: ${login.body?.error?.message}`);
  const admin = jar();
  await postJson(admin, "/api/staff/login", { email: "admin@rujukcepat.demo", password: PASSWORD });
  await postJson(admin, "/api/demo/reset", { confirm: "RESET" });

  const useAudio = process.env.AUDIO === "1";
  const usePhoto = process.env.PHOTO === "1";
  const audioFile = path.resolve("tests/fixtures/audio/lansia-lemas-sintetis.wav");
  const photoFile = path.resolve("tests/fixtures/photo/glukometer-46-sintetis.jpg");
  const audioBytes = useAudio ? readFileSync(audioFile) : null;
  const photoBytes = usePhoto ? readFileSync(photoFile) : null;

  const staffStream = openStream(staff);
  await staffStream.hello;

  const rows: Record<string, number | string | null>[] = [];
  const failures: string[] = [];

  for (let i = 1; i <= RUNS; i++) {
    const rep = jar();
    const tStart = performance.now();

    // 1) unggah + analisis
    const fd = new FormData();
    fd.set("consent", "true");
    if (audioBytes) fd.set("audio", new Blob([new Uint8Array(audioBytes)], { type: "audio/wav" }), "laporan.wav");
    else fd.set("text", "Ayah saya 70 tahun tiba-tiba lemas dan keringat dingin sejak 30 menit lalu, masih bisa bicara tapi bingung.");
    if (photoBytes) fd.set("photo", new Blob([new Uint8Array(photoBytes)], { type: "image/jpeg" }), "foto.jpg");
    const tA = performance.now();
    const an = await call(rep, "/api/analyze", { method: "POST", body: fd });
    const analyzeTotal = ms(tA);
    if (an.status !== 200) {
      failures.push(`run ${i}: analisis ${an.status} ${an.body?.error?.code ?? ""}`);
      continue;
    }
    const providerMs = Math.round(an.body.data.timing.provider_ms);
    const ai = an.body.data;

    // 2) pencocokan
    const tM = performance.now();
    const mt = await postJson(rep, "/api/match", { needs: ai.result.needs, location: SENEN, location_source: "MANUAL" });
    const matchMs = ms(tM);
    const target = mt.body?.data?.primary?.facility_id ?? RSCM;
    if (target !== RSCM) failures.push(`run ${i}: kandidat utama ${mt.body?.data?.primary?.short_name} (bukan RSCM); rujukan tetap dikirim ke RSCM untuk pengukuran`);

    // 3) kirim rujukan; ukur sampai dashboard menerima event
    const nBefore = staffStream.events.length;
    const tS = performance.now();
    const tSendWall = Date.now();
    const sent = await postJson(
      rep,
      "/api/referrals",
      { hospital_id: RSCM, ai_result: ai.result, needs: ai.result.needs, location: SENEN, location_source: "MANUAL" },
      { "idempotency-key": crypto.randomUUID() },
    );
    const sendMs = ms(tS);
    if (sent.status !== 201) {
      failures.push(`run ${i}: kirim ${sent.status} ${sent.body?.error?.code ?? ""}`);
      continue;
    }
    const id = sent.body.data.referral.id as string;
    // Pelapor memperoleh cookie sesi saat mengirim; seperti portal, aliran event dibuka setelahnya.
    const repStream = openStream(rep);
    await repStream.hello;
    const gotAlert = await waitFor(() => staffStream.events.slice(nBefore).some((e) => e.type === "referral" && e.referral_id === id));
    const alertEv = staffStream.events.slice(nBefore).find((e) => e.type === "referral" && e.referral_id === id);
    const sendToAlertMs = gotAlert && alertEv ? alertEv.recvAt - tSendWall : null;
    const syncAlertMs = alertEv ? Math.max(0, alertEv.recvAt - alertEv.at) : null;
    const koordinasiMachineMs = ms(tStart) - 0; // analisis + pencocokan + kirim (tanpa waktu manusia meninjau/memilih)

    // 4) petugas menerima; ukur interaksi dan sinkron ke pelapor
    const nRep = repStream.events.length;
    const tD = performance.now();
    const tDecWall = Date.now();
    const dec = await postJson(staff, `/api/referrals/${id}/decision`, { action: "ACCEPT" });
    const decisionMs = ms(tD);
    if (dec.status !== 200) failures.push(`run ${i}: keputusan ${dec.status} ${dec.body?.error?.code ?? ""}`);
    const gotRep = await waitFor(() => repStream.events.slice(nRep).some((e) => e.type === "referral" && e.referral_id === id));
    const repEv = repStream.events.slice(nRep).find((e) => e.type === "referral" && e.referral_id === id);
    const decToPortalMs = gotRep && repEv ? repEv.recvAt - tDecWall : null;
    const syncPortalMs = repEv ? Math.max(0, repEv.recvAt - repEv.at) : null;
    const portalView = await call(rep, `/api/referrals/${id}`);

    rows.push({
      run: i,
      analisis_total_ms: analyzeTotal,
      analisis_penyedia_ms: providerMs,
      pencocokan_ms: matchMs,
      kirim_rujukan_ms: sendMs,
      koordinasi_mesin_ms: koordinasiMachineMs,
      kirim_ke_alert_dashboard_ms: sendToAlertMs,
      sinkron_ke_dashboard_ms: syncAlertMs,
      keputusan_petugas_ms: decisionMs,
      keputusan_ke_portal_ms: decToPortalMs,
      sinkron_ke_portal_ms: syncPortalMs,
      status_portal: portalView.body?.data?.referral?.status ?? "?",
      reservasi_portal: portalView.body?.data?.referral?.reservation_status ?? "?",
    });
    repStream.close();
    // Lepas kuota agar percobaan berikutnya tidak terhalang kapasitas simulasi (REVOKE melepas reservasi).
    await postJson(staff, `/api/referrals/${id}/decision`, { action: "REVOKE", note: "selesai pengukuran" });
  }

  // AC-07 pada server berjalan: dua pelapor berbeda memperebutkan satu kuota (Tarakan = 1).
  await postJson(admin, "/api/demo/reset", { confirm: "RESET" });
  const fdT = new FormData();
  fdT.set("consent", "true");
  fdT.set("text", "Kecelakaan motor, terbentur kepala");
  const aiT = (await call(jar(), "/api/analyze", { method: "POST", body: fdT })).body?.data;
  let race = "dilewati (analisis gagal)";
  if (aiT) {
    const [a, b] = [jar(), jar()];
    const body = { hospital_id: TARAKAN, ai_result: aiT.result, needs: [{ code: "IGD_DASAR", required: true, reason: "uji" }], location: SENEN, location_source: "MANUAL" };
    const rs = await Promise.all([a, b].map((j) => postJson(j, "/api/referrals", body, { "idempotency-key": crypto.randomUUID() })));
    const codes = rs.map((r) => r.status).sort();
    const fac = (await call(jar(), "/api/facilities")).body.data.facilities.find((f: { id: string }) => f.id === TARAKAN);
    race = `status ${codes.join("/")} | kuota Tarakan sesudah = ${fac.available_slots}`;
    if (!(codes[0] === 201 && codes[1] === 409 && fac.available_slots === 0)) failures.push(`AC-07: hasil tidak sesuai harapan (${race})`);
  }
  await postJson(admin, "/api/demo/reset", { confirm: "RESET" });
  staffStream.close();

  const col = (k: string) => rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  const summary = Object.fromEntries(
    ["analisis_total_ms", "analisis_penyedia_ms", "pencocokan_ms", "kirim_rujukan_ms", "koordinasi_mesin_ms", "kirim_ke_alert_dashboard_ms", "sinkron_ke_dashboard_ms", "keputusan_petugas_ms", "keputusan_ke_portal_ms", "sinkron_ke_portal_ms"].map((k) => [k, col(k).length ? stats(col(k)) : null]),
  );
  const result = {
    waktu: new Date().toISOString(),
    server: BASE,
    mode_ai: st.ai_mode,
    model: st.ai_model,
    mode_rute: st.routing_mode,
    mode_data: st.data_mode,
    perangkat: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0]?.model ?? "cpu"}, Node ${process.version}`,
    jaringan: BASE.includes("localhost") ? "loopback (localhost)" : "jaringan lain (isi manual)",
    masukan: { jenis: useAudio ? "AUDIO wav" : "TEKS", audio_bytes: audioBytes?.length ?? null, foto_bytes: photoBytes?.length ?? null },
    percobaan: RUNS,
    berhasil: rows.length,
    ac07_balapan_kuota: race,
    kegagalan: failures,
    ringkasan: summary,
    baris: rows,
  };
  mkdirSync("docs", { recursive: true });
  const file = path.join("docs", `hasil-ukur-${mode.toLowerCase()}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));
  console.table(rows);
  console.log("\nRingkasan (ms):");
  console.table(summary);
  console.log("AC-07 (balapan satu kuota):", race);
  if (failures.length) console.log("Kegagalan/catatan:\n - " + failures.join("\n - "));
  console.log(`\nHasil ditulis ke ${file} (mode ${mode}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
