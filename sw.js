
const CACHE_NAME = "general-store-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./index.js",
  "./inventory.html",
  "./inventory.js",
  "./purchase.html",
  "./purchase.js",
  "./sale.html",
  "./sale.js",
  "./sales-return.html",
  "./sales-return.js",
  "./customers.html",
  "./customers.js",
  "./suppliers.html",
  "./suppliers.js",
  "./finance.html",
  "./finance.js",
  "./reports.html",
  "./reports.js",
  "./whatsapp.html",
  "./whatsapp.js",
  "./ai.html",
  "./ai.js",
  "./settings.html",
  "./settings.js",
  "./stock-lots.html",
  "./stock-lots.js",
  "./manifest.json",
  "./gs192.png",
  "./gs512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(
        APP_FILES.map(async file => {
          try {
            await cache.add(file);
          } catch (error) {
            console.warn("Cache skipped:", file);
          }
        })
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // HTML navigation: network first, then cached page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match("./index.html") ||
            new Response(
              "इन्टरनेट उपलब्ध छैन। पहिले खोलिएको पेज फेरि प्रयास गर्नुहोस्।",
              {
                status: 503,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8"
                }
              }
            )
          );
        })
    );

    return;
  }

  // Other same-origin files: cache first.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});
