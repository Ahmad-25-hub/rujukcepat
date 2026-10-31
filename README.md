# RujukCepat

PWA demo koordinasi rujukan prarumah sakit DKI Jakarta dan Jawa Timur — tim TwinTech, Universitas Negeri Jakarta, INCEPTION 2026.

Alur utama: laporan suara/teks → ringkasan AI terstruktur (SOAP, urgensi, kebutuhan) → rekomendasi IGD yang kapabilitasnya READY dan kuotanya tersedia → navigasi ke RS → **"Sudah sampai"** → ringkasan serah terima untuk petugas IGD. Petugas RS mengatur kesiapan layanan dan kuota secara manual di dashboard.

> **Perubahan alur (31-10-2026, keputusan pengguna):** tombol "Kirim permintaan" dan konfirmasi petugas dihapus. Aplikasi hanya merekomendasikan; kuota **tidak** berkurang otomatis saat pelapor memilih atau menuju RS, tetapi diatur petugas RS kapan saja. Tabel/fungsi rujukan lama (`referral_requests`, `quota_reservations`, `create_referral`, dll.) masih ada di migrasi tetapi tidak dipakai aplikasi.

> **Semua data kapasitas, kesiapan layanan, dan pasien adalah SIMULASI.** Lokasi rumah sakit dari OpenStreetMap tidak membuktikan kemitraan, kesiapan, atau penerimaan pasien. Ringkasan AI adalah perkiraan awal untuk koordinasi, **bukan diagnosis**; keputusan klinis dan penerimaan tetap pada tenaga kesehatan. Hasil uji kode tidak sama dengan validasi klinis.

## Batas demo dan simulasi

Atas permintaan pengguna pada 31-10-2026, penjelasan demo/simulasi dipusatkan di README ini. Banner dan badge berulang pada beranda, portal laporan, pilihan RS, login, dan dashboard dihapus. Perubahan tampilan ini menggantikan ketentuan label simulasi terlihat pada GOAL §4/§7 dan AGENTS §5/§7/§8; aplikasi tetap prototipe hackathon, bukan layanan rujukan operasional.

- **Data fasilitas:** kapasitas dan kesiapan layanan berasal dari seed simulasi dan dapat diubah petugas. Status READY serta kuota bukan bukti kesiapan atau penerimaan pasien nyata. Penanda `is_simulated`, sumber, dan waktu pembaruan tetap disimpan dalam data.
- **AI:** `AI_MODE=mock` memakai fixture sintetis, bukan analisis rekaman oleh Gemini. Antarmuka menyebutnya skenario/hasil contoh. `AI_MODE=live` memanggil Gemini melalui server; hasilnya tetap perkiraan yang perlu ditinjau.
- **Rute:** `ROUTING_MODE=mock` menghitung waktu dari jarak garis lurus dikalikan faktor jalan. Ini bukan ETA berkendara dan tidak menyediakan petunjuk belok. Mode `live` memakai OSRM tanpa informasi lalu lintas langsung.
- **Pratinjau perjalanan:** tombol ini memutar posisi buatan sepanjang rute untuk demonstrasi, bukan posisi GPS perangkat. Akhiri pratinjau untuk kembali memakai GPS.
- **Penyimpanan dan sinkronisasi:** mode lokal memakai PGlite dan SSE; mode Supabase memakai PostgreSQL dan Realtime. Pilihan mode tetap mengikuti environment meskipun badge teknis di header dihapus.
- **Data masukan:** gunakan pasien sintetis tanpa identitas atau data kesehatan orang nyata. Audio/foto tidak disimpan setelah diproses; ringkasan berada di perangkat. Persetujuan pemrosesan, informasi penyedia, batas AI, atribusi peta, dan pesan kegagalan tetap tersedia di antarmuka.

## Status (31-10-2026)

