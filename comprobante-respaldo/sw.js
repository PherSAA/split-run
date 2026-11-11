// El ámbito forma parte del nombre para aislar copias de prueba del mismo origen.
const scope = self.registration.scope;
const prefix = 'comp-respaldo:' + scope + ':';
const CACHE = prefix + 'v12-2';
const FILES = ['./', './index.html', './app.css', './sello.js', './app.js', './manifest.webmanifest',
  './icons/phenom-logo.svg', './icons/phenom-maskable.svg', './presupuestos/', './presupuestos/index.html',
  './presupuestos/ui.js', './presupuestos/modelo.js', './presupuestos/archivo.js', './presupuestos/estilo.css'];
const urls = new Set(FILES.map(path => new URL(path, scope).href));
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(prefix) && k !== CACHE)
    .map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  url.search = '';
  url.hash = '';
  if (event.request.method !== 'GET' || !urls.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.href)) || fetch(event.request)));
});
