"use client";

import { Lock } from "lucide-react";
import type { ServiceStatus } from "@/lib/client/api";

export function ConsentStep({ status, checked, onChange }: { status: ServiceStatus | null; checked: boolean; onChange: (v: boolean) => void }) {
  const provider =
    status?.ai_mode === "MOCK"
      ? "Server aplikasi menggunakan skenario contoh; rekaman tidak dianalisis oleh Gemini."
      : `Server aplikasi, lalu Google Gemini API${status?.ai_model ? ` (${status.ai_model})` : ""} untuk menyusun ringkasan.`;
  const rows: [string, React.ReactNode][] = [
    ["Yang dikirim", "Rekaman suara atau teks, dan titik lokasi."],
    ["Diproses oleh", provider],
    [
      "Disimpan",
      <>
        Audio <strong>tidak disimpan</strong> setelah diproses. Ringkasan hanya ditampilkan di perangkat ini dan tidak disimpan di server.
      </>,
    ],
  ];
  return (
    <section aria-labelledby="consent-title" className="anim-rise anim-d1 card flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <h2 id="consent-title" className="text-lg font-extrabold">
          Bagaimana data diproses
        </h2>
      </div>
      <dl className="grid gap-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2.5 rounded-2xl bg-soft p-3">
            <dt className="w-[92px] shrink-0 text-[13px] font-bold text-muted">{k}</dt>
            <dd className="text-sm leading-normal">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="notice notice-warn !text-[13px]">
        Jangan sebut nama, NIK, atau identitas asli pasien. Hasil AI adalah perkiraan, bukan diagnosis atau konfirmasi rumah sakit.
      </p>
      <p className="text-sm text-ink-2">
        Darurat nyata? Hubungi{" "}
        <a className="font-bold text-brand-ink underline" href="tel:119">
          119
        </a>{" "}
        atau{" "}
        <a className="font-bold text-brand-ink underline" href="tel:112">
          112
        </a>
        .
      </p>
      <label
        className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-3 py-2 transition-colors ${checked ? "border-ink bg-white" : "border-line-strong bg-white hover:border-faint"}`}
      >
        <input type="checkbox" className="h-[22px] w-[22px] shrink-0 accent-ink" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="text-[15px] font-bold">Saya mengerti dan setuju laporan diproses</span>
      </label>
    </section>
  );
}
