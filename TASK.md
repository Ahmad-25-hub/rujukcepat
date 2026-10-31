# TASK - Panduan tugas AI agent RujukCepat

## 1. Cara menggunakan daftar tugas

Baca `GOAL.md` untuk cakupan dan kriteria penerimaan AC-01 sampai AC-12, lalu `AGENTS.md` untuk aturan implementasi. Periksa kode dan status proyek sebelum memilih tugas; checklist bukan bukti bahwa implementasi sudah tersedia.

- Pilih tugas yang dependensinya sudah terpenuhi. Notasi `setelah T02/T03` berarti kedua tugas tersebut harus sudah memenuhi kriteria selesainya.
- Prioritaskan P0 untuk alur inti dan luaran wajib. P1 melengkapi MVP setelah alur inti stabil.
- Untuk setiap tugas, kerjakan instruksinya, verifikasi hasilnya, lalu catat bukti dan kendala.
- Gunakan `[ ]` untuk belum selesai dan `[x]` hanya setelah hasil diverifikasi. Tugas terhambat tetap `[ ]`.
- Jika layanan atau kredensial belum tersedia, lanjutkan pekerjaan independen dengan fixture berlabel simulasi. Jangan menganggap integrasi nyata selesai karena mock berhasil.
- Catat keputusan teknis penting dan langkah berikutnya agar agent dapat melanjutkan pekerjaan dari kondisi terakhir.

## 2. Urutan dan prioritas

Alur inti: fondasi -> AI dan peta -> input serta pencocokan -> hasil dan tujuan -> transaksi rujukan -> dashboard -> sinkronisasi -> pengujian -> dokumentasi dan paket demo.

T08, T13, dan T14 adalah kelengkapan P1. Kerjakan setelah dependensinya terpenuhi tanpa menghambat penyelesaian alur P0. Jika ada fitur yang ditunda, catat dampaknya terhadap cakupan `GOAL.md`.

## 3. Fondasi dan kontrak

- [x] **T01 - Konfirmasi cakupan dan brief** (P0).
  **Kerjakan:** Periksa kesesuaian kebutuhan aplikasi, aturan penggunaan AI, dan persyaratan luaran dengan GOAL serta brief yang tersedia. Catat konflik cakupan dan keputusan teknis yang belum ditetapkan.

  **Kriteria selesai:** alur demo, batas simulasi, dan persyaratan luaran terdokumentasi. Jika brief tambahan belum tersedia, lanjutkan berdasarkan GOAL dan tandai bagian yang belum terverifikasi.

  **Bukti (31-10-2026):** cakupan, alur demo, batas simulasi, dan luaran dirangkum di bagian 9 "Cakupan T01". Challenge brief panitia belum diberikan → kesesuaian brief, jadwal aktual, dan syarat luaran Devpost **belum terverifikasi**; pekerjaan berlanjut berdasarkan GOAL.

- [x] **T02 - Setup aplikasi dan konfigurasi** (P0; setelah T01).
  **Kerjakan:** Siapkan atau gunakan repo yang tersedia, Next.js/TypeScript, styling, ikon, lockfile, `.gitignore`, `.env.example`, dan script pemeriksaan. Verifikasi versi layanan dari dokumentasi resmi.

  **Kriteria selesai:** aplikasi dasar berjalan lokal, build berhasil, dan struktur portal/dashboard tersedia. Deployment awal dilakukan bila telah diotorisasi.

  **Bukti:** Next.js 16.4.3 + TypeScript strict + Tailwind 4 + Lucide, npm + `package-lock.json`, `.gitignore`, `.env.example`, `vercel.json`, script `dev/build/lint/typecheck/test/db:reset/fetch:hospitals/check:gemini`. `npm run build` lulus tanpa peringatan; `npm run dev` melayani `/`, `/lapor`, `/dashboard`. Versi dicek dari registry npm. Deployment belum dilakukan (belum diotorisasi). Repo belum diinisialisasi Git (folder bukan repo Git).

