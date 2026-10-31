import { haversineKm } from "@/lib/geo";
import type { Need } from "@/lib/schema/ai";
import type { Facility, LatLng } from "@/lib/schema/api";
import type { CapabilityCode, CapabilityStatus } from "@/lib/schema/enums";

// Mesin pencocokan deterministik (SPEC §7). Murni, tanpa I/O.
//
// Kebijakan beberapa kebutuhan:
//  - Kebutuhan wajib (required=true): SEMUA harus READY, segar (tidak kedaluwarsa),
//    dan RS harus punya available_slots > 0. Jika satu saja gagal → RS dikecualikan.
//  - Kebutuhan opsional (required=false): tidak memengaruhi kelayakan, hanya pemecah seri.
//  - Tidak ada pelonggaran diam-diam bila kandidat kosong.
//  - Urutan akhir: ETA berkendara naik → jumlah opsional terpenuhi turun → slot tersedia turun.
//    Jika ETA tidak tersedia: urut jarak garis lurus, ETA tetap null dan diberi label.

export const MATCHING_POLICY =
  "RS layak jika semua kebutuhan wajib berstatus READY, statusnya masih baru, dan kuota > 0. Kebutuhan opsional hanya memengaruhi urutan.";

export type NeedCheck = {
  code: CapabilityCode;
  required: boolean;
  status: CapabilityStatus | "TIDAK_TERSEDIA" | "KEDALUWARSA";
  ok: boolean;
  updated_at: string | null;
};

export type Screened = {
  facility: Facility;
  eligible: boolean;
  reasons: string[];
  checks: NeedCheck[];
  optional_met: number;
  straight_km: number;
};

export type Candidate = {
  facility_id: string;
  name: string;
  short_name: string;
  lat: number;
  lng: number;
  available_slots: number;
  total_slots: number;
  capacity_updated_at: string;
  is_simulated: boolean;
  checks: NeedCheck[];
  optional_met: number;
  optional_missing: CapabilityCode[];
  straight_km: number;
  eta_seconds: number | null;
  distance_m: number | null;
  eta_source: "OSRM" | "MOCK" | null;
};

export type Excluded = { facility_id: string; short_name: string; reasons: string[] };

export type RoutingStatus = "OK" | "PARTIAL" | "FAILED" | "MOCK";

export type MatchResult = {
  primary: Candidate | null;
  alternatives: Candidate[];
  excluded: Excluded[];
  other_eligible_count: number;
  no_candidate_reason: string | null;
  routing_status: RoutingStatus;
  routing_note: string;
  policy: string;
  evaluated_at: string;
};

export function screenFacility(
  f: Facility,
  needs: Need[],
  origin: LatLng,
  now: Date,
  staleAfterMinutes: number,
): Screened {
  const staleBefore = now.getTime() - staleAfterMinutes * 60_000;
  const reasons: string[] = [];
  const checks: NeedCheck[] = needs.map((n) => {
    const cap = f.capabilities.find((c) => c.code === n.code);
    let status: NeedCheck["status"];
    if (!cap) status = "TIDAK_TERSEDIA";
    else if (new Date(cap.updated_at).getTime() < staleBefore) status = "KEDALUWARSA";
    else status = cap.status;
    const ok = status === "READY";
    if (n.required && !ok) {
      reasons.push(
        status === "TIDAK_TERSEDIA"
          ? `${n.code}: tidak tersedia`
          : status === "KEDALUWARSA"
            ? `${n.code}: status kedaluwarsa (tidak dianggap READY)`
            : `${n.code}: ${status}`,
      );
    }
    return { code: n.code, required: n.required, status, ok, updated_at: cap?.updated_at ?? null };
  });
  if (f.available_slots <= 0) reasons.push("Kuota rujukan 0");
  return {
    facility: f,
    eligible: reasons.length === 0,
    reasons,
    checks,
    optional_met: checks.filter((c) => !c.required && c.ok).length,
    straight_km: haversineKm(origin, f),
  };
}

