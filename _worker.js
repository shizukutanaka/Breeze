/**
 * Breeze Worker v3.6.0
 * 32 API endpoints. Cloudflare Pages Functions.
 *
 * KV schema:
 *   slots:{userId}     → { slots, plan, customerId, updatedAt }
 *   cust:{customerId}  → userId (reverse lookup)
 *   sig:{room}         → signal data (TTL)
 *   msg:{userId}:{ts}  → relay message (TTL)
 *   alias:{name}       → userId
 *   group:{id}         → group metadata
 *   prekey:{userId}    → signed + one-time prekeys
 *   push:{userId}      → push subscription
 *   backup:{userId}    → encrypted backup
 */

const MAX_BODY_BYTES = 524288; // 512KB max request body
const MAX_STRING_LEN = 10000; // Max string field length

function sanitizeString(val, maxLen = MAX_STRING_LEN) {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

function validateUserId(id) {
  return typeof id === 'string' && id.length >= 8 && id.length <= 512 && /^[A-Za-z0-9+/=_-]+$/.test(id);
}

// Defensive JSON.parse: returns fallback instead of throwing on corrupt KV data.
function safeJsonParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// v3.6: External API timeout wrapper (prevents Worker hanging on slow 3rd-party APIs)
async function fetchWithTimeout(url, opts, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('External API timeout (' + timeoutMs + 'ms)');
    throw e;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const reqId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const _startMs = Date.now();

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    // Static files → serve from Pages
    if (!path.startsWith('/api/')) {
      return env.ASSETS?.fetch(request) ?? new Response('Not found', { status: 404 });
    }

    // Health check — no auth, no rate limit
    if (path === '/api/health') {
      const kvOk = !!env.KV;
      const stripeOk = !!env.STRIPE_SECRET_KEY;
      // v3.6: Probabilistic cleanup — 10% of health checks clean stale signal data
      if (kvOk && Math.random() < 0.1) {
        try {
          const list = await env.KV.list({ prefix: 'sig:', limit: 20 });
          const now = Date.now();
          for (const key of list.keys) {
            if (key.expiration && key.expiration * 1000 < now) await kvDel(env, key.name);
          }
        } catch {}
      }
      return json({
        ok: kvOk,
        version: '3.6.0',
        protocol: 4,
        endpoints: 32,
        reqId,
        serverTime: Date.now(), // v3.6: Client can detect clock drift
        kv: kvOk,
        stripe: stripeOk,
        push: !!(env.VAPID_PUBLIC_KEY),
        turn: !!(env.TURN_URL),
        vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
        plans: stripeOk ? {
          lite: !!env.STRIPE_PRICE_LITE,
          plus: !!env.STRIPE_PRICE_PLUS,
          pro: !!env.STRIPE_PRICE_PRO,
        } : null,
        features: {
          billing: stripeOk,
          push: !!(env.VAPID_PUBLIC_KEY),
          turn: !!(env.TURN_URL),
          backup: kvOk,
          ai: !!(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GROQ_API_KEY),
          translate: !!(env.DEEPL_API_KEY || env.GOOGLE_TRANSLATE_KEY || env.TRANSLATE_URL),
        },
        crypto: ['X25519', 'Ed25519', 'AES-256-GCM', 'HKDF-SHA256', 'Double Ratchet', 'Sender Key O(1)'],
        ts: Date.now(),
        responseMs: Date.now() - _startMs,
      }, kvOk ? 200 : 503, request);
    }

    // Webhook needs raw body — handle before JSON parsing
    if (path === '/api/webhook' && request.method === 'POST') {
      try { return await handleWebhook(request, env); }
      catch { return new Response('Internal error', { status: 500 }); }
    }

    // All other API routes: POST only
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, request);
    }

    // Rate limit: per-IP + per-userId (dual layer)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env.KV) {
      const limits = {
        '/api/signal': 60,
        '/api/msg/send': 30,
        '/api/msg/poll': 40,
        '/api/sealed/send': 30,
        '/api/sealed/poll': 40,
        '/api/sealed/ack': 40,
        '/api/presence': 20,
        '/api/prekey/upload': 5,
        '/api/prekey/fetch': 10,
        '/api/backup/upload': 2,
        '/api/backup/download': 5,
        '/api/drop/create': 10,
        '/api/drop/read': 20,
        '/api/abuse/record': 30,
        '/api/abuse/report': 10,
        '/api/ogp': 20,
        '/api/account/purchase': 3,
        '/api/alias/set': 10,
        '/api/alias/get': 30,
        '/api/portal': 5,
        '/api/group/create': 5,
        '/api/group/join': 10,
        '/api/group/info': 20,
        '/api/group/kick': 5,
        '/api/push/subscribe': 5,
        '/api/turn': 10,
        '/api/account/slots': 20,
        '/api/online': 20,
        '/api/translate': 15,
        '/api/ai': 10,
      };
      const limit = limits[path] || 30;

      // v3.6: In-memory rate limiter (saves KV writes — critical for free tier)
      // KV free tier: 1000 writes/day. In-memory resets per isolate (~5min).
      // Trade-off: slightly less accurate across isolates, but saves 90%+ KV writes.
      const minute = Math.floor(Date.now() / 60000);
      const rlKey = `${ip}:${path}:${minute}`;
      // v3.6: In-memory counter on globalThis. Must use the globalThis.* form —
      // a bare `_rateLimitMap` reference throws ReferenceError under ESM strict mode
      // before the global is ever assigned, which 500s every request.
      const rlMap = (globalThis._rateLimitMap ||= new Map());
      // Opportunistic prune of stale minute buckets (bounded, avoids unreliable
      // setInterval timers in the Workers runtime).
      if (rlMap.size > 2000) {
        const cutoff = minute - 2;
        for (const k of rlMap.keys()) { if (parseInt(k.slice(k.lastIndexOf(':') + 1)) < cutoff) rlMap.delete(k); }
      }
      const rlCount = rlMap.get(rlKey) || 0;
      if (rlCount >= limit) {
        const retryAfter = 60 - (Date.now() / 1000 % 60) | 0;
        return new Response(JSON.stringify({ error: 'Rate limited', code: 'RATE_LIMITED', retryAfter }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter || 60), 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': '0', ...corsHeaders(request) },
        });
      }
      rlMap.set(rlKey, rlCount + 1);
    }

    // Reject oversized requests. Fast-path: check Content-Length header early to avoid
    // reading a large body. Belt-and-suspenders: also check actual body size after reading
    // (Content-Length can be omitted or spoofed to bypass the header-only check).
    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: 'Request too large', code: 'BODY_TOO_LARGE', max: MAX_BODY_BYTES }, 413, request);
    }
    let bodyText;
    try { bodyText = await request.text(); } catch { return json({ error: 'Invalid body', code: 'INVALID_BODY' }, 400, request); }
    if (bodyText.length > MAX_BODY_BYTES) {
      return json({ error: 'Request too large', code: 'BODY_TOO_LARGE', max: MAX_BODY_BYTES }, 413, request);
    }

    let body;
    try { body = JSON.parse(bodyText); } catch { return json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, 400, request); }

    // The body must be a JSON object. Literal `null` is valid JSON but throws on
    // `body.userId` below (→ 500); primitives (numbers/strings/arrays) would flow
    // into handlers as non-objects. Reject all of them with a clean 400.
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Body must be a JSON object', code: 'INVALID_BODY' }, 400, request);
    }

    // Validate userId if present (business-grade: reject malformed early)
    if (body.userId && !validateUserId(body.userId)) {
      return json({ error: 'Invalid userId format', code: 'INVALID_USER_ID' }, 400, request);
    }

    // v3.6: Request timestamp validation (anti-replay, 5-minute window)
    if (body.ts && typeof body.ts === 'number') {
      const drift = Math.abs(Date.now() - body.ts);
      if (drift > 300000) { // 5 minutes
        return json({ error: 'Request expired', code: 'TIMESTAMP_EXPIRED' }, 400, request);
      }
    }

    // Input validation — prevent KV abuse + injection
    for (const key of ['id', 'room', 'sender', 'type', 'userId', 'to', 'from', 'alias', 'token', 'frankId', 'kickId', 'adminId', 'creatorId', 'memberId']) {
      if (body[key] && typeof body[key] === 'string' && body[key].length > 128) {
        return json({ error: key + ' too long (max 128)' }, 400, request);
      }
      // Block control characters in identifiers
      if (body[key] && typeof body[key] === 'string' && /[\x00-\x1f]/.test(body[key])) {
        return json({ error: key + ' contains invalid characters' }, 400, request);
      }
    }
    if (body.data && typeof body.data === 'string' && body.data.length > 65536) {
      return json({ error: 'data too long (max 64KB)' }, 400, request);
    }
    // Payload size limit (encrypted messages)
    if (body.payload && typeof body.payload === 'string' && body.payload.length > 512 * 1024) {
      return json({ error: 'payload too large (max 512KB)' }, 400, request);
    }
    // Envelope size limit (sealed sender)
    if (body.envelope && typeof body.envelope === 'string' && body.envelope.length > 512 * 1024) {
      return json({ error: 'envelope too large (max 512KB)' }, 400, request);
    }

    try {
      if (!env.KV) {
        return json({ error: 'Storage not configured. Bind a KV namespace named "KV" in Pages settings.' }, 503, request);
      }
      switch (path) {
        case '/api/signal':    return await handleSignal(body, ip, env, request);
        case '/api/msg/send':  return await handleMsgSend(body, ip, env, request);
        case '/api/msg/poll':  return await handleMsgPoll(body, env, request);
        case '/api/presence':  return await handlePresence(body, env, request);
        case '/api/alias/set': return await handleAliasSet(body, env, request);
        case '/api/alias/get': return await handleAliasGet(body, env, request);
        
        case '/api/portal':    return await handlePortal(body, env, request);
        case '/api/group/create': return await handleGroupCreate(body, env, request);
        case '/api/group/join':   return await handleGroupJoin(body, env, request);
        case '/api/group/info':   return await handleGroupInfo(body, env, request);
        case '/api/push/subscribe': return await handlePushSubscribe(body, env, request);
        case '/api/turn':           return await handleTurn(body, env, request);
        case '/api/ogp':            return await handleOGP(body, env, request);
        case '/api/account/purchase': return await handleAccountPurchase(body, env, request);
        case '/api/account/slots':    return await handleAccountSlots(body, env, request);
        case '/api/prekey/upload':    return await handlePreKeyUpload(body, env, request);
        case '/api/prekey/fetch':     return await handlePreKeyFetch(body, env, request);
        case '/api/online':           return await handleOnlineCount(body, env, request);
        case '/api/sealed/send':      return await handleSealedSend(body, env, request);
        case '/api/sealed/poll':      return await handleSealedPoll(body, env, request);
        case '/api/sealed/ack':       return await handleSealedAck(body, env, request);
        case '/api/backup/upload':    return await handleBackupUpload(body, env, request);
        case '/api/backup/download':  return await handleBackupDownload(body, env, request);
        case '/api/group/kick':       return await handleGroupKick(body, env, request);
        case '/api/translate':        return await handleTranslate(body, env, request);
        case '/api/ai':               return await handleAI(body, env, request);
        case '/api/drop/create':      return await handleDropCreate(body, env, request);
        case '/api/drop/read':        return await handleDropRead(body, env, request);
        case '/api/abuse/record':     return await handleAbuseRecord(body, env, request);
        case '/api/abuse/report':     return await handleAbuseReport(body, env, request);
        default:            return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request, reqId);
      }
    } catch (e) {
      return json({ error: 'Server error', rid: reqId }, 500, request, reqId);
    }
  }
};

