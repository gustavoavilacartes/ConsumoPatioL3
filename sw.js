// ============================================================================
// sw.js — Service Worker: Cache-First para assets estáticos
// Usa rutas relativas al scope del SW para funcionar tanto en la raíz de un
// dominio como en un subpath de GitHub Pages (usuario.github.io/repo/).
// ============================================================================
const CACHE_NAME = 'patio-arauco-v7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/localdb.js',
  './js/sync.js',
  './js/auth.js',
  './js/supabaseConfig.js',
  './js/utils.js',
  './js/views/dashboard.js',
  './js/views/carga.js',
  './js/views/tractor.js',
  './js/views/descarga.js',
  './js/views/recursos.js',
  './js/views/reportes.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const urls = ASSETS_TO_CACHE.map((p) => new URL(p, self.registration.scope).toString());
      // Cada URL se cachea por separado: si una falla (ej. el CDN de Excel
      // no responde justo en ese momento), NO debe tumbar la instalación de
      // toda la app — solo se omite esa URL y se reintenta más adelante en
      // tiempo de ejecución (ver el handler de 'fetch' más abajo).
      await Promise.all(urls.map((url) =>
        cache.add(url).catch((err) => {
          console.warn('SW: no se pudo precachear (se omite):', url, err.message);
        })
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isExternal = !request.url.startsWith(self.location.origin);

  if (isExternal) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => new Response('Offline - recurso no disponible', {
          status: 503, headers: { 'Content-Type': 'text/plain' },
        }));
    })
  );
});
