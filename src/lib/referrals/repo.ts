import "server-only";
import { config } from "@/lib/config";
import { getDb, resetDemoDataOn } from "@/lib/data/db";
import { etaTable } from "@/lib/routing";
import { notifyChange } from "@/lib/sync/bus";
import type { FacilityPatch, CreateReferralInput, DecisionAction, ReferralView } from "@/lib/schema/referral";
import { ReferralViewSchema } from "@/lib/schema/referral";

// Akses data rujukan. Seluruh logika atomik (kuota, idempotency, transisi) ada di fungsi SQL
// create_referral / transition_referral / update_facility; modul ini hanya memanggil dan memetakan galat.

export class RepoError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const DB_ERRORS: Record<string, { status: number; message: string }> = {
  NO_CAPACITY: { status: 409, message: "Kuota rujukan rumah sakit ini sudah habis. Pilih rumah sakit lain." },
  CAPABILITY_CHANGED: { status: 409, message: "Kesiapan layanan rumah sakit ini baru saja berubah. Perbarui daftar tujuan lalu pilih ulang." },
  HOSPITAL_NOT_FOUND: { status: 404, message: "Rumah sakit tidak ditemukan." },
  REFERRAL_NOT_FOUND: { status: 404, message: "Rujukan tidak ditemukan." },
  INVALID_TRANSITION: { status: 409, message: "Perubahan status ini tidak sah untuk kondisi rujukan saat ini (mungkin sudah diproses atau kedaluwarsa)." },
  CAPABILITY_NOT_OFFERED: { status: 400, message: "Rumah sakit ini tidak menawarkan layanan tersebut pada data simulasi." },
  INVALID_CAPACITY: { status: 400, message: "Kapasitas tidak valid: tidak boleh negatif dan tersedia tidak boleh melebihi total." },
};

