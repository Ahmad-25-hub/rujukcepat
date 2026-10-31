"use client";

import dynamic from "next/dynamic";

// Leaflet memerlukan window; muat hanya di klien.
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-sm text-slate-600">
      Memuat peta…
    </div>
  ),
});

export default MapView;
export type { MapMarker } from "./map-view";
