# GOAL - RujukCepat

## 1. Tujuan proyek

Bangun RujukCepat, Progressive Web App (PWA) untuk demonstrasi koordinasi rujukan prarumah sakit di DKI Jakarta. Hubungkan laporan kondisi pasien dari warga atau kru ambulans dengan pencocokan kapabilitas IGD dan pemberitahuan sebelum kedatangan kepada petugas rumah sakit.

Hasil utama adalah satu alur yang berfungsi menyeluruh: laporan suara -> ringkasan AI terstruktur -> pencocokan rumah sakit -> pengiriman permintaan rujukan -> notifikasi dashboard IGD -> konfirmasi petugas -> pembaruan status pada kedua antarmuka.

Proyek milik tim TwinTech, Universitas Negeri Jakarta, untuk INCEPTION 2026 Online Hackathon. Proposal merencanakan sprint 24 jam pada 31 Oktober-1 November 2026; ketentuan dan jadwal aktual perlu dicocokkan dengan challenge brief panitia sebelum sprint.

## 2. Dasar dan cara membaca dokumen

- Sumber: `Proposal_RujukCepat_TwinTech (1).pdf`, 12 halaman, diberikan pengguna.
- Tujuan, pengguna, dan fitur: halaman 2 serta 4-6.
- Arsitektur, delapan kapabilitas, teknologi, dan batas penggunaan AI: halaman 7-8.
- Sprint, prioritas, dan risiko: halaman 9-10.
- Luaran, target pengujian, dan pengembangan lanjutan: halaman 11-12.
- Rincian seperti skema data, nama status internal, mekanisme transaksi, dan pengujian teknis di dokumen proyek adalah usulan implementasi turunan, bukan kutipan persyaratan proposal.
- `GOAL.md` menetapkan hasil dan cakupan; `AGENTS.md` mengatur cara bekerja; `TASK.md` mencatat pelaksanaan dan bukti penyelesaian.

## 3. Pengguna dan kebutuhan

| Pengguna | Kebutuhan utama |
| --- | --- |
| Warga dan keluarga pasien | Melaporkan kondisi dengan sedikit pengetikan dan meninjau pilihan rumah sakit. |
| Kru ambulans, bidan, puskesmas, dan klinik | Mengirim informasi awal serta memilih tujuan berdasarkan kebutuhan fasilitas. |
| Petugas triase dan dokter jaga IGD | Memperbarui kesiapan, meninjau permintaan masuk, dan mengonfirmasi rujukan. |

Portal diutamakan untuk ponsel; dashboard diutamakan untuk desktop dan tetap responsif. Bahasa antarmuka utama adalah Bahasa Indonesia.

## 4. Cakupan dan urutan prioritas

### P0 - Alur inti harus stabil terlebih dahulu

1. Portal dapat meminta lokasi dan merekam laporan suara sekitar 10-15 detik, dengan kesempatan meninjau atau mengulangi masukan.
2. Layanan aplikasi mengirim masukan ke Gemini melalui server dan memvalidasi JSON hasilnya.
3. Hasil memuat SOAP (Subjective, Objective, Assessment, Plan), perkiraan urgensi MERAH/KUNING/HIJAU, alasan singkat, dan kebutuhan kapabilitas. Informasi yang tidak tersedia ditandai tidak diketahui.
4. Pengguna dapat meninjau hasil sebelum memilih tujuan. Bedakan laporan pengguna, pembacaan angka dari foto, dan interpretasi AI.
5. Pencocokan menyaring kesiapan dan kapasitas terlebih dahulu, kemudian mempertimbangkan estimasi perjalanan. Tampilkan satu kandidat utama dan alternatif jika tersedia.
6. Peta menampilkan lokasi dan rute perkiraan; asal data lokasi, status simulasi, dan keterbatasan ETA dapat dilihat pengguna.
7. Pengiriman rujukan menyimpan ringkasan, tujuan, dan ETA; dashboard menerima pre-arrival alert serta menyediakan konfirmasi petugas.
8. Penguncian satu kuota simulasi konsisten antartampilan, tidak menyebabkan kapasitas negatif, dan tidak dihitung sebagai konfirmasi penerimaan klinis.
9. Dashboard dapat memperbarui kapasitas serta status kapabilitas READY, PENUH, atau MAINTENANCE. Perubahan memengaruhi rekomendasi portal.
10. Kegagalan izin perangkat, AI, peta/rute, jaringan, dan sinkronisasi memiliki status yang jelas serta langkah pemulihan.

### P1 - Kelengkapan MVP proposal setelah alur inti stabil

- Foto pendukung opsional melalui unggahan atau kamera; kegagalan foto tidak memblokir laporan suara.
- Panduan suara menggunakan Web Speech API `speechSynthesis`, dengan kontrol putar dan berhenti serta teks yang tetap terbaca.
- Alarm suara dashboard bila didukung browser; notifikasi visual tetap tersedia jika audio tidak dapat diputar.
- Kelengkapan PWA, ikon, manifest, dan pengalaman pemasangan pada perangkat yang mendukung.
- Penyempurnaan kontras, tombol besar, fokus keyboard, dan tata letak mobile/desktop.