- [x] **T03 - Schema, seed, dan kontrak akses** (P0; setelah T01).
  **Kerjakan:** Definisikan rumah sakit, delapan kapabilitas, status/kebaruan, kapasitas, laporan/hasil AI, permintaan, reservasi kuota, dan otorisasi petugas. Tentukan schema AI, lifecycle status, idempotency, expiry, dan pelepasan kuota. Buat migrasi, kebijakan akses, serta seed pasien/fasilitas simulasi.

  **Kriteria selesai:** schema dapat dibuat ulang dan data demo dapat dibedakan dari data lokasi publik.

  **Bukti:** `supabase/migrations/0001_init.sql` (enum, tabel RS/kapabilitas/kapasitas/petugas/rujukan/reservasi/event, view `facility_public_status`, RLS, fungsi `create_referral`, `release_reservation`, `expire_stale_referrals`, `transition_referral`), `0002_realtime.sql`, `supabase/seed.sql` (10 RS lokasi OSM + kapabilitas/kapasitas berlabel simulasi). Tes `tests/integration/db.test.ts` (PGlite/Postgres 17): migrasi & seed dijalankan ulang tanpa duplikasi, kedelapan kode + PENUH/MAINTENANCE/kapasitas 0 tersedia, penanda simulasi & sumber OSM, view tanpa kolom pasien, dua permintaan untuk 1 kuota → 1 berhasil, idempotency, pelepasan tepat sekali, ACCEPTED tidak melepas kuota, transisi ilegal ditolak, lazy expiry, constraint kapasitas ≥ 0 — **lulus**. Belum diuji: migrasi & RLS pada Supabase sungguhan (tanpa kredensial), konkurensi multi-koneksi (PGlite satu koneksi).

## 4. AI, lokasi, dan peta

- [x] **T04 - Adapter Gemini dan validasi keluaran** (P0; setelah T02/T03).
  **Kerjakan:** Implementasikan endpoint server untuk audio serta kontrak foto opsional; JSON SOAP, urgensi, alasan, kebutuhan, asal data, dan informasi yang tidak diketahui. Verifikasi model tersedia dan format masukan didukung.

  **Kriteria selesai:** contoh audio sintetis menghasilkan schema valid dan keluaran rusak/gagal dapat ditangani. Catat terpisah jika baru memakai fixture. Bukti: AC-01/AC-02.

  **Bukti (31-10-2026):** endpoint `POST /api/analyze`, adapter Gemini (`@google/genai`, `responseJsonSchema` dari Zod, timeout, `thinkingLevel` LOW, retry 1×), normalisasi, dan mode mock berlabel. **Model:** `gemini-2.5-flash` (kandidat proposal) ada di daftar model tetapi ditolak 404 "no longer available to new users"; `gemini-3.8-flash`/`3.7-flash`/`flash-latest` timeout >40 dtk saat diuji; dipilih **`gemini-3.5-flash`** (audio WAV + gambar + JSON terstruktur berfungsi). **LIVE:** `npm run check:gemini` dengan `tests/fixtures/audio/lansia-lemas-sintetis.wav` (495 KB, ±15,5 dtk, TTS) → schema valid, usia 70 `USER_STATEMENT`, tanda vital `null`/UNKNOWN, tanpa peringatan; portal di browser (rekaman 23,5 dtk + foto) → hasil valid tampil. Kegagalan nyata teramati: 503 "high demand" sesekali → UI menampilkan pesan + "Coba lagi" tanpa kehilangan rekaman, percobaan ulang berhasil. Mock/unit: schema rusak, kode ilegal, 422 setelah retry, validasi jenis/ukuran (curl) — lulus. **Catatan:** urgensi dapat berbeda antar-panggilan untuk audio yang sama (MERAH vs KUNING) — tetap perkiraan yang perlu ditinjau; latensi di atas target < 3 dtk (lihat log performa).

- [x] **T05 - Peta, dataset lokasi, dan adapter rute** (P0; setelah T02/T03).
  **Kerjakan:** Implementasikan Leaflet/OSM, pengambilan atau seed lokasi Overpass, izin lokasi, pemilihan lokasi manual bila diperlukan, dan OSRM. Tambahkan atribusi serta label ETA perkiraan.

  **Kriteria selesai:** peta/rute berfungsi dan kegagalan layanan tidak membuat ETA palsu. Bukti: AC-04/AC-09.

  **Bukti:** snapshot Overpass 350 RS DKI (`data/hospitals.osm.json`, `npm run fetch:hospitals`), peta Leaflet + tile OSM + atribusi, izin GPS (ditolak → pesan + pilih titik manual di peta, divalidasi wilayah Jabodetabek), adapter OSRM `/table` + `/route` dengan timeout & cache 5 menit, mode mock berlabel. Uji: OSRM publik LIVE mengembalikan ETA (mis. RSCM ±414 dtk/5,8 km dari Senen) dan geometri rute tergambar di peta; dengan `OSRM_BASE_URL` tak terjangkau → `routing_status=FAILED`, `eta_seconds=null`, label "urutan berdasarkan jarak garis lurus", `/api/route` 502 dengan pesan — tidak ada ETA palsu.

