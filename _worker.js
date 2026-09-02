/**
 * Breeze Worker v3.6.0
 * 43 API endpoints. Cloudflare Pages Functions.
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
const TTL = { // KV expirationTtl values (seconds)
  MIN:     60,
  HOUR:    3600,
  DAY:     86400,
  WEEK:    604800,
  MONTH:   86400 * 30,
  QUARTER: 86400 * 90,
  YEAR:    86400 * 365,
};
const TIMEOUT_MS = { // fetchWithTimeout values (milliseconds)
  PUSH:    5000,   // Web Push endpoint — tight: a slow push service is already failing
  TURN:    5000,   // TURN credential API — fail fast so WebRTC can fall back
  WEBHOOK:        5000,   // Abuse report webhook — fire-and-forget; don't wait on slow receivers
  REQ_TS:         300000, // 5-min request timestamp validation window (anti-replay)
  POW_AGE:        600000, // 10-min PoW freshness window
  POW_FUT:        300000, // 5-min PoW future clock-skew tolerance
  MULTITAB_GRACE:   10000,  // multi-tab delivery grace period in handleMsgPoll keep filter
  PRESENCE_WRITE:  300000,  // minimum interval between KV presence writes (throttle)
};

function sanitizeString(val, maxLen = MAX_STRING_LEN) {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen).replace(/[\x00-\x08\x0a-\x0c\x0d\x0e-\x1f]/g, '');
}

function validateUserId(id) {
  // Upper bound 128: the longest KV key prefix is 'prekey:otp:...:99' (14 chars);
  // 128+14 = 142 bytes — well within the Cloudflare KV 512-byte key limit.
  // A 512-char userId would produce composite keys up to 526 bytes, causing silent
  // kvGet→null / kvPut→false failures. The generic body guard (line ~266) already
  // caps named userId fields at 128; this makes validateUserId consistent with it.
  return typeof id === 'string' && id.length >= 8 && id.length <= 128 && /^[A-Za-z0-9+/=_-]+$/.test(id);
}

// N3: sanitize a client-advertised capability array (prekey bundle + presence). Keeps
// ≤20 string entries, each ≤32 chars; drops non-strings. Returns undefined for a
// non-array so callers can omit the field entirely (backward-compat for v4 clients).
function sanitizeCaps(caps) {
  if (!Array.isArray(caps)) return undefined;
  return caps.slice(0, 20).filter((c) => typeof c === 'string').map((c) => c.slice(0, 32));
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
    const path = url.pathname.replace(/\/+$/, '') || '/';
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
      // v3.6: Probabilistic cleanup — 10% of health checks clean stale signal data
      if (kvOk && Math.random() < 0.1) {
        try {
          const list = await env.KV.list({ prefix: 'sig:', limit: 20 });
          const now = Date.now();
          for (const key of list.keys) {
            if (key.expiration && key.expiration * 1000 < now) await kvDel(env, key.name);
          }
        } catch(e) { console.error('[cleanup]', e?.message ?? e); }
      }
      return json({
        ok: kvOk,
        version: '3.6.0',
        protocol: 4,
        endpoints: 38,
        reqId,
        serverTime: Date.now(), // v3.6: Client can detect clock drift
        kv: kvOk,
        push: !!(env.VAPID_PUBLIC_KEY),
        turn: !!(env.TURN_URL),
        vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
        features: {
          push: !!(env.VAPID_PUBLIC_KEY),
          turn: !!(env.TURN_URL),
          backup: kvOk,
        },
        // Always-on endpoint capabilities (independent of env config) so a client can
        // feature-detect during a staged rollout — e.g. show the delete-account /
        // leave-group / transfer-ownership UI only when the relay actually supports it,
        // instead of probing each endpoint or hard-coding a minimum server version.
        capabilities: [
          'account-delete', 'group-leave', 'group-delete', 'group-admin',
          'group-transfer', 'group-rename', 'msg-disappear-enforce',
          'sealed-sender', 'franking', 'prekey-x3dh',
          'batch-alias', 'group-caps', 'ktlog-get', 'push-unsubscribe', 'prekey-fetch-batch', 'prekey-status', 'alias-delete', 'alias-auth', 'backup-auth', 'push-auth', 'drop-server-id', 'portal-auth', 'group-auth', 'group-ban',
        ],
        crypto: ['X25519', 'Ed25519', 'AES-256-GCM', 'HKDF-SHA256', 'Double Ratchet', 'Sender Key O(1)'],
        ts: Date.now(),
        responseMs: Date.now() - _startMs,
      }, kvOk ? 200 : 503, request);
    }

    // All other API routes: POST only
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, request);
    }

    // Rate limit: per-IP, per-path, per-minute (in-memory, per-isolate). Note: this is a
    // single IP+path layer — there is no separate per-userId bucket (a true cross-isolate
    // per-user limit needs a Durable Object; deferred). 'unknown' IPs are capped tighter
    // below so requests without CF-Connecting-IP can't monopolise a shared bucket.
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
        '/api/prekey/fetch/batch': 5,
        '/api/prekey/status': 20,
        '/api/ktlog/get': 20,
        '/api/backup/upload': 2,
        '/api/backup/download': 5,
        '/api/drop/create': 10,
        '/api/drop/read': 20,
        '/api/abuse/record': 30,
        '/api/abuse/report': 10,
        '/api/alias/set': 10,
        '/api/device/set': 5,
        '/api/device/list': 30,
        '/api/alias/get': 30,
        '/api/alias/delete': 5,
        // Group create/join write to KV on every call; cap them like prekey/upload (5) and
        // drop/create (10) to protect the free-tier KV write quota (1000/day).
        // The 30 rpm default left both endpoints able to exhaust the daily write budget
        // in ~33 minutes from a single IP.
        '/api/group/create': 5,
        '/api/group/join': 10,
        '/api/group/info': 20,
        '/api/group/kick': 5,
        '/api/group/admin': 10,
        '/api/group/transfer': 5,
        '/api/group/rename': 10,
        '/api/group/leave': 10,
        '/api/group/delete': 5,
        '/api/account/delete': 3,
        '/api/push/subscribe': 5,
        '/api/push/unsubscribe': 5,
        '/api/turn': 10,
        '/api/online': 20,
      };
      // Cap 'unknown' IP (no CF-Connecting-IP) at 5 rpm regardless of path —
      // prevents a shared bucket from being monopolized in non-CF deployments.
      const limit = ip === 'unknown' ? Math.min(limits[path] || 30, 5) : (limits[path] || 30);

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
        // Seconds until the current minute bucket rolls over. Use ceil + a floor of 1 so we
        // never return retryAfter:0 (which says "retry now" while the bucket is still full
        // for up to ~1s) and so the JSON body and the Retry-After header always agree.
        const retryAfter = Math.max(1, Math.ceil(60 - (Date.now() / 1000) % 60));
        return new Response(JSON.stringify({ error: 'Rate limited', code: 'RATE_LIMITED', retryAfter }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter), 'X-RateLimit-Limit': String(limit), 'X-RateLimit-Remaining': '0', ...corsHeaders(request) },
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
      if (drift > TIMEOUT_MS.REQ_TS) {
        return json({ error: 'Request expired', code: 'TIMESTAMP_EXPIRED' }, 400, request);
      }
    }

    // Input validation — prevent KV abuse + injection
    for (const key of ['id', 'room', 'sender', 'type', 'userId', 'to', 'from', 'alias', 'token', 'frankId', 'kickId', 'adminId', 'creatorId', 'memberId']) {
      if (body[key] && typeof body[key] === 'string' && body[key].length > 128) {
        return json({ error: key + ' too long (max 128)', code: 'FIELD_TOO_LARGE' }, 400, request);
      }
      // Block control characters in identifiers
      if (body[key] && typeof body[key] === 'string' && /[\x00-\x1f]/.test(body[key])) {
        return json({ error: key + ' contains invalid characters', code: 'INVALID_FIELD' }, 400, request);
      }
    }
    if (body.data && typeof body.data === 'string' && body.data.length > 65536) {
      return json({ error: 'data too long (max 64KB)', code: 'PAYLOAD_TOO_LARGE' }, 400, request);
    }
    // Payload size limit (encrypted messages)
    if (body.payload && typeof body.payload === 'string' && body.payload.length > 512 * 1024) {
      return json({ error: 'payload too large (max 512KB)', code: 'PAYLOAD_TOO_LARGE' }, 400, request);
    }
    // Envelope size limit (sealed sender)
    if (body.envelope && typeof body.envelope === 'string' && body.envelope.length > 512 * 1024) {
      return json({ error: 'envelope too large (max 512KB)', code: 'PAYLOAD_TOO_LARGE' }, 400, request);
    }

    try {
      if (!env.KV) {
        return json({ error: 'Storage not configured. Bind a KV namespace named "KV" in Pages settings.', code: 'KV_NOT_CONFIGURED' }, 503, request);
      }
      switch (path) {
        case '/api/signal':    return await handleSignal(body, ip, env, request);
        case '/api/msg/send':  return await handleMsgSend(body, ip, env, request);
        case '/api/msg/poll':  return await handleMsgPoll(body, env, request);
        case '/api/presence':  return await handlePresence(body, env, request);
        case '/api/alias/set': return await handleAliasSet(body, env, request);
        case '/api/alias/get': return await handleAliasGet(body, env, request);
        case '/api/device/set': return await handleDeviceSet(body, env, request);
        case '/api/device/list': return await handleDeviceList(body, env, request);
        case '/api/alias/delete': return await handleAliasDelete(body, env, request);
        case '/api/group/create': return await handleGroupCreate(body, env, request);
        case '/api/group/join':   return await handleGroupJoin(body, env, request);
        case '/api/group/info':   return await handleGroupInfo(body, env, request);
        case '/api/push/subscribe':   return await handlePushSubscribe(body, env, request);
        case '/api/push/unsubscribe': return await handlePushUnsubscribe(body, env, request);
        case '/api/turn':           return await handleTurn(body, env, request);
        case '/api/prekey/upload':    return await handlePreKeyUpload(body, env, request);
        case '/api/prekey/fetch':     return await handlePreKeyFetch(body, env, request);
        case '/api/prekey/fetch/batch': return await handlePreKeyFetchBatch(body, env, request);
        case '/api/prekey/status':      return await handlePreKeyStatus(body, env, request);
        case '/api/ktlog/get':        return await handleKtLogGet(body, env, request);
        case '/api/online':           return await handleOnlineCount(body, env, request);
        case '/api/sealed/send':      return await handleSealedSend(body, env, request);
        case '/api/sealed/poll':      return await handleSealedPoll(body, env, request);
        case '/api/sealed/ack':       return await handleSealedAck(body, env, request);
        case '/api/backup/upload':    return await handleBackupUpload(body, env, request);
        case '/api/backup/download':  return await handleBackupDownload(body, env, request);
        case '/api/group/kick':       return await handleGroupKick(body, env, request);
        case '/api/group/admin':      return await handleGroupAdmin(body, env, request);
        case '/api/group/transfer':   return await handleGroupTransfer(body, env, request);
        case '/api/group/rename':     return await handleGroupRename(body, env, request);
        case '/api/group/leave':      return await handleGroupLeave(body, env, request);
        case '/api/group/delete':     return await handleGroupDelete(body, env, request);
        case '/api/account/delete':   return await handleAccountDelete(body, env, request);
        case '/api/drop/create':      return await handleDropCreate(body, env, request);
        case '/api/drop/read':        return await handleDropRead(body, env, request);
        case '/api/abuse/record':     return await handleAbuseRecord(body, env, request);
        case '/api/abuse/report':     return await handleAbuseReport(body, env, request);
        default:            return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request, reqId);
      }
    } catch (e) {
      return json({ error: 'Server error', code: 'SERVER_ERROR', rid: reqId }, 500, request, reqId);
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
    const remaining = signals.filter(s => s.sender === sender || (typeof s.ts === 'number' && Number.isFinite(s.ts) && now - s.ts < 30000));
    if (remaining.length < signals.length) {
      if (remaining.length > 0) await kvPut(env, `sig:${room}`, JSON.stringify(remaining), { expirationTtl: TTL.MIN * 5 });
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
  await kvPut(env, `sig:${room}`, JSON.stringify(trimmed), { expirationTtl: TTL.MIN * 5 });

  return json({ ok: true }, 200, request);
}

// ============================================================
// MESSENGER — 1:1 encrypted message relay + presence
// Messages are E2E encrypted (ECDH). Server stores only ciphertext.
// Recipient polls and retrieves. Messages deleted after delivery.
// ============================================================

// Bound a relay queue by approximate serialized BYTES (not just message count), evicting
// oldest first. KV's value limit is 25MB, and the count cap alone (100) doesn't prevent a
// queue of large (up to 256KB) messages from exceeding it — which would make every kvPut
// fail (STORE_FAILED) and wedge the queue, so an offline recipient receives nothing new
// until they poll. FIFO eviction always keeps the newest (just-appended) item, so a normal
// send is never blocked; a best-effort relay drops the oldest undelivered instead. Sizes are
// approximated from the dominant field (payload/envelope) + per-message overhead to stay O(n)
// and serialize only once. maxBytes leaves wide headroom under the 25MB KV cap.
function capQueueBytes(items, sizeOf, maxBytes = 16 * 1024 * 1024) {
  let total = 0;
  for (const it of items) total += sizeOf(it);
  while (items.length > 1 && total > maxBytes) total -= sizeOf(items.shift());
  return items;
}

async function handleMsgSend(body, ip, env, request) {
  const { to, from, fromPub, fromName, payload, ts, isFile, isGroupInvite, isVoice, isCall, isVideoCall, isSenderKey, isGroupSK, isGroupKick, groupId, groupName, replyTo, disappearAt, sig, sigPub } = body;
  if (!to || !from || !payload) return json({ error: 'to, from, payload required', code: 'MISSING_FIELDS' }, 400, request);
  // v3.3: Input type validation
  if (typeof to !== 'string' || typeof from !== 'string' || typeof payload !== 'string') return json({ error: 'Invalid types', code: 'INVALID_TYPE' }, 400, request);
  if (!validateUserId(to) || !validateUserId(from)) return json({ error: 'invalid userId format', code: 'INVALID_USER_ID' }, 400, request);
  if (to === from && !body.type) return json({ error: 'Cannot send to self', code: 'SELF_SEND' }, 400, request);
  if (payload.length > 256 * 1024) return json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, 400, request);

  // v3.5: Replay protection — reject messages with timestamps outside ±5 min window.
  // A non-numeric ts (string/object) makes Math.abs(now - ts) === NaN, which is never
  // > TIMEOUT_MS.REQ_TS — silently bypassing this guard AND poisoning the stored msg.ts below,
  // which breaks the numeric poll-cursor comparison in handleMsgPoll. Reject a
  // non-numeric ts outright; an absent ts defaults to now.
  const now = Date.now();
  if (ts !== undefined && (typeof ts !== 'number' || !Number.isFinite(ts))) return json({ error: 'Invalid timestamp', code: 'INVALID_TIMESTAMP' }, 400, request);
  const msgTs = ts || now;
  if (Math.abs(now - msgTs) > TIMEOUT_MS.REQ_TS) return json({ error: 'Timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);

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
  // Multi-device self-sync markers pass through opaquely (validated client-side against the
  // signature-verified device registry; the relay only ferries them).
  if (body.selfSync === true && typeof body.sfFor === 'string') {
    msg.selfSync = true; msg.sfFor = body.sfFor.slice(0, 64);
    if (typeof body.sfPub === 'string') msg.sfPub = body.sfPub.slice(0, 200);
    if (typeof body.sfName === 'string') msg.sfName = body.sfName.slice(0, 64);
  }
  // Multi-device sender attribution: a secondary device names its account root; the recipient
  // verifies the claim against the root-signed device registry (relay just ferries it).
  if (typeof body.acctRoot === 'string') msg.acctRoot = body.acctRoot.slice(0, 200);
  // "No reply needed" marker: opaque to the relay, consumed by the recipient's UI. Passed
  // through on the /msg fallback so the flag survives when sealed sending is unavailable.
  if (body.nrn === true) msg.nrn = true;
  // Server-assigned unique message id — groundwork for an exclusive poll cursor.
  // Two messages stored in the same millisecond share a ts, and the ts-only cursor
  // (`m.ts > lastTs`) drops the second one if a poll lands between them. Current
  // clients ignore unknown fields; a future client can cursor/dedup on (ts, id).
  const idBytes = new Uint8Array(6);
  crypto.getRandomValues(idBytes);
  msg.id = Array.from(idBytes, b => b.toString(16).padStart(2, '0')).join('');
  if (isFile) msg.isFile = true;
  if (isGroupInvite) msg.isGroupInvite = true;
  if (isVoice) msg.isVoice = true;
  if (isCall) msg.isCall = true;
  if (isVideoCall) msg.isVideoCall = true;
  if (isSenderKey) msg.isSenderKey = true;
  if (isGroupSK) msg.isGroupSK = true;
  if (isGroupKick) msg.isGroupKick = true;
  if (typeof groupId === 'string' && groupId) { msg.groupId = groupId.slice(0, 64); msg.groupName = typeof groupName === 'string' ? groupName.slice(0, 50) : undefined; }
  if (typeof replyTo === 'string' && replyTo) msg.replyTo = replyTo.slice(0, 128);
  if (disappearAt) msg.disappearAt = (typeof disappearAt === 'number' && Number.isFinite(disappearAt)) ? disappearAt : undefined;
  if (sig) msg.sig = typeof sig === 'string' ? sig.slice(0, 200) : undefined;
  if (sigPub) msg.sigPub = typeof sigPub === 'string' ? sigPub.slice(0, 200) : undefined;
  // Guarantee strictly-increasing ts within this inbox so the poll cursor (m.ts > lastTs)
  // can never silently drop a message that shares a millisecond with an already-delivered
  // one. The loss: client polls up to lastTs=T, a SECOND message then stores with ts=T,
  // and the next poll's `m.ts > T` excludes it forever (cleanup eventually purges it
  // undelivered). Bumping a colliding ts by 1ms makes the existing cursor lossless with no
  // client change — appends are sequential so the last element always holds the max ts;
  // display order is preserved and the sub-ms drift is invisible. (msg.id is the dedup key,
  // so a bumped ts never causes a re-render.)
  if (inbox.length > 0) {
    const lastStoredTs = inbox[inbox.length - 1].ts;
    if (Number.isFinite(lastStoredTs) && msg.ts <= lastStoredTs) msg.ts = lastStoredTs + 1;
  }
  inbox.push(msg);
  const trimmed = capQueueBytes(inbox.slice(-100), m => (typeof m.payload === 'string' ? m.payload.length : 0) + 1024);
  const stored = await kvPut(env, key, JSON.stringify(trimmed), { expirationTtl: TTL.WEEK });
  if (!stored) {
    // Un-mark the dedup key on a failed store: it was set BEFORE this write, so leaving it
    // would make the client's retry of the identical ciphertext hit the dedup short-circuit
    // (ok:true, dedup:true) and be silently dropped — a message lost despite never being
    // stored. Deleting it lets the retry actually persist.
    globalThis._msgDedup.delete(dedupKey);
    return json({ error: 'Failed to store message', code: 'STORE_FAILED' }, 500, request);
  }

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
  // Server-side enforcement of disappearing messages. The client sets an ABSOLUTE
  // expiry (send time + timer) in msg.disappearAt and filters it at render — but an
  // UNDELIVERED expired message would otherwise sit in KV for up to the 7-day inbox
  // TTL. Expired messages are excluded from delivery AND from the keep-list below,
  // so the ciphertext is purged from KV on the first poll after expiry.
  const nowPoll = Date.now();
  const isExpired = (m) => Number.isFinite(m.disappearAt) && m.disappearAt <= nowPoll;
  // Use Number.isFinite to coerce non-finite ts values (NaN, Infinity) to 0.
  // (m.ts || 0) handles NaN (falsy) but not Infinity (truthy): a stored message
  // with ts:Infinity would pass every cutoff check and never be cleaned up.
  const newMsgs = all.filter(m => !isExpired(m) && (Number.isFinite(m.ts) ? m.ts : 0) > cutoff);
  // Remove delivered messages older than 10 seconds (grace period for multi-tab)
  const keep = all.filter(m => { if (isExpired(m)) return false; const t = Number.isFinite(m.ts) ? m.ts : 0; return t > cutoff || (nowPoll - t) < TIMEOUT_MS.MULTITAB_GRACE; });
  if (keep.length < all.length) {
    if (keep.length === 0) await kvDel(env, key);
    else await kvPut(env, key, JSON.stringify(keep), { expirationTtl: TTL.WEEK });
  }

  return json({ messages: newMsgs }, 200, request);
}

async function handlePresence(body, env, request) {
  const { id, ids, pub, name, caps, check: isCheck } = body;
  // N3: capability advertisement carried in the heartbeat so a peer can negotiate the
  // protocol version (x3dh-v5 / group-v5) BEFORE fetching a 1:1 bundle — important for
  // groups, where a member learns the group's capability floor without fetching every
  // member's prekey bundle. (advertise() from src/crypto/negotiate.js.)
  const safeCaps = sanitizeCaps(caps);

  // Batch check: { ids: ['abc','def'], check: true }
  // v3.6: Check in-memory presence cache before KV for each id — the single-check
  // path always did this, but the batch path hit KV unconditionally, costing N reads
  // per group presence poll. A group of 10 members polling every 5 s = 10 KV reads/5s
  // → 120 reads/min per user. Hitting the cache for recently-active users drops this
  // to near 0 reads/min while isolates are warm.
  if (isCheck && ids && Array.isArray(ids)) {
    const online = {};
    const memCache = globalThis._presenceCache || null;
    for (const cid of ids.slice(0, 50).filter(x => typeof x === 'string' && validateUserId(x))) {
      const memRaw = memCache ? memCache.get(`presence:${cid}:data`) : null;
      if (memRaw) {
        const p = safeJsonParse(memRaw);
        online[cid] = p ? (Date.now() - p.at) < 60000 : false;
        continue;
      }
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
    // NOTE: `name` is deliberately NOT returned. This endpoint is unauthenticated, so any
    // party holding only a 12-char user id could read that account's chosen DISPLAY NAME —
    // a PII disclosure to strangers that no contact relationship gated and no user could
    // refuse (Socratic metadata lens). `caps` stays: it is protocol capability data the N3
    // negotiation needs, and it says nothing about the person. The batch path never leaked
    // the name either, and no client code consumed it.
    if (memData) {
      const p = safeJsonParse(memData);
      if (!p) return json({ online: false }, 200, request);
      return json({ online: (Date.now() - p.at) < 60000, caps: p.caps }, 200, request);
    }
    const data = await kvGet(env, `presence:${id}`);
    if (!data) return json({ online: false }, 200, request);
    const p = safeJsonParse(data);
    if (!p) return json({ online: false }, 200, request);
    return json({ online: (Date.now() - p.at) < 60000, caps: p.caps }, 200, request);
  }

  // Store presence heartbeat
  // When PRESENCE_REQUIRE_AUTH=true, verify the caller owns this userId before writing.
  // The check is cached in-memory per isolate so a single KV read covers many heartbeats.
  if (env.PRESENCE_REQUIRE_AUTH === 'true') {
    if (!globalThis._presenceVerified) globalThis._presenceVerified = new Map();
    if (!globalThis._presenceVerified.has(id)) {
      const pkData = await kvGet(env, `prekey:${id}`);
      if (!pkData) return json({ error: 'User not registered', code: 'UNREGISTERED' }, 401, request);
      globalThis._presenceVerified.set(id, 1);
      if (globalThis._presenceVerified.size > 2000) {
        const entries = [...globalThis._presenceVerified.entries()];
        globalThis._presenceVerified = new Map(entries.slice(-1000));
      }
    }
  }

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
  // Identity-clone detection: `inst` is a per-INSTALL random id. Two different live insts
  // heartbeating the same identity within a heartbeat window = the same identity running on
  // two installs at once (e.g. a backup restored while the original device stays active) —
  // a Double-Ratchet-fork hazard the client warns the user about. Best-effort: the previous
  // record may live in another isolate's memory or a ≤5-min-stale KV entry, so a miss is
  // possible; a hit is always real (inst is compared only within the same identity).
  // The inst must be SIGNED by the identity that owns this id. Presence writes are otherwise
  // unauthenticated (PRESENCE_REQUIRE_AUTH is off by default), so an unsigned inst let any
  // stranger POST a random inst for someone else's id and make that user see a scary
  // "your identity is running on two devices" warning on demand — a spoofable security alarm
  // trains users to ignore the real one (Socratic crypto-edge lens). Unsigned or
  // badly-signed insts are ignored entirely: no conflict raised, nothing stored.
  let safeInst = typeof body.inst === 'string' ? body.inst.slice(0, 32) : undefined;
  if (safeInst) {
    const instSig = typeof body.instSig === 'string' ? body.instSig.slice(0, 200) : '';
    const pk = safeJsonParse(await kvGet(env, `prekey:${id}`) || 'null');
    const ok = instSig && pk?.edIdentityKey
      && await verifyEd25519(pk.edIdentityKey, utf8ToB64(`breeze-inst:${id}:${safeInst}`), instSig);
    if (!ok) safeInst = undefined;
  }
  let conflict = false;
  if (safeInst) {
    let prevRaw = globalThis._presenceCache.get(presKey + ':data');
    if (!prevRaw) prevRaw = await kvGet(env, presKey);
    const prev = prevRaw ? safeJsonParse(prevRaw) : null;
    if (prev?.inst && prev.inst !== safeInst && Date.now() - prev.at < 90000) conflict = true;
  }
  const presData = { pub: safePub, name: sanitizeString(name, 64), at: Date.now() };
  if (safeInst) presData.inst = safeInst;
  if (safeCaps) presData.caps = safeCaps;
  if (Date.now() - lastWrite > TIMEOUT_MS.PRESENCE_WRITE) { // throttle KV writes
    await kvPut(env, presKey, JSON.stringify(presData), { expirationTtl: TTL.MIN * 6 }); // 6min TTL (covers 5min interval + slack)
    globalThis._presenceCache.set(presKey, Date.now());
  }
  // Always update in-memory for fast reads within same isolate
  globalThis._presenceCache.set(presKey + ':data', JSON.stringify(presData));
  // v3.6: In-memory online counter (saves 1 KV read + 1 KV write per heartbeat)
  if (!globalThis._onlineCounter) globalThis._onlineCounter = { minute: 0, count: 0, prev: 0 };
  const currentMinute = Math.floor(Date.now() / 60000);
  if (globalThis._onlineCounter.minute !== currentMinute) {
    // Preserve the previous minute's count as a fallback so handleOnlineCount does not
    // report 0 at the start of each minute before the first heartbeat arrives.
    globalThis._onlineCounter = { minute: currentMinute, count: 0, prev: globalThis._onlineCounter.count };
  }
  globalThis._onlineCounter.count++;
  return json(conflict ? { ok: true, conflict: true } : { ok: true }, 200, request);
}

// v3.3: Online user count (approximate)
async function handleOnlineCount(body, env, request) {
  // v3.6: In-memory counter (no KV read needed)
  if (!globalThis._onlineCounter) globalThis._onlineCounter = { minute: 0, count: 0, prev: 0 };
  const minuteKey = Math.floor(Date.now() / 60000);
  // At a minute boundary the new minute's count is 0 until the first heartbeat. Return
  // the previous minute's count as a fallback to avoid a false "0 online" spike.
  const count = (globalThis._onlineCounter.minute === minuteKey)
    ? globalThis._onlineCounter.count
    : globalThis._onlineCounter.prev;
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
    const minDifficulty = parseInt(env.MIN_POW_DIFFICULTY) || 20;
    if (difficulty < minDifficulty || pow.challenge.length > 512 || !pow.challenge.startsWith(pub + ':')) {
      return json({ error: 'Invalid proof-of-work', code: 'POW_INVALID' }, 400, request);
    }
    // Freshness check: makeChallengeString embeds a Unix-ms timestamp as the last
    // colon-delimited segment. If parseable + older than 10 min → expired.
    // Old-format challenges (e.g. "pubkey:breeze-test") have a non-numeric last
    // segment so parseInt returns NaN and Number.isFinite skips the check —
    // backward-compatible with pre-timestamp clients.
    // The challenge is fully client-controlled, so we must ALSO bound the future:
    // a far-future timestamp makes (now - ts) negative — passing the past-only
    // check forever — letting ONE solved token be replayed indefinitely to register
    // unlimited aliases (the challenge binds pub, not the alias). MAX_POW_FUTURE_MS
    // is the clock-skew tolerance; beyond it the token's replay window stays bounded.
    const MAX_POW_AGE_MS = TIMEOUT_MS.POW_AGE;
    const MAX_POW_FUTURE_MS = TIMEOUT_MS.POW_FUT;
    const parts = pow.challenge.split(':');
    const challengeTs = parseInt(parts[parts.length - 1], 10);
    if (Number.isFinite(challengeTs) &&
        (Date.now() - challengeTs > MAX_POW_AGE_MS || challengeTs - Date.now() > MAX_POW_FUTURE_MS)) {
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
  if (clean.length < 3 || clean.length > 20) return json({ error: 'Alias must be 3-20 chars (a-z, 0-9, _)', code: 'INVALID_ALIAS' }, 400, request);

  // Optional Ed25519 ownership binding (anti-impersonation). The PoW above only rate-limits;
  // it does NOT prove the registrant controls `pub`, so a first-come registrant could point an
  // unclaimed @handle at someone else's identity key (impersonation) or squat handles. When the
  // caller supplies { userId, ts, sig }, require that the signer's registered identity key
  // equals the alias target `pub` and that the signature is valid — binding the @handle to the
  // account that owns the key (the same ownership check handleAliasDelete enforces). Enforced
  // outright when ALIAS_REQUIRE_AUTH is set; otherwise verified-when-present and skipped when
  // absent (backward-compatible with PoW-only clients). Challenge is distinct from alias-delete
  // to prevent cross-endpoint replay.
  const { userId: aliasUserId, ts: aliasTs, sig: aliasSig } = body;
  const hasAliasSig = aliasTs !== undefined || aliasSig !== undefined;
  if (hasAliasSig) {
    if (aliasTs === undefined || aliasSig === undefined)
      return json({ error: 'ts and sig must both be provided', code: 'PARTIAL_AUTH' }, 400, request);
    if (typeof aliasSig !== 'string' || aliasSig.length > 500)
      return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
    if (typeof aliasTs !== 'number' || !Number.isFinite(aliasTs) || Math.abs(Date.now() - aliasTs) > TIMEOUT_MS.REQ_TS)
      return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
    if (!aliasUserId || !validateUserId(aliasUserId))
      return json({ error: 'valid userId required for signed alias registration', code: 'INVALID_USER_ID' }, 400, request);
    const bundleRaw = await kvGet(env, `prekey:${aliasUserId}`);
    const bundle = bundleRaw ? safeJsonParse(bundleRaw) : null;
    if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
      return json({ error: 'No registered identity key', code: 'NO_IDENTITY_KEY' }, 403, request);
    if (bundle.identityKey !== pub)
      return json({ error: 'alias target pub does not match the account identity key', code: 'PUB_MISMATCH' }, 403, request);
    const ok = await verifyEd25519(bundle.edIdentityKey, btoa(`breeze-alias-set:${clean}:${aliasTs}`), aliasSig);
    if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);
  } else if (env.ALIAS_REQUIRE_AUTH === 'true') {
    return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 403, request);
  }

  // Check if taken
  const existing = await kvGet(env, `alias:${clean}`);
  if (existing) {
    const data = safeJsonParse(existing);
    if (data && data.pub !== pub) return json({ error: 'Alias already taken', code: 'ALIAS_TAKEN' }, 409, request);
  }

  // Store (no TTL — aliases are permanent)
  const aliasSaved = await kvPut(env, `alias:${clean}`, JSON.stringify({ pub, name: sanitizeString(name, 64), setAt: Date.now() }));
  if (!aliasSaved) return json({ error: 'Failed to store alias', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, alias: clean }, 200, request);
}

// ============================================================
// ALIAS DELETE — release a vanity alias without deleting the account
//
// Without this, the only way to free an alias is to delete the entire account.
// This endpoint lets a user reclaim or reassign their @handle while keeping
// their identity, contacts, messages and billing record intact.
//
// Auth: same Ed25519 pattern as handleAccountDelete but with a different
// challenge to prevent cross-endpoint replay:
//   sig = Ed25519-sign(`breeze-alias-delete:{alias}:{ts}`)
// Ownership is double-verified: the stored alias record's `pub` must equal
// the `identityKey` in the requester's prekey bundle — the same check
// handleAccountDelete does for optional alias release.
// ============================================================
async function handleAliasDelete(body, env, request) {
  const { alias, userId, ts, sig } = body;
  if (!alias || !userId || !sig || ts === undefined)
    return json({ error: 'alias, userId, ts, sig required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof alias !== 'string' || typeof sig !== 'string')
    return json({ error: 'invalid field types', code: 'INVALID_FIELD' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  if (sig.length > 500) return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
  if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS)
    return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);

  const clean = alias.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (clean.length < 3) return json({ error: 'invalid alias', code: 'INVALID_FIELD' }, 400, request);

  const data = await kvGet(env, `prekey:${userId}`);
  const bundle = data ? safeJsonParse(data) : null;
  if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
    return json({ error: 'No registered identity key to authenticate deletion', code: 'NO_IDENTITY_KEY' }, 403, request);

  const challenge = `breeze-alias-delete:${clean}:${ts}`;
  const ok = await verifyEd25519(bundle.edIdentityKey, btoa(challenge), sig);
  if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);

  const aliasRec = safeJsonParse(await kvGet(env, `alias:${clean}`));
  if (!aliasRec) return json({ ok: true, removed: false }, 200, request);
  if (aliasRec.pub !== bundle.identityKey)
    return json({ error: 'Alias not owned by this identity', code: 'NOT_OWNER' }, 403, request);

  const aliasDeleted = await kvDel(env, `alias:${clean}`);
  if (!aliasDeleted) return json({ error: 'Failed to delete alias', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, removed: true }, 200, request);
}

// ============================================================
// DEVICE REGISTRY — multi-device Phase 1
//
// A "device" is just another Breeze identity (its own keypair, prekeys, inbox and ratchet
// sessions — all machinery that already exists per-pubkey). This registry is the ONLY new
// primitive: a root-signed list binding several device identities into one account, so a
// sender can fan the same message out to every device. The wire format is unchanged; a
// client that has no registry entry keeps being addressed as a single device.
//
// Trust model: the FIRST device's Ed25519 identity key is the account root and the sole
// signer. The relay stores the list but cannot forge it — clients re-verify the signature
// against the root key they already pinned for the contact. A malicious relay can at worst
// WITHHOLD the list, which degrades to today's single-device behaviour (fail-open by design).
// ============================================================
async function handleDeviceSet(body, env, request) {
  const { accountId, root, devices, ts, sig } = body;
  if (!accountId || !root || !Array.isArray(devices) || !ts || !sig)
    return json({ error: 'accountId, root, devices, ts, sig required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(accountId)) return json({ error: 'invalid accountId', code: 'INVALID_ID' }, 400, request);
  if (typeof root !== 'string' || root.length > 200) return json({ error: 'invalid root', code: 'INVALID_FIELD' }, 400, request);
  // accountId must be derived from root — the registry key is not free-form.
  if (root.slice(0, 12) !== accountId) return json({ error: 'accountId must match root', code: 'ID_MISMATCH' }, 400, request);
  if (devices.length < 1 || devices.length > 10) return json({ error: '1-10 devices', code: 'INVALID_FIELD' }, 400, request);
  for (const d of devices) {
    if (!d || typeof d.pub !== 'string' || d.pub.length > 200) return json({ error: 'invalid device pub', code: 'INVALID_FIELD' }, 400, request);
    d.name = sanitizeString(d.name || '', 30);
  }
  // The root device must itself be in the list (removing it would orphan the registry).
  if (!devices.some(d => d.pub === root)) return json({ error: 'root must be a device', code: 'ROOT_NOT_DEVICE' }, 400, request);
  if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS)
    return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);

  // Signature: root's REGISTERED Ed25519 key (from its prekey bundle) over a digest of the
  // canonical device list. Using the registered key means a stolen root X25519 pub alone
  // cannot rewrite the registry, and binding ts bounds replay of a captured set.
  const pkRaw = await kvGet(env, `prekey:${accountId}`);
  const bundle = pkRaw ? safeJsonParse(pkRaw) : null;
  if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
    return json({ error: 'No registered identity key for root', code: 'NO_IDENTITY_KEY' }, 403, request);
  const digest = await sha256Short(JSON.stringify(devices.map(d => d.pub)));
  const ok = await verifyEd25519(bundle.edIdentityKey, utf8ToB64(`breeze-device-set:${accountId}:${ts}:${digest}`), sig);
  if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);

  const stored = await kvPut(env, `devices:${accountId}`,
    JSON.stringify({ root, devices, ts, sig }), { expirationTtl: TTL.MONTH * 3 });
  if (!stored) return json({ error: 'Failed to store device list', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, count: devices.length }, 200, request);
}

// Public read: returns the signed record verbatim so the CLIENT can verify the root's
// signature itself instead of trusting the relay's word for the device set.
async function handleDeviceList(body, env, request) {
  const { accountId } = body;
  if (!accountId) return json({ error: 'accountId required', code: 'MISSING_ID' }, 400, request);
  if (!validateUserId(accountId)) return json({ error: 'invalid accountId', code: 'INVALID_ID' }, 400, request);
  const raw = await kvGet(env, `devices:${accountId}`);
  if (!raw) return json({ devices: null }, 200, request);
  const rec = safeJsonParse(raw);
  if (!rec) return json({ devices: null }, 200, request);
  // Touch-on-read: the registry is only ever WRITTEN by /link and /unlink, so an account
  // that simply keeps messaging would hit the 3-month KV TTL and silently drop back to
  // single-device — the promise dies of old age (Socratic lifecycle lens). An ACTIVE
  // account's registry is read constantly (every sender, every 5 min), so refreshing the
  // TTL on read keeps it alive exactly as long as anyone still uses it. Throttled to one
  // rewrite per account per day per isolate.
  if (!globalThis._devTouch) globalThis._devTouch = new Map();
  const lastTouch = globalThis._devTouch.get(accountId) || 0;
  if (Date.now() - lastTouch > 86400000) {
    globalThis._devTouch.set(accountId, Date.now());
    if (globalThis._devTouch.size > 2000) {
      const entries = [...globalThis._devTouch.entries()];
      globalThis._devTouch = new Map(entries.slice(-1000));
    }
    await kvPut(env, `devices:${accountId}`, raw, { expirationTtl: TTL.MONTH * 3 });
  }
  // Include the root's registered Ed25519 key so a LINKING device can TOFU-pin it in the same
  // gesture that carries the root pub out-of-band. Established clients ignore this field and
  // verify against the signing key they already pinned from message signatures — never against
  // a relay-supplied key, which would make the check circular.
  const pk = safeJsonParse(await kvGet(env, `prekey:${accountId}`) || 'null');
  if (pk?.edIdentityKey) rec.rootEd = pk.edIdentityKey;
  return json(rec, 200, request);
}

async function handleAliasGet(body, env, request) {
  const { alias, aliases } = body;

  // Batch mode: { aliases: ['alice','bob',...] } → { results: { alice: {...}, bob: null } }.
  // Resolving a contact list of @handles one-by-one is N requests + N KV reads; the
  // batch path cuts it to one request (mirrors the presence batch-check pattern) and
  // eases free-tier KV read pressure. Unresolved/invalid entries map to null rather
  // than failing the whole call.
  if (Array.isArray(aliases)) {
    const results = {};
    // Dedup + sanitize + cap at 50 to bound KV reads per request.
    const seen = new Set();
    const cleaned = [];
    for (const a of aliases) {
      if (typeof a !== 'string') continue;
      const c = a.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (c.length < 3 || c.length > 20 || seen.has(c)) continue;
      seen.add(c);
      cleaned.push(c);
      if (cleaned.length >= 50) break;
    }
    for (const c of cleaned) {
      const raw = await kvGet(env, `alias:${c}`);
      results[c] = raw ? (safeJsonParse(raw) || null) : null;
    }
    return json({ results }, 200, request);
  }

  if (!alias) return json({ error: 'alias required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof alias !== 'string') return json({ error: 'alias must be a string', code: 'INVALID_FIELD' }, 400, request);

  const clean = alias.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const data = await kvGet(env, `alias:${clean}`);
  if (!data) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);

  const aliasData = safeJsonParse(data);
  if (!aliasData) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);
  return json(aliasData, 200, request);
}

async function handleGroupCreate(body, env, request) {
  const { name: rawName, creatorId, creatorPub: rawCreatorPub, creatorName: rawCreatorName, members, ttl, caps } = body;
  const name = sanitizeString(rawName, 50);
  const creatorName = sanitizeString(rawCreatorName, 64);
  // Public keys must be strings: a non-string object passes the !x presence check
  // but cannot be used as a base64 key and would corrupt the group member record.
  if (typeof rawCreatorPub !== 'string') return json({ error: 'creatorPub must be a string', code: 'INVALID_TYPE' }, 400, request);
  // Cap public keys at 200 chars (X25519/P-256 base64 is ≤88 chars; large values are abuse).
  const creatorPub = rawCreatorPub.slice(0, 200);
  if (!name || !creatorId || !creatorPub) return json({ error: 'name, creatorId, creatorPub required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(creatorId)) return json({ error: 'invalid creatorId', code: 'INVALID_USER_ID' }, 400, request);
  // v3.1: Validate name length
  if (name.length > 50) return json({ error: 'Group name max 50 chars', code: 'INVALID_NAME' }, 400, request);
  // v3.1: Validate initial member count
  if (Array.isArray(members) && members.length > 100) return json({ error: 'Max 100 members', code: 'GROUP_FULL' }, 400, request);

  // Generate short invite token — uniform 12-char base-36.
  // The old approach (8 bytes → b.toString(36) → join → slice(12)) produces variable-length
  // output: when all 8 bytes are < 36 (each yields 1 char) the joined string is only 8 chars
  // and slice(0,12) returns an 8-char token with ≈41 bits of entropy rather than 12 chars
  // (≈62 bits). The new approach requests exactly 12 random bytes and maps each to one of 36
  // chars via modulo. Modulo bias is (256 mod 36)/256 ≈ 1.5% — negligible for an invite token.
  const TOKEN_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
  const tokenBytes = new Uint8Array(12);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes, b => TOKEN_CHARS[b % 36]).join('');

  // N3 (group): persist the creator's advertised capabilities on the member record so
  // a peer can compute the group capability floor (negotiate.js negotiateGroup) from a
  // single group/info call instead of a presence check per member. Sanitized identically
  // to the presence/bundle path (≤20 strings, ≤32 chars). Omitted for legacy clients.
  const creatorRecord = { id: creatorId, pub: creatorPub, name: (creatorName || 'Creator').slice(0, 30) };
  const creatorCaps = sanitizeCaps(caps);
  if (creatorCaps) creatorRecord.caps = creatorCaps;

  const group = {
    name: name.slice(0, 50),
    creatorId,
    creatorPub,
    creatorName: (creatorName || 'Creator').slice(0, 30),
    members: [creatorRecord],
    epoch: 0, // I3: group sender-key epoch; bumped on kick so members rotate keys
    createdAt: Date.now(),
  };

  // Store with 30-day TTL (invite link expires)
  const created = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!created) return json({ error: 'Failed to create group', code: 'STORE_FAILED' }, 500, request);

  return json({ token, name: group.name, memberCount: 1 }, 201, request);
}

async function handleGroupJoin(body, env, request) {
  const { token, memberId, memberPub: rawMemberPub, memberName: rawMemberName, caps } = body;
  const memberName = sanitizeString(rawMemberName, 64);
  if (typeof rawMemberPub !== 'string') return json({ error: 'memberPub must be a string', code: 'INVALID_TYPE' }, 400, request);
  const memberPub = rawMemberPub.slice(0, 200);
  if (!token || !memberId || !memberPub) return json({ error: 'token, memberId, memberPub required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token) || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(memberId)) return json({ error: 'invalid memberId', code: 'INVALID_USER_ID' }, 400, request);
  // Ownership proof: memberId = memberPub.slice(0,12), so pub must start with the claimed id.
  // Without this, any invite holder could join/update under a different user's memberId, hijacking
  // that member's pub key slot and capturing messages encrypted to them.
  if (!memberPub.startsWith(memberId))
    return json({ error: 'memberPub does not match memberId', code: 'KEY_MISMATCH' }, 400, request);

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Invite link expired or invalid', code: 'EXPIRED' }, 404, request);

  const group = safeJsonParse(data);
  if (!group || !Array.isArray(group.members)) return json({ error: 'Invite link expired or invalid', code: 'EXPIRED' }, 404, request);

  // Durable removal: a member the admins kicked cannot rejoin via the (still-valid) invite
  // token. The creator can re-allow them with group/admin action:'unban'.
  if (Array.isArray(group.banned) && group.banned.includes(memberId)) {
    return json({ error: 'You have been removed from this group', code: 'BANNED' }, 403, request);
  }

  // Already a member: refresh the mutable fields (pub/name/caps) rather than no-op.
  // Clients re-call join on reconnect; without this, the N3 capability snapshot would
  // stay frozen at first-join, so a client that upgrades (gains group-v5/franking)
  // could never raise the group floor without leaving and rejoining. pub/name can also
  // legitimately change (key rotation, rename). Persist only when something changed to
  // avoid a wasteful KV write on every reconnect.
  const existing = group.members.find(m => m.id === memberId);
  if (existing) {
    const newName = (memberName || existing.name || 'Member').slice(0, 30);
    const newCaps = sanitizeCaps(caps);
    let changed = false;
    if (existing.pub !== memberPub) { existing.pub = memberPub; changed = true; }
    if (existing.name !== newName) { existing.name = newName; changed = true; }
    // Only overwrite caps when the rejoin actually advertised them (a legacy reconnect
    // with no caps must not erase a previously-recorded capability set).
    if (newCaps && JSON.stringify(existing.caps) !== JSON.stringify(newCaps)) { existing.caps = newCaps; changed = true; }
    if (changed) {
      const saved = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
      if (!saved) return json({ error: 'Failed to update group', code: 'STORE_FAILED' }, 500, request);
    }
    return json({ ok: true, name: group.name, members: group.members, epoch: group.epoch | 0, alreadyMember: true, refreshed: changed }, 200, request);
  }

  // Max 100 members per group (matches README and UI cap)
  if (group.members.length >= 100) return json({ error: 'Group is full', code: 'GROUP_FULL' }, 400, request);

  // Add new member (with N3 capability snapshot — see handleGroupCreate).
  const memberRecord = { id: memberId, pub: memberPub, name: (memberName || 'Member').slice(0, 30) };
  const memberCaps = sanitizeCaps(caps);
  if (memberCaps) memberRecord.caps = memberCaps;
  group.members.push(memberRecord);
  const joined = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!joined) return json({ error: 'Failed to join group', code: 'STORE_FAILED' }, 500, request);

  return json({ ok: true, name: group.name, members: group.members, epoch: group.epoch | 0 }, 200, request);
}

async function handleGroupInfo(body, env, request) {
  const { token } = body;
  if (!token) return json({ error: 'token required', code: 'MISSING_TOKEN' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);

  const group = safeJsonParse(data);
  if (!group) return json({ error: 'Not found', code: 'NOT_FOUND' }, 404, request);
  // Touch-on-read (same pattern and reasoning as handleDeviceList): `grp:` is written ONLY by
  // membership mutations — create/join/kick/admin/rename/leave — each with a 1-month TTL. A
  // stable group that simply keeps chatting never mutates its roster, so after 30 quiet days
  // the record evaporated and every invite link, roster and moderation state went with it
  // (Socratic lifecycle lens). Reads keep an in-use group alive; throttled to 1/day/group.
  if (!globalThis._grpTouch) globalThis._grpTouch = new Map();
  if (Date.now() - (globalThis._grpTouch.get(token) || 0) > 86400000) {
    globalThis._grpTouch.set(token, Date.now());
    if (globalThis._grpTouch.size > 2000) {
      globalThis._grpTouch = new Map([...globalThis._grpTouch.entries()].slice(-1000));
    }
    await kvPut(env, `grp:${token}`, data, { expirationTtl: TTL.MONTH });
  }
  // Expose creatorId + admins so clients can render moderation badges and gate the
  // kick/admin UI to the right members (the server still re-authorizes every action).
  return json({
    name: group.name, members: group.members, creatorName: group.creatorName,
    creatorId: group.creatorId, admins: Array.isArray(group.admins) ? group.admins : [],
    epoch: group.epoch | 0, createdAt: group.createdAt,
  }, 200, request);
}

// Optional Ed25519 auth for group moderation. Group ops authorize by comparing a
// client-supplied id (adminId/memberId) against group.creatorId/admins — but creatorId is
// publicly readable via group/info, so without a caller signature ANY member (or anyone with
// the invite token) could claim an authorized id and kick members, self-promote, transfer
// ownership, rename, or delete the group. These are server-side state changes with no
// client-side crypto recourse, so the E2E model does not cover them.
//
// Verified whenever {ts,sig} are supplied (forgeries rejected); required outright when
// GROUP_REQUIRE_AUTH is set — flip that on once clients sign. Default (no sig + flag unset)
// preserves the legacy flow so current clients keep working until updated. sig is Ed25519
// over `breeze-group-${action}:${token}:${actorId}:${ts}:${bind}`, verified against the
// actor's registered edIdentityKey.
//
// `bind` carries the operation's security-relevant target(s) — kickId / newCreatorId /
// sub-action+targetId / new name — so the signature also authenticates WHAT is being done,
// not just who/which-group/when. Without it the signed payload omitted the target: the
// untrusted relay, which sees the request, could swap kickId, redirect a transfer to an
// attacker-chosen member, or turn a signed "demote X" into "promote Y" / "unban Z" while
// the signature still verified (within the 5-min window). Since no client signs yet, the
// canonical signed format is fixed here before signing goes live. Returns a Response on
// failure, or null to proceed.
async function checkGroupAuth(env, request, action, token, actorId, ts, sig, bind = '') {
  const hasSig = ts !== undefined || sig !== undefined;
  if (hasSig) {
    if (ts === undefined || sig === undefined) return json({ error: 'ts and sig must both be provided', code: 'PARTIAL_AUTH' }, 400, request);
    if (typeof sig !== 'string' || sig.length > 500) return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
    if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS) return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
    const pkRaw = await kvGet(env, `prekey:${actorId}`);
    const bundle = pkRaw ? safeJsonParse(pkRaw) : null;
    if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey) return json({ error: 'No registered identity key', code: 'NO_IDENTITY_KEY' }, 403, request);
    const ok = await verifyEd25519(bundle.edIdentityKey, utf8ToB64(`breeze-group-${action}:${token}:${actorId}:${ts}:${bind}`), sig);
    if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);
    return null;
  }
  if (env.GROUP_REQUIRE_AUTH === 'true') return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 403, request);
  return null;
}

// v3.3: Enterprise — Group member management
async function handleGroupKick(body, env, request) {
  const { token, kickId, adminId } = body;
  if (!token || !kickId || !adminId) return json({ error: 'token, kickId, adminId required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(kickId) || !validateUserId(adminId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const kAuth = await checkGroupAuth(env, request, 'kick', token, adminId, body.ts, body.sig, kickId);
  if (kAuth) return kAuth;

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);

  const group = safeJsonParse(data);
  if (!group) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  // Authorization: the creator OR any promoted admin (group.admins) may kick.
  // (group.admins is populated by handleGroupAdmin; legacy groups have only a creator.)
  const admins = Array.isArray(group.admins) ? group.admins : [];
  const requesterIsCreator = group.creatorId === adminId;
  const requesterIsAdmin = requesterIsCreator || admins.includes(adminId);
  if (!requesterIsAdmin) {
    return json({ error: 'Admin permission required', code: 'FORBIDDEN' }, 403, request);
  }
  // Cannot kick creator
  if (kickId === group.creatorId) return json({ error: 'Cannot kick group creator', code: 'FORBIDDEN' }, 400, request);
  // Only the creator can kick a fellow admin — a regular admin cannot remove its peers
  // (prevents an admin-vs-admin removal war; mirrors how most messengers scope moderation).
  if (!requesterIsCreator && admins.includes(kickId)) {
    return json({ error: 'Only the creator can remove an admin', code: 'FORBIDDEN' }, 403, request);
  }
  // Kick target must actually be a member; bumping the epoch on a no-op is wasteful
  // and would cause unnecessary sender-key churn in remaining members.
  if (!(group.members || []).some(m => m.id === kickId)) {
    return json({ error: 'Member not found', code: 'NOT_MEMBER' }, 404, request);
  }

  group.members = group.members.filter(m => m.id !== kickId);
  if (group.admins) group.admins = group.admins.filter(id => id !== kickId);
  // Durable removal: record the kick in a bounded ban list. Without it, the kicked member can
  // simply rejoin via the still-valid invite token (handleGroupJoin re-adds them and, after the
  // remaining members redistribute sender keys, restores their access) — so kick alone causes
  // only a momentary disruption. The creator can lift a ban via group/admin action:'unban'.
  // Bounded to the 200 most-recent banned ids to cap KV growth.
  const banned = Array.isArray(group.banned) ? group.banned.filter(id => typeof id === 'string') : [];
  if (!banned.includes(kickId)) banned.push(kickId);
  group.banned = banned.slice(-200);
  // I3: post-compromise removal. Bump the epoch so remaining members generate and
  // redistribute fresh sender keys (kicked member can't decrypt the new epoch).
  // Coerce to integer first: a corrupted KV entry with epoch stored as a string
  // would make '5' + 1 = '51' (concatenation), which the epoch gate '===' never
  // matches against a numeric p.ep, permanently breaking the group.
  group.epoch = (group.epoch | 0) + 1;
  const kicked = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!kicked) return json({ error: 'Failed to save group state', code: 'STORE_FAILED' }, 500, request);

  return json({ ok: true, remaining: group.members.length, epoch: group.epoch }, 200, request);
}

// Multi-admin management — the missing half of a feature that was already half-built:
// the `group.admins` array was maintained on removal (kick/leave filter it) but nothing
// ever populated it and kick ignored it, leaving the creator a single point of failure.
// Creator-only promote/demote of an existing member to/from admin. No epoch bump:
// admin status is an authorization label, not key material, so it doesn't affect crypto.
async function handleGroupAdmin(body, env, request) {
  const { token, adminId, targetId, action } = body;
  if (!token || !adminId || !targetId || !action) return json({ error: 'token, adminId, targetId, action required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(adminId) || !validateUserId(targetId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  if (action !== 'promote' && action !== 'demote' && action !== 'unban') return json({ error: "action must be 'promote', 'demote' or 'unban'", code: 'INVALID_ACTION' }, 400, request);
  // Bind BOTH the sub-action and the target: otherwise the relay could turn a signed
  // "demote X" into "promote Y" (escalation) or "unban Z" (ban bypass).
  const aAuth = await checkGroupAuth(env, request, 'admin', token, adminId, body.ts, body.sig, `${action}:${targetId}`);
  if (aAuth) return aAuth;

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  const group = safeJsonParse(data);
  if (!group || !Array.isArray(group.members)) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);

  // Only the creator manages admins — an admin cannot mint or remove other admins
  // (keeps the privilege graph a flat creator→admins tree, no escalation chains).
  if (group.creatorId !== adminId) return json({ error: 'Only the creator can manage admins', code: 'FORBIDDEN' }, 403, request);

  // Unban: lift a previous kick so the target may rejoin via the invite token. The target is
  // NOT a member (they were removed), so this is handled before the member-existence checks
  // below. Idempotent: unbanning a non-banned id is a no-op success.
  if (action === 'unban') {
    const banned = Array.isArray(group.banned) ? group.banned.filter(id => typeof id === 'string') : [];
    const bi = banned.indexOf(targetId);
    if (bi < 0) return json({ ok: true, banned, notBanned: true }, 200, request);
    banned.splice(bi, 1);
    group.banned = banned;
    const unbanSaved = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
    if (!unbanSaved) return json({ error: 'Failed to save unban', code: 'STORE_FAILED' }, 500, request);
    return json({ ok: true, banned }, 200, request);
  }

  // The creator's authority is implicit and immutable; it is never stored in `admins`.
  if (targetId === group.creatorId) return json({ error: 'Creator is always an admin', code: 'INVALID_TARGET' }, 400, request);
  if (!group.members.some(m => m.id === targetId)) return json({ error: 'Member not found', code: 'NOT_MEMBER' }, 404, request);

  const admins = Array.isArray(group.admins) ? group.admins.filter(id => typeof id === 'string') : [];
  const isAdmin = admins.includes(targetId);
  if (action === 'promote') {
    if (isAdmin) return json({ ok: true, admins, alreadyAdmin: true }, 200, request);
    admins.push(targetId);
  } else { // demote
    if (!isAdmin) return json({ ok: true, admins, notAdmin: true }, 200, request);
    const i = admins.indexOf(targetId);
    admins.splice(i, 1);
  }
  group.admins = admins;
  const adminSaved = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!adminSaved) return json({ error: 'Failed to save admin changes', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, admins }, 200, request);
}

// Ownership transfer — the companion to multi-admin. `creatorId` was immutable, so if
// the creator deleted their account (or went dark) the creator-only operations
// (delete / admin management) became permanently impossible. The current creator hands
// ownership to an existing member; the outgoing creator is retained as an admin so they
// keep moderation rights. No epoch bump — ownership is an authorization label, not key
// material, and every member's sender key is unchanged.
async function handleGroupTransfer(body, env, request) {
  const { token, adminId, newCreatorId } = body;
  if (!token || !adminId || !newCreatorId) return json({ error: 'token, adminId, newCreatorId required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(adminId) || !validateUserId(newCreatorId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const tAuth = await checkGroupAuth(env, request, 'transfer', token, adminId, body.ts, body.sig, newCreatorId);
  if (tAuth) return tAuth;

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  const group = safeJsonParse(data);
  if (!group || !Array.isArray(group.members)) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);

  // Only the current creator can transfer ownership.
  if (group.creatorId !== adminId) return json({ error: 'Only the creator can transfer ownership', code: 'FORBIDDEN' }, 403, request);
  if (newCreatorId === group.creatorId) return json({ error: 'Already the creator', code: 'NO_OP' }, 400, request);
  const newCreator = group.members.find(m => m.id === newCreatorId);
  if (!newCreator) return json({ error: 'Member not found', code: 'NOT_MEMBER' }, 404, request);

  const oldCreatorId = group.creatorId;
  // Reflect the new creator's identity in the creator* fields so handleGroupInfo and the
  // 1:1 sender-key distribution path resolve the right pub/name.
  group.creatorId = newCreatorId;
  group.creatorPub = typeof newCreator.pub === 'string' ? newCreator.pub : group.creatorPub;
  group.creatorName = (typeof newCreator.name === 'string' && newCreator.name) ? newCreator.name.slice(0, 30) : 'Creator';

  // Rebuild admins: the incoming creator's authority is now implicit (drop them from the
  // list), and the outgoing creator is retained as an admin so they keep moderation rights.
  const admins = Array.isArray(group.admins) ? group.admins.filter(id => typeof id === 'string' && id !== newCreatorId) : [];
  if (!admins.includes(oldCreatorId)) admins.push(oldCreatorId);
  group.admins = admins;

  const transferred = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!transferred) return json({ error: 'Failed to save ownership transfer', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, creatorId: newCreatorId, admins }, 200, request);
}

// Group rename — completes the lifecycle CRUD. The name was frozen at create() with
// no way to edit it; create/join/info/kick/admin/transfer/leave/delete all existed but
// "update metadata" was missing. Creator OR any admin may rename. No epoch bump — the
// name is plaintext relay metadata (already visible in info responses and push titles),
// not key material. Sanitized identically to create() so a relay-side push title can't
// be inflated past the RFC 8030 limit.
async function handleGroupRename(body, env, request) {
  const { token, adminId, name: rawName } = body;
  if (!token || !adminId) return json({ error: 'token, adminId required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(adminId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const name = sanitizeString(rawName, 50);
  if (!name) return json({ error: 'name required (1-50 chars)', code: 'INVALID_NAME' }, 400, request);
  // Bind the (sanitized) new name so the relay can't swap it for another value. The
  // signing client must sign the post-sanitization name to match.
  const rAuth = await checkGroupAuth(env, request, 'rename', token, adminId, body.ts, body.sig, name);
  if (rAuth) return rAuth;

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  const group = safeJsonParse(data);
  if (!group || !Array.isArray(group.members)) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);

  // Authorization: the creator OR any promoted admin may rename (same set as kick).
  const admins = Array.isArray(group.admins) ? group.admins : [];
  if (group.creatorId !== adminId && !admins.includes(adminId)) {
    return json({ error: 'Admin permission required', code: 'FORBIDDEN' }, 403, request);
  }

  group.name = name.slice(0, 50);
  const renamed = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!renamed) return json({ error: 'Failed to save group name', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, name: group.name }, 200, request);
}

// Member SELF-removal — the voluntary counterpart to kick. Without this a member
// who leaves a group client-side stays in the server registry (id + pub + name
// readable by anyone holding the invite token) for the full 30-day TTL. Bumps the
// epoch like kick so remaining members rotate sender keys: a departed member must
// not keep decrypting new traffic (I3 PCS applies to voluntary leave too).
async function handleGroupLeave(body, env, request) {
  const { token, memberId } = body;
  if (!token || !memberId) return json({ error: 'token, memberId required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(memberId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const lAuth = await checkGroupAuth(env, request, 'leave', token, memberId, body.ts, body.sig);
  if (lAuth) return lAuth;

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  const group = safeJsonParse(data);
  if (!group || !Array.isArray(group.members)) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);

  // The creator cannot leave their own group — a creator-less group would have
  // nobody able to kick or delete. They delete the group instead (group/delete).
  if (memberId === group.creatorId) return json({ error: 'Creator cannot leave; delete the group instead', code: 'CREATOR_CANNOT_LEAVE' }, 400, request);
  if (!group.members.some(m => m.id === memberId)) return json({ error: 'Member not found', code: 'NOT_MEMBER' }, 404, request);

  group.members = group.members.filter(m => m.id !== memberId);
  if (group.admins) group.admins = group.admins.filter(id => id !== memberId);
  // Same PCS epoch bump + integer coercion as handleGroupKick (see comment there).
  group.epoch = (group.epoch | 0) + 1;
  const left = await kvPut(env, `grp:${token}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
  if (!left) return json({ error: 'Failed to save group state', code: 'STORE_FAILED' }, 500, request);

  return json({ ok: true, remaining: group.members.length, epoch: group.epoch }, 200, request);
}

// Creator-only group deletion — the lifecycle terminator. create/join/info/kick/
// leave all existed but delete was missing, so an abandoned group lingered in KV
// for the full 30-day TTL with every member's id/pub/name readable by anyone
// holding the invite token.
async function handleGroupDelete(body, env, request) {
  const { token, adminId } = body;
  if (!token || !adminId) return json({ error: 'token, adminId required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof token !== 'string' || token.length > 128 || !/^[a-z0-9]+$/.test(token)) return json({ error: 'invalid token', code: 'INVALID_TOKEN' }, 400, request);
  if (!validateUserId(adminId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const dAuth = await checkGroupAuth(env, request, 'delete', token, adminId, body.ts, body.sig);
  if (dAuth) return dAuth;

  const data = await kvGet(env, `grp:${token}`);
  if (!data) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  const group = safeJsonParse(data);
  if (!group) return json({ error: 'Group not found', code: 'NOT_FOUND' }, 404, request);
  if (group.creatorId !== adminId) return json({ error: 'Admin permission required', code: 'FORBIDDEN' }, 403, request);

  const groupDeleted = await kvDel(env, `grp:${token}`);
  if (!groupDeleted) return json({ error: 'Failed to delete group', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true }, 200, request);
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
  // RFC 8188 §2.2 defines CEK = HMAC(PRK, "Content-Encoding: aes128gcm" || 0x00 || 0x01)[0..15].
  // That trailing 0x01 is HKDF-Expand's block counter (RFC 5869 §2.3), which WebCrypto appends
  // ITSELF — so `info` must stop at the 0x00. Passing the counter explicitly made WebCrypto add a
  // second one, yielding the wrong CEK/nonce and payloads no browser could decrypt (the round-trip
  // test hid it by hard-coding the same two strings). Matches the WebPush-info step above, which
  // already, correctly, omits the counter.
  const cekBits   = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt2,
      info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00') },
    ikm2Key, 128
  );
  const nonceBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt2,
      info: new TextEncoder().encode('Content-Encoding: nonce\x00') },
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
  if (!userId || !subscription?.endpoint) return json({ error: 'userId and subscription required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  // Optional Ed25519 ownership auth. Without it, anyone who knows a userId can register THEIR
  // OWN device under push:${userId} and then receive the victim's notifications: the Web Push
  // payload is encrypted to the SUBSCRIBER-supplied p256dh/auth, so the attacker can decrypt the
  // metadata (sender display name, message type, contactId, timing). They could also evict the
  // victim's real devices via the 5-device cap (denial of notification). Verified-when-present;
  // required when PUSH_REQUIRE_AUTH=true. Same pattern as portal/group/backup/alias auth.
  {
    const { ts, sig } = body;
    const hasSig = ts !== undefined || sig !== undefined;
    if (hasSig) {
      if (ts === undefined || sig === undefined)
        return json({ error: 'ts and sig must both be provided', code: 'PARTIAL_AUTH' }, 400, request);
      if (typeof sig !== 'string' || sig.length > 500)
        return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
      if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS)
        return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
      const pkRaw = await kvGet(env, `prekey:${userId}`);
      const bundle = pkRaw ? safeJsonParse(pkRaw) : null;
      if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
        return json({ error: 'No registered identity key', code: 'NO_IDENTITY_KEY' }, 403, request);
      // Bind the SUBSCRIPTION (endpoint + keys), not just userId+ts: otherwise a captured
      // push-subscribe signature could be replayed with the attacker's own endpoint/p256dh
      // swapped in — exactly the "register their own device" attack this auth exists to stop.
      // The client signs the same raw fields it sends (pre-sanitization).
      const subBind = `${subscription.endpoint || ''}:${subscription.keys?.p256dh || ''}:${subscription.keys?.auth || ''}`;
      const ok = await verifyEd25519(bundle.edIdentityKey, utf8ToB64(`breeze-push-subscribe:${userId}:${ts}:${subBind}`), sig);
      if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);
    } else if (env.PUSH_REQUIRE_AUTH === 'true') {
      return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 403, request);
    }
  }
  // v3.6: Validate push endpoint URL (SSRF prevention)
  try {
    const epUrl = new URL(subscription.endpoint);
    if (epUrl.protocol !== 'https:') return json({ error: 'Push endpoint must be HTTPS', code: 'INVALID_ENDPOINT' }, 400, request);
    // Only allow known push service domains
    const trusted = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'wns.windows.com', 'push.apple.com',
      'web.push.apple.com', 'push.services.mozilla.com', 'android.googleapis.com'];
    if (!trusted.some(d => epUrl.hostname === d || epUrl.hostname.endsWith('.' + d))) {
      return json({ error: 'Untrusted push endpoint', code: 'UNTRUSTED_ENDPOINT' }, 400, request);
    }
  } catch { return json({ error: 'Invalid push endpoint URL', code: 'INVALID_ENDPOINT' }, 400, request); }
  // Sanitize: only store the three fields needed for push delivery.
  // Storing the full client object would allow oversized extra fields to inflate KV.
  const safeSub = {
    endpoint: subscription.endpoint.slice(0, 512),
    keys: {
      p256dh: typeof subscription.keys?.p256dh === 'string' ? subscription.keys.p256dh.slice(0, 100) : '',
      auth:   typeof subscription.keys?.auth   === 'string' ? subscription.keys.auth.slice(0, 50)   : '',
    },
  };
  if (typeof subscription.expirationTime === 'number' && Number.isFinite(subscription.expirationTime)) safeSub.expirationTime = subscription.expirationTime;
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
  const stored = await kvPut(env, key, JSON.stringify(subs), { expirationTtl: TTL.MONTH });
  if (!stored) return json({ error: 'Failed to store subscription', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, devices: subs.length }, 200, request);
}

async function handlePushUnsubscribe(body, env, request) {
  const { userId, endpoint } = body;
  if (!userId || !endpoint) return json({ error: 'userId and endpoint required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  if (typeof endpoint !== 'string' || endpoint.length > 512) return json({ error: 'invalid endpoint', code: 'INVALID_FIELD' }, 400, request);
  // Optional Ed25519 ownership auth — mirrors handlePushSubscribe. Without it any caller who
  // knows a userId + endpoint can silently delete that user's push subscription (denial of
  // notification). Verified-when-present; required when PUSH_REQUIRE_AUTH=true.
  {
    const { ts, sig } = body;
    const hasSig = ts !== undefined || sig !== undefined;
    if (hasSig) {
      if (ts === undefined || sig === undefined)
        return json({ error: 'ts and sig must both be provided', code: 'PARTIAL_AUTH' }, 400, request);
      if (typeof sig !== 'string' || sig.length > 500)
        return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
      if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS)
        return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
      const pkRaw = await kvGet(env, `prekey:${userId}`);
      const bundle = pkRaw ? safeJsonParse(pkRaw) : null;
      if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
        return json({ error: 'No registered identity key', code: 'NO_IDENTITY_KEY' }, 403, request);
      // Bind the specific endpoint being removed so a subscribe signature cannot be replayed here.
      const ok = await verifyEd25519(bundle.edIdentityKey, utf8ToB64(`breeze-push-unsubscribe:${userId}:${ts}:${endpoint}`), sig);
      if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);
    } else if (env.PUSH_REQUIRE_AUTH === 'true') {
      return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 403, request);
    }
  }
  const key = `push:${userId}`;
  const data = await kvGet(env, key);
  if (!data) return json({ ok: true, removed: 0 }, 200, request);
  const subs = safeJsonParse(data, []);
  if (!Array.isArray(subs)) return json({ ok: true, removed: 0 }, 200, request);
  const filtered = subs.filter(s => s.endpoint !== endpoint);
  const removed = subs.length - filtered.length;
  if (removed > 0) {
    if (filtered.length === 0) await kvDel(env, key);
    else await kvPut(env, key, JSON.stringify(filtered), { expirationTtl: TTL.MONTH });
  }
  return json({ ok: true, removed }, 200, request);
}

async function sendPushToUser(userId, payload, env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const key = `push:${userId}`;
  const data = await kvGet(env, key);
  if (!data) return;
  const subs = safeJsonParse(data, []);
  if (!Array.isArray(subs)) return;
  const plaintextStr = JSON.stringify(payload);
  // Collect stale endpoints and prune them in ONE write after the loop. Removing inside
  // the loop with `subs.filter(...)` recomputed each time from the ORIGINAL `subs` clobbers
  // earlier removals: with two stale subs [A,B], the A-removal writes [B], then the
  // B-removal writes subs−B = [A] (A resurrected). Net effect was "remove only the last
  // failed sub per cycle" despite the plural intent. A cumulative post-loop prune fixes
  // that and costs one KV write instead of N.
  const stale = new Set();
  for (const sub of subs) {
    try {
      const [encrypted, jwt] = await Promise.all([
        encryptPushPayload(crypto.subtle, sub, plaintextStr),
        buildVapidJwt(crypto.subtle, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY, sub.endpoint),
      ]);
      if (!encrypted) continue; // subscription missing keys
      const resp = await fetchWithTimeout(sub.endpoint, {
        method: 'POST',
        redirect: 'manual', // never follow redirects — prevents SSRF relay via compromised push services
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
          'TTL': String(TTL.DAY),
        },
        body: encrypted,
      }, TIMEOUT_MS.PUSH);
      // 410 Gone (and 404 Not Found) mean the subscription is dead — mark for removal.
      if (resp.status === 410 || resp.status === 404) stale.add(sub.endpoint);
    } catch(e) { console.error('[push]', e?.message ?? e); }
  }
  if (stale.size > 0) {
    const remaining = subs.filter(s => !stale.has(s.endpoint));
    if (remaining.length === 0) await kvDel(env, key);
    else await kvPut(env, key, JSON.stringify(remaining), { expirationTtl: TTL.MONTH });
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
  // When TURN_REQUIRE_AUTH=true, only registered users (completed PoW + prekey upload) receive
  // TURN credentials. Prevents unauthenticated bots from draining paid TURN quota
  // (Cloudflare Calls TURN: $0.05/GB). Rate-limit alone (10 rpm) does not eliminate
  // the risk when TURN_KEY_ID is configured.
  if (env.TURN_REQUIRE_AUTH === 'true') {
    if (!(await kvGet(env, `prekey:${userId}`))) return json({ error: 'User not registered', code: 'UNREGISTERED' }, 401, request);
  }

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
      const ttl = TTL.DAY;
      const resp = await fetchWithTimeout('https://rtc.live.cloudflare.com/v1/turn/keys/' + env.TURN_KEY_ID + '/credentials/generate', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.TURN_KEY_API_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl }),
      }, TIMEOUT_MS.TURN);
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
    const ttl = TTL.DAY;
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
    return json({ iceServers, ttl: TTL.DAY, provider: 'static' }, 200, request);
  }

  // Option D: Free Open Relay (metered.ca — 20GB/month free, no config needed)
  iceServers.push(
    { urls: 'turn:a.relay.metered.ca:80', username: 'e8dd65b92f60fae75f5aefab', credential: 'uWdWNmkhvyqTEswO' },
    { urls: 'turn:a.relay.metered.ca:80?transport=tcp', username: 'e8dd65b92f60fae75f5aefab', credential: 'uWdWNmkhvyqTEswO' },
    { urls: 'turns:a.relay.metered.ca:443', username: 'e8dd65b92f60fae75f5aefab', credential: 'uWdWNmkhvyqTEswO' },
  );
  return json({ iceServers, ttl: TTL.DAY, provider: 'openrelay' }, 200, request);
}

// ============================================================
// OGP — Fetch link preview metadata (title, description, image)
// Server-side fetch to bypass CORS restrictions
// ============================================================

// ============================================================
// MULTI-ACCOUNT — Plan-based subscription
// Free=1, Lite($0.99)=2, Plus($5.99)=4, Pro($19.99)=unlimited
// ============================================================

async function handleAccountDelete(body, env, request) {
  const { userId, ts, sig, alias, groups } = body;
  if (!userId || !sig || ts === undefined) return json({ error: 'userId, ts, sig required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  if (typeof sig !== 'string' || sig.length > 500) return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
  // ±5 min freshness window bounds replay of a captured request. Replay inside
  // the window is harmless: deletion is idempotent and the prekey bundle (the
  // verification key source) is gone after the first call anyway.
  if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS) {
    return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
  }

  const data = await kvGet(env, `prekey:${userId}`);
  const bundle = data ? safeJsonParse(data) : null;
  if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey) {
    return json({ error: 'No registered identity key to authenticate deletion', code: 'NO_IDENTITY_KEY' }, 403, request);
  }
  // userId is [A-Za-z0-9+/=_-] (validateUserId) and ts is a number, so the
  // challenge string is pure ASCII — btoa() is safe.
  const challenge = `breeze-account-delete:${userId}:${ts}`;
  const ok = await verifyEd25519(bundle.edIdentityKey, btoa(challenge), sig);
  if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);

  // One-time prekeys first — the count key is needed before the bundle goes away.
  const countStr = await kvGet(env, `prekey:otp:${userId}:count`);
  const otpCount = Math.min(Math.max(parseInt(countStr || '0') || 0, 0), 100);
  const otpDels = [];
  for (let i = 0; i < otpCount; i++) otpDels.push(kvDel(env, `prekey:otp:${userId}:${i}`));
  otpDels.push(kvDel(env, `prekey:otp:${userId}:count`));
  await Promise.all(otpDels);

  // Optional alias release: only when the stored alias record's pub matches this
  // account's registered identity key — otherwise anyone could free up (squat)
  // a third party's alias by including it in their own delete request.
  let aliasDeleted = false;
  if (typeof alias === 'string' && alias) {
    const clean = alias.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    if (clean.length >= 3) {
      const aliasRec = safeJsonParse(await kvGet(env, `alias:${clean}`));
      if (aliasRec && aliasRec.pub === bundle.identityKey) {
        aliasDeleted = await kvDel(env, `alias:${clean}`);
      }
    }
  }

  // Read the billing record BEFORE deleting it so the reverse cust:{customerId} → userId
  // mapping can be erased too. Otherwise that mapping (Stripe payment identity linked to
  // this userId) survives account deletion — residual user-linked data the rest of this
  // handler erases — and a later subscription webhook lacking metadata.userId could still
  // resolve the deleted account through it. (Subscriptions created via Breeze also carry
  // userId in their metadata, so the user should still cancel via the portal before
  // deleting; this only removes the relay-side linkage.)
  let customerId = null;
  const slotsRaw = await kvGet(env, `slots:${userId}`);
  if (slotsRaw) {
    const s = safeJsonParse(slotsRaw);
    if (s && typeof s.customerId === 'string' && s.customerId) customerId = s.customerId;
  }

  const dels = [
    kvDel(env, `inbox:${userId}`),
    kvDel(env, `sealed:${userId}`),
    kvDel(env, `sealed:${userId}:hwm`), // sealed-poll high-water mark (else lingers ~5min, leaking last-delivery ts)
    kvDel(env, `prekey:${userId}`),
    kvDel(env, `ktlog:${userId}`),
    kvDel(env, `push:${userId}`),
    kvDel(env, `backup:${userId}`),
    kvDel(env, `presence:${userId}`),
    kvDel(env, `slots:${userId}`),
  ];
  if (customerId) dels.push(kvDel(env, `cust:${customerId}`));
  await Promise.all(dels);
  // Evict the in-memory presence cache too, or a same-isolate presence check
  // would keep answering "online" from stale cached data after erasure.
  globalThis._presenceCache?.delete(`presence:${userId}`);
  globalThis._presenceCache?.delete(`presence:${userId}:data`);

  // Optional group membership cleanup. There is no reverse index (user → groups),
  // so without the client supplying the tokens, a deleted account's id/pub/name
  // lingers in every group it joined for the 30-day group TTL — the same residual
  // data the rest of this handler erases. The request is already authenticated by
  // the Ed25519 signature over userId, so removing *this* user from the groups it
  // names is legitimate self-removal. Per token:
  //   - creator → delete the whole group (a creator-less group is unmoderatable;
  //     the proper survival path is /api/group/transfer BEFORE deletion).
  //   - member  → remove + epoch bump (PCS: the departed account can't decrypt new
  //     traffic), mirroring handleGroupLeave.
  const groupsLeft = [];
  const groupsDeleted = [];
  if (Array.isArray(groups)) {
    // Cap at 50 to bound KV operations on a single request (KV write budget guard).
    const tokens = groups
      .map(g => (typeof g === 'string' ? g : (g && typeof g.token === 'string' ? g.token : null)))
      .filter(tok => typeof tok === 'string' && tok.length > 0 && tok.length <= 128)
      .slice(0, 50);
    for (const tok of tokens) {
      const graw = await kvGet(env, `grp:${tok}`);
      if (!graw) continue;
      const group = safeJsonParse(graw);
      if (!group || !Array.isArray(group.members)) continue;
      if (!group.members.some(m => m.id === userId)) continue; // not a member — ignore
      if (group.creatorId === userId) {
        await kvDel(env, `grp:${tok}`);
        groupsDeleted.push(tok);
      } else {
        group.members = group.members.filter(m => m.id !== userId);
        if (Array.isArray(group.admins)) group.admins = group.admins.filter(id => id !== userId);
        group.epoch = (group.epoch | 0) + 1;
        await kvPut(env, `grp:${tok}`, JSON.stringify(group), { expirationTtl: TTL.MONTH });
        groupsLeft.push(tok);
      }
    }
  }

  const erased = ['inbox', 'sealed', 'prekeys', 'ktlog', 'push', 'backup', 'presence', 'slots'];
  if (customerId) erased.push('cust');
  return json({
    ok: true,
    erased,
    aliasDeleted,
    groupsLeft: groupsLeft.length,
    groupsDeleted: groupsDeleted.length,
  }, 200, request);
}

// ============================================================
// PREKEY DISTRIBUTION (v3 — X3DH support)
//
// Clients upload SignedPreKey + OneTimePreKeys
// Other clients fetch PreKeyBundle for session initiation
// ============================================================

// I1/G2: decode base64 to bytes + verify an Ed25519 signature. Used to
// authenticate uploaded signed pre-keys so a malicious relay can't inject its own.
// Base64 of a string's UTF-8 bytes — the encoding clients actually sign.
// signMessage() signs `new TextEncoder().encode(text)` (UTF-8), but btoa() encodes LATIN-1, so
// for any character above U+007F the two disagree. Two real failure modes, both reachable via a
// signed group rename (group names are free-form user text, and Breeze ships EN+JA):
//   - U+0100 and above (Japanese, emoji): btoa() THROWS InvalidCharacterError -> uncaught 500.
//   - U+0080..U+00FF ("cafe" with an accent): btoa() succeeds but yields the WRONG bytes, so a
//     legitimate signature is rejected with 403 SIG_INVALID.
// For pure-ASCII input this is byte-identical to btoa(), so already-working signed operations
// (kick/promote/demote/leave/delete) are unaffected.
function utf8ToB64(str) {
  let s = '';
  for (const b of new TextEncoder().encode(str)) s += String.fromCharCode(b);
  return btoa(s);
}

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
  if (!userId || !identityKey || !signedPreKey) return json({ error: 'userId, identityKey, signedPreKey required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  // Type guard: public key fields must be strings. An object/array passes the !x
  // presence check but bypasses the size guards below and gets stored as an object,
  // which breaks every client that tries to use it as a string (e.g. base64 decode).
  if (typeof identityKey !== 'string' || typeof signedPreKey !== 'string')
    return json({ error: 'identityKey/signedPreKey must be strings', code: 'INVALID_TYPE' }, 400, request);
  // Ownership proof: userId = pubB64.slice(0,12), so identityKey must start with userId.
  // Prevents any invite/token holder from registering keys under another user's identifier.
  if (!identityKey.startsWith(userId))
    return json({ error: 'identityKey does not match userId', code: 'KEY_MISMATCH' }, 400, request);
  if (edIdentityKey !== undefined && typeof edIdentityKey !== 'string')
    return json({ error: 'edIdentityKey must be a string', code: 'INVALID_TYPE' }, 400, request);
  if (signedPreKeySig !== undefined && typeof signedPreKeySig !== 'string')
    return json({ error: 'signedPreKeySig must be a string', code: 'INVALID_TYPE' }, 400, request);
  // Size-guard public key fields. Valid keys are small (P-256 JWK ≤~300 chars,
  // X25519/Ed25519 raw base64 ≤88 chars). Cap here blocks KV inflation via a
  // single huge field bypassing the aggregate body limit.
  const _IK_MAX  = 5000; // generous: full P-256 JWK with all optional fields
  const _SIG_MAX = 500;  // Ed25519 key/sig base64 is ≤88 chars; 500 is very safe
  if (identityKey.length > _IK_MAX)
    return json({ error: 'identityKey too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (edIdentityKey && edIdentityKey.length > _SIG_MAX)
    return json({ error: 'edIdentityKey too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (signedPreKey.length > _IK_MAX)
    return json({ error: 'signedPreKey too large', code: 'FIELD_TOO_LARGE' }, 400, request);
  if (signedPreKeySig && signedPreKeySig.length > _SIG_MAX)
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
  // negotiate() to pick the right protocol path (same sanitization as the presence
  // heartbeat — ≤20 strings, ≤32 chars; non-string entries silently dropped).
  const caps_ = sanitizeCaps(caps);
  if (caps_) bundle.caps = caps_;
  // Legacy compat: preserve the x3dh field from advertise() so parsePeerCaps()'s
  // fallback path (bundle.x3dh === 'v5') works for transition-period clients that
  // don't yet understand the `caps` array. Only 'v4'/'v5' are meaningful; cap to 4.
  if (typeof x3dh === 'string') bundle.x3dh = x3dh.slice(0, 4);
  const prekeySaved = await kvPut(env, `prekey:${userId}`, JSON.stringify(bundle), { expirationTtl: TTL.MONTH });
  if (!prekeySaved) return json({ error: 'Failed to store prekeys', code: 'STORE_FAILED' }, 500, request);

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
    // Cap at 100 entries — 10 was too few; an attacker could deliberately rotate
    // 11 times to evict the oldest entry and hide the initial key compromise.
    const trimmed = log.slice(-100);
    await kvPut(env, logKey, JSON.stringify(trimmed), { expirationTtl: TTL.QUARTER });
  } catch (e) { /* log failure is non-fatal */ }

  // Store one-time prekeys individually; cap each entry to prevent KV inflation.
  // Type guard: only store string entries. JSON.stringify(null) = 'null' (4 chars)
  // passes the size check and is stored, but safeJsonParse('null') = null fails the
  // bundle.oneTimePreKey assignment guard in handlePreKeyFetch — the slot is consumed
  // (deleted) without delivering a key. A single null in the uploaded array permanently
  // wastes a prekey slot for the owner without any error signal. The count must also
  // track the highest valid index, not the raw array length.
  if (Array.isArray(oneTimePreKeys)) {
    let maxStoredIdx = -1;
    for (let i = 0; i < Math.min(oneTimePreKeys.length, 100); i++) {
      if (typeof oneTimePreKeys[i] !== 'string') continue; // skip non-string entries
      const otpStr = JSON.stringify(oneTimePreKeys[i]);
      if (otpStr.length > 5000) continue; // silently skip oversized entries
      await kvPut(env, `prekey:otp:${userId}:${i}`, otpStr, { expirationTtl: TTL.MONTH });
      maxStoredIdx = i;
    }
    // Store count only when at least one key was stored (highest index + 1).
    // Avoids writing a zero count that would make replenishOTP fire unnecessarily.
    if (maxStoredIdx >= 0) {
      await kvPut(env, `prekey:otp:${userId}:count`, String(maxStoredIdx + 1), { expirationTtl: TTL.MONTH });
    }
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
  // Cap at the upload-side limit (100). A corrupted or adversarially-inflated
  // KV count would otherwise iterate hundreds of thousands of KV reads.
  const count = Math.min(Math.max(parseInt(countStr || '0') || 0, 0), 100);
  let remainingOTP = count;
  let foundAny = false;
  let consumed = false;
  // Prevent OTP drain: each source IP may consume at most one OTP per target user per 24h.
  // Draining all 100 OTPs requires 100 distinct source IPs, not 100 sequential requests.
  // The rate limit (10 rpm) bounds the rate; this bounds the total per-IP damage.
  const srcIp = request.headers.get('CF-Connecting-IP') || '';
  const ipHash = srcIp ? await sha256Short(srcIp) : '';
  const otpLockKey = ipHash ? `otp_lock:${userId}:${ipHash}` : '';
  const ipAlreadyConsumed = otpLockKey ? !!(await kvGet(env, otpLockKey)) : false;
  if (count > 0 && !ipAlreadyConsumed) {
    for (let i = count - 1; i >= 0; i--) {
      const otp = await kvGet(env, `prekey:otp:${userId}:${i}`);
      if (otp) {
        foundAny = true;
        const parsed = safeJsonParse(otp);
        // Delete BEFORE attaching to the bundle. If the delete fails (transient KV error),
        // skip this slot rather than returning an OTP we can't guarantee was exclusively
        // consumed — reusing an OTP with a second initiator degrades X3DH forward secrecy
        // (the DH4 component would no longer be per-session). A failed delete leaves the
        // slot intact for the next fetch; set replenishOTP so the client knows to retry.
        const deleted = await kvDel(env, `prekey:otp:${userId}:${i}`);
        if (!deleted) continue;
        // Only attach the OTP if it parsed cleanly; a corrupted entry was still consumed
        // above so it doesn't permanently block the slot.
        // Return the consumed index as oneTimePreKeyId: the X3DH v5 initiator echoes it
        // in the prekey message (opkId) so the responder can select the matching OTP
        // PRIVATE key (opkResolver). Without it the responder can't complete DH4.
        if (parsed !== null) { bundle.oneTimePreKey = parsed; bundle.oneTimePreKeyId = i; }
        await kvPut(env, `prekey:otp:${userId}:count`, String(i), { expirationTtl: TTL.MONTH });
        remainingOTP = i;
        consumed = true;
        // Record the consumption lock so this IP cannot drain further OTPs for this user today.
        if (otpLockKey) await kvPut(env, otpLockKey, '1', { expirationTtl: TTL.DAY });
        break;
      }
    }
  }
  // Reconcile remainingOTP with what the scan actually found. It started at the stored count,
  // but that count key can outlive its OTP entries: every fetch refreshes the count key's
  // 30-day TTL while the unconsumed entries keep their original upload-time TTL, so they can
  // all expire while count lingers. If the scan consumed nothing despite count>0, the true
  // remaining is 0 — otherwise we'd report phantom OTPs and leave replenishOTP falsely false,
  // so the owner never refreshes and new X3DH sessions silently lose DH4.
  // Skip reconciliation when ipAlreadyConsumed: the loop was intentionally bypassed; OTPs
  // still exist and the stored count is still accurate.
  if (!consumed && count > 0 && !ipAlreadyConsumed) {
    remainingOTP = 0;
    // Heal the stale count only when the entries are genuinely gone (found none). Don't touch
    // it on transient delete failures (foundAny) — those OTPs still exist and stay fetchable.
    if (!foundAny) await kvPut(env, `prekey:otp:${userId}:count`, '0', { expirationTtl: TTL.MONTH });
  }
  // Signal the owner to replenish one-time prekeys before they are exhausted.
  if (remainingOTP <= 5) bundle.replenishOTP = true;
  // Signal the owner to re-upload their signed pre-key before it expires.
  // KV TTL is 30 days; warn at 25 days so there's a 5-day window to replenish.
  if (bundle.uploadedAt && (Date.now() - bundle.uploadedAt) > 25 * TTL.DAY * 1000) bundle.replenishSPK = true;
  // I11: include key-history log so the initiator can detect unexpected IK rollovers.
  const ktLog = await kvGet(env, `ktlog:${userId}`);
  if (ktLog) {
    const parsedLog = safeJsonParse(ktLog);
    if (parsedLog !== null) bundle.keyHistory = parsedLog;
  }
  return json(bundle, 200, request);
}

