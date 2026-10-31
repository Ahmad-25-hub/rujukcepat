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

- [x] **T10 - Transaksi rujukan dan kuota** (P0; setelah T03/T07/T09).
  **Kerjakan:** Validasi ulang kesiapan/kapasitas di server; buat permintaan dan reservasi atomik. Terapkan idempotency dan transisi status, termasuk pelepasan kuota dan reset demo yang terdokumentasi.

  **Kriteria selesai:** dua permintaan untuk satu kuota tidak menyebabkan overbooking/kapasitas negatif dan retry tidak membuat reservasi ganda. Bukti: AC-05/AC-07.

  **Bukti (31-10-2026):** `POST /api/referrals` (wajib `Idempotency-Key`; ETA dihitung ulang server, bukan dari klien) memanggil `create_referral()` (cek ulang kapabilitas wajib READY+segar dan kuota, kunci baris, rujukan `PENDING` + reservasi `HELD` atomik). `GET /api/referrals/:id`, `POST …/cancel` (pelapor), `POST …/decision` (petugas), `POST /api/demo/reset` (admin + konfirmasi `RESET`). Migrasi `0003_staff_ops.sql` memperbaiki `transition_referral` (ARRIVED sekali; REVOKE tidak sah setelah tiba). Portal: tombol kirim aktif (nonaktif saat mengirim/offline, kunci idempotensi per percobaan, 409 → pesan + daftar tujuan dimuat ulang) dan langkah **Status** (status permintaan, kuota simulasi, ringkasan AI, hitung mundur expiry, batalkan). Tes `tests/integration/api.test.ts` (lulus): kirim → `PENDING`+`HELD`, kuota −1; retry kunci sama → rujukan sama, kuota tetap; 3 klik serentak kunci sama → satu rujukan; **dua pelapor untuk satu kuota (Tarakan) → 201 + 409 `NO_CAPACITY`, kuota 0 tidak negatif**; kapasitas nol → 409; kapabilitas berubah → 409 `CAPABILITY_CHANGED` tanpa mengunci kuota; tolak/batal/expiry → kuota dilepas tepat sekali (aksi kedua 409); terima tidak melepas kuota; ARRIVED → `CONSUMED`; reset menghapus rujukan & memulihkan seed. Browser: klik kirim 3× sinkron → kuota RSCM 3 → 2 (satu reservasi). Skrip `measure` juga memeriksa balapan kuota pada server berjalan (201/409, kuota 0). **Belum diuji:** konkurensi multi-koneksi di Postgres/Supabase sungguhan (PGlite satu koneksi; penguncian `FOR UPDATE` tetap perlu dibuktikan di Supabase).

- [x] **T11 - Dashboard petugas dan pembatasan akses** (P0; setelah T03/T10).
  **Kerjakan:** Buat akses petugas demo yang dibatasi per rumah sakit, daftar permintaan, detail SOAP/ETA, notifikasi visual, dan konfirmasi. Bedakan status permintaan dari reservasi.

  **Kriteria selesai:** petugas yang tepat dapat meninjau/mengonfirmasi dan akses tidak sah ditolak. Bukti: AC-05/AC-06/AC-12.

  **Bukti (31-10-2026):** login petugas (`/dashboard/login`, `POST /api/staff/login`; kata sandi dari env `DEMO_STAFF_PASSWORD`, hash scrypt di `staff_credentials`, cookie `rc_staff` bertanda tangan HMAC, 8 jam) dengan 6 akun demo (5 RS contoh + admin). Dashboard `/dashboard`: antrean `PENDING` urut urgensi lalu waktu + "sudah diproses", alert merah + judul tab "(n) Permintaan baru", detail (status permintaan dan reservasi kuota **terpisah**, ETA berlabel, ringkasan, SOAP berasal-data, kebutuhan, riwayat kejadian, hitung mundur), aksi Terima/Tolak/Pasien tiba/Batalkan penerimaan (loading, cegah klik ganda, waktu simpan ditampilkan), panel reset admin. Tes API (lulus): sandi salah/akun tak ada → 401; antrean hanya RS sendiri; **petugas RS lain → 403 (baca & keputusan), tanpa sesi → 401, pelapor lain → 403, pelapor pemilik tidak dapat memutuskan, cookie palsu → 401, PATCH fasilitas RS lain → 403, reset non-admin → 403**; respons tidak memuat `requester_id`/hash. Browser: login → dashboard memuat; rujukan dari tab portal muncul sebagai alert; Terima mengubah tombol menjadi "Pasien tiba"/"Batalkan penerimaan". Keamanan bukan fokus proyek (instruksi pengguna): RLS ditulis di migrasi tetapi **tidak diuji pada Supabase sungguhan**; akses ditegakkan di route.

- [x] **T12 - Sinkronisasi dan pembaruan fasilitas** (P0; setelah T10/T11).
  **Kerjakan:** Hubungkan Realtime, kontrol READY/PENUH/MAINTENANCE, kapasitas, pembaruan portal, serta penanganan event ganda dan reconnect.

  **Kriteria selesai:** dua sesi browser menampilkan perubahan konsisten dan state pulih dari database setelah koneksi putus. Bukti: AC-06/AC-08.

  **Bukti (31-10-2026):** `PATCH /api/facilities/:id` → fungsi SQL `update_facility()` (atomik, log event tanpa data kesehatan; kapabilitas hanya yang ditawarkan RS; `0 ≤ tersedia ≤ total`; "Konfirmasi" menyegarkan status kedaluwarsa). Dashboard: kontrol READY/PENUH/MAINTENANCE per kapabilitas + editor kapasitas. Sinkronisasi: `notifyChange()` setelah transaksi → **SSE `/api/stream`** (mode lokal) dan, untuk mode `supabase`, broadcast Supabase Realtime dari server; klien (`useSync`) memperlakukan event sebagai pemicu ambil-ulang (event ganda aman), rekonsiliasi penuh saat setiap (re)connect/online/tab terlihat, polling 5 dtk + badge "Sinkronisasi terbatas" bila putus. Pengukuran browser: PATCH `IGD_DASAR`→PENUH 178 ms; `/api/match` setelahnya mengecualikan RSCM ("IGD_DASAR: PENUH") dan kandidat utama berganti; pengembalian ke READY berhasil. Dua sesi: rujukan dari tab portal → dashboard menerima (badge "Tersambung (SSE) · 17 ms"); Terima di dashboard → portal berubah ke "Diterima petugas IGD". **Pemulihan:** server dihentikan → badge dashboard "Sinkronisasi terbatas"; `db:reset` dijalankan saat mati; server dinyalakan → dashboard otomatis "Tersambung" dan daftar kosong sesuai database. Tes: event hanya ke petugas RS terkait/pelapor pemilik, tidak membawa `requester_id`. **Belum diuji:** Supabase Realtime sungguhan (tanpa kredensial) — jalur kode ada tetapi tidak terbukti; pemulihan sisi portal setelah putus hanya diuji lewat logika yang sama (hook `useSync`).