## 5. Portal dan pencocokan

- [x] **T06 - Input suara dan peninjauan laporan** (P0; setelah T02/T04).
  **Kerjakan:** Buat rekam/stop/ulang, indikator rekaman, pemrosesan, peninjauan, dan retry; jelaskan pemrosesan sebelum unggah. Sediakan penanganan browser/izin yang tidak mendukung.

  **Kriteria selesai:** laporan 10-15 detik dapat dikirim dan data tidak hilang diam-diam saat gagal. Bukti: AC-01/AC-09.

  **Bukti:** persetujuan sebelum unggah, rekam/berhenti/putar/ulang, timer + target 10–15 dtk, auto-stop 30 dtk, konversi WAV 16 kHz, langkah pemrosesan + batal, galat → "Coba lagi"/"Ubah laporan" dengan rekaman tetap tersimpan, fallback input teks bila mikrofon ditolak/tidak didukung. Diuji di browser pane: izin mikrofon ditolak → pesan + fallback; rekaman 16,6 dtk (aliran nada sintetis karena pane memblokir mikrofon) → WAV 528 KB → HTTP 200 → halaman tinjau; skenario `rusak` → pesan 422 + rekaman tetap ada; input teks → hasil. Diverifikasi pada AI simulasi **dan LIVE** (`gemini-3.5-flash`: aliran WAV ucapan sintetis 23,5 dtk sebagai pengganti mikrofon karena pane memblokir mikrofon). Uji mikrofon nyata di ponsel masih diperlukan.

- [x] **T07 - Mesin pencocokan deterministik** (P0; setelah T03/T04/T05).
  **Kerjakan:** Filter kebutuhan wajib, kesiapan, kebaruan, dan kapasitas sebelum mengurutkan kandidat berdasarkan ETA. Definisikan kebijakan beberapa kebutuhan. Tampilkan alasan cocok/tidak cocok, utama, alternatif, dan tanpa kandidat.

  **Kriteria selesai:** variasi delapan kategori dan status dapat diuji dengan seed yang terkendali. Bukti: AC-03/AC-04.

  **Bukti:** `src/lib/matching/match.ts` (murni). Kebijakan: semua kebutuhan wajib READY + segar + kuota > 0; opsional hanya pemecah seri; pra-urut garis lurus untuk ≤ `MATCH_MAX_ROUTED` lalu ETA; tanpa pelonggaran diam-diam; alasan pengecualian per RS. `tests/unit/matching.test.ts` (8 kode, PENUH/MAINTENANCE/tidak tersedia/kedaluwarsa, kapasitas 0, multi-kebutuhan, tanpa kandidat, urut ETA ≠ jarak, rute gagal/sebagian, tie-break opsional, batas N) — lulus. `/api/match` LIVE: kebutuhan CATH_LAB → RSCM/RS PON/Fatmawati, 7 RS dikecualikan dengan alasan; HEMODIALISA+ANTI_BISA wajib → tanpa kandidat dengan alasan.

- [x] **T08 - Foto pendukung opsional** (P1; setelah T04/T06).
  **Kerjakan:** Tambahkan unggahan/kamera, preview/hapus, validasi file, dan interpretasi foto melalui adapter AI. Tandai angka tidak terbaca dan pertahankan asal datanya.

  **Kriteria selesai:** laporan tetap dapat diteruskan tanpa foto dan kegagalan foto tidak menghasilkan fakta buatan. Bukti: AC-02/AC-11.

  **Bukti (31-10-2026):** kamera (`capture=environment`) & pilih file, validasi jenis, kompresi klien ≤ 1,5 MB (PNG 2400×1800 → JPEG 32 KB), pratinjau/hapus, laporan tetap jalan tanpa foto. **LIVE `gemini-3.5-flash`:** foto glukometer sintetis jelas (`tests/fixtures/photo/glukometer-46-sintetis.jpg`) → "Gula darah 46 mg/dL" berlabel `PHOTO_READING` ("Terbaca dari foto") di API dan di UI; foto buram (`buram-tidak-terbaca.jpg`) → tidak ada angka dikarang, tetapi model menjawab `input_quality=OK`, sehingga server kini menandai foto tanpa angka terbaca sebagai `FOTO_TIDAK_TERBACA` + perlu peninjauan + peringatan (tes unit + uji LIVE ulang lulus). Belum: kamera ponsel nyata.