P1 tetap bagian dari luaran yang direncanakan. Jika ada yang ditunda karena batas sprint, catat secara terbuka di `TASK.md` dan README; jangan menyatakan MVP lengkap terhadap proposal tanpa menjelaskan selisihnya.

## 5. Taksonomi kapabilitas

Gunakan kode yang sama pada schema AI, database, pencocokan, seed, dan pengujian.

| Kode | Kapabilitas |
| --- | --- |
| IGD_DASAR | Layanan IGD dasar |
| CATH_LAB | Laboratorium kateterisasi jantung |
| CT_SCAN | Pemeriksaan CT scan |
| ICU_VENTILATOR | Perawatan intensif dengan dukungan ventilator |
| PONEK_NICU | Layanan obstetri neonatal emergensi dan perawatan intensif neonatus |
| TRAUMA_BEDAH | Penanganan trauma dan layanan bedah |
| HEMODIALISA | Layanan hemodialisis |
| ANTI_BISA | Layanan terkait antibisa |

Jika kebutuhan tidak cukup jelas, tampilkan perlunya peninjauan. Jangan mengarang kesiapan kapabilitas atau mengubah ketidakpastian menjadi rekomendasi pasti. Aturan kecocokan untuk beberapa kebutuhan harus eksplisit dan teruji; kandidat yang kekurangan kebutuhan wajib tidak boleh diberi label cocok.

## 6. Teknologi dan batas arsitektur

| Komponen | Rencana dari proposal |
| --- | --- |
| Antarmuka | Next.js, React, Tailwind CSS, Lucide Icons |
| AI multimodal | Gemini API dengan JSON terstruktur; `gemini-2.5-flash` adalah kandidat proposal, bukan model yang sudah diverifikasi tersedia |
| Data dan sinkronisasi | Supabase PostgreSQL dan Realtime |
| Peta, lokasi, rute | Leaflet, OpenStreetMap, Overpass API, OSRM |
| Suara keluaran | Web Speech API `speechSynthesis` |
| Repositori dan hosting | GitHub dan Vercel |

Keputusan awal turunan: gunakan TypeScript, validasi masukan/keluaran di server, dan simpan konfigurasi penyedia pada environment variable. Periksa dokumentasi resmi, dukungan audio/gambar, kuota, biaya, dan versi kompatibel saat implementasi. Jangan mengubah stack utama tanpa alasan yang dicatat.

Aliran data: portal -> layanan aplikasi -> Gemini -> validasi -> pencocokan menggunakan Supabase dan estimasi rute -> transaksi rujukan/kuota -> Supabase Realtime -> dashboard. Pembaruan petugas mengalir kembali ke portal. Data persisten menjadi sumber kebenaran, bukan state lokal masing-masing layar.

## 7. Batas penggunaan dan data

- Seluruh pasien, kapasitas, dan kesiapan layanan demo adalah simulasi dan diberi label terlihat.
- Nama/koordinat rumah sakit dari peta publik tidak membuktikan kemitraan, kesiapan layanan, atau penerimaan pasien. Contoh lokasi proposal: RSCM, RSUP Fatmawati, RSUD Tarakan, RSUD Pasar Minggu, dan RS PON.
- AI membantu ringkasan dan perkiraan triase awal. Diagnosis akhir, terapi, dan keputusan penerimaan tetap pada tenaga kesehatan.
- Isi bagian Plan dan TTS dibatasi untuk koordinasi dan materi yang telah ditinjau; jangan menghasilkan instruksi terapi definitif atau dosis obat.
- ETA OSRM adalah perkiraan dan tidak boleh disebut estimasi lalu lintas langsung tanpa sumber yang mendukung.
- Demo menggunakan data sintetis; hindari identitas pasien nyata. Jelaskan penggunaan audio/foto sebelum mengunggah, batasi akses petugas, dan tetapkan penghapusan data demo.
- Jangan menyimpan rahasia di frontend atau repositori. Tinjau hak akses database dan media sebelum demo publik.
- PWA tidak boleh menampilkan kapasitas cache lama seolah masih mutakhir. Jika offline, tampilkan statusnya dan jangan memberi konfirmasi rujukan berhasil sebelum tersimpan di server.

## 8. Di luar cakupan MVP

- Integrasi operasional dengan SIRANAP, SISRUTE, rekam medis, dan sistem internal rumah sakit.
- Penggunaan data kapasitas nyata tanpa kerja sama dan verifikasi fasilitas.
- Diagnosis otonom, resep, terapi definitif, serta klaim keselamatan atau manfaat klinis yang belum diuji.
- Dispatch ambulans, pelacakan armada berkelanjutan, pembayaran, dan cakupan nasional.
- Pembuktian penurunan rujukan berulang atau perbaikan hasil klinis melalui uji lapangan.

