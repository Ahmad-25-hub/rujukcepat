"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ServiceStatus } from "@/lib/client/api";

export function ConsentStep({ status, onAccept }: { status: ServiceStatus | null; onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const provider =
    status?.ai_mode === "MOCK"
      ? "Mode AI simulasi sedang aktif: rekaman dikirim ke server demo tetapi TIDAK dianalisis oleh Gemini; hasil berasal dari skenario sintetis."
      : `Rekaman suara (dan foto bila Anda tambahkan) dikirim melalui server aplikasi ke Google Gemini API${status?.ai_model ? ` (${status.ai_model})` : ""} untuk diringkas.`;
  return (
    <section aria-labelledby="consent-title" className="space-y-4">
      <h2 id="consent-title" className="flex items-center gap-2 text-xl font-bold">
        <ShieldCheck className="h-6 w-6 text-blue-700" aria-hidden />
        Sebelum melapor
      </h2>
      <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed">
        <li>{provider}</li>
        <li>
          Audio dan foto <strong>tidak disimpan</strong> setelah diproses. Ringkasan baru disimpan bila Anda mengirim permintaan rujukan.
        </li>
        <li>Ini <strong>demo dengan data simulasi</strong>. Jangan menyebut nama, NIK, atau identitas asli pasien.</li>
        <li>Hasil AI adalah perkiraan untuk membantu koordinasi, bukan diagnosis dan bukan konfirmasi rumah sakit.</li>
        <li>
          Dalam keadaan darurat nyata, hubungi <a className="font-bold text-red-700 underline" href="tel:119">119</a> atau{" "}
          <a className="font-bold text-red-700 underline" href="tel:112">112</a>.
        </li>
      </ul>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-slate-300 bg-white p-4 text-base">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 accent-blue-700"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>Saya memahami penjelasan di atas dan setuju laporan diproses untuk demo ini.</span>
      </label>
      <button
        type="button"
        disabled={!checked}
        onClick={onAccept}
        className="w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Lanjut ke lokasi
      </button>
    </section>
  );
}
