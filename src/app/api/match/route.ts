import { config } from "@/lib/config";
import { listFacilities } from "@/lib/data/facilities";
import { fail, ok } from "@/lib/http";
import {
  MATCHING_POLICY,
  noCandidateReason,
  rankCandidates,
  routingNote,
  screenAll,
  type MatchResult,
  type RoutingStatus,
} from "@/lib/matching/match";
import { etaTable } from "@/lib/routing";
import { MatchRequestSchema } from "@/lib/schema/api";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = MatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Permintaan tidak valid.";
    return fail("BAD_REQUEST", msg);
  }
  const { needs, location } = parsed.data;

  let facilities;
  try {
    facilities = await listFacilities();
  } catch (e) {
    console.error("[match] data fasilitas gagal", (e as { code?: string }).code ?? (e instanceof Error ? e.name : "unknown"));
    return fail("FACILITY_DATA_UNAVAILABLE", "Data fasilitas tidak dapat dimuat. Silakan coba lagi.", 503);
  }

  const now = new Date();
  const { toRoute, otherEligible, excluded, inRange, outOfRange } = screenAll(
    facilities,
    needs,
    location,
    now,
    config.staleAfterMinutes,
    config.matchMaxRouted,
    config.matchMaxKm,
  );

  let routingStatus: RoutingStatus = config.routingMode === "mock" ? "MOCK" : "OK";
  let etas = null;
  let source: "OSRM" | "MOCK" | null = null;
  if (toRoute.length) {
    try {
      const t = await etaTable(location, toRoute.map((s) => s.facility));
      etas = t.entries;
      source = t.source;
      if (t.source === "OSRM" && t.entries.some((e) => e === null)) routingStatus = "PARTIAL";
      if (t.entries.every((e) => e === null)) routingStatus = "FAILED";
    } catch (e) {
      console.warn("[match] rute gagal", e instanceof Error ? e.message : "unknown");
      routingStatus = "FAILED";
    }
  }

  const ranked = rankCandidates(toRoute, etas, source);
  const result: MatchResult = {
    primary: ranked[0] ?? null,
    alternatives: ranked.slice(1, 4),
    excluded,
    other_eligible_count: otherEligible + Math.max(0, ranked.length - 4),
    out_of_range_count: outOfRange,
    max_radius_km: config.matchMaxKm,
    no_candidate_reason: ranked.length ? null : noCandidateReason(needs, excluded, inRange, config.matchMaxKm),
    routing_status: routingStatus,
    routing_note: routingNote(routingStatus),
    policy: MATCHING_POLICY,
    evaluated_at: now.toISOString(),
  };
  return ok(result);
}
