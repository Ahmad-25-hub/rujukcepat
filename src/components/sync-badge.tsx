"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import type { SyncInfo } from "@/lib/client/sync";

// Indikator koneksi sinkronisasi (teks + ikon, tidak hanya warna).
export function SyncBadge({ sync, showLatency = false, dark = false }: { sync: SyncInfo; showLatency?: boolean; dark?: boolean }) {
  const via = sync.transport === "supabase" ? "Supabase Realtime" : "SSE";
  if (sync.state === "live") {
    return (
      <span
        className={`inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${dark ? "bg-[#13203a] text-[#cfe9dc]" : "bg-ok-tint text-ok-strong"}`}
        role="status"
        title={`Tersambung lewat ${via}`}
      >
        <span className={`anim-live h-2 w-2 rounded-full ${dark ? "bg-[#3dd68c]" : "bg-ok"}`} aria-hidden />
        Tersinkron
        <span className="max-[520px]:sr-only">
          {" "}
          ({via}){showLatency && sync.latencyMs != null ? <> · <span className="font-mono">{sync.latencyMs} ms</span></> : null}
        </span>
      </span>
    );
  }
  if (sync.state === "connecting") {
    return (
      <span className={`inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${dark ? "bg-[#13203a] text-[#d6dde8]" : "bg-[#eef1f5] text-ink-2"}`} role="status">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Menyambung…
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-warn-tint px-3 text-xs font-semibold text-warn-ink" role="status">
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      Sinkronisasi terbatas (tiap 5 dtk)
    </span>
  );
}
