"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNow } from "@/components/motion";
import { ApiClientError, apiFetch, type ServiceStatus } from "@/lib/client/api";
import { useSync, type SyncInfo } from "@/lib/client/sync";
import { summarizeReadiness, type ReadinessSummary } from "@/lib/facilities/readiness";
import type { Facility } from "@/lib/schema/api";

// Umpan status fasilitas publik untuk beranda. Mengambil /api/facilities dan mengambil
// ulang setiap ada event sinkronisasi (SSE lokal / Supabase Realtime) — database tetap
// sumber kebenaran, event hanya pemicu.

type FacilitiesResponse = { facilities: Facility[]; stale_after_minutes: number; server_time: string };

type Feed = {
  summary: ReadinessSummary | null;
  error: string | null;
  loading: boolean;
  sync: SyncInfo;
  now: number;
  reload: () => void;
};

const FeedContext = createContext<Feed | null>(null);

export function FacilityFeedProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [data, setData] = useState<FacilitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useNow();

  const load = useCallback(
    () =>
      apiFetch<FacilitiesResponse>("/api/facilities")
        .then(
          (d) => {
            setData(d);
            setError(null);
          },
          (e) => setError(e instanceof ApiClientError ? e.message : "Data kesiapan IGD tidak dapat dimuat."),
        )
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void load();
    apiFetch<ServiceStatus>("/api/status").then(setStatus, () =>
      setStatus({ data_mode: "LOCAL" } as ServiceStatus),
    );
  }, [load]);

  const sync = useSync({
    onChange: () => void load(),
    supabaseChannels: status?.data_mode === "SUPABASE" ? ["rc:facilities"] : null,
    enabled: status != null,
  });

  const summary = useMemo(
    () => (data ? summarizeReadiness(data.facilities, Math.max(now, Date.parse(data.server_time)), data.stale_after_minutes) : null),
    [data, now],
  );

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  return <FeedContext.Provider value={{ summary, error, loading, sync, now, reload }}>{children}</FeedContext.Provider>;
}

export function useFacilityFeed() {
  const v = useContext(FeedContext);
  if (!v) throw new Error("useFacilityFeed harus dipakai di dalam FacilityFeedProvider");
  return v;
}