// ============================================================
// SIGNAL — WebRTC signaling (join/offer/answer/ICE)
// Ephemeral: all signaling data has 60s TTL.
// After P2P connects, signaling is no longer needed.
// ============================================================

async function handleSignal(body, ip, env, request) {
  const room = sanitizeString(body.room, 256);
  const sender = sanitizeString(body.sender, 512);
  const type = sanitizeString(body.type, 32);
  const data = body.data; // Opaque encrypted payload — don't sanitize
  if (!room || !sender || !type) return json({ error: 'room, sender, type required', code: 'MISSING_FIELDS' }, 400, request);
  if (data !== undefined && (typeof data !== 'string' || data.length > 64 * 1024)) return json({ error: 'data too large (max 64KB)', code: 'PAYLOAD_TOO_LARGE' }, 400, request);

  if (type === 'poll') {
    // Return all signaling messages for this room (excluding own)
    const raw = await kvGet(env, `sig:${room}`);
    if (!raw) return json({ messages: [] }, 200, request);
    const signals = safeJsonParse(raw, []);
    if (!Array.isArray(signals)) return json({ messages: [] }, 200, request);
    const filtered = signals.filter(s => s.sender !== sender);
    // v3.6: Clean consumed signals — keep only unread ones + those <30s old
    const now = Date.now();
    const remaining = signals.filter(s => s.sender === sender || (now - s.ts) < 30000);
    if (remaining.length < signals.length) {
      if (remaining.length > 0) await kvPut(env, `sig:${room}`, JSON.stringify(remaining), { expirationTtl: 300 });
      else await kvDel(env, `sig:${room}`);
    }
    return json({ messages: filtered }, 200, request);
  }

  // Store signaling message
  const raw = await kvGet(env, `sig:${room}`);
  const parsed = safeJsonParse(raw, []);
  const signals = Array.isArray(parsed) ? parsed : [];
  signals.push({ sender, type, data, ts: Date.now() });
  // Keep last 50 signals, expire in 5 min (allow slow NAT traversal)
  const trimmed = signals.slice(-50);
  await kvPut(env, `sig:${room}`, JSON.stringify(trimmed), { expirationTtl: 300 });

  return json({ ok: true }, 200, request);
}

// ============================================================
// MESSENGER — 1:1 encrypted message relay + presence
// Messages are E2E encrypted (ECDH). Server stores only ciphertext.
// Recipient polls and retrieves. Messages deleted after delivery.
// ============================================================

