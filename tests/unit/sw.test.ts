import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Menguji perilaku public/sw.js pada lingkungan service worker tiruan: tidak boleh meng-cache
// /api/* atau halaman HTML, navigasi offline jatuh ke /offline.html, aset statis cache-first.
// (Registrasi pada browser sungguhan diuji manual; lihat TASK.md T14.)

type Listener = (e: unknown) => void;

function setup() {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, Map<string, string>>();
  const fetchMock = vi.fn(async (req: { url: string }) => ({ ok: true, url: req.url, body: `net:${req.url}`, clone() { return this; } }));
  const caches = {
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        addAll: async (urls: string[]) => urls.forEach((u) => c.set(u, `pre:${u}`)),
        put: async (req: { url: string }, res: { body: string }) => void c.set(new URL(req.url).pathname, res.body),
      };
    },
    async match(req: string | { url: string }) {
      const key = typeof req === "string" ? req : new URL(req.url).pathname;
      for (const c of store.values()) if (c.has(key)) return { body: c.get(key), cached: true };
      return undefined;
    },
    async keys() {
      return [...store.keys()];
    },
    async delete(name: string) {
      return store.delete(name);
    },
  };
  const self = {
    location: { origin: "https://app.test" },
    addEventListener: (type: string, fn: Listener) => void (listeners[type] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const src = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  new Function("self", "caches", "fetch", "URL", src)(self, caches, fetchMock, URL);

  async function dispatchFetch(url: string, opts: { method?: string; mode?: string } = {}): Promise<{ body?: string; cached?: boolean } | null> {
    let responded: Promise<{ body?: string; cached?: boolean }> | null = null;
    listeners.fetch({
      request: { url, method: opts.method ?? "GET", mode: opts.mode ?? "cors" },
      respondWith: (p: Promise<{ body?: string; cached?: boolean }>) => void (responded = Promise.resolve(p)),
    });
    return responded ? await responded : null;
  }
  async function lifecycle(type: "install" | "activate") {
    let p: Promise<unknown> = Promise.resolve();
    listeners[type]({ waitUntil: (x: Promise<unknown>) => void (p = x) });
    await p;
  }
  return { store, fetchMock, dispatchFetch, lifecycle };
}

describe("service worker", () => {
  it("pra-cache hanya halaman offline dan ikon", async () => {
    const sw = setup();
    await sw.lifecycle("install");
    const cached = [...sw.store.values()].flatMap((m) => [...m.keys()]);
    expect(cached.sort()).toEqual(["/icons/icon-192.png", "/icons/icon-512.png", "/offline.html"]);
  });

  it("tidak menyentuh /api/*, metode non-GET, dan permintaan lintas origin", async () => {
    const sw = setup();
    expect(await sw.dispatchFetch("https://app.test/api/facilities")).toBeNull();
    expect(await sw.dispatchFetch("https://app.test/api/referrals/abc")).toBeNull();
    expect(await sw.dispatchFetch("https://app.test/lapor", { method: "POST", mode: "navigate" })).toBeNull();
    expect(await sw.dispatchFetch("https://tile.openstreetmap.org/1/2/3.png")).toBeNull();
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });

  it("navigasi saat offline menampilkan halaman offline, bukan halaman lama", async () => {
    const sw = setup();
    await sw.lifecycle("install");
    sw.fetchMock.mockRejectedValueOnce(new Error("offline"));
    const res = await sw.dispatchFetch("https://app.test/dashboard", { mode: "navigate" });
    expect(res?.body).toBe("pre:/offline.html");
  });

  it("navigasi saat online selalu ke jaringan dan tidak di-cache", async () => {
    const sw = setup();
    await sw.lifecycle("install");
    const res = await sw.dispatchFetch("https://app.test/lapor", { mode: "navigate" });
    expect(res?.body).toBe("net:https://app.test/lapor");
    const cached = [...sw.store.values()].flatMap((m) => [...m.keys()]);
    expect(cached).not.toContain("/lapor");
  });

  it("aset /_next/static: ambil dari jaringan sekali lalu dari cache", async () => {
    const sw = setup();
    await sw.lifecycle("install");
    const url = "https://app.test/_next/static/chunks/abc.js";
    await sw.dispatchFetch(url);
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.fetchMock).toHaveBeenCalledTimes(1);
    const second = await sw.dispatchFetch(url);
    expect(second?.cached).toBe(true);
    expect(sw.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aktivasi menghapus cache versi lama", async () => {
    const sw = setup();
    sw.store.set("rujukcepat-static-v1", new Map([["/lama", "x"]]));
    await sw.lifecycle("install");
    await sw.lifecycle("activate");
    expect([...sw.store.keys()]).toEqual(["rujukcepat-static-v2"]);
  });
});