- [x] **T13 - TTS dan alarm dashboard** (P1; setelah T09/T11).
  **Kerjakan:** Tambahkan speechSynthesis untuk informasi koordinasi yang sesuai, kontrol berhenti, alarm pada perangkat yang mendukung, dan fallback teks/visual. Jangan menghasilkan terapi definitif.

  **Kriteria selesai:** suara dapat dikendalikan dan pemblokiran autoplay tidak menghilangkan informasi. Bukti: AC-11.

  **Bukti (31-10-2026):** `SpeakPanel` (portal, langkah Status): teks panduan koordinasi (status rujukan, ETA berlabel, 119/112, butir Plan AI yang sudah disaring dosis) selalu tampil; tombol Putar/Berhenti (hanya diputar atas klik pengguna); fallback bila `speechSynthesis` tidak ada atau suara id-ID tidak ditemukan. Browser pane: `speechSynthesis` ada, `speaking=true` setelah Putar (Putar nonaktif/Berhenti aktif), `speaking=false` setelah Berhenti; pesan "Suara Bahasa Indonesia tidak ditemukan… teks tetap tersedia" tampil (pane tanpa suara id-ID). Alarm dashboard (Web Audio, `Aktifkan alarm` lewat klik, tersimpan di localStorage): alert visual + judul tab selalu muncul walau alarm mati; saat diblokir tampil catatan "Alarm suara diblokir…". **Belum diverifikasi:** bunyi alarm dan suara TTS tidak dapat didengar di lingkungan pengujian; perilaku di perangkat nyata (iOS Safari, Android) belum diuji.

## 7. Ketahanan dan pembuktian

- [x] **T14 - Kelengkapan PWA dan aksesibilitas** (P1; setelah T09/T11).
  **Kerjakan:** Tambahkan manifest/ikon, perilaku pemasangan yang didukung, tombol besar, kontras, label/fokus keyboard, dan layout responsif. Periksa cache agar laporan atau kapasitas lama tidak disajikan sebagai data mutakhir.

  **Kriteria selesai:** portal ponsel dan dashboard desktop dapat digunakan serta mode offline jujur. Bukti: AC-10/AC-11.

  **Bukti (31-10-2026):** `app/manifest.ts` (standalone, `lang: id`, ikon 192/512 + maskable, shortcut portal/dashboard) → `/manifest.webmanifest` 200 `application/manifest+json` pada `next start`; ikon PNG dibuat `npm run make:icons` (salib putih pada merah); `apple-touch-icon`, `theme-color`; tombol "Pasang aplikasi" (`beforeinstallprompt`) dan petunjuk iOS di beranda; service worker `public/sw.js` + `public/offline.html` (hanya aset `/_next/static` berhash + ikon + halaman offline; **tidak pernah** `/api/*` atau HTML; navigasi offline → halaman offline jujur dengan tel 119/112, tanpa antrean). Tes `tests/unit/sw.test.ts` (6, lulus) pada lingkungan SW tiruan: tidak menyentuh `/api/*`/non-GET/lintas origin, navigasi offline → `/offline.html`, HTML tidak di-cache, aset statis cache-first, cache lama dihapus. Banner offline di portal (kirim nonaktif) dan dashboard; badge sinkron berteks+ikon; skip link "Lompat ke konten utama", `id="main"`, fokus terlihat (`:focus-visible`), tombol besar (≥ 44 px), status/urgensi teks+ikon. Portal 375 px: tidak ada overflow horizontal (`scrollWidth` = 375). **Belum diuji:** registrasi SW di browser pane gagal ("unknown error fetching the script", pane tidak mendukung SW; header sw.js benar) sehingga pemasangan/offline nyata perlu uji Chrome/Android/iOS; audit aksesibilitas penuh (pembaca layar, kontras terukur, axe) belum dilakukan.

- [x] **T15 - Penanganan gagal dan pemeriksaan akses** (P0; setelah T04/T05/T10/T11/T12).
  **Kerjakan:** Uji izin ditolak, audio tidak jelas, foto tidak terbaca, JSON rusak, AI/rute gagal, kandidat kosong, perubahan kapasitas saat kirim, dan koneksi putus. Periksa rahasia, otorisasi lintas rumah sakit, kebijakan media, persetujuan unggah, retensi, serta penghapusan demo.

  **Kriteria selesai:** pemulihan dapat dilakukan tanpa keberhasilan palsu atau kebocoran akses. Bukti: AC-09/AC-12.

  **Bukti (31-10-2026):** tes otomatis `tests/integration/failures.test.ts` + `match-failures.test.ts` (12, lulus): tanpa persetujuan → `CONSENT_REQUIRED` (server); tanpa masukan/format audio salah (415)/audio & teks & foto berlebih (413/415); keluaran AI rusak → 422 `AI_OUTPUT_INVALID` tanpa `data`; audio tidak jelas → `AUDIO_TIDAK_JELAS` + `needs_review`; foto tanpa angka terbaca → tidak ada angka dikarang; **analisis tidak menulis apa pun ke database dan skema tidak punya kolom/tabel media**; rate limit 429 (12 analisis/menit/klien; 10 login/menit); **OSRM tak terjangkau (`ROUTING_MODE=live`, alamat mati) → `routing_status=FAILED`, `eta_seconds=null`, urut jarak garis lurus + keterangan**; tanpa kandidat (HEMODIALISA+ANTI_BISA wajib) → alasan untuk 10 RS; kapasitas nol tersaring; lokasi di luar Jabodetabek/payload rusak/kode palsu → 400. Akses lintas RS: lihat T11 (403/401). Kapasitas berubah saat kirim: tes API 409 dan **UI browser** (kuota Tarakan diambil pihak lain sebelum klik kirim → pesan "Kuota rujukan rumah sakit ini sudah habis… Daftar tujuan sudah diperbarui", tujuan dipilih ulang otomatis). Koneksi putus: T12 (server mati → "Sinkronisasi terbatas" → pulih), banner offline portal/dashboard, kirim nonaktif saat offline. Izin lokasi/mikrofon ditolak, AI 422, tanpa kandidat: T05/T06/T09 (browser). `npm run check:secrets` memindai `.next/static`: nilai `SESSION_SECRET`/`DEMO_STAFF_PASSWORD` tidak ada, terbukti mendeteksi nilai yang disisipkan; log server hanya kode galat/status (dicek `grep console.`). Retensi/penghapusan: audio/foto tidak disimpan, rujukan demo sampai reset (UI admin `RESET`, `npm run db:reset`), didokumentasikan di README. **Belum diuji:** RLS/kebijakan media pada Supabase sungguhan (tidak ada Storage dipakai), `GEMINI_API_KEY`/kunci Supabase pada pemindaian bundle (belum terisi), perangkat nyata.

