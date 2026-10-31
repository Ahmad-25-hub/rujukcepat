"use client";

import { Radio, RefreshCw, WifiOff } from "lucide-react";
import type { SyncInfo } from "@/lib/client/sync";

// Indikator koneksi sinkronisasi (teks + ikon, tidak hanya warna).
export function SyncBadge({ sync, showLatency = false }: { sync: SyncInfo; showLatency?: boolean }) {
  const via = sync.transport === "supabase" ? "Supabase Realtime" : "SSE";
  if (sync.state === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-600 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-900" role="status">
        <Radio className="h-3.5 w-3.5" aria-hidden />
        Tersambung ({via}){showLatency && sync.latencyMs != null ? ` · ${sync.latencyMs} ms` : ""}
      </span>
    );
  }
  if (sync.state === "connecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-400 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800" role="status">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Menyambung…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-600 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950" role="status">
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      Sinkronisasi terbatas (memperbarui tiap 5 dtk)
    </span>
  );
}