| Bagian | Status |
| --- | --- |
| Portal → AI → rekomendasi RS → navigasi → "Sudah sampai"; dashboard mengatur kesiapan/kuota | Berfungsi (mode data lokal, diuji di browser 31-10-2026). Lihat "Hasil pengujian". |
| P1: foto opsional, bacakan ringkasan (TTS), PWA, aksesibilitas | Diimplementasikan; kekurangan uji perangkat nyata dicatat di bawah. Alarm permintaan masuk dihapus bersama fitur kirim. |
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
| `AI_MODE` / `GEMINI_API_KEY` / `GEMINI_MODEL` | `mock` memakai fixture sintetis (skenario/hasil contoh); `live` memanggil Gemini dari server. Model terverifikasi 31-10-2026: `gemini-3.5-flash` (`gemini-2.5-flash` ditolak 404 untuk pengguna baru). |
| `ROUTING_MODE` / `OSRM_BASE_URL` | `mock` = perkiraan waktu dari jarak garis lurus; `live` = OSRM publik. |
| `SESSION_SECRET` | Penanda tangan cookie sesi petugas. **Wajib** di produksi. |
| `DEMO_STAFF_PASSWORD` | Kata sandi semua akun petugas demo. Tidak ada kata sandi di repo; tanpa ini login petugas nonaktif. |
| `MATCH_MAX_KM` | Radius garis lurus (km) dari pasien; RS di luar radius tidak dinilai (bawaan 100). Mencegah RS Jakarta muncul untuk pasien di Jawa Timur dan sebaliknya. |
| `STALE_AFTER_MINUTES` | Status fasilitas lebih tua dari ini dianggap kedaluwarsa, bukan READY (bawaan 43200 = 30 hari selama masa lomba; sebelumnya 1440). **Set juga di Vercel** bila variabel ini pernah diisi di sana. |
| `ANALYZE_RATE_PER_MINUTE`, `LOGIN_RATE_PER_MINUTE` | Pembatas laju per klien (bawaan 12 dan 10). |
| `SUPABASE_DB_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mode Supabase; key `ANON_KEY`/`SERVICE_ROLE_KEY` lama juga didukung. Rahasia hanya dibaca server. |

Daftar lengkap: [.env.example](.env.example). **Jangan commit `.env.local`.**

### Akun petugas demo

Satu akun per RS contoh, semuanya memakai `DEMO_STAFF_PASSWORD`:

| Email | Akses |
| --- | --- |
| `rscm@rujukcepat.demo`, `fatmawati@…`, `tarakan@…`, `pasarminggu@…`, `pon@…` (`@rujukcepat.demo`) | Hanya mengubah kesiapan dan kuota RS-nya sendiri. |
| `admin@rujukcepat.demo` | Petugas RSCM + boleh mereset data demo. |

Akun dibuat/disinkronkan otomatis saat login pertama dari `DEMO_STAFF_PASSWORD`.

**Akun RS impor (195 akun, satu per RS):** dibuat oleh `npm run hospitals:import` dengan kata sandi acak per akun. Daftar email + kata sandi ada di `akunRumahsakit.md` (gitignored; sumbernya `data/akun-rumahsakit.local.json`, juga gitignored). Database hanya menyimpan hash scrypt. Menjalankan ulang skrip memakai kata sandi yang sama.

## Skenario demo (dua tampilan)

1. Buka portal (`/lapor`) di ponsel/tab 1; buka dashboard (`/dashboard`) di desktop/tab 2, login sebagai petugas RS (mis. `tarakan@rujukcepat.demo`).
2. Portal: setujui pemrosesan → lokasi (GPS, atau "Pilih di peta"/titik contoh) → rekam suara 10–15 dtk atau ketik laporan (+ foto opsional) → tinjau ringkasan → "Cari rumah sakit".
3. Portal menampilkan IGD yang cocok (utama + alternatif) beserta ETA, status kapabilitas, dan kuota. Tidak ada permintaan yang dikirim; kuota tidak berubah.
4. Dashboard: petugas mengubah status kapabilitas (READY/PENUH/MAINTENANCE) atau kuota (mis. kuota 0) → tekan perbarui di portal → rekomendasi berubah.
5. Portal: **Navigasi ke RS** → layar navigasi GPS (atau "Pratinjau perjalanan") → **Sudah sampai**.
6. Layar "Sudah sampai" menampilkan ringkasan SOAP, urgensi, dan kebutuhan untuk ditunjukkan/dibacakan (TTS) ke petugas IGD. Ringkasan hanya di perangkat, tidak dikirim ke RS.

Skenario sintetis proposal: lansia 70 tahun lemas dan berkeringat dingin; foto opsional glukometer menunjukkan 46 mg/dL (`tests/fixtures/photo/glukometer-46-sintetis.jpg`). Tidak ada diagnosis/terapi yang ditetapkan sebagai fakta.

### Navigasi di peta

Setelah memilih tujuan, portal menampilkan rute, petunjuk belok demi belok, tombol **Buka di Google Maps/Waze**, dan **Navigasi ke RS** (GPS): titik biru mengikuti posisi, ada deteksi keluar jalur + hitung ulang rute, dan panduan suara opsional. Tanpa API berbayar: rute dari OSRM publik dengan penghematan permintaan (lihat `SPEC.md` §19). ETA tetap **perkiraan tanpa lalu lintas langsung**. Tombol "Pratinjau perjalanan" memutar posisi buatan sepanjang rute untuk demo tanpa berkendara. Tombol **Sudah sampai** selalu tersedia di layar navigasi (juga saat GPS ditolak atau rute gagal) dan membuka ringkasan serah terima. Uji GPS/suara di perangkat nyata (HTTPS) belum dilakukan.

## Database, seed, dan reset

- Migrasi: `supabase/migrations/0001_init.sql` (skema, view publik, RLS, fungsi transaksi), `0002_realtime.sql`, `0003_staff_ops.sql` (akun petugas, `update_facility`, perbaikan `transition_referral`).
- Seed simulasi: `supabase/seed.sql` (10 RS awal Jakarta) + `supabase/seed-osm.sql` (190 RS impor OSM: 90 Jakarta, 100 Jawa Timur). Total **100 RS DKI Jakarta + 100 RS Jawa Timur**. Dapat dijalankan ulang; mengembalikan kapasitas/kapabilitas ke nilai awal.
- **RS impor OSM** (`npm run fetch:hospitals` → snapshot `data/osm/hospitals-{jakarta,jatim}.json`; `npm run build:hospitals` → `supabase/seed-osm.sql` + ringkasan `data/osm/rs-terpilih.json`; `npm run hospitals:import` → terapkan ke database aktif + akun petugas). Aturan seleksi: hanya nama RS (puskesmas/klinik/gigi/apotek/lab dibuang), `emergency=no` dan RS Mata/Jiwa/Gigi/Ketergantungan Obat/THT/Kusta tidak diambil, diurutkan menurut kelengkapan tag OSM, duplikat (nama mirip < 400 m) dibuang. Kapabilitas hanya dari bukti: `healthcare:speciality` OSM dan jenis RS dari nama (RSIA/Bersalin → PONEK_NICU saja; RS Jantung → +CATH_LAB; RS Orthopedi → +TRAUMA_BEDAH); tanpa keterangan → bawaan `IGD_DASAR` READY. Kuota bawaan 5/5, atau ceil(tempat tidur/25) (2–20) bila OSM mencantumkan `beds`/`rooms`. Sumber tiap kapabilitas tersimpan di kolom `source` (`OSM_EMERGENCY`, `OSM_SPESIALISASI`, `JENIS_RS_DARI_NAMA`, `BAWAAN_IMPOR`). Telepon/situs OSM ditampilkan di kartu kandidat. Untuk Supabase: `npm run supabase:setup` (migrasi 0005) dulu, lalu `npm run hospitals:import`.
- **Reset data demo (mengembalikan kapasitas/kapabilitas semua RS ke seed; perubahan petugas hilang):**
  - CLI (server dihentikan): `npm run db:reset`
  - UI: dashboard sebagai admin → "Reset data" → ketik `RESET`. API: `POST /api/demo/reset` `{"confirm":"RESET"}`.
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

Sinkronisasi memakai broadcast server (`rc:facilities`) sebagai pemicu ambil ulang dari API; polling 5 dtk berjalan ketika koneksi putus. Kanal publik hanya membawa metadata teknis, bukan laporan pasien. Fungsi mutasi SQL dibatasi untuk koneksi server pada migrasi `0004_server_only_rpc.sql`, agar Data API publik tidak melewati otorisasi route. Lihat [fungsi database](https://supabase.com/docs/guides/database/functions).

Koneksi SQL memakai SSL require dan satu koneksi per proses. Opsional `SUPABASE_DB_CA_CERT` (CA dari Database Settings; baris baru dapat ditulis `\n`) mengaktifkan verifikasi sertifikat. Tanpa CA, koneksi terenkripsi tetapi sertifikat tidak diverifikasi. Tidak ada fallback diam-diam ke database lokal jika mode Supabase gagal.

**Hasil terbaru (31-10-2026):** koneksi PostgreSQL nyata lulus; migrasi 0001–0004 dan seed 10 RS diterapkan. Setup ulang melewati migrasi/seed dan mempertahankan data. `DATA_MODE=supabase` aktif. Next.js produksi lokal membaca 10 RS dari Supabase (HTTP 200); API antrean tanpa sesi ditolak 401. Transaksi SQL nyata (buat, retry idempoten, reservasi, ACCEPT, REVOKE, pelepasan sekali, RLS anon) lulus dalam satu transaksi yang seluruhnya di-rollback. URL + publishable key dan **secret key terbaru sama-sama HTTP 200**. `npm run check:supabase` exit 0: **broadcast Realtime server → klien publik lulus** pada kanal uji sementara. Pemindaian bundle klien dengan nilai rahasia terbaru lulus. Password petugas masih perlu diisi, sehingga alur login/kirim/konfirmasi pada dua sesi belum diuji; `SESSION_SECRET` acak sudah dibuat lokal. Konkurensi multi-koneksi belum diuji. Detail ada di `TASK.md`. *(Hasil ini dari sebelum perubahan alur; fitur kirim/konfirmasi kini dihapus. Alur baru belum diuji pada Supabase.)*

### Login petugas gagal HTTP 500 setelah deployment

Jika halaman login menampilkan “Respons server tidak valid (HTTP 500)” ketika password benar, periksa `SESSION_SECRET` di **Vercel → Project Settings → Environment Variables**. Variabel ini diperlukan untuk menandatangani cookie sesi, terpisah dari `DEMO_STAFF_PASSWORD` dan secret key Supabase. Pasang string acak dari `.env.local` sebagai **Secret** pada scope **Production**, kemudian **Redeploy**. Jangan memakai placeholder atau nilai kosong.

Bug lama meletakkan pembuatan cookie di luar penanganan error, sehingga `SESSION_SECRET_MISSING` dapat menjadi respons 500 non-JSON. Sekarang kondisi ini ditangani sebagai JSON 503 `STAFF_SESSION_NOT_CONFIGURED` dengan pesan konfigurasi sesi belum lengkap. Jika variabel sudah berlaku pada deployment terbaru tetapi login tetap gagal, periksa log fungsi `/api/staff/login`; diagnosis kondisi remote memerlukan log, bukan hanya screenshot. Tidak perlu membagikan password atau isi secret.

## Arsitektur

```
Portal (ponsel)                      Server (Next.js route handlers, Node)                     Data
 rekam/teks + foto ──POST /api/analyze──► adapter Gemini ─► validasi Zod ─► normalisasi
 tinjau hasil     ──POST /api/match────► pencocokan murni (kapabilitas+READY+segar+kuota) ─► ETA OSRM
 navigasi         ──GET /api/route─────► rute OSRM + petunjuk belok
 sudah sampai     (hanya di perangkat; tidak ada yang dikirim)                                 PostgreSQL
                                                                                                (PGlite lokal
Dashboard (desktop)                                                                             / Supabase)
 kesiapan/kuota   ──PATCH /api/facilities/:id ───────► update_facility()
                                         notifyChange() ─► SSE /api/stream (lokal)
                                                          └► broadcast Supabase Realtime