// Batch prekey fetch — resolves up to 10 bundles in one round-trip so an initiator
// can set up sessions with several users (e.g. a group) without N serial requests.
// Each fetch consumes one OTP for that user, same as the single-fetch path.
// Cap at 10 to bound OTP consumption and response size.
async function handlePreKeyFetchBatch(body, env, request) {
  const { userIds } = body;
  if (!Array.isArray(userIds) || userIds.length === 0)
    return json({ error: 'userIds array required', code: 'MISSING_FIELDS' }, 400, request);
  // Validate, deduplicate, cap at 10.
  const seen = new Set();
  const cleaned = [];
  for (const id of userIds) {
    if (typeof id !== 'string') continue;
    if (!validateUserId(id) || seen.has(id)) continue;
    seen.add(id);
    cleaned.push(id);
    if (cleaned.length >= 10) break;
  }
  if (cleaned.length === 0) return json({ error: 'no valid userIds', code: 'INVALID_FIELD' }, 400, request);
  const results = {};
  for (const userId of cleaned) {
    const res = await handlePreKeyFetch({ userId }, env, request);
    if (res.status === 200) {
      try { results[userId] = await res.json(); } catch { results[userId] = null; }
    } else {
      results[userId] = null;
    }
  }
  return json({ results }, 200, request);
}

