"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "primary" | "alternative" | "excluded" | "selected" | "facility";
};

const KIND_STYLE: Record<MapMarker["kind"], { color: string; fill: string; radius: number }> = {
  selected: { color: "#0b1324", fill: "#c4122f", radius: 13 },
  primary: { color: "#ffffff", fill: "#c4122f", radius: 10 },
  alternative: { color: "#0b1324", fill: "#ffffff", radius: 9 },
  excluded: { color: "#9aa5b8", fill: "#e3e7ee", radius: 6 },
  facility: { color: "#ffffff", fill: "#c4122f", radius: 7 },
};

export const JAKARTA_CENTER = { lat: -6.2088, lng: 106.8456 };

function ClickPicker({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(points as LatLngBoundsExpression, { padding: [30, 30], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export type LivePosition = { lat: number; lng: number; accuracy: number | null };

// Mengikuti posisi langsung; berhenti mengikuti bila pengguna menggeser peta sendiri.
function Follower({ live, follow, onUserPan }: { live: LivePosition | null; follow: boolean; onUserPan?: () => void }) {
  const map = useMap();
  useMapEvents({ dragstart: () => onUserPan?.() });
  const lat = live?.lat;
  const lng = live?.lng;
  useEffect(() => {
    if (!follow || lat == null || lng == null) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [follow, lat, lng, map]);
  return null;
}

export default function MapView({
  origin,
  markers = [],
  route,
  onPick,
  onMarkerClick,
  fitTo,
  live,
  follow = false,
  onUserPan,
  originLabel = "Lokasi pelapor",
  className = "h-72",
}: {
  origin?: { lat: number; lng: number } | null;
  markers?: MapMarker[];
  route?: [number, number][] | null;
  onPick?: (p: { lat: number; lng: number }) => void;
  onMarkerClick?: (id: string) => void;
  fitTo?: [number, number][];
  /** Posisi GPS langsung (navigasi). */
  live?: LivePosition | null;
  follow?: boolean;
  onUserPan?: () => void;
  originLabel?: string;
  className?: string;
}) {
  const center = origin ?? JAKARTA_CENTER;
  return (
    <div className={`relative w-full overflow-hidden rounded-[22px] border border-line ${className}`}>
      <MapContainer center={[center.lat, center.lng]} zoom={12} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {onPick && <ClickPicker onPick={onPick} />}
        {fitTo && <FitBounds points={fitTo} />}
        {live !== undefined && <Follower live={live} follow={follow} onUserPan={onUserPan} />}
        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#1d4ed8", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }} />}
        {markers.map((m) => {
          const s = KIND_STYLE[m.kind];
          return (
            <CircleMarker
              key={`${m.id}-${m.kind}`}
              center={[m.lat, m.lng]}
              radius={s.radius}
              pathOptions={{ color: s.color, fillColor: s.fill, fillOpacity: 1, weight: 3 }}
              eventHandlers={onMarkerClick ? { click: () => onMarkerClick(m.id) } : undefined}
            >
              <Tooltip direction="top">{m.label}</Tooltip>
            </CircleMarker>
          );
        })}
        {origin && (
          <CircleMarker
            center={[origin.lat, origin.lng]}
            radius={9}
            pathOptions={{ color: "#ffffff", fillColor: "#1d4ed8", fillOpacity: 1, weight: 4 }}
          >
            <Tooltip direction="top" permanent>
              {originLabel}
            </Tooltip>
          </CircleMarker>
        )}
        {live && live.accuracy != null && live.accuracy > 15 && (
          <Circle center={[live.lat, live.lng]} radius={live.accuracy} pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#3b82f6", fillOpacity: 0.12 }} />
        )}
        {live && (
          <CircleMarker center={[live.lat, live.lng]} radius={10} pathOptions={{ color: "#fff", weight: 4, fillColor: "#2563eb", fillOpacity: 1 }}>
            <Tooltip direction="top">Posisi Anda</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
