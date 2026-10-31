import {
  AlertTriangle,
  Bot,
  Camera,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  MessageSquareQuote,
  Wrench,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DATA_ORIGIN_LABELS, type DataOrigin, type Urgency } from "@/lib/schema/enums";

/** Logo RujukCepat: tanda denyut di kotak merah + nama. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#c4122f" />
      <path d="M6 17h5l2.5-6 4 11 2.5-5H26" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLink({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link href="/" aria-label="RujukCepat – beranda" className={`flex min-h-11 min-w-11 items-center gap-2.5 rounded-xl ${dark ? "text-white" : "text-ink"}`}>
      <BrandMark />
      <span className={`text-lg font-extrabold tracking-tight ${compact ? "max-[520px]:sr-only" : ""}`}>RujukCepat</span>
    </Link>
  );
}

const URGENCY_STYLE: Record<Urgency | "REVIEW", { cls: string; label: string; short: string; icon: (c: string) => ReactNode }> = {
  MERAH: {
    cls: "bg-brand text-white",
    label: "MERAH – gawat",
    short: "MERAH",
    icon: (c) => <AlertTriangle className={c} aria-hidden />,
  },
  KUNING: {
    cls: "bg-signal-yellow text-[#3b2a00]",
    label: "KUNING – perlu segera",
    short: "KUNING",
    icon: (c) => <CircleAlert className={c} aria-hidden />,
  },
  HIJAU: {
    cls: "bg-ok text-white",
    label: "HIJAU – tidak mendesak",
    short: "HIJAU",
    icon: (c) => <CircleCheck className={c} aria-hidden />,
  },
  REVIEW: {
    cls: "border border-dashed border-muted bg-[#e6eaf0] text-ink",
    label: "Perlu peninjauan",
    short: "Tinjau",
    icon: (c) => <CircleHelp className={c} aria-hidden />,
  },
};

export function UrgencyBadge({ level, size = "md" }: { level: Urgency | null; size?: "sm" | "md" | "lg" }) {
  const s = URGENCY_STYLE[level ?? "REVIEW"];
  const sz =
    size === "sm"
      ? "gap-1 rounded-md px-2 py-0.5 text-xs font-extrabold"
      : size === "lg"
        ? "gap-2 rounded-xl px-3.5 py-2 text-base font-extrabold"
        : "gap-1.5 rounded-lg px-2.5 py-1 text-sm font-extrabold";
  return (
    <span className={`inline-flex items-center ${sz} ${s.cls}`}>
      {s.icon(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
      {s.label}
    </span>
  );
}

/** Kartu urgensi besar untuk peninjauan. */
export function UrgencyHero({ level, reason }: { level: Urgency | null; reason: string }) {
  const s = URGENCY_STYLE[level ?? "REVIEW"];
  const dark = level === "MERAH" || level === "HIJAU";
  return (
    <div className={`anim-rise space-y-3 rounded-3xl p-5 ${level ? s.cls : "border-2 border-dashed border-muted bg-white text-ink"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`eyebrow ${dark ? "!text-white/80" : "!text-current"}`}>Perkiraan urgensi · AI</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${dark ? "bg-white/15" : "bg-black/5"}`}>Perlu ditinjau</span>
      </div>
      <p className="flex items-center gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${dark ? "bg-white text-current" : "bg-white/70"}`}>
          {s.icon(`h-6 w-6 ${level === "MERAH" ? "text-brand" : level === "HIJAU" ? "text-ok" : ""}`)}
        </span>
        <span className="flex flex-col">
          <span className="text-[28px] font-extrabold leading-none tracking-tight">{level ?? "Belum dapat dinilai"}</span>
          <span className={`mt-1 text-[15px] font-semibold ${dark ? "text-white/85" : ""}`}>{s.label.split("–")[1]?.trim() ?? s.label}</span>
        </span>
      </p>
      <p className={`text-[15px] leading-relaxed ${dark ? "text-white/90" : ""}`}>{reason}</p>
    </div>
  );
}

const ORIGIN_STYLE: Record<DataOrigin, { cls: string; icon: ReactNode }> = {
  USER_STATEMENT: { cls: "bg-accent-tint text-accent-ink", icon: <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden /> },
  PHOTO_READING: { cls: "bg-[#f1ecfb] text-[#4c2e91]", icon: <Camera className="h-3.5 w-3.5" aria-hidden /> },
  AI_INTERPRETATION: { cls: "bg-[#fff1e6] text-[#8a3b00]", icon: <Bot className="h-3.5 w-3.5" aria-hidden /> },
  UNKNOWN: { cls: "border border-dashed border-faint bg-[#f1f3f6] text-ink-2", icon: <CircleHelp className="h-3.5 w-3.5" aria-hidden /> },
};

export function OriginChip({ origin }: { origin: DataOrigin }) {
  const s = ORIGIN_STYLE[origin];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.icon}
      {DATA_ORIGIN_LABELS[origin]}
    </span>
  );
}

const CAP_STYLE: Record<string, { cls: string; icon: ReactNode; label: string }> = {
  READY: { cls: "border-[#a9dcc3] bg-ok-tint text-ok-strong", icon: <CircleCheck className="h-3.5 w-3.5" aria-hidden />, label: "READY" },
  PENUH: { cls: "border-[#f3b8c2] bg-brand-tint text-[#8e0d24]", icon: <XCircle className="h-3.5 w-3.5" aria-hidden />, label: "PENUH" },
  MAINTENANCE: { cls: "border-[#f0d08a] bg-warn-tint text-warn-ink", icon: <Wrench className="h-3.5 w-3.5" aria-hidden />, label: "MAINTENANCE" },
  TIDAK_TERSEDIA: { cls: "border-line-strong bg-[#f1f3f6] text-ink-2", icon: <XCircle className="h-3.5 w-3.5" aria-hidden />, label: "Tidak tersedia" },
  KEDALUWARSA: { cls: "border-dashed border-faint bg-[#f1f3f6] text-ink-2", icon: <CircleHelp className="h-3.5 w-3.5" aria-hidden />, label: "Status kedaluwarsa" },
};

export function CapStatusChip({ status }: { status: string }) {
  const s = CAP_STYLE[status] ?? CAP_STYLE.TIDAK_TERSEDIA;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}
