const KEY = 'requests:v1';
export const REQUEST_LIMITS = Object.freeze({ senders: 20, messages: 100, perSender: 20, bytes: 2 * 1024 * 1024, envelope: 128 * 1024, blocked: 1000 });
const cleanName = value => typeof value === 'string' ? value.replace(/[\p{Default_Ignorable_Code_Point}\p{Cc}]/gu, '').slice(0, 64) : '';
const validPub = pub => typeof pub === 'string' && /^(?:[A-Za-z0-9+/]{43}|[A-Za-z0-9+/]{87})=$/.test(pub);
const empty = () => ({ v: 1, entries: [], blocked: [] });

export function requestTransaction(db, change) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings', 'contacts'], 'readwrite');
    const store = tx.objectStore('settings'), get = store.get(KEY);
    let result, failure;
    get.onsuccess = () => {
      try {
        const state = get.result || empty();
        if (state.v !== 1 || !Array.isArray(state.entries) || !Array.isArray(state.blocked)) throw new Error('request format');
        result = change(state, tx.objectStore('contacts'));
        store.put(state, KEY);
      } catch(e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('request storage'));
  });
}

export function createMessageRequests(D) {
  const now = D.now || Date.now, replaying = new WeakSet(), draining = new Set();
  const update = change => (D.transaction || (fn => requestTransaction(D.db(), fn)))((state, contacts) => {
    state.entries = state.entries.filter(e => e.at > now() - 7 * D.MS.DAY);
    return change(state, contacts);
  });
  let dialog = null;
  const error = e => { D.dbg(e, 'message-requests'); D.toast(D.t('mrFailed'), 'error'); };

  async function member(msg) {
    const groups = (await D.all('contacts')).filter(c => c.isGroup && (!msg.groupId || c.id === msg.groupId));
    for (const group of groups) {
      const m = (group.members || []).find(m => m.id === msg.from && (!msg.fromPub || m.pubB64 === msg.fromPub));
      if (m) return m;
      const root = typeof msg.acctRoot === 'string' && (group.members || []).find(m => m.pubB64 === msg.acctRoot);
      if (root && validPub(msg.fromPub) && await D.attribution(root.pubB64, msg.fromPub)) return { ...root, pubB64: msg.fromPub };
    }
    return null;
  }
  async function trusted(msg) {
    const c = await D.get('contacts', msg.from);
    if (c) return c.blocked || c.isGroup || msg.fromPub && c.pubB64 !== msg.fromPub ? 'drop' : 'allow';
    if (!validPub(msg.fromPub) || msg.from !== msg.fromPub.slice(0, 12)) return 'drop';
    if (msg.selfSync) return (await D.devices()).includes(msg.fromPub) ? 'device' : 'drop';
    if (D.root() && msg.fromPub === D.root()) return 'device';
    if (typeof msg.acctRoot === 'string') {
      const root = await D.get('contacts', msg.acctRoot.slice(0, 12));
      if (root?.pubB64 === msg.acctRoot && !root.blocked && await D.attribution(root.pubB64, msg.fromPub)) return 'device';
      if (msg.acctRoot === D.root() && (await D.devices()).includes(msg.fromPub)) return 'device';
    }
    if (msg.groupId || msg.isSenderKey || msg.isProfile) {
      if (await member(msg)) return 'group';
      if (msg.groupId || msg.isSenderKey) return 'drop';
    }
    return 'request';
  }
  async function admit(msg) {
    if (D.signal?.aborted || !msg || typeof msg !== 'object') return false;
    if (replaying.has(msg)) return true;
    const pub = msg.fromPub;
    const status = await update(state => state.blocked.some(b => b.pub === pub || b.pub.slice(0, 12) === msg.from) ? 'blocked' : state.entries.some(e => e.pub === pub) ? 'pending' : 'new');
    if (status === 'blocked') return false;
    const trust = await trusted(msg);
    if (trust === 'drop') return false;
    if (trust === 'device') return true;
    if (trust === 'group') {
      if (status !== 'pending') return true;
      await D.lock(async () => {
        const profiles = await update(state => state.entries.find(e => e.pub === pub)?.messages.filter(m => m.msg.isProfile) || []);
        for (const profile of profiles) {
          replaying.add(profile.msg);
          try { await D.receive(profile.msg); } finally { replaying.delete(profile.msg); }
          await update(state => { const e = state.entries.find(e => e.pub === pub); if (e) e.messages = e.messages.filter(m => m.msg.payload !== profile.msg.payload || m.msg.ts !== profile.msg.ts); });
        }
      });
      return true;
    }
    if (trust === 'allow' && status !== 'pending') return true;
    if (!validPub(pub) || msg.isCall || typeof msg.payload !== 'string' || !Number.isFinite(msg.ts) || msg.ts <= 0) return false;
    const raw = JSON.stringify(msg), bytes = new TextEncoder().encode(raw).length;
    if (bytes > REQUEST_LIMITS.envelope) return false;
    const added = await update(state => {
      if (state.blocked.some(b => b.pub === pub)) return false;
      let entry = state.entries.find(e => e.pub === pub);
      if (!entry) {
        if (state.entries.length >= REQUEST_LIMITS.senders) return false;
        entry = { pub, name: cleanName(msg.fromName), at: now(), messages: [] };
        state.entries.push(entry);
      }
      if (entry.messages.some(m => m.msg.ts === msg.ts && m.msg.payload === msg.payload)) return false;
      const total = state.entries.flatMap(e => e.messages);
      if (entry.messages.length >= REQUEST_LIMITS.perSender || total.length >= REQUEST_LIMITS.messages || total.reduce((n, m) => n + m.bytes, 0) + bytes > REQUEST_LIMITS.bytes) { entry.full = true; return false; }
      entry.messages.push({ msg: JSON.parse(raw), bytes });
      return entry.messages.length === 1;
    });
    if (added && trust !== 'allow') D.notify();
    await refresh();
    return false;
  }
  async function drain(pub) {
    if (draining.has(pub)) return;
    if (D.signal?.aborted || !await update(state => state.entries.some(e => e.pub === pub))) return;
    draining.add(pub);
    try {
      await D.lock(async () => {
        for (;;) {
          if (D.signal?.aborted) return;
          const next = await update(state => {
            const entry = state.entries.find(e => e.pub === pub);
            if (state.blocked.some(b => b.pub === pub)) return null;
            if (entry && !entry.messages.length) state.entries.splice(state.entries.indexOf(entry), 1);
            return entry?.messages[0]?.msg;
          });
          if (!next) return;
          const contact = await D.get('contacts', pub.slice(0, 12));
          if (!contact || contact.pubB64 !== pub || contact.blocked) return;
          replaying.add(next);
          try { await D.receive(next); } finally { replaying.delete(next); }
          if (D.signal?.aborted) return;
          await update(state => {
            const entry = state.entries.find(e => e.pub === pub);
            if (entry?.messages[0]?.msg.ts === next.ts && entry.messages[0].msg.payload === next.payload) entry.messages.shift();
          });
        }
      });
    } finally { draining.delete(pub); }
  }
  async function act(pub, action) {
    if (D.signal?.aborted) return;
    if (action === 'accept') {
      await D.lock(async () => {
        const existing = await D.get('contacts', pub.slice(0, 12));
        if (existing && (existing.pubB64 !== pub || existing.blocked)) throw new Error('request contact conflict');
        await update((state, contacts) => {
          const entry = state.entries.find(e => e.pub === pub);
          if (!entry || state.blocked.some(b => b.pub === pub)) throw new Error('request unavailable');
          if (!existing) contacts.add({ id: pub.slice(0, 12), pubB64: pub, name: entry.name || D.t('unknown'), addedAt: now(), unread: 0 });
        });
      });
      await drain(pub);
      D.render();
    } else {
      await D.lock(() => update(state => {
        if (action === 'block' && !state.blocked.some(b => b.pub === pub)) {
          if (state.blocked.length >= REQUEST_LIMITS.blocked) throw new Error('request block limit');
          state.blocked.push({ pub, at: now() });
        }
        if (action === 'unblock') state.blocked = state.blocked.filter(b => b.pub !== pub);
        state.entries = state.entries.filter(e => e.pub !== pub);
      }));
    }
    await refresh();
  }
  async function refresh() {
    const state = await update(state => structuredClone(state));
    const contacts = await D.all('contacts');
    const pending = state.entries.filter(e => !contacts.some(c => c.pubB64 === e.pub && !c.blocked));
    const button = D.dom('b-msg-requests');
    if (button) button.textContent = D.t('mrTitle') + (pending.length ? ' (' + pending.length + ')' : '');
    if (dialog?.open) {
      const list = dialog.querySelector('.request-list');
      D.html(list, (pending.length ? pending.map(e => '<div class="request-card"><b>' + D.esc(e.name || D.t('unknown')) + '</b><div class="i-tiny-meta">' + D.esc(e.pub.slice(0, 12)) + ' · ' + D.esc(D.t('mrCount', e.messages.length)) + '</div><p>' + D.esc(new Date(e.at).toLocaleString()) + (e.full ? ' · ' + D.esc(D.t('mrFull')) : '') + '</p>' + ['accept', 'block', 'delete'].map(a => '<button class="btn btn-o btn-sm" data-pub="' + D.esc(e.pub) + '" data-request-action="' + a + '">' + D.esc(D.t({ accept: 'mrAccept', block: 'mrBlock', delete: 'mrDelete' }[a])) + '</button>').join(' ') + '</div>').join('') : '<p>' + D.esc(D.t('mrEmpty')) + '</p>') + state.blocked.map(b => '<div class="request-card">' + D.esc(b.pub.slice(0, 12)) + ' <button class="btn btn-o btn-sm" data-pub="' + D.esc(b.pub) + '" data-request-action="unblock">' + D.esc(D.t('mrUnblock')) + '</button></div>').join(''));
      list.querySelectorAll('[data-request-action]').forEach(button => { button.onclick = async () => {
        button.disabled = true;
        try { await act(button.dataset.pub, button.dataset.requestAction); } catch(e) { error(e); button.disabled = false; }
      }; });
    }
    for (const entry of state.entries) if (contacts.some(c => c.pubB64 === entry.pub && !c.blocked)) drain(entry.pub).catch(error);
  }
  async function open() {
    if (dialog?.open) return;
    const [dlg, titleId] = D.makeDialog();
    dialog = dlg;
    D.html(dialog, '<div class="modal-title" id="' + D.esc(titleId) + '">' + D.esc(D.t('mrTitle')) + '</div><p>' + D.esc(D.t('mrIntro')) + '</p><p class="i-tiny-meta">' + D.esc(D.t('mrPolicy')) + '</p><div class="request-list"></div><div class="modal-actions"><button class="btn btn-o" value="cancel">' + D.esc(D.t('close')) + '</button></div>');
    D.showDialog(dialog); D.dismiss(dialog, () => { if (dialog === dlg) dialog = null; if (dlg.open) dlg.close(); dlg.remove(); });
    await refresh();
  }
  D.dom('b-msg-requests')?.addEventListener('click', () => open().catch(error), { signal: D.signal });
  D.signal?.addEventListener('abort', () => { dialog?.close(); dialog?.remove(); dialog = null; }, { once: true });
  return { admit, member, act, refresh, open, drain };
}

export function installNotificationActions(D) {
  D.serviceWorker?.addEventListener('message', e => {
    if (D.blocked?.()) return;
    if (e.data?.type === 'sync-outbox') D.flush();
    if (e.data?.type === 'quick-reply' && e.data.contactId && typeof e.data.text === 'string' && e.data.text.trim()) {
      D.get('contacts', e.data.contactId).then(async contact => {
        if (!contact || contact.blocked) return;
        await D.open(contact);
        D.dom('msg-input').value = e.data.text;
        D.send();
      }).catch(e => D.dbg(e, 'quick-reply'));
    }
    if (e.data?.type === 'mark-read' && e.data.contactId) {
      D.get('contacts', e.data.contactId).then(async contact => {
        if (!contact || contact.blocked) return;
        contact.unread = 0;
        await D.put('contacts', contact);
        D.render();
      }).catch(e => D.dbg(e, 'mark-read'));
    }
  }, { signal: D.signal });
}
