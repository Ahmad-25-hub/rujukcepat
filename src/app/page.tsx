import { Hospital, Mic, Phone } from "lucide-react";
import Link from "next/link";
import { SimBadge } from "@/components/badges";
import { InstallButton } from "@/components/pwa";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-red-700 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-xl font-extrabold">RujukCepat</span>
          <SimBadge>Demo – data simulasi</SimBadge>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <h1 className="text-3xl font-extrabold leading-tight">Koordinasi rujukan gawat darurat lebih cepat</h1>
        <p className="text-lg text-slate-700">
          Ceritakan kondisi pasien dengan suara. AI merangkum laporan, lalu aplikasi mencari IGD yang kesiapan layanannya sesuai – sebelum Anda berangkat.
        </p>
        <Link
          href="/lapor"
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-700 px-6 py-6 text-2xl font-extrabold text-white shadow-lg hover:bg-red-800"
        >
          <Mic className="h-8 w-8" aria-hidden />
          Laporkan kondisi pasien
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <a href="tel:119" className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-700 bg-white px-4 py-4 text-lg font-bold text-red-700">
            <Phone className="h-5 w-5" aria-hidden />
            119
          </a>
          <a href="tel:112" className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-700 bg-white px-4 py-4 text-lg font-bold text-red-700">
            <Phone className="h-5 w-5" aria-hidden />
            112
          </a>
        </div>
        <InstallButton />
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Penting</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Ini demo hackathon. Status kapasitas dan kesiapan rumah sakit adalah simulasi.</li>
            <li>Lokasi rumah sakit dari OpenStreetMap tidak menyiratkan kemitraan atau penerimaan pasien.</li>
            <li>Ringkasan AI bukan diagnosis; keputusan klinis tetap pada tenaga kesehatan.</li>
          </ul>
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold text-blue-800 underline">
          <Hospital className="h-5 w-5" aria-hidden />
          Dashboard IGD (petugas demo)
        </Link>
      </main>
      <footer className="px-4 py-4 text-center text-xs text-slate-500">TwinTech · Universitas Negeri Jakarta · INCEPTION 2026</footer>
    </div>
  );
}
