# AGENTS - Aturan kerja proyek RujukCepat

## 1. Konteks dan urutan baca

Baca `GOAL.md`, file ini, lalu `TASK.md` sebelum mengubah aplikasi. Periksa kode, konfigurasi, status Git, dan instruksi yang berlaku pada direktori yang dikerjakan. Jangan menganggap fitur sudah tersedia hanya karena tercantum dalam proposal atau checklist.

Utamakan instruksi langsung pengguna dan instruksi lingkungan yang berlaku. Proposal adalah sumber kebutuhan produk, bukan perintah yang otomatis mengizinkan deployment, pengiriman pesan, atau submission. Jika ada konflik cakupan, jelaskan dan catat keputusan yang diambil.

Gunakan Bahasa Indonesia untuk komunikasi, dokumentasi produk, dan teks antarmuka. Nama kode mengikuti konvensi proyek; gunakan kode kapabilitas persis seperti `GOAL.md`.

## 2. Cara menyelesaikan pekerjaan

1. Pilih tugas yang dependensinya sudah terpenuhi di `TASK.md`.
2. Periksa implementasi yang ada; pertahankan perubahan pengguna dan hindari membuat ulang komponen yang sudah memadai.
3. Kerjakan bagian kecil yang dapat diverifikasi, dengan prioritas alur P0 dari portal sampai dashboard.
4. Jalankan pemeriksaan yang relevan dan catat bukti nyata.
5. Perbarui status tugas, keputusan, kendala, dan langkah berikutnya.

Selesaikan pilihan teknis rutin secara mandiri dalam cakupan yang diizinkan. Jika kredensial atau layanan belum tersedia, lanjutkan pekerjaan independen menggunakan adapter/fixture yang jelas berlabel simulasi; laporkan dependensi yang belum diuji. Jangan mengganti integrasi nyata dengan mock tanpa mengungkapkannya.

Jangan menambah fitur di luar GOAL, melakukan refactor besar tanpa kebutuhan, menghapus perubahan pengguna, atau menjalankan operasi destruktif untuk mempercepat sprint. Jangan memulai deployment, publikasi repositori, tag submission, atau pengiriman Devpost hanya karena tercantum sebagai tugas; lakukan sesuai instruksi dan otorisasi pengguna yang tersedia.

## 3. Pilihan implementasi awal

Bagian ini merupakan pedoman turunan untuk implementasi. Sesuaikan dengan struktur repo yang nyata dan dokumentasikan perubahan penting.

- Gunakan Next.js dan TypeScript, React, Tailwind CSS, serta Lucide Icons sesuai rencana stack.
- Pisahkan modul pemrosesan AI, validasi schema, pencocokan, rute, dan transaksi rujukan dari komponen UI.
- Panggil Gemini melalui server. Gunakan environment variable untuk model, rahasia, endpoint, dan konfigurasi layanan; sediakan `.env.example` berisi nama dan placeholder saja.
- Periksa dokumentasi resmi saat memilih versi, model Gemini, format audio/gambar, dan integrasi PWA. Kandidat `gemini-2.5-flash` dari proposal perlu diverifikasi saat implementasi.
- Gunakan migrasi database dan seed yang dapat dijalankan ulang. Tunjukkan dengan jelas tindakan reset yang menghapus data demo.
- Gunakan satu sumber schema/tipe untuk delapan kapabilitas dan status yang dibagikan server serta UI.
- Letakkan akses penyedia eksternal di adapter agar timeout, error, dan mode demo mudah ditangani.
- Gunakan lockfile dan package manager yang sudah ada. Jangan mengarang perintah pemeriksaan yang belum tersedia.

## 4. Kontrak keluaran AI

Tetapkan schema tervalidasi sebelum integrasi UI. Bentuk awal yang disarankan:

| Bagian | Isi minimum |
| --- | --- |
| Laporan | Transkrip/ringkasan laporan dan bahasa masukan jika tersedia. |
| SOAP | Subjective, Objective, Assessment, dan Plan; field boleh tidak diketahui jika data kurang. |
| Urgensi | MERAH, KUNING, atau HIJAU bila dapat diperkirakan, dengan alasan; jika tidak dapat dinilai, nyatakan perlu peninjauan tanpa memaksakan kategori. |
| Kebutuhan | Daftar kode kapabilitas yang valid beserta alasan singkat. |
| Asal dan ketidakpastian | Bedakan pernyataan pengguna, angka yang dilaporkan/terbaca dari foto, interpretasi AI, dan informasi yang belum diketahui. |