async function handleMsgSend(body, ip, env, request) {
  const { to, from, fromPub, fromName, payload, ts, isFile, isGroupInvite, isVoice, isCall, isVideoCall, isSenderKey, isGroupSK, groupId, groupName, replyTo, disappearAt, sig, sigPub } = body;
  if (!to || !from || !payload) return json({ error: 'to, from, payload required', code: 'MISSING_FIELDS' }, 400, request);
  // v3.3: Input type validation
  if (typeof to !== 'string' || typeof from !== 'string' || typeof payload !== 'string') return json({ error: 'Invalid types', code: 'INVALID_TYPE' }, 400, request);
  if (!validateUserId(to) || !validateUserId(from)) return json({ error: 'invalid userId format', code: 'INVALID_USER_ID' }, 400, request);
  if (to === from && !body.type) return json({ error: 'Cannot send to self', code: 'SELF_SEND' }, 400, request);
  if (payload.length > 256 * 1024) return json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, 400, request);

  // v3.5: Replay protection — reject messages with timestamps outside ±5 min window.
  // A non-numeric ts (string/object) makes Math.abs(now - ts) === NaN, which is never
  // > 300000 — silently bypassing this guard AND poisoning the stored msg.ts below,
  // which breaks the numeric poll-cursor comparison in handleMsgPoll. Reject a
  // non-numeric ts outright; an absent ts defaults to now.
  const now = Date.now();
  if (ts !== undefined && (typeof ts !== 'number' || !Number.isFinite(ts))) return json({ error: 'Invalid timestamp', code: 'INVALID_TIMESTAMP' }, 400, request);
  const msgTs = ts || now;
  if (Math.abs(now - msgTs) > 300000) return json({ error: 'Timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);

  // v3.6: In-memory dedup (saves 1 KV write per message — critical for free tier)
  // Trade-off: duplicate detection is per-isolate (~5min window), not global.
  // Client-side _replayCache provides secondary dedup layer.
  if (!globalThis._msgDedup) globalThis._msgDedup = new Map();
  // Dedup on payload content, not a time bucket: a time-bucket key collapsed two
  // *distinct* messages sent to the same recipient within 10s into one and silently
  // dropped the second. Ciphertext is unique per message but identical across a
  // client retransmission, so content-keyed dedup still catches genuine duplicates.
  const dedupKey = `${to}:${payload.length}:${payload.slice(0, 64)}`;
  if (globalThis._msgDedup.has(dedupKey)) return json({ ok: true, dedup: true }, 200, request);
  globalThis._msgDedup.set(dedupKey, 1);
  // Prune old entries every 100 messages
  if (globalThis._msgDedup.size > 500) {
    const entries = [...globalThis._msgDedup.entries()];
    globalThis._msgDedup = new Map(entries.slice(-200));
  }

  const key = `inbox:${to}`;
  const existing = await kvGet(env, key);
  const inboxParsed = existing ? safeJsonParse(existing, []) : [];
  const inbox = Array.isArray(inboxParsed) ? inboxParsed : [];
  const safePub  = typeof fromPub  === 'string' ? fromPub.slice(0, 200)  : undefined;
  const safeName = typeof fromName === 'string' ? fromName.slice(0, 64)  : undefined;
  const msg = { from, fromPub: safePub, fromName: safeName, payload, ts: ts || Date.now() };
  if (isFile) msg.isFile = true;
  if (isGroupInvite) msg.isGroupInvite = true;
  if (isVoice) msg.isVoice = true;
  if (isCall) msg.isCall = true;
  if (isVideoCall) msg.isVideoCall = true;
  if (isSenderKey) msg.isSenderKey = true;
  if (isGroupSK) msg.isGroupSK = true;
  if (groupId) { msg.groupId = String(groupId).slice(0, 64); msg.groupName = typeof groupName === 'string' ? groupName.slice(0, 50) : undefined; }
  if (replyTo) msg.replyTo = String(replyTo).slice(0, 128);
  if (disappearAt) msg.disappearAt = typeof disappearAt === 'number' ? disappearAt : undefined;
  if (sig) msg.sig = typeof sig === 'string' ? sig.slice(0, 200) : undefined;
  if (sigPub) msg.sigPub = typeof sigPub === 'string' ? sigPub.slice(0, 200) : undefined;
  inbox.push(msg);
  const trimmed = inbox.slice(-100);
  await kvPut(env, key, JSON.stringify(trimmed), { expirationTtl: 604800 });

  // Trigger Web Push notification (non-blocking)
  // Cap push title to match the stored msg.groupName limit (50 chars) — prevents
  // an oversized raw groupName from bloating the encrypted Web Push payload past
  // the RFC 8030 4096-byte per-message limit and causing silent delivery failures.
  const rawTitle = groupName ? String(groupName).slice(0, 50) : (fromName || 'Breeze');
  const pushTitle = sanitizeString(rawTitle, 50);
  const pushBody = isCall ? (isVideoCall ? 'Video call' : 'Voice call') : isFile ? '📎 File' : isVoice ? '🎤 Voice' : 'New message';
  sendPushToUser(to, { title: pushTitle, body: pushBody, tag: 'breeze-' + (groupId || from), contactId: from }, env).catch(() => {});

  return json({ ok: true, ack: Date.now() }, 200, request);
}

async function handleMsgPoll(body, env, request) {
  const { id, lastTs } = body;
  if (!id) return json({ error: 'id required', code: 'MISSING_ID' }, 400, request);
  if (!validateUserId(id)) return json({ error: 'invalid id', code: 'INVALID_ID' }, 400, request);

  const key = `inbox:${id}`;
  const data = await kvGet(env, key);
  if (!data) return json({ messages: [] }, 200, request);

  const all = safeJsonParse(data, []);
  if (!Array.isArray(all)) return json({ messages: [] }, 200, request);
  // P4 FIX: Return only messages newer than lastTs, keep rest for other tabs.
  // Coerce a non-numeric lastTs to 0: a string cursor makes every `m.ts > cutoff`
  // comparison NaN→false, which both starves the poller AND (via the same cutoff in
  // the cleanup filter below) deletes still-undelivered messages older than 10s.
  const cutoff = (typeof lastTs === 'number' && Number.isFinite(lastTs)) ? lastTs : 0;
  const newMsgs = all.filter(m => (m.ts || 0) > cutoff);
  // Remove delivered messages older than 10 seconds (grace period for multi-tab)
  const keep = all.filter(m => (m.ts || 0) > cutoff || (Date.now() - (m.ts || 0)) < 10000);
  if (keep.length < all.length) {
    if (keep.length === 0) await kvDel(env, key);
    else await kvPut(env, key, JSON.stringify(keep), { expirationTtl: 604800 });
  }

  return json({ messages: newMsgs }, 200, request);
}

async function handlePresence(body, env, request) {
  const { id, ids, pub, name, check: isCheck } = body;

  // Batch check: { ids: ['abc','def'], check: true }
  if (isCheck && ids && Array.isArray(ids)) {
    const online = {};
    for (const cid of ids.slice(0, 50).filter(x => typeof x === 'string' && validateUserId(x))) {
      const data = await kvGet(env, `presence:${cid}`);
      if (data) {
        const p = safeJsonParse(data);
        online[cid] = p ? (Date.now() - p.at) < 60000 : false;
      } else {
        online[cid] = false;
      }
    }
    return json({ online }, 200, request);
  }

  if (!id) return json({ error: 'id required', code: 'MISSING_ID' }, 400, request);
  if (!validateUserId(id)) return json({ error: 'invalid id', code: 'INVALID_USER_ID' }, 400, request);

  if (isCheck) {
    // v3.6: Check in-memory cache first (same isolate = instant, no KV read)
    if (!globalThis._presenceCache) globalThis._presenceCache = new Map();
    const memData = globalThis._presenceCache.get(`presence:${id}:data`);
    if (memData) {
      const p = safeJsonParse(memData);
      if (!p) return json({ online: false }, 200, request);
      return json({ online: (Date.now() - p.at) < 60000, name: p.name }, 200, request);
    }
    const data = await kvGet(env, `presence:${id}`);
    if (!data) return json({ online: false }, 200, request);
    const p = safeJsonParse(data);
    if (!p) return json({ online: false }, 200, request);
    return json({ online: (Date.now() - p.at) < 60000, name: p.name }, 200, request);
  }

  // Store presence heartbeat
  // v3.6: In-memory presence cache — only writes to KV every 5 minutes (saves ~90% KV writes)
  // Free tier: 1000 writes/day. 30s heartbeat = 2880/day per user = over limit!
  // 5min write interval = 288/day per user = safe for 3 users on free tier
  if (!globalThis._presenceCache) globalThis._presenceCache = new Map();
  // Cap: prune to 1000 most-recently-inserted entries when the map exceeds 2000.
  // Each unique user adds 2 entries (timer + data); 2000 / 2 = 1000 distinct users.
  // Cloudflare isolates are ephemeral but can serve many unique users before restart.
  if (globalThis._presenceCache.size > 2000) {
    const entries = [...globalThis._presenceCache.entries()];
    globalThis._presenceCache = new Map(entries.slice(-1000));
  }
  const presKey = `presence:${id}`;
  const lastWrite = globalThis._presenceCache.get(presKey) || 0;
  // Cap pub to 200 chars (a base64 X25519/P-256 key is ≤88 chars; large values are abuse).
  const safePub = typeof pub === 'string' ? pub.slice(0, 200) : undefined;
  const presData = { pub: safePub, name: sanitizeString(name, 64), at: Date.now() };
  if (Date.now() - lastWrite > 300000) { // Only write to KV every 5 min
    await kvPut(env, presKey, JSON.stringify(presData), { expirationTtl: 360 }); // 6min TTL (covers 5min interval + slack)
    globalThis._presenceCache.set(presKey, Date.now());
  }
  // Always update in-memory for fast reads within same isolate
  globalThis._presenceCache.set(presKey + ':data', JSON.stringify(presData));
  // v3.6: In-memory online counter (saves 1 KV read + 1 KV write per heartbeat)
  if (!globalThis._onlineCounter) globalThis._onlineCounter = { minute: 0, count: 0 };
  const currentMinute = Math.floor(Date.now() / 60000);
  if (globalThis._onlineCounter.minute !== currentMinute) { globalThis._onlineCounter = { minute: currentMinute, count: 0 }; }
  globalThis._onlineCounter.count++;
  return json({ ok: true }, 200, request);
}

// v3.3: Online user count (approximate)
async function handleOnlineCount(body, env, request) {
  // v3.6: In-memory counter (no KV read needed)
  if (!globalThis._onlineCounter) globalThis._onlineCounter = { minute: 0, count: 0 };
  const minuteKey = Math.floor(Date.now() / 60000);
  const count = (globalThis._onlineCounter.minute === minuteKey) ? globalThis._onlineCounter.count : 0;
  return json({ online: count, ts: Date.now() }, 200, request);
}

// ============================================================
// ALIAS — Short Breeze IDs (e.g. @alice → pubkey)
// ============================================================

async function handleAliasSet(body, env, request) {
  const { alias, pub, name, pow } = body;
  if (!alias || !pub) return json({ error: 'alias and pub required', code: 'MISSING_FIELDS' }, 400, request);
  // alias must be a string — a numeric/array alias is truthy, passes the global
  // string-only guard, and would throw on .toLowerCase() below (→ 500).
  if (typeof alias !== 'string') return json({ error: 'alias must be a string', code: 'INVALID_FIELD' }, 400, request);

  // v3.5 SPEC: Proof-of-Work anti-spam verification.
  // Previously this only checked that the fields existed — the puzzle was never
  // verified, so any {nonce, hash} object passed and the anti-spam was a no-op.
  // Re-derive SHA-256(challenge:nonce) and require the top `difficulty` bits to be
  // zero (matches the client's generatePoW: first32 < 2^(32-difficulty)). The
  // challenge must embed this identity key so a solved token can't be replayed for
  // a different pubkey.
  // Cap pub size: P-256 JWK is ≤~300 chars, X25519 raw base64url is 44 chars.
  if (typeof pub !== 'string' || pub.length > 2000) return json({ error: 'pub too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (!pow || typeof pow.nonce !== 'number' || typeof pow.challenge !== 'string') {
    return json({ error: 'Proof-of-work token required', code: 'POW_REQUIRED' }, 400, request);
  }
  {
    const difficulty = Math.min(Math.max(parseInt(pow.difficulty) || 0, 0), 32);
    if (difficulty < 16 || pow.challenge.length > 512 || !pow.challenge.includes(pub)) {
      return json({ error: 'Invalid proof-of-work', code: 'POW_INVALID' }, 400, request);
    }
    // Freshness check: makeChallengeString embeds a Unix-ms timestamp as the last
    // colon-delimited segment. If parseable + older than 10 min → expired.
    // Old-format challenges (e.g. "pubkey:breeze-test") have a non-numeric last
    // segment so parseInt returns NaN and Number.isFinite skips the check —
    // backward-compatible with pre-timestamp clients.
    const MAX_POW_AGE_MS = 10 * 60 * 1000;
    const parts = pow.challenge.split(':');
    const challengeTs = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(challengeTs) && Date.now() - challengeTs > MAX_POW_AGE_MS) {
      return json({ error: 'Proof-of-work expired', code: 'POW_EXPIRED' }, 400, request);
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pow.challenge + ':' + pow.nonce));
    const first32 = new DataView(digest).getUint32(0, false);
    const target = Math.pow(2, 32 - difficulty) >>> 0;
    if (first32 >= target) {
      return json({ error: 'Invalid proof-of-work', code: 'POW_INVALID' }, 400, request);
    }
  }

  // Validate alias: 3-20 chars, a-z0-9_
  const clean = alias.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.length < 3 || clean.length > 20) return json({ error: 'Alias must be 3-20 chars (a-z, 0-9, _)' }, 400, request);

  // Check if taken
  const existing = await kvGet(env, `alias:${clean}`);
  if (existing) {
    const data = safeJsonParse(existing);
    if (data && data.pub !== pub) return json({ error: 'Alias already taken', code: 'ALIAS_TAKEN' }, 409, request);
  }

  // Store (no TTL — aliases are permanent)
  await kvPut(env, `alias:${clean}`, JSON.stringify({ pub, name: sanitizeString(name, 64), setAt: Date.now() }));
  return json({ ok: true, alias: clean }, 200, request);
}

async function handleAliasGet(body, env, request) {
  const { alias } = body;
  if (!alias) return json({ error: 'alias required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof alias !== 'string') return json({ error: 'alias must be a string', code: 'INVALID_FIELD' }, 400, request);

  const clean = alias.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const data = await kvGet(env, `alias:${clean}`);
  if (!data) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);

  const aliasData = safeJsonParse(data);
  if (!aliasData) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);
  return json(aliasData, 200, request);
}

async function handleWebhook(request, env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Not configured', { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  const verified = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) return new Response('Invalid signature', { status: 400 });

  let event;
  try { event = JSON.parse(body); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  // P1 FIX: Idempotency — check if we've already processed this event.
  // Mark *after* processing (process-then-mark): slot assignment is an idempotent
  // absolute write, so a Stripe retry after a mid-handler failure safely re-runs
  // instead of being swallowed as "already processed" with slots never granted.
  const eventKey = `evt:${event.id}`;
  if (await kvGet(env, eventKey)) {
    return new Response('Already processed', { status: 200 });
  }

  // --- checkout.session.completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.client_reference_id;
    const customerId = session.customer;

    // validateUserId: userId originates from Stripe checkout metadata (client-supplied).
    // Invalid IDs are silently ignored — failing would cause Stripe retries for an
    // unparseable event, which is worse than a no-op.
    if (userId && validateUserId(userId) && session.metadata?.type === 'account_plan') {
      // Plan-based slot assignment: Lite=2, Plus=4, Pro=999
      const planSlots = parseInt(session.metadata.slots || '2');
      await kvPut(env, `slots:${userId}`, JSON.stringify({ slots: planSlots, plan: session.metadata.plan || 'lite', customerId, updatedAt: Date.now() }));
      if (customerId) await kvPut(env, `cust:${customerId}`, userId);
    }
  }

  // --- subscription deleted / paused ---
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
    const sub = event.data.object;
    let userId = sub.metadata?.userId;
    if (!userId && sub.customer) {
      userId = await kvGet(env, `cust:${sub.customer}`);
    }
    // Re-validate after KV retrieval: the stored value could be stale pre-validation data.
    if (userId && validateUserId(userId)) {
      // Reset to free tier (1 account)
      await kvPut(env, `slots:${userId}`, JSON.stringify({ slots: 1, plan: 'free', updatedAt: Date.now() }));
    }
  }

  // --- invoice.payment_failed (grace period — Stripe handles cancellation) ---
  if (event.type === 'invoice.payment_failed') {
    // No slot change — Stripe will fire subscription.deleted after grace period
  }

  // --- invoice.paid (renewal confirmation) ---
  if (event.type === 'invoice.paid') {
    // Slots already set — no action needed
  }

  // --- customer.subscription.updated (plan upgrade/downgrade) ---
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object;
    let userId = sub.metadata?.userId;
    if (!userId && sub.customer) userId = await kvGet(env, `cust:${sub.customer}`);
    if (userId && validateUserId(userId) && sub.metadata?.slots) {
      const newSlots = parseInt(sub.metadata.slots);
      await kvPut(env, `slots:${userId}`, JSON.stringify({
        slots: newSlots, plan: sub.metadata.plan || 'lite',
        customerId: sub.customer, updatedAt: Date.now()
      }));
    }
  }

  // Mark processed only after handlers above have run (24h dedup window).
  await kvPut(env, eventKey, '1', { expirationTtl: 86400 });
  return new Response('ok', { status: 200 });
}

