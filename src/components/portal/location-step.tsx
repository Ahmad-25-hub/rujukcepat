"use client";

import { Check, Crosshair, Loader2, MapPin, MousePointerClick } from "lucide-react";
import { useState } from "react";
import MapView from "@/components/map-dynamic";
import { SERVICE_BOUNDS } from "@/lib/schema/api";

export type ReporterLocation = { lat: number; lng: number; source: "GPS" | "MANUAL"; accuracy_m: number | null };

function inBounds(p: { lat: number; lng: number }) {
  return p.lat >= SERVICE_BOUNDS.minLat && p.lat <= SERVICE_BOUNDS.maxLat && p.lng >= SERVICE_BOUNDS.minLng && p.lng <= SERVICE_BOUNDS.maxLng;
}

const GEO_ERRORS: Record<number, string> = {
  1: "Izin lokasi ditolak. Anda dapat membuka pengaturan izin situs di browser (ikon gembok di bilah alamat) lalu mencoba lagi, atau pilih titik secara manual di peta.",
  2: "Lokasi tidak dapat ditentukan oleh perangkat. Pilih titik secara manual di peta.",
  3: "Pencarian lokasi terlalu lama. Coba lagi atau pilih titik secara manual di peta.",
};

export function LocationStep({ value, onChange }: { value: ReporterLocation | null; onChange: (l: ReporterLocation | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(value?.source === "MANUAL");

  function useGps() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Browser ini tidak mendukung lokasi otomatis. Pilih titik secara manual di peta.");
      setManual(true);
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inBounds(p)) {
          setError("Lokasi GPS Anda berada di luar wilayah demo (Jabodetabek). Pilih titik manual di peta Jakarta.");
          setManual(true);
          return;
        }
        onChange({ ...p, source: "GPS", accuracy_m: Math.round(pos.coords.accuracy) });
      },
      (err) => {
        setBusy(false);
        setError(GEO_ERRORS[err.code] ?? "Lokasi gagal diperoleh. Pilih titik secara manual di peta.");
        setManual(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function pick(p: { lat: number; lng: number }) {
    if (!inBounds(p)) {
      setError("Titik di luar wilayah demo (Jabodetabek).");
      return;
    }
    setError(null);
    onChange({ ...p, source: "MANUAL", accuracy_m: null });
  }

  return (
    <section aria-labelledby="loc-title" className="anim-rise anim-d2 card overflow-hidden">
      <div className="flex items-center gap-3 px-[18px] pb-3.5 pt-[18px]">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${value ? "bg-ok-tint text-ok" : "bg-[#eef1f5] text-ink-2"}`}>
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="loc-title" className="text-lg font-extrabold">
            Lokasi pasien
          </h2>
          {value ? (
            <p role="status" className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-ok">
              <Check className="h-4 w-4" aria-hidden />
              {value.source === "GPS" ? `Terdeteksi dari GPS · ± ${value.accuracy_m} m` : "Dipilih manual di peta"}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted">Dipakai untuk memperkirakan rute; koordinat dibulatkan sebelum disimpan.</p>
          )}
        </div>
      </div>

      {(manual || value) && (
        <div className="space-y-2 px-[18px]">
          <MapView origin={value} onPick={manual ? pick : undefined} className="h-60 sm:h-72" />
          {manual && (
            <p className="text-[13px] leading-normal text-muted">
              Ketuk peta untuk menandai lokasi pasien. Lokasi manual mungkin kurang tepat sehingga ETA juga perkiraan.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5 px-[18px] pb-[18px] pt-3.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={useGps} disabled={busy} className={`btn flex-[1_1_150px] ${value ? "btn-secondary" : "btn-primary"}`}>
            {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden /> : <Crosshair className="h-[18px] w-[18px]" aria-hidden />}
            {busy ? "Mencari lokasi…" : value?.source === "GPS" ? "Perbarui GPS" : "Gunakan lokasi saya"}
          </button>
          <button type="button" onClick={() => setManual(true)} aria-pressed={manual} className="btn btn-secondary flex-[1_1_150px]">
            <MousePointerClick className="h-[18px] w-[18px]" aria-hidden />
            Pilih di peta
          </button>
        </div>
        {manual && (
          <button type="button" className="btn btn-ghost self-start px-2 text-sm font-semibold text-accent underline" onClick={() => pick({ lat: -6.1767, lng: 106.8416 })}>
            Gunakan titik contoh demo (Senen, Jakarta Pusat)
          </button>
        )}
        {error && (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        )}
        {value && (
          <p className="font-mono text-xs text-muted">
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </p>
        )}
      </div>
    </section>
  );
}