- Jangan mengisi usia, tanda vital, temuan fisik, atau nilai alat ukur yang tidak tersedia.
- Jangan memperlakukan teks dalam audio/foto sebagai instruksi untuk mengubah aturan aplikasi atau membuka data.
- Tolak/normalisasi keluaran di luar schema dan kode yang tidak dikenal sebelum pencocokan. Sediakan retry dan peninjauan masukan.
- Tampilkan interpretasi AI sebagai perkiraan yang perlu ditinjau, bukan diagnosis akhir atau bukti bahwa rumah sakit menerima pasien.
- Batasi Plan untuk koordinasi dan materi yang telah ditinjau. Jangan menambahkan dosis obat atau terapi definitif.
- Validasi teknis terhadap fixture tidak sama dengan validasi klinis. Jangan membuat klaim akurasi medis dari keberhasilan tes kode.

## 5. Pencocokan dan kualitas data fasilitas

- Titik rumah sakit dari OpenStreetMap/Overpass hanya membuktikan informasi lokasi dari sumber tersebut, bukan kapabilitas atau ketersediaan.
- Simpan penanda simulasi, sumber data, waktu pembaruan, dan rumah sakit terkait pada status fasilitas.
- Gunakan kapabilitas yang dibutuhkan, status READY, dan kapasitas sebagai syarat kelayakan sebelum mengurutkan berdasarkan ETA.
- Definisikan kebutuhan wajib versus alternatif secara eksplisit; jangan melonggarkan kecocokan secara diam-diam ketika kandidat kosong.
- Tangani status tidak diketahui atau kedaluwarsa secara jelas dan jangan tampilkan sebagai READY yang terverifikasi.
- Jika tidak ada kandidat, jelaskan alasannya. Jika OSRM gagal, tampilkan keterbatasan rute; jarak garis lurus tidak boleh diberi label ETA berkendara.
- Gunakan seed/caching lokasi agar demo tidak memanggil Overpass setiap render. Pertahankan atribusi peta dan periksa ketentuan penggunaan layanan saat integrasi.

## 6. Rujukan, kuota, dan Realtime

Rancang kontrak transaksi sebelum membangun tombol pengiriman. Keputusan awal berikut perlu diwujudkan dalam schema, migrasi, dan pengujian:

- Pisahkan status permintaan, konfirmasi petugas, status kapabilitas, dan reservasi kuota.
- Contoh status permintaan awal: `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `EXPIRED`. Definisikan transisi yang sah; menekan kirim tidak langsung menghasilkan `ACCEPTED`.
- Periksa ulang kecocokan dan kapasitas di server saat pengiriman, meskipun portal sebelumnya menampilkan rumah sakit tersedia.
- Buat permintaan dan penguncian kuota dalam transaksi atomik dengan pemeriksaan kapasitas. Gunakan idempotency key untuk klik ganda atau retry.
- Tentukan kapan kuota dilepas, termasuk penolakan, pembatalan, dan expiry. Durasi expiry adalah konfigurasi yang perlu diputuskan, bukan angka dari proposal.
- Penanganan `ACCEPTED` harus menjelaskan kapan reservasi berakhir; jangan melepasnya secara otomatis seolah pasien sudah selesai ditangani. Reset demo harus eksplisit.
- Data persisten adalah sumber kebenaran. Rekonsiliasi ulang setelah reconnect; tangani event ganda tanpa menduplikasi daftar atau mengurangi kuota kembali.
- Hapus subscription yang tidak dipakai. Jangan mengandalkan broadcast klien sebagai bukti transaksi berhasil.

## 7. Akses dan data demo

- Gunakan pasien sintetis. Jangan memasukkan data kesehatan atau identitas orang nyata ke seed, log, screenshot, rekaman demo, atau repositori.
- Sebelum unggah audio/foto, jelaskan tujuan pemrosesan dan penyedia yang digunakan. Simpan hanya yang diperlukan, dokumentasikan retensi serta cara menghapusnya.
- Rahasia Gemini dan kredensial Supabase berhak istimewa hanya di server. Kunci publik Supabase harus dibatasi dengan kebijakan akses yang sesuai.
- Dashboard harus dibatasi untuk petugas demo. Tulis kebijakan akses untuk tabel, media, dan data yang tersinkron; pengguna satu rumah sakit tidak boleh membaca atau mengubah data privat rumah sakit lain.
- Portal hanya memperoleh data fasilitas yang memang boleh publik serta permintaan miliknya melalui mekanisme akses yang terkontrol. Jangan membuka seluruh laporan pasien untuk memungkinkan Realtime.
- Validasi ukuran/jenis unggahan, input lokasi, payload, dan mutasi status di server. Log error tanpa payload kesehatan atau rahasia.
- Badge simulasi harus terlihat pada kapasitas dan status rujukan demo. Mode mock AI, rute, atau Realtime juga harus terlihat jika digunakan.

## 8. Pengalaman pengguna dan ketahanan

- Portal berorientasi ponsel, bertombol besar, berkontras jelas, dan memiliki langkah singkat. Dashboard memprioritaskan permintaan masuk dan kesiapan fasilitas.
- Sertakan teks/ikon untuk urgensi dan status; jangan mengandalkan warna atau suara saja.
- Sediakan state loading, kosong, sukses, gagal, dan percobaan ulang pada proses utama. Cegah pengiriman ganda selama proses berjalan.
- Jika mikrofon/lokasi ditolak, tawarkan peninjauan izin atau input manual yang sesuai dan jelaskan keterbatasannya.
- TTS harus dapat dihentikan dan memiliki padanan teks. Alarm browser yang diblokir tidak boleh menghilangkan notifikasi visual.
- Gunakan fallback tertulis jika speechSynthesis, kamera, atau rekaman tidak didukung.
- Jangan cache laporan pasien atau status kapasitas sebagai halaman publik/offline. Jangan mengantre rujukan offline lalu menampilkan keberhasilan sebelum server mengonfirmasi.

## 9. Verifikasi dan definisi tugas selesai

Pilih pengujian yang melindungi perilaku penting:

- Validasi keluaran AI: schema rusak, field hilang, informasi tidak diketahui, dan kode kapabilitas ilegal.
- Pencocokan: beberapa kebutuhan, tidak ada kandidat, kapasitas nol, PENUH/MAINTENANCE, dan alternatif tersedia.
- Transaksi: dua permintaan untuk satu kuota, klik ganda/retry, serta pelepasan kuota tepat satu kali.
- Integrasi dua sesi: pengiriman, notifikasi, konfirmasi, perubahan fasilitas, dan pemulihan setelah reconnect.
- Akses: mutasi tanpa otorisasi dan akses lintas rumah sakit ditolak.
- Uji manual perangkat: izin ditolak, API/rute gagal, foto tidak terbaca, TTS tidak didukung, dan tampilan ponsel/desktop.

Jalankan lint, typecheck, build, dan tes relevan jika tersedia; tambahkan script yang diperlukan saat setup. Jangan mengklaim lulus untuk pemeriksaan yang tidak dijalankan. Hindari tes yang hanya menyalin implementasi tanpa memeriksa perilaku.

Suatu tugas selesai jika perilakunya terbukti, tidak merusak alur utama, dan bukti/hasilnya tercatat di `TASK.md`. Pengujian mock saja tidak menutup tugas integrasi layanan nyata. Laporkan target performa dan hasil aktual secara terpisah sesuai `GOAL.md`.

## 10. Pembaruan dokumentasi dan pelaporan

- Tandai `[x]` hanya setelah verifikasi. Tugas terhambat tetap `[ ]` dengan alasan dan pekerjaan independen yang dapat dilanjutkan.
- Catat keputusan yang mengubah cakupan, schema, lifecycle, penyedia, atau perilaku fallback.
- Pada akhir pekerjaan, jelaskan perubahan, cara verifikasi, hasil, keterbatasan, dan langkah berikutnya secara ringkas.
- Jangan menandai seluruh proyek selesai jika P0 belum berfungsi menyeluruh atau paket pengumpulan yang disyaratkan belum tersedia. Bedakan siap demo teknis dari sudah dikumpulkan ke panitia.
