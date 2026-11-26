import { createIcon } from './icons.js';

// ============================================================================
// CALL HISTORY — an on-device log of 1:1 calls (src/app/call.js emits the
// lifecycle events; this module turns them into records), plus the Calls
// bottom-tab list that renders them.
//
// Privacy shape, deliberately the audit log's and NOT the backup's:
//   - Records live ONLY in this device's IndexedDB ('calls' store,
//     DB v6). They are never sent to a relay, never sent to the peer,
//     and are NOT part of any backup payload — the backup carries what
//     restores the account and the conversations (identity, contacts,
//     messages, key material); a call log is device-local metadata in
//     the same category as the audit log and settings, which also stay
//     on the device. A new device starts with an empty history.
//   - A record is metadata only: peer id, a name snapshot, direction
//     (out / in / missed), video flag, start time, duration. No audio,
//     no content, nothing about what was said.
//   - Settings → Privacy can turn recording off (callHistoryLog), and
//     the history screen itself carries a clear-all button.
//
// 'missed' means an incoming call that rang and ended before it was
// answered — remote cancel, the 60s ring timeout, or a local decline
// all land here; the app never distinguished them and the log does not
// pretend to. Group calls are not logged: their join/leave lifecycle
// is a room, not a call, and lives in group-call.js.
//
// The call manager reports events through D.onCallEvent (wired in
// index.html): { kind:'start', dir, contactId, name, video, ts },
// { kind:'connected', ts }, { kind:'end', ts }. An 'end' with no live
// session (e.g. the mic was denied before the offer ever went out) is
// ignored — a call that never rang is not history.
// ============================================================================

export const CALL_HISTORY_MAX = 200; // newest records kept; older ones are pruned on write

const DIRS = ['out', 'in', 'missed'];
const MAX_DURATION_SEC = 86400; // 24h — a duration past this is corrupt, not a long call

export function sanitizeCallRecord(r) {
  if (!r || typeof r !== 'object') return null;
  if (typeof r.contactId !== 'string' || !r.contactId) return null;
  if (!DIRS.includes(r.dir)) return null;
  const ts = Number.isFinite(r.ts) ? Math.floor(r.ts) : 0;
  if (ts <= 0) return null;
  const durationSec = Number.isFinite(r.durationSec) ? Math.min(Math.max(0, Math.floor(r.durationSec)), MAX_DURATION_SEC) : 0;
  const rec = {
    contactId: r.contactId.slice(0, 128),
    name: typeof r.name === 'string' ? r.name.slice(0, 64) : '',
    dir: r.dir, video: !!r.video, ts, durationSec,
    seen: !!r.seen,
  };
  if (Number.isFinite(r.id)) rec.id = r.id;
  return rec;
}

// Build the stored record for a finished session. `session` is the
// pending state from the 'start' event (dir 'out' | 'in', plus the
// connectedAt stamp if 'connected' ever fired).
export function finalizeCallRecord(session, endTs) {
  if (!session || typeof session.contactId !== 'string' || !session.contactId) return null;
  const connectedAt = session.connectedAt || 0;
  const dir = session.dir === 'in' ? (connectedAt ? 'in' : 'missed') : 'out';
  return sanitizeCallRecord({
    contactId: session.contactId,
    name: session.name || '',
    dir, video: !!session.video,
    ts: session.startTs,
    durationSec: connectedAt ? Math.floor(((endTs || connectedAt) - connectedAt) / 1000) : 0,
    seen: dir !== 'missed', // only missed calls can be "unseen" (they drive the tab badge)
  });
}

export function missedUnseenCount(records) {
  return (records || []).reduce((n, r) => n + (r && r.dir === 'missed' && !r.seen ? 1 : 0), 0);
}

