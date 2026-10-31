import type { Metadata } from "next";
import Link from "next/link";
import { ReportWizard } from "@/components/portal/report-wizard";

export const metadata: Metadata = { title: "Laporkan kondisi pasien – RujukCepat" };

export default function LaporPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between bg-red-700 px-4 py-3 text-white">
        <Link href="/" className="text-lg font-extrabold">
          RujukCepat
        </Link>
        <a href="tel:119" className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-red-700">
          Darurat 119
        </a>
      </header>
      <ReportWizard />
    </div>
  );
}
