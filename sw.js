const VERSION = '3.6.0';
const CACHE = 'breeze-v' + VERSION;
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/lang.js'];
const MAX_CACHE_ITEMS = 50; // v3.6: Prevent unbounded cache growth

self.addEventListener('install', (e) => {
  // v3.6: Static Routing API — bypass SW for API calls (Chrome 123+)
  // Eliminates SW startup overhead for real-time messaging endpoints
  if (e.addRoutes) {
    try {
      e.addRoutes([
        { condition: { urlPattern: { pathname: '/api/*' } }, source: 'network' },
      ]);
    } catch (err) { /* Static Routing not supported */ }
  }
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
      self.registration.navigationPreload?.enable().catch(() => {}),
      // v3.6: Trim cache to MAX_CACHE_ITEMS
      caches.open(CACHE).then(async (cache) => {
        const keys = await cache.keys();
        // Never evict the precached app shell — slice(0, …) removes oldest-inserted
        // entries, which are exactly the addAll(ASSETS) shell files, leaving offline
        // launch with no '/index.html' to fall back to. Trim only runtime entries.
        const shell = new Set(ASSETS.map(a => new URL(a, self.location.origin).href));
        const trimmable = keys.filter(k => !shell.has(k.url));
        if (trimmable.length > MAX_CACHE_ITEMS) {
          const toDelete = trimmable.slice(0, trimmable.length - MAX_CACHE_ITEMS);
          await Promise.all(toDelete.map(k => cache.delete(k)));
        }
      }),
    ])
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Skip API calls (never cache)
  if (url.pathname.startsWith('/api/')) return;
  // Navigation: network-first with cache fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const preload = await e.preloadResponse?.catch(() => null);
          const resp = preload || await fetch(e.request);
          if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
          return resp;
        } catch { return caches.match('/index.html'); }
      })()
    );
    return;
  }
  // v3.6: Assets — stale-while-revalidate (instant load + background update)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Web Push
self.addEventListener('push', (e) => {
  let data = { title: 'Breeze', body: 'New message' };
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Breeze', {
      body: data.body || 'New message',
      tag: data.tag || 'breeze-msg',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/', contactId: data.contactId },
      renotify: true,
      // v3.6: Notification action buttons (Chrome 48+, Firefox 44+)
      actions: [
        { action: 'reply', title: 'Reply', type: 'text' },
        { action: 'mark-read', title: 'Mark Read' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const action = e.action;
  const data = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      // v3.6: Handle notification actions
      if (action === 'reply' && e.reply) {
        // Direct reply from notification (Chrome inline reply)
        for (const client of list) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({ type: 'quick-reply', contactId: data.contactId, text: e.reply });
            return client.focus();
          }
        }
      }
      if (action === 'mark-read') {
        // Send mark-read to client
        for (const client of list) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({ type: 'mark-read', contactId: data.contactId });
            return; // Don't focus — user wants to stay where they are
          }
        }
        return;
      }
      // Default: focus existing window or open new
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(data.url || '/');
    })
  );
});

// Background Sync
self.addEventListener('sync', (e) => {
  if (e.tag === 'breeze-outbox') {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(all => {
        for (const client of all) client.postMessage({ type: 'sync-outbox' });
      })
    );
  }
});

// v3.6: SKIP_WAITING message from client → activate new SW immediately
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
