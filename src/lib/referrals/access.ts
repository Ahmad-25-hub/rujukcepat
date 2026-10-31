import "server-only";
import { existingReporterId } from "@/lib/auth/session";
import { currentStaff, type Staff } from "@/lib/auth/staff";
import { fail, isUuid } from "@/lib/http";
import { getReferral, mapDbError, type ReferralRecord } from "./repo";

export type Access = { referral: ReferralRecord; staff: Staff | null; isOwner: boolean; isHospitalStaff: boolean };

/**
 * Muat rujukan dan tentukan siapa yang meminta: pemilik (cookie pelapor) atau petugas RS terkait.
 * Siapa pun di luar keduanya (termasuk petugas RS lain) ditolak 403.
 */
export async function loadWithAccess(
  request: Request,
  id: string,
  allow: { owner?: boolean; staff?: boolean },
): Promise<Access | { response: Response }> {
  if (!isUuid(id)) return { response: fail("NOT_FOUND", "Rujukan tidak ditemukan.", 404) };
  try {
    const referral = await getReferral(id);
    if (!referral) return { response: fail("NOT_FOUND", "Rujukan tidak ditemukan.", 404) };
    const rid = existingReporterId(request);
    const staff = await currentStaff(request);
    const isOwner = !!rid && rid === referral.requester_id;
    const isHospitalStaff = !!staff && staff.hospital_id === referral.hospital.id;
    if ((allow.owner && isOwner) || (allow.staff && isHospitalStaff)) {
      return { referral, staff, isOwner, isHospitalStaff };
    }
    if (!rid && !staff) return { response: fail("UNAUTHORIZED", "Sesi tidak ditemukan.", 401) };
    return { response: fail("FORBIDDEN", "Anda tidak berhak mengakses rujukan ini.", 403) };
  } catch (e) {
    const err = mapDbError(e);
    return { response: fail(err.code, err.message, err.status) };
  }
}

export function stripInternal({ requester_id: _r, ...view }: ReferralRecord) {
  void _r;
  return view;
}