```

- **Satu sumber enum/schema:** `src/lib/schema` (kapabilitas, status, hasil AI, perubahan fasilitas) dipakai server dan UI; dicerminkan di enum Postgres.
- **Kuota:** hanya diubah petugas RS lewat `update_facility()` (validasi: tidak negatif, tersedia ≤ total). Tidak ada reservasi atau pengurangan otomatis; RS dengan kuota 0 tidak direkomendasikan.
- **Sinkronisasi:** database = sumber kebenaran. Event "fasilitas berubah" hanya pemicu; klien mengambil ulang via API (event ganda aman), rekonsiliasi penuh saat (re)connect, polling 5 dtk + badge "Sinkronisasi terbatas" saat terputus.
- **Akses:** cookie petugas bertanda tangan (`rc_staff`) mengikat satu RS; route fasilitas menolak perubahan RS lain. RLS tertulis di migrasi sebagai pertahanan tambahan.
- **PWA:** service worker hanya menyimpan aset statis berhash + ikon + halaman offline; `/api/*` dan HTML tidak pernah di-cache; offline → banner jujur.

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
| `npm run lint`, `npm run typecheck`, `npm run build` | Lulus (ulang setelah perubahan alur 31-10-2026). |
| `npm test` | 87 tes, 10 file, lulus (setelah perubahan alur). Mencakup: schema/normalisasi AI, pencocokan, navigasi, migrasi+seed+`update_facility`, **API** (login, akses lintas RS, cookie palsu, kuota manual, pencarian berulang tidak mengurangi kuota, kuota 0 tidak direkomendasikan lalu muncul lagi, event, reset), **kegagalan** (persetujuan, unggahan, JSON rusak, audio tidak jelas, foto tidak terbaca, OSRM gagal, tanpa kandidat, rate limit), perilaku service worker. |
| Browser, alur baru (`next start`, data lokal, AI mock, OSRM live) | Portal → rekomendasi tanpa tombol kirim → Navigasi → **Sudah sampai** → ringkasan serah terima; kuota Tarakan tetap 1/4. Dashboard tanpa antrean; kuota Tarakan diubah 0 → Tarakan dikecualikan ("Kuota … 0"), tersinkron SSE 42 ms. Tampilan ponsel 375 px tanpa scroll horizontal. |
| `npm run check:secrets` | Lulus; nilai `SESSION_SECRET` dan `DEMO_STAFF_PASSWORD` tidak ada di `.next/static`. Pemindai terbukti mendeteksi nilai yang sengaja disisipkan. `GEMINI_API_KEY`/Supabase belum diisi saat pemindaian — ulangi setelah diisi. |
| *(Alur lama, sebelum perubahan)* Dua tampilan di browser | Kirim → alert dashboard → Terima → status portal berubah; ubah kapabilitas → rekomendasi berubah; kuota bentrok → pesan + daftar tujuan diperbarui; klik kirim berulang → satu reservasi; server mati lalu hidup → dashboard pulih dari database. |

### Performa — target proposal vs. hasil aktual

Target adalah sasaran proposal, bukan jaminan. Detail mentah: `docs/hasil-ukur-mock.json`.

**Alur baru — AI MOCK, rute OSRM LIVE, data lokal, 5 percobaan, `localhost`, produksi `next start`, masukan teks, AMD Ryzen 7 6800H (31-10-2026):**

| Indikator (target) | Hasil (median / maks) | Catatan |
| --- | --- | --- |
| Respons AI (< 3 dtk) | 0,61 dtk / 0,61 dtk (penyedia) | **Tidak bermakna:** mock menunda 600 ms secara sengaja. Hasil LIVE harus diukur terpisah. |
| Koordinasi digital (< 15 dtk) | 0,94 dtk / 2,16 dtk | Analisis + rekomendasi + rute; **tanpa** waktu manusia meninjau/memilih. Maks = percobaan pertama (tabel ETA OSRM belum ter-cache). |
| Sinkronisasi (< 200 ms) | 2 ms / 3 ms (server→klien SSE); 8 ms / 11 ms dari ubah kuota sampai portal menerima event | Satu mesin, jam sama; tidak mewakili lintas perangkat/jaringan. Hingga UI menggambar belum diukur. |
| Interaksi pembaruan status (< 2 dtk) | 8 ms / 11 ms (PATCH kuota oleh petugas) | Sisi server+jaringan loopback. |
| Kuota tanpa tindakan petugas | RSCM 3/6 → 3/6 setelah 3 rekomendasi | Rekomendasi tidak mengubah kuota. |

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
- **Audio, foto, laporan, ringkasan AI, dan lokasi pelapor tidak disimpan di server** (diproses di memori fungsi). Ringkasan "Sudah sampai" hanya ada di memori halaman perangkat pelapor dan hilang saat "Buat laporan baru" atau halaman ditutup.
- Log hanya memuat kode galat/status, bukan transkrip, SOAP, audio, atau foto.

## Deklarasi penggunaan AI, layanan pihak ketiga, dan atribusi

- **AI:** Google Gemini API (`@google/genai`, model `gemini-3.5-flash` pada mode live) untuk transkripsi/ringkasan SOAP, perkiraan urgensi, dan kebutuhan kapabilitas dari suara/teks/foto sintetis. Keluaran divalidasi schema dan disaring (kode ilegal dibuang, item rencana berdosis dibuang); bukan diagnosis. Bila memakai tier gratis, penyedia dapat memakai data untuk peningkatan layanan — gunakan data sintetis saja. Kode proyek ini dibantu asisten AI (Claude) di bawah arahan tim.
- **Peta/lokasi/rute:** © OpenStreetMap contributors (ODbL) — tile OSM, snapshot lokasi RS via Overpass API (diambil 31-10-2026), Leaflet; rute/ETA via OSRM publik (perkiraan tanpa lalu lintas langsung; layanan demo tanpa SLA).
- **Foto beranda** (`public/images/`, diunduh 01-11-2026, dikompresi ulang): “Vibrant Night in Jakarta” oleh David Tumpal, “Woman in Pink Hijab Holding Black Mobile Phone” oleh Tia Rahayu, dan “Healthcare Professionals in Hospital Corridor” oleh Adarsh Mp — semuanya dari Pexels ([lisensi Pexels](https://www.pexels.com/license/)); “Toyota HiAce ambulance in Jakarta, Indonesia” oleh Secretdriver, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Toyota_HiAce_ambulance_in_Jakarta,_Indonesia.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Orang di foto adalah model stok, bukan pasien atau petugas RujukCepat, dan tidak menyatakan dukungan.
- **Data:** PGlite (Postgres WASM) lokal; Supabase (opsional, belum diuji); Next.js, React, Tailwind CSS, Lucide Icons, Zod.
- **Hosting rencana:** Vercel Hobby (nonkomersial) — belum dideploy.

## Keterbatasan dan pekerjaan tersisa

Di luar MVP: integrasi SIRANAP/SISRUTE/rekam medis, data kapasitas nyata, diagnosis/terapi otonom, dispatch ambulans, klaim manfaat klinis. Validasi klinis, kerja sama rumah sakit, dan uji lapangan tetap pekerjaan lanjutan.

Belum dikerjakan karena membutuhkan otorisasi/kredensial pengguna: demo publik (Vercel + Supabase + GitHub), smoke test deployment, video < 3 menit, pitch deck, tag `submission-24h`, dan pengumpulan Devpost. Bahan: [docs/SMOKE-TEST.md](docs/SMOKE-TEST.md), [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md), [docs/PITCH-DECK.md](docs/PITCH-DECK.md), [docs/DEVPOST.md](docs/DEVPOST.md).
