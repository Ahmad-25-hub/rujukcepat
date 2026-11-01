# Draf isian Devpost — untuk T20 (belum dikirim)

Cocokkan dengan challenge brief panitia yang aktual sebelum mengirim; brief belum diberikan, sehingga kolom, batas karakter, dan syarat luaran di bawah **belum terverifikasi**. Pengiriman hanya atas otorisasi pengguna.

## Nama proyek
RujukCepat

## Tagline
Koordinasi rujukan gawat darurat DKI Jakarta: dari laporan suara sampai IGD tahu pasien datang (demo simulasi).

## Terinspirasi oleh / Masalah
Keluarga dan kru ambulans sering tidak tahu IGD mana yang kapabilitasnya siap sebelum berangkat, sehingga rujukan berulang dapat terjadi. (Berdasarkan proposal; belum dibuktikan oleh uji lapangan.)

## Apa yang dilakukan
PWA dua antarmuka: portal ponsel (laporan suara/teks, ringkasan SOAP berlabel asal data, pilihan tujuan dengan peta dan ETA OSRM) dan dashboard IGD (pre-arrival alert, terima/tolak/pasien tiba, kontrol READY/PENUH/MAINTENANCE dan kapasitas). Kuota simulasi dikunci atomik dan idempoten; status permintaan dan reservasi kuota dibedakan.

## Cara membangun
Next.js 16, React, TypeScript, Tailwind CSS, Lucide; Zod; Google Gemini API (server); PostgreSQL (PGlite lokal / Supabase) dengan fungsi transaksi SQL; Leaflet + OpenStreetMap + Overpass + OSRM; Web Speech API; SSE / Supabase Realtime; Vercel (rencana).

## Tantangan
Model Gemini yang disarankan proposal ditolak untuk pengguna baru sehingga diganti `gemini-3.5-flash`; latensi LIVE di atas target < 3 dtk; kuota serentak; menjaga agar tidak ada ETA/status palsu saat layanan gagal.

## Pencapaian
Lihat README "Hasil pengujian": 78 tes otomatis lulus, alur P0 dua tampilan terbukti secara lokal, uji kuota serentak/idempotency, akses lintas RS ditolak.

## Pelajaran
Memisahkan status permintaan dari reservasi kuota, dan menandai asal tiap data AI, membuat sistem jujur tentang apa yang diketahui.

## Selanjutnya
Kerja sama dan verifikasi data rumah sakit, validasi klinis, uji lapangan, integrasi sistem rujukan nasional.

## Batasan yang diumumkan
Semua data simulasi; AI bukan diagnosis; ETA tanpa lalu lintas langsung; Realtime Supabase, perangkat ponsel nyata, dan performa LIVE belum diuji penuh (lihat README).

## Tautan (isi setelah T18/T19; belum ada)
- Demo publik: _belum ada_
- Repositori GitHub: _belum ada_ (tag `submission-24h` belum dibuat)
- Video (< 3 menit): _belum ada_
- Pitch deck: _belum ada_ (kerangka: `docs/PITCH-DECK.md`)

## Deklarasi AI / pihak ketiga
Lihat README bagian "Deklarasi penggunaan AI, layanan pihak ketiga, dan atribusi".