async function handlePortal(body, env, request) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Billing not configured', code: 'NOT_CONFIGURED' }, 503, request);

  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);

  // Get customerId from slots data or reverse lookup
  const data = await kvGet(env, `slots:${userId}`);
  let customerId = null;
  if (data) {
    const parsed = safeJsonParse(data);
    customerId = parsed?.customerId ?? null;
  }
  if (!customerId) return json({ error: 'No subscription found', code: 'NOT_FOUND' }, 404, request);

  const origin = request.headers.get('Origin') || request.headers.get('Referer')?.replace(/\/[^/]*$/, '') || '';

  const params = new URLSearchParams();
  params.set('customer', customerId);
  params.set('return_url', origin + '/');

  const resp = await fetchWithTimeout('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!resp.ok) return json({ error: 'Portal creation failed', code: 'PORTAL_FAILED' }, 500, request);
  const portal = await resp.json();
  return json({ url: portal.url }, 200, request);
}

// Stripe webhook signature verification (HMAC-SHA256)
async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  try {
    const parts = Object.fromEntries(header.split(',').map(p => { const [k,v] = p.split('='); return [k.trim(), v]; }));
    const timestamp = parts.t;
    const sig = parts.v1;
    if (!timestamp || !sig) return false;

    // Reject if timestamp is too old (5 min tolerance)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const signedPayload = timestamp + '.' + payload;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison via double-HMAC (prevents timing attacks)
    const cmpKey = await crypto.subtle.importKey('raw', crypto.getRandomValues(new Uint8Array(32)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const hmac1 = new Uint8Array(await crypto.subtle.sign('HMAC', cmpKey, new TextEncoder().encode(expected)));
    const hmac2 = new Uint8Array(await crypto.subtle.sign('HMAC', cmpKey, new TextEncoder().encode(sig)));
    if (hmac1.length !== hmac2.length) return false;
    let diff = 0;
    for (let i = 0; i < hmac1.length; i++) diff |= hmac1[i] ^ hmac2[i];
    return diff === 0;
  } catch { return false; }
}

// ============================================================
// GROUP INVITE LINKS — solve the migration deadlock
//
// Flow:
//   1. Creator POST /api/group/create → {token, joinUrl}
//   2. Creator shares joinUrl in LINE/WhatsApp
//   3. New user opens ?join=token → creates identity → POST /api/group/join
//   4. Worker adds member to group registry in KV
//   5. Client polls /api/group/info to discover new members
//
// KV schema:
//   grp:{token} = { name, creatorId, creatorPub, creatorName, members:[{id,pub,name}], createdAt }
// ============================================================

async function handleGroupCreate(body, env, request) {
  const { name: rawName, creatorId, creatorPub: rawCreatorPub, creatorName: rawCreatorName, members, ttl } = body;
  const name = sanitizeString(rawName, 50);
  const creatorName = sanitizeString(rawCreatorName, 64);
  // Cap public keys at 200 chars (X25519/P-256 base64 is ≤88 chars; large values are abuse).
  const creatorPub = typeof rawCreatorPub === 'string' ? rawCreatorPub.slice(0, 200) : rawCreatorPub;
  if (!name || !creatorId || !creatorPub) return json({ error: 'name, creatorId, creatorPub required' }, 400, request);
  if (!validateUserId(creatorId)) return json({ error: 'invalid creatorId', code: 'INVALID_USER_ID' }, 400, request);
  // v3.1: Validate name length
  if (name.length > 50) return json({ error: 'Group name max 50 chars' }, 400, request);
  // v3.1: Validate initial member count
  if (members && members.length > 100) return json({ error: 'Max 100 members' }, 400, request);

  // Generate short invite token
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map(b => b.toString(36)).join('').slice(0, 12);

  const group = {
    name: name.slice(0, 50),
    creatorId,
    creatorPub,
    creatorName: (creatorName || 'Creator').slice(0, 30),
    members: [{ id: creatorId, pub: creatorPub, name: (creatorName || 'Creator').slice(0, 30) }],
    epoch: 0, // I3: group sender-key epoch; bumped on kick so members rotate keys
    createdAt: Date.now(),
  };

  // Store with 30-day TTL (invite link expires)
  await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: 86400 * 30 });

  return json({ token, name: group.name, memberCount: 1 }, 201, request);
}

async function handleGroupJoin(body, env, request) {
  const { token, memberId, memberPub: rawMemberPub, memberName: rawMemberName } = body;
  const memberName = sanitizeString(rawMemberName, 64);
  const memberPub = typeof rawMemberPub === 'string' ? rawMemberPub.slice(0, 200) : rawMemberPub;
  if (!token || !memberId || !memberPub) return json({ error: 'token, memberId, memberPub required' }, 400, request);
  if (typeof token !== 'string' || token.length > 128) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(memberId)) return json({ error: 'invalid memberId', code: 'INVALID_USER_ID' }, 400, request);

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Invite link expired or invalid', code: 'EXPIRED' }, 404, request);

  const group = safeJsonParse(data);
  if (!group || !Array.isArray(group.members)) return json({ error: 'Invite link expired or invalid', code: 'EXPIRED' }, 404, request);

  // Check if already a member
  if (group.members.some(m => m.id === memberId)) {
    return json({ ok: true, name: group.name, members: group.members, alreadyMember: true }, 200, request);
  }

  // Max 50 members per group
  if (group.members.length >= 100) return json({ error: 'Group is full', code: 'GROUP_FULL' }, 400, request);

  // Add new member
  group.members.push({ id: memberId, pub: memberPub, name: (memberName || 'Member').slice(0, 30) });
  await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: 86400 * 30 });

  return json({ ok: true, name: group.name, members: group.members, epoch: group.epoch || 0 }, 200, request);
}

async function handleGroupInfo(body, env, request) {
  const { token } = body;
  if (!token) return json({ error: 'token required', code: 'MISSING_TOKEN' }, 400, request);
  if (typeof token !== 'string' || token.length > 128) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);

  const group = safeJsonParse(data);
  if (!group) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);
  return json({ name: group.name, members: group.members, creatorName: group.creatorName, epoch: group.epoch || 0, createdAt: group.createdAt }, 200, request);
}

// v3.3: Enterprise — Group member management
async function handleGroupKick(body, env, request) {
  const { token, kickId, adminId } = body;
  if (!token || !kickId || !adminId) return json({ error: 'token, kickId, adminId required' }, 400, request);
  if (typeof token !== 'string' || token.length > 128) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(kickId) || !validateUserId(adminId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);

  const group = safeJsonParse(data);
  if (!group) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  // Only creator can kick
  if (group.creatorId !== adminId) {
    return json({ error: 'Admin permission required', code: 'FORBIDDEN' }, 403, request);
  }
  // Cannot kick creator
  if (kickId === group.creatorId) return json({ error: 'Cannot kick group creator', code: 'FORBIDDEN' }, 400, request);
  // Kick target must actually be a member; bumping the epoch on a no-op is wasteful
  // and would cause unnecessary sender-key churn in remaining members.
  if (!(group.members || []).some(m => m.id === kickId)) {
    return json({ error: 'Member not found', code: 'NOT_MEMBER' }, 404, request);
  }

  group.members = group.members.filter(m => m.id !== kickId);
  if (group.admins) group.admins = group.admins.filter(id => id !== kickId);
  // I3: post-compromise removal. Bump the epoch so remaining members generate and
  // redistribute fresh sender keys (kicked member can't decrypt the new epoch).
  group.epoch = (group.epoch || 0) + 1;
  await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: 86400 * 30 });

  return json({ ok: true, remaining: group.members.length, epoch: group.epoch }, 200, request);
}

// ============================================================
// ============================================================
// WEB PUSH — RFC 8291 encrypted push + VAPID JWT signing (C12)
//
// Requires VAPID keys (generate: npx web-push generate-vapid-keys):
//   VAPID_PUBLIC_KEY  — uncompressed P-256 base64url (65 bytes), shared with client
//   VAPID_PRIVATE_KEY — raw P-256 scalar base64url (32 bytes), server-only
//
// push service only sees aes128gcm ciphertext; payload never exposed.
// ============================================================

// base64url ↔ bytes (VAPID keys and RFC 8291 subscription keys are base64url)
function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    s.length + (4 - s.length % 4) % 4, '='
  );
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
function bytesToB64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function concatBytes(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// RFC 8291 + RFC 8188: encrypt `plaintext` for a browser push subscription.
// Returns a Uint8Array in aes128gcm content-encoding format, or null if the
// subscription is missing keys (silently skipped by the caller).
async function encryptPushPayload(subtle, subscription, plaintext) {
  const { p256dh, auth } = (subscription.keys || {});
  if (!p256dh || !auth) return null;

  const clientPubRaw = b64urlToBytes(p256dh); // 65-byte uncompressed P-256 point
  const authSecret   = b64urlToBytes(auth);   // 16-byte auth secret

  // Ephemeral server key pair
  const serverKP     = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw = new Uint8Array(await subtle.exportKey('raw', serverKP.publicKey));

  // ECDH shared secret
  const clientPub  = await subtle.importKey('raw', clientPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: clientPub }, serverKP.privateKey, 256);

  // RFC 8291 §3.3: IKM = HKDF(salt=auth, IKM=ECDH, info="WebPush: info\0"+ua_pub+as_pub, 32)
  const keyinfo = concatBytes(
    new TextEncoder().encode('WebPush: info\x00'),
    clientPubRaw, serverPubRaw
  );
  const ikmKey  = await subtle.importKey('raw', new Uint8Array(sharedBits), 'HKDF', false, ['deriveBits']);
  const ikmBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyinfo },
    ikmKey, 256
  );

  // RFC 8188 §2: random salt → CEK (128-bit) + nonce (96-bit)
  const salt2   = crypto.getRandomValues(new Uint8Array(16));
  const ikm2Key = await subtle.importKey('raw', new Uint8Array(ikmBits), 'HKDF', false, ['deriveBits']);
  const cekBits   = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt2,
      info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00\x01') },
    ikm2Key, 128
  );
  const nonceBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt2,
      info: new TextEncoder().encode('Content-Encoding: nonce\x00\x01') },
    ikm2Key, 96
  );

  // Encrypt: plaintext + 0x02 delimiter (last-record marker per RFC 8188)
  const ptBytes = new TextEncoder().encode(typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext));
  const padded  = concatBytes(ptBytes, new Uint8Array([0x02]));
  const aesKey  = await subtle.importKey('raw', new Uint8Array(cekBits), 'AES-GCM', false, ['encrypt']);
  const ct      = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonceBits) }, aesKey, padded
  ));

  // RFC 8188 header: salt(16) + rs(4,BE) + idlen(1) + server_pub(65) + ciphertext
  // rs = full encrypted record size = plaintext + delimiter(1) + GCM tag(16)
  const rs      = ptBytes.length + 17;
  const rsField = new Uint8Array(4);
  new DataView(rsField.buffer).setUint32(0, rs, false);
  return concatBytes(salt2, rsField, new Uint8Array([65]), serverPubRaw, ct);
}