export function formatCallDuration(sec) {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return (h > 0 ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(ss).padStart(2, '0');
}


export function createCallHistory(D) {
  const { dbPut, dbGetAll, dbDel } = D;
  let _session = null;

  async function _all() {
    const rows = await dbGetAll('calls').catch(() => []);
    return (rows || []).map(sanitizeCallRecord).filter(Boolean).sort((a, b) => b.ts - a.ts);
  }

  async function refreshBadge() {
    try {
      const n = missedUnseenCount(await _all());
      const b = _DOM.get('tab-badge-calls');
      if (b) b.textContent = n > 0 ? n : '';
    } catch(e) { _dbg(e, 'call-hist-badge'); }
  }

  async function _prune() {
    const rows = await _all();
    for (const extra of rows.slice(CALL_HISTORY_MAX)) {
      if (extra.id != null) await dbDel('calls', extra.id).catch(() => {});
    }
  }

  async function onCallEvent(e) {
    try {
      if (!e || typeof e !== 'object') return;
      if (e.kind === 'start') {
        _session = {
          contactId: e.contactId, name: typeof e.name === 'string' ? e.name : '',
          dir: e.dir === 'in' ? 'in' : 'out', video: !!e.video,
          startTs: e.ts || Date.now(), connectedAt: 0,
        };
        return;
      }
      if (e.kind === 'connected') { if (_session) _session.connectedAt = e.ts || Date.now(); return; }
      if (e.kind === 'end') {
        const s = _session; _session = null;
        if (!s) return; // never rang (mic denied, encrypt failure) — not history
        const rec = finalizeCallRecord(s, e.ts || Date.now());
        if (!rec) return;
        if (D.loggingEnabled && !D.loggingEnabled()) return; // Settings → Privacy: recording off
        await dbPut('calls', rec);
        await _prune();
        await refreshBadge();
        if (D.isCallsView && D.isCallsView()) await render();
      }
    } catch(err) { _dbg(err, 'call-hist-event'); }
  }

  async function clearAll() {
    try {
      if (!await showConfirm(t('callHistoryClearConfirm'), { danger: true, okText: t('callHistoryClear') })) return;
      for (const r of await _all()) if (r.id != null) await dbDel('calls', r.id);
      await refreshBadge();
      await render();
      showToast(t('callHistoryCleared'), 'success');
    } catch(e) { _dbg(e, 'call-hist-clear'); }
  }

  // Render the history into the sidebar list (#msg-contacts), the same
  // surface renderContacts owns in the other two list modes. Viewing
  // the list marks missed calls seen, which clears the tab badge.
  async function render() {
    try {
      const el = _DOM.get('msg-contacts');
      if (!el) return;
      const [records, contacts] = await Promise.all([_all(), dbGetAll('contacts').catch(() => [])]);
      const byId = new Map((contacts || []).map(c => [c.id, c]));
      const frag = document.createDocumentFragment();
      // The self card lives inside the list; keep it on top, exactly
      // as renderContacts does, so replaceChildren never drops it.
      const selfCard = _DOM.get('msg-self-card');
      if (selfCard) frag.appendChild(selfCard);
      if (records.length) {
        const bar = document.createElement('div');
        bar.className = 'call-history-bar';
        const clear = document.createElement('button');
        clear.className = 'btn btn-o btn-sm';
        clear.textContent = t('callHistoryClear');
        clear.onclick = () => { clearAll(); };
        bar.appendChild(clear);
        frag.appendChild(bar);
      } else {
        const empty = document.createElement('div');
        empty.className = 'call-history-empty';
        empty.textContent = t('callHistoryEmpty');
        frag.appendChild(empty);
      }
      for (const r of records) {
        const c = byId.get(r.contactId);
        const name = (c && D.contactDisplayName ? D.contactDisplayName(c) : '') || r.name || '';
        const div = document.createElement('div');
        div.className = 'contact' + (r.dir === 'missed' && !r.seen ? ' unread' : '');
        div.setAttribute('role', 'listitem');
        const avatarBg = `hsl(${(name || '').charCodeAt(0) * 37 % 360}, 40%, 30%)`;
        const dirLabel = r.dir === 'out' ? t('callOutgoing') : r.dir === 'in' ? t('callIncoming') : t('callMissed');
        const dirHtml = r.dir === 'missed' ? `<span class="color-r">${esc(dirLabel)}</span>` : esc(dirLabel);
        const preview = dirHtml + (r.video ? ' · ' + esc(t('callVideoLabel')) : '') + (r.durationSec > 0 ? ' · ' + formatCallDuration(r.durationSec) : '');
        const time = D.listTime ? D.listTime(r.ts) : '';
        safeSetHTML(div, `<div class="avatar" style="background:${avatarBg}">${esc((name || '?')[0].toUpperCase())}</div><div class="info"><div class="name">${esc(name)}</div><div class="preview">${preview}</div></div><div class="meta">${time ? `<div class="time">${esc(time)}</div>` : ''}</div>`);
        if (c) {
          const cb = document.createElement('button');
          cb.className = 'btn btn-o btn-sm call-back-btn';
          cb.setAttribute('aria-label', t('ariaCall'));
          cb.replaceChildren(createIcon('phone'));
          cb.onclick = (ev) => { ev.stopPropagation(); D.startCall(c, r.video); };
          div.appendChild(cb);
          div.onclick = () => D.openConversation(c);
        }
        frag.appendChild(div);
      }
      el.replaceChildren(frag);
      let marked = false;
      for (const r of records) {
        if (r.dir === 'missed' && !r.seen && r.id != null) { r.seen = true; marked = true; await dbPut('calls', r); }
      }
      if (marked) await refreshBadge();
    } catch(e) { _dbg(e, 'call-hist-render'); }
  }

  async function init() { await refreshBadge(); }

  return { onCallEvent, render, refreshBadge, clearAll, init };
}