- [x] **T16 - Uji menyeluruh dan performa** (P0; setelah T10/T11/T12/T15).
  **Kerjakan:** Jalankan skenario proposal dengan data sintetis pada dua sesi, tes kuota serentak/retry, schema, dan pencocokan. Jalankan pemeriksaan kode yang tersedia. Ukur target di GOAL dengan batas waktu yang jelas; catat perangkat, koneksi, model, ukuran masukan, jumlah percobaan, serta kegagalan.

  **Kriteria selesai:** AC memiliki hasil/bukti dan target yang belum tercapai disebutkan. T08/T13/T14 harus ikut diuji sebelum klaim P1 selesai.

  **Bukti (31-10-2026, tanpa commit):** `npm run lint`/`typecheck`/`build` lulus; `npm test` 78 tes (8 file) lulus; juga lulus pada salinan bersih proyek (`npm ci` + env minimum README). Skrip `npm run measure` (`scripts/measure.ts`, dua sesi HTTP+SSE) pada `next start`, **MOCK**, `localhost`, Windows 11 / Ryzen 7 6800H / Node 22, teks→audio WAV 495 KB + foto 26 KB dikirim, 10 percobaan, 0 gagal (`docs/hasil-ukur-mock.json`): analisis (penyedia) median 604 ms (**mock menunda 600 ms; tidak bermakna untuk target <3 dtk**), pencocokan 11 ms, kirim rujukan 16 ms, koordinasi mesin (analisis+cocok+kirim, tanpa waktu manusia) 686 ms vs target <15 dtk, kirim→alert dashboard 18 ms, **sinkron server→penerima (SSE) 4 ms (maks 5) vs target <200 ms** (satu mesin/jam sama; belum sampai UI tergambar), keputusan petugas→tersimpan 46 ms (maks 51) vs <2 dtk, keputusan→portal 47 ms; balapan 1 kuota → 201/409, kuota 0. **LIVE (Gemini) tidak diukur ulang di sesi ini** (tanpa `GEMINI_API_KEY`); angka LIVE terakhir (T04, §10): 5,5–13,2 dtk → **target <3 dtk belum tercapai**.

  | AC | Status | Bukti |
  | --- | --- | --- |
  | AC-01 | Lulus (mock+LIVE T04) | Schema valid; hasil tidak valid tidak dipakai (422). Rekaman 10–15 dtk LIVE dari T04/T06; mikrofon nyata belum. |
  | AC-02 | Lulus | Nilai tak dilaporkan `null`; chip asal data di portal dan dashboard; foto buram tanpa angka. |
  | AC-03 | Lulus | Tes pencocokan + `/api/match`; PENUH/MAINTENANCE/kapasitas 0/kedaluwarsa tersaring; alternatif dan tanpa kandidat. |
  | AC-04 | Lulus | ETA berlabel; OSRM gagal → ETA null (tes). |
  | AC-05 | Lulus | Satu pengiriman → satu rujukan di dashboard (ringkasan, tujuan, waktu, ETA). |
  | AC-06 | Lulus | Konfirmasi terlihat di portal; status permintaan, hasil AI, dan kuota terpisah. |
  | AC-07 | Lulus (PGlite) | Tes API + `measure`: 201/409, retry tidak mengurangi dua kali, pelepasan sekali. Belum di Supabase sungguhan. |
  | AC-08 | Sebagian | Perubahan fasilitas memengaruhi `/api/match`/dashboard; pemulihan dashboard setelah putus teruji; Supabase Realtime belum. |
  | AC-09 | Lulus | Izin ditolak, AI 422/503, tanpa kandidat, koneksi putus: lihat T05/T06/T15. |
  | AC-10 | Sebagian | Portal 375 px dan dashboard desktop; status teks+ikon; fokus keyboard; belum perangkat nyata/pembaca layar. |
  | AC-11 | Sebagian | Foto (LIVE, T08) dan TTS (kontrol+fallback) diuji di browser pane; kamera/suara perangkat nyata belum. |
  | AC-12 | Sebagian | Pemindaian bundle lulus (nilai yang ada); akses petugas terbatas (tes); label simulasi; RLS Supabase belum diuji; kunci Gemini/Supabase belum dipindai. |

  **T08/T13/T14 ikut diuji** (bukti masing-masing). Klaim P1 selesai dibatasi pada implementasi + uji browser pane/tes otomatis; uji perangkat nyata belum.

## 8. Paket demo dan pengumpulan

- [x] **T17 - README dan deklarasi** (P0 luaran; setelah T16).
  **Kerjakan:** Tulis cara setup, environment, migrasi/seed/reset, arsitektur, akun demo tanpa rahasia produksi, batas simulasi, retensi, hasil uji, dan kendala tersisa. Tambahkan deklarasi AI/pihak ketiga serta atribusi.

  **Kriteria selesai:** petunjuk dapat diikuti untuk menjalankan demo dari lingkungan yang baru disiapkan.

  **Bukti (31-10-2026):** `README.md` memuat setup, tabel environment, akun demo (kata sandi dari env, bukan repo), skenario demo, seed/reset (CLI + UI), panduan Supabase (berlabel belum diuji), arsitektur, pemeriksaan, hasil uji dan performa (target vs aktual, MOCK vs LIVE terpisah), selisih cakupan, privasi/retensi, deklarasi AI/pihak ketiga/atribusi, serta keterbatasan; `.env.example` diperbarui. **Diverifikasi dari salinan bersih** (file terlacak + tak-terabaikan disalin ke folder baru): `npm ci` → `.env.local` minimum dari README → `npm run lint`, `typecheck`, `npm test` (78 lulus), `npm run build`, `npm run check:secrets` lulus; `next start` → `/lapor` 200, login petugas 200 dengan sandi env, sandi salah 401. Bahan paket T18–T20: `docs/SMOKE-TEST.md`, `docs/DEMO-SCRIPT.md`, `docs/PITCH-DECK.md`, `docs/DEVPOST.md` (draf, belum final).

- [ ] **T18 - Demo publik dan smoke test** (P0 luaran; setelah T15/T16/T17).
  **Kerjakan:** Siapkan konfigurasi Vercel/Supabase dan publikasi GitHub sesuai otorisasi yang tersedia. Uji ulang alur portal-dashboard pada deployment, izin perangkat via HTTPS, Realtime, akses petugas, serta label simulasi.

  **Kriteria selesai:** tautan dan commit tercatat serta smoke test deployment lolos; hasil lokal saja tidak menutup tugas ini.

  **Status (31-10-2026): TERHAMBAT — belum dikerjakan.** Membutuhkan keputusan/otorisasi pengguna: akun Vercel (Hobby), project Supabase + kredensial, kunci Gemini, repositori GitHub (publikasi), dan izin commit/push. Pekerjaan independen yang sudah siap: build produksi lulus lokal, `vercel.json`, `docs/SMOKE-TEST.md` (daftar periksa + risiko: Realtime Supabase, pooler, rate limit per instans), skrip `check:secrets` dan `measure` yang dapat dijalankan terhadap URL deployment.

- [ ] **T19 - Video, pitch deck, dan tag** (P0 luaran; setelah T18).
  **Kerjakan:** Siapkan video demo kurang dari tiga menit, pitch deck, dan tag `submission-24h` sesuai aturan/otorisasi. Perlihatkan input, rekomendasi, rujukan, konfirmasi, serta pembaruan kapasitas; jelaskan simulasi dan batas AI.

  **Kriteria selesai:** berkas/tautan dan commit yang dipresentasikan konsisten.

  **Status (31-10-2026): TERHAMBAT — bergantung T18.** Siap: naskah video `docs/DEMO-SCRIPT.md` (< 3 menit) dan kerangka deck `docs/PITCH-DECK.md`. Belum ada: video, berkas deck, tag `submission-24h` (tag hanya setelah commit final dan otorisasi pengguna). Repo belum ada commit untuk pekerjaan T10–T17.

- [ ] **T20 - Pengumpulan Devpost** (P0 luaran; setelah T01/T17/T18/T19).
  **Kerjakan:** Cocokkan paket dengan brief aktual, siapkan isian dan tautan, lalu lakukan submission bila diotorisasi pengguna.

  **Kriteria selesai:** Pengiriman benar-benar terkonfirmasi dan buktinya dicatat. Jika baru siap kirim, catat status tersebut dan biarkan checklist ini belum selesai.

  **Status (31-10-2026): TERHAMBAT — belum siap kirim.** Challenge brief panitia belum pernah diberikan (kesesuaian brief tidak terverifikasi), tautan demo/repo/video/deck belum ada, dan pengiriman memerlukan otorisasi eksplisit pengguna. Draf isian: `docs/DEVPOST.md` (tautan masih kosong).

## 9. Status pekerjaan dan keputusan teknis

### Pemindahan penjelasan simulasi ke README (31-10-2026)

