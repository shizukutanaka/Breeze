import { verifyBinding } from './device-keys.js';

export const DEVICE_REVOCATION_CAP = 'device-revocation-v1';
export const deviceConsentText = b => 'BreezeDeviceConsent/v1:' + JSON.stringify([b.root, b.rootEd, b.pub, b.ed, b.nonce, b.issuedAt, b.sig]);
const encoder = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const decode = (value, length) => {
  if (typeof value !== 'string' || value.length !== Math.ceil(length / 3) * 4) throw new Error('device authority encoding');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (bytes.length !== length || b64(bytes) !== value) throw new Error('device authority key');
  return bytes;
};
const integer = n => Number.isSafeInteger(n) && n > 0;
function fields(c) {
  if (c?.v !== 1 || !integer(c.epoch) || !integer(c.ts)) throw new Error('device authority version');
  decode(c.root, 32); decode(c.rootEd, 32);
  return [c.root, c.rootEd, c.epoch, c.ts];
}
export function checkpointText(c) {
  const base = fields(c);
  if (!Array.isArray(c.devices) || !c.devices.length || c.devices.length > 10 || !Array.isArray(c.revoked) || c.revoked.length > 256) throw new Error('device authority bounds');
  const pubs = c.devices.map(d => d?.pub);
  for (const pub of [...pubs, ...c.revoked]) decode(pub, 32);
  if (!pubs.includes(c.root) || new Set([...pubs, ...c.revoked]).size !== pubs.length + c.revoked.length) throw new Error('device authority membership');
  return 'BreezeDeviceCheckpoint/v1:' + JSON.stringify([...base, c.devices.map(d => [d.pub, d.binding || null]), c.revoked]);
}
export function checkpointHeadText(h) {
  const base = fields(h); decode(h.hash, 32);
  return 'BreezeDeviceCheckpointHead/v1:' + JSON.stringify([...base, h.hash]);
}
const hash = async text => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
async function signature(text, sig, pin) {
  const key = await crypto.subtle.importKey('raw', decode(pin, 32), 'Ed25519', false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, decode(sig, 64), encoder.encode(text));
}
export async function verifyCheckpoint(c, root, pin) {
  try {
    if (c?.root !== root || c.rootEd !== pin || !await signature(checkpointText(c), c.sig, pin)) return false;
    for (const d of c.devices) if (d.binding && (!await verifyBinding(d.binding, { root, rootEd: pin, pub: d.pub }) || d.binding.issuedAt > c.ts)) return false;
    return true;
  } catch { return false; }
}
export async function verifyCheckpointHead(h, root, pin) {
  try { return h?.root === root && h.rootEd === pin && await signature(checkpointHeadText(h), h.sig, pin); }
  catch { return false; }
}