// Non-destructive prekey status check for the bundle owner. Returns OTP count,
// uploadedAt, and the replenish signals — without consuming any OTP. Useful for
// a client to self-audit its prekey health after reinstall/IDB loss, or to check
// state before deciding to replenish.
async function handlePreKeyStatus(body, env, request) {
  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const data = await kvGet(env, `prekey:${userId}`);
  if (!data) return json({ error: 'No prekeys found', code: 'NOT_FOUND' }, 404, request);
  const bundle = safeJsonParse(data);
  if (!bundle) return json({ error: 'No prekeys found', code: 'NOT_FOUND' }, 404, request);
  const countStr = await kvGet(env, `prekey:otp:${userId}:count`);
  let otpCount = Math.min(Math.max(parseInt(countStr || '0') || 0, 0), 100);
  // The count key can outlive its OTP entries (fetch refreshes count's 30-day TTL but the
  // unconsumed entries keep their original upload-time TTL). A stale count would make this
  // self-audit report phantom OTPs and suppress replenishOTP — the opposite of a health check's
  // job. The entry at index count-1 is always the next one to be consumed, and all entries from
  // one upload share a TTL, so if the top entry is gone they all are. One extra KV read detects
  // full expiry; heal the stale count when so.
  if (otpCount > 0) {
    const top = await kvGet(env, `prekey:otp:${userId}:${otpCount - 1}`);
    if (!top) {
      otpCount = 0;
      await kvPut(env, `prekey:otp:${userId}:count`, '0', { expirationTtl: TTL.MONTH });
    }
  }
  const result = {
    uploadedAt: bundle.uploadedAt,
    otpCount,
    replenishOTP: otpCount <= 5,
    replenishSPK: !!(bundle.uploadedAt && (Date.now() - bundle.uploadedAt) > 25 * TTL.DAY * 1000),
  };
  // Expose the advertised capability set (same field shape parsePeerCaps consumes) so a client
  // can read a peer's caps — e.g. the group-v5 negotiation floor — WITHOUT consuming an OTP the
  // way prekey/fetch does. This handler already reads the full bundle and touches no OTP entry.
  if (Array.isArray(bundle.caps)) result.caps = bundle.caps;
  if (typeof bundle.x3dh === 'string') result.x3dh = bundle.x3dh;
  return json(result, 200, request);
}

