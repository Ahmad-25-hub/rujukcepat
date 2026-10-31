// Ambil titik rumah sakit DKI Jakarta dan Jawa Timur dari Overpass API sekali, lalu simpan
// sebagai snapshot (data/osm/hospitals-<wilayah>.json). Dijalankan manual (`npm run fetch:hospitals`),
// bukan saat render. Setelahnya jalankan `npm run build:hospitals` untuk menyusun seed.
// Data © OpenStreetMap contributors, ODbL. Lokasi/tag OSM tidak membuktikan kapabilitas atau ketersediaan.
import { mkdirSync, writeFileSync } from "node:fs";

const AREAS = [
  { key: "jakarta", area: "Daerah Khusus Ibukota Jakarta" },
  { key: "jatim", area: "Jawa Timur" },
];

// Hanya tag yang dipakai seleksi/seed; menjaga snapshot tetap kecil.
const KEEP = [
  "name", "official_name", "short_name", "alt_name", "amenity", "healthcare", "healthcare:speciality", "emergency",
  "addr:full", "addr:street", "addr:housenumber", "addr:subdistrict", "addr:district", "addr:city", "addr:province", "addr:postcode",
  "phone", "contact:phone", "website", "contact:website", "email", "contact:email",
  "operator", "operator:type", "opening_hours", "beds", "rooms",
];

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
};

async function fetchArea(area: string) {
  const query = `[out:json][timeout:120];
area["name"="${area}"]["admin_level"="4"]->.a;
nwr["amenity"="hospital"]["name"](area.a);
out center tags;`;
  // Overpass publik sering 429/502/504 saat sibuk: coba ulang dengan jeda bertambah.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": "RujukCepat-hackathon-seed/0.2 (demo, sekali ambil)",
      },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) {
      const json = (await res.json()) as { osm3s?: { timestamp_osm_base?: string }; elements: OsmElement[] };
      return { query, json };
    }
    if (attempt >= 4 || ![429, 502, 503, 504].includes(res.status)) throw new Error(`Overpass HTTP ${res.status} (${area})`);
    console.warn(`Overpass HTTP ${res.status} (${area}); coba lagi ${attempt}/3…`);
    await new Promise((r) => setTimeout(r, attempt * 15_000));
  }
}

async function main() {
  mkdirSync("data/osm", { recursive: true });
  for (const { key, area } of AREAS) {
    const { query, json } = await fetchArea(area);
    const elements = json.elements
      .map((e) => ({
        osm_id: `${e.type}/${e.id}`,
        lat: e.lat ?? e.center?.lat,
        lng: e.lon ?? e.center?.lon,
        tags: Object.fromEntries(Object.entries(e.tags).filter(([k]) => KEEP.includes(k))),
      }))
      .filter((h) => typeof h.lat === "number" && typeof h.lng === "number")
      .sort((a, b) => a.osm_id.localeCompare(b.osm_id));
    const file = `data/osm/hospitals-${key}.json`;
    writeFileSync(
      file,
      JSON.stringify(
        {
          source: "OpenStreetMap via Overpass API",
          attribution: "© OpenStreetMap contributors (ODbL)",
          area,
          query,
          fetched_at: new Date().toISOString(),
          osm_base_timestamp: json.osm3s?.timestamp_osm_base ?? null,
          note: "Tag OSM apa adanya. Tidak menyiratkan kemitraan, kapabilitas, atau ketersediaan layanan.",
          count: elements.length,
          elements,
        },
        null,
        1,
      ) + "\n",
    );
    console.log(`${area}: ${elements.length} elemen amenity=hospital -> ${file}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
