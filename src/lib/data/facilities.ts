import "server-only";
import { FacilitySchema, type Facility } from "@/lib/schema/api";
import { getDb } from "./db";

// Adapter pembacaan status fasilitas publik (view facility_public_status).

type Row = Record<string, unknown>;

function iso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

export function rowToFacility(r: Row): Facility {
  const caps = (typeof r.capabilities === "string" ? JSON.parse(r.capabilities) : r.capabilities) as Row[];
  return FacilitySchema.parse({
    id: String(r.id),
    name: r.name,
    short_name: r.short_name,
    lat: Number(r.lat),
    lng: Number(r.lng),
    address: r.address ?? null,
    osm_id: r.osm_id ?? null,
    location_source: r.location_source,
    location_fetched_at: iso(r.location_fetched_at),
    total_slots: Number(r.total_slots),
    available_slots: Number(r.available_slots),
    capacity_updated_at: iso(r.capacity_updated_at),
    is_simulated: Boolean(r.is_simulated),
    capabilities: (caps ?? []).map((c) => ({ ...c, updated_at: iso(c.updated_at) })),
  });
}

export async function listFacilities(): Promise<Facility[]> {
  const db = await getDb();
  const { rows } = await db.query<Row>("select * from facility_public_status order by short_name");
  return rows.map(rowToFacility);
}
