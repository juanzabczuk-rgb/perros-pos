const CACHE_NAME = 'pos-cache-v1';
const urlsToCache = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.map((k) => { 
          if (k !== CACHE_NAME) return caches.delete(k); 
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass para API, websockets y métodos que no sean GET
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // No interceptar si es una navegación que espera HTML (dejar que Vercel maneje el index.html)
  if (event.request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Si falla el fetch y no está en cache, devolvemos una respuesta vacía o error controlado
        return new Response('Network error', { status: 408 });
      });
    })
  );
});