- [x] **T09 - Hasil triase dan pilihan tujuan** (P0; setelah T05/T06/T07).
  **Kerjakan:** Tampilkan SOAP, perkiraan urgensi beserta teks, alasan, kebutuhan, peta/daftar kandidat, dan data simulasi. Izinkan pengguna meninjau hasil sebelum mengirim rujukan.

  **Kriteria selesai:** portal menyelesaikan alur sampai pilihan tujuan tanpa menganggap hasil AI sebagai konfirmasi rumah sakit. Bukti: AC-02/AC-03/AC-04/AC-10.

  **Bukti:** halaman tinjau: kartu urgensi teks + ikon (MERAH/KUNING/HIJAU/Perlu peninjauan), SOAP dengan chip asal data (Anda katakan / Terbaca dari foto / Perkiraan AI / Tidak diketahui), alasan, "Belum diketahui", kebutuhan dapat diubah (Wajib/Opsional/Abaikan/tambah, ditandai diubah pelapor), catatan validasi, waktu proses, peringatan "bukan diagnosis". Halaman tujuan: peta + kandidat utama/alternatif, ETA berlabel perkiraan OSRM, kuota berbadge simulasi + waktu pembaruan, RS dikecualikan + alasan, keadaan tanpa kandidat (119/112, tinjau kebutuhan), pilih alternatif → rute digambar ulang, catatan "belum konfirmasi rumah sakit"; tombol kirim dinonaktifkan dengan keterangan T10. Diuji di browser pane 375 px (ponsel) dan desktop, dengan AI simulasi dan LIVE (`gemini-3.5-flash`, rute OSRM live: Senen → RSUD Tarakan ±6 menit, 4,8 km).

## 6. Rujukan dan dashboard IGD

- [ ] **T10 - Transaksi rujukan dan kuota** (P0; setelah T03/T07/T09).
  **Kerjakan:** Validasi ulang kesiapan/kapasitas di server; buat permintaan dan reservasi atomik. Terapkan idempotency dan transisi status, termasuk pelepasan kuota dan reset demo yang terdokumentasi.

  **Kriteria selesai:** dua permintaan untuk satu kuota tidak menyebabkan overbooking/kapasitas negatif dan retry tidak membuat reservasi ganda. Bukti: AC-05/AC-07.

- [ ] **T11 - Dashboard petugas dan pembatasan akses** (P0; setelah T03/T10).
  **Kerjakan:** Buat akses petugas demo yang dibatasi per rumah sakit, daftar permintaan, detail SOAP/ETA, notifikasi visual, dan konfirmasi. Bedakan status permintaan dari reservasi.

  **Kriteria selesai:** petugas yang tepat dapat meninjau/mengonfirmasi dan akses tidak sah ditolak. Bukti: AC-05/AC-06/AC-12.

- [ ] **T12 - Sinkronisasi dan pembaruan fasilitas** (P0; setelah T10/T11).
  **Kerjakan:** Hubungkan Realtime, kontrol READY/PENUH/MAINTENANCE, kapasitas, pembaruan portal, serta penanganan event ganda dan reconnect.

  **Kriteria selesai:** dua sesi browser menampilkan perubahan konsisten dan state pulih dari database setelah koneksi putus. Bukti: AC-06/AC-08.

- [ ] **T13 - TTS dan alarm dashboard** (P1; setelah T09/T11).
  **Kerjakan:** Tambahkan speechSynthesis untuk informasi koordinasi yang sesuai, kontrol berhenti, alarm pada perangkat yang mendukung, dan fallback teks/visual. Jangan menghasilkan terapi definitif.

  **Kriteria selesai:** suara dapat dikendalikan dan pemblokiran autoplay tidak menghilangkan informasi. Bukti: AC-11.

## 7. Ketahanan dan pembuktian

