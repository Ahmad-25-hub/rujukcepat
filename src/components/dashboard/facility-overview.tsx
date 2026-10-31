"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CapStatusChip } from "@/components/badges";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { Facility } from "@/lib/schema/api";
import { CAPABILITY_CODES } from "@/lib/schema/enums";
import { regionOf, SERVICE_REGIONS, type RegionId } from "@/lib/regions";

type RegionFilter = RegionId | "ALL";

export function FacilityOverview({ refreshKey = 0, defaultRegion = "ALL" }: { refreshKey?: number; defaultRegion?: RegionFilter }) {
  const [region, setRegion] = useState<RegionFilter>(defaultRegion);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ facilities: Facility[]; stale_after_minutes: number; server_time: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(
    () =>
      apiFetch<{ facilities: Facility[]; stale_after_minutes: number; server_time: string }>("/api/facilities")
        .then(
          (d) => {
            setData(d);
            setError(null);
          },
          (e) => setError(e instanceof ApiClientError ? e.message : "Gagal memuat data fasilitas."),
        )
        .finally(() => setLoading(false)),
    [],
  );

  function load() {
    setLoading(true);
    void fetchData();
  }

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshKey]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.facilities ?? []).filter(
      (f) =>
        (region === "ALL" || regionOf(f) === region) &&
        (!q || f.short_name.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)),
    );
  }, [data, region, query]);

  return (
    <section aria-labelledby="fac-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="fac-title" className="text-xl font-bold">
          Status fasilitas
        </h2>
        <button type="button" onClick={load} disabled={loading} className="btn btn-secondary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Muat ulang
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border-2 border-[#f3c6ce] bg-brand-tint p-3 text-brand-ink">
          {error}
        </p>
      )}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter wilayah" className="flex flex-wrap gap-1.5">
            {([["ALL", "Semua"], ...SERVICE_REGIONS.map((r) => [r.id, r.label])] as [RegionFilter, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRegion(id)}
                aria-pressed={region === id}
                className={`btn min-h-9 px-3 text-sm ${region === id ? "btn-primary" : "btn-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex min-w-[180px] flex-1 items-center gap-2">
            <span className="sr-only">Cari rumah sakit</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama RS…" className="field min-h-9 w-full text-sm" />
          </label>
          <span className="text-xs text-muted" aria-live="polite">
            {rows.length} dari {data.facilities.length} RS
          </span>
        </div>
      )}
      {data && (
        <div className="overflow-x-auto card">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f1f3f6] text-left">
              <tr>
                <th className="px-3 py-2">Rumah sakit</th>
                <th className="px-3 py-2">Kuota</th>
                {CAPABILITY_CODES.map((c) => (
                  <th key={c} className="px-2 py-2 text-xs">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f5]">
              {rows.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{f.short_name}</p>
                    <p className="text-xs text-muted">OSM {f.osm_id}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <strong>{f.available_slots}</strong>/{f.total_slots}
                    <p className="text-xs text-muted">{timeAgo(f.capacity_updated_at)}</p>
                  </td>
                  {CAPABILITY_CODES.map((code) => {
                    const cap = f.capabilities.find((c) => c.code === code);
                    const stale = cap && Date.parse(data.server_time) - Date.parse(cap.updated_at) > data.stale_after_minutes * 60_000;
                    return (
                      <td key={code} className="px-2 py-2">
                        {cap ? (
                          <div className="space-y-0.5">
                            <CapStatusChip status={stale ? "KEDALUWARSA" : cap.status} />
                            <p className="text-[10px] text-muted">
                              {stale ? `tercatat ${cap.status}, ` : ""}
                              {timeAgo(cap.updated_at)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">Lokasi: © OpenStreetMap contributors.</p>
    </section>
  );
}
