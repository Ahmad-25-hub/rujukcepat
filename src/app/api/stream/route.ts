import { publicEvent, subscribe } from "@/lib/sync/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events: pemicu sinkronisasi (tanpa data kesehatan).
//  - Semua klien menerima perubahan status/kapasitas fasilitas (data publik).
// Klien mengambil ulang data dari API setelah menerima event (database = sumber kebenaran).
export async function GET(request: Request) {
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`retry: 2000\nevent: hello\ndata: ${JSON.stringify({ server_time: Date.now() })}\n\n`);

      const unsub = subscribe((e) => {
        send(`id: ${e.seq}\nevent: change\ndata: ${JSON.stringify(publicEvent(e))}\n\n`);
      });
      const beat = setInterval(() => send(`: ping ${Date.now()}\n\n`), 15000);
      cleanup = () => {
        unsub();
        clearInterval(beat);
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
