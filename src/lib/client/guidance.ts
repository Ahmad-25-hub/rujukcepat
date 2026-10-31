import type { ReferralView } from "@/lib/schema/referral";
import { formatEta } from "./format";

// Teks panduan koordinasi (dibaca juga oleh TTS). Hanya koordinasi rujukan:
// tanpa diagnosis, dosis, atau terapi definitif (GOAL §7, AGENTS §4).

export function buildGuidance(r: ReferralView): string[] {
  const rs = r.hospital.short_name;
  const lines: string[] = [];
  switch (r.status) {
    case "PENDING":
      lines.push(`Permintaan rujukan ke ${rs} sudah dikirim dan menunggu konfirmasi petugas IGD.`);
      lines.push("Ini belum berarti rumah sakit menerima pasien. Jangan menunda keberangkatan hanya untuk menunggu jawaban.");
      break;
    case "ACCEPTED":
      lines.push(`Petugas IGD ${rs} menandai permintaan rujukan diterima. Pada demo ini kapasitas dan kesiapan rumah sakit adalah simulasi.`);
      lines.push("Siapkan identitas pasien dan tunjukkan ringkasan laporan ini kepada petugas saat tiba.");
      break;
    case "REJECTED":
      lines.push(`Petugas IGD ${rs} menolak permintaan ini${r.decision_note ? `, dengan catatan: ${r.decision_note}` : ""}.`);
      lines.push("Kembali ke pilihan tujuan dan pilih rumah sakit lain, atau hubungi 119.");
      break;
    case "EXPIRED":
      lines.push(`Permintaan ke ${rs} kedaluwarsa karena belum dikonfirmasi. Kuota simulasi sudah dilepas.`);
      lines.push("Kirim ulang ke rumah sakit yang sama atau pilih tujuan lain.");
      break;
    case "CANCELLED":
      lines.push(`Permintaan ke ${rs} dibatalkan. Kuota simulasi sudah dilepas.`);
      break;
  }
  if ((r.status === "PENDING" || r.status === "ACCEPTED") && r.eta_seconds != null) {
    const src = r.eta_source === "MOCK" ? "simulasi" : "rute tanpa lalu lintas langsung";
    lines.push(`Perkiraan waktu tempuh sekitar ${formatEta(r.eta_seconds).replace("± ", "")} (${src}).`);
  }
  if (r.status === "PENDING" || r.status === "ACCEPTED") {
    lines.push("Jika kondisi pasien memburuk, hubungi 119 atau 112.");
    const plan = r.ai_result.soap.plan.slice(0, 3).map((p) => p.trim().replace(/[.;]+$/, ""));
    if (plan.length) lines.push(`Catatan koordinasi dari ringkasan, perkiraan AI yang perlu ditinjau: ${plan.join("; ")}.`);
  }
  return lines;
}