// I11: Standalone key-transparency log fetch. The log is a public tamper-evident
// hash chain (SHA-256 of IK hashes) — no private data, no auth required. Allows
// clients to audit a peer's key history without consuming an irreversible OTP.
async function handleKtLogGet(body, env, request) {
  const { userId } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  const raw = await kvGet(env, `ktlog:${userId}`);
  if (!raw) return json({ log: [] }, 200, request);
  const log = safeJsonParse(raw, []);
  return json({ log: Array.isArray(log) ? log : [] }, 200, request);
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
  if (!frankId || !commitment) return json({ error: 'frankId and commitment required', code: 'MISSING_FIELDS' }, 400, request);
  // Minimum 8 chars (6 bytes ≈ 2^48 combinations) prevents commitment-squatting via
  // exhaustive pre-registration of short frankId slots.
  if (typeof frankId !== 'string' || frankId.length < 8 || frankId.length > 128 || !/^[A-Za-z0-9+/=_-]+$/.test(frankId)) return json({ error: 'invalid frankId', code: 'INVALID_FIELD' }, 400, request);
  if (typeof commitment !== 'string' || commitment.length > 128 || !/^[A-Za-z0-9+/=]+$/.test(commitment)) return json({ error: 'invalid commitment', code: 'INVALID_FIELD' }, 400, request);
  // Do not overwrite an existing commitment (a frankId binds one message).
  if (await kvGet(env, `frank:${frankId}`)) return json({ ok: true, existing: true }, 200, request);
  // Propagate a write failure: a silently-dropped commitment makes the message
  // unreportable later (handleAbuseReport would 404 with no record), so the sender must
  // know franking wasn't recorded rather than believe it was.
  const stored = await kvPut(env, `frank:${frankId}`, commitment, { expirationTtl: TTL.MONTH });
  if (!stored) return json({ error: 'Failed to record franking commitment', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true }, 200, request);
}

