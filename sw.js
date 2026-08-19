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
      // no responde justo en ese momento),