export function createDeviceRevocation(D) {
  const key = root => 'verify:device-authority:' + root;
  const headKey = root => 'verify:device-head:' + root;
  const ownerKey = pub => 'verify:device-owner:' + pub;
  const consentKey = b => 'verify:device-consent:' + b.root + ':' + b.pub;
  const chains = new Map();
  let gossip = 0;
  async function locked(root, work) {
    const previous = chains.get(root) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => D.lock(root, work)); chains.set(root, next);
    try { return await next; } finally { if (chains.get(root) === next) chains.delete(root); }
  }
  async function put(k, value) {
    if (!await D.put('identity', value, k)) throw new Error('device authority persistence');
  }
  const state = root => D.get('identity', key(root));
  async function pin(root) {
    if (root === D.pub()) return D.ed();
    const link = await D.get('identity', 'verify:device-link');
    if (link?.binding?.root === root) return link.binding.rootEd;
    const contact = await D.get('contacts', root?.slice(0, 12));
    return contact?.pubB64 === root ? contact.sigPub : null;
  }
  async function acceptHead(h) {
    const trusted = await pin(h?.root);
    if (!trusted || !await verifyCheckpointHead(h, h.root, trusted)) throw new Error('untrusted device head');
    return locked(h.root, async () => {
      const old = await D.get('identity', headKey(h.root));
      if (old?.epoch === h.epoch && old.hash !== h.hash) throw new Error('device checkpoint equivocation');
      const current = await state(h.root);
      if (current?.epoch === h.epoch && await hash(checkpointText(current)) !== h.hash) throw new Error('device checkpoint equivocation');
      if (!old || h.epoch > old.epoch) await put(headKey(h.root), h);
      if (!current || current.epoch < h.epoch) await D.notice?.('checkpoint', h.root, h.epoch);
    });
  }
  async function accept(c, trustedPin) {
    const trusted = trustedPin || await pin(c?.root);
    if (!trusted || !await verifyCheckpoint(c, c?.root, trusted)) throw new Error('untrusted device checkpoint');
    return locked(c.root, async () => {
      const old = await state(c.root), head = await D.get('identity', headKey(c.root));
      const digest = await hash(checkpointText(c));
      if (head && (head.epoch > c.epoch || head.epoch === c.epoch && head.hash !== digest)) throw new Error('withheld device checkpoint');
      if (old?.epoch > c.epoch) { await D.notice?.('checkpoint', c.root, old.epoch); throw new Error('device checkpoint rollback'); }
      if (old?.epoch === c.epoch && await hash(checkpointText(old)) !== digest) throw new Error('device checkpoint equivocation');
      if (old?.revoked.some(pub => !c.revoked.includes(pub))) throw new Error('revocation tombstone rollback');
      await put(key(c.root), c);
      if (c.head && await verifyCheckpointHead(c.head, c.root, trusted) && c.head.epoch === c.epoch && c.head.hash === digest) await put(headKey(c.root), c.head);
      if (old && c.revoked.some(pub => !old.revoked.includes(pub))) await D.notice?.('revoked', c.root, c.epoch);
      D.invalidate?.();
      if (c.revoked.length && old?.epoch !== c.epoch) await D.changed?.(c.root);
      return c;
    });
  }
  async function issue(devices) {
    return locked('issue:' + D.pub(), async () => {
      const old = await state(D.pub());
      const clean = devices.map(d => ({ pub: d.pub, ...(d.binding ? { binding: d.binding } : {}) }));
      const revoked = [...new Set([...(old?.revoked || []), ...(old?.devices || []).filter(d => !clean.some(n => n.pub === d.pub)).map(d => d.pub)])];
      const c = { v: 1, root: D.pub(), rootEd: D.ed(), epoch: (old?.epoch || 0) + 1, ts: Date.now(), devices: clean, revoked };
      c.sig = await D.sign(checkpointText(c));
      const h = { v: 1, root: c.root, rootEd: c.rootEd, epoch: c.epoch, ts: c.ts, hash: await hash(checkpointText(c)) };
      h.sig = await D.sign(checkpointHeadText(h)); c.head = h;
      return accept(c, D.ed());
    });
  }
  async function own(initialize = true) {
    const link = await D.get('identity', 'verify:device-link');
    const account = await D.get('identity', 'account');
    const root = link?.binding?.root || account?.root || D.pub();
    const existing = await state(root);
    if (existing || root !== D.pub() || !initialize) return existing;
    const devices = D.initialDevices ? await D.initialDevices() : [{ pub: D.pub() }];
    return devices ? issue(devices) : null;
  }
  async function allowed(pub, root) {
    const owner = await D.get('identity', ownerKey(pub));
    if (owner && root && owner !== root) return false;
    root ||= owner;
    if (!root) return null;
    if (pub === root) return true;
    const c = await state(root), head = await D.get('identity', headKey(root));
    const trusted = await pin(root);
    if (c && c.rootEd !== trusted || head && head.rootEd !== trusted) return false;
    if (head && (!c || head.epoch > c.epoch)) return false;
    return c ? c.devices.some(d => d.pub === pub) && !c.revoked.includes(pub) : null;
  }
  async function authorPin(pub, claimedRoot) {
    const root = claimedRoot || await D.get('identity', ownerKey(pub));
    if (!root || await allowed(pub, root) !== true) return null;
    const active = (await state(root))?.devices.find(d => d.pub === pub)?.binding;
    const consent = await D.get('identity', consentKey({ root, pub }));
    return active && consent?.sig === active.sig ? active.ed : null;
  }
  async function acceptConsent(b, authenticatedPeer) {
    const trusted = await pin(b?.root);
    if (!trusted || !await verifyBinding(b, { root: b.root, rootEd: trusted }) || !await signature(deviceConsentText(b), b.deviceSig, b.ed)) throw new Error('device consent invalid');
    const owner = await D.get('identity', ownerKey(b.pub));
    if (owner && owner !== b.root) throw new Error('device root conflict');
    await put(consentKey(b), b);
    if (authenticatedPeer === b.pub) await put(ownerKey(b.pub), b.root);
    if (b.root === D.pub()) await put('verify:device-binding:' + b.pub, b);
    return b;
  }
  async function bindDevice(binding) {
    const b = { ...binding, deviceSig: await D.sign(deviceConsentText(binding)) };
    if (!await signature(deviceConsentText(b), b.deviceSig, b.ed)) throw new Error('device consent signing failed');
    await put(consentKey(b), b); await put(ownerKey(b.pub), b.root);
    return b;
  }
  async function certified(group) {
    const account = await D.get('identity', 'account');
    const link = await D.get('identity', 'verify:device-link');
    if ((link?.binding?.root || account?.root || D.pub()) === D.pub()) return true;
    const c = await own();
    if (!c || c.root === D.pub()) return c?.root === D.pub();
    if (!await authorPin(D.pub())) return false;
    for (const m of group?.members || []) if (m.pubB64 !== c.root && !await state(m.pubB64)) return false;
    return true;
  }
  async function wrap(body, peer) {
    if (!await D.capable(peer)) return body;
    const c = await own(), roots = new Set([c?.root, ...(await D.sharedRoots?.(peer) || [])]);
    const owner = await D.get('identity', ownerKey(peer)); roots.add(owner || peer);
    const checkpoints = [], heads = [], consents = [];
    const envelope = () => JSON.stringify({ breezeDeviceAuthority: 1, body, checkpoints, heads, consents });
    const fits = () => encoder.encode(envelope()).length <= Math.min(65535, encoder.encode(JSON.stringify(body)).length + 32768);
    const others = [...roots].filter(root => root && root !== c?.root);
    const offset = others.length ? gossip++ % others.length : 0;
    for (const root of [c?.root, ...others.slice(offset), ...others.slice(0, offset)]) if (root) {
      const cp = await state(root), head = await D.get('identity', headKey(root));
      if (cp) {
        checkpoints.push(cp);
        if (!fits()) { checkpoints.pop(); if (root === c?.root) throw new Error('device checkpoint frame too large'); }
        else for (const pub of cp.devices.map(d => d.pub)) {
          const consent = await D.get('identity', consentKey({ root, pub }));
          if (consent) { consents.push(consent); if (!fits()) consents.pop(); }
        }
      }
      if (head) { heads.push(head); if (!fits()) heads.pop(); }
    }
    return envelope();
  }
  async function unwrap(body, peer) {
    let value; try { value = JSON.parse(body); } catch { return body; }
    if (value?.breezeDeviceAuthority !== 1) return body;
    if (encoder.encode(body).length > 65535) throw new Error('device authority frame bounds');
    if (typeof value.body !== 'string' || !Array.isArray(value.checkpoints) || !Array.isArray(value.heads) || value.checkpoints.length > 64 || value.heads.length > 64) throw new Error('device authority envelope');
    if (value.consents !== undefined && (!Array.isArray(value.consents) || value.consents.length > 640)) throw new Error('device consent bounds');
    if (D.establishPin && !await pin(peer) && (await D.get('contacts', peer.slice(0, 12)))?.pubB64 === peer) await D.establishPin(peer);
    for (const b of value.consents || []) if (await pin(b?.root)) await acceptConsent(b, peer);
    for (const c of value.checkpoints) if (await pin(c?.root)) await accept(c);
    for (const h of value.heads) if (await pin(h?.root)) await acceptHead(h);
    if (await allowed(peer) === false) throw new Error('revoked device session');
    return value.body;
  }
  async function keyFor(group, stored) {
    const epochs = { ...(stored.deviceEpochs || {}) }; let rotate = false;
    const c = await own(D.enabled?.() !== false), roots = new Set([c?.root, ...(group?.members || []).map(m => m.pubB64)]);
    for (const root of roots) if (root) {
      const cp = await state(root);
      if (cp && cp.revoked.length && (epochs[root] || 0) < cp.epoch) { epochs[root] = cp.epoch; rotate = true; }
    }
    if (!rotate) return stored;
    if (D.enabled?.() === false) throw new Error('device revocation rotation requires Web Locks');
    if (!Number.isInteger(stored.epoch) || stored.epoch >= 0xFFFFFFFF) throw new Error('sender key epoch exhausted');
    const bytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    return { ...(stored.v === 5 ? { v: 5, chainKey: bytes, skipped: {} } : { raw: bytes }), epoch: stored.epoch + 1, counter: 0, authorSigV: stored.authorSigV, deviceEpochs: epochs };
  }
  return { state, issue, accept, acceptHead, acceptConsent, bindDevice, own, allowed, authorPin, certified, wrap, unwrap, keyFor };
}

