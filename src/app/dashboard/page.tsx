import type { Metadata } from "next";
import Link from "next/link";
import { FacilityOverview } from "@/components/dashboard/facility-overview";
import { SimBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Dashboard IGD – RujukCepat" };

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-extrabold">
            RujukCepat
          </Link>
          <span className="text-sm text-slate-300">Dashboard IGD</span>
        </div>
        <SimBadge>Demo – data simulasi</SimBadge>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-6 py-6">
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-bold">Struktur dashboard (pratinjau baca-saja)</p>
          <p>
            Login petugas per rumah sakit, antrean permintaan rujukan, konfirmasi, dan pengubahan status READY/PENUH/MAINTENANCE dikerjakan pada tahap T11–T12.
            Halaman ini menampilkan status fasilitas simulasi yang saat ini dipakai pencocokan portal.
          </p>
        </div>
        <FacilityOverview />
      </main>
    </div>
  );
}