// Recipient reports an abusive message by revealing (frankId, message, opening).
async function handleAbuseReport(body, env, request) {
  const { frankId, message, opening } = body;
  if (!frankId || typeof message !== 'string' || !opening) return json({ error: 'frankId, message, opening required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof frankId !== 'string' || frankId.length < 8 || frankId.length > 128 || !/^[A-Za-z0-9+/=_-]+$/.test(frankId)) return json({ error: 'invalid frankId', code: 'INVALID_FIELD' }, 400, request);
  if (message.length > 256 * 1024) return json({ error: 'message too large', code: 'MSG_TOO_LARGE' }, 400, request);
  // HMAC opening key is 32 bytes (base64 = 44 chars); 128 chars is generous.
  // Do NOT add a base64 regex here — malformed base64 must reach hmacVerifyFrank (try/catch → false → FRANK_MISMATCH).
  if (typeof opening !== 'string' || opening.length > 128) return json({ error: 'invalid opening', code: 'INVALID_OPENING' }, 400, request);
  const commitment = await kvGet(env, `frank:${frankId}`);
  if (!commitment) return json({ error: 'No such franking record', code: 'NOT_FOUND' }, 404, request);
  const verified = await hmacVerifyFrank(commitment, opening, message);
  if (!verified) return json({ verified: false, error: 'Report does not match the sent message', code: 'FRANK_MISMATCH' }, 400, request);
  // Fire the moderation webhook (and stamp the report) only the FIRST time a given
  // frankId is reported. The opening key Kf is delivered to the recipient inside the E2E
  // payload, so a recipient holding a valid (frankId, message, opening) tuple — or a
  // client that simply retries — could re-POST the same report. Without dedup every call
  // re-fired the operator webhook (up to the 10/min rate limit), flooding the moderation
  // queue with duplicates of one report.
  //
  // Two dedup layers, mirroring handleMsgSend/_msgDedup:
  //  1. Same-isolate (primary): a SYNCHRONOUS check-and-set on globalThis — no `await`
  //     between .has() and .set(), so concurrent retries hitting one warm isolate (the
  //     common duplicate source) are serialized by the single-threaded event loop and
  //     only the first fires.
  //  2. Cross-isolate / persistent (secondary): the KV `report:` record below.
  //
  // KV has no atomic compare-and-swap, so a cross-isolate concurrent race can still fire
  // the webhook more than once within the KV write-propagation window. The payload carries
  // `frankId` so the operator dedups receiver-side; exactly-once would require a Durable
  // Object (out of scope). This comment states what the code actually guarantees.
  const alreadyReported = await kvGet(env, `report:${frankId}`);
  // Record the verified report for moderation (idempotent on frankId — same key).
  const stored = await kvPut(env, `report:${frankId}`, JSON.stringify({ at: Date.now(), len: message.length }), { expirationTtl: TTL.QUARTER });
  if (!stored) return json({ error: 'Failed to record report', code: 'STORE_FAILED' }, 500, request);
  // Decide whether THIS request fires the webhook: not already in KV, and not already
  // fired by this isolate. The has()/set() pair is synchronous — do not insert an await.
  let fireWebhook = !alreadyReported;
  if (fireWebhook) {
    const fired = (globalThis._frankWebhookFired ||= new Map());
    if (fired.has(frankId)) {
      fireWebhook = false;
    } else {
      fired.set(frankId, 1);
      // Bounded prune (mirrors _msgDedup): keep the 500 most-recent on overflow.
      if (fired.size > 1000) { globalThis._frankWebhookFired = new Map([...fired.entries()].slice(-500)); }
    }
  }
  // Notify the operator's moderation webhook if configured (fire-and-forget).
  // Payload deliberately contains NO message content — just metadata.
  if (fireWebhook && env.ABUSE_WEBHOOK_URL && typeof env.ABUSE_WEBHOOK_URL === 'string') {
    fetchWithTimeout(env.ABUSE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'abuse_report', frankId, messageLen: message.length, at: Date.now() }),
    }, TIMEOUT_MS.WEBHOOK).catch(() => {});
  }
  return json({ verified: true, duplicate: !fireWebhook }, 200, request);
}

