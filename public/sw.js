// Offline shell for the planner. A raised bed is usually out of Wi-Fi range,
// so the app has to keep working with no connection: the built assets are
// precached on install, navigations fall back to the cached shell, and
// everything the gardener types lives in localStorage anyway.

const VERSION = 'hb-v2';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const OFFLINE_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/logo.png', '/logo-mark.png', '/favicon-64.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(OFFLINE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // weather + Firebase stay online-only

  // Navigations: network first so a deploy is picked up, cached shell as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/'))),
    );
    return;
  }

  // Hashed build assets never change under the same URL: cache first.
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && (url.pathname.startsWith('/assets/') || OFFLINE_URLS.includes(url.pathname) || url.pathname.endsWith('.png'))) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => hit)),
  );
});
