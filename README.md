# RujukCepat

PWA demo koordinasi rujukan prarumah sakit DKI Jakarta (TwinTech – UNJ, INCEPTION 2026).
Laporan suara → ringkasan AI terstruktur (SOAP, urgensi, kebutuhan) → pencocokan kapabilitas IGD → pilihan tujuan.

> **Status:** tahap T01–T09 (portal sampai pilihan tujuan). Pengiriman rujukan, kuota, dashboard petugas, dan Realtime (T10–T12) belum aktif. README lengkap (T17) menyusul.
> Seluruh kapasitas/kesiapan RS adalah **simulasi**. Ringkasan AI bukan diagnosis.

## Menjalankan lokal

Prasyarat: Node.js 20+ (diuji Node 24) dan npm.

```bash
npm install
cp .env.example .env.local   # lalu sesuaikan, lihat di bawah
npm run dev                  # http://localhost:3000
```

- Portal: `/` dan `/lapor` (mobile-first). Dashboard (pratinjau baca-saja): `/dashboard`.
- Mikrofon, kamera, dan GPS memerlukan HTTPS atau `localhost`.

### Mode layanan (`.env.local`)

| Variabel | Nilai | Keterangan |
| --- | --- | --- |
| `AI_MODE` | `live` / `mock` | `mock` memakai fixture sintetis di `tests/fixtures/ai` (badge "AI simulasi"). `live` butuh `GEMINI_API_KEY`. |
| `GEMINI_MODEL` | `gemini-3.5-flash` (terverifikasi 31-10-2026) | Verifikasi: `npm run check:gemini` (cek model + audio sintetis). `gemini-2.5-flash` ditolak untuk pengguna baru. |
| `ROUTING_MODE` | `live` / `mock` | `live` memanggil OSRM publik (`OSRM_BASE_URL`). |
| `DATA_MODE` | `local` / `supabase` | `local` = PGlite (Postgres WASM) di `.data/pglite`, migrasi + seed otomatis. |

### Database

- Migrasi: `supabase/migrations/*.sql` (dapat dijalankan di Supabase; di lokal dijalankan otomatis via PGlite + `supabase/local/auth-shim.sql`).
- Seed simulasi: `supabase/seed.sql` (idempoten). Lokasi RS dari snapshot OpenStreetMap `data/hospitals.osm.json` (`npm run fetch:hospitals`).
- **Reset demo (menghapus semua data rujukan demo):** hentikan `npm run dev`, lalu `npm run db:reset`.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Atribusi

Data peta & lokasi RS © OpenStreetMap contributors (ODbL), via Overpass API. Rute/ETA: OSRM (perkiraan tanpa lalu lintas langsung). AI: Google Gemini API (mode live).
