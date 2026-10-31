import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RujukCepat – koordinasi rujukan (demo)",
    short_name: "RujukCepat",
    description: "Demo koordinasi rujukan prarumah sakit DKI Jakarta. Data kapasitas dan kesiapan adalah simulasi.",
    lang: "id",
    start_url: "/lapor",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f9",
    theme_color: "#0b1324",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Laporkan kondisi pasien", url: "/lapor" },
      { name: "Dashboard IGD (petugas)", url: "/dashboard" },
    ],
  };
}
