"use client";

import { Hospital, Mic } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLink } from "@/components/badges";

const NAV = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#kesiapan", label: "Kesiapan IGD" },
  { href: "#layanan", label: "Layanan" },
  { href: "#tanya-jawab", label: "Tanya jawab" },
];

// Header menempel; bayangan tipis muncul setelah halaman digulir.
export function HomeHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-[border-color,box-shadow] duration-200 ${
        scrolled ? "border-line shadow-[0_6px_20px_-16px_rgba(11,19,36,.5)]" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <BrandLink />
        <nav aria-label="Bagian beranda" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-[14.5px] font-medium text-ink-2 transition-colors hover:bg-[#f1f3f6] hover:text-ink">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/dashboard" aria-label="Dashboard untuk petugas IGD" className="btn btn-ghost min-w-11 px-3 text-sm font-semibold text-ink-2">
            <Hospital className="h-[18px] w-[18px]" aria-hidden />
            <span className="max-sm:hidden">Petugas IGD</span>
          </Link>
          <Link href="/lapor" className="btn btn-brand px-3.5 text-sm">
            <Mic className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">Lapor</span>
            <span className="max-sm:hidden">Mulai laporan</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