- [x] Permintaan pengguna: hapus penjelasan demo/simulasi yang berulang dari tampilan dan pusatkan di README. Banner/badge beranda, portal, kartu fasilitas, login, dan dashboard dihapus; metadata/PWA serta teks status/galat diselaraskan. Komponen badge yang tidak lagi dipakai dihapus.
- **Keputusan cakupan:** instruksi langsung ini menggantikan ketentuan label simulasi terlihat dalam GOAL §4/§7 dan AGENTS §5/§7/§8. Bukti historis di bawah mengenai badge adalah kondisi sebelum perubahan ini. README kini menjelaskan data sintetis, status/kapasitas seed, AI mock, rute mock, pratinjau GPS, serta mode database/sinkronisasi. Penanda data `is_simulated`, adapter, konfigurasi, dan logika pencocokan tetap sama.
- **Perilaku UI:** pratinjau perjalanan dibedakan dari GPS, hasil fixture disebut hasil contoh, perkiraan garis lurus dibedakan dari rute OSRM. Persetujuan pemrosesan, batas AI, atribusi peta, kondisi offline/gagal, serta konfirmasi reset tetap tersedia. Email akun `@rujukcepat.demo` tetap dipakai agar akses akun tidak berubah.
- **Bukti:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (**87/87, 10 file**) lulus. Ekspektasi tiga tes lama diperbarui mengikuti teks baru, tanpa mengubah perilaku yang diuji. Pemeriksaan teks HTML hasil build untuk `/`, `/lapor`, `/dashboard/login` lulus: tidak ada penjelasan/badge demo atau simulasi (domain akun dikecualikan). `git diff --check` lulus setelah merapikan akhir berkas.
- **Batas verifikasi dan langkah berikutnya:** uji interaksi browser/perangkat dan integrasi layanan nyata tidak diulang untuk perubahan teks ini; pemeriksaan HTML bukan audit visual. Perubahan lokal, belum commit/push/deploy. Untuk tampil di situs publik, terapkan melalui deployment berikutnya sesuai otorisasi pengguna.

Perbarui tabel ini sesuai kondisi implementasi yang benar-benar diperiksa.

### Tindak lanjut koneksi Supabase (31-10-2026)

- [x] Dukungan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dan `SUPABASE_SECRET_KEY` baru (fallback key lama), normalisasi URL, perbaikan pencatatan channel saat reconnect, pool SQL max 1 + timeout + penutupan koneksi, serta skrip `supabase:setup`/`check:supabase`. Migrasi `0004_server_only_rpc.sql` menutup akses anon/authenticated ke lima fungsi mutasi agar otorisasi route tidak dapat dilewati melalui Data API. `.env.example`, README, SPEC, dan smoke test diperbarui; perubahan pengguna pada contoh key digabung tanpa duplikasi URL.
- [ ] **Koneksi menyeluruh pada project Supabase nyata belum selesai.** URL + publishable key di `.env.local` nyata telah diuji: endpoint Auth settings HTTP 200. `SUPABASE_DB_URL` dan `SUPABASE_SERVICE_ROLE_KEY` masih placeholder; `SUPABASE_SECRET_KEY` belum diisi. `SESSION_SECRET` dan `DEMO_STAFF_PASSWORD` juga placeholder. Pengguna diminta melengkapi file lokal, bukan mengirim rahasia ke chat. `DATA_MODE=local` dipertahankan sampai konfigurasi server tersedia. Tidak ada migrasi/seed/reset pada database remote, deployment, commit/push/tag, atau submission.

**Bukti:** `npm install --ignore-scripts` memasang dependensi terkunci yang belum ada (`pg` termasuk 15 paket; lockfile tidak berubah). `npm run lint`, `npm run typecheck`, `npm test` (**84/84**, 9 file), dan `npm run build` lulus. Tes tambahan: publishable key saat anon placeholder, fallback key lama, penolakan URL/secret key publik, konfigurasi SQL belum terisi, dan hak EXECUTE lima fungsi ditolak untuk anon/authenticated pada PGlite. `npm run check:supabase` keluar 1 dengan HTTP 200 untuk URL/key publik dan status **BELUM** untuk SQL/Realtime; ini bukan kegagalan key publik. Setup/migrasi idempoten diuji pada PGlite; runner setup `pg`, RLS remote, transaksi multi-koneksi, broadcast server–klien, dan dua sesi Supabase masih **belum diuji**.

**Pemeriksaan akhir:** lint dan typecheck diulang setelah perubahan skrip, keduanya lulus. `npm run check:secrets` lulus (20 berkas klien, 1 nilai rahasia yang terisi dipindai: Gemini). `npm run supabase:setup` keluar 1 dengan `SUPABASE_DB_URL_MISSING` sebelum membuka koneksi remote; tidak ada perubahan database remote.

**Langkah berikutnya:** setelah connection string + secret key tersedia, jalankan `npm run supabase:setup` (seluruh migrasi satu transaksi, seed hanya bila RS kosong), `npm run check:supabase`, aktifkan `DATA_MODE=supabase`, mulai ulang aplikasi, lalu uji kirim/terima/kapasitas pada dua sesi dan catat hasil nyata. Scope ini menyambungkan layanan, bukan otorisasi deployment T18.

**Pemeriksaan lanjutan 31-10-2026 (menggantikan status koneksi di atas):**

- [x] `SUPABASE_DB_URL` terbaru terhubung ke PostgreSQL nyata. `npm run supabase:setup` berhasil menerapkan empat migrasi + seed awal 10 RS; pengulangan melewati seluruh migrasi/seed tanpa reset. Fungsi transaksi tidak dapat di-EXECUTE anon/authenticated.
- [x] URL dipulihkan dari project pada connection string; publishable key dipulihkan dari build lokal sebelumnya dan diverifikasi HTTP 200 pada project yang sama. `SESSION_SECRET` acak dibuat di `.env.local` tanpa dicetak; `DATA_MODE=supabase` diaktifkan. File rahasia tidak dilacak Git.
- [x] Uji transaksi **SQL Supabase nyata**: satu `create_referral` mengunci satu slot; retry key sama mengembalikan rujukan sama; ACCEPT mempertahankan HELD; REVOKE mengembalikan slot; pelepasan kedua tidak mengembalikan slot lagi; role anon tidak dapat membaca rujukan uji. Seluruh perubahan uji di-ROLLBACK sehingga tidak menyisakan laporan atau mengubah kapasitas. Ini satu transaksi/koneksi, **bukan bukti konkurensi multi-koneksi**.
- [x] Smoke test Next.js produksi lokal (port 4317; proses uji dihentikan): `/api/status` melaporkan SUPABASE; `/api/facilities` HTTP 200 + 10 RS; `/api/referrals` tanpa sesi HTTP 401. Tidak memanggil Gemini/rute eksternal pada pemeriksaan ini.
- [ ] Realtime dan alur dua sesi masih tertunda: `SUPABASE_SECRET_KEY` terisi tetapi format tidak dikenali (bukan `sb_secret_`/JWT), endpoint Auth dan Data API menolak HTTP 401. `DEMO_STAFF_PASSWORD` masih placeholder. Pengguna diminta mengganti secret key dari API Keys project yang sama dan mengisi sandi petugas; nilai tidak diminta di chat. Publikasi/deployment tetap tidak dilakukan.

Skrip `check:supabase` diperbaiki agar tetap memeriksa SQL/secret key ketika konfigurasi publik belum lengkap, serta melewati uji Realtime ketika key server ditolak. Hasil aktual: URL/key publik 200, SQL/schema/seed/izin fungsi lulus, secret key 401 → exit 1 dengan keterangan Realtime belum lengkap. Typecheck lulus setelah perubahan. **Langkah berikutnya terbaru:** ganti secret key + isi password petugas di `.env.local`; jalankan ulang `check:supabase`, mulai ulang server pengguna, uji login/kirim/konfirmasi dan Realtime dua sesi. Kredensial lain yang valid dipertahankan.

