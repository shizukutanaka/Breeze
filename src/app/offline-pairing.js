import { canonical } from './rendezvous.js';
import { mintPQPreKey } from '../crypto/pqkey.js';

const PREFIX = 'breeze-inv1z:';
const LIMIT = 16384;
const fail = () => { throw new Error('opInvalid'); };
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const nonce = () => b64(crypto.getRandomValues(new Uint8Array(16))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const cleanName = value => String(value).replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 64);
const keys = (value, expected) => value && canonical(Object.keys(value).sort()) === canonical(expected.sort());

async function transform(bytes, compress) {
  const stream = new Blob([bytes]).stream().pipeThrough(compress ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > LIMIT) fail();
      chunks.push(value);
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function packInvite(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > LIMIT) fail();
  return PREFIX + b64(await transform(bytes, true)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function unpackInvite(code) {
  if (typeof code !== 'string' || code.length > LIMIT || !code.startsWith(PREFIX)) fail();
  const text = code.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(text)) fail();
  try {
    const bytes = await transform(unb64(text.replace(/-/g, '+').replace(/_/g, '/')), false);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { fail(); }
}

function transcript(a, b) {
  return canonical([a, b].map(e => ({ pub: e.pub, sigPub: e.sigPub, nonce: e.nonce })).sort((x, y) => x.pub < y.pub ? -1 : x.pub > y.pub ? 1 : 0));
}

export async function pairingFingerprint(a, b) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transcript(a, b))));
  return Array.from({ length: 6 }, (_, i) => String(digest[2 * i] * 256 + digest[2 * i + 1]).padStart(5, '0')).join(' ');
}

export function createInviteCodec(D) {
  const now = D.now || Date.now;
  async function build() {
    const e = { v: 1, kind: 'invite', pub: D.me(), sigPub: D.sigPub(), name: cleanName(D.name()), caps: D.caps(), nonce: nonce(), exp: now() + 30 * D.MS.MIN };
    if (!e.sigPub || e.pub.length !== 44 || !e.caps.includes('x3dh-v5')) fail();
    e.sig = await D.sign(canonical(e));
    if (!e.sig) fail();
    return { envelope: e, code: await packInvite(e) };
  }
  async function parse(code) {
    const e = await unpackInvite(code);
    if (!keys(e, ['v', 'kind', 'pub', 'sigPub', 'name', 'caps', 'nonce', 'exp', 'sig']) || e.v !== 1 || e.kind !== 'invite' ||
        typeof e.pub !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(e.pub) || e.pub === D.me() ||
        typeof e.sigPub !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(e.sigPub) ||
        typeof e.name !== 'string' || e.name !== cleanName(e.name) || !Array.isArray(e.caps) || e.caps.length > 8 ||
        e.caps.some(c => !['x3dh-v5', 'pqxdh'].includes(c)) || new Set(e.caps).size !== e.caps.length || !e.caps.includes('x3dh-v5') ||
        typeof e.nonce !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(e.nonce) || !Number.isSafeInteger(e.exp) ||
        e.exp <= now() || e.exp > now() + 30 * D.MS.MIN || typeof e.sig !== 'string') fail();
    const { sig, ...signed } = e;
    if (await D.verify(canonical(signed), sig, e.sigPub) !== true || await D.seen(e.nonce)) fail();
    return e;
  }
  return { build, parse };
}

