// Breeze — the /security and /who information panels (moved out of
// index.html in the stage 5 step 5 line-budget pass; content and
// wording unchanged). Both panels render only state this device
// already holds; the security panel lists what is ACTUALLY protecting
// the user at runtime (flag states, session state, measured P2P
// aggregates), not compiled-in capabilities.

export function createInfoPanels(D) {
  async function showSecurity() {
      const [box, d] = D.cmdPanel('cmd-panel-mono');
      const cs = D.cryptoStack();
      const sess = D.activeContact() ? await D.getSession(D.activeContact().pubB64?.slice(0, 12)) : null;
      // Honest runtime state of opt-in/flag-gated protections — list what is ACTUALLY
      // protecting the user on this device, not just compiled-in capabilities.
      const _identRec = await D.dbGet('identity', 'keys').catch(() => null);
      const _atRestOn = D.atRestIsWrapped(_identRec);
      // P2P_PLAN Step 1 display: this device's own delivery/route
      // aggregates (on-device only, never transmitted — src/app/
      // p2p-stats.js). Fallback reads the delivery counters directly so
      // the lines still render if the module failed to load.
      const _p2pSnap = D.p2pStats() ? D.p2pStats().snapshot() : (() => { try { const s = JSON.parse(localStorage.getItem('brz-p2p-direct') || '{}'); const a = s.directAck || 0, n = s.directNoAck || 0; return { directAck: a, directNoAck: n, directTotal: a + n, directRate: (a + n) > 0 ? a / (a + n) : null, conn: null, connTotal: 0, connFailed: 0 }; } catch { return null; } })();
      // D20: persistence-failure counters (index.html _diagBump) — dead-letter
      // and retry-queue writes that failed silently before; shown as
      // "dead-letter / retry-restore" counts, zero when never hit.
      const _diagPersist = (() => { try { return JSON.parse(localStorage.getItem('brz-diag') || '{}'); } catch { return {}; } })();
      const _diagPersistLine = (_diagPersist.deadLetterStoreFail || 0) + ' / ' + (_diagPersist.retryRestoreFail || 0);
      // R02: message-store (D23) degradation — msgkey init failures and the
      // plaintext body saves they cause. Non-zero here means C9 at-rest
      // sealing is NOT fully in effect on this device.
      const _diagMsgStoreLine = (_diagPersist.msgkeyInitFail || 0) + ' / ' + (_diagPersist.msgPlaintextSave || 0);
      const _directRateLine = !_p2pSnap ? '—'
        : _p2pSnap.directRate === null ? D.t('secDirectNoData')
        : Math.round(_p2pSnap.directRate * 100) + '% (' + _p2pSnap.directAck + '/' + _p2pSnap.directTotal + ')';
      const _connRouteLine = !_p2pSnap?.conn ? '—'
        : 'Direct ' + _p2pSnap.conn.direct + ' · STUN ' + _p2pSnap.conn.srflx + ' · TURN ' + _p2pSnap.conn.turn + ' · ' + D.t('secConnFailed') + ' ' + _p2pSnap.connFailed;
      const _signalStats = _p2pSnap?.signal;
      const _signalPollLine = !_signalStats?.sessions ? D.t('secDirectNoData')
        : D.t('secSignalSessions') + ' ' + _signalStats.sessions + ' · '
          + D.t('secSignalPre') + ' ' + _signalStats.preEstablished + ' (' + (_signalStats.preEstablished / _signalStats.sessions).toFixed(1) + ' ' + D.t('secSignalPerSession') + ') · '
          + D.t('secSignalPost') + ' ' + _signalStats.postEstablished + ' (' + (_signalStats.postEstablished / _signalStats.sessions).toFixed(1) + ' ' + D.t('secSignalPerSession') + ')';
      // TURN provider honesty (Step 5): name WHO relays media when a call
      // or relay-only connection falls back to TURN — in particular the
      // third-party free Open Relay an unconfigured relay silently uses.
      // Stage 6 step 3: this month's measured TURN share of call
      // traffic (on-device counters; null share = nothing measured).
      const _turnUse = _p2pSnap?.turn;
      const _turnUseLine = !_turnUse || _turnUse.mRelayShare === null ? D.t('secTurnUsage') + ': ' + D.t('secDirectNoData')
        : D.t('secTurnUsage') + ': ' + Math.round(_turnUse.mRelayShare * 100) + '% (' + (_turnUse.mRelayBytes / 1048576).toFixed(1) + ' MB / ' + (_turnUse.mTotalBytes / 1048576).toFixed(1) + ' MB)';
      const _turnLine = !D.turnCredential() ? '✗ ' + D.t('secNotConfigured')
        : D.turnCredential().provider === 'none' ? '✗ ' + D.t('secTurnNone')
        : '✓ ' + D.t('secActive') + ' (' + (D.turnCredential().provider === 'cloudflare' ? 'Cloudflare Calls'
          : D.turnCredential().provider === 'custom' ? D.t('secTurnCustom')
          : D.turnCredential().provider === 'static' ? D.t('secTurnStatic')
          : D.turnCredential().provider === 'openrelay' ? D.t('secTurnOpenRelay')
          : (D.turnCredential().provider || '?')) + ')';
      D.safeSetHTML(d, [
        '<b class="i-g13">' + D.t('cmdCryptoTitle') + '</b>',
        '',
        '<b>' + D.t('secPledgeTitle') + '</b>',
        D.t('secPledgeNoAds'),
        D.t('secPledgeE2ee'),
        D.t('secSealedSenderNote'),
        D.t('secPledgeRetention'),
        '',
        '<b>' + D.t('secActiveProtections') + '</b>',
        D.t(_atRestOn ? 'secAtRestWrapOn' : 'secAtRestWrapOff'),
        D.t('secLblRecovery') + ': ' + (_identRec?.recoveryMode === 'none' ? '✗ ' + D.t('secRecoveryNone') : _identRec?.recoveryMode === 'phrase' ? '<span class="i-g">✓ ' + D.t('secRecoveryPhrase') + '</span>' : _identRec?.recoveryMode === 'simple' ? '<span class="i-g">✓ ' + D.t('secRecoverySimple') + '</span>' : D.t('secRecoveryLegacy')),
        D.t(D.config().GROUP_RATCHET_V5 ? 'secGroupFSOn' : 'secGroupFSOff'),
        D.t(D.config().CALL_E2E_SIGNAL ? 'secCallSignalOn' : 'secCallSignalOff'),
        '',
        '<b>' + D.t('cmdSectionCryptoStack') + '</b>',
        D.t('cmdLblKeyExchange') + ': <span class="i-g">' + cs.keyExchange + '</span> ' + (D.hasX25519() ? D.t('secBrowserNative') : D.t('secWebCryptoFallback')),
        D.t('secLblMsgSigning') + ': <span class="i-g">' + cs.signing + '</span>' + (D.hasEd25519() ? ' ' + D.t('secBrowserNative') : ''),
        D.t('secLblSigningKey') + ': ' + (D.signingPubB64() ? '✓ ' + D.signingPubB64().slice(0, 8) + '...' : '✗ ' + D.t('secNotAvail')),
        D.t('secLblEncryption') + ': <span class="i-g">' + cs.encryption + '</span> ' + D.t('secBrowserNative'),
        D.t('secLblKDF') + ': ' + cs.kdf + ' ' + D.t('secBrowserNative'),
        D.t('secLblRatchet') + ': ' + cs.ratchet + ' ' + D.t('secFwdSecParen'),
        D.t('secLblGroup') + ': ' + cs.groupCrypto,
        '',
        '<b>' + D.t('cmdSectionPQ') + '</b>',
        'ML-KEM: ' + (D.hasPQ() ? '<span class="i-g">✓ ' + D.t('secNativeSupport') + '</span>' : '✗ ' + D.t('secNotYetBrowser')),
        D.t('cmdCryptoPqHybrid'),
        D.t('secLblStatus') + ': ' + cs.pqReady,
        // Stage-3 step 6: the ACTIVE session's own PQ state (the pq:true marker
        // recorded at establishment), as opposed to the browser-capability
        // lines above — a PQXDH session runs on the vendored software KEM
        // regardless of native ML-KEM support.
        'PQXDH: ' + (sess ? (sess.pq ? '<span class="i-g">✓ ' + D.t('secPqxdhInUse') + '</span>' : D.t('secPqxdhClassical')) : '—'),
        '',
        '<b>' + D.t('cmdSectionSession') + '</b>',
        D.activeContact() ? D.t('cmdLblPeer') + ': ' + D.activeContact().name : D.t('cmdNoContact'),
        D.t('cmdLblSession') + ': ' + (sess ? '<span class="i-g">✓ ' + D.t('statusActive') + ' (counter: ' + (sess.sendCounter || 0) + ')</span>' : '✗ ' + D.t('statusNoSession')),
        D.t('secLblFwdSec') + ': ' + (sess ? D.t('cmdCryptoFwdSec') : '—'),
        D.t('secLblReplay') + ': ' + D.replayCacheSize() + '/' + D.config().REPLAY_CACHE_SIZE + ' ' + D.t('secInLruCache'),
        D.t('secSkippedKeys'),
        D.t('secDiagPersist') + ': ' + _diagPersistLine,
        D.t('secDiagMsgStore') + ': ' + _diagMsgStoreLine,
        D.t('cmdCryptoCompression'),
        'Protocol: v4 (pad-only; legacy compressed msgs still read) / v3 (pad-only) / v2 (legacy)',
        D.t('secLblMsgPadding') + ': ' + D.config().MSG_PAD_BOUNDARY + D.t('secByteBoundary'),
        '',
        '<b>' + D.t('cmdSectionBrowser') + '</b>',
        'X25519: ' + (D.hasX25519() ? '✓' : '✗') + ' | Ed25519: ' + (D.hasEd25519() ? '✓' : '✗') + ' | ML-KEM: ' + (D.hasPQ() ? '✓' : '✗'),
        D.t('secLblSecureCtx') + ': ' + (window.isSecureContext ? '✓' : '✗'),
        'WebCrypto: ' + (crypto?.subtle ? '✓' : '✗'),
        'WebRTC: ' + (typeof RTCPeerConnection !== 'undefined' ? '✓' : '✗'),
        '',
        '<b>' + D.t('cmdSectionNetwork') + '</b>',
        D.t('secIceCandFilter'),
        D.t('secLblRelayOnly') + ': ' + (D.settings().relayOnly ? '<span class="i-g">✓ ON</span> ' + D.t('secRelayEnabled') : D.t('secRelayDisabled')),
        D.t('secLblRelayPin') + ': ' + (D.relayPinGate().blocked ? '<span class="color-y">⚠ ' + D.t('secRelayPinMismatch') + '</span>' : D.relayPinFp() ? '<span class="i-g">✓</span> ' + D.relayPinFp() : '—'),
        'TURN: ' + _turnLine,
        _turnUseLine,
        D.t('secLblDirectRate') + ': ' + _directRateLine,
        D.t('secLblConnRoutes') + ': ' + _connRouteLine,
        D.t('secLblSignalPolls') + ': ' + _signalPollLine,
        D.t('secLblRTCCert') + ': ' + (D.hasRTCCertificate() ? '✓ Per-session ECDSA P-256' : '✗ ' + D.t('secDefault')),
        'DataChannel: negotiated:true (DCEP skip)',
        'Negotiation: Perfect Negotiation (glare-safe, MDN spec)',
        'Backpressure: bufferedAmountLowThreshold (' + D.config().DC_BUFFER_LOW + 'B)',
        'Chunk size: ' + D.config().CHUNK_SIZE + 'B (safe cross-browser)',
        'External scripts: none (nothing to pin with SRI)',
        'CSP: ' + (document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? '✓ ' + D.t('secActive') : '✗'),
        'HTTPS: ' + (location.protocol === 'https:' ? '✓' : '⚠ HTTP'),
        '',
        '<b>' + D.t('cmdSectionLock') + '</b>',
        D.t('secLblPassword') + ': ' + (localStorage.getItem('brz-lock-hash') ? '✓ ' + D.t('secPwdSet') : '✗ ' + D.t('secPwdNotSet')),
        D.t('secLblAutoLock') + ': ' + (localStorage.getItem('brz-autolock') === '1' ? '✓ ' + D.t('secOnTabSwitch') : '✗ ' + D.t('secOff')),
        D.t('secLblIdleLock') + ': ' + (parseInt(localStorage.getItem('brz-idle-lock') || '0', 10) > 0 ? '✓ ' + localStorage.getItem('brz-idle-lock') + ' min' : '✗ ' + D.t('secOff')),
        D.t('secBruteForce'),
        D.t('secTimingSafe'),
        '',
        '<b>' + D.t('cmdSectionCSP') + '</b>',
        'CSP: script-src self unsafe-inline; object-src none; base-uri self; frame-ancestors none',
        'COOP: same-origin',
        'XSS sanitizer: esc() → renderMarkdown → renderLinks (chain order fixed)',
        D.t('secMemoryZero'),
        D.t('secKeyStorage'),
        D.t('secAntiReplay'),
      ].join('<br>'));
      box.appendChild(d); box.scrollTop = box.scrollHeight;
  }

  async function showWho() {
    const [box, d] = D.cmdPanel('cmd-panel-mono');
    const addUrl = location.origin + '/?add=' + D.myPubB64() + '&name=' + encodeURIComponent(D.myName());
    const aliasUrl = D.myAlias() ? location.origin + '/?add=' + D.myAlias() : '';
    D.safeSetHTML(d, [
      '<b class="i-g">' + D.t('cmdMyIdentity') + '</b>',
      D.t('cmdLblName') + ': <b>' + D.esc(D.myName()) + '</b>',
      D.t('cmdLblUserId') + ': <code class="i-fs10">' + D.esc(D.myId()) + '</code>',
      D.myAlias() ? D.t('cmdLblAlias') + ': <b class="i-g">' + D.esc(D.myAlias()) + '</b>' : D.t('cmdLblAlias') + ': ' + D.t('cmdNoAlias'),
      D.t('cmdLblCrypto') + ': ' + (D.hasX25519() ? 'X25519' : 'P-256'),
      '',
      '<b>' + D.t('cmdShareLinks') + '</b>',
      '<code class="i-id-small">' + D.esc(addUrl) + '</code>',
      aliasUrl ? '<code class="i-id-small">' + D.esc(aliasUrl) + '</code>' : '',
    ].filter(Boolean).join('<br>'));
    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-o btn-sm mt-2';
    copyBtn.textContent = D.t('uiCopyAddLink');
    copyBtn.onclick = () => { navigator.clipboard?.writeText(addUrl); copyBtn.textContent = D.t('uiCopied'); setTimeout(() => copyBtn.textContent = D.t('uiCopyAddLink'), D.config().TOAST_DURATION_MS); };
    d.appendChild(document.createElement('br'));
    d.appendChild(copyBtn);
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }

  return { showSecurity, showWho };
}

