const CACHE = "plotted-v2";
const SHELL = [
  "./",
  "./index.html",
  "./plotted.css",
  "./plotted.js",
  "./plotted-engine.js",
  "./plotted-config.js",
  "./plotted-icons.js",
  "./plotted-themes.js",
  "./favicon.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchAndStore = fetch(request)
        .then((response) => {
          if (response.ok && new URL(request.url).pathname.includes("/data/plotted/")) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchAndStore;
    }),
  );
});
