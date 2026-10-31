import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { getSupabaseServerConfig } from "@/lib/supabase/server-config";

// Pemicu sinkronisasi. Database adalah sumber kebenaran; event hanya memberi tahu klien
// bahwa ada yang berubah sehingga klien mengambil ulang data (tanpa membawa data kesehatan).
//
//  - LOCAL    : EventEmitter dalam proses + Server-Sent Events (/api/stream).
//  - SUPABASE : tambahan broadcast Supabase Realtime dari server (REST) ke kanal
//               "rc:facilities" (belum diuji tanpa kredensial).

export type SyncEvent = {
  seq: number;
  type: "facility";
  hospital_id: string;
  /** Waktu server (ms epoch) saat perubahan tersimpan; dipakai untuk mengukur latensi sinkronisasi. */
  at: number;
};

type Listener = (e: SyncEvent) => void;
type Bus = { seq: number; listeners: Set<Listener> };
const g = globalThis as unknown as { __rujukBus?: Bus };
const bus: Bus = (g.__rujukBus ??= { seq: 0, listeners: new Set() });

export function subscribe(l: Listener): () => void {
  bus.listeners.add(l);
  return () => bus.listeners.delete(l);
}

export function publicEvent(e: SyncEvent) {
  return { seq: e.seq, type: e.type, hospital_id: e.hospital_id, at: e.at };
}

let sbClient: ReturnType<typeof createClient> | null = null;
function supabaseClient() {
  const settings = getSupabaseServerConfig();
  if (!settings) return null;
  return (sbClient ??= createClient(settings.url, settings.key, { auth: { persistSession: false } }));
}

async function broadcast(e: SyncEvent) {
  const sb = supabaseClient();
  if (!sb) return;
  const payload = publicEvent(e);
  const ch = sb.channel("rc:facilities");
  await ch.httpSend("change", payload).finally(() => void sb.removeChannel(ch));
}

/** Umumkan perubahan SETELAH transaksi database tersimpan. */
export function notifyChange(e: Pick<SyncEvent, "hospital_id">) {
  const full: SyncEvent = { seq: ++bus.seq, at: Date.now(), type: "facility", ...e };
  for (const l of bus.listeners) {
    try {
      l(full);
    } catch {
      // pendengar rusak tidak boleh menggagalkan transaksi
    }
  }
  if (config.dataMode === "supabase") void broadcast(full).catch(() => undefined);
}