export function createDataPanels(D) {
  // v3.3: FILE MANAGER — list all sent/received files across conversations.
  async function getFileList() {
    const allMsgs = await D.dbGetAll('messages');
    return allMsgs.filter(m => m.fileData || m.voice).map(m => {
      let name = 'Unknown', size = 0, type = 'file';
      try {
        if (m.voice) { name = D.t('voiceMsg'); size = m.voice.length; type = 'audio'; }
        else if (m.fileData) {
          const fd = typeof m.fileData === 'string' ? JSON.parse(m.fileData) : m.fileData;
          name = fd.name || 'Unnamed'; size = fd.size || 0; type = fd.type || 'file';
        }
      } catch(e) { D.dbg(e, 'file-parse'); }
      return { msgId: m.msgId, contactId: m.contactId, name, size, type, ts: m.ts, mine: m.mine };
    }).sort((a, b) => b.ts - a.ts);
  }

  async function showFiles() {
    const files = await getFileList();
    const [box, d] = D.cmdPanel('cmd-panel');
    if (files.length === 0) {
      d.textContent = D.t('uiNoFiles');
    } else {
      const contactMap = {};
      for (const c of await D.dbGetAll('contacts')) contactMap[c.id] = c.name;
      D.safeSetHTML(d, '<b class="i-g">' + D.t('sharedFiles', files.length) + '</b><br>' +
        files.slice(0, 30).map(f => {
          const date = new Date(f.ts).toLocaleDateString();
          const who = f.mine ? D.t('you') : (contactMap[f.contactId] || D.t('unknown'));
          return `${D.esc(f.name)} · ${D.fmtSize(f.size)} · ${D.esc(who)} · ${date}`;
        }).join('<br>') + (files.length > 30 ? '<br>... ' + D.t('uiMoreCount', files.length - 30) : ''));
    }
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }

  // GDPR data export (Art. 15/20): identity summary, contacts, message
  // metadata (text truncated to 200 chars, no keys, no file bodies).
  async function gdprExport() {
    try {
      const identity = await D.dbGet('identity', 'keys');
      const contacts = await D.dbGetAll('contacts');
      const messages = await D.dbGetAll('messages');
      const db = D.db();
      const audit = db.objectStoreNames.contains('audit') ? await D.dbGetAll('audit') : [];
      const settings = db.objectStoreNames.contains('settings') ? await D.dbGet('settings', 'app') : null;
      return {
        exportType: 'GDPR Data Export (Art. 15/20)',
        exportedAt: new Date().toISOString(),
        version: D.config().VERSION,
        identity: identity ? { name: identity.name, alias: identity.alias, pubB64: identity.pubB64, createdAt: identity.createdAt } : null,
        contacts: contacts.map(c => ({ id: c.id, name: c.name, alias: c.alias, isGroup: c.isGroup, createdAt: c.createdAt, pinned: c.pinned, muted: c.muted, blocked: c.blocked, archived: c.archived, notes: c.notes, labels: c.labels || [] })),
        messages: messages.map(m => ({ msgId: m.msgId, contactId: m.contactId, text: m.text?.slice(0, 200), mine: m.mine, ts: m.ts, hasFile: !!m.fileData, hasVoice: !!m.voice })),
        auditLog: audit.slice(-1000),
        settings,
        totalMessages: messages.length,
        totalContacts: contacts.length,
        totalFiles: messages.filter(m => m.fileData || m.voice).length,
      };
    } catch(e) { D.dbg(e, 'gdprExport'); }
  }

  async function runGdpr() {
    const data = await gdprExport();
    if (!data) { D.showToast(D.t('toastServerError'), 'error'); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    D.downloadBlob(blob, `breeze-gdpr-export-${new Date().toISOString().slice(0, 10)}.json`);
    D.auditLog('settings', 'GDPR data export performed');
    D.showToast(D.t('toastGdprExport', data.totalMessages, data.totalContacts, data.totalFiles), 'success');
  }

  return { getFileList, showFiles, gdprExport, runGdpr };
}
