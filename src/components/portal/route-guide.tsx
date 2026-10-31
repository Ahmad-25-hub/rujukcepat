"use client";

import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, MapPinned, Navigation, RotateCw, ExternalLink } from "lucide-react";
import { useState } from "react";
import { externalNavLinks, formatStepDistance, type RouteStep } from "@/lib/routing/steps";
import { formatEta, formatKm } from "@/lib/client/format";

export function StepIcon({ step }: { step: RouteStep }) {
  const t = step.instruction.toLowerCase();
  const cls = "h-5 w-5 shrink-0";
  if (step.kind === "arrive") return <Flag className={cls} aria-hidden />;
  if (step.kind === "roundabout") return <RotateCw className={cls} aria-hidden />;
  if (t.includes("kiri")) return <CornerUpLeft className={cls} aria-hidden />;
  if (t.includes("kanan")) return <CornerUpRight className={cls} aria-hidden />;
  if (step.kind === "depart") return <Navigation className={cls} aria-hidden />;
  return <ArrowUp className={cls} aria-hidden />;
}

export function RouteGuide({
  hospitalName,
  origin,
  dest,
  steps,
  source,
  durationS,
  distanceM,
  onFocusStep,
  onStartNavigation,
}: {
  hospitalName: string;
  origin: { lat: number; lng: number };
  dest: { lat: number; lng: number };
  steps: RouteStep[];
  source: "OSRM" | "MOCK";
  durationS: number;
  distanceM: number;
  onFocusStep?: (at: [number, number]) => void;
  onStartNavigation?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const links = externalNavLinks(origin, dest);

  return (
    <section aria-labelledby="route-guide-title" className="space-y-3 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="route-guide-title" className="flex items-center gap-2 text-base font-bold">
            <MapPinned className="h-5 w-5 text-accent" aria-hidden />
            Rute ke {hospitalName}
          </h3>
          <p className="text-sm text-ink-2">
            <strong>{formatEta(durationS)}</strong> · {formatKm(distanceM)}{" "}
            <span className="text-xs text-muted">
              {source === "MOCK" ? "(perkiraan dari jarak garis lurus)" : "(perkiraan rute OSRM tanpa lalu lintas langsung)"}
            </span>
          </p>
        </div>
      </div>

      {onStartNavigation && (
        <button
          type="button"
          onClick={onStartNavigation}
          className="btn btn-ok btn-lg w-full"
        >
          <Navigation className="h-5 w-5" aria-hidden />
          Mulai navigasi (GPS)
        </button>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Buka di Google Maps
        </a>
        <a
          href={links.waze}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Buka di Waze
        </a>
      </div>
      <p className="text-xs text-muted">
        Membuka aplikasi peta di perangkat Anda untuk navigasi suara. ETA di sana dapat berbeda karena memakai data lalu lintas penyedia tersebut.
      </p>

      {steps.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="route-steps"
            className="btn btn-secondary w-full text-left"
          >
            {open ? "Sembunyikan" : "Tampilkan"} petunjuk belok demi belok ({steps.length} langkah)
          </button>
          {open && (
            <ol id="route-steps" className="mt-2 divide-y divide-[#eef1f5] rounded-lg border border-line">
              {steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onFocusStep?.(s.at)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-soft"
                    aria-label={`Langkah ${i + 1}: ${s.instruction}${s.distance_m ? `, ${formatStepDistance(s.distance_m)}` : ""}. Tampilkan di peta`}
                  >
                    <span className="mt-0.5 text-accent">
                      <StepIcon step={s} />
                    </span>
                    <span className="flex-1 text-base">{s.instruction}</span>
                    {s.distance_m > 0 && <span className="whitespace-nowrap text-sm text-muted">{formatStepDistance(s.distance_m)}</span>}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {source === "MOCK"
            ? "Petunjuk belok tidak tersedia untuk garis lurus."
            : "Petunjuk belok demi belok tidak tersedia untuk rute ini; gunakan tombol aplikasi peta di atas."}
        </p>
      )}
    </section>
  );
}
