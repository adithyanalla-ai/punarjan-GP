/* Offline cache. Same-origin GETs only. No third-party requests, no analytics. */
const CACHE = "punarjan-plan-v3";
const ASSETS = [
  "./", "index.html", "assets/css/styles.css", "assets/js/main.js",
  "assets/fonts/fraunces-latin-400-normal.woff2", "assets/fonts/fraunces-latin-500-normal.woff2", "assets/fonts/fraunces-latin-400-italic.woff2",
  "assets/fonts/inter-latin-400-normal.woff2", "assets/fonts/inter-latin-500-normal.woff2", "assets/fonts/inter-latin-600-normal.woff2",
  ...["ayurveda-education-en", "prevention-en", "early-detection-te", "early-detection-en"].flatMap((n) => [
    `assets/img/poster-${n}-900.webp`, `assets/img/poster-${n}-full.webp`,
  ]),
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  if (r.mode === "navigate") { // pages: network first, cached copy when offline
    e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", cp)); return res; })
      .catch(() => caches.match("index.html", { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((hit) => {
    const net = fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
