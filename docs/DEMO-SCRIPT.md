# Demo RujukCepat dalam tiga menit

[Buka aplikasi](https://rujukcepat.vercel.app) · [Kembali ke README](../README.md)

Demo memperlihatkan hubungan antara laporan pelapor, pencocokan tujuan, dan perubahan kesiapan dari dashboard. Gunakan dua tab atau dua perangkat: portal pada ponsel, dashboard pada desktop. Kredensial petugas diberikan oleh tim secara terpisah.

## Persiapan singkat

- Tentukan lokasi contoh di Jakarta agar sesuai dengan rumah sakit akun petugas yang digunakan.
- Siapkan laporan sintetis: **“Ayah saya 70 tahun tiba-tiba lemas dan berkeringat dingin sejak 30 menit lalu. Masih bisa bicara, tetapi tampak bingung.”**
- Periksa mode layanan. AI live memanggil Gemini; mode contoh menggunakan fixture. Untuk memperlihatkan rute dan petunjuk belok, gunakan OSRM live.
- Gunakan **Pratinjau perjalanan** jika demo dilakukan tanpa bergerak. Posisi pratinjau adalah posisi buatan sepanjang rute.

## Alur presentasi

| Waktu | Tindakan | Pesan utama |
| --- | --- | --- |
| 0:00–0:20 | Buka beranda dan kesiapan IGD. | Memilih tujuan memerlukan informasi kebutuhan layanan dan kesiapan, selain lokasi. Prototipe memakai data fasilitas contoh. |
| 0:20–0:50 | Mulai laporan, setujui pemrosesan, pilih lokasi, lalu rekam atau ketik skenario. | Pelapor dapat menyampaikan kondisi dengan sedikit pengetikan. |
| 0:50–1:20 | Tinjau ringkasan SOAP, urgensi, dan kebutuhan. | Asal informasi terlihat; informasi yang belum diketahui tidak diisi sebagai fakta. |
| 1:20–1:50 | Cari rumah sakit, buka kandidat dan alternatif. | Semua kebutuhan wajib diperiksa sebelum kandidat diurutkan menurut perkiraan perjalanan. |
| 1:50–2:15 | Pada dashboard, ubah kuota RS menjadi nol; segarkan rekomendasi portal. | Perubahan fasilitas memengaruhi hasil. Memilih tujuan tidak mengurangi kuota. |
| 2:15–2:40 | Pilih tujuan lain, buka navigasi, lalu pratinjau perjalanan. | Peta, petunjuk belok, dan pilihan aplikasi peta membantu melanjutkan perjalanan. |
| 2:40–3:00 | Tekan **Sudah sampai** dan tunjukkan ringkasan serah terima. | Informasi dapat dibaca atau dibacakan kepada petugas; penerimaan pasien tetap keputusan rumah sakit. |

Jika layanan AI atau rute tidak tersedia, tunjukkan pesan pemulihan lalu coba ulang. Waktu respons bergantung pada penyedia dan jaringan; tidak perlu mengklaim durasi yang belum diukur pada sesi tersebut.

## Setelah demo

Kembalikan kuota/status yang diubah ke nilai sebelumnya. Hindari reset seluruh database bersama jika perubahan fasilitas lain masih diperlukan. Video dan tangkapan layar cukup memakai data sintetis tanpa membuka environment, kata sandi, atau identitas pasien nyata.