/** Tahap 1: saring kelayakan, lalu pra-urut jarak garis lurus untuk memilih yang dirutekan. */
export function screenAll(
  facilities: Facility[],
  needs: Need[],
  origin: LatLng,
  now: Date,
  staleAfterMinutes: number,
  maxRouted: number,
) {
  const screened = facilities.map((f) => screenFacility(f, needs, origin, now, staleAfterMinutes));
  const eligible = screened.filter((s) => s.eligible).sort((a, b) => a.straight_km - b.straight_km);
  const excluded: Excluded[] = screened
    .filter((s) => !s.eligible)
    .map((s) => ({ facility_id: s.facility.id, short_name: s.facility.short_name, reasons: s.reasons }))
    .sort((a, b) => a.short_name.localeCompare(b.short_name));
  return { toRoute: eligible.slice(0, maxRouted), otherEligible: eligible.length - Math.min(eligible.length, maxRouted), excluded };
}

/** Tahap 2: gabungkan ETA dan urutkan. `etas` sejajar dengan `toRoute`; null = rute gagal. */
export function rankCandidates(
  toRoute: Screened[],
  etas: ({ duration_s: number; distance_m: number } | null)[] | null,
  etaSource: "OSRM" | "MOCK" | null,
): Candidate[] {
  const cands: Candidate[] = toRoute.map((s, i) => {
    const e = etas?.[i] ?? null;
    return {
      facility_id: s.facility.id,
      name: s.facility.name,
      short_name: s.facility.short_name,
      lat: s.facility.lat,
      lng: s.facility.lng,
      available_slots: s.facility.available_slots,
      total_slots: s.facility.total_slots,
      capacity_updated_at: s.facility.capacity_updated_at,
      is_simulated: s.facility.is_simulated,
      checks: s.checks,
      optional_met: s.optional_met,
      optional_missing: s.checks.filter((c) => !c.required && !c.ok).map((c) => c.code),
      straight_km: Math.round(s.straight_km * 10) / 10,
      eta_seconds: e ? e.duration_s : null,
      distance_m: e ? e.distance_m : null,
      eta_source: e ? etaSource : null,
    };
  });
  return cands.sort((a, b) => {
    if (a.eta_seconds !== null && b.eta_seconds !== null && a.eta_seconds !== b.eta_seconds) return a.eta_seconds - b.eta_seconds;
    if (a.eta_seconds !== null && b.eta_seconds === null) return -1;
    if (a.eta_seconds === null && b.eta_seconds !== null) return 1;
    if (a.eta_seconds === null && b.eta_seconds === null && a.straight_km !== b.straight_km) return a.straight_km - b.straight_km;
    if (a.optional_met !== b.optional_met) return b.optional_met - a.optional_met;
    if (a.available_slots !== b.available_slots) return b.available_slots - a.available_slots;
    return a.short_name.localeCompare(b.short_name);
  });
}

export function noCandidateReason(needs: Need[], excluded: Excluded[]): string {
  const req = needs.filter((n) => n.required).map((n) => n.code).join(", ");
  return `Tidak ada RS dalam daftar yang memenuhi semua kebutuhan wajib (${req}) dengan status READY terbaru dan kuota tersedia. ${excluded.length} RS dikecualikan; lihat alasan per RS.`;
}

export function routingNote(status: RoutingStatus): string {
  switch (status) {
    case "OK":
      return "ETA adalah perkiraan rute berkendara OSRM tanpa data lalu lintas langsung.";
    case "PARTIAL":
      return "Sebagian rute gagal dihitung; RS tanpa ETA diurutkan berdasarkan jarak garis lurus.";
    case "FAILED":
      return "ETA tidak tersedia – layanan rute gagal; urutan berdasarkan jarak garis lurus (bukan waktu tempuh).";
    case "MOCK":
      return "Perkiraan waktu dihitung dari jarak garis lurus × faktor jalan; petunjuk berkendara tidak tersedia.";
  }
}