- [ ] **T14 - Kelengkapan PWA dan aksesibilitas** (P1; setelah T09/T11).
  **Kerjakan:** Tambahkan manifest/ikon, perilaku pemasangan yang didukung, tombol besar, kontras, label/fokus keyboard, dan layout responsif. Periksa cache agar laporan atau kapasitas lama tidak disajikan sebagai data mutakhir.

  **Kriteria selesai:** portal ponsel dan dashboard desktop dapat digunakan serta mode offline jujur. Bukti: AC-10/AC-11.

- [ ] **T15 - Penanganan gagal dan pemeriksaan akses** (P0; setelah T04/T05/T10/T11/T12).
  **Kerjakan:** Uji izin ditolak, audio tidak jelas, foto tidak terbaca, JSON rusak, AI/rute gagal, kandidat kosong, perubahan kapasitas saat kirim, dan koneksi putus. Periksa rahasia, otorisasi lintas rumah sakit, kebijakan media, persetujuan unggah, retensi, serta penghapusan demo.

  **Kriteria selesai:** pemulihan dapat dilakukan tanpa keberhasilan palsu atau kebocoran akses. Bukti: AC-09/AC-12.

- [ ] **T16 - Uji menyeluruh dan performa** (P0; setelah T10/T11/T12/T15).
  **Kerjakan:** Jalankan skenario proposal dengan data sintetis pada dua sesi, tes kuota serentak/retry, schema, dan pencocokan. Jalankan pemeriksaan kode yang tersedia. Ukur target di GOAL dengan batas waktu yang jelas; catat perangkat, koneksi, model, ukuran masukan, jumlah percobaan, serta kegagalan.

  **Kriteria selesai:** AC memiliki hasil/bukti dan target yang belum tercapai disebutkan. T08/T13/T14 harus ikut diuji sebelum klaim P1 selesai.

## 8. Paket demo dan pengumpulan

- [ ] **T17 - README dan deklarasi** (P0 luaran; setelah T16).
  **Kerjakan:** Tulis cara setup, environment, migrasi/seed/reset, arsitektur, akun demo tanpa rahasia produksi, batas simulasi, retensi, hasil uji, dan kendala tersisa. Tambahkan deklarasi AI/pihak ketiga serta atribusi.

  **Kriteria selesai:** petunjuk dapat diikuti untuk menjalankan demo dari lingkungan yang baru disiapkan.

- [ ] **T18 - Demo publik dan smoke test** (P0 luaran; setelah T15/T16/T17).
  **Kerjakan:** Siapkan konfigurasi Vercel/Supabase dan publikasi GitHub sesuai otorisasi yang tersedia. Uji ulang alur portal-dashboard pada deployment, izin perangkat via HTTPS, Realtime, akses petugas, serta label simulasi.

  **Kriteria selesai:** tautan dan commit tercatat serta smoke test deployment lolos; hasil lokal saja tidak menutup tugas ini.

- [ ] **T19 - Video, pitch deck, dan tag** (P0 luaran; setelah T18).
  **Kerjakan:** Siapkan video demo kurang dari tiga menit, pitch deck, dan tag `submission-24h` sesuai aturan/otorisasi. Perlihatkan input, rekomendasi, rujukan, konfirmasi, serta pembaruan kapasitas; jelaskan simulasi dan batas AI.

  **Kriteria selesai:** berkas/tautan dan commit yang dipresentasikan konsisten.

- [ ] **T20 - Pengumpulan Devpost** (P0 luaran; setelah T01/T17/T18/T19).
  **Kerjakan:** Cocokkan paket dengan brief aktual, siapkan isian dan tautan, lalu lakukan submission bila diotorisasi pengguna.

  **Kriteria selesai:** Pengiriman benar-benar terkonfirmasi dan buktinya dicatat. Jika baru siap kirim, catat status tersebut dan biarkan checklist ini belum selesai.

## 9. Status pekerjaan dan keputusan teknis

Perbarui tabel ini sesuai kondisi implementasi yang benar-benar diperiksa.

| Tugas aktif | Status | Kendala | Langkah berikutnya |
| --- | --- | --- | --- |
| T10 (berikutnya) | T01–T09 selesai dan terverifikasi (31-10-2026): portal berfungsi sampai pilihan tujuan dengan Gemini LIVE (`gemini-3.5-flash`), OSRM live, dan DB lokal PGlite | Kredensial Supabase belum ada (DB lokal dipakai); challenge brief belum diterima; Gemini kadang 503 dan latensi 5–13 dtk; mikrofon/kamera ponsel nyata belum diuji | T10: transaksi rujukan memakai fungsi SQL `create_referral`/`transition_referral` yang sudah teruji; uji perangkat nyata. |

