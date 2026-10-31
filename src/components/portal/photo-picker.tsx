"use client";

import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { compressImage, isAcceptedImage } from "@/lib/client/image";
import { formatBytes } from "@/lib/client/format";

export type PhotoDraft = { blob: Blob; url: string; size: number };

export function PhotoPicker({ value, onChange }: { value: PhotoDraft | null; onChange: (p: PhotoDraft | null) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!isAcceptedImage(file)) {
      setError("Jenis file tidak didukung. Pilih foto JPEG, PNG, atau WebP.");
      return;
    }
    setBusy(true);
    try {
      const blob = await compressImage(file);
      if (value) URL.revokeObjectURL(value.url);
      onChange({ blob, url: URL.createObjectURL(blob), size: blob.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foto gagal diproses.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <fieldset className="space-y-3 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
      <legend className="px-1 text-base font-bold">Foto pendukung (opsional)</legend>
      <p className="text-sm text-slate-700">
        Misalnya layar alat ukur gula darah atau tensimeter. Angka hanya dipakai jika terbaca jelas. Laporan tetap dapat dikirim tanpa foto.
      </p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label="Ambil foto dengan kamera" />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label="Pilih foto dari galeri" />
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="Pratinjau foto pendukung" className="h-24 w-24 rounded-lg border object-cover" />
          <div className="flex-1 text-sm text-slate-700">Foto siap ({formatBytes(value.size)}, sudah dikompresi).</div>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(value.url);
              onChange(null);
            }}
            className="flex items-center gap-1 rounded-lg border-2 border-red-300 px-3 py-2 text-sm font-semibold text-red-800"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Hapus
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border-2 border-slate-400 px-3 py-3 font-semibold">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
            Ambil foto
          </button>
          <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border-2 border-slate-400 px-3 py-3 font-semibold">
            <ImagePlus className="h-5 w-5" aria-hidden />
            Pilih file
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-800">
          {error} Laporan suara tetap dapat dilanjutkan.
        </p>
      )}
    </fieldset>
  );
}
