# Atribusi dan penggunaan layanan

[Kembali ke README](../README.md)

## AI dalam aplikasi dan pengembangan

Google Gemini API digunakan pada mode live untuk menyusun transkrip/ringkasan, SOAP, perkiraan urgensi, dan kebutuhan kapabilitas dari laporan suara atau teks. Pemanggilan berlangsung di server melalui `@google/genai`; model diatur lewat environment. Keluaran diperiksa dengan Zod dan ditinjau pelapor sebelum pencocokan.

Mode `mock` memakai fixture sintetis dalam `tests/fixtures/ai` dan tidak memanggil Gemini. Hasil fixture tidak menjadi bukti performa atau akurasi klinis Gemini. Audio pengujian pada `tests/fixtures/audio` juga bersifat sintetis.

Pengembangan kode dan dokumentasi dibantu asisten AI, termasuk Claude dan Codex, di bawah arahan tim TwinTech. Ringkasan AI pada aplikasi membantu koordinasi; validasi teknis tidak menggantikan penilaian tenaga kesehatan.

Pemrosesan pada penyedia mengikuti [ketentuan Gemini API](https://ai.google.dev/gemini-api/terms). Gunakan masukan sintetis saat mencoba prototipe dan jangan menyertakan identitas pasien nyata.

## Peta, lokasi, dan perjalanan

| Sumber | Penggunaan | Atribusi |
| --- | --- | --- |
| OpenStreetMap | Peta dan snapshot lokasi rumah sakit. | © OpenStreetMap contributors; [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) dan [informasi lisensi](https://www.openstreetmap.org/copyright). |
| Overpass API | Pengambilan snapshot lokasi melalui skrip. | Data tetap berasal dari OpenStreetMap. |
| Leaflet | Penyajian peta interaktif. | [Leaflet](https://leafletjs.com/). |
| OSRM | Rute, jarak, petunjuk belok, dan perkiraan perjalanan. | [Project OSRM](https://project-osrm.org/). ETA tidak mencakup lalu lintas langsung. |

Snapshot berada di `data/` dan `data/osm/`; seed turunannya berada di `supabase/seed-osm.sql`. Data turunan OpenStreetMap mengikuti ODbL. Status kapabilitas dan kapasitas pada seed adalah data contoh yang dibuat untuk prototipe dan bukan bagian dari verifikasi OpenStreetMap.

## Foto beranda

Berkas diunduh pada 1 November 2026 dan dikompresi ulang untuk web. Kredit sumber dipertahankan pada footer aplikasi.

| Berkas | Karya dan pembuat | Sumber/lisensi |
| --- | --- | --- |
| `public/images/beranda-jakarta-malam.jpg` | “Vibrant Night in Jakarta” — David Tumpal | Pexels, [lisensi Pexels](https://www.pexels.com/license/). |
| `public/images/beranda-pelapor.jpg` | “Woman in Pink Hijab Holding Black Mobile Phone” — Tia Rahayu | Pexels, [lisensi Pexels](https://www.pexels.com/license/). |
| `public/images/beranda-petugas-igd.jpg` | “Healthcare Professionals in Hospital Corridor” — Adarsh Mp | Pexels, [lisensi Pexels](https://www.pexels.com/license/). |
| `public/images/beranda-ambulans.jpg` | “Toyota HiAce ambulance in Jakarta, Indonesia” — Secretdriver | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Toyota_HiAce_ambulance_in_Jakarta,_Indonesia.jpg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). |

Orang yang tampil pada foto adalah model stok. Foto tidak menyatakan identitas pasien, keanggotaan tim, kemitraan rumah sakit, atau dukungan terhadap RujukCepat.

## Identitas dan dependensi

Logo RujukCepat disediakan tim dan dipakai pada header, favicon, serta ikon PWA. Dependensi beserta versi terkunci tercantum di [`package.json`](../package.json) dan [`package-lock.json`](../package-lock.json); masing-masing mengikuti lisensinya.
