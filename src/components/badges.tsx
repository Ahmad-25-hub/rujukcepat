import {
  AlertTriangle,
  Bot,
  Camera,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FlaskConical,
  MessageSquareQuote,
  Wrench,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { DATA_ORIGIN_LABELS, type DataOrigin, type Urgency } from "@/lib/schema/enums";

export function SimBadge({ children = "Data simulasi" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

const URGENCY_STYLE: Record<Urgency | "REVIEW", { cls: string; label: string; icon: ReactNode }> = {
  MERAH: {
    cls: "bg-red-700 text-white border-red-800",
    label: "MERAH – gawat",
    icon: <AlertTriangle className="h-5 w-5" aria-hidden />,
  },
  KUNING: {
    cls: "bg-yellow-300 text-yellow-950 border-yellow-500",
    label: "KUNING – perlu segera",
    icon: <CircleAlert className="h-5 w-5" aria-hidden />,
  },
  HIJAU: {
    cls: "bg-green-700 text-white border-green-800",
    label: "HIJAU – tidak mendesak",
    icon: <CircleCheck className="h-5 w-5" aria-hidden />,
  },
  REVIEW: {
    cls: "bg-slate-200 text-slate-900 border-slate-400",
    label: "Perlu peninjauan",
    icon: <CircleHelp className="h-5 w-5" aria-hidden />,
  },
};

export function UrgencyBadge({ level }: { level: Urgency | null }) {
  const s = URGENCY_STYLE[level ?? "REVIEW"];
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-base font-bold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

const ORIGIN_STYLE: Record<DataOrigin, { cls: string; icon: ReactNode }> = {
  USER_STATEMENT: { cls: "bg-blue-50 text-blue-900 border-blue-300", icon: <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden /> },
  PHOTO_READING: { cls: "bg-purple-50 text-purple-900 border-purple-300", icon: <Camera className="h-3.5 w-3.5" aria-hidden /> },
  AI_INTERPRETATION: { cls: "bg-orange-50 text-orange-900 border-orange-300", icon: <Bot className="h-3.5 w-3.5" aria-hidden /> },
  UNKNOWN: { cls: "bg-slate-100 text-slate-700 border-slate-300", icon: <CircleHelp className="h-3.5 w-3.5" aria-hidden /> },
};

export function OriginChip({ origin }: { origin: DataOrigin }) {
  const s = ORIGIN_STYLE[origin];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.icon}
      {DATA_ORIGIN_LABELS[origin]}
    </span>
  );
}

export function CapStatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: ReactNode; label: string }> = {
    READY: { cls: "bg-green-50 text-green-900 border-green-400", icon: <CircleCheck className="h-3.5 w-3.5" aria-hidden />, label: "READY" },
    PENUH: { cls: "bg-red-50 text-red-900 border-red-400", icon: <XCircle className="h-3.5 w-3.5" aria-hidden />, label: "PENUH" },
    MAINTENANCE: { cls: "bg-amber-50 text-amber-900 border-amber-400", icon: <Wrench className="h-3.5 w-3.5" aria-hidden />, label: "MAINTENANCE" },
    TIDAK_TERSEDIA: { cls: "bg-slate-100 text-slate-700 border-slate-300", icon: <XCircle className="h-3.5 w-3.5" aria-hidden />, label: "Tidak tersedia" },
    KEDALUWARSA: { cls: "bg-slate-100 text-slate-700 border-slate-400", icon: <CircleHelp className="h-3.5 w-3.5" aria-hidden />, label: "Status kedaluwarsa" },
  };
  const s = map[status] ?? map.TIDAK_TERSEDIA;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function ModeBanner({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      {items.map((i) => (
        <SimBadge key={i}>{i}</SimBadge>
      ))}
    </div>
  );
}
