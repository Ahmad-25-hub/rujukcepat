"use client";

import { Check } from "lucide-react";
import { useState } from "react";

// Daftar periksa praktis non-klinis untuk keluarga. Hanya disimpan di state halaman.
const ITEMS: { id: string; title: string; body: string }[] = [
  { id: "jam", title: "Catat jam mulai gejala", body: "Tulis perkiraan jam keluhan pertama kali muncul. Petugas IGD hampir selalu menanyakannya." },
  { id: "ktp", title: "Bawa KTP dan kartu BPJS/asuransi", body: "Identitas dan kartu jaminan mempercepat pendaftaran di IGD." },
  { id: "obat", title: "Daftar obat yang sedang diminum", body: "Foto kemasannya atau tulis namanya. Jangan mengubah obat tanpa arahan tenaga kesehatan." },
  { id: "alat", title: "Alat ukur bila ada", body: "Glukometer atau tensimeter beserta hasil ukur terakhir, bila tersedia di rumah." },
];

export function PrepChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const count = ITEMS.filter((i) => done[i.id]).length;

  return (
    <div className="card overflow-hidden !rounded-2xl">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5" aria-live="polite">
        <span className="text-sm font-semibold text-ink-2">{count === ITEMS.length ? "Semua sudah disiapkan" : `${count} dari ${ITEMS.length} disiapkan`}</span>
        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9edf2]">
          <span className="absolute inset-y-0 left-0 rounded-full bg-ok transition-[width] duration-500 ease-out" style={{ width: `${(count / ITEMS.length) * 100}%` }} />
        </span>
      </div>
      <ul className="divide-y divide-line">
        {ITEMS.map((it) => {
          const on = !!done[it.id];
          return (
            <li key={it.id}>
              <label className="flex cursor-pointer items-start gap-3.5 px-5 py-4 transition-colors hover:bg-soft">
                <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => setDone((d) => ({ ...d, [it.id]: e.target.checked }))} />
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                    on ? "border-ok bg-ok text-white" : "border-[#b5becc] bg-white"
                  }`}
                  aria-hidden
                >
                  {on && <Check className="anim-pop h-4 w-4" strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className={`text-[15px] font-bold ${on ? "text-muted line-through decoration-2" : "text-ink"}`}>{it.title}</span>
                  <span className="text-[13.5px] leading-snug text-muted">{it.body}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
