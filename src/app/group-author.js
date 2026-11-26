export const GROUP_AUTHOR_CAP = 'group-author-sig-v1';
const DOMAIN = 'BreezeGroupAuthor/v1';
const encoder = new TextEncoder();
const MAX_PAYLOAD = 256 * 1024, WINDOW = 1024;
const uint32 = n => Number.isInteger(n) && n >= 0 && n <= 0xFFFFFFFF;
const base64 = bytes => btoa(String.fromCharCode(...bytes));
const decode64 = (s, length) => {
  if (typeof s !== 'string' || s.length !== Math.ceil(length / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) throw new Error('group author encoding');
  const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  if (bytes.length !== length || base64(bytes) !== s) throw new Error('group author length');
  return bytes;
};
function field(s, max) {
  if (typeof s !== 'string' || !s.length || s.length > max) throw new Error('group author field');
  const bytes = encoder.encode(s);
  if (bytes.length > max) throw new Error('group author bytes');
  const result = new Uint8Array(4 + bytes.length);
  new DataView(result.buffer).setUint32(0, bytes.length);
  result.set(bytes, 4);
  return result;
}
function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
export function groupAuthorTranscript(groupId, author, epoch, counter, payload) {
  if (!uint32(epoch) || !uint32(counter)) throw new Error('group author counter');
  const numbers = new Uint8Array(8), view = new DataView(numbers.buffer);
  view.setUint32(0, epoch); view.setUint32(4, counter);
  return concat([encoder.encode(DOMAIN), field(groupId, 64), field(author, 128), numbers, field(payload, MAX_PAYLOAD)]);
}
function payloadNumbers(payload) {
  if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD) throw new Error('group author payload');
  const p = JSON.parse(payload);
  if (p?.g !== true || ![3, 5].includes(p.v) || !uint32(p.ep) || !uint32(p.c)) throw new Error('group author header');
  return p;
}
function capabilityTranscript(groupId, author) {
  return concat([encoder.encode('BreezeGroupAuthor/cap/v1'), field(groupId, 64), field(author, 128)]);
}
export async function verifyGroupAuthor(groupId, author, payload, version, signature, pinnedSigPub) {
  try {
    if (version !== 1) return false;
    const sig = decode64(signature, 64), pub = decode64(pinnedSigPub, 32), p = payloadNumbers(payload);
    decode64(author, 32);
    const bytes = groupAuthorTranscript(groupId, author, p.ep, p.c, payload);
    const key = await crypto.subtle.importKey('raw', pub, 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, sig, bytes);
  } catch { return false; }
}

export function readGroupAuthorRecord(db, store, key) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store), req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = tx.onabort = () => reject(req.error || tx.error || new Error('group author read failed'));
    } catch (e) { reject(e); }
  });
}

export function forwardedGroupFields(msg) {
  if (!msg.groupId) return {};
  return Object.fromEntries(['groupId', 'groupName', 'fromPub', 'acctRoot', 'isGroupSK', 'authorSigV', 'authorSig', 'gctl', 'replyTo', 'disappearAt'].filter(k => msg[k] !== undefined).map(k => [k, msg[k]]));
}

// One transaction makes acceptance, ratchet advancement and replay consumption inseparable.
export function commitGroupAcceptance(db, record, auth) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(['identity', 'messages'], 'readwrite');
      tx.oncomplete = () => resolve(true);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('group acceptance aborted'));
      const identity = tx.objectStore('identity');
      let pending = 1 + (auth.replay ? 1 : 0) + (auth.ratchet ? 1 : 0);
      const ready = () => {
        if (--pending) return;
        if (auth.replay) identity.put(auth.replay.value, auth.replay.key);
        if (auth.ratchet) identity.put(auth.ratchet.value, auth.ratchet.key);
        if (record) tx.objectStore('messages').put(record);
      };
      if (auth.replay) {
        const req = identity.get(auth.replay.key);
        req.onsuccess = () => {
          const prior = req.result, next = auth.replay.value, counter = auth.counter;
          if (prior && (prior.epoch > next.epoch || (prior.epoch === next.epoch && (counter <= prior.high - WINDOW || prior.seen.includes(counter))))) { tx.abort(); return; }
          if (prior?.epoch === next.epoch) {
            next.high = Math.max(prior.high, next.high);
            next.seen = [...new Set([...prior.seen, ...next.seen])].filter(c => c > next.high - WINDOW);
            next.ids = Object.fromEntries(next.seen.map(c => [c, next.ids[c] || prior.ids?.[c]]));
          }
          ready();
        };
      }
      if (auth.ratchet) {
        const req = identity.get(auth.ratchet.key);
        req.onsuccess = () => { if (JSON.stringify(req.result) !== JSON.stringify(auth.ratchet.expected)) tx.abort(); else ready(); };
      }
      ready();
    } catch (e) { reject(e); }
  });
}