// ============================================================
// SEALED SENDER (v3 — metadata protection)
//
// Worker only sees recipient ID. Sender is encrypted inside payload.
// ============================================================

async function handleSealedSend(body, env, request) {
  const { to, envelope } = body;
  if (!to || !envelope) return json({ error: 'to and envelope required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(to)) return json({ error: 'invalid recipient id', code: 'INVALID_USER_ID' }, 400, request);
  if (typeof envelope !== 'string' || envelope.length > 256 * 1024) return json({ error: 'Envelope too large', code: 'PAYLOAD_TOO_LARGE' }, 400, request);
  // v3.6: In-memory dedup (saves 1 KV read + 1 KV write per sealed send)
  // Include envelope.length in the dedup key (mirrors handleMsgSend). Two envelopes
  // with identical first 32 bytes but different total sizes are distinct messages;
  // without length the second would be silently dropped as a false duplicate.
  if (!globalThis._sealedDedup) globalThis._sealedDedup = new Map();
  const dedupKey = `${to}:${envelope.length}:${envelope.slice(0, 32)}`;
  if (globalThis._sealedDedup.has(dedupKey)) return json({ ok: true, dedup: true }, 200, request);
  globalThis._sealedDedup.set(dedupKey, 1);
  if (globalThis._sealedDedup.size > 500) { const e = [...globalThis._sealedDedup.entries()]; globalThis._sealedDedup = new Map(e.slice(-200)); }

  const key = `sealed:${to}`;
  const existing = await kvGet(env, key);
  const queueParsed = existing ? safeJsonParse(existing, []) : [];
  const queue = Array.isArray(queueParsed) ? queueParsed : [];
  // Guarantee strictly-increasing ts within the sealed queue (mirrors handleMsgSend).
  // handleSealedAck uses `m.ts > hwm` (strict greater-than); if a new envelope
  // arrives in the SAME millisecond as the last polled entry (hwm), it shares that
  // ts and is deleted by the ack even though it was never polled. A +1ms bump makes
  // every appended entry strictly newer than all preceding entries — the same fix
  // already applied to the plain inbox path. The last element holds the max ts since
  // appends are sequential; no full-scan needed.
  const newTs = queue.length > 0 && Number.isFinite(queue[queue.length - 1].ts)
    ? Math.max(Date.now(), queue[queue.length - 1].ts + 1)
    : Date.now();
  queue.push({ envelope, ts: newTs });
  const trimmed = capQueueBytes(queue.slice(-100), m => (typeof m.envelope === 'string' ? m.envelope.length : 0) + 128);
  // Queue overflow drops the OLDEST envelopes. Don't do it silently (Socratic round —
  // "what happens to message 101 while the recipient is offline?"): count the drops so the
  // recipient's next poll can say "N messages were lost", instead of them never knowing.
  const droppedNow = queue.length - trimmed.length;
  if (droppedNow > 0) {
    const prev = parseInt(await kvGet(env, `${key}:dropped`) || '0') || 0;
    await kvPut(env, `${key}:dropped`, String(Math.min(prev + droppedNow, 99999)), { expirationTtl: TTL.WEEK });
  }
  const stored = await kvPut(env, key, JSON.stringify(trimmed), { expirationTtl: TTL.WEEK });
  if (!stored) {
    // Un-mark the dedup key on a failed store (set before this write): otherwise the
    // client's retry of the identical envelope is swallowed as a duplicate and lost on
    // the "reliable" sealed path. Mirrors handleMsgSend.
    globalThis._sealedDedup.delete(dedupKey);
    return json({ error: 'Failed to store sealed message', code: 'STORE_FAILED' }, 500, request);
  }
  // Lost-write recovery. `sealed:{to}` is one KV value mutated read-modify-write, and KV is
  // last-write-wins with no transactions: two senders writing to the SAME recipient in the same
  // instant both read the old queue, one envelope disappears — and BOTH senders are answered
  // 200. The silence is the defect, not the race: a rare loss you can see is an inconvenience,
  // a rare loss you cannot is a messenger that drops messages.
  //
  // Reading the key back catches the common case for ONE extra read on the SEND path, which is
  // cold next to polling (every 3 s per user). Deliberately NOT the textbook fix — splitting
  // the queue into a key per envelope removes the race outright, but replaces one `get` per
  // poll with a `list` plus a `get` per message on the hottest path in a relay that already
  // throttles presence writes to survive the free tier's 1000 writes/day. This is recovery,
  // not exactly-once (SECURITY.md says so plainly), and it cannot make delivery worse: a stale
  // read just skips the retry, and a duplicate re-append is dropped by the recipient's msgId
  // dedup.
  //
  // Identity is the ENVELOPE, not the timestamp. Matching on ts alone looked cheaper and was
  // wrong: the racing writer's entry can carry the same millisecond, so the check would report
  // "mine is present" in exactly the case it exists to detect. The length test short-circuits
  // the string compare for the common case. (Caught by the deterministic race test, which is
  // the point of writing one.)
  const verifyRaw = await kvGet(env, key);
  const seen = verifyRaw ? safeJsonParse(verifyRaw, []) : [];
  const mine = (m) => m && typeof m.envelope === 'string'
    && m.envelope.length === envelope.length && m.envelope === envelope;
  if (Array.isArray(seen) && !seen.some(mine)) {
    seen.push({ envelope, ts: newTs });
    const requeued = capQueueBytes(seen.slice(-100), (m) => (typeof m.envelope === 'string' ? m.envelope.length : 0) + 128);
    await kvPut(env, key, JSON.stringify(requeued), { expirationTtl: TTL.WEEK });
  }
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
  await kvPut(env, key, data, { expirationTtl: TTL.MIN * 5 }); // 5 min grace
  // Record a high-water mark (max ts returned) so the later ACK clears ONLY what was
  // actually polled. handleSealedAck previously blind-deleted the whole queue, so any
  // envelope appended by handleSealedSend in the poll→ack window was destroyed
  // undelivered — a silent loss on the "reliable" sealed path. Only written when there
  // are messages, so idle polls (the common case) still do zero extra KV writes.
  let maxTs = 0;
  for (const m of messages) { if (Number.isFinite(m?.ts) && m.ts > maxTs) maxTs = m.ts; }
  if (maxTs > 0) await kvPut(env, `${key}:hwm`, String(maxTs), { expirationTtl: TTL.MIN * 5 });
  // Surface queue-overflow losses once, then reset the counter (see handleSealedSend).
  const droppedStr = await kvGet(env, `${key}:dropped`);
  const dropped = parseInt(droppedStr || '0') || 0;
  if (dropped > 0) await kvDel(env, `${key}:dropped`);
  return json(dropped > 0 ? { messages, dropped } : { messages }, 200, request);
}

// v3.6: Sealed ACK — client confirms processing, worker deletes messages
async function handleSealedAck(body, env, request) {
  const { id } = body;
  if (!id || typeof id !== 'string') return json({ error: 'id required', code: 'MISSING_ID' }, 400, request);
  if (!validateUserId(id)) return json({ error: 'invalid id', code: 'INVALID_ID' }, 400, request);
  // Clear only what the client actually polled. handleSealedPoll records a high-water mark
  // (max ts of the returned batch); here we keep any envelope with ts > hwm, i.e. one that
  // arrived in the poll→ack window, instead of blind-deleting the whole queue and losing it.
  // kvDel/kvPut return false on a genuine KV API error (not on key-not-found, which is
  // idempotent); report failure so the client retries rather than believing it was cleared.
  const hwmKey = `sealed:${id}:hwm`;
  const hwmRaw = await kvGet(env, hwmKey);
  const hwm = hwmRaw !== null ? parseInt(hwmRaw) : NaN;
  if (Number.isFinite(hwm)) {
    const raw = await kvGet(env, `sealed:${id}`);
    const queue = raw ? safeJsonParse(raw, []) : [];
    const remaining = Array.isArray(queue) ? queue.filter(m => Number.isFinite(m?.ts) && m.ts > hwm) : [];
    let ok;
    if (remaining.length === 0) ok = await kvDel(env, `sealed:${id}`);
    else ok = await kvPut(env, `sealed:${id}`, JSON.stringify(remaining), { expirationTtl: TTL.WEEK });
    if (!ok) return json({ error: 'Failed to confirm delivery', code: 'ACK_FAILED' }, 500, request);
    await kvDel(env, hwmKey); // best-effort marker cleanup (also expires via its own TTL)
    return json({ ok: true, kept: remaining.length }, 200, request);
  }
  // No high-water mark (client never polled, or a pre-hwm ACK): fall back to full delete.
  const deleted = await kvDel(env, `sealed:${id}`);
  if (!deleted) return json({ error: 'Failed to confirm delivery', code: 'ACK_FAILED' }, 500, request);
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
  const { userId, backup, ts, sig } = body;
  if (!userId || !backup) return json({ error: 'userId and backup required', code: 'MISSING_FIELDS' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);
  if (typeof backup !== 'string') return json({ error: 'backup must be a string', code: 'INVALID_FIELD' }, 400, request);

  // Optional Ed25519 auth: callers may include { ts, sig } to prove ownership of the
  // account's identity key before overwriting the backup. When omitted the upload is
  // unauthenticated (backward-compat). Both fields must be present or both absent.
  const hasSig = ts !== undefined || sig !== undefined;
  if (hasSig) {
    if (ts === undefined || sig === undefined)
      return json({ error: 'ts and sig must both be provided together', code: 'PARTIAL_AUTH' }, 400, request);
    if (typeof sig !== 'string' || sig.length > 500)
      return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
    if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS)
      return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
    const data = await kvGet(env, `prekey:${userId}`);
    const bundle = data ? safeJsonParse(data) : null;
    if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
      return json({ error: 'No registered identity key', code: 'NO_IDENTITY_KEY' }, 403, request);
    const challenge = `breeze-backup-upload:${userId}:${ts}`;
    const ok = await verifyEd25519(bundle.edIdentityKey, btoa(challenge), sig);
    if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);
  } else if (env.BACKUP_REQUIRE_AUTH === 'true') {
    return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 403, request);
  }

  // Store (max 5MB per backup)
  if (backup.length > 5 * 1024 * 1024) return json({ error: 'Backup too large', code: 'PAYLOAD_TOO_LARGE' }, 413, request);
  const backupSaved = await kvPut(env, `backup:${userId}`, backup, { expirationTtl: TTL.QUARTER }); // 90 day retention
  if (!backupSaved) return json({ error: 'Failed to store backup', code: 'STORE_FAILED' }, 500, request);
  // Tell the client WHEN this backup dies. The relay deletes it 90 days after the last
  // upload and nothing refreshes it, so a user who "made a backup" a year ago has no backup
  // — while SECURITY.md tells multi-device users a backup is their recovery path for root
  // loss. Silent expiry of a safety net is the failure users can least afford to discover
  // late (Socratic lifecycle lens); disclosure is the honest minimum.
  return json({ ok: true, size: backup.length, authenticated: hasSig, expiresAt: Date.now() + TTL.QUARTER * 1000 }, 200, request);
}