**Pemeriksaan akhir lanjutan:** `npm run lint`, `npm run typecheck`, `npm test` (84/84, 9 file), `npm run build`, dan `git diff --check` lulus. `.env.local` dipastikan diabaikan Git. Pengujian SQL nyata dan smoke test HTTP di atas terpisah dari tes otomatis PGlite.

**Pemeriksaan ulang setelah pengguna mengganti secret key (31-10-2026, status terbaru):**

- [x] `npm run check:supabase` **exit 0**. URL + publishable key HTTP 200; PostgreSQL/schema/seed 10 RS lulus; izin lima fungsi transaksi khusus server lulus; **secret key server HTTP 200**; **broadcast Realtime server → klien dengan kunci publik lulus** pada kanal acak berisi pesan teknis sementara. `DATA_MODE=supabase` aktif. Tidak ada data pasien atau kapasitas yang diubah oleh pemeriksaan ini.
- [x] `npm run check:secrets` lulus pada bundle yang ada: 20 berkas, 4 nilai rahasia terbaru diperiksa (Gemini, secret key Supabase, DB URL, session secret), tanpa mencetak nilainya. Tidak ada perubahan kode aplikasi pada pemeriksaan ulang ini; lint/typecheck/build/84 tes di atas adalah hasil pemeriksaan sebelumnya.
- [ ] `DEMO_STAFF_PASSWORD` masih placeholder. Alur login petugas, kirim/konfirmasi rujukan pada dua sesi, reconnect browser, serta konkurensi multi-koneksi tetap belum diuji. Isi sandi demo, mulai ulang aplikasi agar memakai environment terbaru, lalu lakukan uji dua sesi. Koneksi layanan database + Realtime sekarang terverifikasi; T18 deployment dan T19–T20 tetap belum selesai.

**Diagnosis deployment Vercel milik pengguna (31-10-2026):** pengguna sudah menerbitkan `https://rujukcepat.vercel.app` dan melaporkan kegagalan memuat fasilitas. Pemeriksaan read-only nyata: `GET /api/status` HTTP 200 dengan `data_mode=LOCAL`, AI/rute LIVE; `GET /api/facilities` HTTP 503 `FACILITY_DATA_UNAVAILABLE`. Ini membuktikan konfigurasi `DATA_MODE=supabase` belum berlaku pada deployment tersebut; isi environment dashboard dan error filesystem tidak diperiksa, sehingga alasan mode lokal aktif (variabel hilang/salah/scope/deployment lama) belum dapat dipastikan. Pengguna diarahkan menetapkan `DATA_MODE=supabase` sebagai Config pada scope Production, memastikan kredensial Supabase sesuai `.env.local`, lalu Redeploy karena perubahan env hanya berlaku pada deployment baru. Tidak ada perubahan kode aplikasi atau redeploy oleh agent. T18 belum selesai: uji ulang endpoint, login, rujukan, dan Realtime sesudah deployment diperbaiki masih diperlukan.

**Pemeriksaan dashboard petugas (31-10-2026):** kode `/dashboard`, `/dashboard/login`, `DashboardApp`, panel fasilitas, detail rujukan, login/sesi petugas telah diperiksa. Implementasi mencakup antrean masuk, SOAP/urgensi/ETA, Terima/Tolak/Pasien tiba/Batalkan penerimaan, pembaruan kapasitas/kapabilitas RS, alarm visual/suara, sinkronisasi, serta reset admin dengan konfirmasi. Pemeriksaan deployment read-only: `/dashboard` dan `/dashboard/login` HTTP 200; `/api/staff/me` tanpa sesi HTTP 401; **`/api/status` kini SUPABASE** (menggantikan hasil LOCAL pada pemeriksaan sebelumnya). `DEMO_STAFF_PASSWORD` lokal masih placeholder; konfigurasi password Vercel dan login dengan kredensial benar tidak diperiksa. Tidak ada perubahan kode atau transaksi database. Alur terautentikasi pada deployment belum dapat dinyatakan lulus hanya dari pemeriksaan halaman ini.

**Perbaikan error login non-JSON HTTP 500 (31-10-2026):** screenshot pengguna menunjukkan `BAD_RESPONSE` setelah login. Pemeriksaan deployment: `/api/status` SUPABASE, `/api/facilities` HTTP 200 + 10 RS, `/api/staff/me` tanpa sesi HTTP 401; satu POST login dengan password acak yang sengaja salah HTTP 401 JSON `INVALID_CREDENTIALS`. POST dapat menyinkronkan akun demo dari env server melalui implementasi yang ada; tidak mengubah rujukan/kapasitas. Data fasilitas dan jalur penolakan password bekerja. Dugaan terkuat adalah `SESSION_SECRET` belum berlaku saat membuat cookie setelah password benar; environment/log Vercel tidak diakses, jadi penyebab remote belum dikonfirmasi langsung.

Bug kode terbukti melalui tes: password benar + NODE_ENV produksi + secret hilang/placeholder melempar `SESSION_SECRET_MISSING` di luar catch; secret whitespace semula diterima. Pembuatan cookie kini masuk catch login; secret hilang/placeholder/whitespace menghasilkan JSON 503 `STAFF_SESSION_NOT_CONFIGURED`, tanpa cookie atau rahasia. Kunci sesi yang valid tetap digunakan persis tanpa di-trim. Tiga tes regresi ditambahkan pada `tests/integration/api.test.ts`: ketiganya gagal sebelum perbaikan dan lulus sesudahnya. `npm test` **103/103 (10 file)**, `npm run lint`, `npm run typecheck`, `npm run build` lulus. README memuat langkah konfigurasi `SESSION_SECRET` Secret/Production + Redeploy. Perubahan hanya lokal, belum di-commit/push/deploy oleh agent; login benar pada Vercel tetap belum diverifikasi.

**Reproduksi deployment lanjutan:** `DEMO_STAFF_PASSWORD` lokal kini terisi; satu POST login RSCM menggunakan nilai dari file (tidak dicetak) menghasilkan **HTTP 500 non-JSON, tanpa cookie**, sesuai screenshot. Berbeda dari password sengaja salah yang mendapat 401 normal; kegagalan pada tahap setelah pemeriksaan kredensial konsisten dengan dugaan pembuatan sesi. Belum ada log Vercel untuk memastikan `SESSION_SECRET_MISSING` di remote. `npm run check:secrets` lulus (20 berkas, 5 nilai rahasia terbaru termasuk password demo dan secret sesi); `git diff --check` lulus. Langkah berikutnya: pastikan `SESSION_SECRET` valid pada scope Production, Redeploy, lalu ulangi login dan cek sesi.

**Redesign UI/UX (31-10-2026):** antarmuka diganti mengikuti kanvas desain (Design artifact "Redesign RujukCepat"). Token warna/font (Plus Jakarta Sans + JetBrains Mono via `next/font`) dan kelas komponen (`btn`, `card`, `seg`, `sim-badge`, `notice`, `action-bar`) di `globals.css`; animasi dimatikan oleh `prefers-reduced-motion`. Perubahan alur: persetujuan dan lokasi digabung menjadi satu langkah "Persiapan" (5 langkah), header wizard berisi tombol kembali + progres, tombol utama menempel di bawah layar ponsel, urgensi tampil sebagai kartu besar, pilihan kebutuhan dan status kapabilitas memakai kontrol segmen 44 px, layar Tujuan berkolom peta + kandidat di desktop, status rujukan memakai cincin hitung mundur, dashboard tiga kolom (antrean | detail | kesiapan). Logika API, transaksi, dan schema tidak diubah. Bukti: `npm run typecheck`, `npm run lint`, `npm test` **103/103**, `npm run build` lulus. Diperiksa di browser (dev server pengguna, 360 px dan 1440 px): beranda, Persiapan, Rekam, Analisis (Gemini LIVE dengan laporan sintetis), Tinjau, dan Tujuan, tanpa overflow horizontal dan tanpa target sentuh < 44 px; perbaikan yang ditemukan (badge simulasi menutupi kontrol zoom, urutan panduan rute di ponsel, lebar header/tombol kirim di desktop, tombol 119/112 terlipat) sudah diterapkan. **Belum diperiksa di browser:** pengiriman rujukan + layar Status (sengaja tidak mengirim agar tidak menahan kuota demo) dan dashboard setelah login (butuh sandi petugas).