export async function makePairMaterial({ signRaw, pq }) {
  const spk = await crypto.subtle.generateKey('X25519', false, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', spk.publicKey));
  const bundle = { signedPreKey: b64(pub), signedPreKeySig: b64(await signRaw(pub)) };
  let seed = null;
  if (pq) {
    const minted = mintPQPreKey();
    seed = minted.seed;
    bundle.pqPreKey = minted.pqPreKey;
    bundle.pqPreKeySig = b64(await signRaw(minted.publicKey));
  }
  return { spkPriv: spk.privateKey, pqRecord: seed ? { seed: Array.from(seed) } : null, bundle };
}

export async function verifyPairBundle(e, { own, remote, pq, verify, now = Date.now }) {
  if (!keys(e, ['type', 'v', 'from', 'to', 'fingerprint', 'exp', 'bundle', 'sig']) || e.type !== 'pair-bundle' || e.v !== 1 ||
      e.from !== remote.pub || e.to !== own.pub || e.fingerprint !== transcript(own, remote) || e.exp !== Math.min(own.exp, remote.exp) || e.exp <= now()) fail();
  const b = e.bundle;
  if (!keys(b, ['identityKey', 'edIdentityKey', 'signedPreKey', 'signedPreKeySig', 'caps', ...(pq ? ['pqPreKey', 'pqPreKeySig'] : [])]) ||
      b.identityKey !== remote.pub || b.edIdentityKey !== remote.sigPub || canonical(b.caps) !== canonical(remote.caps)) fail();
  const { sig, ...signed } = e;
  if (await verify(canonical(signed), sig, remote.sigPub) !== true) fail();
  const ed = await crypto.subtle.importKey('raw', unb64(remote.sigPub), 'Ed25519', false, ['verify']);
  for (const [pub, signature, length] of [['signedPreKey', 'signedPreKeySig', 32], ...(pq ? [['pqPreKey', 'pqPreKeySig', 1184]] : [])]) {
    const raw = unb64(b[pub]);
    if (raw.length !== length || !await crypto.subtle.verify('Ed25519', ed, unb64(b[signature]), raw)) fail();
  }
  return b;
}

export function createOfflinePairing(D) {
  const now = D.now || Date.now;
  const codec = createInviteCodec({ ...D, seen: id => D.get('identity', 'offline-seen:' + id) });
  const materials = new Map(), channels = new WeakMap(), queues = new Map(), timers = new Map();
  let local, showing = false;
  const pending = c => c?.offlinePairing?.state === 'pending';
  const alive = c => pending(c) && c.offlinePairing.exp > now();
  const pqFor = p => p.own.caps.includes('pqxdh') && p.remote.caps.includes('pqxdh');
  const serial = (id, fn) => {
    const next = (queues.get(id) || Promise.resolve()).then(() => { if (D.signal?.aborted) fail(); return fn(); });
    queues.set(id, next.catch(D.log));
    return next;
  };
  function clearMaterial(id) {
    const m = materials.get(id);
    m?.pqRecord?.seed.fill(0);
    materials.delete(id);
    clearTimeout(timers.get(id)); timers.delete(id);
  }
  D.signal?.addEventListener('abort', () => { for (const id of new Set([...materials.keys(), ...timers.keys()])) clearMaterial(id); }, { once: true });
  async function put(store, value, key) {
    if (await D.put(store, value, key) !== true) fail();
  }
  async function cancel(c) {
    if (!c) return;
    local = null;
    return serial(c.id, () => D.exclusive(c.id, async () => {
      clearMaterial(c.id);
      const fresh = await D.get('contacts', c.id);
      if (!pending(fresh)) return;
      fresh.offlinePairing.state = 'cancelled';
      await D.remove('identity', 'sess:' + c.id);
      await put('contacts', fresh);
      D.closePeer(fresh);
      D.changed(fresh);
    }));
  }
  const ready = (async () => {
    for (const c of await D.contacts()) {
      if (c.offlinePairing?.manualOnly) D.blockPeer(c.id);
      if (pending(c)) await cancel(c);
    }
  })();
  ready.catch(D.log);
  async function invite() {
    await ready;
    if (!local || local.envelope.exp <= now()) local = await codec.build();
    return local;
  }
  async function inspect(code) {
    const own = (await invite()).envelope, remote = await codec.parse(code);
    const existing = await D.get('contacts', remote.pub.slice(0, 12));
    if (existing && (existing.isGroup || existing.pubB64 !== remote.pub || (existing.sigPub && existing.sigPub !== remote.sigPub))) fail();
    return { own, remote, fingerprint: await pairingFingerprint(own, remote), exp: Math.min(own.exp, remote.exp) };
  }
  async function confirm(pair) {
    await ready;
    if (!local || canonical(local.envelope) !== canonical(pair.own) || pair.exp <= now()) fail();
    const remote = await codec.parse(await packInvite(pair.remote));
    const id = remote.pub.slice(0, 12);
    return D.exclusive(id, async () => {
    const previous = await D.get('contacts', id);
    if (previous && (previous.isGroup || previous.pubB64 !== remote.pub || (previous.sigPub && previous.sigPub !== remote.sigPub))) fail();
    if (pending(previous)) fail();
    const hasSession = !!await D.session(id);
    if (hasSession && !previous) fail();
    const verified = { own: local.envelope, remote, exp: Math.min(local.envelope.exp, remote.exp), fingerprint: await pairingFingerprint(local.envelope, remote) };
    if (canonical(verified) !== canonical(pair)) fail();
    const contact = { ...(previous || { id, pubB64: remote.pub, name: remote.name, addedAt: now(), unread: 0 }), sigPub: remote.sigPub,
      offlineVerified: true, offlinePairing: { ...verified, state: hasSession ? 'paired' : 'pending', kt: 'unavailable', manualOnly: !hasSession || !!previous?.offlinePairing?.manualOnly } };
    if (contact.offlinePairing.manualOnly) D.blockPeer(id);
    await put('identity', { exp: remote.exp }, 'offline-seen:' + remote.nonce);
    await put('contacts', contact);
    if (!hasSession) timers.set(id, setTimeout(() => cancel(contact).catch(D.log), pair.exp - now()));
    D.changed(contact);
    return contact;
    });
  }
  async function state(c, dc) {
    if (channels.has(dc)) return channels.get(dc);
    const p = c.offlinePairing;
    if (!p || p.exp <= now() || p.state === 'cancelled') fail();
    const s = { c, dc, p, sent: false, received: false, sentBundle: false, peerBundle: null };
    channels.set(dc, s);
    return s;
  }
  async function sendConfirm(s, request) {
    if (s.p.exp <= now()) fail();
    const payload = await D.encrypt(canonical({ type: 'pair-confirm', fingerprint: transcript(s.p.own, s.p.remote), from: D.me(), to: s.c.pubB64, request }), s.c.pubB64);
    if (!payload) fail();
    s.dc.send(JSON.stringify({ type: 'pair-confirm', fingerprint: transcript(s.p.own, s.p.remote), payload }));
    s.sent = true;
  }
  async function finish(s) {
    if (!s.sent || !s.received) return;
    if (s.p.exp <= now()) fail();
    const c = await D.get('contacts', s.c.id);
    if (!c || c.offlinePairing?.fingerprint !== s.p.fingerprint || c.offlinePairing.state === 'cancelled') fail();
    c.offlinePairing.state = 'paired';
    await put('contacts', c);
    clearMaterial(c.id);
    D.changed(c);
  }
  async function bundle(s) {
    if (s.sentBundle) return;
    if (!materials.has(s.c.id)) {
      const m = await (D.material || makePairMaterial)({ signRaw: D.signRaw, pq: pqFor(s.p) });
      if (D.signal?.aborted) { m.pqRecord?.seed.fill(0); fail(); }
      materials.set(s.c.id, m);
    }
    const e = { type: 'pair-bundle', v: 1, from: D.me(), to: s.c.pubB64, fingerprint: transcript(s.p.own, s.p.remote), exp: s.p.exp,
      bundle: { ...materials.get(s.c.id).bundle, identityKey: D.me(), edIdentityKey: D.sigPub(), caps: s.p.own.caps } };
    e.sig = await D.sign(canonical(e));
    if (!e.sig) fail();
    s.dc.send(JSON.stringify(e)); s.sentBundle = true;
  }
  async function start(c, dc) {
    await ready;
    return serial(c.id, async () => {
      c = await D.get('contacts', c.id);
      if (!alive(c)) return;
      const s = await state(c, dc);
      if (await D.session(c.id)) await sendConfirm(s, true);
      else await bundle(s);
    });
  }
  async function receive(c, msg, dc) {
    await ready;
    const reserved = ['pair-bundle', 'pair-confirm'].includes(msg?.type);
    return serial(c.id, async () => {
      c = await D.get('contacts', c.id);
      if (!reserved) return !!c?.offlinePairing && c.offlinePairing.state !== 'paired';
      const s = await state(c, dc);
      if (msg.type === 'pair-bundle') {
        if (!alive(c) || s.peerBundle) fail();
        s.peerBundle = await verifyPairBundle(msg, { ...s.p, pq: pqFor(s.p), verify: D.verify, now });
        if (await D.session(c.id)) { await sendConfirm(s, true); return; }
        await bundle(s);
        if (D.me() < c.pubB64) {
          const session = await D.initiate(c.pubB64, s.peerBundle);
          if (!session || (!!session.pq !== pqFor(s.p))) fail();
          await D.saveSession(c.id, session);
          await sendConfirm(s, true);
        }
      } else {
        if (!keys(msg, ['type', 'fingerprint', 'payload']) || msg.fingerprint !== transcript(s.p.own, s.p.remote) || typeof msg.payload !== 'string' || msg.payload.length > LIMIT) fail();
        const wire = JSON.parse(msg.payload);
        if (!await D.session(c.id)) {
          if (!s.peerBundle || D.me() < c.pubB64 || !D.matchPreKey(wire, unb64(c.pubB64), pqFor(s.p))) fail();
        }
        const text = await D.decrypt(msg.payload, c.pubB64, materials.get(c.id));
        if (!text) fail();
        const confirmation = JSON.parse(text);
        if (!keys(confirmation, ['type', 'fingerprint', 'from', 'to', 'request']) || confirmation.type !== 'pair-confirm' ||
            confirmation.fingerprint !== transcript(s.p.own, s.p.remote) || confirmation.from !== c.pubB64 || confirmation.to !== D.me() || typeof confirmation.request !== 'boolean') fail();
        s.received = true;
        if (confirmation.request) await sendConfirm(s, false);
        await finish(s);
      }
      return true;
    });
  }
  async function open() {
    if (showing) return;
    showing = true;
    let dlg;
    try {
      const own = await invite();
      dlg = document.createElement('dialog'); dlg.className = 'rendezvous-dialog';
      D.safeSetHTML(dlg, `<div class="modal-title">${D.esc(D.t('opTitle'))}</div><p>${D.esc(D.t('opScope'))}</p>
        <div class="rv-code"><div data-op="output-wrap"></div><div data-op="qr"></div></div>
        <button class="btn btn-o btn-sm" data-op="copy">${D.esc(D.t('rvCopy'))}</button><div data-op="input-wrap"></div>
        <button class="btn btn-g btn-sm" data-op="import">${D.esc(D.t('opImport'))}</button><button class="btn btn-o btn-sm" data-op="scan">${D.esc(D.t('scanQR'))}</button>
        <div data-op="camera"></div><p data-op="status" role="status"></p><p data-op="fingerprint" class="mono"></p>
        <label><input type="checkbox" data-op="matches">${D.esc(D.t('opMatches'))}</label>
        <button class="btn btn-g btn-sm" data-op="confirm" disabled>${D.esc(D.t('opConfirm'))}</button>
        <button class="btn btn-o btn-sm" data-op="close">${D.esc(D.t('uiClose'))}</button>`);
      const el = key => dlg.querySelector(`[data-op="${key}"]`);
      for (const name of ['output', 'input']) {
        const area = document.createElement('textarea'); area.dataset.op = name; area.className = 'modal-input';
        area.readOnly = name === 'output'; area.setAttribute('aria-label', D.t(name === 'output' ? 'opOutput' : 'opInput'));
        el(name + '-wrap').appendChild(area);
      }
      el('output').value = own.code;
      try { if (D.qr) el('qr').appendChild(D.qr.generateQR(own.code)); } catch { el('qr').textContent = D.t('rvQRTooLarge'); }
      let candidate, busy = false, stopScan, closed = false;
      const run = async fn => {
        if (busy) return;
        busy = true; el('confirm').disabled = true;
        try { await fn(); } catch(e) { D.log(e); el('status').textContent = D.t('opInvalid'); }
        finally { busy = false; if (!closed) el('confirm').disabled = !candidate || !el('matches').checked; }
      };
      const load = () => run(async () => {
        candidate = null; el('matches').checked = false; el('fingerprint').textContent = '';
        candidate = await inspect(el('input').value.trim());
        el('fingerprint').textContent = candidate.fingerprint; el('status').textContent = D.t('opCompare');
      });
      el('import').onclick = load;
      el('input').oninput = () => { candidate = null; el('matches').checked = false; el('confirm').disabled = true; el('fingerprint').textContent = ''; };
      el('matches').onchange = () => { el('confirm').disabled = busy || !candidate || !el('matches').checked; };
      el('confirm').onclick = () => run(async () => {
        if (!candidate || !el('matches').checked) fail();
        await confirm(candidate); candidate = null; el('status').textContent = D.t('opConfirmed');
      });
      el('copy').onclick = () => run(async () => { await navigator.clipboard.writeText(own.code); el('status').textContent = D.t('rvCopied'); });
      const canScan = !!D.qr?.startScan && typeof BarcodeDetector !== 'undefined';
      el('scan').disabled = !canScan;
      if (!canScan) el('status').textContent = D.t('rvScanUnavailable');
      el('scan').onclick = () => {
        stopScan?.();
        stopScan = D.qr.startScan({ container: el('camera'), onResult: code => { if (!closed) { el('input').value = code; load(); } }, onError: () => { el('status').textContent = D.t('toastCameraFail'); } });
      };
      el('close').onclick = () => dlg.close();
      dlg.addEventListener('close', () => { closed = true; stopScan?.(); dlg.remove(); showing = false; });
      D.root().appendChild(dlg); dlg.showModal();
    } catch(e) { dlg?.remove(); showing = false; D.log(e); D.toast(D.t('opInvalid')); }
  }
  return { invite, inspect, confirm, open, start, receive, cancel, pending: alive };
}
