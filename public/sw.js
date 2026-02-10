const CACHE_NAME = 'intranet-malim-v2';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Estrategias de caché
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    return cached || Promise.reject(err);
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const networkFetch = fetch(req)
    .then((res) => {
      cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Navegación SPA: devolver siempre el app shell
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedShell = await cache.match('/index.html');

      // Actualización en segundo plano del shell, sin bloquear respuesta
      fetch('/index.html').then((res) => {
        if (res && res.ok) {
          cache.put('/index.html', res.clone());
        }
      }).catch(() => {});

      // Siempre entregar shell para evitar 404 del servidor
      return cachedShell || fetch('/index.html');
    })());
    return;
  }

  // Imágenes: network-first para evitar contenido obsoleto del caché
  if (req.destination === 'image') {
    event.respondWith(networkFirst(req));
    return;
  }

  // Otros recursos: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});
