// Service worker de la app de PRUEBA: guarda los archivos de la app para que abra sin internet.
const CACHE = 'phenom-app-quorum-v1';
const FILES = ['./', './index.html', './app.css', './app.js', './manifest.webmanifest', './icons/phenom-logo.svg', './icons/phenom-maskable.svg', './docs/QUORUM.md', './celula.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.includes('/app-quorum/')) return;
  // Red primero (para ver cambios), caché si no hay internet.
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});