**Perubahan alur atas permintaan pengguna (31-10-2026): rekomendasi tanpa permintaan rujukan.** Pengguna meminta: (1) hapus tombol "Kirim permintaan" dan konfirmasi petugas, sehingga aplikasi hanya merekomendasikan RS beserta ketersediaannya; (2) tombol "Sudah sampai" di layar navigasi; (3) kuota diatur RS kapan saja, tanpa pengurangan otomatis. Keputusan ini mengubah cakupan T10–T12 (lifecycle `PENDING/ACCEPTED/...`, reservasi kuota, alert dan keputusan petugas) dan menggantikan bagian terkait di AGENTS §6 untuk proyek ini. Rincian di `SPEC.md` §20.

- [x] Portal: tombol kirim, langkah "Status rujukan", dan id rujukan di `localStorage` dihapus. Langkah 5 sekarang "Sudah sampai" (`arrival-step.tsx`): ringkasan serah terima + TTS, hanya di perangkat. Tombol utama Pilih RS = "Navigasi ke RS"; bila rute gagal: Google Maps + "Sudah sampai".
- [x] Navigasi: tombol hijau **Sudah sampai** selalu tampil (`navigation-view.tsx`); deteksi tiba via GPS tetap ada sebagai petunjuk.
- [x] Dashboard: hanya panel kesiapan/kuota, status semua fasilitas, reset admin. Antrean, detail rujukan, alarm suara dihapus.
- [x] Server: `/api/referrals*`, `src/lib/referrals`, `schema/referral.ts`, `client/alarm.ts`, `client/guidance.ts`, cookie `rc_rid`, `REFERRAL_PENDING_TTL_SECONDS` dihapus. `src/lib/facilities/repo.ts` + `schema/facility.ts` memegang `updateFacility`/`resetDemo`. Event sinkronisasi hanya `facility`. Tidak ada migrasi baru; tabel/fungsi rujukan lama tidak dipakai lagi (tidak di-drop agar tidak menghapus data di Supabase).
- [x] `scripts/measure.ts` ditulis ulang untuk alur baru (analisis → rekomendasi → rute; ubah kuota → event portal; cek kuota tidak berubah tanpa petugas).

**Bukti:** `npx tsc --noEmit` (kode aplikasi 0 error), `npx eslint .` 0 masalah, `npx vitest run` **87/87 (10 file)**, `npx next build` sukses (rute `/api/referrals*` tidak ada lagi). Browser (`next start` port 3100, `DATA_MODE=local` DB uji `.data/pglite-uji`, AI mock, OSRM live, sandi petugas uji khusus di `.claude/launch.json`): portal → rekomendasi tanpa tombol kirim → Navigasi → Sudah sampai → ringkasan serah terima; kuota Tarakan tetap 1/4; 375 px tanpa scroll horizontal. Dashboard Tarakan: tanpa antrean; kuota diubah ke 0 → `/api/match` mengecualikan Tarakan ("Kuota rujukan simulasi 0"), badge sinkron SSE 42 ms. `npm run measure` (5 percobaan, mock): koordinasi mesin median 936 ms, ubah kuota → portal median 8 ms, RSCM 3/6 → 3/6 setelah 3 rekomendasi; `docs/hasil-ukur-mock.json` diperbarui. **Belum diuji:** alur baru pada Supabase nyata/deployment, perangkat nyata. Tidak ada commit.

**Wilayah layanan Jawa Timur (01-11-2026, permintaan pengguna; penyelenggara UPNVJT, juri menguji di sekitar kampus).** `src/lib/regions.ts` menjadi satu sumber wilayah: DKI Jakarta & sekitarnya + Jawa Timur (daratan, Madura, Bawean/Kangean), dengan titik contoh Kampus UPN "Veteran" Jatim (-7,3338, 112,7889; Nominatim OSM way/468626943). `LatLngSchema` dan pemilih lokasi memakai `inServiceArea`; peta pemilih punya tombol Jakarta/Surabaya (bawaan Surabaya). Pencocokan hanya menilai RS dalam radius `MATCH_MAX_KM` (bawaan 100 km); RS di luar radius tidak tampil dan dihitung di `out_of_range_count`. Prompt AI dan teks beranda/metadata menyebut Jawa Timur. Dashboard: filter wilayah (bawaan wilayah RS petugas) + cari nama RS.

**Bukti:** typecheck 0 error, eslint 0 masalah, `vitest` **97/97 (12 file)** termasuk `tests/unit/regions.test.ts` (Senen, UPNVJT, Malang, Banyuwangi, Madura, Bawean diterima; Bandung, Semarang, Denpasar ditolak) dan tes radius. `next build` sukses. Browser (`next start`, data lokal): pemilih lokasi membuka Surabaya, titik contoh UPNVJT terpasang, 375 px tanpa overflow; `/api/match` dari UPNVJT → 200, tanpa kandidat, "Belum ada rumah sakit dalam radius 100 km", 10 RS Jakarta di luar radius; dari Senen → RSUD Tarakan; Bandung → 400. Dashboard: filter Jakarta 10/10, Jawa Timur 0/10. **Belum:** data RS Jawa Timur (langkah berikutnya: impor RS Jakarta + Jatim dari OSM beserta akun petugas), uji GPS di perangkat nyata sekitar kampus.

**Impor 200 RS OSM + akun petugas (01-11-2026, permintaan pengguna).** Keputusan pengguna: kedaluwarsa 30 hari; RS khusus masuk dengan layanan sesuai jenisnya (Mata/Jiwa/Gigi/Ketergantungan/THT tidak diambil); `akunRumahsakit.md` di `.gitignore`; diterapkan ke Supabase. Rincian di `SPEC.md` §22.

- [x] Snapshot OSM dua wilayah, seleksi 90 RS Jakarta baru + 100 RS Jawa Timur (`supabase/seed-osm.sql`, `data/osm/rs-terpilih.json`); 10 RS lama diperkaya telepon/situs.
- [x] Migrasi 0005 (telepon, situs, tempat tidur, jenis RS); telepon tampil di kartu kandidat.
- [x] 195 akun petugas (95 Jakarta, 100 Jawa Timur) dengan kata sandi acak; `akunRumahsakit.md` + `data/akun-rumahsakit.local.json` gitignored.
- [x] Dashboard: filter wilayah bawaan = wilayah RS petugas; teks kedaluwarsa "30 hari".

**Bukti:** typecheck 0 error, eslint 0 masalah, `vitest` **97/97 (12 file)** (db: 200 RS tanpa osm_id ganda; Senen: 100 RS Jakarta dinilai, 100 di luar radius; UPNVJT: semua kandidat Jawa Timur ≤ 100 km). `next build` sukses. Lokal (`.data/pglite-uji`): impor 200 RS + 195 akun; login RS Royal Surabaya via form → dashboard RS itu saja, filter Jawa Timur 100/200; `/api/match` dari UPNVJT → RS Royal Surabaya (8 mnt, telepon OSM), RS Gotong Royong, RS Onkologi, RS Islam Jemursari. **Supabase nyata:** `supabase:setup` menerapkan 0005; `hospitals:import` → 200 RS, 195 akun (kata sandi sama dengan file lokal); `check:supabase` lulus (200 RS, Realtime); lewat server dev pengguna (SUPABASE): login Ciputra Hospital, RS Royal Surabaya, RSUD Dr. Soetomo 200, sandi salah 401, UPNVJT → 4 RS Surabaya, 48 RS bertelepon. **Belum:** deployment Vercel memakai kode baru (perlu push + redeploy; `STALE_AFTER_MINUTES` di Vercel bila pernah diisi), kapabilitas lanjutan RS impor sebagian besar hanya IGD_DASAR (petugas dapat menambah lewat dashboard). Tidak ada commit.

