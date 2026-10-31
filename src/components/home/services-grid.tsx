"use client";

import { Bandage, Baby, Droplets, HeartPulse, ScanLine, Siren, Syringe, Wind, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion";
import { CAPABILITY_CODES, CAPABILITY_LABELS, type CapabilityCode } from "@/lib/schema/enums";
import { useFacilityFeed } from "./facility-feed";

// Delapan kode kapabilitas yang dicocokkan (sumber: enums.ts). Deskripsi hanya
// menjelaskan jenis layanan, bukan saran medis.
const SERVICE: Record<CapabilityCode, { short: string; desc: string; icon: LucideIcon }> = {
  IGD_DASAR: { short: "IGD dasar", desc: "Penanganan awal kegawatdaruratan", icon: Siren },
  CATH_LAB: { short: "Cath Lab", desc: "Laboratorium kateterisasi jantung", icon: HeartPulse },
  CT_SCAN: { short: "CT scan", desc: "Pencitraan cepat kepala dan tubuh", icon: ScanLine },
  ICU_VENTILATOR: { short: "ICU", desc: "Perawatan intensif dengan ventilator", icon: Wind },
  PONEK_NICU: { short: "PONEK/NICU", desc: "Gawat darurat kehamilan dan bayi baru lahir", icon: Baby },
  TRAUMA_BEDAH: { short: "Trauma", desc: "Penanganan cedera berat dan bedah", icon: Bandage },
  HEMODIALISA: { short: "Hemodialisa", desc: "Layanan cuci darah", icon: Droplets },
  ANTI_BISA: { short: "Antibisa", desc: "Serum untuk gigitan hewan berbisa", icon: Syringe },
};

export function ServicesGrid() {
  const { summary } = useFacilityFeed();
  return (
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line min-[440px]:grid-cols-2 lg:grid-cols-4">
      {CAPABILITY_CODES.map((code, i) => {
        const s = SERVICE[code];
        const Icon = s.icon;
        const n = summary?.readyByCapability[code];
        return (
          <Reveal as="li" key={code} delay={(i % 4) * 60} className="group flex flex-col gap-3 bg-white p-5 transition-colors hover:bg-soft">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f3f6] text-ink transition-colors group-hover:bg-ink group-hover:text-white">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-bold text-ink">{s.short}</span>
              <span className="text-[13.5px] leading-snug text-muted" title={CAPABILITY_LABELS[code]}>
                {s.desc}
              </span>
            </span>
            <span className="mt-auto text-[12.5px] font-semibold">
              {n == null ? (
                <span className="skeleton block h-4 w-20" aria-hidden />
              ) : n > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-ok-strong">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
                  {n} RS siap saat ini
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-faint" aria-hidden />
                  Belum ada RS siap
                </span>
              )}
            </span>
          </Reveal>
        );
      })}
    </ul>
  );
}