export function mapDbError(e: unknown): RepoError {
  if (e instanceof RepoError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  for (const [code, info] of Object.entries(DB_ERRORS)) {
    if (msg.includes(code)) return new RepoError(code, info.message, info.status);
  }
  // Hanya kode galat (tanpa pesan) agar payload kesehatan tidak masuk log.
  console.error("[repo] galat database", (e as { code?: string }).code ?? "unknown");
  return new RepoError("DB_ERROR", "Terjadi kesalahan pada database. Silakan coba lagi.", 500);
}

function iso(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Row = Record<string, unknown>;

const SELECT_VIEW = `
  select r.id, r.status, r.requester_id, r.hospital_id, h.short_name as hospital_short_name, h.name as hospital_name,
         r.urgency, r.needs::text[] as needs, r.required_needs::text[] as required_needs,
         r.eta_seconds, r.eta_source, r.origin_lat, r.origin_lng,
         r.created_at, r.updated_at, r.expires_at, r.decided_at, r.decision_note, r.arrived_at, r.ai_result,
         q.status as reservation_status, q.release_reason
    from referral_requests r
    join hospitals h on h.id = r.hospital_id
    left join quota_reservations q on q.referral_id = r.id`;

export type ReferralRecord = ReferralView & { requester_id: string };

function toRecord(r: Row, events?: Row[]): ReferralRecord {
  const aiRaw = r.ai_result;
  const view = ReferralViewSchema.parse({
    id: String(r.id),
    status: r.status,
    reservation_status: r.reservation_status ?? null,
    release_reason: r.release_reason ?? null,
    hospital: { id: String(r.hospital_id), name: r.hospital_name, short_name: r.hospital_short_name },
    urgency: r.urgency ?? null,
    needs: r.needs,
    required_needs: r.required_needs,
    eta_seconds: r.eta_seconds ?? null,
    eta_source: r.eta_source ?? null,
    origin: { lat: Number(r.origin_lat), lng: Number(r.origin_lng) },
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    expires_at: iso(r.expires_at),
    decided_at: iso(r.decided_at),
    decision_note: r.decision_note ?? null,
    arrived_at: iso(r.arrived_at),
    ai_result: typeof aiRaw === "string" ? JSON.parse(aiRaw) : aiRaw,
    events: events?.map((e) => ({ type: String(e.type), at: iso(e.at) ?? "" })),
  });
  return { ...view, requester_id: String(r.requester_id) };
}

/** Kedaluwarsakan rujukan PENDING yang lewat batas (lazy expiry) dan umumkan perubahannya. */
export async function expireStale(): Promise<number> {
  const db = await getDb();
  const due = await db.query<{ id: string; hospital_id: string; requester_id: string }>(
    "select id, hospital_id, requester_id from referral_requests where status = 'PENDING' and expires_at <= now()",
  );
  if (!due.rows.length) return 0;
  await db.query("select expire_stale_referrals(null)");
  for (const r of due.rows) {
    notifyChange({ type: "referral", hospital_id: String(r.hospital_id), referral_id: String(r.id), requester_id: String(r.requester_id) });
  }
  return due.rows.length;
}

export async function getReferral(id: string): Promise<ReferralRecord | null> {
  await expireStale();
  const db = await getDb();
  const { rows } = await db.query<Row>(`${SELECT_VIEW} where r.id = $1`, [id]);
  if (!rows[0]) return null;
  const ev = await db.query<Row>("select type, at from referral_events where referral_id = $1 order by id", [id]);
  return toRecord(rows[0], ev.rows);
}

const URGENCY_RANK = "case r.urgency when 'MERAH' then 0 when 'KUNING' then 1 when 'HIJAU' then 2 else 3 end";

/** Antrean petugas: PENDING dulu (urgensi, lalu waktu), lalu yang sudah diproses terbaru. */
export async function listHospitalReferrals(hospitalId: string): Promise<ReferralRecord[]> {
  await expireStale();
  const db = await getDb();
  const { rows } = await db.query<Row>(
    `${SELECT_VIEW} where r.hospital_id = $1
      order by (r.status = 'PENDING') desc, case when r.status = 'PENDING' then ${URGENCY_RANK} end, r.created_at desc
      limit 100`,
    [hospitalId],
  );
  return rows.map((r) => toRecord(r));
}

export async function createReferral(
  requesterId: string,
  idempotencyKey: string,
  input: CreateReferralInput,
): Promise<{ referral: ReferralRecord; created: boolean }> {
  const db = await getDb();

  // ETA dihitung ulang di server (bukan dipercaya dari klien). Gagal -> null, tanpa ETA palsu.
  let eta: number | null = null;
  let etaSource: "OSRM" | "MOCK" | null = null;
  const fac = await db.query<{ lat: number; lng: number }>("select lat, lng from hospitals where id = $1", [input.hospital_id]);
  if (!fac.rows[0]) throw new RepoError("HOSPITAL_NOT_FOUND", DB_ERRORS.HOSPITAL_NOT_FOUND.message, 404);
  try {
    const t = await etaTable(input.location, [{ lat: Number(fac.rows[0].lat), lng: Number(fac.rows[0].lng) }]);
    const e = t.entries[0];
    if (e) {
      eta = e.duration_s;
      etaSource = t.source;
    }
  } catch {
    // ETA tidak tersedia; rujukan tetap dapat dikirim.
  }

  const needs = [...new Set(input.needs.map((n) => n.code))];
  const required = [...new Set(input.needs.filter((n) => n.required).map((n) => n.code))];
  if (required.length === 0) throw new RepoError("NO_REQUIRED_NEED", "Minimal satu kebutuhan wajib diperlukan.", 400);

  let res: { referral_id: string; created: boolean };
  try {
    const { rows } = await db.query<{ r: { referral_id: string; created: boolean } | string }>(
      "select create_referral($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as r",
      [
        requesterId,
        idempotencyKey,
        input.hospital_id,
        JSON.stringify(input.ai_result),
        input.ai_result.urgency.level,
        `{${needs.join(",")}}`,
        `{${required.join(",")}}`,
        eta,
        etaSource,
        input.location.lat,
        input.location.lng,
        config.referralTtlSeconds,
        config.staleAfterMinutes,
      ],
    );
    const r = rows[0].r;
    res = typeof r === "string" ? JSON.parse(r) : r;
  } catch (e) {
    throw mapDbError(e);
  }

  const referral = await getReferral(res.referral_id);
  if (!referral) throw new RepoError("DB_ERROR", "Rujukan tersimpan tetapi tidak dapat dibaca.", 500);
  if (res.created) {
    notifyChange({ type: "referral", hospital_id: referral.hospital.id, referral_id: referral.id, requester_id: requesterId });
    notifyChange({ type: "facility", hospital_id: referral.hospital.id });
  }
  return { referral, created: res.created };
}

/** Transisi status. `actor` = id petugas/pelapor. Kepemilikan/RS diperiksa pemanggil. */
export async function applyTransition(
  id: string,
  action: DecisionAction | "CANCEL",
  actor: string,
  note?: string,
): Promise<ReferralRecord> {
  const db = await getDb();
  try {
    await db.query("select transition_referral($1,$2,$3,$4)", [id, action, actor, note ?? null]);
  } catch (e) {
    throw mapDbError(e);
  }
  const referral = await getReferral(id);
  if (!referral) throw new RepoError("REFERRAL_NOT_FOUND", DB_ERRORS.REFERRAL_NOT_FOUND.message, 404);
  notifyChange({ type: "referral", hospital_id: referral.hospital.id, referral_id: id, requester_id: referral.requester_id });
  // Kuota dapat berubah (dilepas/terpakai): umumkan juga perubahan fasilitas.
  notifyChange({ type: "facility", hospital_id: referral.hospital.id });
  return referral;
}

export async function updateFacility(hospitalId: string, actor: string, patch: FacilityPatch): Promise<void> {
  const db = await getDb();
  try {
    await db.query("select update_facility($1,$2,$3,$4,$5)", [
      hospitalId,
      actor,
      patch.capabilities ? JSON.stringify(patch.capabilities) : null,
      patch.total_slots ?? null,
      patch.available_slots ?? null,
    ]);
  } catch (e) {
    throw mapDbError(e);
  }
  notifyChange({ type: "facility", hospital_id: hospitalId });
}

/** Hapus seluruh data rujukan demo dan kembalikan seed simulasi. */
export async function resetDemo(): Promise<void> {
  const db = await getDb();
  try {
    await resetDemoDataOn(db);
  } catch (e) {
    throw mapDbError(e);
  }
  const { rows } = await db.query<{ id: string }>("select id from hospitals");
  for (const h of rows) {
    notifyChange({ type: "facility", hospital_id: String(h.id) });
    notifyChange({ type: "referral", hospital_id: String(h.id) });
  }
}