| Tugas aktif | Status | Kendala | Langkah berikutnya |
| --- | --- | --- | --- |
| T18 (berikutnya, terhambat) | T01–T17 selesai dan terverifikasi lokal (31-10-2026): alur P0 dua tampilan berfungsi (portal → AI → pencocokan → rujukan → dashboard → konfirmasi → status), P1 diimplementasikan, 78 tes lulus, README + deklarasi ada. T18–T20 **belum** dikerjakan | Butuh otorisasi/kredensial pengguna: Vercel, Supabase (+ `SUPABASE_DB_URL`), `GEMINI_API_KEY`, GitHub, izin commit/push/tag, challenge brief, Devpost. Realtime Supabase, RLS Supabase, mikrofon/kamera/GPS/TTS/alarm/PWA pada perangkat nyata, dan performa LIVE terbaru belum diuji | Pengguna memutuskan T18: kredensial + otorisasi deployment dan commit; jalankan `docs/SMOKE-TEST.md`; ukur LIVE (`AUDIO=1 PHOTO=1 npm run measure`); lalu T19 (video/deck/tag) dan T20 (Devpost). |

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
| Akses SQL lewat satu antarmuka `Db` (`src/lib/data/db.ts`): PGlite lokal atau `pg` ke `SUPABASE_DB_URL` | SQL/fungsi transaksi yang sama di dua mode; jalur `pg` belum diuji tanpa kredensial. Menambah dependensi `pg` | T10 |
| Login petugas dan sesi buatan sendiri (cookie HMAC, hash scrypt di `staff_credentials`, kata sandi dari `DEMO_STAFF_PASSWORD`) — bukan Supabase Auth; pelapor = cookie anonim `rc_rid` | Berjalan tanpa Supabase dan dapat diuji otomatis; RLS `auth.uid()` di migrasi menjadi pertahanan tambahan yang tidak terpakai oleh jalur server. `DEMO_ADMIN_EMAILS` dihapus (admin = flag `is_demo_admin`) | T11 |
| ETA rujukan dihitung ulang di server saat kirim; klien tidak mengirim `eta_seconds` | Mencegah ETA palsu dari klien (menyimpang dari SPEC §9 awal) | T10 |
| Sinkronisasi: event = pemicu ambil-ulang. Lokal: SSE `/api/stream` (EventEmitter dalam proses). Supabase: broadcast Realtime dari server ke kanal `rc:*` (tanpa Supabase Auth), polling 5 dtk bila putus | SSE tidak bekerja lintas instans serverless (Vercel); `postgres_changes` + RLS tidak dipakai karena sesi tidak memakai Supabase Auth. Jalur Supabase belum diuji | T12 |
| Tidak memakai Playwright; uji dua sesi = tes API dua cookie jar + browser pane manual + `scripts/measure.ts` | Unduhan browser Playwright tidak diperlukan; kekurangan dicatat di README | T16 |
| Pembatas laju dalam memori: 12 analisis/menit dan 10 login/menit per klien (env dapat diubah) | Melindungi kuota Gemini gratis; per instans pada serverless | T15 |
| Service worker minimal: hanya aset statis berhash + ikon + halaman offline; tanpa cache `/api/*` dan HTML | AGENTS §8: kapasitas/laporan lama tidak boleh tampil sebagai mutakhir | T14 |
| Reservasi `ACCEPTED` tetap `HELD` sampai `ARRIVED`/`REVOKE` atau reset demo; `ARRIVED` dan `REVOKE` hanya sekali dan saling meniadakan | `0003_staff_ops.sql`; AGENTS §6 | T10 |
| **Navigasi langsung ala peta (permintaan pengguna 31-10-2026, di luar daftar T01–T20):** petunjuk belok demi belok (OSRM `steps`), titik GPS mengikuti posisi, deteksi keluar jalur, hitung ulang rute hemat, panduan suara opsional, tombol buka di Google Maps/Waze, dan simulasi perjalanan berlabel | GOAL §8 mengecualikan "pelacakan armada berkelanjutan"; yang dibuat adalah navigasi di perangkat pelapor (GPS hanya diproses di klien, server hanya menerima koordinat untuk hitung ulang dan tidak menyimpannya), bukan pelacakan armada/dispatch. Tanpa API berbayar: OSRM publik dengan penghematan (menyimpang ≥ 10 dtk, jeda ≥ 30 dtk, maks 8 hitung ulang/sesi, `/api/route` dibatasi 20/menit per klien). ETA tetap perkiraan tanpa lalu lintas langsung | T05/T09 (tambahan) |
| **Redesain beranda (permintaan pengguna 01-11-2026, dua iterasi):** iterasi 1 (hero gelap beranimasi) dinilai pengguna terlalu generik; iterasi 2 memakai tampilan terang ala situs layanan kesehatan: foto asli (Pexels + Wikimedia Commons CC BY 4.0, `public/images/`), bilah darurat 119, ringkasan "Kesiapan IGD saat ini" di atas foto hero, panel kesiapan lengkap + peta OSM statis + arti status, "Cara kerja" dengan pratinjau tampilan berlabel contoh, grid "Layanan yang dicocokkan" (jumlah RS siap live), "Untuk siapa" (pelapor vs petugas), daftar periksa "Siapkan sebelum berangkat", dan tanya jawab | Data dari `/api/facilities` + SSE/Supabase Realtime `rc:facilities`; "siap" = IGD_DASAR READY, segar, kuota > 0 (`src/lib/facilities/readiness.ts`); status kedaluwarsa tampil "Belum diperbarui", tidak dihitung siap. `MapView` mendapat mode `interactive={false}` dan warna penanda status. Tombol global kembali warna solid. Atribusi foto di footer dan README; orang di foto = model stok. Tanpa dependensi baru; gerak dimatikan `prefers-reduced-motion` | T09/T14 (tambahan) |

**Cakupan T01 (dirangkum dari GOAL; brief panitia belum tersedia → belum terverifikasi):**

- Alur demo: portal (persetujuan → lokasi → rekam/teks + foto opsional → ringkasan AI → tinjau → pilih RS) → [T10+] kirim rujukan → dashboard IGD → konfirmasi → status di portal.
- Batas simulasi: seluruh kapasitas/kesiapan RS adalah seed berlabel "simulasi"; lokasi RS dari OSM tidak menyiratkan kemitraan; pasien sintetis; AI hanya perkiraan; ETA OSRM tanpa lalu lintas langsung. Badge mode (AI simulasi, Rute simulasi, Database lokal) tampil di portal.
- Luaran wajib (GOAL §11): aplikasi dua antarmuka + repo GitHub, README, deklarasi AI/pihak ketiga/atribusi, tag `submission-24h`, video < 3 menit, pitch deck, isian Devpost — belum dikerjakan (T17–T20).
- Instruksi pengguna (31-10-2026): kerjakan sampai T09; keamanan bukan fokus → pembatasan akses dan RLS ditulis sesuai SPEC tetapi tidak diuji mendalam pada tahap ini.
- Instruksi pengguna lanjutan (31-10-2026): pelajari semua `.md`, kerjakan sampai T20 sesuai TASK.md, pastikan semua fungsi bekerja, keamanan bukan fokus, tanyakan bila kurang jelas. T10–T17 dikerjakan; T18–T20 tidak dapat diselesaikan tanpa kredensial/otorisasi/brief (AGENTS §2: tidak mendeploy, mempublikasikan repo, menandai tag, atau mengirim Devpost tanpa otorisasi) sehingga dicatat terhambat dan ditanyakan ke pengguna.
- **Keputusan pengguna (31-10-2026): lingkup pekerjaan diubah menjadi sampai T17.** T18–T20 tetap `[ ]` (terhambat, bukan dibatalkan) dan dikerjakan nanti setelah pengguna memberi kredensial (Vercel, Supabase, GitHub, `GEMINI_API_KEY`), otorisasi deploy/commit/tag, dan challenge brief. Pengukuran performa LIVE dan pengujian Supabase (Realtime, RLS) ikut tertunda.

