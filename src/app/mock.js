// ============================================================================
// MOCK / SHOWROOM MODE — a fully local pseudo-relay and seed-data generator.
// Active only when the serving copy sets window.__BREEZE_MOCK__ = true before
// index.html boots. The module never fabricates cryptographic primitives:
// prekey material it mints is ordinary WebCrypto key material, messages still
// go through the app's real encryption path, and features that need a real
// peer are declined by the caller as unavailable.
// ============================================================================

export function mockEnabled() {
  return globalThis.__BREEZE_MOCK__ === true;
}

function b64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function urlParts(input) {
  const raw = typeof input === 'string' ? input : String(input?.url || input || '');
  const base = globalThis.location?.origin || 'http://localhost';
  const url = new URL(raw, base);
  const api = url.pathname === '/api' || url.pathname.startsWith('/api/');
  let path = url.pathname;
  if (path.startsWith('/api/')) path = path.slice(4);
  else if (path === '/api') path = '/';
  return { url, path, api, sameOrigin: url.origin === base };
}

const API_ENDPOINTS = new Set([
  '/health', '/relay/attest', '/prekey/upload', '/prekey/fetch', '/prekey/status', '/prekey/fetch/batch',
  '/msg/send', '/msg/poll', '/sealed/send', '/sealed/poll', '/sealed/ack', '/signal', '/presence',
  '/alias/get', '/alias/set', '/alias/delete', '/ktlog/get', '/group/create', '/group/info', '/group/join',
  '/group/rename', '/group/kick', '/group/admin', '/group/leave', '/turn', '/abuse/record', '/abuse/report',
  '/push/subscribe', '/push/unsubscribe', '/backup/upload', '/backup/download', '/backup/simple-upload', '/backup/simple-download', '/backup/simple-delete', '/drop/create', '/drop/read',
  '/account/delete', '/account/activity', '/device/set', '/device/list', '/group/transfer', '/group/delete', '/cf-proxy',
]);

export function isMockApiPath(input) {
  try {
    const { path, api } = urlParts(input);
    return API_ENDPOINTS.has(path) || api;
  } catch { return false; }
}

