// Ambil titik rumah sakit DKI Jakarta dari Overpass API sekali, lalu simpan
// sebagai snapshot. Dijalankan manual (`npm run fetch:hospitals`), bukan saat render.
// Data lokasi © OpenStreetMap contributors, ODbL. Lokasi tidak membuktikan kapabilitas.
import { writeFileSync, mkdirSync } from "node:fs";

const QUERY = `[out:json][timeout:60];
area["name"="Daerah Khusus Ibukota Jakarta"]["admin_level"="4"]->.a;
nwr["amenity"="hospital"]["name"](area.a);
out center tags;`;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
};

async function main() {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "RujukCepat-hackathon-seed/0.1 (demo, sekali ambil)",
    },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = (await res.json()) as { osm3s?: { timestamp_osm_base?: string }; elements: OsmElement[] };
  const hospitals = json.elements
    .map((e) => ({
      osm_id: `${e.type}/${e.id}`,
      name: e.tags.name,
      lat: e.lat ?? e.center?.lat,
      lng: e.lon ?? e.center?.lon,
      address: [e.tags["addr:street"], e.tags["addr:city"]].filter(Boolean).join(", ") || null,
      emergency: e.tags.emergency ?? null,
    }))
    .filter((h) => typeof h.lat === "number" && typeof h.lng === "number");

  mkdirSync("data", { recursive: true });
  writeFileSync(
    "data/hospitals.osm.json",
    JSON.stringify(
      {
        source: "OpenStreetMap via Overpass API",
        attribution: "© OpenStreetMap contributors (ODbL)",
        query: QUERY,
        fetched_at: new Date().toISOString(),
        osm_base_timestamp: json.osm3s?.timestamp_osm_base ?? null,
        note: "Hanya lokasi. Tidak menyiratkan kemitraan, kapabilitas, atau ketersediaan layanan.",
        count: hospitals.length,
        hospitals,
      },
      null,
      1,
    ) + "\n",
  );
  console.log(`Tersimpan ${hospitals.length} titik RS ke data/hospitals.osm.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
