// Macht die App offlinefähig: Seiten und Schriften werden beim Besuch
// zwischengespeichert, damit man auch ohne Internet lernen kann.
const VERSION = "v6";
const CACHE = `lernapp-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Seiten: erst Netz, bei Offline aus dem Zwischenspeicher
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const kopie = res.clone();
          caches.open(CACHE).then((c) => c.put(req, kopie));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(self.registration.scope)))
    );
    return;
  }
  // Dateien (Skripte, Schriften, Symbole): erst Zwischenspeicher
  e.respondWith(
    caches.match(req).then(
      (r) =>
        r ||
        fetch(req).then((res) => {
          if (res.ok) {
            const kopie = res.clone();
            caches.open(CACHE).then((c) => c.put(req, kopie));
          }
          return res;
        })
    )
  );
});
