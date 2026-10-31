"use client";

import { Crosshair, Loader2, MapPin, MousePointerClick } from "lucide-react";
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

export function LocationStep({
  value,
  onChange,
  onNext,
}: {
  value: ReporterLocation | null;
  onChange: (l: ReporterLocation | null) => void;
  onNext: () => void;
}) {
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
    <section aria-labelledby="loc-title" className="space-y-4">
      <h2 id="loc-title" className="flex items-center gap-2 text-xl font-bold">
        <MapPin className="h-6 w-6 text-blue-700" aria-hidden />
        Lokasi pasien
      </h2>
      <p className="text-base text-slate-700">Lokasi dipakai untuk memperkirakan rute ke rumah sakit. Koordinat dibulatkan sebelum disimpan.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={useGps}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-4 text-lg font-bold text-white disabled:bg-slate-400"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Crosshair className="h-5 w-5" aria-hidden />}
          {busy ? "Mencari lokasi…" : "Gunakan lokasi saya"}
        </button>
        <button
          type="button"
          onClick={() => setManual(true)}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-blue-700 bg-white px-4 py-4 text-lg font-bold text-blue-800"
        >
          <MousePointerClick className="h-5 w-5" aria-hidden />
          Pilih di peta
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-base text-red-900">
          {error}
        </p>
      )}
      {(manual || value) && (
        <div className="space-y-2">
          {manual && (
            <p className="text-sm text-slate-700">
              Ketuk/klik peta untuk menandai lokasi pasien. Lokasi manual mungkin kurang tepat sehingga ETA juga perkiraan.
            </p>
          )}
          <MapView origin={value} onPick={manual ? pick : undefined} className="h-72" />
          {manual && (
            <button
              type="button"
              className="text-sm font-semibold text-blue-800 underline"
              onClick={() => pick({ lat: -6.1767, lng: 106.8416 })}
            >
              Gunakan titik contoh demo (Senen, Jakarta Pusat)
            </button>
          )}
        </div>
      )}
      {value && (
        <p className="rounded-lg bg-green-50 p-3 text-base text-green-900" role="status">
          Lokasi {value.source === "GPS" ? `GPS (akurasi ± ${value.accuracy_m} m)` : "manual"}: {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
        </p>
      )}
      <button
        type="button"
        disabled={!value}
        onClick={onNext}
        className="w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        Lanjut ke laporan suara
      </button>
    </section>
  );
}