export function createGroupAuthor(D) {
  const locks = new Map(), signatures = new Map(), needsDistribution = new Set();
  async function serial(key, work) {
    const previous = locks.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => D.lock ? D.lock(key, work) : work());
    locks.set(key, next);
    try { return await next; } finally { if (locks.get(key) === next) locks.delete(key); }
  }
  const policyKey = gid => 'ga-policy:' + gid;
  async function pinned(pub) {
    if (pub === D.pub()) return D.sigPub();
    const contact = await D.get('contacts', pub.slice(0, 12));
    if (contact?.pubB64 === pub) return contact.sigPub || null;
    const account = await D.get('identity', 'account');
    return account?.root === pub ? account.rootEd || null : null;
  }
  async function put(key, value) {
    if (!await D.put('identity', value, key)) throw new Error('group author persistence failed');
  }
  async function readPolicy(groupId) {
    const state = await D.get('identity', policyKey(groupId)) || { proofs: {} };
    if (await D.protection?.(groupId, state) === false) return { ...state, strict: false };
    if (state.strict) return state;
    const group = await D.get('contacts', groupId);
    if (!group?.isGroup || !group.members?.length || !D.supported()) return state;
    const others = group.members.filter(m => m.pubB64 !== D.pub());
    const caps = [];
    for (const member of others) {
      const pin = typeof member.pubB64 === 'string' ? await pinned(member.pubB64) : null;
      caps.push(pin && state.proofs?.[member.pubB64] === pin ? [GROUP_AUTHOR_CAP] : []);
    }
    if (D.negotiate([GROUP_AUTHOR_CAP], caps).useAuthorSig) {
      state.strict = true;
      await put(policyKey(groupId), state);
    }
    return state;
  }
  const policy = groupId => serial('policy:' + groupId, () => readPolicy(groupId));
  async function capability(groupId) {
    if (!D.supported()) return {};
    const group = await D.get('contacts', groupId);
    if (!group?.isGroup || !group.members?.length) return {};
    const bytes = await D.sign(capabilityTranscript(groupId, D.pub()));
    if (!bytes) return {};
    return { authorCaps: [GROUP_AUTHOR_CAP], authorCapSig: base64(bytes) };
  }
  async function bindCapability(groupId, author, sk) {
    try {
      if (!Array.isArray(sk.authorCaps) || !sk.authorCaps.includes(GROUP_AUTHOR_CAP)) return;
      const group = await D.get('contacts', groupId);
      if (!group?.members?.some(m => m.pubB64 === author)) return;
      let pin = await pinned(author);
      if (!pin && D.establishPin) { await D.establishPin(author); pin = await pinned(author); }
      if (!pin) return;
      const key = await crypto.subtle.importKey('raw', decode64(pin, 32), 'Ed25519', false, ['verify']);
      const valid = await crypto.subtle.verify('Ed25519', key, decode64(sk.authorCapSig, 64), capabilityTranscript(groupId, author));
      if (!valid) return;
      await D.protectionProof?.(groupId, author);
      await serial('policy:' + groupId, async () => {
        const state = await D.get('identity', policyKey(groupId)) || { proofs: {} };
        if (state.strict) return;
        state.proofs = { ...state.proofs, [author]: pin };
        await put(policyKey(groupId), state);
        await readPolicy(groupId);
      });
    } catch (e) { D.dbg(e, 'group author capability'); }
  }
  async function prepareKey(groupId, stored) {
    const strict = (await policy(groupId)).strict === true;
    if (!strict && stored.v === 5 && await D.legacyFormat?.(groupId)) {
      if (!uint32(stored.epoch) || stored.epoch === 0xFFFFFFFF) throw new Error('group legacy rotation unavailable');
      const legacy = { raw: Array.from(crypto.getRandomValues(new Uint8Array(32))), counter: 0, epoch: stored.epoch + 1 };
      await put('gsk:' + groupId, legacy); needsDistribution.add(groupId); return legacy;
    }
    if (!strict || stored.authorSigV === 1) return stored;
    if (!D.supported() || !uint32(stored.epoch) || stored.epoch === 0xFFFFFFFF) throw new Error('group author rotation unavailable');
    const bytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const key = stored.v === 5
      ? { v: 5, chainKey: bytes, skipped: {}, epoch: stored.epoch + 1, counter: 0, authorSigV: 1 }
      : { raw: bytes, epoch: stored.epoch + 1, counter: 0, authorSigV: 1 };
    await put('gsk:' + groupId, key);
    needsDistribution.add(groupId);
    return key;
  }
  async function sign(groupId, payload) {
    const strict = (await policy(groupId)).strict === true;
    if (!D.supported()) { if (strict) throw new Error('strict group signing unavailable'); return {}; }
    if (!strict) {
      const group = await D.get('contacts', groupId);
      if (!group?.isGroup || !D.negotiate([GROUP_AUTHOR_CAP], (group.members || []).filter(m => m.pubB64 !== D.pub()).map(m => m.caps)).useAuthorSig) return {};
    }
    const p = payloadNumbers(payload), cacheKey = D.pub() + ':' + groupId + ':' + payload;
    if (signatures.has(cacheKey)) return signatures.get(cacheKey);
    const bytes = await D.sign(groupAuthorTranscript(groupId, D.pub(), p.ep, p.c, payload));
    if (!bytes) throw new Error('group author signing failed');
    const result = { authorSigV: 1, authorSig: base64(bytes) };
    signatures.set(cacheKey, result);
    if (signatures.size > 8) signatures.delete(signatures.keys().next().value);
    return result;
  }
  async function receive(msg, ackOut, deliver) {
    try {
      field(msg.groupId, 64); field(msg.payload, MAX_PAYLOAD);
      const group = await D.get('contacts', msg.groupId);
      if (!group?.isGroup) return;
      const member = (group.members || []).find(m => m.pubB64 && (msg.from === m.id || msg.from === m.pubB64));
      let author = member?.pubB64;
      if (author && msg.fromPub && msg.fromPub !== author) return;
      if (!author && typeof msg.fromPub === 'string' && typeof msg.acctRoot === 'string' &&
          msg.from === msg.fromPub.slice(0, 12) && (group.members || []).some(m => m.pubB64 === msg.acctRoot) &&
          await D.attributeDevice(msg.acctRoot, msg.fromPub)) author = msg.fromPub;
      if (!author) return;
      const hasSignature = msg.authorSig !== undefined || msg.authorSigV !== undefined;
      if (hasSignature && !await verifyGroupAuthor(msg.groupId, author, msg.payload, msg.authorSigV, msg.authorSig, await pinned(author))) return;
      if (!hasSignature && (await policy(msg.groupId)).strict) return;
      return await serial('receive:' + msg.groupId + ':' + author, async () => {
        const p = hasSignature ? payloadNumbers(msg.payload) : null;
        const replayKey = 'ga-replay:' + msg.groupId + ':' + author;
        const prior = p ? await D.get('identity', replayKey) : null;
        const tuple = p ? base64(new Uint8Array(await crypto.subtle.digest('SHA-256', groupAuthorTranscript(msg.groupId, author, p.ep, p.c, msg.payload)))) : null;
        if (p && prior && (p.ep < prior.epoch || (p.ep === prior.epoch && (p.c <= prior.high - WINDOW || prior.seen.includes(p.c))))) {
          const stored = prior.ids?.[p.c] ? await D.get('messages', prior.ids[p.c]) : null;
          if (stored?.authorTuple === tuple && ackOut) ackOut.stored = true;
          return;
        }
        const state = p ? (prior?.epoch === p.ep ? prior : { epoch: p.ep, high: p.c, seen: [], ids: {} }) : null;
        if (state) { state.high = Math.max(state.high, p.c); state.seen = [...state.seen.filter(c => c > state.high - WINDOW), p.c]; state.ids = Object.fromEntries(state.seen.map(c => [c, state.ids?.[c]])); }
        const auth = {
          verified: hasSignature, tuple, counter: p?.c,
          replay: state ? { key: replayKey, value: state } : null,
          commit: async record => {
            if (record && hasSignature) { record.authorTuple = tuple; state.ids[p.c] = record.msgId; }
            if (!await D.commit(record, auth)) throw new Error('group author commit failed');
            auth.accepted = true;
          },
        };
        await deliver(auth);
      });
    } catch (e) { D.dbg(e, 'group author receive'); }
  }
  async function ensureDistributed(gid, key) {
    if (!needsDistribution.has(gid) && !(key?.authorSigV === 1 && await D.redistributionNeeded?.(gid, key.epoch))) return;
    await D.distribute(gid);
    needsDistribution.delete(gid);
  }
  return { sign, receive, capability, bindCapability, prepareKey, policy, ensureDistributed, supported: D.supported, withKey: (gid, work) => serial('key:' + gid, work), withSend: (gid, work) => serial('send:' + gid, work) };
}