// Build a VAPID JWT for the push Authorization header.
// Returns the JWT token string (without "vapid " prefix).
async function buildVapidJwt(subtle, vapidPrivB64url, vapidPubB64url, endpoint) {
  const privBytes = b64urlToBytes(vapidPrivB64url); // 32 bytes
  const pubBytes  = b64urlToBytes(vapidPubB64url);  // 65 bytes: 0x04 + x(32) + y(32)
  const jwk = {
    kty: 'EC', crv: 'P-256',
    d: bytesToB64url(privBytes),
    x: bytesToB64url(pubBytes.slice(1, 33)),
    y: bytesToB64url(pubBytes.slice(33, 65)),
  };
  const signingKey = await subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const origin  = new URL(endpoint).origin;
  const header  = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 43200, // 12-hour token
    sub: 'mailto:vapid@breeze.chat',
  })));
  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const sigBytes = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, sigInput));
  return `${header}.${payload}.${bytesToB64url(sigBytes)}`;
}

async function handlePushSubscribe(body, env, request) {
  const { userId, subscription } = body;
  if (!userId || !subscription?.endpoint) return json({ error: 'userId and subscription required' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  // v3.6: Validate push endpoint URL (SSRF prevention)
  try {
    const epUrl = new URL(subscription.endpoint);
    if (epUrl.protocol !== 'https:') return json({ error: 'Push endpoint must be HTTPS' }, 400, request);
    // Only allow known push service domains
    const trusted = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'wns.windows.com', 'push.apple.com',
      'web.push.apple.com', 'push.services.mozilla.com', 'android.googleapis.com'];
    if (!trusted.some(d => epUrl.hostname === d || epUrl.hostname.endsWith('.' + d))) {
      return json({ error: 'Untrusted push endpoint' }, 400, request);
    }
  } catch { return json({ error: 'Invalid push endpoint URL' }, 400, request); }
  // Sanitize: only store the three fields needed for push delivery.
  // Storing the full client object would allow oversized extra fields to inflate KV.
  const safeSub = {
    endpoint: subscription.endpoint.slice(0, 512),
    keys: {
      p256dh: typeof subscription.keys?.p256dh === 'string' ? subscription.keys.p256dh.slice(0, 100) : '',
      auth:   typeof subscription.keys?.auth   === 'string' ? subscription.keys.auth.slice(0, 50)   : '',
    },
  };
  if (typeof subscription.expirationTime === 'number') safeSub.expirationTime = subscription.expirationTime;
  // Store subscription (user can have multiple devices)
  const key = `push:${userId}`;
  const existing = await kvGet(env, key);
  let subs = existing ? (safeJsonParse(existing, []) || []) : [];
  if (!Array.isArray(subs)) subs = [];
  // Deduplicate by endpoint
  subs = subs.filter(s => s.endpoint !== safeSub.endpoint);
  subs.push(safeSub);
  // Keep last 5 devices
  if (subs.length > 5) subs = subs.slice(-5);
  await kvPut(env, key, JSON.stringify(subs), { expirationTtl: 86400 * 30 });
  return json({ ok: true, devices: subs.length }, 200, request);
}

async function sendPushToUser(userId, payload, env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const key = `push:${userId}`;
  const data = await kvGet(env, key);
  if (!data) return;
  const subs = safeJsonParse(data, []);
  if (!Array.isArray(subs)) return;
  const plaintextStr = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      const [encrypted, jwt] = await Promise.all([
        encryptPushPayload(crypto.subtle, sub, plaintextStr),
        buildVapidJwt(crypto.subtle, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY, sub.endpoint),
      ]);
      if (!encrypted) continue; // subscription missing keys
      const resp = await fetchWithTimeout(sub.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
          'TTL': '86400',
        },
        body: encrypted,
      }, 5000);
      // Remove expired subscriptions
      if (resp.status === 410) {
        const remaining = subs.filter(s => s.endpoint !== sub.endpoint);
        await kvPut(env, key, JSON.stringify(remaining), { expirationTtl: 86400 * 30 });
      }
    } catch {}
  }
}

// ============================================================
// TURN — NAT traversal credentials (cost-optimized)
//
// Priority chain (cheapest first):
// A: Cloudflare Calls TURN (TURN_KEY_ID + TURN_KEY_API_TOKEN) — $0.05/GB
// B: Custom HMAC TURN (TURN_URL + TURN_SECRET) — self-hosted
// C: Static TURN (TURN_URL + TURN_USERNAME + TURN_CREDENTIAL) — any provider
// D: Free Open Relay (metered.ca) — 20GB/month, no config needed
//
// $0/month deployment: skip A/B/C → auto-falls to D (free)
// STUN: always free (Cloudflare + Google)
// ============================================================

async function handleTurn(body, env, request) {
  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);

  // ═══════════════════════════════════════════════════════
  // v3.6: Cost-optimized TURN credential chain
  // Priority: Free → Cheapest → Paid
  //
  // 1. Cloudflare Calls TURN (free with CF account, $0.05/GB standalone)
  // 2. Open Relay / metered.ca (free 20GB/month)
  // 3. Custom TURN (HMAC-based temp credentials)
  // 4. Static TURN (fallback)
  //
  // STUN is always free (Google, Cloudflare)
  // ═══════════════════════════════════════════════════════

  const iceServers = [
    // Free STUN servers (always included — zero cost)
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  // Option A: Cloudflare Calls TURN (recommended — $0.05/GB, global anycast)
  if (env.TURN_KEY_ID && env.TURN_KEY_API_TOKEN) {
    try {
      const ttl = 86400;
      const resp = await fetchWithTimeout('https://rtc.live.cloudflare.com/v1/turn/keys/' + env.TURN_KEY_ID + '/credentials/generate', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl }),
      }, 5000);
      if (resp.ok) {
        const data = await resp.json();
        if (data.iceServers) {
          return json({ iceServers: [...iceServers, ...data.iceServers], ttl, provider: 'cloudflare' }, 200, request);
        }
      }
    } catch(e) { /* fallthrough to next provider */ }
  }

  // Option B: Custom TURN (HMAC-based — Coturn, etc.)
  if (env.TURN_SECRET && env.TURN_URL) {
    const ttl = 86400;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = expiry + ':' + userId;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(env.TURN_SECRET), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(username));
    const credential = btoa(String.fromCharCode(...new Uint8Array(sig)));
    iceServers.push({ urls: env.TURN_URL, username, credential });
    return json({ iceServers, ttl, provider: 'custom' }, 200, request);
  }

  // Option C: Static credentials (metered.ca, twilio, etc.)
  if (env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    iceServers.push({ urls: env.TURN_URL, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
    return json({ iceServers, ttl: 86400, provider: 'static' }, 200, request);
  }

  // Option D: Free Open Relay (metered.ca — 20GB/month free, no config needed)
  iceServers.push(
    { urls: 'turn:a.relay.metered.ca:80', username: 'e8dd65b92f60fae75f5aefab', credential: 'uWdWNmkhvyqTEswO' },
    { urls: 'turn:a.relay.metered.ca:80?transport=tcp', username: 'e8dd65b92f60fae75f5aefab', credential: 'uWdWNmkhvyqTEswO' },
    { urls: 'turns:a.relay.metered.ca:443', username: 'e8dd65b92f60fae75f5aefab', credential: 'uWdWNmkhvyqTEswO' },
  );
  return json({ iceServers, ttl: 86400, provider: 'openrelay' }, 200, request);
}

// ============================================================
// OGP — Fetch link preview metadata (title, description, image)
// Server-side fetch to bypass CORS restrictions
// ============================================================

// ============================================================
// MULTI-ACCOUNT — Plan-based subscription
// Free=1, Lite($0.99)=2, Plus($5.99)=4, Pro($19.99)=unlimited
// ============================================================

async function handleAccountPurchase(body, env, request) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Billing not configured', code: 'NOT_CONFIGURED' }, 503, request);
  const { userId, plan } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);

  const priceMap = {
    lite: env.STRIPE_PRICE_LITE,
    plus: env.STRIPE_PRICE_PLUS,
    pro: env.STRIPE_PRICE_PRO,
  };
  const slotMap = { lite: 2, plus: 4, pro: 999 };
  const planKey = plan && priceMap[plan] ? plan : 'lite';
  const priceId = priceMap[planKey];

  if (!priceId) return json({ error: 'Price not configured for plan: ' + planKey }, 503, request);

  const origin = request.headers.get('Origin') || request.headers.get('Referer')?.replace(/\/[^/]*$/, '') || '';

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', origin + '/?billing=account-success');
  params.set('cancel_url', origin + '/?billing=cancel');
  params.set('client_reference_id', userId);
  params.set('metadata[userId]', userId);
  params.set('metadata[type]', 'account_plan');
  params.set('metadata[plan]', planKey);
  params.set('metadata[slots]', String(slotMap[planKey]));
  params.set('subscription_data[metadata][userId]', userId);
  params.set('subscription_data[metadata][type]', 'account_plan');
  params.set('subscription_data[metadata][plan]', planKey);
  params.set('subscription_data[metadata][slots]', String(slotMap[planKey]));

  const resp = await fetchWithTimeout('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!resp.ok) return json({ error: 'Checkout failed', code: 'CHECKOUT_FAILED' }, 500, request);
  const session = await resp.json();
  return json({ url: session.url }, 200, request);
}

async function handleAccountSlots(body, env, request) {
  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const data = await kvGet(env, `slots:${userId}`);
  if (!data) return json({ slots: 1, plan: 'free' }, 200, request);
  const parsed = safeJsonParse(data);
  if (!parsed) return json({ slots: 1, plan: 'free' }, 200, request);
  return json({ slots: parsed.slots || 1, plan: parsed.plan || 'free' }, 200, request);
}