export function createDeviceRevocationHost(D) {
  const enabled = !!globalThis.navigator?.locks;
  let authority;
  async function groups(root) {
    return (await D.all('contacts')).filter(g => g.isGroup && g.members?.some(m => m.pubB64 === root));
  }
  async function capable(pub) {
    if (!enabled) return false;
    try { return (await D.peerInfo(pub.slice(0, 12))).caps?.includes(DEVICE_REVOCATION_CAP) === true; }
    catch (e) { D.dbg(e, 'device checkpoint capability'); return false; }
  }
  async function rotate(root) {
    for (const g of await groups(root)) await D.groupAuthor()?.rotate(g.id);
  }
  authority = createDeviceRevocation({ ...D, capable, enabled: () => enabled,
    lock: (root, work) => {
      if (!globalThis.navigator?.locks) throw new Error('device revocation requires Web Locks');
      return navigator.locks.request('breeze-device-authority:' + D.pub() + ':' + root, work);
    },
    initialDevices: async () => {
      const account = await D.get('identity', 'account');
      const registry = await D.registry(D.pub().slice(0, 12), D.pub());
      if (!registry) return account ? null : [{ pub: D.pub() }];
      return registry.list.map(pub => ({ pub, ...(registry.bindings?.[pub] ? { binding: registry.bindings[pub] } : {}) }));
    },
    sharedRoots: async peer => {
      const own = await authority.own();
      const owner = await D.get('identity', 'verify:device-owner:' + peer) || (own?.devices.some(d => d.pub === peer) ? own.root : peer);
      return [...new Set((await groups(owner)).flatMap(g => g.members.map(m => m.pubB64)))].slice(0, 60);
    },
    changed: rotate,
  });
  async function targets(root) {
    const cp = await authority.state(root);
    if (!cp) return null;
    const pubs = [];
    for (const d of cp.devices) if (await authority.allowed(d.pub, root)) pubs.push(d.pub);
    return pubs;
  }
  async function broadcast() {
    const cp = await authority.own(); if (!cp) return;
    const pubs = new Set(cp.devices.map(d => d.pub));
    for (const c of await D.all('contacts')) {
      if (!c.isGroup) pubs.add(c.pubB64);
      else for (const m of c.members || []) pubs.add(m.pubB64);
    }
    for (const pub of pubs) if (pub && pub !== D.pub() && await authority.allowed(pub) !== false && await capable(pub)) {
      try {
        const session = await D.get('identity', 'sess:' + pub.slice(0, 12));
        if (!session?.recvCounter && (cp.root !== D.pub() || !cp.devices.some(d => d.pub === pub))) continue;
        const payload = await D.encrypt(JSON.stringify({ type: 'device_checkpoint' }), pub);
        if (payload) await D.send(pub.slice(0, 12), { to: pub.slice(0, 12), from: D.pub().slice(0, 12), fromPub: D.pub(), payload, ts: Date.now(), isProfile: true, ...(cp.root !== D.pub() ? { acctRoot: cp.root } : {}) }, pub);
      } catch (e) { D.dbg(e, 'device checkpoint distribution'); }
    }
  }
  async function checkpoint(devices) {
    if (!enabled) return;
    if (!await authority.own()) throw new Error('device checkpoint baseline unavailable');
    const cp = await authority.issue(devices);
    await broadcast(); return cp;
  }
  async function admit(msg) {
    const pub = msg.fromPub || (await D.get('contacts', msg.from))?.pubB64;
    return !pub || await authority.allowed(pub, msg.acctRoot) !== false;
  }
  return { ...authority, capable, targets, checkpoint, broadcast, admit,
    wrap: (body, peer) => enabled ? authority.wrap(body, peer) : Promise.resolve(body),
  };
}
