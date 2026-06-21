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
          cachePut(e.request, resp);
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
        cachePut(e.request, resp);
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Cache a response only when it is a full, same-origin, OK response. Guards the two
// documented Cache.put() pitfalls that would otherwise surface as unhandled rejections:
//   - 206 Partial Content (range requests) — note response.ok is TRUE for 206, so the
//     old `if (resp.ok)` check let it through and Cache.put() throws on a partial response.
//   - QuotaExceededError when storage is full — the .catch() swallows it (the SWR/network
//     response is still returned to the page; only the cache write is skipped).
// Opaque (cross-origin no-cors, status 0) and CORS responses are skipped: we only persist
// our own app shell, never third-party bytes.
function cachePut(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  const copy = response.clone();
  caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
}

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

// Resolve a notification's target URL against our OWN origin and refuse anything that
// escapes it. `data.url` arrives in the server-supplied push payload; the normal worker
// path (sendPushToUser) never sets it, so a cross-origin value can only come from a
// malicious/compromised relay trying to turn a notification tap into a phishing redirect
// via clients.openWindow(). Cross-origin, protocol-relative (//evil), and javascript:
// inputs all collapse to the app root.
function safeAppUrl(raw) {
  try {
    const u = new URL(raw || '/', self.location.origin);
    return u.origin === self.location.origin ? u.href : '/';
  } catch { return '/'; }
}
// Proper same-origin test (not a substring match: includes() would also match a client
// whose URL merely *contains* our origin in a query param).
function sameOrigin(u) {
  try { return new URL(u).origin === self.location.origin; } catch { return false; }
}

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
          if (sameOrigin(client.url)) {
            client.postMessage({ type: 'quick-reply', contactId: data.contactId, text: e.reply });
            return client.focus();
          }
        }
      }
      if (action === 'mark-read') {
        // Send mark-read to client
        for (const client of list) {
          if (sameOrigin(client.url)) {
            client.postMessage({ type: 'mark-read', contactId: data.contactId });
            return; // Don't focus — user wants to stay where they are
          }
        }
        return;
      }
      // Default: focus existing window or open new
      for (const client of list) {
        if (sameOrigin(client.url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(safeAppUrl(data.url));
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