## 10. Log verifikasi

Isi setiap bukti dengan commit/versi, perintah atau langkah uji, hasil aktual, dan lokasi bukti. Gunakan `belum diuji`, `lulus`, `gagal`, atau `terhambat` secara eksplisit.

| Area | Tugas/AC | Status awal | Bukti/hasil |
| --- | --- | --- | --- |
| Build, lint, typecheck | T02/T16 | Lulus | 31-10-2026, tanpa commit: `npm run lint` 0 masalah, `npm run typecheck` 0 error, `npm run build` sukses, `npm test` 78/78 lulus (8 file), `npm run check:secrets` lulus. Diulang pada salinan bersih (`npm ci`) dengan hasil sama. |
| Audio, JSON, dan asal data | T04/T06; AC-01/02 | Lulus (mock + LIVE) | Unit: schema rusak, field hilang, null tetap null, kode ilegal dibuang, Plan berdosis dibuang, angka foto tanpa foto dikosongkan. LIVE `gemini-3.5-flash`: `npm run check:gemini` + 3 percobaan skrip + 2 percobaan portal → semua JSON valid setelah normalisasi; 2 dari ±8 panggilan gagal 503/timeout lalu berhasil saat dicoba ulang. |
| Kapabilitas, alternatif, rute | T05/T07; AC-03/04 | Lulus | `tests/unit/matching.test.ts` 10 kasus lulus; `/api/match` dengan OSRM publik LIVE (Senen → RSCM ±414 dtk); tanpa kandidat & alasan per RS tampil di UI; OSRM tak terjangkau → ETA null + label jarak garis lurus. |
| Rujukan dan konfirmasi | T10/T11; AC-05/06 | **Dihapus** 31-10-2026 atas keputusan pengguna (lihat §9); bukti di bawah adalah alur lama | Tes API (`tests/integration/api.test.ts`) + dua tab browser: kirim → `PENDING`+kuota ditahan → alert dashboard → Terima → portal "Diterima petugas IGD"; status permintaan dan reservasi terpisah. Belum di Supabase/deployment. |
| Kuota serentak dan idempotency | T10; AC-07 | **Tidak berlaku lagi** (kuota diatur manual RS; tes `api.test.ts` kini memeriksa rekomendasi tidak mengubah kuota). Bukti lama: | Tes API: dua pelapor/1 kuota → 201+409, kuota 0; retry & 3 klik serentak kunci sama → satu rujukan; pelepasan tepat sekali (tolak/batal/expiry/revoke). `measure` pada server berjalan: 201/409. UI: klik kirim 3× → kuota −1. Konkurensi multi-koneksi Supabase belum diuji. |
| Realtime dan reconnect | T12; AC-08 | Sebagian | SSE lokal: dua tab konsisten, latensi server→klien 4 ms (median, 10 percobaan) / badge 10–98 ms; server mati → "Sinkronisasi terbatas" → hidup → pulih dari database. Supabase Realtime: belum diuji. |
| Error dan pemulihan | T15; AC-09 | Lulus (lokal) | `failures.test.ts` + `match-failures.test.ts` (12) + browser (izin ditolak, 422 coba lagi, kandidat kosong, kuota bentrok saat kirim, server putus). Banner offline diuji hanya lewat logika (tanpa memutus jaringan perangkat). |
| Responsivitas dan aksesibilitas | T14/T16; AC-10 | Sebagian | Portal 375×812 (tanpa overflow) dan dashboard desktop di browser pane; teks+ikon untuk status; skip link; fokus terlihat. Audit penuh (axe/pembaca layar) dan perangkat nyata belum. |
| Redesain beranda | Tambahan 01-11-2026 | Lulus (lokal) | 01-11-2026, tanpa commit (iterasi 2): `npm run lint` 0 masalah, `typecheck` 0 error, `npm test` 92/92 (termasuk `tests/unit/readiness.test.ts`), `npm run build` sukses. Browser pane (server dev pengguna, data Supabase): ringkasan & panel "8 dari 10 IGD siap", PENUH RSUD Pasar Minggu, status "Langsung", peta OSM statis dengan penanda status; tanya jawab terbuka; daftar RS muat di lebar ponsel; tanpa overflow horizontal di 375 px dan 1024 px. Perangkat nyata & pembaca layar belum. |
| Foto dan suara keluaran | T08/T13; AC-11 | Foto lulus (LIVE); TTS lulus di pane (tanpa suara id-ID) | Foto: lihat T08. TTS: Putar → `speaking=true`, Berhenti → `false`, fallback suara/teks tampil. Alarm: alert visual selalu ada; bunyi belum terdengar/terverifikasi. Perangkat nyata belum. |
| Akses, rahasia, dan data simulasi | T11/T15; AC-12 | Sebagian | Tes akses lintas RS/pelapor/tanpa sesi/cookie palsu lulus; `check:secrets` lulus (nilai yang ada); label simulasi terlihat; audio/foto tidak disimpan (tes). RLS Supabase dan kunci Gemini/Supabase pada bundle belum diuji. |
| Performa | T16; tabel target GOAL | MOCK terukur; LIVE awal (T04) | **MOCK** 31-10-2026, `next start`, localhost, Windows 11/Ryzen 7 6800H/Node 22, audio 495 KB + foto 26 KB, 10 percobaan, 0 gagal: koordinasi mesin median 686 ms (<15 dtk, tanpa waktu manusia), sinkron SSE 4 ms (<200 ms; satu mesin), keputusan petugas 46 ms (<2 dtk); respons AI 604 ms **tidak bermakna** (mock menunda 600 ms). **LIVE** (T04, belum diulang): 5,5–13,2 dtk → **target <3 dtk belum tercapai**. Data mentah `docs/hasil-ukur-mock.json`. |
| Deployment dan submission | T18/T19/T20 | Terhambat | Belum dilakukan: butuh kredensial/otorisasi/brief pengguna (lihat T18–T20 dan §9). Siap: `docs/SMOKE-TEST.md`, `DEMO-SCRIPT.md`, `PITCH-DECK.md`, `DEVPOST.md`. |

## 11. Batas penyelesaian agent

Gunakan `GOAL.md` untuk membedakan siap demo teknis, paket siap dikumpulkan, dan submission yang benar-benar telah dilakukan. Jangan menandai tugas publikasi atau pengumpulan selesai hanya karena bahan sudah disiapkan.

Validasi klinis, kerja sama rumah sakit, verifikasi kapasitas nyata, dan uji lapangan adalah dependensi eksternal di luar implementasi MVP. Catat kebutuhan tersebut sebagai keterbatasan atau tindak lanjut; jangan mengklaim sudah terpenuhi melalui tes kode atau data simulasi.