| Keputusan yang diperlukan | Tugas terkait |
| --- | --- |
| Kesesuaian brief, syarat luaran, dan otorisasi publikasi | T01/T18/T20 |
| Model Gemini yang tersedia, kuota, dan konfigurasi environment | T02/T04 |
| Schema rinci, kebutuhan wajib/alternatif, lifecycle dan expiry kuota | T03/T07/T10 |
| Akun petugas demo, kebijakan akses, retensi/penghapusan media | T03/T11/T15 |
| Sumber/versi seed lokasi dan layanan rute | T05 |
| Hosting di Vercel paket Hobby (gratis): batas body ±4,5 MB, durasi fungsi, cron jarang, non-komersial (lihat `SPEC.md` §13; verifikasi di dokumentasi resmi) | T02/T18 |

Catat keputusan final beserta alasan dan dampaknya pada implementasi. Jangan mengubah keputusan terbuka menjadi fakta tanpa verifikasi.

**Keputusan yang sudah diambil (31-10-2026, rinci di `SPEC.md` §18):**

| Keputusan | Alasan/dampak | Tugas |
| --- | --- | --- |
| npm (bukan pnpm), Next.js 16.4.3, React 19.3, Tailwind 4, Zod 4, `@google/genai` 2.32, Vitest 5 | pnpm tidak terpasang; versi dicek di registry npm | T02 |
| `DATA_MODE=local` memakai PGlite (Postgres 17 WASM) dengan migrasi Supabase yang sama; adapter `supabase` tersedia tetapi belum diuji | Docker/Supabase CLI & kredensial tidak tersedia | T03 |
| TTL PENDING 600 dtk; `ACCEPTED` → `ARRIVED` = CONSUMED, `REVOKE` = CANCELLED + RELEASED; expiry lazy tanpa cron | Lifecycle SPEC §8 diwujudkan di `transition_referral()` | T03/T10 |
| `STALE_AFTER_MINUTES=1440` untuk demo; RS Kramat Jati di-seed kedaluwarsa | Belum ada kontrol status dashboard (T12) | T03/T07 |
| Kebijakan pencocokan: semua wajib READY & segar & kuota > 0; opsional = pemecah seri; pelapor dapat mengubah wajib/opsional saat meninjau | AGENTS §5; pengubahan ditandai di UI | T07/T09 |
| Model Gemini `gemini-3.5-flash` + `GEMINI_THINKING_LEVEL=LOW` | `gemini-2.5-flash` ditolak 404 untuk pengguna baru; 3.8/3.7-flash timeout saat diuji; 3.5-flash ±3–13 dtk | T04 |
| Foto ada tanpa angka terbaca → server menandai `FOTO_TIDAK_TERBACA` | Model tidak selalu menandai foto buram | T08 |
| Audio dikonversi klien ke WAV 16 kHz mono sebelum unggah | Kompatibilitas format Gemini lintas browser; ±32 KB/dtk | T04/T06 |
| Seed RSCM tanpa ANTI_BISA | Agar keadaan "tanpa kandidat" dapat didemokan (HEMODIALISA + ANTI_BISA) | T07 |

**Cakupan T01 (dirangkum dari GOAL; brief panitia belum tersedia → belum terverifikasi):**

- Alur demo: portal (persetujuan → lokasi → rekam/teks + foto opsional → ringkasan AI → tinjau → pilih RS) → [T10+] kirim rujukan → dashboard IGD → konfirmasi → status di portal.
- Batas simulasi: seluruh kapasitas/kesiapan RS adalah seed berlabel "simulasi"; lokasi RS dari OSM tidak menyiratkan kemitraan; pasien sintetis; AI hanya perkiraan; ETA OSRM tanpa lalu lintas langsung. Badge mode (AI simulasi, Rute simulasi, Database lokal) tampil di portal.
- Luaran wajib (GOAL §11): aplikasi dua antarmuka + repo GitHub, README, deklarasi AI/pihak ketiga/atribusi, tag `submission-24h`, video < 3 menit, pitch deck, isian Devpost — belum dikerjakan (T17–T20).
- Instruksi pengguna (31-10-2026): kerjakan sampai T09; keamanan bukan fokus → pembatasan akses dan RLS ditulis sesuai SPEC tetapi tidak diuji mendalam pada tahap ini.

## 10. Log verifikasi