async function genDhKey() {
  try { return await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']); }
  catch { return await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']); }
}

async function pubB64(key) {
  return b64(await crypto.subtle.exportKey('raw', key));
}

async function makePeerBundle(identityPubB64) {
  const spk = await genDhKey();
  const spkPub = await pubB64(spk.publicKey);
  const otp = await genDhKey();
  const out = {
    identityKey: identityPubB64,
    signedPreKey: spkPub,
    oneTimePreKey: await pubB64(otp.publicKey),
    oneTimePreKeyId: 0,
    caps: ['seal-v2', 'group-v5', 'group-author-sig-v1', 'multi-relay', 'call-e2e', 'profile-v1', 'sticker-v1', 'loc-v1'],
  };
  try {
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    out.edIdentityKey = await pubB64(ed.publicKey);
    const spkRaw = await crypto.subtle.exportKey('raw', spk.publicKey);
    out.signedPreKeySig = b64(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spkRaw));
    out.caps.unshift('x3dh-v5');
  } catch { /* legacy-shaped bundle: the app's classical fallback stays real */ }
  return out;
}

export async function makeMockPeer(nameKey) {
  const ik = await genDhKey();
  const pub = await pubB64(ik.publicKey);
  const peer = { id: pub.slice(0, 12), pubB64: pub, nameKey };
  peer.bundle = await makePeerBundle(pub);
  return peer;
}

export function buildSeedPlan(peers, t, now, self, minuteMs) {
  const [a, b, c] = peers;
  const ts = (mins) => now - mins * minuteMs;
  const contacts = [
    { id: a.id, pubB64: a.pubB64, name: t('mockContactAoi'), addedAt: ts(4320), unread: 1, mock: true, lastMsg: t('mockSeedA3'), lastMsgAt: ts(38) },
    { id: b.id, pubB64: b.pubB64, name: t('mockContactHana'), addedAt: ts(4300), unread: 0, mock: true, lastMsg: t('mockSeedB3'), lastMsgAt: ts(180) },
    { id: c.id, pubB64: c.pubB64, name: t('mockContactRen'), addedAt: ts(4200), unread: 0, mock: true, lastMsg: '', lastMsgAt: ts(1400) },
    { id: 'mock-group', pubB64: '', name: t('mockGroupName'), isGroup: true, createdBy: self.id, admins: [self.id], mock: true,
      members: [self, ...[a, b].map(p => ({ id: p.id, pubB64: p.pubB64, name: t(p.nameKey) }))],
      addedAt: ts(4100), unread: 0, lastMsg: t('mockSeedG2'), lastMsgAt: ts(75) },
  ];
  const msg = (contactId, n, text, mine, at, extra = {}) => ({ msgId: contactId + ':' + at + ':seed' + n, contactId, text, mine, ts: at, ...extra });
  const messages = [
    msg(a.id, 1, t('mockSeedA1'), false, ts(42)), msg(a.id, 2, t('mockSeedA2'), true, ts(40)), msg(a.id, 3, t('mockSeedA3'), false, ts(38)),
    msg(b.id, 1, t('mockSeedB1'), false, ts(184)), msg(b.id, 2, t('mockSeedB2'), true, ts(182)), msg(b.id, 3, t('mockSeedB3'), false, ts(180)),
    msg('mock-group', 1, t('mockSeedG1'), false, ts(80), { senderName: t('mockContactAoi'), senderId: a.id }),
    msg('mock-group', 2, t('mockSeedG2'), true, ts(75), { senderName: self.name }),
  ];
  return { contacts, messages };
}

export function createMockApi({ nativeFetch } = {}) {
  const peers = new Map(); // short id -> { pubB64, bundle }
  const uploaded = new Map();
  const groups = new Map();
  const activities = new Map();
  let samplePromise = null;

  async function registerContact(pubB64Value, bundle = null) {
    if (typeof pubB64Value !== 'string' || pubB64Value.length < 12) return null;
    const id = pubB64Value.slice(0, 12);
    const existing = peers.get(id);
    if (existing) return existing;
    const peer = { pubB64: pubB64Value, bundle: null };
    peer.ready = (bundle ? Promise.resolve(bundle) : makePeerBundle(pubB64Value)).then(b => { peer.bundle = b; return peer; });
    peers.set(id, peer);
    await peer.ready;
    return peer;
  }

  async function samplePeers() {
    if (!samplePromise) samplePromise = Promise.all(['mockContactAoi', 'mockContactHana', 'mockContactRen'].map(makeMockPeer)).then(async made => {
      for (const p of made) await registerContact(p.pubB64, p.bundle);
      return made;
    });
    return samplePromise;
  }

  async function bundleFor(userId, consume) {
    const up = uploaded.get(userId);
    if (up) {
      const b = { ...up };
      if (consume && !b.oneTimePreKey && Array.isArray(b.oneTimePreKeys)) { b.oneTimePreKey = b.oneTimePreKeys[0]; b.oneTimePreKeyId = 0; }
      if (!consume) { delete b.oneTimePreKey; delete b.oneTimePreKeyId; }
      return b;
    }
    const peer = peers.get(userId);
    if (peer?.ready) await peer.ready;
    if (!peer?.bundle) return null;
    const b = { ...peer.bundle };
    if (!consume) { delete b.oneTimePreKey; delete b.oneTimePreKeyId; }
    return b;
  }

  function bodyOf(opts) {
    try { return opts?.body ? JSON.parse(opts.body) : {}; } catch { return {}; }
  }

  async function handle(path, opts) {
    const body = bodyOf(opts);
    switch (path) {
      case '/health':
        return json({ ok: true, serverTime: Date.now(), features: { ai: false, translate: false, push: false, turn: false, ws: false, signalWake: false, backupStorage: false } });
      case '/prekey/upload':
        if (body.userId && body.identityKey) uploaded.set(body.userId, { ...body, uploadedAt: body.uploadedAt || Date.now() });
        return json({ ok: true });
      case '/prekey/status': {
        const b = await bundleFor(body.userId, false);
        return b ? json({ ...b, otpCount: 20, replenishOTP: false, replenishSPK: false }) : json({ error: 'not found' }, 404);
      }
      case '/prekey/fetch': {
        const b = await bundleFor(body.userId, true);
        return b ? json(b) : json({ error: 'not found' }, 404);
      }
      case '/prekey/fetch/batch': {
        const results = {};
        for (const id of Array.isArray(body.userIds) ? body.userIds : []) results[id] = await bundleFor(id, false);
        return json({ results });
      }
      case '/presence': {
        if (body.check) {
          const online = {};
          for (const id of Array.isArray(body.ids) ? body.ids : []) online[id] = peers.has(id);
          return json({ ok: true, online, devTs: {} });
        }
        return json({ ok: true });
      }
      case '/msg/poll':
      case '/sealed/poll':
        return json({ ok: true, messages: [], dropped: 0, sigGen: 0 });
      case '/msg/send':
      case '/sealed/send':
        return json({ ok: true, ack: true });
      case '/sealed/ack':
        return json({ ok: true });
      case '/signal':
        return json(body.type === 'poll' ? { ok: true, messages: [], sigGen: 0 } : { ok: true });
      case '/alias/get':
        return json({ error: 'not found' }, 404);
      case '/alias/set':
      case '/alias/delete':
      case '/abuse/record':
      case '/abuse/report':
      case '/push/subscribe':
      case '/push/unsubscribe':
      case '/backup/upload':
      case '/backup/simple-upload':
      case '/backup/simple-delete':
      case '/device/set':
        return json({ ok: true });
      case '/account/activity':
        if (body.event?.userId) {
          const list = activities.get(body.event.userId) || [];
          if (!list.some(e => e.kind === body.event.kind && e.id === body.event.id)) list.push(body.event);
          activities.set(body.event.userId, list.slice(-64));
          return json({ ok: true });
        }
        return json({ events: activities.get(body.userId) || [], complete: true });
      case '/backup/download':
      case '/backup/simple-download':
        return json({ error: 'not found' }, 404);
      case '/device/list':
        return json({ ok: true, devices: [] });
      case '/ktlog/get':
        return json({ ok: true, log: [] });
      case '/group/create': {
        const token = 'mock' + Math.random().toString(36).slice(2, 12);
        groups.set(token, { token, name: body.name || 'Room', creatorId: body.creatorId, creatorName: body.creatorName || '', members: [{ id: body.creatorId, pub: body.creatorPub, name: body.creatorName || '' }], admins: [body.creatorId], epoch: 0, createdAt: Date.now() });
        return json({ token, name: body.name || 'Room', memberCount: 1 }, 201);
      }
      case '/group/info': {
        const g = groups.get(body.token);
        return g ? json({ name: g.name, members: g.members, creatorName: g.creatorName, creatorId: g.creatorId, admins: g.admins, epoch: g.epoch, createdAt: g.createdAt }) : json({ error: 'not found' }, 404);
      }
      case '/group/join':
      case '/group/rename':
      case '/group/kick':
      case '/group/admin':
      case '/group/leave':
      case '/group/transfer':
      case '/group/delete':
        return json({ ok: true });
      default:
        return json({ error: 'mock unavailable' }, 503);
    }
  }

  async function fetchMock(input, opts = {}) {
    let parts;
    try { parts = urlParts(input); } catch { return json({ error: 'mock unavailable' }, 503); }
    if (!parts.sameOrigin) {
      if (parts.api) return API_ENDPOINTS.has(parts.path) ? handle(parts.path, opts) : json({ error: 'mock unavailable' }, 503);
      return json({ error: 'mock unavailable' }, 503);
    }
    if (parts.api) return API_ENDPOINTS.has(parts.path) ? handle(parts.path, opts) : json({ error: 'mock unavailable' }, 503);
    if (nativeFetch) return nativeFetch(input, opts);
    return json({ error: 'mock unavailable' }, 503);
  }

  return { fetch: fetchMock, registerContact, samplePeers, handle, peers };
}

let _apiSingleton = null;
export function mockApi() {
  if (!mockEnabled()) return null;
  if (!_apiSingleton) _apiSingleton = createMockApi({ nativeFetch: globalThis.fetch?.bind(globalThis) });
  return _apiSingleton;
}

export function createMock(D) {
  if (!mockEnabled()) return null;
  const api = mockApi();
  const timers = new Map();

  function installBanner() {
    const el = D.dom?.('mock-banner');
    if (el) el.classList.remove('hidden');
  }

  async function seedIfNeeded() {
    try {
      if (await D.dbGet('settings', 'mockSeeded')) return false;
      const made = await api.samplePeers();
      const self = { id: D.myId(), pubB64: D.myPubB64(), name: D.myName() };
      const plan = buildSeedPlan(made, D.t, Date.now(), self, D.MS.MIN);
      for (const c of plan.contacts) await D.dbPut('contacts', c);
      for (const m of plan.messages) await D.dbPut('messages', m);
      await D.dbPut('settings', { v: 1, ts: Date.now() }, 'mockSeeded');
      return true;
    } catch(e) { D.dbg?.(e, 'mock-seed'); return false; }
  }

  function afterSend(contact) {
    try {
      if (!contact?.id) return;
      if (timers.has(contact.id)) clearTimeout(timers.get(contact.id));
      const timer = setTimeout(async () => {
        timers.delete(contact.id);
        try {
          const now = Date.now();
          const isGroup = !!contact.isGroup;
          const sender = isGroup ? (contact.members || []).find(m => m.id && m.id !== D.myId()) : null;
          const text = D.t(isGroup ? 'mockGroupReply' : 'mockReply');
          const meta = { msgId: contact.id + ':' + now + ':mock', ...(isGroup && sender ? { senderName: sender.name, senderId: sender.id } : {}) };
          await D.dbPut('messages', { msgId: meta.msgId, contactId: contact.id, text, mine: false, ts: now, ...meta });
          const stored = await D.dbGet('contacts', contact.id).catch(() => null);
          if (stored) {
            stored.lastMsg = text.slice(0, 40); stored.lastMsgAt = now;
            if (D.activeContact()?.id !== contact.id) stored.unread = (stored.unread || 0) + 1;
            await D.dbPut('contacts', stored);
          }
          if (D.activeContact()?.id === contact.id) D.appendMsg(text, false, now, null, null, meta);
          D.renderContacts();
        } catch(e) { D.dbg?.(e, 'mock-reply'); }
      }, D.MS.SEC);
      timers.set(contact.id, timer);
    } catch(e) { D.dbg?.(e, 'mock-after-send'); }
  }

  return { enabled: true, installBanner, seedIfNeeded, afterSend, registerContact: api.registerContact };
}
