// Stocktify PWA Service Worker
const CACHE_NAME = 'stocktify-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Precaching failed non-critically
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and skip chrome-extension / non-http
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If valid response and static asset, cache a copy
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (event.request.destination === 'script' ||
            event.request.destination === 'style' ||
            event.request.destination === 'image' ||
            event.request.destination === 'font')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // If requesting a HTML page navigation, fallback to root cached index
        if (event.request.mode === 'navigate') {
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
        }
        return new Response('離線模式中', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        });
      })
  );
});