// ============================================================
// PREKEY DISTRIBUTION (v3 — X3DH support)
//
// Clients upload SignedPreKey + OneTimePreKeys
// Other clients fetch PreKeyBundle for session initiation
// ============================================================

// I1/G2: decode base64 to bytes + verify an Ed25519 signature. Used to
// authenticate uploaded signed pre-keys so a malicious relay can't inject its own.
function b64ToBytes(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function verifyEd25519(edPubB64, msgB64, sigB64) {
  try {
    const pub = await crypto.subtle.importKey('raw', b64ToBytes(edPubB64), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, pub, b64ToBytes(sigB64), b64ToBytes(msgB64));
  } catch { return false; }
}

async function handlePreKeyUpload(body, env, request) {
  const { userId, identityKey, edIdentityKey, signedPreKey, signedPreKeySig, oneTimePreKeys, caps, x3dh } = body;
  if (!userId || !identityKey || !signedPreKey) return json({ error: 'userId, identityKey, signedPreKey required' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  // Size-guard public key fields. Valid keys are small (P-256 JWK ≤~300 chars,
  // X25519/Ed25519 raw base64 ≤88 chars). Cap here blocks KV inflation via a
  // single huge field bypassing the aggregate body limit.
  const _IK_MAX  = 5000; // generous: full P-256 JWK with all optional fields
  const _SIG_MAX = 500;  // Ed25519 key/sig base64 is ≤88 chars; 500 is very safe
  if (typeof identityKey === 'string' && identityKey.length > _IK_MAX)
    return json({ error: 'identityKey too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (typeof edIdentityKey === 'string' && edIdentityKey.length > _SIG_MAX)
    return json({ error: 'edIdentityKey too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (typeof signedPreKey === 'string' && signedPreKey.length > _IK_MAX)
    return json({ error: 'signedPreKey too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (typeof signedPreKeySig === 'string' && signedPreKeySig.length > _SIG_MAX)
    return json({ error: 'signedPreKeySig too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  // I1/G2: authenticated X3DH. If a signature + Ed25519 identity key are supplied,
  // verify the signature over the signed pre-key and REJECT if invalid. Unsigned
  // bundles are still accepted during the v4->v5 transition, but an invalid
  // signature is never stored (that would defeat the whole point).
  if (signedPreKeySig && edIdentityKey) {
    const ok = await verifyEd25519(edIdentityKey, signedPreKey, signedPreKeySig);
    if (!ok) return json({ error: 'Invalid signed pre-key signature', code: 'PREKEY_SIG_INVALID' }, 400, request);
  }
  const bundle = { identityKey, edIdentityKey, signedPreKey, signedPreKeySig, uploadedAt: Date.now() };
  // N3: persist capability set so the initiator can call parsePeerCaps(bundle) and
  // negotiate() to pick the right protocol path. Cap each string to 32 chars and the
  // array to 20 entries to prevent DoS; non-string entries are silently dropped.
  if (Array.isArray(caps)) {
    bundle.caps = caps.slice(0, 20)
      .filter(c => typeof c === 'string')
      .map(c => c.slice(0, 32));
  }
  // Legacy compat: preserve the x3dh field from advertise() so parsePeerCaps()'s
  // fallback path (bundle.x3dh === 'v5') works for transition-period clients that
  // don't yet understand the `caps` array. Only 'v4'/'v5' are meaningful; cap to 4.
  if (typeof x3dh === 'string') bundle.x3dh = x3dh.slice(0, 4);
  await kvPut(env, `prekey:${userId}`, JSON.stringify(bundle), { expirationTtl: 86400 * 30 });

  // I11/N5: append a SHA-256 digest of the identity key to a hash-chained audit log.
  // Each entry binds to the previous via c = SHA-256(prevC ‖ h), making the
  // append-only property detectable by clients (tamper-evident chain).
  try {
    const ikHash = btoa(String.fromCharCode(...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identityKey))
    )));
    const logKey = `ktlog:${userId}`;
    const existing = await kvGet(env, logKey);
    const logParsed = existing ? safeJsonParse(existing, []) : [];
    const log = Array.isArray(logParsed) ? logParsed : [];
    const latest = log[log.length - 1];
    if (!latest || latest.h !== ikHash) {
      // New IK (or first upload): compute chain hash and append.
      const prevC = latest?.c ?? null;
      const prevB = prevC ? Uint8Array.from(atob(prevC), c => c.charCodeAt(0)) : new Uint8Array(32);
      const hB    = Uint8Array.from(atob(ikHash), c => c.charCodeAt(0));
      const buf   = new Uint8Array(prevB.length + hB.length);
      buf.set(prevB, 0); buf.set(hB, prevB.length);
      const c = btoa(String.fromCharCode(...new Uint8Array(
        await crypto.subtle.digest('SHA-256', buf)
      )));
      log.push({ ts: Date.now(), h: ikHash, c });
    } else {
      // Same IK: just refresh the timestamp of the last entry.
      latest.ts = Date.now();
    }
    // Cap at 10 entries (enough to show a suspicious rollover history).
    const trimmed = log.slice(-10);
    await kvPut(env, logKey, JSON.stringify(trimmed), { expirationTtl: 86400 * 90 });
  } catch (e) { /* log failure is non-fatal */ }

  // Store one-time prekeys individually; cap each entry to prevent KV inflation.
  if (Array.isArray(oneTimePreKeys)) {
    for (let i = 0; i < Math.min(oneTimePreKeys.length, 100); i++) {
      const otpStr = JSON.stringify(oneTimePreKeys[i]);
      if (otpStr.length > 5000) continue; // silently skip oversized entries
      await kvPut(env, `prekey:otp:${userId}:${i}`, otpStr, { expirationTtl: 86400 * 30 });
    }
    // Store the capped count so the fetch loop doesn't iterate past the highest
    // possible stored index (avoids up to 100 wasted KV reads when length > 100).
    await kvPut(env, `prekey:otp:${userId}:count`, String(Math.min(oneTimePreKeys.length, 100)), { expirationTtl: 86400 * 30 });
  }
  return json({ ok: true }, 200, request);
}

async function handlePreKeyFetch(body, env, request) {
  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const data = await kvGet(env, `prekey:${userId}`);
  if (!data) return json({ error: 'No prekeys found', code: 'NOT_FOUND' }, 404, request);
  const bundle = safeJsonParse(data);
  if (!bundle) return json({ error: 'No prekeys found', code: 'NOT_FOUND' }, 404, request);
  // Consume one-time prekey (if available)
  const countStr = await kvGet(env, `prekey:otp:${userId}:count`);
  const count = parseInt(countStr || '0');
  let remainingOTP = count;
  if (count > 0) {
    for (let i = count - 1; i >= 0; i--) {
      const otp = await kvGet(env, `prekey:otp:${userId}:${i}`);
      if (otp) {
        const parsed = safeJsonParse(otp);
        // Only attach the OTP if it parsed cleanly; still consume and delete either way
        // so a corrupted entry doesn't permanently block the slot.
        if (parsed !== null) bundle.oneTimePreKey = parsed;
        await kvDel(env, `prekey:otp:${userId}:${i}`);
        await kvPut(env, `prekey:otp:${userId}:count`, String(i), { expirationTtl: 86400 * 30 });
        remainingOTP = i;
        break;
      }
    }
  }
  // Signal the owner to replenish one-time prekeys before they are exhausted.
  if (remainingOTP <= 5) bundle.replenishOTP = true;
  // I11: include key-history log so the initiator can detect unexpected IK rollovers.
  const ktLog = await kvGet(env, `ktlog:${userId}`);
  if (ktLog) {
    const parsedLog = safeJsonParse(ktLog);
    if (parsedLog !== null) bundle.keyHistory = parsedLog;
  }
  return json(bundle, 200, request);
}

// ============================================================
// MESSAGE FRANKING — verifiable abuse reporting (I17), no plaintext escrow.
//
// At send the sender computes Cf = HMAC(Kf, plaintext); the relay RECORDS Cf
// (keyed by a frankId) and the recipient receives Kf inside the E2E payload. To
// report, the recipient reveals (frankId, plaintext, Kf); the relay recomputes
// HMAC(Kf, plaintext) and checks it equals the recorded Cf. The relay never sees
// plaintext of un-reported messages.
// ============================================================
async function hmacVerifyFrank(commitmentB64, openingB64, message) {
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBytes(openingB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
    const expected = b64ToBytes(commitmentB64);
    if (mac.length !== expected.length) return false;
    let d = 0;
    for (let i = 0; i < mac.length; i++) d |= mac[i] ^ expected[i];
    return d === 0;
  } catch { return false; }
}

// Sender/relay records the franking commitment at send time.
async function handleAbuseRecord(body, env, request) {
  const { frankId, commitment } = body;
  if (!frankId || !commitment) return json({ error: 'frankId and commitment required' }, 400, request);
  if (typeof frankId !== 'string' || frankId.length > 128) return json({ error: 'invalid frankId' }, 400, request);
  if (typeof commitment !== 'string' || commitment.length > 128) return json({ error: 'invalid commitment' }, 400, request);
  // Do not overwrite an existing commitment (a frankId binds one message).
  if (await kvGet(env, `frank:${frankId}`)) return json({ ok: true, existing: true }, 200, request);
  await kvPut(env, `frank:${frankId}`, commitment, { expirationTtl: 86400 * 30 });
  return json({ ok: true }, 200, request);
}

// Recipient reports an abusive message by revealing (frankId, message, opening).
async function handleAbuseReport(body, env, request) {
  const { frankId, message, opening } = body;
  if (!frankId || typeof message !== 'string' || !opening) return json({ error: 'frankId, message, opening required' }, 400, request);
  if (typeof frankId !== 'string' || frankId.length > 128) return json({ error: 'invalid frankId' }, 400, request);
  if (message.length > 256 * 1024) return json({ error: 'message too large', code: 'MSG_TOO_LARGE' }, 400, request);
  // HMAC opening key is 32 bytes (base64 = 44 chars); 128 chars is generous.
  if (typeof opening !== 'string' || opening.length > 128) return json({ error: 'invalid opening', code: 'INVALID_OPENING' }, 400, request);
  const commitment = await kvGet(env, `frank:${frankId}`);
  if (!commitment) return json({ error: 'No such franking record', code: 'NOT_FOUND' }, 404, request);
  const verified = await hmacVerifyFrank(commitment, opening, message);
  if (!verified) return json({ verified: false, error: 'Report does not match the sent message', code: 'FRANK_MISMATCH' }, 400, request);
  // Record the verified report for moderation (idempotent on frankId).
  await kvPut(env, `report:${frankId}`, JSON.stringify({ at: Date.now(), len: message.length }), { expirationTtl: 86400 * 90 });
  return json({ verified: true }, 200, request);
}

// ============================================================
// SEALED SENDER (v3 — metadata protection)
//
// Worker only sees recipient ID. Sender is encrypted inside payload.
// ============================================================

async function handleSealedSend(body, env, request) {
  const { to, envelope } = body;
  if (!to || !envelope) return json({ error: 'to and envelope required' }, 400, request);
  if (!validateUserId(to)) return json({ error: 'invalid recipient id', code: 'INVALID_USER_ID' }, 400, request);
  if (typeof envelope !== 'string' || envelope.length > 256 * 1024) return json({ error: 'Envelope too large', code: 'PAYLOAD_TOO_LARGE' }, 400, request);
  // v3.6: In-memory dedup (saves 1 KV read + 1 KV write per sealed send)
  if (!globalThis._sealedDedup) globalThis._sealedDedup = new Map();
  const dedupKey = `${to}:${envelope.slice(0, 32)}`;
  if (globalThis._sealedDedup.has(dedupKey)) return json({ ok: true, dedup: true }, 200, request);
  globalThis._sealedDedup.set(dedupKey, 1);
  if (globalThis._sealedDedup.size > 500) { const e = [...globalThis._sealedDedup.entries()]; globalThis._sealedDedup = new Map(e.slice(-200)); }

  const key = `sealed:${to}`;
  const existing = await kvGet(env, key);
  const queueParsed = existing ? safeJsonParse(existing, []) : [];
  const queue = Array.isArray(queueParsed) ? queueParsed : [];
  queue.push({ envelope, ts: Date.now() });
  const trimmed = queue.slice(-100);
  await kvPut(env, key, JSON.stringify(trimmed), { expirationTtl: 604800 });
  sendPushToUser(to, { title: 'Breeze', body: 'New message', tag: 'breeze-sealed', contactId: to }, env).catch(() => {});
  return json({ ok: true, ack: Date.now() }, 200, request);
}

async function handleSealedPoll(body, env, request) {
  const { id } = body;
  if (!id) return json({ error: 'id required', code: 'MISSING_ID' }, 400, request);
  if (!validateUserId(id)) return json({ error: 'invalid id', code: 'INVALID_ID' }, 400, request);
  const key = `sealed:${id}`;
  const data = await kvGet(env, key);
  if (!data) return json({ messages: [] }, 200, request);
  const messages = safeJsonParse(data, []);
  if (!Array.isArray(messages)) return json({ messages: [] }, 200, request);
  // v3.6: Grace period — set short TTL instead of immediate delete
  // If client crashes after poll but before processing, messages survive 5 min
  // Client-side _replayCache + IDB dedup prevents re-rendering on re-poll
  await kvPut(env, key, data, { expirationTtl: 300 }); // 5 min grace
  return json({ messages }, 200, request);
}

// v3.6: Sealed ACK — client confirms processing, worker deletes messages
async function handleSealedAck(body, env, request) {
  const { id } = body;
  if (!id || typeof id !== 'string') return json({ error: 'id required', code: 'MISSING_ID' }, 400, request);
  if (!validateUserId(id)) return json({ error: 'invalid id', code: 'INVALID_ID' }, 400, request);
  await kvDel(env, `sealed:${id}`);
  return json({ ok: true }, 200, request);
}

// ============================================================
// ENCRYPTED CLOUD BACKUP (all users)
//
// Stores E2E encrypted backup blob in KV.
// Server cannot decrypt — only the user's passphrase can.
// Available to all authenticated users.
// ============================================================

async function handleBackupUpload(body, env, request) {
  const { userId, backup } = body;
  if (!userId || !backup) return json({ error: 'userId and backup required' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  if (typeof backup !== 'string') return json({ error: 'backup must be a string', code: 'INVALID_FIELD' }, 400, request);

  // Store (max 5MB per backup)
  if (backup.length > 5 * 1024 * 1024) return json({ error: 'Backup too large', code: 'PAYLOAD_TOO_LARGE' }, 413, request);
  await kvPut(env, `backup:${userId}`, backup, { expirationTtl: 86400 * 90 }); // 90 day retention
  return json({ ok: true, size: backup.length }, 200, request);
}

async function handleBackupDownload(body, env, request) {
  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const backup = await kvGet(env, `backup:${userId}`);
  if (!backup) return json({ error: 'No backup found', code: 'NOT_FOUND' }, 404, request);
  return json({ backup }, 200, request);
}

// ═══════════════════════════════════════════════════════════
// DEAD DROP — One-time encrypted secret sharing
// Strategy: Primary SEO/viral acquisition tool
// Client encrypts with random key → key goes in URL fragment (never sent to server)
// Server stores ciphertext → single read → auto-delete
// ═══════════════════════════════════════════════════════════
async function handleDropCreate(body, env, request) {
  const { id, ct, ttl } = body;
  if (!id || !ct) return json({ error: 'id and ct required' }, 400, request);
  if (typeof id !== 'string' || id.length < 1 || id.length > 64 || !/^[A-Za-z0-9_\-.]+$/.test(id)) return json({ error: 'invalid id (1-64 alphanumeric/_/./- chars)' }, 400, request);
  if (typeof ct !== 'string' || ct.length > 100000) return json({ error: 'ct too large (max 100KB)' }, 400, request);
  const ttlSec = Math.min(Math.max(parseInt(ttl) || 86400, 300), 604800); // 5min - 7days, default 24h
  const key = `drop:${id}`;
  const existing = await kvGet(env, key);
  if (existing) return json({ error: 'id collision', code: 'COLLISION' }, 409, request);
  await kvPut(env, key, JSON.stringify({ ct, createdAt: Date.now(), reads: 0 }), { expirationTtl: ttlSec });
  return json({ ok: true, ttl: ttlSec }, 200, request);
}

async function handleDropRead(body, env, request) {
  const { id } = body;
  if (!id || typeof id !== 'string' || id.length > 64 || !/^[A-Za-z0-9_\-.]+$/.test(id)) return json({ error: 'invalid id' }, 400, request);
  const key = `drop:${id}`;
  const raw = await kvGet(env, key);
  if (!raw) return json({ error: 'Not found or already read', code: 'NOT_FOUND' }, 404, request);
  const data = safeJsonParse(raw);
  if (!data) return json({ error: 'Not found or already read', code: 'NOT_FOUND' }, 404, request);
  // One-time read: delete immediately
  await kvDel(env, key);
  return json({ ct: data.ct, createdAt: data.createdAt }, 200, request);
}

async function handleOGP(body, env, request) {
  const { url } = body;
  if (!url || !url.startsWith('http')) return json({ error: 'url required', code: 'MISSING_URL' }, 400, request);
  if (typeof url !== 'string' || url.length > 2048) return json({ error: 'url too long (max 2048)', code: 'URL_TOO_LONG' }, 400, request);

  // SSRF protection: block private/internal IPs and non-http schemes
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return json({}, 200, request);
    const host = parsed.hostname.toLowerCase();
    // v3.3: Comprehensive SSRF protection (RFC 1918, loopback, link-local, metadata)
    if (host === 'localhost' || host.startsWith('127.') || host === '::1' || host === '0.0.0.0' ||
        host.startsWith('10.') || host.startsWith('192.168.') ||
        host.startsWith('172.') && parseInt(host.split('.')[1]) >= 16 && parseInt(host.split('.')[1]) <= 31 ||
        host === '169.254.169.254' || host.startsWith('169.254.') ||
        host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') ||
        host.endsWith('.internal') || host.endsWith('.local') || host.endsWith('.localhost') ||
        host === '[::1]' || host === 'metadata.google.internal' ||
        host.startsWith('::ffff:') ||  // IPv4-mapped IPv6 bypass (e.g. ::ffff:c0a8:101 = 192.168.1.1)
        parsed.port && !['80', '443', ''].includes(parsed.port)) {
      return json({}, 200, request);
    }
  } catch(e) { return json({}, 200, request); }

  // Cache OGP results for 24h — hash the URL so two URLs sharing a 200-char prefix
  // don't collide, and so very long URLs don't inflate the KV key.
  const cacheKey = `ogp:${await sha256Short(url)}`;
  const cached = await kvGet(env, cacheKey);
  if (cached) { try { return json(JSON.parse(cached), 200, request); } catch { /* fall through on corrupt cache */ } }

  try {
    const resp = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'BreezeBot/1.0 (link preview)', 'Accept': 'text/html' },
      redirect: 'follow',
      cf: { cacheTtl: 3600 },
    }, 5000);
    if (!resp.ok) return json({}, 200, request);

    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return json({}, 200, request);

    // Read first 32KB only (performance)
    const reader = resp.body.getReader();
    let html = '';
    while (html.length < 32768) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});

    // Extract OGP meta tags
    const og = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)`, 'i'))
            || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}`, 'i'));
      return m?.[1] || '';
    };
    const meta = (name) => {
      const m = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)`, 'i'));
      return m?.[1] || '';
    };

    const title = og('title') || html.match(/<title[^>]*>([^<]+)/i)?.[1]?.trim() || '';
    const description = og('description') || meta('description');
    const image = og('image');
    const siteName = og('site_name') || '';

    const result = { title: title.slice(0, 200), description: description.slice(0, 300), image: image.slice(0, 500), siteName: siteName.slice(0, 100), url };

    // Cache for 24h
    await kvPut(env, cacheKey, JSON.stringify(result), { expirationTtl: 86400 });

    return json(result, 200, request);
  } catch {
    return json({}, 200, request);
  }
}

// Helpers
// ============================================================
function json(data, status, request, _rid) {
  // v3.3: Auto-inject reqId into error responses for enterprise traceability
  if (status >= 400 && _rid && !data.reqId) data.reqId = _rid;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Vary': 'Origin',
      ...corsHeaders(request),
    },
  });
}

// ================================================================
// Translation API — multi-provider with KV cache
// Providers: DeepL (DEEPL_API_KEY) → LibreTranslate (TRANSLATE_URL) → MyMemory (free)
// ================================================================
async function handleTranslate(body, env, request) {
  const { text, from, to } = body;
  if (!text || !to) return json({ error: 'text and to required' }, 400, request);
  if (typeof text !== 'string' || text.length > 2000) return json({ error: 'text too long (max 2000)' }, 400, request);
  if (typeof to !== 'string') return json({ error: 'to must be a string', code: 'INVALID_FIELD' }, 400, request);
  const src = typeof from === 'string' ? from.slice(0, 10) : 'auto';
  const tgt = to.slice(0, 10);

  // KV cache (7-day TTL)
  const hash = await sha256Short(text + src + tgt);
  const cacheKey = `tr:${hash}`;
  const cached = await kvGet(env, cacheKey);
  if (cached) {
    try { return json({ ...JSON.parse(cached), cached: true }, 200, request); } catch {}
  }

  let translated = null;
  let provider = null;
  let detectedFrom = src;

  // Provider 1: DeepL (if DEEPL_API_KEY configured)
  if (!translated && env.DEEPL_API_KEY) {
    try {
      const base = env.DEEPL_API_KEY.endsWith(':fx')
        ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
      const params = new URLSearchParams();
      params.set('text', text);
      params.set('target_lang', tgt.toUpperCase());
      if (src !== 'auto') params.set('source_lang', src.toUpperCase());
      const resp = await fetchWithTimeout(`${base}/v2/translate`, {
        method: 'POST',
        headers: { 'Authorization': `DeepL-Auth-Key ${env.DEEPL_API_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.translations?.[0]?.text) {
          translated = d.translations[0].text;
          detectedFrom = d.translations[0].detected_source_language?.toLowerCase() || src;
          provider = 'deepl';
        }
      }
    } catch(e) { console.error('DeepL error:', e); }
  }

  // Provider 2: LibreTranslate (if TRANSLATE_URL configured, e.g. self-hosted)
  if (!translated && env.TRANSLATE_URL) {
    try {
      const resp = await fetchWithTimeout(env.TRANSLATE_URL + '/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: src === 'auto' ? 'auto' : src, target: tgt, api_key: env.TRANSLATE_KEY || '' }),
      });
      if (resp.ok) {
        const d = await resp.json();
        if (d.translatedText) { translated = d.translatedText; detectedFrom = d.detectedLanguage?.language || src; provider = 'libre'; }
      }
    } catch(e) { console.error('LibreTranslate error:', e); }
  }

  // Provider 3: Google Cloud Translation (if GOOGLE_TRANSLATE_KEY configured)
  if (!translated && env.GOOGLE_TRANSLATE_KEY) {
    try {
      const params = new URLSearchParams({ q: text, target: tgt, format: 'text', key: env.GOOGLE_TRANSLATE_KEY });
      if (src !== 'auto') params.set('source', src);
      const resp = await fetchWithTimeout('https://translation.googleapis.com/language/translate/v2?' + params.toString());
      if (resp.ok) {
        const d = await resp.json();
        if (d.data?.translations?.[0]?.translatedText) {
          translated = d.data.translations[0].translatedText;
          detectedFrom = d.data.translations[0].detectedSourceLanguage || src;
          provider = 'google';
        }
      }
    } catch(e) { console.error('Google Translate error:', e); }
  }

  // Provider 4: MyMemory (free, no API key, 5000 chars/day)
  if (!translated) {
    try {
      const langpair = `${src === 'auto' ? 'autodetect' : src}|${tgt}`;
      const resp = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`);
      if (resp.ok) {
        const d = await resp.json();
        if (d.responseData?.translatedText && d.responseStatus === 200) {
          translated = d.responseData.translatedText;
          detectedFrom = d.responseData.match?.source || src;
          provider = 'mymemory';
        }
      }
    } catch(e) { console.error('MyMemory error:', e); }
  }

  if (!translated) return json({ error: 'Translation failed', code: 'TRANSLATE_FAILED' }, 502, request);

  const result = { text, translated, from: detectedFrom, to: tgt, provider };
  // Cache for 7 days
  await kvPut(env, cacheKey, JSON.stringify(result), { expirationTtl: 604800 });
  return json({ ...result, cached: false }, 200, request);
}

// ================================================================
// AI Chat API — multi-provider with KV cache
// Providers: Anthropic Claude → OpenAI → Groq → (error)
// Actions: chat, summarize, reply_suggest, translate_context
// ================================================================
async function handleAI(body, env, request) {
  const { action, messages, text, context, lang } = body;
  if (!action) return json({ error: 'action required' }, 400, request);

  // Check if any AI provider is configured
  const hasAI = env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || env.GROQ_API_KEY;
  if (!hasAI) return json({ error: 'No AI provider configured', code: 'NO_AI', hint: 'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY' }, 503, request);

  let systemPrompt = '';
  let userContent = '';
  const maxTokens = 500;

  // Build prompt based on action
  switch (action) {
    case 'chat':
      if (!text || typeof text !== 'string' || text.length > 2000) return json({ error: 'text required (max 2000)' }, 400, request);
      systemPrompt = 'You are a helpful assistant embedded in a P2P messenger. Keep answers concise (2-3 sentences). Reply in the same language as the user.';
      userContent = text;
      break;

    case 'summarize':
      if (!messages || !Array.isArray(messages)) return json({ error: 'messages array required' }, 400, request);
      systemPrompt = 'Summarize this chat conversation in 3-5 bullet points. Identify key topics, decisions, and action items. Reply in the same language as the messages.';
      // Cap individual fields before joining to bound peak memory (not just the aggregate).
      userContent = messages.slice(-50).map(m => {
        const s = String(m.sender || '').slice(0, 100);
        const t = String(m.text   || '').slice(0, 500);
        return `${s}: ${t}`;
      }).join('\n');
      if (userContent.length > 4000) userContent = userContent.slice(-4000);
      break;

    case 'reply_suggest':
      if (!context || typeof context !== 'string') return json({ error: 'context required (string)' }, 400, request);
      systemPrompt = 'Generate 3 short reply suggestions (each under 30 chars) for the last message in this chat. Return ONLY a JSON array of 3 strings. Reply in the same language as the conversation.';
      userContent = context.slice(-1000);
      break;

    case 'translate_context': {
      if (!text || !lang) return json({ error: 'text and lang required' }, 400, request);
      // Sanitize lang to a valid BCP-47 tag (e.g. 'en', 'ja', 'zh-CN') to prevent
      // prompt injection via a crafted language string in the system prompt.
      const safeLang = String(lang).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
      if (!safeLang) return json({ error: 'invalid lang code' }, 400, request);
      systemPrompt = `Translate the following message to ${safeLang}. Preserve tone, formality level, and emoji. Return ONLY the translation.`;
      userContent = text.slice(0, 2000);
      break;
    }

    default:
      return json({ error: 'Unknown action: ' + String(action).slice(0, 32) }, 400, request);
  }

  // KV cache (1h for chat, 24h for summarize/translate)
  const cacheTTL = action === 'chat' ? 3600 : 86400;
  const hash = await sha256Short(action + userContent + systemPrompt);
  const cacheKey = `ai:${hash}`;
  const cached = await kvGet(env, cacheKey);
  if (cached) {
    try { return json({ ...JSON.parse(cached), cached: true }, 200, request); } catch {}
  }

  let result = null;
  let provider = null;

  // Provider 1: Anthropic Claude
  if (!result && env.ANTHROPIC_API_KEY) {
    try {
      const resp = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      if (resp.ok) {
        const d = await resp.json();
        const text = d.content?.find(b => b.type === 'text')?.text;
        if (text) { result = text; provider = 'anthropic'; }
      }
    } catch(e) { console.error('Anthropic error:', e); }
  }

  // Provider 2: OpenAI
  if (!result && env.OPENAI_API_KEY) {
    try {
      const base = env.OPENAI_BASE_URL || 'https://api.openai.com';
      const resp = await fetchWithTimeout(base + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || 'gpt-4o-mini',
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });
      if (resp.ok) {
        const d = await resp.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) { result = text; provider = 'openai'; }
      }
    } catch(e) { console.error('OpenAI error:', e); }
  }

  // Provider 3: Groq (fast, generous free tier)
  if (!result && env.GROQ_API_KEY) {
    try {
      const resp = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        }),
      });
      if (resp.ok) {
        const d = await resp.json();
        const text = d.choices?.[0]?.message?.content;
        if (text) { result = text; provider = 'groq'; }
      }
    } catch(e) { console.error('Groq error:', e); }
  }

  if (!result) return json({ error: 'AI generation failed', code: 'AI_FAILED' }, 502, request);

  const out = { result, provider, action };
  await kvPut(env, cacheKey, JSON.stringify(out), { expirationTtl: cacheTTL });
  return json({ ...out, cached: false }, 200, request);
}

async function sha256Short(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const hdrs = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'X-Breeze-Version': '3.6.0',
  };
  // Only echo the Origin back if it is a real browser origin (not the string "null"
  // produced by sandboxed iframes / file:// which would allow those sources to read
  // API responses). Missing-Origin requests (curl, server-side) don't need CORS.
  if (origin && origin !== 'null') hdrs['Access-Control-Allow-Origin'] = origin;
  return hdrs;
}

// v3.5: KV safety helpers (FIXED: was calling itself recursively!)
async function kvGet(env, key) {
  try { return await env.KV.get(key); } catch(e) { console.error('KV GET failed:', key, e); return null; }
}
async function kvPut(env, key, value, opts) {
  try { await env.KV.put(key, value, opts); return true; } catch(e) { console.error('KV PUT failed:', key, e); return false; }
}
async function kvDel(env, key) {
  try { await env.KV.delete(key); return true; } catch(e) { console.error('KV DEL failed:', key, e); return false; }
}

// ================================================================

// Named exports for unit testing. Cloudflare Pages uses the `export default`
// above; these additional named exports are inert at runtime and let the test
// harness import individual handlers/helpers directly. Do not remove.
export {
  handleWebhook,
  verifyStripeSignature,
  handlePreKeyUpload,
  handlePreKeyFetch,
  verifyEd25519,
  handleAbuseRecord,
  handleAbuseReport,
  hmacVerifyFrank,
  handlePushSubscribe,
  handleGroupCreate,
  handleGroupJoin,
  handleGroupInfo,
  handleGroupKick,
  handleSealedSend,
  handleSealedPoll,
  handleSealedAck,
  handleMsgSend,
  handleMsgPoll,
  handleAliasSet,
  handleAliasGet,
  validateUserId,
  sanitizeString,
  kvGet,
  kvPut,
  kvDel,
  encryptPushPayload,
  buildVapidJwt,
  b64urlToBytes,
  bytesToB64url,
  concatBytes,
  handleDropCreate,
  handleDropRead,
  handleBackupUpload,
  handleBackupDownload,
  handleSignal,
  handlePresence,
  handleOnlineCount,
  handleOGP,
  handleTurn,
  handleAccountSlots,
  handleAI,
  handleTranslate,
};

