// Device linking: legacy fan-out and opt-in out-of-band key certificates.

import { offerText, bindingText, verifyOffer, verifyBinding, deviceToken, readDeviceToken, verifyBindingRegistry } from './device-keys.js';

export function createDeviceLink(D) {
  const locked = work => {
    if (!globalThis.navigator?.locks) throw new Error('device key linking requires Web Locks');
    return navigator.locks.request('breeze-device-link:' + D.myPubB64(), work);
  };
  function tokenPanel(token, key) {
    const [box, d] = D.cmdPanel('cmd-panel');
    const title = document.createElement('p'); title.textContent = D.t(key);
    const code = document.createElement('code'); code.className = 'i-select-all i-green-break'; code.textContent = token;
    d.append(title, code); box.appendChild(d); box.scrollTop = box.scrollHeight;
  }
  async function devicesWithBindings(pubs, binding) {
    if (typeof D.sigPub !== 'function') return pubs.map(pub => ({ pub, name: pub === D.myPubB64() ? 'primary' : '' }));
    const resp = await D.postAPIRaw('/device/list', { accountId: D.myId() });
    const rec = resp?.ok ? await resp.json() : null;
    return Promise.all(pubs.map(async pub => {
      const proof = binding?.pub === pub ? binding : (await D.dbGet('identity', 'verify:device-binding:' + pub)) || rec?.devices?.find(d => d.pub === pub)?.binding;
      const valid = proof && await verifyBinding(proof, { root: D.myPubB64(), rootEd: D.sigPub(), pub });
      return { pub, name: pub === D.myPubB64() ? 'primary' : '', ...(valid ? { binding: proof } : {}) };
    }));
  }
  async function linkDevicePub(arg, serialized = false) {
    if (D.checkpoint && globalThis.navigator?.locks && !serialized) return locked(() => linkDevicePub(arg, true));
    let offer;
    if (arg.startsWith('breeze-device-offer:')) {
      try { offer = readDeviceToken('offer', arg); if (!await verifyOffer(offer)) throw new Error('invalid offer'); arg = offer.pub; }
      catch(e) { D.dbg(e, 'device-offer'); D.showToast(D.t('dkInvalid'), 'error'); return; }
    }
    if (arg === D.myPubB64()) { D.showToast(D.t('devSelfLink'), 'error'); return; }
    if (!/^[A-Za-z0-9+/=_-]{40,200}$/.test(arg)) { D.showToast(D.t('devBadPub'), 'error'); return; }
    if (!await D.showConfirm(D.t('devLinkConfirm', arg.slice(0, 16) + '…'))) return;
    try {
      const acct = (await D.dbGet('identity', 'account')) || { root: D.myPubB64(), isPrimary: true };
      if (acct.root !== D.myPubB64()) { D.showToast(D.t('devPrimaryOnly'), 'error'); return; }
      const current = (await D.fetchDeviceList(D.myId(), D.myPubB64())) || [D.myPubB64()];
      if (current.includes(arg) && !offer) { D.showToast(D.t('devAlready'), 'info'); return; }
      const ts = Date.now();
      const binding = offer ? { v: 1, root: D.myPubB64(), rootEd: D.sigPub(), pub: offer.pub, ed: offer.ed, nonce: offer.nonce, issuedAt: ts } : null;
      if (binding) {
        binding.sig = await D.signMessage(bindingText(binding));
        if (!await verifyBinding(binding, { root: D.myPubB64(), rootEd: D.sigPub(), pub: arg })) throw new Error('binding signing failed');
      }
      const devices = await devicesWithBindings([...new Set([D.myPubB64(), ...current, arg])], binding);
      const checkpoint = await D.checkpoint?.(devices);
      const digestBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(devices.map(d => d.pub))));
      const digest = Array.from(new Uint8Array(digestBuf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
      const sig = await D.signMessage(`breeze-device-set:${D.myId()}:${ts}:${digest}`);
      const resp = await D.postAPIRaw('/device/set', { accountId: D.myId(), root: D.myPubB64(), devices, ts, sig });
      if (resp?.ok) {
        if (binding && !await D.dbPut('identity', binding, 'verify:device-binding:' + arg)) throw new Error('binding persistence failed');
        await D.dbPut('identity', acct, 'account');
        D.bustDevCache(); // bust the cache so self-sync starts immediately
        D.showToast(D.t('devAdded'), 'success');
        if (binding) tokenPanel(deviceToken('binding', { ...binding, ...(offer.authority === 1 && checkpoint ? { checkpoint } : {}) }), 'dkReturn');
        // Stage 4 step 3: offer the history transfer right after the link.
        if (await D.showConfirm(D.t('histSendAsk'))) {
          const r = await D.sendHistoryTo(arg);
          D.showToast(r.sent ? D.t('histSent') : D.t('histEmpty'), r.sent ? 'success' : 'info');
        }
      } else D.showToast(D.t('devSetFail'), 'error');
    } catch(err) { D.dbg(err, 'link'); D.showToast(D.t('devSetFail'), 'error'); }
  }

  async function linkToRoot(rootPub) {
    if (rootPub.startsWith('breeze-device-binding:')) {
      try { await locked(async () => {
        const { checkpoint, ...certificate } = readDeviceToken('binding', rootPub), state = await D.dbGet('identity', 'verify:device-link');
        let binding = certificate;
        const expected = { root: binding.root, rootEd: binding.rootEd, pub: D.myPubB64(), ed: D.sigPub(), nonce: state?.offer?.nonce };
        if (!state?.offer || !await verifyBinding(binding, expected) || state.binding && (state.binding.root !== binding.root || state.binding.rootEd !== binding.rootEd || state.binding.issuedAt > binding.issuedAt)) throw new Error('binding or root pin mismatch');
        if (!await D.showConfirm(D.t('dkTrust', binding.root.slice(0, 16)))) return;
        const resp = await D.postAPIRaw('/device/list', { accountId: binding.root.slice(0, 12) });
        if (!resp?.ok || !await verifyBindingRegistry(await resp.json(), binding)) throw new Error('binding registry mismatch');
        if (D.bindDevice) binding = await D.bindDevice(binding);
        if (!await D.dbPut('identity', { ...state, binding }, 'verify:device-link')) throw new Error('binding persistence failed');
        if (checkpoint && D.acceptCheckpoint) {
          if (checkpoint.root !== binding.root || !checkpoint.devices?.some(d => d.pub === binding.pub && d.binding?.sig === binding.sig)) throw new Error('certificate checkpoint mismatch');
          await D.acceptCheckpoint(checkpoint, binding.rootEd);
        }
        if (!await D.dbPut('identity', { root: binding.root, rootEd: binding.rootEd, isPrimary: false }, 'account')) throw new Error('account persistence failed');
        if (!await D.dbPut('identity', { binding }, 'verify:device-link')) throw new Error('offer consumption failed');
        D.bustDevCache(); await D.refreshDeviceRole(); D.showToast(D.t('dkLinked'), 'success');
        await D.linked?.();
      }); } catch(e) { D.dbg(e, 'device-binding'); D.showToast(D.t('dkInvalid'), 'error'); }
      return;
    }
    if (!/^[A-Za-z0-9+/=_-]{40,200}$/.test(rootPub)) { D.showToast(D.t('devBadPub'), 'error'); return; }
    if (rootPub === D.myPubB64()) { D.showToast(D.t('devSelfLink'), 'error'); return; }
    try {
      const legacy = async () => {
      const resp = await D.postAPIRaw('/device/list', { accountId: rootPub.slice(0, 12) });
      const rec = resp?.ok ? await resp.json() : null;
      if (!rec?.devices || rec.root !== rootPub) { D.showToast(D.t('devNotListed'), 'error'); return; }
      if (!rec.devices.some(d => d.pub === D.myPubB64())) { D.showToast(D.t('devNotListed'), 'error'); return; }
      const previous = await D.dbGet('identity', 'verify:device-link');
      if (previous?.binding) { D.showToast(D.t('dkInvalid'), 'error'); return; }
      await D.dbPut('identity', { root: rootPub, rootEd: rec.rootEd || null, isPrimary: false }, 'account');
      D.bustDevCache(); await D.refreshDeviceRole();
      D.showToast(D.t('devLinked'), 'success');
      };
      if (globalThis.navigator?.locks) await locked(legacy); else await legacy();
    } catch(err) { D.dbg(err, 'linkto'); D.showToast(D.t('devSetFail'), 'error'); }
  }

  // The /link, /linkto, /devices and /unlink command bodies. The
  // dispatcher has already claimed the input (preventDefault +
  // clearInput) when the prefix matched.
  async function handleCommand(val, serialized = false) {
    if (D.checkpoint && globalThis.navigator?.locks && val.startsWith('/unlink ') && !serialized) return locked(() => handleCommand(val, true));
    if (val === '/link keys') {
      try { await locked(async () => {
        const offer = { v: 1, pub: D.myPubB64(), ed: D.sigPub(), nonce: [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('') };
        if (D.checkpoint) offer.authority = 1;
        offer.sig = await D.signMessage(offerText(offer));
        if (!await verifyOffer(offer)) throw new Error('offer signing failed');
        const state = await D.dbGet('identity', 'verify:device-link');
        if (!await D.dbPut('identity', { ...state, offer }, 'verify:device-link')) throw new Error('offer persistence failed');
        tokenPanel(deviceToken('offer', offer), 'dkOffer');
      }); } catch(e) { D.dbg(e, 'device-offer'); D.showToast(D.t('dkInvalid'), 'error'); }
      return;
    }
    if (val === '/link' || val.startsWith('/link ')) {
      const arg = val.slice(5).trim();
      if (!D.hasApi()) { D.showToast(D.t('uiNoServer'), 'error'); return; }
      if (!arg) {
        // Show my pub as text AND as a QR (stage 4 step 2), with the
        // primary-side scan in the same panel: whichever of the two
        // devices you are holding, one of the two directions is yours.
        const [box, d] = D.cmdPanel('cmd-panel');
        D.safeSetHTML(d, '<b class="i-g">' + D.t('devLinkTitle') + '</b><br>' + D.t('devLinkHint') + '<br><code class="i-select-all">' + D.esc(D.myPubB64()) + '</code>');
        try {
          const qr = globalThis.__breezeQR?.generateQR(D.myPubB64());
          if (qr) { qr.className = 'qr-code'; d.appendChild(qr); }
        } catch(e) { D.dbg(e, 'link-qr'); }
        d.appendChild(D.deviceScanButton('devScanAdd', (v) => { linkDevicePub(v); }));
        box.appendChild(d); box.scrollTop = box.scrollHeight;
        try { await D.clipboardWrite(D.myPubB64()); D.showToast(D.t('toastCopied'), 'success'); } catch {}
        return;
      }
      // Primary side: add the pasted device pub to my registry and sign it.
      await linkDevicePub(arg);
      return;
    }
    // Secondary device, final step: bind THIS device to the account whose root pub the user
    // physically carried over. That gesture is the trust anchor (same TOFU as adding a contact
    // by raw key); the root's Ed25519 signing key is pinned here and required stable afterwards.
    if (val === '/linkto' || val.startsWith('/linkto ')) {
      if (!D.hasApi()) { D.showToast(D.t('uiNoServer'), 'error'); return; }
      const rootPub = val.slice(8).trim();
      if (rootPub) { await linkToRoot(rootPub); return; }
      const [box, d] = D.cmdPanel('cmd-panel');
      D.safeSetHTML(d, '<b class="i-g">' + D.t('devLinkToTitle') + '</b><br>' + D.t('devLinkToHint'));
      d.appendChild(D.deviceScanButton('devScanRoot', (v) => { linkToRoot(v); }));
      box.appendChild(d); box.scrollTop = box.scrollHeight;
      return;
    }
    if (val === '/devices') {
      const [box, d] = D.cmdPanel('cmd-panel');
      const acct = await D.dbGet('identity', 'account');
      const rootPub = acct?.root || D.myPubB64();
      const list = await D.fetchDeviceList(rootPub.slice(0, 12), rootPub);
      const rows = (list || [D.myPubB64()]).map((p, i) =>
        `${i + 1}. <code>${D.esc(p.slice(0, 20))}…</code>${p === D.myPubB64() ? ' ← ' + D.t('devThis') : ''}`);
      D.safeSetHTML(d, '<b class="i-g">' + D.t('devListTitle') + '</b><br>' + rows.join('<br>'));
      box.appendChild(d); box.scrollTop = box.scrollHeight;
      return;
    }
    if (val.startsWith('/unlink ')) {
      const idx = parseInt(val.slice(8).trim(), 10);
      const acct = (await D.dbGet('identity', 'account')) || { root: D.myPubB64(), isPrimary: true };
      if (acct.root !== D.myPubB64()) { D.showToast(D.t('devPrimaryOnly'), 'error'); return; }
      const current = (await D.fetchDeviceList(D.myId(), D.myPubB64())) || [D.myPubB64()];
      const victim = current[idx - 1];
      if (!victim || victim === D.myPubB64()) { D.showToast(D.t('devBadIndex'), 'error'); return; }
      if (!await D.showConfirm(D.t('devUnlinkConfirm', victim.slice(0, 16) + '…'), { danger: true })) return;
      try {
        const devices = await devicesWithBindings(current.filter(p => p !== victim));
        await D.checkpoint?.(devices);
        const ts = Date.now();
        const digestBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(devices.map(d => d.pub))));
        const digest = Array.from(new Uint8Array(digestBuf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
        const sig = await D.signMessage(`breeze-device-set:${D.myId()}:${ts}:${digest}`);
        const resp = await D.postAPIRaw('/device/set', { accountId: D.myId(), root: D.myPubB64(), devices, ts, sig });
        if (resp?.ok) { D.bustDevCache(); D.showToast(D.t('devRemoved'), 'success'); }
        else D.showToast(D.t('devSetFail'), 'error');
      } catch(err) { D.dbg(err, 'unlink'); D.showToast(D.t('devSetFail'), 'error'); }
      return;
    }
  }

  return { linkDevicePub, linkToRoot, handleCommand };
}
