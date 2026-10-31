"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

// Sinkronisasi sisi klien. Event hanya pemicu: setiap event/reconnect/polling memanggil
// `onChange` yang mengambil ulang data dari API (database = sumber kebenaran), sehingga
// event ganda atau terlewat tidak menggandakan daftar maupun mengurangi kuota di klien.
//
//  - transport "sse"      : EventSource ke /api/stream (mode data lokal).
//  - transport "supabase" : kanal broadcast Supabase Realtime (mode data supabase; belum diuji tanpa kredensial).
//  - Bila koneksi tidak "live": polling tiap 5 detik + badge "Sinkronisasi terbatas".

export type SyncState = "connecting" | "live" | "limited";
export type SyncInfo = { state: SyncState; latencyMs: number | null; transport: "sse" | "supabase"; lastSyncAt: number | null; events: number };

const POLL_MS = 5000;

export function useSync(opts: { onChange: () => void; supabaseChannels?: string[] | null; enabled?: boolean }): SyncInfo {
  const { supabaseChannels, enabled = true } = opts;
  const cb = useRef(opts.onChange);
  const stateRef = useRef<SyncState>("connecting");
  const [info, setInfo] = useState<SyncInfo>({
    state: "connecting",
    latencyMs: null,
    transport: supabaseChannels?.length ? "supabase" : "sse",
    lastSyncAt: null,
    events: 0,
  });

  useEffect(() => {
    cb.current = opts.onChange;
  });

  const channelsKey = supabaseChannels?.join("|") ?? "";

  useEffect(() => {
    if (!enabled) return;
    const transport: "sse" | "supabase" = channelsKey ? "supabase" : "sse";
    const set = (state: SyncState) => {
      stateRef.current = state;
      setInfo((i) => (i.state === state && i.transport === transport ? i : { ...i, state, transport }));
    };
    const changed = (at?: number) => {
      const latencyMs = typeof at === "number" ? Math.max(0, Date.now() - at) : null;
      setInfo((i) => ({ ...i, latencyMs: latencyMs ?? i.latencyMs, lastSyncAt: Date.now(), events: i.events + 1 }));
      cb.current();
    };

    let es: EventSource | null = null;
    let sb: SupabaseClient | null = null;
    const channels: RealtimeChannel[] = [];

    if (transport === "sse") {
      if (typeof EventSource === "undefined") {
        set("limited");
      } else {
        es = new EventSource("/api/stream");
        es.addEventListener("hello", () => {
          set("live");
          cb.current(); // rekonsiliasi penuh setiap (re)connect
        });
        es.addEventListener("change", (ev) => {
          try {
            changed((JSON.parse((ev as MessageEvent).data) as { at?: number }).at);
          } catch {
            changed();
          }
        });
        es.onerror = () => set("limited");
      }
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        set("limited");
      } else {
        sb = createClient(url, key, { auth: { persistSession: false } });
        let subscribed = 0;
        for (const name of channelsKey.split("|")) {
          const ch = sb
            .channel(name)
            .on("broadcast", { event: "change" }, (m) => changed((m.payload as { at?: number } | undefined)?.at))
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                subscribed += 1;
                if (subscribed >= channelsKey.split("|").length) {
                  set("live");
                  cb.current();
                }
              } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                subscribed = Math.max(0, subscribed - 1);
                set("limited");
              }
            });
          channels.push(ch);
        }
      }
    }

    const poll = setInterval(() => {
      if (stateRef.current !== "live" && document.visibilityState === "visible") cb.current();
    }, POLL_MS);
    const reconcile = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    window.addEventListener("online", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    return () => {
      es?.close();
      for (const ch of channels) void sb?.removeChannel(ch);
      clearInterval(poll);
      window.removeEventListener("online", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [enabled, channelsKey]);

  return info;
}
