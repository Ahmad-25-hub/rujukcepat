import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

// Pemicu sinkronisasi. Database adalah sumber kebenaran; event hanya memberi tahu klien
// bahwa ada yang berubah sehingga klien mengambil ulang data (tanpa membawa data kesehatan).
//
//  - LOCAL    : EventEmitter dalam proses + Server-Sent Events (/api/stream).
//  - SUPABASE : tambahan broadcast Supabase Realtime dari server (REST) ke kanal
//               "rc:facilities", "rc:hospital:<id>", dan "rc:referral:<id>" (belum diuji tanpa kredensial).

export type SyncEvent = {
  seq: number;
  type: "referral" | "facility";
  hospital_id: string;
  referral_id: string | null;
  /** Hanya untuk penyaringan di server; tidak pernah dikirim ke klien. */
  requester_id: string | null;
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
  return { seq: e.seq, type: e.type, hospital_id: e.hospital_id, referral_id: e.referral_id, at: e.at };
}

let sbClient: ReturnType<typeof createClient> | null = null;
function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.startsWith("<") || key.startsWith("<")) return null;
  return (sbClient ??= createClient(url, key, { auth: { persistSession: false } }));
}

async function broadcast(e: SyncEvent) {
  const sb = supabaseClient();
  if (!sb) return;
  const payload = publicEvent(e);
  const topics = ["rc:facilities", `rc:hospital:${e.hospital_id}`];
  if (e.referral_id) topics.push(`rc:referral:${e.referral_id}`);
  await Promise.allSettled(
    topics.map((t) => {
      const ch = sb.channel(t);
      return ch.httpSend("change", payload).finally(() => void sb.removeChannel(ch));
    }),
  );
}

/** Umumkan perubahan SETELAH transaksi database tersimpan. */
export function notifyChange(e: Omit<SyncEvent, "seq" | "at" | "referral_id" | "requester_id"> & { referral_id?: string | null; requester_id?: string | null }) {
  const full: SyncEvent = { seq: ++bus.seq, at: Date.now(), referral_id: null, requester_id: null, ...e };
  for (const l of bus.listeners) {
    try {
      l(full);
    } catch {
      // pendengar rusak tidak boleh menggagalkan transaksi
    }
  }
  if (config.dataMode === "supabase") void broadcast(full).catch(() => undefined);
}
