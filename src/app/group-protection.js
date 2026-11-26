import { safeName } from './lookalike-names.js';

const CAP = 'group-author-sig-v1', utf8 = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
function raw(value, size) {
  if (typeof value !== 'string' || value.length > 128) throw new Error('group protection encoding');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (!(Array.isArray(size) ? size : [size]).includes(bytes.length) || b64(bytes) !== value) throw new Error('group protection encoding');
  return bytes;
}
function roster(members) {
  if (!Array.isArray(members) || !members.length || members.length > 1000) throw new Error('group protection roster');
  const seen = new Set();
  return members.map(m => {
    raw(m.pubB64, [32, 65]);
    if (m.id !== m.pubB64.slice(0, 12) || seen.has(m.pubB64)) throw new Error('group protection member');
    seen.add(m.pubB64);
    return { id: m.id, pubB64: m.pubB64, name: String(m.name || '').slice(0, 64), caps: [...new Set((Array.isArray(m.caps) ? m.caps : []).filter(c => typeof c === 'string' && c.length <= 32))].sort().slice(0, 20) };
  }).sort((a, b) => a.pubB64 < b.pubB64 ? -1 : a.pubB64 > b.pubB64 ? 1 : 0);
}
const same = (a, b) => JSON.stringify(roster(a)) === JSON.stringify(roster(b));
function transcript(kind, value) {
  if (!/^g_[A-Za-z0-9_-]{1,62}$/.test(value.groupId)) throw new Error('group protection id');
  raw(value.admin, [32, 65]); raw(value.ed, 32);
  const fields = kind === 'invite' ? [String(value.name || '').slice(0, 64)] : [value.seq, value.mode];
  if (kind !== 'invite' && (!Number.isSafeInteger(value.seq) || value.seq < 1 || !['strict', 'legacy'].includes(value.mode))) throw new Error('group protection revision');
  const bytes = utf8.encode('BreezeGroupProtection/' + kind + '/v1:' + JSON.stringify([value.groupId, value.admin, value.ed, ...fields, roster(value.members)]));
  if (bytes.length > 60000) throw new Error('group protection bounds');
  return bytes;
}
async function valid(kind, value, pin) {
  if (value.ed !== pin) return false;
  const key = await crypto.subtle.importKey('raw', raw(pin, 32), 'Ed25519', false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, raw(value.sig, 64), transcript(kind, value));
}

