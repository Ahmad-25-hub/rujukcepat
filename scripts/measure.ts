// Pengukuran skenario inti terhadap server yang sedang berjalan (T16). Data sintetis saja.
//   npm run dev   (atau npm run build && npm start)  lalu, di terminal lain:
//   BASE_URL=http://localhost:3000 DEMO_STAFF_PASSWORD=... RUNS=5 npm run measure
//   AUDIO=1  -> kirim tests/fixtures/audio/lansia-lemas-sintetis.wav (bukan teks)
//   PHOTO=1  -> sertakan tests/fixtures/photo/glukometer-46-sintetis.jpg
// Alur: pelapor (analisis -> rekomendasi -> rute) dan petugas (ubah kuota -> portal menerima event SSE).
// Portal hanya merekomendasikan; tidak ada pengiriman rujukan. Hasil dicetak sebagai tabel dan
// ditulis ke docs/hasil-ukur-<mode>.json. Mode MOCK dan LIVE dipisahkan; jangan dicampur dalam klaim.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const RUNS = Number(process.env.RUNS) || 5;
const PASSWORD = process.env.DEMO_STAFF_PASSWORD || "";
const SENEN = { lat: -6.177, lng: 106.842 };
const RSCM = "00000000-0000-4000-8000-000000000001";

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
const sendJson = (j: Jar, method: string, p: string, data: unknown) =>
  call(j, p, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

/** Buka SSE dan catat waktu terima tiap event "change". */
function openStream(j: Jar) {
  const events: { recvAt: number; at: number; type: string; hospital_id: string }[] = [];
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
          events.push({ recvAt: Date.now(), at: data.at, type: data.type, hospital_id: data.hospital_id });
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
const slotsOf = async (id: string) =>
  (await call(jar(), "/api/facilities")).body.data.facilities.find((f: { id: string }) => f.id === id) as { available_slots: number; total_slots: number };

async function main() {
  if (!PASSWORD) throw new Error("Set DEMO_STAFF_PASSWORD (kata sandi akun demo) untuk mengukur sisi petugas.");
  const st = (await call(jar(), "/api/status")).body.data;
  const mode = st.ai_mode === "MOCK" ? "MOCK" : "LIVE";
  console.log(`Server ${BASE} | AI ${st.ai_mode}${st.ai_model ? ` (${st.ai_model})` : ""} | rute ${st.routing_mode} | data ${st.data_mode}`);

  const staff = jar();
  const login = await sendJson(staff, "POST", "/api/staff/login", { email: "rscm@rujukcepat.demo", password: PASSWORD });
  if (login.status !== 200) throw new Error(`Login petugas gagal: ${login.body?.error?.message}`);
  const admin = jar();
  await sendJson(admin, "POST", "/api/staff/login", { email: "admin@rujukcepat.demo", password: PASSWORD });
  await sendJson(admin, "POST", "/api/demo/reset", { confirm: "RESET" });

  const useAudio = process.env.AUDIO === "1";
  const usePhoto = process.env.PHOTO === "1";
  const audioFile = path.resolve("tests/fixtures/audio/lansia-lemas-sintetis.wav");
  const photoFile = path.resolve("tests/fixtures/photo/glukometer-46-sintetis.jpg");
  const audioBytes = useAudio ? readFileSync(audioFile) : null;
  const photoBytes = usePhoto ? readFileSync(photoFile) : null;

  // Portal pelapor mendengarkan perubahan fasilitas (data publik) seperti di browser.
  const portalStream = openStream(jar());
  await portalStream.hello;

  const rows: Record<string, number | string | null>[] = [];
  const failures: string[] = [];
  const before = await slotsOf(RSCM);

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

    // 2) rekomendasi RS
    const tM = performance.now();
    const mt = await sendJson(rep, "POST", "/api/match", { needs: ai.result.needs, location: SENEN, location_source: "MANUAL" });
    const matchMs = ms(tM);
    const primary = mt.body?.data?.primary as { facility_id: string; short_name: string } | null;
    if (!primary) {
      failures.push(`run ${i}: tidak ada kandidat (${mt.body?.data?.no_candidate_reason ?? mt.status})`);
      continue;
    }

    // 3) rute ke kandidat utama (layar navigasi)
    const tR = performance.now();
    const rt = await call(rep, `/api/route?lat=${SENEN.lat}&lng=${SENEN.lng}&hospital_id=${primary.facility_id}`);
    const routeMs = ms(tR);
    if (rt.status !== 200) failures.push(`run ${i}: rute ${rt.status} ${rt.body?.error?.code ?? ""}`);
    const koordinasiMachineMs = ms(tStart); // analisis + rekomendasi + rute (tanpa waktu manusia meninjau/memilih)

    // 4) petugas mengubah kuota; ukur interaksi dan sinkron ke portal
    const nPortal = portalStream.events.length;
    const tP = performance.now();
    const tPatchWall = Date.now();
    const avail = i % 2 === 0 ? before.available_slots : Math.max(0, before.available_slots - 1);
    const patch = await sendJson(staff, "PATCH", `/api/facilities/${RSCM}`, { available_slots: avail });
    const patchMs = ms(tP);
    if (patch.status !== 200) failures.push(`run ${i}: ubah kuota ${patch.status} ${patch.body?.error?.code ?? ""}`);
    const got = await waitFor(() => portalStream.events.slice(nPortal).some((e) => e.hospital_id === RSCM));
    const ev = portalStream.events.slice(nPortal).find((e) => e.hospital_id === RSCM);
    const patchToPortalMs = got && ev ? ev.recvAt - tPatchWall : null;
    const syncPortalMs = ev ? Math.max(0, ev.recvAt - ev.at) : null;

    rows.push({
      run: i,
      kandidat_utama: primary.short_name,
      analisis_total_ms: analyzeTotal,
      analisis_penyedia_ms: providerMs,
      rekomendasi_ms: matchMs,
      rute_ms: routeMs,
      koordinasi_mesin_ms: koordinasiMachineMs,
      ubah_kuota_petugas_ms: patchMs,
      ubah_kuota_ke_portal_ms: patchToPortalMs,
      sinkron_ke_portal_ms: syncPortalMs,
    });
  }

  // Rekomendasi tidak boleh mengurangi kuota: bandingkan sebelum/sesudah tanpa perubahan petugas.
  await sendJson(staff, "PATCH", `/api/facilities/${RSCM}`, { available_slots: before.available_slots });
  const s0 = await slotsOf(RSCM);
  for (let k = 0; k < 3; k++) await sendJson(jar(), "POST", "/api/match", { needs: [{ code: "IGD_DASAR", required: true, reason: "uji" }], location: SENEN, location_source: "MANUAL" });
  const s1 = await slotsOf(RSCM);
  const kuotaTetap = `RSCM ${s0.available_slots}/${s0.total_slots} -> ${s1.available_slots}/${s1.total_slots} setelah 3 rekomendasi`;
  if (s0.available_slots !== s1.available_slots) failures.push(`kuota berubah tanpa tindakan petugas (${kuotaTetap})`);

  await sendJson(admin, "POST", "/api/demo/reset", { confirm: "RESET" });
  portalStream.close();

  const col = (k: string) => rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  const summary = Object.fromEntries(
    ["analisis_total_ms", "analisis_penyedia_ms", "rekomendasi_ms", "rute_ms", "koordinasi_mesin_ms", "ubah_kuota_petugas_ms", "ubah_kuota_ke_portal_ms", "sinkron_ke_portal_ms"].map((k) => [
      k,
      col(k).length ? stats(col(k)) : null,
    ]),
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
    kuota_tanpa_tindakan_petugas: kuotaTetap,
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
  console.log("Kuota tanpa tindakan petugas:", kuotaTetap);
  if (failures.length) console.log("Kegagalan/catatan:\n - " + failures.join("\n - "));
  console.log(`\nHasil ditulis ke ${file} (mode ${mode}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
