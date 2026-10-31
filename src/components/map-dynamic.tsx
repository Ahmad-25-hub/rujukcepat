"use client";

import dynamic from "next/dynamic";

// Leaflet memerlukan window; muat hanya di klien.
const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center skeleton !rounded-[22px] border border-line text-sm text-muted">
      Memuat peta…
    </div>
  ),
});

export default MapView;
export type { MapMarker, LivePosition } from "./map-view";
