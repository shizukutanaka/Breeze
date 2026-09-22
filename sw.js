const VERSION = '3.6.1';
const CACHE = 'breeze-v' + VERSION;
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];
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
  // Only GET is cacheable. Let POST/PUT/DELETE/etc. go straight to the network:
  // Cache.put() throws a TypeError on a non-GET request, and a cached 200 must never
  // be allowed to satisfy a mutating request. Returning without respondWith() yields
  // the browser's default network handling.
  if (e.request.method !== 'GET') return;
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

// Cache a response only when it is a full, same-origin, OK response. Guards the pitfalls
// that would otherwise surface as unhandled rejections or mis-cached private content:
//   - 206 Partial Content (range requests) — note response.ok is TRUE for 206, so the
//     old `if (resp.ok)` check let it through and Cache.put() throws on a partial response.
//   - Cache-Control: no-store — server explicitly forbids caching (e.g. auth'd API response
//     that briefly passes through; caching it would serve stale private data to later visitors).
//   - QuotaExceededError when storage is full — the .catch() swallows it (the SWR/network
//     response is still returned to the page; only the cache write is skipped).
// Opaque (cross-origin no-cors, status 0) and CORS responses are skipped: we only persist
// our own app shell, never third-party bytes.
function cachePut(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  const cc = response.headers?.get('cache-control') || '';
  if (cc.includes('no-store')) return;
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
      actions: (navigator.language || '').startsWith('ja') ? [
        { action: 'reply', title: '返信', type: 'text' },
        { action: 'mark-read', title: '既読にする' },
      ] : [
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
        // C11: with no app window open there is no one to receive sync-outbox, so the
        // persisted outbox would sit in IDB until the next launch. Drain it here — the
        // queued payloads are already E2E-encrypted envelopes, so the worker needs no
        // keys; it re-POSTs them to the same endpoints the page would have used.
        if (all.length === 0) return drainOutbox();
      })
    );
  }
});

// Open an existing app DB without ever creating one: no version is passed, and if the
// open would trigger an upgrade (i.e. the DB does not exist yet — fresh device, never
// onboarded) the transaction is aborted, which discards the would-be empty database
// instead of leaving a store-less husk that would poison the page's own open() later.
function idbOpenExisting(name) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(name); } catch { resolve(null); return; }
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch {} };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => resolve(req.result);
  });
}

function idbGet(db, store, key) {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  });
}

function idbPut(db, store, key, val) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.objectStore(store).put(val, key);
    } catch { resolve(false); }
  });
}

async function drainOutbox() {
  // Multi-account: the first identity lives in 'breeze-messenger', extra accounts in
  // 'breeze-acc-*' (each has its own retryQueue). databases() is Chromium-only; where
  // it is absent we still drain the default DB, which covers single-account users.
  const names = ['breeze-messenger'];
  try {
    const dbs = await indexedDB.databases?.();
    if (dbs) for (const d of dbs) {
      if (d.name && d.name.startsWith('breeze-acc-') && !names.includes(d.name)) names.push(d.name);
    }
  } catch {}
  for (const name of names) {
    const db = await idbOpenExisting(name);
    if (!db) continue;
    try {
      const queue = await idbGet(db, 'settings', 'retryQueue');
      if (!Array.isArray(queue) || !queue.length) continue;
      const remaining = [];
      for (const item of queue) {
        if (!item || !item.to || !item.payload) continue;
        let sent = false;
        // Same order as the page: sealed sender first (metadata-hiding), then the
        // standard relay. Rate-limit/5xx responses keep the item for the next sync.
        try {
          const r = await fetch('/api/sealed/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: item.to, envelope: JSON.stringify(item.payload) }),
          });
          sent = r.ok;
        } catch {}
        if (!sent) {
          try {
            const r = await fetch('/api/msg/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload),
            });
            sent = r.ok;
          } catch {}
        }
        if (!sent && (item.attempts | 0) < 4) { item.attempts = (item.attempts | 0) + 1; remaining.push(item); }
        // Past the cap the item drops — a permanently-undeliverable envelope (bad `to`,
        // a recipient record that expired from relay TTL) otherwise retried on every
        // sync event forever, and the page-side dead-letter cap counts only ITS failures.
      }
      // Persist only the survivors (the page caps the queue at 50 — keep that bound).
      if (remaining.length !== queue.length) {
        await idbPut(db, 'settings', 'retryQueue', remaining.slice(0, 50));
      }
    } finally { db.close(); }
  }
}

// v3.6: SKIP_WAITING message from client → activate new SW immediately
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
