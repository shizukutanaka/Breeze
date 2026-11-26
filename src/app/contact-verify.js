import { comparisonQR, compareQR, legacySafetyNumber } from './safety-number.js';
export { negotiatedSafetyNumber } from './safety-number.js';

const utf8 = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
function pins(contact) {
  if (!contact || contact.isGroup || typeof contact.pubB64 !== 'string' || typeof contact.sigPub !== 'string') throw new Error('verification pins unavailable');
  for (const [value, sizes] of [[contact.pubB64, [32, 65]], [contact.sigPub, [32]]]) {
    const raw = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    if (!sizes.includes(raw.length) || btoa(String.fromCharCode(...raw)) !== value) throw new Error('verification pin encoding');
  }
  return [contact.pubB64, contact.sigPub];
}
const digest = async value => hex(await crypto.subtle.digest('SHA-256', utf8.encode(JSON.stringify(value))));
export const contactBinding = async contact => digest(['BreezeContactVerification', 1, ...pins(contact)]);
export const contactSafetyNumber = async (local, remote) => (await digest(['BreezeContactComparison', 1, ...[pins(local), pins(remote)].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)])).match(/.{4}/g).join(' ');

export function createContactVerify(D) {
  const chains = new Map(), failed = new Set(), now = D.now || Date.now;
  let headerRevision = 0;
  const slot = id => 'verify:' + id;
  const read = id => D.get('identity', slot(id));
  const write = async (id, value) => { if (await D.put('identity', value, slot(id)) !== true) throw new Error('verification persistence failed'); };
  const refresh = () => { Promise.resolve().then(() => D.refresh?.()).catch(e => D.dbg(e, 'verification-refresh')); };
  const serial = (id, work) => {
    const run = () => typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('breeze-verify:' + D.account + ':' + id, work) : work();
    const next = (chains.get(id) || Promise.resolve()).then(run, run);
    chains.set(id, next.catch(() => {})); return next;
  };
  async function invalidate(id, reason = 'keys') {
    if (!id) return;
    failed.add(id);
    return serial(id, async () => {
      const old = await read(id);
      if (!old?.changed) {
        await write(id, { ...old, v: 1, verified: false, changed: true, strict: old?.strict !== false, reason, changedAt: now(), revision: (old?.revision || 0) + 1 });
        await D.audit('security', D.t('cvAuditChanged') + ' ' + id + ' [' + reason + ']', 'warn');
        refresh();
      }
      failed.delete(id);
    });
  }
  async function state(contact) {
    if (!contact || contact.isGroup) return { verified: false, changed: false, strict: true };
    const c = contact, old = await read(c.id);
    let binding = null;
    try { binding = await contactBinding(c); } catch { /* missing pins are never verified */ }
    if (old?.verified && old.binding !== binding) { await invalidate(c.id); return { ...await read(c.id), binding }; }
    if (failed.has(c.id)) return { ...old, verified: false, changed: true, strict: true, binding };
    return { strict: true, ...old, binding };
  }
  async function observe(contact) {
    if (!contact) return;
    if (contact.isGroup) { for (const m of contact.members || []) if (m.pubB64 && m.sigPub) await observe(m); return; }
    const previous = await D.get('contacts', contact.id);
    if (previous && (previous.pubB64 && previous.pubB64 !== contact.pubB64 || previous.sigPub && previous.sigPub !== contact.sigPub)) await invalidate(contact.id);
    await state(contact);
  }
  async function verify(contact, method, expected) {
    if (!['safety-number', 'in-person-pairing', 'pairing-migration'].includes(method)) throw new Error('verification method');
    return serial(contact.id, async () => {
      const fresh = await D.get('contacts', contact.id);
      if (!fresh || fresh.isGroup) throw new Error('verification contact missing');
      const binding = await contactBinding(fresh), old = await read(contact.id);
      if (binding !== await contactBinding(contact) || (expected && (expected.binding !== binding || expected.revision !== (old?.revision || 0)))) throw new Error('verification changed during comparison');
      await write(contact.id, { v: 1, binding, verified: true, changed: false, strict: old?.strict !== false, at: now(), method, revision: (old?.revision || 0) + 1 });
      failed.delete(contact.id);
      await D.audit('security', D.t('cvAuditVerified') + ' ' + contact.id + ' [' + method + ']', 'info'); refresh();
    });
  }
  async function setStrict(contact, strict) {
    return serial(contact.id, async () => {
      const old = await read(contact.id);
      await write(contact.id, { ...old, v: 1, strict: !!strict, revision: old?.revision || 0 }); refresh();
    });
  }
  async function permit(contact) {
    if (!contact) return false;
    if (contact.isGroup) {
      for (const member of contact.members || []) if (!await permit(member)) return false;
      return true;
    }
    const fresh = await D.get('contacts', contact.id);
    const s = await state(fresh || contact);
    return !(s.changed && s.strict !== false);
  }
  async function migrate() {
    return serial('policy', async () => {
      if (await read('policy')) return;
      const contacts = await D.contacts();
      await write('policy', { v: 1, migratedAt: now() });
      for (const c of contacts) {
        if (c.offlineVerified && c.offlinePairing?.remote?.pub === c.pubB64 && c.offlinePairing.remote.sigPub === c.sigPub && !await read(c.id)) await verify(c, 'pairing-migration');
      }
    });
  }
  const labelKey = s => s.verified ? 'cvVerified' : s.changed ? 'cvChanged' : 'cvUnverified';
  async function label(contact, compact = false, member = false) {
    if (contact.isGroup) return '';
    const s = member && (!contact.pubB64 || !contact.sigPub) ? { verified: false, changed: false } : await state(contact);
    const text = D.esc(D.t(labelKey(s)));
    return s.verified || s.changed || member ? ' <span class="enc-badge ' + (s.verified ? 'color-g' : s.changed ? 'color-r' : 'color-t3') + '" data-contact-verification="' + (s.verified ? 'verified' : s.changed ? 'changed' : 'unverified') + '" title="' + text + '" aria-label="' + text + '">' + (compact ? s.verified ? '✓' : '⚠' : text) + '</span>' : '';
  }
  async function labels(contacts) { return new Map(await Promise.all(contacts.map(async c => [c.id, await label(c, false, true)]))); }
  async function security(contact) {
    const contacts = contact?.isGroup ? contact.members || [] : contact ? [contact] : await D.contacts();
    const lines = await Promise.all(contacts.filter(c => !c.isGroup).map(async c => { const s = contact?.isGroup && (!c.pubB64 || !c.sigPub) ? { verified: false, changed: false, strict: false } : await state(c); return D.esc(c.name || c.id) + ': ' + D.esc(D.t(labelKey(s))) + (s.strict !== false ? ' · ' + D.esc(D.t('cvStrict')) : ''); }));
    return '<b>' + D.esc(D.t('cvTitle')) + '</b><br>' + (lines.join('<br>') || D.esc(D.t('cvUnverified')));
  }
  async function paintHeader(contact) {
    const revision = ++headerRevision;
    const html = await label(contact);
    if (revision !== headerRevision || D.active()?.id !== contact.id) return;
    const header = D.header(); if (!header) return;
    header.querySelector('[data-contact-verification]')?.remove();
    if (html) { const span = document.createElement('span'); D.safeSetHTML(span, html); header.appendChild(span.firstElementChild); }
    const parent = header.closest('.conv-header'); if (!parent) return;
    parent.parentElement.querySelector('[data-verification-warning]')?.remove();
    const s = await state(contact);
    if (revision !== headerRevision || D.active()?.id !== contact.id || !s.changed) return;
    const warning = document.createElement('button'); warning.type = 'button'; warning.className = 'btn btn-o btn-sm color-r'; warning.dataset.verificationWarning = contact.id;
    warning.textContent = D.t('cvChanged') + ' — ' + D.t('cvReverify'); warning.onclick = () => show(contact).catch(e => D.dbg(e, 'verification-dialog'));
    parent.insertAdjacentElement('afterend', warning);
  }
  async function show(contact) {
    const fresh = await D.get('contacts', contact.id);
    if (!fresh || fresh.isGroup) return;
    const s = await state(fresh), expected = { binding: s.binding, revision: s.revision || 0 };
    let num = await D.safetyNumber(fresh.pubB64);
    let combined = '';
    try { combined = await contactSafetyNumber(D.local(), fresh); } catch { /* cannot confirm without both pins */ }
    const overlay = document.createElement('div'); overlay.className = 'overlay overlay-dark';
    D.safeSetHTML(overlay, `<div class="modal verification-modal"><div class="i-emoji-lg">🔐</div><div class="fw-700 text-sm mb-2">${D.t('safetyNumber')}</div><div class="i-safety-num">${D.esc(num || '')}</div><div class="text-xs color-t3 mb-3">${D.t('safetyDesc')}</div><div class="text-xs mb-3" id="kt-audit-status">${D.esc(D.t('ktChecking'))}</div></div>`);
    const modal = overlay.firstElementChild;
    const both = document.createElement('p'); both.className = 'text-xs'; both.textContent = D.t('cvCompare') + (combined ? '\n' + combined : '\n' + D.t('cvMissingPin')); modal.appendChild(both);
    const strict = document.createElement('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = s.strict !== false;
    strict.append(checkbox, document.createTextNode(D.t('cvStrict'))); modal.appendChild(strict);
    const result = document.createElement('p'); result.setAttribute('role', 'status'); result.textContent = D.t(labelKey(s)); modal.appendChild(result);
    const version = document.createElement('p'); version.className = 'text-xs color-t3'; version.textContent = D.t(num.split(' ').length === 12 ? 'snV2' : 'snLegacy'); modal.appendChild(version);
    let stopScan;
    const closeScan = () => { stopScan?.(); stopScan = null; };
    const qr = document.createElement('div'); qr.className = 'qr-code';
    const paintQR = () => {
      qr.replaceChildren();
      if (combined && D.qr) { try { const code = D.qr.generateQR(comparisonQR(num, combined)); code.className = 'qr-code'; qr.appendChild(code); } catch(e) { D.dbg(e, 'verification-qr'); } }
    };
    if (D.qr && combined) {
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'btn btn-o btn-sm'; toggle.textContent = D.t('snUseLegacy'); toggle.disabled = num.split(' ').length !== 12;
      toggle.onclick = async () => { try { closeScan(); num = await legacySafetyNumber(D.local().pubB64, fresh.pubB64); overlay.querySelector('.i-safety-num').textContent = num; version.textContent = D.t('snLegacy'); toggle.disabled = true; paintQR(); } catch(e) { D.dbg(e, 'verification-legacy'); } };
      modal.append(toggle, qr); paintQR();
      if (typeof BarcodeDetector !== 'undefined') {
        const scan = document.createElement('button'); scan.type = 'button'; scan.className = 'btn btn-o btn-sm'; scan.textContent = D.t('scanQR');
        scan.onclick = () => { closeScan(); stopScan = D.qr.startScan({ container: qr, onResult: async value => {
          closeScan();
          const outcome = compareQR(value, comparisonQR(num, combined));
          if (outcome !== 'match') { result.textContent = D.t(outcome === 'version' ? 'snVersion' : 'snMismatch'); return; }
          try { await verify(fresh, 'safety-number', expected); result.textContent = D.t('cvVerified'); }
          catch(e) { D.dbg(e, 'verification-scan'); result.textContent = D.t('cvFailed'); }
        }, onError: e => { D.dbg(e, 'verification-camera'); result.textContent = D.t('toastCameraFail'); } }); };
        modal.appendChild(scan);
      }
    }
    const mark = document.createElement('button'); mark.type = 'button'; mark.className = 'btn btn-g btn-sm'; mark.dataset.verifyContact = fresh.id; mark.textContent = D.t('cvMark'); mark.disabled = !combined; modal.appendChild(mark);
    checkbox.onchange = async () => { try { await setStrict(fresh, checkbox.checked); } catch(e) { D.dbg(e, 'verification-strict'); result.textContent = D.t('cvFailed'); } };
    mark.onclick = async () => {
      mark.disabled = true;
      try { await verify(fresh, 'safety-number', expected); result.textContent = D.t('cvVerified'); }
      catch(e) { D.dbg(e, 'verification-mark'); result.textContent = D.t('cvFailed'); }
      finally { mark.disabled = !combined; }
    };
    const dismiss = () => { closeScan(); overlay.remove(); };
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn-o btn-sm'; close.textContent = D.t('close'); close.onclick = dismiss; modal.appendChild(close);
    overlay.onclick = e => { if (e.target === overlay) dismiss(); }; document.body.appendChild(overlay);
    try {
      const audit = await D.auditKeys(fresh), el = overlay.querySelector('#kt-audit-status');
      const key = !audit ? 'ktUnavailable' : audit.verdict === 'tampered' ? 'ktTampered' : audit.verdict === 'rolled' ? 'ktRolled' : 'ktOk';
      el.textContent = D.t(key); el.className = 'text-xs mb-3 ' + (key === 'ktOk' ? 'color-g' : key === 'ktUnavailable' ? 'color-t3' : 'color-r');
    } catch(e) { D.dbg(e, 'verification-audit'); }
  }
  return { state, observe, invalidate, verify, setStrict, permit, migrate, label, labels, security, paintHeader, show };
}
