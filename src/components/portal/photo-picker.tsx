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
    <fieldset className="space-y-3 rounded-[20px] border-[1.5px] border-dashed border-[#c7ceda] bg-[#fafbfc] p-4">
      <legend className="flex items-center gap-2 px-1 text-[15px] font-extrabold">
        <Camera className="h-4 w-4 text-[#5b3aa6]" aria-hidden />
        Foto alat ukur <span className="font-semibold text-muted">· opsional</span>
      </legend>
      <p className="text-[13px] leading-normal text-muted">
        Misalnya layar alat ukur gula darah atau tensimeter. Angka hanya dipakai jika terbaca jelas. Laporan tetap dapat dikirim tanpa foto.
      </p>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label="Ambil foto dengan kamera" />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} aria-label="Pilih foto dari galeri" />
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="Pratinjau foto pendukung" className="h-24 w-24 rounded-xl border border-line object-cover" />
          <div className="flex-1 text-sm text-ink-2">Foto siap ({formatBytes(value.size)}, sudah dikompresi).</div>
          <button
            type="button"
            onClick={() => {
              URL.revokeObjectURL(value.url);
              onChange(null);
            }}
            className="btn btn-danger text-sm"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Hapus
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className="btn btn-secondary">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
            Ambil foto
          </button>
          <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()} className="btn btn-secondary">
            <ImagePlus className="h-5 w-5" aria-hidden />
            Pilih file
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="notice notice-error">
          {error} Laporan suara tetap dapat dilanjutkan.
        </p>
      )}
    </fieldset>
  );
}