Isi setiap bukti dengan commit/versi, perintah atau langkah uji, hasil aktual, dan lokasi bukti. Gunakan `belum diuji`, `lulus`, `gagal`, atau `terhambat` secara eksplisit.

| Area | Tugas/AC | Status awal | Bukti/hasil |
| --- | --- | --- | --- |
| Build, lint, typecheck | T02/T16 | Lulus | 31-10-2026, tanpa commit (folder belum repo Git): `npm run lint` 0 masalah, `npm run typecheck` 0 error, `npm run build` sukses tanpa peringatan (Next 16.4.3, Turbopack), `npm test` 40/40 lulus (4 file). |
| Audio, JSON, dan asal data | T04/T06; AC-01/02 | Lulus (mock + LIVE) | Unit: schema rusak, field hilang, null tetap null, kode ilegal dibuang, Plan berdosis dibuang, angka foto tanpa foto dikosongkan. LIVE `gemini-3.5-flash`: `npm run check:gemini` + 3 percobaan skrip + 2 percobaan portal → semua JSON valid setelah normalisasi; 2 dari ±8 panggilan gagal 503/timeout lalu berhasil saat dicoba ulang. |
| Kapabilitas, alternatif, rute | T05/T07; AC-03/04 | Lulus | `tests/unit/matching.test.ts` 10 kasus lulus; `/api/match` dengan OSRM publik LIVE (Senen → RSCM ±414 dtk); tanpa kandidat & alasan per RS tampil di UI; OSRM tak terjangkau → ETA null + label jarak garis lurus. |
| Rujukan dan konfirmasi | T10/T11; AC-05/06 | Belum diuji | Belum tersedia. |
| Kuota serentak dan idempotency | T10; AC-07 | Belum diuji | Belum tersedia. |
| Realtime dan reconnect | T12; AC-08 | Belum diuji | Belum tersedia. |
| Error dan pemulihan | T15; AC-09 | Sebagian (portal T01–T09) | Browser pane: izin lokasi ditolak → pilih manual; izin mikrofon ditolak → pesan + input teks; AI 422 → coba lagi tanpa kehilangan rekaman; tanpa kandidat → 119/112 + tinjau kebutuhan; banner offline tersedia (belum diuji dengan jaringan diputus). |
| Responsivitas dan aksesibilitas | T14/T16; AC-10 | Sebagian | Portal diuji 375×812 (emulasi ponsel) dan dashboard desktop di browser pane; urgensi/status memakai teks + ikon; fokus keyboard terlihat (`:focus-visible`). Audit aksesibilitas penuh dan perangkat nyata belum. |
| Foto dan suara keluaran | T08/T13; AC-11 | Foto lulus (LIVE); TTS belum | Foto jelas → 46 mg/dL `PHOTO_READING`; foto buram → tanpa angka + `FOTO_TIDAK_TERBACA`; kompresi & hapus foto berfungsi. TTS (T13) belum dikerjakan. |
| Akses, rahasia, dan data simulasi | T11/T15; AC-12 | Belum diuji | Belum tersedia. |
| Performa | T16; tabel target GOAL | Diukur awal (LIVE, belum formal) | 31-10-2026, Windows 11 desktop, jaringan rumah, `gemini-3.5-flash` LOW. Respons AI (waktu penyedia): audio WAV 495 KB → 9,5 / 5,5 dtk; teks + foto 26 KB → 13,2 dtk; audio + foto buram → 8,6 / 9,9 dtk; portal (WAV 23,5 dtk + foto) → 6,9 dtk. **Target < 3 dtk belum tercapai.** Mock: ±0,6 dtk (tidak dihitung). Pengukuran formal T16. |
| Deployment dan submission | T18/T19/T20 | Belum dilakukan | Belum tersedia. |

## 11. Batas penyelesaian agent

Gunakan `GOAL.md` untuk membedakan siap demo teknis, paket siap dikumpulkan, dan submission yang benar-benar telah dilakukan. Jangan menandai tugas publikasi atau pengumpulan selesai hanya karena bahan sudah disiapkan.

Validasi klinis, kerja sama rumah sakit, verifikasi kapasitas nyata, dan uji lapangan adalah dependensi eksternal di luar implementasi MVP. Catat kebutuhan tersebut sebagai keterbatasan atau tindak lanjut; jangan mengklaim sudah terpenuhi melalui tes kode atau data simulasi.