async function handleBackupDownload(body, env, request) {
  const { userId, ts, sig } = body;
  if (!userId) return json({ error: 'userId required', code: 'MISSING_USER_ID' }, 400, request);
  if (!validateUserId(userId)) return json({ error: 'invalid userId', code: 'INVALID_USER_ID' }, 400, request);

  // Optional Ed25519 auth: callers may include { ts, sig } to prove ownership before
  // retrieving the backup. Both fields must be present or both absent.
  // Set BACKUP_REQUIRE_AUTH=true to reject unauthenticated requests — recommended once
  // all clients register an Ed25519 identity key (same pattern as PORTAL_REQUIRE_AUTH /
  // GROUP_REQUIRE_AUTH). Without it, knowing a userId is enough to download the encrypted
  // blob and brute-force the passphrase offline.
  const hasSig = ts !== undefined || sig !== undefined;
  if (hasSig) {
    if (ts === undefined || sig === undefined)
      return json({ error: 'ts and sig must both be provided together', code: 'PARTIAL_AUTH' }, 400, request);
    if (typeof sig !== 'string' || sig.length > 500)
      return json({ error: 'invalid sig', code: 'INVALID_FIELD' }, 400, request);
    if (typeof ts !== 'number' || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > TIMEOUT_MS.REQ_TS)
      return json({ error: 'timestamp out of range', code: 'INVALID_TIMESTAMP' }, 400, request);
    const data = await kvGet(env, `prekey:${userId}`);
    const bundle = data ? safeJsonParse(data) : null;
    if (!bundle || typeof bundle.edIdentityKey !== 'string' || !bundle.edIdentityKey)
      return json({ error: 'No registered identity key', code: 'NO_IDENTITY_KEY' }, 403, request);
    const challenge = `breeze-backup-download:${userId}:${ts}`;
    const ok = await verifyEd25519(bundle.edIdentityKey, btoa(challenge), sig);
    if (!ok) return json({ error: 'Invalid signature', code: 'SIG_INVALID' }, 403, request);
  } else if (env.BACKUP_REQUIRE_AUTH === 'true') {
    return json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 403, request);
  }

  const backup = await kvGet(env, `backup:${userId}`);
  if (!backup) return json({ error: 'No backup found', code: 'NOT_FOUND' }, 404, request);
  return json({ backup, authenticated: hasSig }, 200, request);
}