export function createGroupProtection(D) {
  const chains = new Map(); let panel = null, painting = 0;
  const slot = gid => 'verify:group-protection:' + gid;
  const read = async gid => await D.get('identity', slot(gid)) || {};
  const write = async (gid, value) => { if (!await D.put('identity', value, slot(gid))) throw new Error('group protection persistence'); };
  const serial = (gid, work) => {
    const run = () => D.lock ? D.lock(gid, work) : work();
    const next = (chains.get(gid) || Promise.resolve()).then(run, run);
    const tail = next.catch(() => {}); chains.set(gid, tail);
    tail.then(() => { if (chains.get(gid) === tail) chains.delete(gid); }); return next;
  };
  async function pin(pub) {
    if (pub === D.pub()) return D.ed();
    const c = await D.get('contacts', pub.slice(0, 12));
    return c?.pubB64 === pub ? c.sigPub : null;
  }
  function event(state, mode) {
    const last = state.events?.at(-1);
    return last?.mode === mode ? state.events : [...(state.events || []), { mode, seq: state.seq || 0 }].slice(-20);
  }
  async function invitation(invite) {
    if (!D.ed()) return invite;
    const proof = { groupId: invite.groupId, name: invite.name, members: roster(invite.members), admin: D.pub(), ed: D.ed() };
    proof.sig = await D.sign(transcript('invite', proof));
    await serial(proof.groupId, async () => {
      const old = await read(proof.groupId);
      if (!old.anchor) await write(proof.groupId, { ...old, anchor: { pub: proof.admin, ed: proof.ed, source: 'invitation' } });
    });
    return { ...invite, protectionInvite: proof };
  }
  async function invited(invite, sender, freshLink = false) {
    const proof = invite.protectionInvite;
    if (!proof) return true;
    if (proof.groupId !== invite.groupId || proof.admin !== sender || proof.name !== invite.name || !same(proof.members, invite.members)) return false;
    if (!await pin(sender)) await D.establishPin?.(sender);
    if (!await valid('invite', proof, await pin(sender))) return false;
    return serial(proof.groupId, async () => {
      const old = await read(proof.groupId), group = await D.get('contacts', proof.groupId);
      if (old.anchor) return old.anchor.pub === sender && old.anchor.ed === proof.ed;
      // A fresh authenticated invitation cannot retroactively appoint an admin to an existing group.
      if (group && !freshLink) return false;
      await write(proof.groupId, { ...old, anchor: { pub: sender, ed: proof.ed, source: 'invitation' } }); return true;
    });
  }
  async function acceptLink(gid, encoded) {
    const invite = JSON.parse(encoded);
    if (invite.groupId !== gid || !invite.protectionInvite || !await invited(invite, invite.protectionInvite.admin, true)) throw new Error('group invitation authentication failed');
  }
  async function anchor(group, contact) {
    return serial(group.id, async () => {
      const fresh = await D.get('contacts', contact.id), status = fresh && await D.verified(fresh);
      if (!fresh || fresh.pubB64 !== contact.pubB64 || !status?.verified || status.changed || !group.members.some(m => m.pubB64 === fresh.pubB64)) throw new Error('group admin must be verified');
      const old = await read(group.id);
      if (old.anchor && (old.anchor.pub !== fresh.pubB64 || old.anchor.ed !== fresh.sigPub)) throw new Error('group admin already anchored');
      if (!await D.confirm(D.t('gpAnchorConfirm', safeName(fresh.name), fresh.id), { danger: true, defaultCancel: true })) return false;
      const latest = await D.get('contacts', fresh.id), checked = latest && await D.verified(latest);
      if (!checked?.verified || checked.changed || latest.pubB64 !== fresh.pubB64 || latest.sigPub !== fresh.sigPub) throw new Error('group admin changed during confirmation');
      await write(group.id, { ...old, anchor: { pub: fresh.pubB64, ed: fresh.sigPub, source: 'verified-contact' } }); return true;
    });
  }
  const localCreator = g => g?.isGroup && g.createdBy === D.pub().slice(0, 12) && g.members?.some(m => m.pubB64 === D.pub());
  async function anchorSelf(gid) {
    return serial(gid, async () => {
      const group = await D.get('contacts', gid), old = await read(gid);
      if (!localCreator(group) || old.anchor || !D.ed()) throw new Error('local group creation required');
      const proof = { groupId: gid, name: group.name, members: group.members, admin: D.pub(), ed: D.ed() };
      proof.sig = await D.sign(transcript('invite', proof));
      if (!await valid('invite', proof, D.ed())) throw new Error('local signing identity unavailable');
      if (!await D.confirm(D.t('gpSelfAdmin'), { desc: D.t('gpSelfConfirm', proof.admin, proof.ed), danger: true, defaultCancel: true })) return false;
      if (!localCreator(await D.get('contacts', gid)) || D.pub() !== proof.admin || D.ed() !== proof.ed) throw new Error('local creator changed during confirmation');
      await write(gid, { ...old, anchor: { pub: proof.admin, ed: proof.ed, source: 'local-creator' } }); return true;
    });
  }
  async function apply(value) {
    const state = await read(value.groupId), group = await D.get('contacts', value.groupId), a = state.anchor;
    if (!group?.isGroup || !a || value.admin !== a.pub || value.ed !== a.ed || await pin(a.pub) !== a.ed || value.seq <= (state.seq || 0)) return false;
    if (!await valid('roster', value, a.ed)) return false;
    const members = roster(value.members);
    if (!members.some(m => m.pubB64 === a.pub) || !members.some(m => m.pubB64 === D.pub())) return false;
    const missing = members.filter(m => !m.caps.includes(CAP)).map(m => m.pubB64);
    if (value.mode === 'strict' && missing.length) return false;
    const ever = (await D.get('identity', 'ga-policy:' + group.id))?.strict === true;
    const mode = value.mode;
    const next = { anchor: a, seq: value.seq, mode, members, missing, events: state.events || [] };
    if (ever && (mode === 'legacy' || state.mode === 'legacy')) next.events = event(next, mode);
    // Commit authorization before the roster: a partial write can only leave strict mode in force.
    await write(group.id, next);
    if (!await D.put('contacts', { ...group, members, groupV5: undefined })) throw new Error('group roster persistence');
    D.sync?.(group.id, members); await paint(); return true;
  }
  async function receive(body) {
    let value; try { value = JSON.parse(body); } catch { return false; }
    if (value?.type !== 'group_protection') return false;
    if (utf8.encode(body).length > 65535) throw new Error('group protection frame bounds');
    await serial(value.groupId, () => apply(value)); return true;
  }
  async function admit(group, candidate, force = false) {
    return serial(group.id, async () => {
      group = await D.get('contacts', group.id);
      const members = roster(candidate), state = await read(group.id);
      if (same(group.members, members)) return true;
      if (!(await D.get('identity', 'ga-policy:' + group.id))?.strict) return true;
      if (!state.anchor || state.anchor.pub !== D.pub() || state.anchor.ed !== D.ed()) {
        await write(group.id, { ...state, pending: members }); await paint(); return false;
      }
      if (state.declined && same(state.declined, members) && !force) return false;
      const legacy = members.filter(m => !m.caps.includes(CAP));
      await write(group.id, { ...state, pending: members }); await paint();
      if (legacy.length && !await D.confirm(D.t('gpDowngradeTitle'), { desc: D.t('gpDowngradeWarning', legacy.map(m => safeName(m.name) || m.id).join(', ')), danger: true, defaultCancel: true, okText: D.t('gpAllow') })) {
        await write(group.id, { ...state, pending: members, declined: members }); return false;
      }
      const latest = await D.get('contacts', group.id);
      if (!same(latest.members, group.members)) throw new Error('group roster changed during confirmation');
      const value = { type: 'group_protection', groupId: group.id, admin: D.pub(), ed: D.ed(), seq: (state.seq || 0) + 1, mode: legacy.length ? 'legacy' : 'strict', members };
      value.sig = await D.sign(transcript('roster', value));
      if (utf8.encode(JSON.stringify(value)).length > 65535) throw new Error('group protection frame bounds');
      if (!await apply(value)) throw new Error('group protection authorization failed');
      await D.broadcast(value, [...new Map([...group.members, ...members].map(m => [m.pubB64, m])).values()]);
      return true;
    });
  }
  async function guard(gid, policy) {
    if (!policy.strict) return null;
    const state = await read(gid), group = await D.get('contacts', gid), a = state.anchor;
    return state.mode === 'legacy' && a && await pin(a.pub) === a.ed && group && same(group.members, state.members) ? false : null;
  }
  async function proof(gid, pub) {
    await serial(gid, async () => {
      const state = await read(gid);
      if (state.mode !== 'legacy' || !state.missing?.includes(pub)) return;
      state.missing = state.missing.filter(p => p !== pub);
      if (!state.missing.length) { state.mode = 'strict'; state.events = event(state, 'strict'); }
      await write(gid, state); await paint();
    });
  }
  async function legacyFormat(gid) {
    if (await guard(gid, { strict: true }) !== false) return false;
    return (await read(gid)).members.some(m => !m.caps.includes('group-v5'));
  }
  async function paint() {
    if (!D.header) return;
    const revision = ++painting, group = D.active();
    if (!group?.isGroup) { panel?.remove(); panel = null; return; }
    const state = await read(group.id);
    if (revision !== painting || D.active()?.id !== group.id) return;
    panel?.remove(); panel = document.createElement('section'); panel.className = 'group-protection'; panel.setAttribute('data-group-protection', '');
    const text = document.createElement('div');
    text.textContent = D.t(state.anchor ? 'gpAnchored' : 'gpUnanchored', state.anchor?.pub.slice(0, 12) || ''); panel.appendChild(text);
    for (const e of state.events || []) { const line = document.createElement('div'); line.textContent = D.t(e.mode === 'legacy' ? 'gpDropped' : 'gpRestored'); panel.appendChild(line); }
    const button = (label, action) => { const b = document.createElement('button'); b.className = 'btn btn-o btn-sm'; b.textContent = D.t(label); b.onclick = () => action().catch(e => { D.dbg(e, 'group protection'); D.toast(D.t('gpFailed'), 'error'); }); panel.appendChild(b); };
    if (!state.anchor && localCreator(group)) button('gpSelfAdmin', async () => { await anchorSelf(group.id); await paint(); });
    if (!state.anchor) button('gpSetAdmin', async () => {
      const members = group.members.filter(m => m.pubB64 !== D.pub());
      const selected = await D.prompt(D.t('gpChooseAdmin') + '\n' + members.map((m, i) => (i + 1) + '. ' + safeName(m.name) + ' (' + m.id + ')').join('\n'), '');
      if (selected === null) return;
      const member = members[Number(selected) - 1], c = member && await D.get('contacts', member.id);
      if (!c || !(await D.verified(c))?.verified) { D.toast(D.t('gpVerifyFirst'), 'error'); if (c) await D.verify(c); return; }
      await anchor(group, c); await paint();
    });
    if (state.pending && state.anchor?.pub === D.pub()) button('gpReview', async () => { await admit(group, state.pending, true); await paint(); });
    D.header()?.after(panel);
  }
  const clear = () => { ++painting; panel?.remove(); panel = null; };
  return { invitation, invited, acceptLink, anchor, anchorSelf, admit, receive, guard, proof, legacyFormat, paint, clear };
}

export function createGroupProtectionHost(D) {
  return createGroupProtection({ ...D, sign: async bytes => b64(await D.sign(bytes)), broadcast: async (value, members) => {
    for (const m of members) {
      if (m.pubB64 === D.pub()) continue;
      const payload = await D.encrypt(JSON.stringify(value), m.pubB64);
      if (!payload) throw new Error('group protection encryption failed');
      await D.send(m.id, { to: m.id, from: D.pub().slice(0, 12), fromPub: D.pub(), payload, ts: Date.now(), isProfile: true }, m.pubB64);
    }
  } });
}
