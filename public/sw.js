// Bump this on every release that changes cached assets, so the activate
// handler below actually has an old cache to clean up. It no longer needs to
// match a specific build, it's just a cache-busting version marker.
const CACHE_NAME = "het-verband-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline assets");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor
//
// NETWORK-FIRST: previously this was cache-first, which meant that once a
// user had the app open once, their browser kept serving the cached
// index.html/JS forever - even after a brand new version was deployed to the
// server - because a plain version bump of CACHE_NAME does not by itself
// force already-open clients to re-fetch. That silently broke every future
// deploy from reaching users (they'd keep seeing old behavior indefinitely).
// Network-first means we always attempt to fetch the latest version first,
// and only fall back to the cache when the network is unavailable (true
// offline support), refreshing the cache with whatever we do get from the
// network so the offline fallback also stays reasonably up to date.
self.addEventListener("fetch", (event) => {
  // Let API requests and dynamic server interactions go straight to the network
  if (event.request.url.includes("/api/")) {
    return;
  }
  // Only GET requests are cacheable.
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback for document requests if network is down and nothing cached
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      })
  );
});