## 9. Kriteria penerimaan fungsional

| ID | Kriteria yang harus dapat dibuktikan |
| --- | --- |
| AC-01 | Rekaman 10-15 detik dapat dikirim dan menghasilkan keluaran terstruktur yang lolos schema; hasil tidak valid tidak digunakan untuk pencocokan. |
| AC-02 | Nilai yang tidak dilaporkan tetap tidak diketahui; sumber data dan interpretasi AI dapat dibedakan di tampilan. |
| AC-03 | Delapan kode kapabilitas didukung. Fasilitas PENUH/MAINTENANCE atau berkapasitas nol tersaring; alternatif dan keadaan tanpa kandidat ditangani. |
| AC-04 | Peta/daftar memperlihatkan pilihan tujuan dan ETA beserta keterbatasannya; kegagalan rute tidak menghasilkan ETA palsu. |
| AC-05 | Satu pengiriman menghasilkan satu rujukan di dashboard yang memuat ringkasan, tujuan, waktu, dan ETA bila tersedia. |
| AC-06 | Konfirmasi petugas terlihat di portal. Status permintaan, hasil AI, dan penguncian kuota terlihat sebagai informasi berbeda. |
| AC-07 | Pada uji dua permintaan serentak dengan sisa satu kuota, hanya satu yang memperoleh kuota; retry tidak mengurangi kuota dua kali. Pelepasan kuota mengikuti lifecycle terdokumentasi. |
| AC-08 | Pembaruan kapabilitas atau kapasitas di dashboard menyegarkan portal, termasuk setelah koneksi Realtime tersambung kembali. |
| AC-09 | Penolakan izin mikrofon/lokasi, AI gagal atau JSON rusak, tidak ada kandidat, dan koneksi putus memiliki pesan serta pemulihan yang dapat digunakan. |
| AC-10 | Portal nyaman digunakan pada ponsel; dashboard pada desktop. Status tidak hanya dibedakan lewat warna; alur utama dapat dioperasikan dengan keyboard. |
| AC-11 | Foto opsional dan TTS berfungsi pada perangkat yang mendukung; keterbatasan dan fallback terlihat pada perangkat lain. |
| AC-12 | Demo publik memakai data simulasi, dashboard memiliki pembatasan akses, dan kredensial server tidak muncul di bundle klien atau log. |

## 10. Target performa dan pelaporannya

Semua angka berikut adalah sasaran proposal, bukan hasil terverifikasi atau jaminan layanan.

| Indikator | Target | Batas pengukuran yang digunakan |
| --- | --- | --- |
| Durasi laporan | 10-15 detik | Lama rekaman suara pengguna. |
| Respons AI | < 3 detik | Catat waktu panggilan penyedia sampai respons lengkap; laporkan juga total unggah, validasi, dan tampilan hasil. |
| Koordinasi digital | < 15 detik | Dari pengguna mengirim masukan hingga rujukan tersimpan; termasuk waktu meninjau/memilih yang terjadi, di luar perjalanan dan konfirmasi petugas. |
| Sinkronisasi | < 200 ms | Dari pembaruan persisten hingga UI penerima menampilkan perubahan; dokumentasikan metode dan keterbatasan jam lintas perangkat. |
| Interaksi pembaruan status | < 2 detik | Dari tindakan petugas hingga status tersimpan dan mendapat umpan balik di dashboard. |

Catat jumlah percobaan, perangkat/browser, jaringan, ukuran audio/foto, model/layanan, waktu setiap tahap, dan kegagalan. Pisahkan hasil layanan nyata dari hasil mock. Laporkan target yang tidak tercapai beserta angka aktual; jangan menghapus kegagalan dari laporan.

## 11. Skenario demonstrasi dan definisi selesai

Gunakan skenario sintetis proposal: pendamping melaporkan lansia 70 tahun lemas dan berkeringat dingin; foto opsional alat ukur menunjukkan 46 mg/dL. Uji ekstraksi informasi yang dilaporkan dan keterhubungan alur. Jangan menetapkan diagnosis, terapi, atau kategori klinis sebagai fakta yang telah divalidasi dari contoh ini.

Proyek siap dinilai ketika alur P0 terbukti pada dua tampilan, kelengkapan P1 atau penundaannya tercatat, kriteria penerimaan memiliki bukti, dan paket berikut tersedia:

- Aplikasi demo dua antarmuka yang dapat diakses dan repositori GitHub.
- README berisi setup, environment variable tanpa rahasia, seed/reset demo, arsitektur, keterbatasan, serta hasil pengujian.
- Deklarasi penggunaan AI, layanan pihak ketiga, dan atribusi data/peta.
- Tag `submission-24h`, video demo kurang dari tiga menit, pitch deck, dan bahan pengumpulan Devpost sesuai brief yang telah diperiksa.
- Daftar pekerjaan tersisa yang jujur. Validasi klinis dan kesiapan operasional tetap pekerjaan lanjutan.
