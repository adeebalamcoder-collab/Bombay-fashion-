/* ============================================================
   Bombay Fashion Beauty Zone — Service Worker
   Offline-first caching strategy
   ============================================================ */

const CACHE_NAME = 'bfbz-cache-v1';
const OFFLINE_URL = '/index.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json'
];

/* ---- Install: cache static shell ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/* ---- Activate: remove old caches ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* ---- Fetch: network-first, fall back to cache ---- */
self.addEventListener('fetch', (event) => {
  // Skip cross-origin and non-GET requests
  if (
    event.request.method !== 'GET' ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If valid response, clone and cache
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Last resort: return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

/* ---- Background sync placeholder ---- */
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
  }
});

/* ---- Push notifications placeholder ---- */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Bombay Fashion Beauty Zone';
  const options = {
    body: data.body || 'New products and offers available.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data.url || '/';
  event.waitUntil(clients.openWindow(url));
});
