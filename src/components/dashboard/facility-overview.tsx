"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CapStatusChip } from "@/components/badges";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { Facility } from "@/lib/schema/api";
import { CAPABILITY_CODES } from "@/lib/schema/enums";

export function FacilityOverview() {
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
  }, [fetchData]);

  return (
    <section aria-labelledby="fac-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 id="fac-title" className="text-xl font-bold">
          Status fasilitas (simulasi)
        </h1>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg border-2 border-slate-400 bg-white px-3 py-2 text-sm font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Muat ulang
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-red-900">
          {error}
        </p>
      )}
      {data && (
        <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
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
            <tbody className="divide-y divide-slate-200">
              {data.facilities.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{f.short_name}</p>
                    <p className="text-xs text-slate-500">OSM {f.osm_id}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <strong>{f.available_slots}</strong>/{f.total_slots}
                    <p className="text-xs text-slate-500">{timeAgo(f.capacity_updated_at)}</p>
                  </td>
                  {CAPABILITY_CODES.map((code) => {
                    const cap = f.capabilities.find((c) => c.code === code);
                    const stale = cap && Date.parse(data.server_time) - Date.parse(cap.updated_at) > data.stale_after_minutes * 60_000;
                    return (
                      <td key={code} className="px-2 py-2">
                        {cap ? (
                          <div className="space-y-0.5">
                            <CapStatusChip status={stale ? "KEDALUWARSA" : cap.status} />
                            <p className="text-[10px] text-slate-500">
                              {stale ? `tercatat ${cap.status}, ` : ""}
                              {timeAgo(cap.updated_at)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
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
      <p className="text-xs text-slate-500">Lokasi: © OpenStreetMap contributors. Kapabilitas dan kuota: seed simulasi, bukan data nyata.</p>
    </section>
  );
}
