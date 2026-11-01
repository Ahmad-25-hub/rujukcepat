# Panduan pengembangan

[Kembali ke README](../README.md)

## Instalasi

Gunakan Node.js 22 dan npm dengan lockfile yang tersedia:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Isi `SESSION_SECRET` dengan string acak panjang dan `DEMO_STAFF_PASSWORD` dengan kata sandi pilihan Anda. Jangan memakai nilai placeholder. Jalankan `npm run dev`, lalu buka [localhost:3000](http://localhost:3000).

Untuk menjalankan build produksi lokal:

```powershell
npm run build
npm start
```

Mikrofon dan GPS memerlukan `localhost` atau HTTPS serta izin perangkat. Jika mikrofon ditolak, gunakan laporan tertulis. Jika GPS ditolak, tentukan titik secara manual di peta.

## Mode layanan

| Variabel | Nilai | Perilaku |
| --- | --- | --- |
| `DATA_MODE` | `local` / `supabase` | PGlite lokal atau PostgreSQL Supabase. |
| `AI_MODE` | `mock` / `live` | Fixture sintetis atau pemanggilan Gemini melalui server. |
| `ROUTING_MODE` | `mock` / `live` | Perkiraan dari jarak garis lurus atau rute OSRM. |

Template memakai mode lokal/contoh agar alur dapat dicoba tanpa kredensial penyedia. Peta dasar tetap memerlukan internet. Kegagalan penyedia live tidak mengalihkan aplikasi ke fixture atau database lokal secara diam-diam.

### Environment

Semua nama dan placeholder tersedia di [`.env.example`](../.env.example).

| Kelompok | Variabel | Catatan |
| --- | --- | --- |
| Sesi | `SESSION_SECRET`, `DEMO_STAFF_PASSWORD` | Rahasia server; diperlukan untuk akses akun petugas bawaan. |
| Database lokal | `LOCAL_DB_DIR` | Bawaan `.data/pglite`; migrasi dan seed dijalankan saat database pertama dibuka. |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `GEMINI_THINKING_LEVEL` | Wajib mengisi kunci ketika memakai AI live; model mengikuti akses akun penyedia. |
| Rute | `OSRM_BASE_URL`, `ROUTING_TIMEOUT_MS` | Endpoint OSRM dan batas waktu panggilan. |
| Pencocokan | `MATCH_MAX_KM`, `MATCH_MAX_ROUTED`, `STALE_AFTER_MINUTES` | Radius, jumlah kandidat yang dirutekan, dan batas usia status. |
| Supabase publik | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dipakai browser untuk Realtime. |
| Supabase server | `SUPABASE_DB_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_CA_CERT` | Koneksi SQL, key server, dan CA opsional. |
| Pembatas laju | `ANALYZE_RATE_PER_MINUTE`, `LOGIN_RATE_PER_MINUTE` | Bawaan 12 analisis dan 10 percobaan login per menit per klien, per instans. |
| Lingkungan | `NEXT_PUBLIC_APP_ENV` | `development`, `preview`, atau `production`. |

Key Supabase lama didukung melalui `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY`. Key berhak istimewa tidak boleh diberi awalan `NEXT_PUBLIC_`. Mulai ulang server setelah perubahan environment; nilai `NEXT_PUBLIC_*` pada produksi memerlukan build ulang.

Nilai `STALE_AFTER_MINUTES=43200` pada template dipilih untuk demonstrasi. Kebijakan kebaruan data operasional memerlukan kesepakatan dengan fasilitas.

## Akun petugas

| Akun | Lingkup akses |
| --- | --- |
| `rscm@rujukcepat.demo` | RSCM |
| `fatmawati@rujukcepat.demo` | RSUP Fatmawati |
| `tarakan@rujukcepat.demo` | RSUD Tarakan |
| `pasarminggu@rujukcepat.demo` | RSUD Pasar Minggu |
| `pon@rujukcepat.demo` | RS PON |
| `admin@rujukcepat.demo` | RSCM dan reset data contoh |

Akun bawaan disinkronkan saat login pertama menggunakan `DEMO_STAFF_PASSWORD`. Kata sandi tidak dipublikasikan di repositori. Akun rumah sakit impor memiliki kata sandi acak tersendiri; database menyimpan hash scrypt.

Jika impor dijalankan, daftar kredensial lokal ditulis ke `akunRumahsakit.md` dan `data/akun-rumahsakit.local.json`. Keduanya diabaikan Git dan tidak boleh disertakan dalam paket publik.

## Database dan seed

Migrasi di `supabase/migrations/` dari `0001` sampai `0005` diterapkan berurutan. `supabase/seed.sql` memuat sepuluh rumah sakit awal, sedangkan `supabase/seed-osm.sql` menambahkan 190 lokasi hasil seleksi. Total seed: 100 lokasi DKI Jakarta dan 100 Jawa Timur.

Nama dan koordinat berasal dari OpenStreetMap. Kapabilitas dan kuota seed adalah data contoh dengan penanda sumber dan `is_simulated`; penggunaan lokasi publik tidak membuktikan kesiapan fasilitas.

### Supabase

1. Isi URL dan publishable key, `SUPABASE_DB_URL`, serta `SUPABASE_SECRET_KEY` dari proyek milik Anda. Gunakan connection string pada menu **Connect**, dengan password database yang di-URL-encode jika diperlukan. Pilih koneksi sesuai lingkungan pada [panduan resmi Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. Jalankan `npm run supabase:setup`. Runner menerapkan migrasi dalam transaksi dengan lock dan checksum; seed hanya dijalankan jika tabel rumah sakit kosong. Setup ulang mempertahankan data yang sudah ada.
3. Jalankan `npm run check:supabase` untuk memeriksa endpoint, koneksi SQL, schema, izin fungsi, dan broadcast Realtime pada kanal uji sementara.
4. Atur `DATA_MODE=supabase`, mulai ulang aplikasi, lalu uji portal dan dashboard pada dua sesi.

Jangan menjalankan `supabase/local/auth-shim.sql` pada Supabase; berkas tersebut hanya untuk PGlite. SSL digunakan untuk koneksi SQL. Mengisi `SUPABASE_DB_CA_CERT` mengaktifkan verifikasi sertifikat; tanpa CA, adapter mengenkripsi koneksi tetapi tidak memverifikasi sertifikat server.

### Memperbarui dataset lokasi

```powershell
npm run fetch:hospitals
npm run build:hospitals
npm run hospitals:import
```

Pengambilan lokasi melalui Overpass dilakukan oleh skrip, bukan pada setiap render. Snapshot dan seed disertakan agar demo tidak memerlukan pengambilan ulang. Periksa [skrip impor](../scripts/hospitals-import.ts) sebelum menjalankannya: operasi ini menulis fasilitas dan akun ke database yang dipilih oleh environment.

### Reset data contoh

**Reset mengembalikan kesiapan dan kuota ke seed serta menghapus sisa data rujukan lama. Perubahan petugas akan hilang.**

- Untuk PGlite, hentikan server lalu jalankan `npm run db:reset`. Perintah ini membuka database lokal pada `LOCAL_DB_DIR`.
- Pada database aktif aplikasi, masuk sebagai admin, pilih **Reset data**, dan ketik `RESET`. API `/api/demo/reset` memerlukan akses admin dan konfirmasi yang sama.

## Konfigurasi hosting

Repositori menyediakan konfigurasi Next.js dan `vercel.json`. Pada hosting serverless gunakan `DATA_MODE=supabase`, kredensial server, konfigurasi Realtime publik, serta `SESSION_SECRET` yang valid. Direktori PGlite lokal memerlukan penyimpanan persisten dan tidak ditujukan untuk filesystem serverless sementara.

Login produksi memerlukan `SESSION_SECRET` dan kata sandi petugas yang terisi. Jika server mengembalikan `STAFF_SESSION_NOT_CONFIGURED`, periksa environment pada scope deployment yang benar, lalu bangun/deploy ulang sesuai alur hosting Anda.

Daftar pemeriksaan setelah deployment tersedia di [panduan pengujian](TESTING.md#pemeriksaan-dua-sesi-dan-perangkat).
