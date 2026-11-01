import { CircleAlert, Clock, MapPin, Mic, Navigation } from "lucide-react";

// Pratinjau kecil tampilan portal untuk bagian "Cara kerja". Data contoh sintetis,
// bukan pasien atau status nyata, dan diberi label "Contoh tampilan".

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border border-line bg-white p-3.5 shadow-[0_1px_2px_rgba(11,19,36,.05)]" aria-hidden>
      <span className="absolute right-2.5 top-2.5 text-[10px] font-semibold uppercase tracking-wider text-faint">Contoh tampilan</span>
      {children}
    </div>
  );
}

export function RecordPreview() {
  return (
    <Frame>
      <div className="flex items-center gap-3 pt-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white">
          <span className="anim-ring absolute inset-0 rounded-full bg-brand/40" />
          <Mic className="relative h-5 w-5" />
        </span>
        <div className="flex h-9 flex-1 items-center gap-[3px]">
          {[0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.9, 0.6, 0.75, 0.45, 0.95, 0.5, 0.7, 0.4, 0.8].map((h, i) => (
            <span key={i} className="preview-wave w-[3px] rounded-full bg-brand/80" style={{ height: `${h * 100}%`, animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        <span className="font-mono text-xs font-bold text-ink-2">00:12</span>
      </div>
      <p className="mt-3 rounded-lg bg-soft px-3 py-2 text-[12.5px] leading-snug text-ink-2">“Bapak saya nyeri dada sejak setengah jam lalu, keringat dingin…”</p>
    </Frame>
  );
}

export function SummaryPreview() {
  return (
    <Frame>
      <div className="flex flex-col gap-2.5 pt-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-signal-yellow px-2 py-0.5 text-xs font-extrabold text-[#3b2a00]">
          <CircleAlert className="h-3.5 w-3.5" />
          KUNING – perlu segera
        </span>
        <dl className="grid grid-cols-[22px_1fr] gap-x-2 gap-y-1.5 text-[12.5px] leading-snug">
          <dt className="font-mono font-bold text-ink">S</dt>
          <dd className="text-ink-2">Nyeri dada ± 30 menit, keringat dingin</dd>
          <dt className="font-mono font-bold text-ink">O</dt>
          <dd className="text-ink-2">Tensi 150/95 (disebut pelapor)</dd>
          <dt className="font-mono font-bold text-ink">A</dt>
          <dd className="text-ink-2">Perkiraan AI: perlu evaluasi jantung segera</dd>
        </dl>
        <div className="flex flex-wrap gap-1.5">
          {["Cath Lab", "IGD dasar"].map((c) => (
            <span key={c} className="rounded-md border border-line-strong px-2 py-0.5 text-[11.5px] font-semibold text-ink">
              {c}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function DestinationPreview() {
  const rows = [
    { name: "RSCM", eta: "± 12 menit", km: "4,1 km", best: true },
    { name: "RSUP Persahabatan", eta: "± 19 menit", km: "7,3 km", best: false },
  ];
  return (
    <Frame>
      <ul className="flex flex-col gap-2 pt-3">
        {rows.map((r) => (
          <li key={r.name} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${r.best ? "border-ink" : "border-line"}`}>
            <MapPin className={`h-4 w-4 shrink-0 ${r.best ? "text-brand" : "text-faint"}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink">{r.name}</span>
              <span className="flex items-center gap-1 text-[11.5px] text-muted">
                <Clock className="h-3 w-3" />
                {r.eta} · {r.km}
              </span>
            </span>
            <span className="rounded-md border border-[#a9dcc3] bg-ok-tint px-1.5 py-0.5 text-[11px] font-bold text-ok-strong">Siap</span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-ink py-2 text-[12.5px] font-bold text-white">
        <Navigation className="h-3.5 w-3.5" />
        Mulai navigasi
      </p>
    </Frame>
  );
}
