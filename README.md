# RujukCepat

PWA demo koordinasi rujukan prarumah sakit DKI Jakarta — tim TwinTech, Universitas Negeri Jakarta, INCEPTION 2026.

Alur utama: laporan suara/teks → ringkasan AI terstruktur (SOAP, urgensi, kebutuhan) → pencocokan kapabilitas IGD → kirim permintaan rujukan → notifikasi dashboard IGD → konfirmasi petugas → status terbarui di portal.

> **Semua data kapasitas, kesiapan layanan, dan pasien adalah SIMULASI.** Lokasi rumah sakit dari OpenStreetMap tidak membuktikan kemitraan, kesiapan, atau penerimaan pasien. Ringkasan AI adalah perkiraan awal untuk koordinasi, **bukan diagnosis**; keputusan klinis dan penerimaan tetap pada tenaga kesehatan. Hasil uji kode tidak sama dengan validasi klinis.

## Status (31-10-2026)

| Bagian | Status |
| --- | --- |
| P0: portal → AI → pencocokan → rujukan → dashboard → konfirmasi → status portal | Berfungsi pada dua tampilan (mode data lokal). Lihat "Hasil pengujian". |
| P1: foto opsional, panduan suara (TTS), alarm dashboard, PWA, aksesibilitas | Diimplementasikan; kekurangan uji perangkat nyata dicatat di bawah. |
| Demo publik (Vercel/Supabase), video, pitch deck, tag `submission-24h`, Devpost | **Belum dilakukan** (butuh otorisasi/kredensial pengguna). Bahan pendukung ada di `docs/`. |

Rincian per tugas dan bukti ada di [TASK.md](TASK.md); rancangan teknis di [SPEC.md](SPEC.md).

## Menjalankan lokal

Prasyarat: Node.js 20+ (diuji Node 22) dan npm.

```bash
npm install
cp .env.example .env.local   # lalu isi sesuai tabel di bawah
npm run dev                  # http://localhost:3000
```

Konfigurasi minimum **tanpa layanan eksternal** (semua mock, data lokal):

```ini
DATA_MODE=local
AI_MODE=mock
ROUTING_MODE=mock
SESSION_SECRET=isi-string-acak
DEMO_STAFF_PASSWORD=pilih-kata-sandi-demo
```

Untuk AI sungguhan: `AI_MODE=live` + `GEMINI_API_KEY` (cek dengan `npm run check:gemini`). Untuk rute sungguhan: `ROUTING_MODE=live` (OSRM publik, tanpa kunci).

- Portal ponsel: `/` dan `/lapor`. Dashboard petugas: `/dashboard` (login di `/dashboard/login`).
- Mikrofon, kamera, dan GPS memerlukan HTTPS atau `localhost`.

### Variabel environment

