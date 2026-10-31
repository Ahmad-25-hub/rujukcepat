// Wilayah layanan RujukCepat. Dipakai server (validasi koordinat) dan UI (peta, label, filter).
// Kotak batas sengaja longgar (menyentuh sebagian kecil Jawa Tengah/Bali) agar validasi sederhana;
// pencocokan tetap dibatasi radius dari lokasi pasien (lihat MATCH_MAX_KM).

export type RegionId = "JAKARTA" | "JAWA_TIMUR";
type Box = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type Pt = { lat: number; lng: number };

export const SERVICE_REGIONS: {
  id: RegionId;
  label: string;
  boxes: Box[];
  /** Tampilan awal peta pemilih lokasi: [[selatan, barat], [utara, timur]]. */
  view: [[number, number], [number, number]];
  viewLabel: string;
  sample: Pt & { label: string };
}[] = [
  {
    id: "JAKARTA",
    label: "DKI Jakarta",
    boxes: [{ minLat: -6.8, maxLat: -5.9, minLng: 106.3, maxLng: 107.3 }],
    view: [
      [-6.37, 106.68],
      [-6.08, 107.0],
    ],
    viewLabel: "Jakarta",
    sample: { label: "Senen, Jakarta Pusat", lat: -6.1767, lng: 106.8416 },
  },
  {
    id: "JAWA_TIMUR",
    label: "Jawa Timur",
    boxes: [
      // Daratan + Madura.
      { minLat: -8.9, maxLat: -6.6, minLng: 110.85, maxLng: 114.62 },
      // Pulau timur laut (Bawean, Sapudi, Kangean).
      { minLat: -7.2, maxLat: -5.7, minLng: 112.5, maxLng: 116.3 },
    ],
    view: [
      [-7.45, 112.6],
      [-7.18, 112.85],
    ],
    viewLabel: "Surabaya",
    // Kampus UPN "Veteran" Jawa Timur, Gunung Anyar (OSM way/468626943).
    sample: { label: "Kampus UPN Veteran Jatim, Surabaya", lat: -7.3338, lng: 112.7889 },
  },
];

export const SERVICE_AREA_LABEL = "DKI Jakarta dan Jawa Timur";

const inBox = (p: Pt, b: Box) => p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng;

export function regionOf(p: Pt): RegionId | null {
  return SERVICE_REGIONS.find((r) => r.boxes.some((b) => inBox(p, b)))?.id ?? null;
}

export function inServiceArea(p: Pt): boolean {
  return regionOf(p) !== null;
}

export function regionLabel(id: RegionId | null): string {
  return SERVICE_REGIONS.find((r) => r.id === id)?.label ?? "Di luar wilayah layanan";
}
