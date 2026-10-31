// Service worker RujukCepat. Sengaja minimal:
//  - Hanya meng-cache cangkang statis (aset /_next/static berhash dan ikon) + halaman offline.
//  - TIDAK PERNAH meng-cache /api/* (status kapasitas, rujukan, laporan pasien) maupun halaman HTML.
//  - Navigasi: jaringan dulu; bila offline tampil /offline.html yang jujur (tanpa data lama).
const VERSION = "v1";
const STATIC_CACHE = `rujukcepat-static-${VERSION}`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rujukcepat-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // tile peta dan layanan lain: langsung ke jaringan
  if (url.pathname.startsWith("/api/")) return; // data dinamis: jangan disentuh

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
