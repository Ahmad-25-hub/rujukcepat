<p align="center">
  <img src="public/brand/rujukcepat-logo.png" alt="Logo RujukCepat" width="88" />
</p>

<h1 align="center">RujukCepat</h1>

<p align="center">
  <strong>Dari laporan suara ke pilihan IGD yang sesuai.</strong><br />
  TwinTech · Universitas Negeri Jakarta · INCEPTION 2026
</p>

<p align="center">
  <a href="https://rujukcepat.vercel.app">Buka aplikasi</a> ·
  <a href="docs/DEMO-SCRIPT.md">Panduan demo</a> ·
  <a href="docs/ARCHITECTURE.md">Arsitektur</a>
</p>

RujukCepat membantu keluarga, pendamping pasien, dan kru ambulans meninjau tujuan rujukan prarumah sakit. Laporan suara atau teks diubah menjadi ringkasan terstruktur, lalu dicocokkan dengan kebutuhan layanan, kesiapan fasilitas, kuota, dan perkiraan perjalanan.

Portal dirancang untuk ponsel. Dashboard memberi petugas satu tempat untuk memperbarui kesiapan layanan rumah sakitnya. Dataset mencakup **200 lokasi rumah sakit di DKI Jakarta dan Jawa Timur**, dengan kapasitas dan status contoh untuk demonstrasi.

## Mengapa RujukCepat?

Rumah sakit terdekat belum tentu memiliki layanan yang dibutuhkan. RujukCepat menghubungkan tiga informasi dalam satu alur: **kondisi yang dilaporkan, kapabilitas yang diperlukan, dan pilihan tujuan**. Pelapor dapat memeriksa ringkasan sebelum melanjutkan, sementara perubahan fasilitas dari dashboard memengaruhi rekomendasi portal.

## Satu alur, dari laporan hingga serah terima

1. **Siapkan laporan.** Tentukan lokasi, lalu ceritakan kondisi melalui suara atau teks.
2. **Tinjau ringkasan AI.** Periksa SOAP, perkiraan urgensi, dan kebutuhan layanan. Informasi yang belum diketahui tetap ditandai.
3. **Bandingkan tujuan.** Lihat kandidat utama, alternatif, dan alasan fasilitas tidak memenuhi kebutuhan.
4. **Ikuti rute.** Gunakan peta, petunjuk perjalanan, atau buka tujuan di Google Maps/Waze.
5. **Tunjukkan ringkasan saat tiba.** Tombol **Sudah sampai** membuka informasi serah terima yang dapat dibaca atau dibacakan.

Memilih tujuan tidak memesan tempat atau mengurangi kuota. Petugas mengatur kuota melalui dashboard; keputusan penerimaan pasien tetap berada pada rumah sakit.

## Fitur utama

| Fitur | Yang dapat dicoba |
| --- | --- |
| Laporan suara dan teks | Perekaman singkat dengan masukan teks sebagai alternatif. |
| Ringkasan berbantuan Gemini | SOAP, urgensi, kebutuhan layanan, dan penanda asal informasi. |
| Pencocokan delapan kapabilitas | Semua kebutuhan wajib harus READY, belum kedaluwarsa, dan memiliki kuota. |
| Peta dan navigasi | Leaflet, OpenStreetMap, rute OSRM, GPS, dan panduan suara pada browser yang mendukung. |
| Dashboard per rumah sakit | Pembaruan status READY/PENUH/MAINTENANCE dan kuota dengan akses petugas. |
| Sinkronisasi fasilitas | Supabase Realtime atau SSE lokal, dengan pengambilan ulang data saat tersambung kembali. |
| PWA | Manifest, ikon aplikasi, dukungan pemasangan, dan halaman offline khusus. |

## Menjalankan lokal

Gunakan **Node.js 22** dan npm. Dari PowerShell di direktori proyek:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Isi `SESSION_SECRET` dengan string acak panjang dan `DEMO_STAFF_PASSWORD` dengan kata sandi pilihan Anda di `.env.local`, lalu jalankan:

```powershell
npm run dev
```

Buka [portal](http://localhost:3000) atau [dashboard petugas](http://localhost:3000/dashboard). Konfigurasi awal memakai database lokal dan skenario contoh; kunci Gemini dan Supabase tidak diperlukan. Peta dasar tetap memerlukan internet.

Untuk mencoba analisis Gemini dan rute OSRM, ubah `AI_MODE=live`, isi `GEMINI_API_KEY`, dan atur `ROUTING_MODE=live`. Lihat [panduan pengembangan](docs/DEVELOPMENT.md) untuk konfigurasi layanan, akun petugas, migrasi, dan reset data.

## Teknologi

**Next.js · React · TypeScript · Tailwind CSS · Lucide · Zod · Google Gemini · PostgreSQL · Supabase · PGlite · Leaflet · OpenStreetMap · OSRM**

Logika AI, pencocokan, rute, data, dan autentikasi dipisahkan dari komponen antarmuka. Penjelasan aliran data dan kontrak API tersedia di [arsitektur sistem](docs/ARCHITECTURE.md).

## Dokumentasi

| Panduan | Isi |
| --- | --- |
| [Demo tiga menit](docs/DEMO-SCRIPT.md) | Skenario yang memperlihatkan portal dan dashboard. |
| [Arsitektur](docs/ARCHITECTURE.md) | Modul, kapabilitas, pencocokan, API, dan privasi. |
| [Pengembangan](docs/DEVELOPMENT.md) | Environment, akun, database, impor lokasi, dan reset. |
| [Pengujian](docs/TESTING.md) | Perintah pemeriksaan, hasil aktual, dan cakupan verifikasi. |
| [Atribusi](docs/ATTRIBUTIONS.md) | Penggunaan AI, sumber data, dan kredit aset. |

## Status prototipe

RujukCepat adalah prototipe hackathon dengan data fasilitas contoh. Lokasi dari OpenStreetMap tidak menyatakan kemitraan atau kesiapan layanan yang telah diverifikasi. Ringkasan AI membantu koordinasi dan memerlukan peninjauan tenaga kesehatan; ETA OSRM merupakan perkiraan tanpa lalu lintas langsung. Validasi klinis dan uji operasional bersama rumah sakit merupakan tahap pengembangan berikutnya.

Gunakan laporan sintetis tanpa identitas pasien nyata saat mencoba aplikasi. Detail pemrosesan data tersedia pada layar persetujuan dan [dokumentasi privasi](docs/ARCHITECTURE.md#pemrosesan-dan-privasi-data).