| Variabel | Keterangan |
| --- | --- |
| `DATA_MODE` | `local` (PGlite di `.data/pglite`, migrasi + seed otomatis) atau `supabase` (lihat bagian Supabase). |
| `AI_MODE` / `GEMINI_API_KEY` / `GEMINI_MODEL` | `mock` memakai fixture sintetis (badge "AI simulasi"); `live` memanggil Gemini dari server. Model terverifikasi 31-10-2026: `gemini-3.5-flash` (`gemini-2.5-flash` ditolak 404 untuk pengguna baru). |
| `ROUTING_MODE` / `OSRM_BASE_URL` | `mock` = ETA simulasi dari jarak garis lurus (badge "Rute simulasi"); `live` = OSRM publik. |
| `SESSION_SECRET` | Penanda tangan cookie sesi petugas. **Wajib** di produksi. |
| `DEMO_STAFF_PASSWORD` | Kata sandi semua akun petugas demo. Tidak ada kata sandi di repo; tanpa ini login petugas nonaktif. |
| `REFERRAL_PENDING_TTL_SECONDS` | Masa tunggu `PENDING` sebelum `EXPIRED` (bawaan 600 dtk). |
| `STALE_AFTER_MINUTES` | Status fasilitas lebih tua dari ini dianggap kedaluwarsa, bukan READY (bawaan 1440). |
| `ANALYZE_RATE_PER_MINUTE`, `LOGIN_RATE_PER_MINUTE` | Pembatas laju per klien (bawaan 12 dan 10). |
| `SUPABASE_DB_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mode Supabase; key `ANON_KEY`/`SERVICE_ROLE_KEY` lama juga didukung. Rahasia hanya dibaca server. |

Daftar lengkap: [.env.example](.env.example). **Jangan commit `.env.local`.**

### Akun petugas demo

Satu akun per RS contoh, semuanya memakai `DEMO_STAFF_PASSWORD`:

| Email | Akses |
| --- | --- |
| `rscm@rujukcepat.demo`, `fatmawati@…`, `tarakan@…`, `pasarminggu@…`, `pon@…` (`@rujukcepat.demo`) | Hanya melihat/mengubah rujukan dan fasilitas RS-nya sendiri. |
| `admin@rujukcepat.demo` | Petugas RSCM + boleh mereset data demo. |

Akun dibuat/disinkronkan otomatis saat login pertama dari `DEMO_STAFF_PASSWORD`.

## Skenario demo (dua tampilan)

1. Buka portal (`/lapor`) di ponsel/tab 1; buka dashboard (`/dashboard`) di desktop/tab 2, login sebagai `rscm@rujukcepat.demo`.
2. Portal: setujui pemrosesan → lokasi (GPS, atau "Pilih di peta"/titik contoh) → rekam suara 10–15 dtk atau ketik laporan (+ foto opsional) → tinjau ringkasan → "Cari rumah sakit".
3. Pilih tujuan (utama/alternatif) → **Kirim permintaan rujukan**. Status `PENDING` + kuota simulasi ditahan; bukan diterima.
4. Dashboard: alert visual (+ alarm bila diaktifkan) → buka permintaan → **Terima** (atau Tolak) → portal ikut berubah.
5. Dashboard: ubah status kapabilitas (READY/PENUH/MAINTENANCE) atau kapasitas → rekomendasi portal berubah.
6. "Pasien tiba" menandai kuota terpakai; "Batalkan penerimaan" melepas kuota.

Skenario sintetis proposal: lansia 70 tahun lemas dan berkeringat dingin; foto opsional glukometer menunjukkan 46 mg/dL (`tests/fixtures/photo/glukometer-46-sintetis.jpg`). Tidak ada diagnosis/terapi yang ditetapkan sebagai fakta.

## Database, seed, dan reset

- Migrasi: `supabase/migrations/0001_init.sql` (skema, view publik, RLS, fungsi transaksi), `0002_realtime.sql`, `0003_staff_ops.sql` (akun petugas, `update_facility`, perbaikan `transition_referral`).
- Seed simulasi: `supabase/seed.sql` (10 RS; lokasi dari snapshot OSM `data/hospitals.osm.json`; kapasitas/kapabilitas simulasi berlabel). Dapat dijalankan ulang; mengembalikan kapasitas/kapabilitas ke nilai awal.
- **Reset data demo (MENGHAPUS semua rujukan, reservasi, riwayat):**
  - CLI (server dihentikan): `npm run db:reset`
  - UI: dashboard sebagai admin → "Reset data demo" → ketik `RESET`. API: `POST /api/demo/reset` `{"confirm":"RESET"}`.
- Lokasi RS diambil sekali oleh skrip (`npm run fetch:hospitals`, Overpass), bukan saat runtime.

### Memakai Supabase

URL + publishable key dapat mengidentifikasi project dan mengakses layanan publik, tetapi **bukan kredensial PostgreSQL**. Aplikasi ini memakai koneksi SQL server untuk transaksi rujukan/kuota dan sesi cookie sendiri untuk petugas (bukan Supabase Auth).

1. Isi `.env.local` tanpa membagikan nilainya di chat atau Git:

   ```ini
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   SUPABASE_DB_URL=postgresql://postgres.<project>:<password-database>@<host-pooler>:5432/postgres
   SUPABASE_SECRET_KEY=<secret-key>
   SESSION_SECRET=<string-acak-panjang>
   DEMO_STAFF_PASSWORD=<kata-sandi-demo>
   ```

   Ambil connection string dari **Connect → Session pooler** (IPv4 untuk pengembangan lokal), atau **Transaction pooler** (port 6543 untuk serverless). Salin host/user/port persis dari dashboard; isi password database, dengan URL encoding bila mengandung karakter khusus. Secret key ada di **Settings → API Keys**. Untuk proyek lama, `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` tetap didukung; key baru diprioritaskan. URL tanpa `https://` dinormalisasi otomatis. [Dokumentasi koneksi](https://supabase.com/docs/guides/database/connecting-to-postgres), [jenis API key](https://supabase.com/docs/guides/api/api-keys).
