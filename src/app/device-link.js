// Breeze — device linking (moved out of index.html in the stage 5
// step 5 line-budget pass; behavior unchanged from the stage 4
// step 2/3 construction). The ceremony's trust anchor is unchanged:
// the primary adds a device key to its SIGNED registry, the
// secondary binds to a root key it physically carried over, and the
// paste commands and the QR scan callbacks run the identical shared
// functions (linkDevicePub / linkToRoot), so a scanned key gets the
// identical checks and the identical signed registry write.

export function createDeviceLink(D) {
  async function linkDevicePub(arg) {
    if (arg === D.myPubB64()) { D.showToast(D.t('devSelfLink'), 'error'); return; }
    if (!/^[A-Za-z0-9+/=_-]{40,200}$/.test(arg)) { D.showToast(D.t('devBadPub'), 'error'); return; }
    if (!await D.showConfirm(D.t('devLinkConfirm', arg.slice(0, 16) + '…'))) return;
    try {
      const acct = (await D.dbGet('identity', 'account')) || { root: D.myPubB64(), isPrimary: true };
      if (acct.root !== D.myPubB64()) { D.showToast(D.t('devPrimaryOnly'), 'error'); return; }
      const current = (await D.fetchDeviceList(D.myId(), D.myPubB64())) || [D.myPubB64()];
      if (current.includes(arg)) { D.showToast(D.t('devAlready'), 'info'); return; }
      const devices = [...new Set([D.myPubB64(), ...current, arg])].map(p => ({ pub: p, name: p === D.myPubB64() ? 'primary' : '' }));
      const ts = Date.now();
      const digestBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(devices.map(d => d.pub))));
      const digest = Array.from(new Uint8Array(digestBuf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
      const sig = await D.signMessage(`breeze-device-set:${D.myId()}:${ts}:${digest}`);
      const resp = await D.postAPIRaw('/device/set', { accountId: D.myId(), root: D.myPubB64(), devices, ts, sig });
      if (resp?.ok) {
        await D.dbPut('identity', acct, 'account');
        D.bustDevCache(); // bust the cache so self-sync starts immediately
        D.showToast(D.t('devAdded'), 'success');
        // Stage 4 step 3: offer the history transfer right after the link.
        if (await D.showConfirm(D.t('histSendAsk'))) {
          const r = await D.sendHistoryTo(arg);
          D.showToast(r.sent ? D.t('histSent') : D.t('histEmpty'), r.sent ? 'success' : 'info');
        }
      } else D.showToast(D.t('devSetFail'), 'error');
    } catch(err) { D.dbg(err, 'link'); D.showToast(D.t('devSetFail'), 'error'); }
  }

  async function linkToRoot(rootPub) {
    if (!/^[A-Za-z0-9+/=_-]{40,200}$/.test(rootPub)) { D.showToast(D.t('devBadPub'), 'error'); return; }
    if (rootPub === D.myPubB64()) { D.showToast(D.t('devSelfLink'), 'error'); return; }
    try {
      const resp = await D.postAPIRaw('/device/list', { accountId: rootPub.slice(0, 12) });
      const rec = resp?.ok ? await resp.json() : null;
      if (!rec?.devices || rec.root !== rootPub) { D.showToast(D.t('devNotListed'), 'error'); return; }
      if (!rec.devices.some(d => d.pub === D.myPubB64())) { D.showToast(D.t('devNotListed'), 'error'); return; }
      await D.dbPut('identity', { root: rootPub, rootEd: rec.rootEd || null, isPrimary: false }, 'account');
      D.bustDevCache(); await D.refreshDeviceRole();
      D.showToast(D.t('devLinked'), 'success');
    } catch(err) { D.dbg(err, 'linkto'); D.showToast(D.t('devSetFail'), 'error'); }
  }

  // The /link, /linkto, /devices and /unlink command bodies. The
  // dispatcher has already claimed the input (preventDefault +
  // clearInput) when the prefix matched.
  async function handleCommand(val) {
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
        const devices = current.filter(p => p !== victim).map(p => ({ pub: p, name: p === D.myPubB64() ? 'primary' : '' }));
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
