# Smoke test deployment (T18) — belum dijalankan

Dijalankan **setelah** deployment publik ada (Vercel + Supabase). Hasil lokal tidak menutup T18. Catat: tautan, commit, tanggal, perangkat/browser, hasil per butir.

## Persiapan (perlu otorisasi dan kredensial pengguna)

1. Supabase: isi konfigurasi server → `npm run supabase:setup` (migrasi 0001–0004, seed hanya jika kosong) → `npm run check:supabase`. Alternatif SQL Editor: jalankan seluruh migrasi berurutan; seed hanya untuk database baru.
2. Repo GitHub (akun pemilik Vercel Hobby; Hobby dapat membatasi repo organisasi privat) → import ke Vercel (preset Next.js, `vercel.json` region `sin1`).
3. Environment Vercel (Production dan Preview terpisah; Preview boleh `AI_MODE=mock`):
   `DATA_MODE=supabase`, `SUPABASE_DB_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_ENV`, `SESSION_SECRET`, `DEMO_STAFF_PASSWORD`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_MODE`, `ROUTING_MODE`. Key `SERVICE_ROLE_KEY`/`ANON_KEY` lama tetap didukung.
4. Verifikasi batas Vercel Hobby di dokumentasi resmi saat itu (body ±4,5 MB, durasi fungsi, cron) — SPEC §13.1.

## Catatan teknis yang harus diuji di deployment

- **SSE (`/api/stream`) tidak dipakai di mode `supabase`**: sinkronisasi memakai broadcast Supabase Realtime. Pastikan kanal `rc:*` tersambung (badge "Tersambung (Supabase Realtime)") dan polling 5 dtk bekerja bila diputus.
- Pembatas laju per instans serverless tidak global.
- Realtime Supabase, RLS, `SUPABASE_DB_URL` (pooler, SSL), dan `create_referral` pada koneksi sungguhan **belum pernah diuji**.

## Daftar periksa (SPEC §13.4)

- [ ] 1. Portal dan dashboard terbuka via HTTPS di ponsel dan desktop.
- [ ] 2. Izin mikrofon dan lokasi muncul dan berfungsi.
- [ ] 3. `/api/analyze` mode LIVE berhasil dengan audio sintetis; waktu dicatat.
- [ ] 4. Rujukan dari ponsel muncul di dashboard (Realtime); konfirmasi kembali ke ponsel.
- [ ] 5. Perubahan kapabilitas di dashboard mengubah rekomendasi portal.
- [ ] 6. `npm run build && npm run check:secrets` lulus dengan semua kunci produksi terisi di environment build.
- [ ] 7. Badge simulasi terlihat; atribusi peta tampil.
- [ ] 8. Login petugas hanya melihat RS-nya; RS lain 403 (coba dua akun).
- [ ] 9. Dua pelapor memperebutkan satu kuota (Tarakan setelah reset): satu berhasil, satu mendapat pesan.
- [ ] 10. Putuskan jaringan di ponsel: banner offline, tombol kirim nonaktif; sambung kembali: status pulih.
- [ ] 11. PWA: pemasangan di Android Chrome / iOS "Tambah ke Layar Utama"; mode offline menampilkan halaman offline jujur.
- [ ] 12. TTS dan alarm pada perangkat nyata (suara id-ID tersedia atau fallback teks).
- [ ] 13. Reset demo oleh admin sebelum perekaman video.