// ═══════════════════════════════════════════════════════════
// DEAD DROP — One-time encrypted secret sharing
// Strategy: Primary SEO/viral acquisition tool
// Client encrypts with random key → key goes in URL fragment (never sent to server)
// Server stores ciphertext → single read → auto-delete
// ═══════════════════════════════════════════════════════════
async function handleDropCreate(body, env, request) {
  const { ct, ttl } = body;
  let id = body.id;
  // Server-generated IDs eliminate the check-then-set collision race entirely.
  // Client-provided IDs are accepted for backward compatibility (e.g. existing clients).
  if (id !== undefined) {
    // Minimum 16 chars prevents predictable/enumerable custom IDs (e.g. "drop-1").
    // The client always sends 24-char random IDs; existing integrations are unaffected.
    if (typeof id !== 'string' || id.length < 16 || id.length > 64 || !/^[A-Za-z0-9_\-.]+$/.test(id))
      return json({ error: 'invalid id (16-64 alphanumeric/_/./- chars)', code: 'INVALID_ID' }, 400, request);
  } else {
    id = crypto.randomUUID().replace(/-/g, '');
  }
  if (!ct) return json({ error: 'ct required', code: 'MISSING_FIELDS' }, 400, request);
  if (typeof ct !== 'string' || ct.length > 100000) return json({ error: 'ct too large (max 100KB)', code: 'PAYLOAD_TOO_LARGE' }, 400, request);
  const ttlSec = Math.min(Math.max(parseInt(ttl) || TTL.DAY, TTL.MIN * 5), TTL.WEEK); // 5min - 7days, default 24h
  const key = `drop:${id}`;
  const existing = await kvGet(env, key);
  if (existing) return json({ error: 'id collision', code: 'COLLISION' }, 409, request);
  const stored = await kvPut(env, key, JSON.stringify({ ct, createdAt: Date.now() }), { expirationTtl: ttlSec });
  if (!stored) return json({ error: 'Failed to store drop', code: 'STORE_FAILED' }, 500, request);
  return json({ ok: true, id, ttl: ttlSec }, 200, request);
}

async function handleDropRead(body, env, request) {
  const { id } = body;
  if (!id || typeof id !== 'string' || id.length < 16 || id.length > 64 || !/^[A-Za-z0-9_\-.]+$/.test(id)) return json({ error: 'invalid id', code: 'INVALID_ID' }, 400, request);
  const key = `drop:${id}`;
  const raw = await kvGet(env, key);
  if (!raw) return json({ error: 'Not found or already read', code: 'NOT_FOUND' }, 404, request);
  const data = safeJsonParse(raw);
  if (!data) return json({ error: 'Not found or already read', code: 'NOT_FOUND' }, 404, request);
  // One-time read: delete BEFORE returning so a KV failure keeps the drop intact
  // for a retry rather than leaking the ciphertext without consuming the slot.
  const consumed = await kvDel(env, key);
  if (!consumed) return json({ error: 'Failed to consume drop', code: 'DEL_FAILED' }, 500, request);
  return json({ ct: data.ct, createdAt: data.createdAt }, 200, request);
}

// SSRF host/scheme blocklist (RFC 1918, loopback, link-local, cloud metadata).
// Returns true when the given parsed URL must NOT be fetched. Shared by the initial
// OGP request AND every redirect hop — validating only the initial URL is a bypass:
// a public URL can 302-redirect to http://169.254.169.254/ (metadata) or an internal
// host, and `redirect: 'follow'` would chase it past the guard.
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

async function sha256Short(text) {
  // 16 bytes (32 hex chars) → 2^64 birthday-collision resistance, up from 8 bytes (2^32).
  // KV cache keys are 'ogp:' prefixed; the extra 16 chars are negligible
  // vs. the 512-byte KV key limit and removes the theoretically-breakable 2^32 window.
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const hdrs = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': String(TTL.DAY),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), accelerometer=(), gyroscope=(), magnetometer=(), ambient-light-sensor=()',
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
  try { return await env.KV.get(key); } catch(e) { console.error('[kv] GET failed:', e?.message ?? e); return null; }
}
async function kvPut(env, key, value, opts) {
  try { await env.KV.put(key, value, opts); return true; } catch(e) { console.error('[kv] PUT failed:', e?.message ?? e); return false; }
}
async function kvDel(env, key) {
  try { await env.KV.delete(key); return true; } catch(e) { console.error('[kv] DEL failed:', e?.message ?? e); return false; }
}

// ================================================================

// Named exports for unit testing. Cloudflare Pages uses the `export default`
// above; these additional named exports are inert at runtime and let the test
// harness import individual handlers/helpers directly. Do not remove.
export {
  handlePreKeyUpload,
  handlePreKeyFetch,
  handlePreKeyFetchBatch,
  handlePreKeyStatus,
  handleKtLogGet,
  verifyEd25519,
  handleAbuseRecord,
  handleAbuseReport,
  hmacVerifyFrank,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handleGroupCreate,
  handleGroupJoin,
  handleGroupInfo,
  handleGroupKick,
  handleGroupAdmin,
  handleGroupTransfer,
  handleGroupRename,
  handleGroupLeave,
  handleGroupDelete,
  handleAccountDelete,
  handleSealedSend,
  handleSealedPoll,
  handleSealedAck,
  handleMsgSend,
  handleMsgPoll,
  handleAliasSet,
  handleAliasGet,
  handleDeviceSet,
  handleDeviceList,
  handleAliasDelete,
  validateUserId,
  sanitizeString,
  capQueueBytes,
  kvGet,
  kvPut,
  kvDel,
  encryptPushPayload,
  buildVapidJwt,
  sendPushToUser,
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
  handleTurn,
};

