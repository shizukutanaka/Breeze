import { verifyBinding } from './device-keys.js';

const utf8 = new TextEncoder();
export const activityText = e => 'BreezeAccountActivity/v1:' + JSON.stringify([e.userId, e.pub, e.ed, e.kind, e.id, e.ts]);
export const activityHash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const labels = { linked: 'daLinked', binding: 'dkBound', removed: 'dkRemoved', revoked: 'dkRevoked', checkpoint: 'dkCheckpoint', session: 'daSession', push: 'daPush', relayKeys: 'daRelayKeys' };

export function createDeviceAlerts(D) {
  let busy = false, panel = null, unavailable = false, chain = Promise.resolve();
  const key = 'device-alerts:v1';
  const load = async () => await D.get('settings', key) || { events: [], registries: {}, known: [], own: [] };
  const save = async s => { if (await D.put('settings', s, key) !== true) throw new Error('device alert persistence failed'); };
  const serial = work => {
    const run = () => globalThis.navigator?.locks ? navigator.locks.request('breeze-device-alerts:' + D.myId(), work) : work();
    const next = chain.then(run, run); chain = next.catch(() => {}); return next;
  };
  function record(s, id, kind, device, ts) {
    if (s.known.includes(id)) return;
    s.known.push(id); s.events.push({ id, kind, device, ts, ack: false });
  }
  async function add(id, kind, device, ts) {
    await serial(async () => { const s = await load(); record(s, id, kind, device, ts); await save(s); });
    await paint();
  }
  async function observeRegistry(accountId, root, result) {
    const acct = await D.get('identity', 'account');
    if (root !== D.me() && root !== acct?.root) return result;
    const accepted = await serial(async () => {
      const s = await load(), old = s.registries[accountId];
      if (old && result.ts < old.ts) return old;
      if (old && result.ts === old.ts && JSON.stringify(old.list) !== JSON.stringify(result.list)) throw new Error('registry equivocation');
      for (const pub of result.list.filter(pub => !(old?.list || [root]).includes(pub)))
        record(s, 'link:' + accountId + ':' + result.ts + ':' + pub, 'linked', pub, result.ts);
      for (const pub of (old?.list || []).filter(pub => !result.list.includes(pub)))
        record(s, 'removed:' + accountId + ':' + result.ts + ':' + pub, 'removed', pub, result.ts);
      const bindings = Object.fromEntries(Object.entries(old?.bindings || {}).filter(([pub]) => result.list.includes(pub)));
      for (const [pub, binding] of Object.entries(result.bindings || {})) {
        if (bindings[pub]?.issuedAt > binding.issuedAt) continue;
        if (bindings[pub]?.issuedAt === binding.issuedAt && bindings[pub].sig !== binding.sig) throw new Error('binding equivocation');
        if (bindings[pub]?.sig !== binding.sig) record(s, 'binding:' + accountId + ':' + binding.sig, 'binding', pub, binding.issuedAt);
        bindings[pub] = binding;
      }
      result = { ...result, bindings };
      s.registries[accountId] = result; await save(s); return result;
    });
    await paint(); return accepted;
  }
  async function registry(accountId, rootPubB64) {
    if (!D.api()) return null;
    try {
      const resp = await D.post('/device/list', { accountId });
      if (!resp.ok) return null;
      const rec = await resp.json();
      if (!rec || typeof rec.root !== 'string' || rec.root.slice(0, 12) !== accountId || !Array.isArray(rec.devices) || !rec.devices.length || rec.devices.length > 10 || !Number.isSafeInteger(rec.ts) || rec.ts <= 0) return null;
      if (rootPubB64 && rec.root !== rootPubB64) return null;
      if (rec.devices.some(d => !d || typeof d.pub !== 'string' || d.pub.length > 200) || !rec.devices.some(d => d.pub === rec.root)) return null;
      const digest = (await activityHash(JSON.stringify(rec.devices.map(d => d.pub)))).slice(0, 32);
      let sigPub = accountId === D.myId() ? D.ed() : null;
      if (!sigPub) {
        const acct = await D.get('identity', 'account');
        const link = await D.get('identity', 'verify:device-link');
        if (acct?.root?.slice(0, 12) === accountId) sigPub = link?.binding?.root === acct.root ? link.binding.rootEd : acct.rootEd;
      }
      if (!sigPub) sigPub = (await D.get('contacts', accountId))?.sigPub || null;
      if (!sigPub || await D.verify(`breeze-device-set:${accountId}:${rec.ts}:${digest}`, rec.sig, sigPub) !== true) return null;
      const bindings = {};
      for (const d of rec.devices) if (d.binding && await verifyBinding(d.binding, { root: rec.root, rootEd: sigPub, pub: d.pub }) && d.binding.issuedAt <= rec.ts) bindings[d.pub] = d.binding;
      const snapshot = { list: rec.devices.map(d => d.pub), ts: rec.ts };
      const result = await observeRegistry(accountId, rec.root, { ...snapshot, bindings });
      if (accountId === D.myId()) D.ownTs(result.ts);
      return result;
    } catch(e) { D.dbg(e, 'device-list'); return null; }
  }
  function installation() {
    let id = localStorage.getItem('brz-installation-v1');
    if (!/^[a-f0-9]{32}$/.test(id || '')) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('brz-installation-v1', id);
    }
    return id;
  }
  async function announce(kind, id) {
    if (!D.api() || !D.ed()) return false;
    const e = { userId: D.myId(), pub: D.me(), ed: D.ed(), kind, id, ts: Date.now() };
    e.sig = await D.sign(activityText(e));
    await serial(async () => { const s = await load(); s.own ||= []; if (!s.own.includes(kind + ':' + id)) s.own.push(kind + ':' + id); await save(s); });
    const resp = await D.post('/account/activity', { userId: D.myId(), event: e });
    if (!resp?.ok) return false;
    return true;
  }
  async function observeActivities(data, root, ed, ownId) {
    const local = await load();
    for (const e of (Array.isArray(data?.events) ? data.events : []).slice(0, 64)) {
      if (!e || e.pub !== root || e.ed !== ed || e.userId !== root.slice(0, 12) || !['session', 'push'].includes(e.kind) || !/^[a-f0-9]{32,64}$/.test(e.id) || !Number.isSafeInteger(e.ts) || e.ts <= 0 || e.ts > Date.now() + 5 * D.minute) continue;
      if (await D.verify(activityText(e), e.sig, ed) !== true) continue;
      if (root === D.me() && (e.kind === 'session' && e.id === ownId || local.own?.includes(e.kind + ':' + e.id))) continue;
      await add(e.kind + ':' + root + ':' + e.id, e.kind, e.id, e.ts);
    }
  }
  async function observeKeys(data, root, ed) {
    if (data && Object.hasOwn(data, 'identityKey') && (data.identityKey !== root || data.edIdentityKey !== ed))
      await add('relay-keys:' + root + ':' + await activityHash(JSON.stringify([data.identityKey, data.edIdentityKey])), 'relayKeys', root, Date.now());
  }
  async function check() {
    if (busy) return;
    busy = true;
    try {
      await paint();
      if (!D.api() || !D.me() || !D.ed()) return;
      const ownId = installation(), acct = await D.get('identity', 'account');
      const root = acct?.root || D.me(), ed = root === D.me() ? D.ed() : acct?.rootEd || (await D.get('contacts', root.slice(0, 12)))?.sigPub;
      await registry(root.slice(0, 12), root);
      const announced = await announce('session', ownId);
      unavailable = !announced || root !== D.me() && !ed;
      for (const [pub, signing] of [[D.me(), D.ed()], ...(root !== D.me() && ed ? [[root, ed]] : [])]) {
        const status = await D.post('/prekey/status', { userId: pub.slice(0, 12) });
        if (status?.ok) await observeKeys(await status.json(), pub, signing);
        const ts = Date.now(), sig = await D.sign(`breeze-activity-read:${D.myId()}:${ts}`);
        const resp = await D.post('/account/activity', { userId: pub.slice(0, 12), reader: D.myId(), ts, sig });
        if (resp?.ok) {
          const data = await resp.json(); unavailable ||= data.complete !== true;
          await observeActivities(data, pub, signing, ownId);
        } else unavailable = true;
      }
      await paint();
    } catch(e) { unavailable = true; D.dbg(e, 'device-alert-check'); await paint().catch(err => D.dbg(err, 'device-alert-paint')); }
    finally { busy = false; }
  }
  async function acknowledge(id) {
    await serial(async () => { const s = await load(); const e = s.events.find(e => e.id === id); if (e) e.ack = true; await save(s); });
    await paint();
  }
  async function paint() {
    const root = D.root?.(); if (!root) return;
    const s = await load(), pending = s.events.filter(e => !e.ack);
    panel?.remove(); panel = null;
    if (!pending.length && !unavailable) return;
    panel = document.createElement('section'); panel.className = 'device-alert'; panel.dataset.deviceAlert = ''; panel.setAttribute('role', 'alert');
    const title = document.createElement('b'); title.textContent = D.t('daTitle'); panel.appendChild(title);
    if (unavailable) { const note = document.createElement('p'); note.textContent = D.t('daUnavailable'); panel.appendChild(note); }
    for (const e of pending) {
      const row = document.createElement('p'); row.textContent = D.t(labels[e.kind]) + ' · ' + e.device.slice(0, 20) + ' · ' + new Date(e.ts).toLocaleString(); panel.appendChild(row);
      const ack = document.createElement('button'); ack.className = 'btn btn-o btn-sm'; ack.textContent = D.t('daAck'); ack.onclick = () => acknowledge(e.id).catch(err => D.dbg(err, 'device-alert-ack')); panel.appendChild(ack);
    }
    const button = document.createElement('button'); button.className = 'btn btn-g btn-sm'; button.textContent = D.t('daReview'); button.onclick = () => review().catch(e => D.dbg(e, 'device-review')); panel.appendChild(button);
    root.prepend(panel);
  }
  async function security() {
    const s = await load(), acct = await D.get('identity', 'account'), root = acct?.root || D.me();
    const reg = s.registries[root.slice(0, 12)];
    return '<b>' + D.esc(D.t('devListTitle')) + '</b><br>' + (reg?.list || [D.me()]).map(p => '<code>' + D.esc(p) + '</code>' + (p === D.me() ? ' ' + D.esc(D.t('devThis')) : '')).join('<br>') + '<br>' + D.esc(D.t('daLimit')) + '<br>' + s.events.map(e => D.esc(D.t(labels[e.kind]) + ' · ' + e.device.slice(0, 20) + ' · ' + new Date(e.ts).toLocaleString()) + (e.ack ? ' ✓' : '')).join('<br>');
  }
  async function review() {
    const acct = await D.get('identity', 'account'), root = acct?.root || D.me(), reg = await registry(root.slice(0, 12), root);
    const overlay = document.createElement('div'); overlay.className = 'overlay overlay-dark';
    const modal = document.createElement('div'); modal.className = 'modal'; D.safeSetHTML(modal, await security()); overlay.appendChild(modal);
    for (const [i, pub] of (reg?.list || []).entries()) if (pub !== root && root === D.me()) {
      const revoke = document.createElement('button'); revoke.className = 'btn btn-o btn-sm'; revoke.textContent = D.t('daRevoke') + ' ' + pub.slice(0, 12);
      revoke.onclick = async () => { try { await D.unlink(i + 1); overlay.remove(); await check(); } catch(e) { D.dbg(e, 'device-revoke'); } }; modal.appendChild(revoke);
    }
    const note = document.createElement('p'); note.textContent = D.t('daRecovery'); modal.appendChild(note);
    const close = document.createElement('button'); close.className = 'btn btn-o btn-sm'; close.textContent = D.t('close'); close.onclick = () => overlay.remove(); modal.appendChild(close); document.body.appendChild(overlay);
  }
  async function notice(kind, root, epoch) {
    await serial(async () => { const s = await load(); record(s, kind + ':' + root + ':' + epoch, kind, root, Date.now()); await save(s); });
    await paint();
  }
  return { registry, observeRegistry, observeActivities, observeKeys, announce, check, acknowledge, security, review, paint, notice };
}
