import { ChevronDown } from "lucide-react";

// Tanya jawab yang menjelaskan batas layanan dengan bahasa sederhana. Isi harus
// konsisten dengan perilaku aplikasi (lihat consent-step dan destination-step).
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Apakah RujukCepat menggantikan ambulans 119?",
    a: "Tidak. Untuk pasien yang tidak sadar, tidak bernapas, atau mengalami perdarahan hebat, telepon 119 atau 112 lebih dulu. RujukCepat membantu memilih IGD tujuan bila pasien dapat dibawa sendiri atau sambil menunggu arahan petugas.",
  },
  {
    q: "Apakah rumah sakit pasti menerima pasien?",
    a: "Belum tentu. RujukCepat tidak memesan tempat. Rekomendasi didasarkan pada status layanan dan kuota yang diperbarui petugas IGD; keputusan menerima pasien tetap ada pada rumah sakit saat pasien tiba. Bila memungkinkan, hubungi rumah sakit sebelum berangkat.",
  },
  {
    q: "Apakah ringkasan AI sama dengan diagnosis?",
    a: "Tidak. Ringkasan SOAP dan tingkat urgensi adalah perkiraan untuk membantu koordinasi. Anda dapat memeriksa dan mengoreksinya sebelum mencari rumah sakit, dan keputusan klinis tetap pada tenaga kesehatan.",
  },
  {
    q: "Apa yang terjadi dengan rekaman suara saya?",
    a: "Pada mode AI live, rekaman atau teks diproses Google Gemini melalui server aplikasi untuk menyusun ringkasan. Mode contoh menggunakan skenario yang telah disiapkan. Audio tidak disimpan oleh aplikasi setelah diproses, dan ringkasan hanya ditampilkan di perangkat Anda. Lokasi digunakan untuk pencocokan dan rute. Jangan sebut nama atau NIK pasien.",
  },
  {
    q: "Dari mana data kesiapan IGD berasal?",
    a: "Petugas memperbarui status delapan layanan dan kuota lewat dashboard RujukCepat. Prototipe ini memakai data fasilitas contoh untuk demonstrasi. Lokasi rumah sakit berasal dari OpenStreetMap dan tidak menyatakan kemitraan atau kesiapan layanan yang telah diverifikasi.",
  },
  {
    q: "Perlu membuat akun?",
    a: "Tidak untuk pelapor. Akun hanya diperlukan bagi petugas IGD yang memperbarui data rumah sakitnya.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {FAQ.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
          </summary>
          <p className="faq-answer pb-5 pr-8 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
