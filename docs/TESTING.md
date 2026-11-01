# Pengujian dan verifikasi

[Kembali ke README](../README.md)

Dokumen ini membedakan hasil pengujian otomatis, pemeriksaan layanan publik, dan verifikasi perangkat. Keberhasilan tes teknis tidak membuktikan akurasi klinis atau kesiapan operasional.

## Pemeriksaan otomatis

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check:secrets
```

Tes unit dan integrasi memakai fixture sintetis dan PostgreSQL PGlite dalam memori. Pemeriksaan rahasia memindai bundle klien setelah build; nilainya dibaca dari environment lokal tanpa perlu dipublikasikan.

### Hasil terbaru — 1 November 2026

Lingkungan: Windows, Node.js 22.20.0, npm 10.9.3. Pemeriksaan dijalankan setelah perapian dokumentasi dan teks antarmuka, tanpa commit atau deployment baru.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | Lulus. |
| `npm run typecheck` | Lulus. |
| `npm test` | **93 tes lulus dalam 12 berkas.** |
| `npm run build` | Lulus, build produksi Next.js berhasil. |
| `npm run check:secrets` | Lulus: 22 berkas bundle klien diperiksa terhadap lima nilai rahasia lokal dan pola kunci umum. |
| Uji pemindai dengan kunci palsu | Kunci uji terdeteksi; nilai/potongan kunci tidak dicetak. Berkas uji dihapus setelah pemeriksaan. |
| Audit berkas Git dan riwayat | Tidak ada kecocokan lima nilai rahasia lokal atau pola kunci umum; 379 versi berkas pada riwayat diperiksa. Ini pemindaian dengan cakupan tersebut, bukan jaminan tidak adanya semua jenis rahasia. |
| Tautan dokumentasi lokal | Seluruh tautan relatif mengarah ke berkas yang disertakan dalam Git. |

### Pemeriksaan HTTP lokal

Server produksi dijalankan pada port 4329 dengan PGlite terpisah, AI/rute mode contoh, dan kredensial sesi uji. Beranda, `/lapor`, `/dashboard/login`, halaman offline, dan manifest merespons HTTP 200. Seed memuat 200 fasilitas. Analisis laporan sintetis menghasilkan keluaran berlabel contoh, kemudian berhasil digunakan untuk pencocokan dan rute.

Login petugas serta pemeriksaan cookie sesi berhasil; permintaan tanpa sesi mendapat HTTP 401. Analisis, pencocokan, rute, dan login tidak mengubah kuota. Uji ini tidak mengakses Gemini atau database Supabase milik pengguna.

### Cakupan tes

| Area | Perilaku yang diperiksa |
| --- | --- |
| Schema dan normalisasi AI | JSON rusak, field hilang, data tidak diketahui, kode kapabilitas ilegal, dan penyaringan rencana berdosis. |
| Pencocokan | Beberapa kebutuhan, alternatif, tanpa kandidat, kapasitas nol, PENUH/MAINTENANCE, dan status kedaluwarsa. |
| Fasilitas dan akses | Login, cookie tidak sah, penolakan mutasi lintas rumah sakit, kuota manual, dan pencarian yang tidak mengurangi kuota. |
| Kegagalan API | Persetujuan, format/ukuran audio, rate limit, kegagalan AI/rute, dan payload lokasi. |
| Navigasi dan kesiapan | Kemajuan perjalanan, petunjuk rute, serta ringkasan kesiapan layanan. |
| PWA | Aset statis dapat di-cache; API dan HTML aplikasi tidak di-cache. |

### Layanan publik

Pada 1 November 2026, pemeriksaan hanya-baca terhadap [aplikasi](https://rujukcepat.vercel.app) memperoleh HTTP 200 untuk beranda, `/api/status`, dan `/api/facilities`. Endpoint status melaporkan AI/rute live serta Supabase; endpoint fasilitas mengembalikan 200 lokasi.

Pemeriksaan ini tidak memanggil Gemini, tidak mengubah database, dan tidak memverifikasi login atau alur dua perangkat. Deployment tersebut belum memuat perubahan lokal dalam pekerjaan dokumentasi ini.

## Pemeriksaan dua sesi dan perangkat

Gunakan laporan sintetis dan dua sesi browser. Catat URL/commit, tanggal, perangkat/browser, mode layanan, dan hasil aktual.

1. Buka portal dan dashboard melalui HTTPS; masuk dengan akun petugas untuk satu rumah sakit.
2. Rekam laporan atau gunakan teks ketika izin mikrofon ditolak; tentukan lokasi melalui GPS atau peta.
3. Tinjau hasil AI, ubah kebutuhan bila perlu, lalu periksa kandidat dan alasan pengecualian.
4. Ubah kuota/status dari dashboard; pastikan daftar fasilitas dan rekomendasi portal diperbarui. Pilihan tujuan tidak boleh mengurangi kuota.
5. Tolak izin GPS atau putuskan jaringan; periksa pesan pemulihan. Sambungkan kembali dan pastikan data diambil ulang.
6. Periksa OSRM gagal: ETA tetap kosong dan jarak garis lurus tidak disebut waktu berkendara.
7. Coba navigasi, **Sudah sampai**, dan TTS. Pastikan ringkasan tetap terbaca ketika suara tidak didukung.
8. Uji pemasangan PWA dan halaman offline pada perangkat yang mendukung.
9. Coba mutasi tanpa sesi dan akses lintas rumah sakit; keduanya harus ditolak.

Verifikasi perangkat fisik untuk mikrofon/GPS, suara, pemasangan PWA, serta uji alur terautentikasi dan reconnect pada deployment belum diulang pada audit ini. Pengujian Gemini live setelah perubahan schema terakhir juga belum diulang.

## Pengukuran performa

`npm run measure` mengukur analisis, pencocokan, rute, pembaruan fasilitas, dan penerimaan event SSE terhadap server berjalan. Skrip ini ditujukan untuk data lokal/SSE; bukan pengukur Supabase Realtime.

**Skrip mereset data melalui akun admin dan mengubah kuota. Jalankan hanya pada database uji yang boleh dikembalikan ke seed.** Atur `BASE_URL`, `DEMO_STAFF_PASSWORD`, dan `RUNS` pada environment terminal. Gunakan `AUDIO=1` untuk fixture suara. Hasil mentah `docs/hasil-ukur-*.json` diabaikan Git karena merupakan keluaran lokal.

Target awal: respons AI <3 detik, koordinasi digital <15 detik, sinkronisasi <200 ms, dan pembaruan status <2 detik. Pengukuran Gemini live terdahulu, 31 Oktober 2026, mencatat 5,5–13,2 detik; target AI belum tercapai. Angka tersebut merupakan catatan historis sebelum perubahan schema terakhir, bukan benchmark versi ini.

Hasil fixture AI tidak mengukur latensi Gemini. Pisahkan durasi penyedia, total permintaan, dan waktu manusia meninjau/memilih; laporkan jumlah percobaan, kegagalan, serta apakah pengukuran sinkronisasi berhenti pada event atau sampai tampilan diperbarui.
