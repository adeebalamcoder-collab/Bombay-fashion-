// Service Worker for Bombay Fashion Beauty Zone PWA
// Version: 1.0.0
// Provides offline caching and reliable asset serving

const CACHE_NAME = 'bfbz-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap',
  'https://fonts.gstatic.com/',
  // Critical product images for offline showcase
  'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/3993447/pexels-photo-3993447.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3889759/pexels-photo-3889759.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/4041392/pexels-photo-4041392.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992757/pexels-photo-3992757.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3993448/pexels-photo-3993448.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/4041391/pexels-photo-4041391.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/4065896/pexels-photo-4065896.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992654/pexels-photo-3992654.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/4041390/pexels-photo-4041390.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3993502/pexels-photo-3993502.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992755/pexels-photo-3992755.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992808/pexels-photo-3992808.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3962293/pexels-photo-3962293.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/4041395/pexels-photo-4041395.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992750/pexels-photo-3992750.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3993123/pexels-photo-3993123.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992802/pexels-photo-3992802.jpeg?auto=compress&cs=tinysrgb&w=600',
  'https://images.pexels.com/photos/3992756/pexels-photo-3992756.jpeg?auto=compress&cs=tinysrgb&w=600'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching preloaded assets');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Force activation immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network, with offline support
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests, browser extensions, and analytics
  if (request.method !== 'GET') return;
  
  // Skip cross-origin requests that might cause issues (except images/fonts)
  if (url.origin !== self.location.origin && 
      !url.href.includes('pexels.com') && 
      !url.href.includes('fonts.googleapis.com') && 
      !url.href.includes('fonts.gstatic.com') &&
      !url.href.includes('wikimedia.org')) {
    return;
  }

  // Strategy: Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        // For HTML pages, also fetch fresh version in background to update cache
        if (request.headers.get('accept')?.includes('text/html')) {
          event.waitUntil(
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            }).catch(() => {
              // Silent fail for background refresh
            })
          );
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        // Don't cache non-successful responses or non-GET
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cache the fetched response for future
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch((error) => {
        console.log('[Service Worker] Fetch failed:', error);
        
        // If fetching HTML fails, serve offline page
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match(OFFLINE_URL).then((offlineResponse) => {
            if (offlineResponse) {
              return offlineResponse;
            }
            // Fallback response
            return new Response(
              '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        }
        
        // For images, return a placeholder if possible
        if (request.url.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#f0ebe4"><rect width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="#b88b4a">Image</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        
        // Default error response
        return new Response('Network error occurred', { status: 408 });
      });
    })
  );
});

// Handle background sync (for future enhancements)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-wholesale-orders') {
    event.waitUntil(syncWholesaleOrders());
  }
});

function syncWholesaleOrders() {
  // Placeholder for future offline order sync functionality
  return Promise.resolve();
}

// Push notification handler (optional future feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New offer from Bombay Fashion Beauty Zone',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    }
  };
  event.waitUntil(
    self.registration.showNotification('Bombay Fashion Beauty Zone', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