2. Jalankan `npm run supabase:setup`. Migrasi di `supabase/migrations/` diterapkan dalam satu transaksi dengan lock dan catatan checksum. **Seed hanya dijalankan ketika tabel RS kosong**, sehingga setup ulang tidak mereset kapasitas/rujukan. Jangan jalankan shim `supabase/local/auth-shim.sql` di Supabase. Alternatif SQL Editor: jalankan migrasi berurutan; seed hanya untuk database baru (seed manual mengembalikan kapasitas ke awal).
3. Jalankan `npm run check:supabase`: memeriksa endpoint + kunci publik, koneksi SQL/schema/seed, izin fungsi transaksi, dan broadcast server → klien pada kanal uji sementara (tanpa data pasien, tanpa mengubah tabel). Output tidak menampilkan rahasia. HTTP 200 dari endpoint saja belum membuktikan alur rujukan terhubung.
4. Setelah setup berhasil, set `DATA_MODE=supabase`, mulai ulang Next.js (`npm run dev`), lalu uji alur portal–dashboard. Setelah mengubah `NEXT_PUBLIC_*` pada produksi, build ulang. Akun petugas dibuat saat login pertama memakai `DEMO_STAFF_PASSWORD`.

Sinkronisasi memakai broadcast server (`rc:facilities`, `rc:hospital:<id>`, `rc:referral:<id>`) sebagai pemicu ambil ulang dari API; polling 5 dtk berjalan ketika koneksi putus. Kanal publik hanya membawa metadata teknis, bukan laporan pasien. Fungsi mutasi SQL dibatasi untuk koneksi server pada migrasi `0004_server_only_rpc.sql`, agar Data API publik tidak melewati otorisasi route. Lihat [fungsi database](https://supabase.com/docs/guides/database/functions).

Koneksi SQL memakai SSL require dan satu koneksi per proses. Opsional `SUPABASE_DB_CA_CERT` (CA dari Database Settings; baris baru dapat ditulis `\n`) mengaktifkan verifikasi sertifikat. Tanpa CA, koneksi terenkripsi tetapi sertifikat tidak diverifikasi. Tidak ada fallback diam-diam ke database lokal jika mode Supabase gagal.

**Hasil terbaru (31-10-2026):** koneksi PostgreSQL nyata lulus; migrasi 0001–0004 dan seed 10 RS diterapkan. Setup ulang melewati migrasi/seed dan mempertahankan data. `DATA_MODE=supabase` aktif. Next.js produksi lokal membaca 10 RS dari Supabase (HTTP 200); API antrean tanpa sesi ditolak 401. Transaksi SQL nyata (buat, retry idempoten, reservasi, ACCEPT, REVOKE, pelepasan sekali, RLS anon) lulus dalam satu transaksi yang seluruhnya di-rollback. URL + publishable key dan **secret key terbaru sama-sama HTTP 200**. `npm run check:supabase` exit 0: **broadcast Realtime server → klien publik lulus** pada kanal uji sementara. Pemindaian bundle klien dengan nilai rahasia terbaru lulus. Password petugas masih perlu diisi, sehingga alur login/kirim/konfirmasi pada dua sesi belum diuji; `SESSION_SECRET` acak sudah dibuat lokal. Konkurensi multi-koneksi belum diuji. Detail ada di `TASK.md`.

## Arsitektur

```
Portal (ponsel)                      Server (Next.js route handlers, Node)                     Data
 rekam/teks + foto ──POST /api/analyze──► adapter Gemini ─► validasi Zod ─► normalisasi
 tinjau hasil     ──POST /api/match────► pencocokan murni (kapabilitas+READY+segar+kuota) ─► ETA OSRM
 kirim            ──POST /api/referrals► create_referral() atomik ──────────────────────────► PostgreSQL
                         (Idempotency-Key)   kuota: kunci baris + reservasi HELD                (PGlite lokal
 status           ◄──GET /api/referrals/:id                                                    / Supabase)
                                         notifyChange() ─► SSE /api/stream (lokal)
Dashboard (desktop)                                       └► broadcast Supabase Realtime
 antrean/alert    ◄──GET /api/referrals + SSE
 terima/tolak/tiba──POST /api/referrals/:id/decision ─► transition_referral()
 kesiapan/kuota   ──PATCH /api/facilities/:id ───────► update_facility()
```

- **Satu sumber enum/schema:** `src/lib/schema` (kapabilitas, status, hasil AI, kontrak rujukan) dipakai server dan UI; dicerminkan di enum Postgres.
- **Lifecycle:** `PENDING → ACCEPTED | REJECTED | CANCELLED | EXPIRED`. Status permintaan dan status reservasi kuota (`HELD/RELEASED/CONSUMED`) selalu terpisah. `ACCEPTED` **tidak** melepas kuota; reservasi berakhir `CONSUMED` saat petugas menandai pasien tiba, atau `RELEASED` bila penerimaan dibatalkan. Pelepasan tepat satu kali (`update … where status='HELD'`). Expiry malas (tanpa cron) pada setiap pembacaan/pengiriman.
- **Sinkronisasi:** database = sumber kebenaran. Event hanya pemicu; klien mengambil ulang via API (event ganda aman), rekonsiliasi penuh saat (re)connect, polling 5 dtk + badge "Sinkronisasi terbatas" saat terputus.
- **Akses:** cookie pelapor anonim (`rc_rid`) menentukan pemilik rujukan; cookie petugas bertanda tangan (`rc_staff`) mengikat satu RS. Setiap route memeriksa kepemilikan/RS; RLS tertulis di migrasi sebagai pertahanan tambahan.
- **PWA:** service worker hanya menyimpan aset statis berhash + ikon + halaman offline; `/api/*` dan HTML tidak pernah di-cache; offline → banner jujur, tombol kirim nonaktif, tanpa antrean offline.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm test                 # unit + integrasi (PGlite in-memory)
npm run build
npm run check:secrets    # pindai .next/static: nilai rahasia server tidak boleh ada di bundle klien
npm run measure          # ukur skenario terhadap server berjalan (lihat scripts/measure.ts)
```

## Hasil pengujian (31-10-2026, Windows 11, Node 22, tanpa commit)

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run build` | Lulus. |
| `npm test` | 78 tes, 8 file, lulus. Mencakup: schema/normalisasi AI, pencocokan, migrasi+seed+fungsi SQL, **API rujukan** (kuota serentak, idempotency, transisi, expiry, akses lintas RS/pelapor, cookie palsu, reset), **kegagalan** (persetujuan, unggahan, JSON rusak, audio tidak jelas, foto tidak terbaca, OSRM gagal, tanpa kandidat, rate limit), perilaku service worker. |
| `npm run check:secrets` | Lulus; nilai `SESSION_SECRET` dan `DEMO_STAFF_PASSWORD` tidak ada di `.next/static`. Pemindai terbukti mendeteksi nilai yang sengaja disisipkan. `GEMINI_API_KEY`/Supabase belum diisi saat pemindaian — ulangi setelah diisi. |
| Dua tampilan di browser (tab portal + tab dashboard) | Kirim → alert dashboard → Terima → status portal berubah; ubah kapabilitas → rekomendasi berubah; kuota bentrok → pesan + daftar tujuan diperbarui; klik kirim berulang → satu reservasi; server mati lalu hidup → dashboard pulih dari database. |

### Performa — target proposal vs. hasil aktual

Target adalah sasaran proposal, bukan jaminan. Detail mentah: `docs/hasil-ukur-mock.json`.

**MOCK (AI & rute simulasi), 10 percobaan, `localhost`, produksi `next start`, audio 495 KB + foto 26 KB, AMD Ryzen 7 6800H:**

| Indikator (target) | Hasil (median / maks) | Catatan |
| --- | --- | --- |
| Respons AI (< 3 dtk) | 0,60 dtk / 0,61 dtk (penyedia) | **Tidak bermakna:** mock menunda 600 ms secara sengaja. Hasil LIVE harus diukur terpisah. |
| Koordinasi digital (< 15 dtk) | 0,69 dtk / 0,81 dtk | Analisis + pencocokan + kirim; **tanpa** waktu manusia meninjau/memilih. |
| Sinkronisasi (< 200 ms) | 4 ms / 5 ms (server→klien SSE) | Satu mesin, jam sama; tidak mewakili lintas perangkat/jaringan. Hingga UI menggambar belum diukur. |
| Interaksi pembaruan status (< 2 dtk) | 46 ms / 51 ms (POST keputusan) | Sisi server+jaringan loopback. |

**LIVE (Gemini):** pada sesi ini **belum diukur ulang** (tanpa `GEMINI_API_KEY`). Pengukuran awal 31-10-2026 pada tahap T04 (`gemini-3.5-flash`, jaringan rumah) berkisar 5,5–13,2 dtk — **target < 3 dtk belum tercapai** (lihat TASK.md §10). Jalankan `AUDIO=1 PHOTO=1 npm run measure` dengan server `AI_MODE=live` untuk hasil terbaru.

## Cakupan terhadap proposal dan selisih

P0 dan P1 (foto, TTS, alarm, PWA, aksesibilitas dasar) diimplementasikan. Selisih yang diketahui:

- Realtime **Supabase** belum diuji (tanpa kredensial); sinkronisasi terverifikasi memakai SSE pada mode data lokal.
- Registrasi service worker tidak dapat diuji di browser pane pengembangan (registrasi ditolak); perilaku dilindungi tes tiruan, perlu uji di Chrome/Android/iOS sungguhan.
- Mikrofon/kamera/GPS ponsel nyata, suara TTS bahasa Indonesia, dan bunyi alarm belum diuji di perangkat nyata (browser pane tanpa mikrofon, tanpa suara id-ID).
- Audit aksesibilitas penuh (pembaca layar, kontras terukur) belum dilakukan; yang ada: teks+ikon untuk status, fokus keyboard terlihat, skip link, tombol besar.
- Tidak ada Playwright; uji dua sesi dilakukan lewat tes API (dua cookie jar) dan browser pane manual.
- Pembatas laju bersifat per proses (serverless: per instans).

## Privasi, data, dan retensi

- Hanya data sintetis. Jangan memasukkan identitas atau data kesehatan orang nyata ke seed, log, tangkapan layar, atau rekaman demo.
- Sebelum unggah, portal menjelaskan bahwa audio/foto/teks dikirim ke Google Gemini untuk diringkas. Server menolak unggahan tanpa persetujuan.
- **Audio dan foto tidak disimpan** (diproses di memori fungsi). Laporan yang tidak dikirim tidak disimpan di server. Yang disimpan hanya ringkasan/transkrip AI pada rujukan yang dikirim, dengan koordinat dibulatkan 3 desimal, sampai reset data demo.
- Log hanya memuat kode galat/status, bukan transkrip, SOAP, audio, atau foto.
- Id rujukan terakhir disimpan di `localStorage` perangkat pelapor (hanya id) untuk memantau status; hilang saat "Buat laporan baru".

## Deklarasi penggunaan AI, layanan pihak ketiga, dan atribusi

- **AI:** Google Gemini API (`@google/genai`, model `gemini-3.5-flash` pada mode live) untuk transkripsi/ringkasan SOAP, perkiraan urgensi, dan kebutuhan kapabilitas dari suara/teks/foto sintetis. Keluaran divalidasi schema dan disaring (kode ilegal dibuang, item rencana berdosis dibuang); bukan diagnosis. Bila memakai tier gratis, penyedia dapat memakai data untuk peningkatan layanan — gunakan data sintetis saja. Kode proyek ini dibantu asisten AI (Claude) di bawah arahan tim.
- **Peta/lokasi/rute:** © OpenStreetMap contributors (ODbL) — tile OSM, snapshot lokasi RS via Overpass API (diambil 31-10-2026), Leaflet; rute/ETA via OSRM publik (perkiraan tanpa lalu lintas langsung; layanan demo tanpa SLA).
- **Data:** PGlite (Postgres WASM) lokal; Supabase (opsional, belum diuji); Next.js, React, Tailwind CSS, Lucide Icons, Zod.
- **Hosting rencana:** Vercel Hobby (nonkomersial) — belum dideploy.

## Keterbatasan dan pekerjaan tersisa

Di luar MVP: integrasi SIRANAP/SISRUTE/rekam medis, data kapasitas nyata, diagnosis/terapi otonom, dispatch ambulans, klaim manfaat klinis. Validasi klinis, kerja sama rumah sakit, dan uji lapangan tetap pekerjaan lanjutan.

Belum dikerjakan karena membutuhkan otorisasi/kredensial pengguna: demo publik (Vercel + Supabase + GitHub), smoke test deployment, video < 3 menit, pitch deck, tag `submission-24h`, dan pengumpulan Devpost. Bahan: [docs/SMOKE-TEST.md](docs/SMOKE-TEST.md), [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md), [docs/PITCH-DECK.md](docs/PITCH-DECK.md), [docs/DEVPOST.md](docs/DEVPOST.md).
