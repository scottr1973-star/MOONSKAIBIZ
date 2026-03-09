/* ═══════════════════════════════════════════════════════════════
   MOONSKAI BIZ — Service Worker
   sw.js  ·  Moonskai Labs L.L.C.
   Strategy: Cache-first for app shell, network-first for data
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME   = 'mk-biz-v4';
const FONT_CACHE   = 'mk-biz-fonts-v1';

// Core app shell files to cache on install
const APP_SHELL = [
  './index.html',
  './manifest.json',
];

// Google Fonts to cache separately (long-lived)
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Share+Tech+Mono&family=DM+Sans:wght@300;400;500;600&display=swap',
];

/* ── INSTALL: cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache error:', err))
  );
});

/* ── ACTIVATE: clear old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== FONT_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ── FETCH: smart routing strategy ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Google Fonts — cache-first, long TTL
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontStrategy(event.request));
    return;
  }

  // App shell (HTML, manifest) — stale-while-revalidate
  if (url.pathname.includes('index') || url.pathname.includes('manifest')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Everything else — network-first with cache fallback
  event.respondWith(networkFirst(event.request));
});

/* ── STRATEGIES ── */

async function fontStrategy(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await fetchPromise || new Response('Offline', { status: 503 });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(offlinePage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/* ── BACKGROUND SYNC: auto-backup reminder (future) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'mk-backup') {
    event.waitUntil(Promise.resolve()); // placeholder
  }
});

/* ── PUSH: tax deadline reminders (future) ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Moonskai Biz', body: 'Tax deadline reminder' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Moonskai Biz', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'mk-tax-reminder',
      renotify: true,
      data: { url: data.url || './index.html' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || './index.html'));
});

/* ── OFFLINE FALLBACK PAGE ── */
function offlinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Moonskai Biz — Offline</title>
<style>
  body{margin:0;background:#020608;color:#6a8a98;font-family:'Share Tech Mono',monospace;
    display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;}
  h1{font-size:28px;color:#00ffa0;margin-bottom:12px;}
  p{font-size:14px;line-height:1.7;max-width:300px;}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;
    background:#00ffa0;animation:pulse 1.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}
</style>
</head>
<body>
  <div>
    <div style="font-size:48px;margin-bottom:16px;">⬡</div>
    <h1>OFFLINE</h1>
    <p>Moonskai Biz is offline. Your data is safe in local storage. Reconnect to sync. <span class="dot"></span></p>
  </div>
</body>
</html>`;
}
