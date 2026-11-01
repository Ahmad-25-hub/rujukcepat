# Naskah video demo (< 3 menit) — draf untuk T19

Rekam hanya setelah demo publik lolos smoke test. Gunakan data sintetis; tampilkan badge simulasi. Reset data demo sebelum rekaman (`admin@rujukcepat.demo`).

| Waktu | Layar | Narasi (Bahasa Indonesia) |
| --- | --- | --- |
| 0:00–0:15 | Beranda portal | "Di rujukan gawat darurat, keluarga atau kru ambulans sering tidak tahu IGD mana yang siap. RujukCepat adalah demo koordinasi rujukan prarumah sakit untuk DKI Jakarta. Semua data kapasitas di demo ini simulasi." |
| 0:15–0:45 | Portal: izin + rekam 10–15 dtk | "Pendamping melaporkan lansia 70 tahun lemas dan berkeringat dingin, termasuk angka glukometer bila ada. Audio diproses AI Gemini dan tidak disimpan." |
| 0:45–1:10 | Layar tinjau | "AI menyusun ringkasan SOAP, perkiraan urgensi, dan kebutuhan layanan. Setiap data diberi asal: dikatakan pengguna atau perkiraan AI. Yang tidak disebut tetap 'tidak diketahui'. Ini bukan diagnosis." |
| 1:10–1:40 | Pilih tujuan: peta + kandidat | "Aplikasi hanya mengajukan rumah sakit yang kapabilitasnya READY dan punya kuota, lalu mengurutkan menurut perkiraan waktu tempuh OSRM — perkiraan, bukan lalu lintas langsung. Alasan RS yang tersaring terlihat." |
| 1:40–2:05 | Dashboard IGD (layar terpisah): ubah kuota/kapabilitas → portal perbarui daftar | "Petugas RS mengatur sendiri kesiapan layanan dan kuota kapan saja. Saat kuota diubah menjadi 0 atau layanan PENUH, rumah sakit itu langsung tidak direkomendasikan di portal." |
| 2:05–2:25 | Portal: Navigasi ke RS (simulasi perjalanan) | "Pelapor langsung bernavigasi: rute OSRM, petunjuk belok, dan deteksi keluar jalur, tanpa API berbayar. Untuk video kami memakai simulasi perjalanan yang berlabel." |
| 2:25–2:45 | Tombol Sudah sampai → ringkasan serah terima | "Setelah tiba, pelapor menekan Sudah sampai. Ringkasan SOAP dan kebutuhan layanan siap ditunjukkan atau dibacakan ke petugas IGD. Ringkasan ini hanya ada di perangkat, tidak dikirim." |
| 2:45–3:00 | Penutup | "Batasannya jelas: data simulasi, AI membantu koordinasi bukan mendiagnosis, validasi klinis dan kerja sama rumah sakit adalah langkah lanjutan. Terima kasih — TwinTech, UNJ." |

Checklist rekaman: badge simulasi terlihat, tidak ada identitas nyata, tidak ada kunci/kata sandi di layar, versi/commit yang direkam sama dengan yang diserahkan.
