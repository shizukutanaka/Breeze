// Regression test (round 135): handleMsgSend rebuilt the stored envelope from a
// destructure allowlist — `isSignal`, `isGroupLeave`, `isGroupMeta` were missing, so the
// /msg/send fallback silently STRIPPED them (the sealed path carries every flag inside
// `se`; only the unsealed fallback rebuilt the object field-by-field):
//   - isSignal stripped → the encrypted signal still decrypts on receive, but the
//     {type:'edit'|'delete'|...} JSON lands in the NORMAL message path: it renders as a
//     literal raw-JSON chat bubble (stored + notification + unread) and the mutation is dead.
//   - isGroupLeave stripped → same leak-as-text AND the leaver stays in every roster —
//     keeps receiving (and decrypting) group traffic indefinitely: the leave notice is
//     what triggers sender-key epoch rotation.
//   - isGroupMeta stripped → announceOnly policy silently never propagates.
// Only reachable when /sealed/send fails and /msg/send succeeds — but the send path tries
// the sealed endpoint first for EVERY peer, so any transient sealed failure hits this.
import { describe, it, expect } from 'vitest';
import { handleMsgSend } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const ip = '203.0.113.7';
const req = () => apiRequest('/api/msg/send', {});
// The worker dedups on `to:payload` per isolate — give every send a unique payload
// or a second identical body returns {ok,dedup} without storing.
let n = 0;
const uniquePayload = () => 'CT-' + (n++);

async function inboxFor(env, to) {
  const raw = await env.KV.get('inbox:' + to);
  return raw ? JSON.parse(raw) : [];
}

const base = { to: 'bob000000001', from: 'alice0000001', fromPub: 'PUB', fromName: 'A', ts: Date.now() };

describe('/msg/send preserves envelope type flags', () => {
  it('isSignal survives — mutations must not land as raw-JSON chat messages', async () => {
    const env = makeEnv();
    const resp = await handleMsgSend({ ...base, payload: uniquePayload(), isSignal: true }, ip, env, req());
    expect(resp.status).toBe(200);
    const inbox = await inboxFor(env, base.to);
    expect(inbox.length).toBe(1);
    expect(inbox[0].isSignal).toBe(true);
  });

  it('isGroupLeave survives — a departed member must not stay in the roster', async () => {
    const env = makeEnv();
    const resp = await handleMsgSend({ ...base, payload: uniquePayload(), isGroupLeave: true }, ip, env, req());
    expect(resp.status).toBe(200);
    const inbox = await inboxFor(env, base.to);
    expect(inbox[0].isGroupLeave).toBe(true);
  });

  it('isGroupMeta survives — group policy notices must reach members', async () => {
    const env = makeEnv();
    const resp = await handleMsgSend({ ...base, payload: uniquePayload(), isGroupMeta: true }, ip, env, req());
    expect(resp.status).toBe(200);
    const inbox = await inboxFor(env, base.to);
    expect(inbox[0].isGroupMeta).toBe(true);
  });

  it('already-forwarded flags still pass (isGroupSK/isGroupKick/isSenderKey/isGroupInvite/isCall/isFile)', async () => {
    for (const flag of ['isGroupSK', 'isGroupKick', 'isSenderKey', 'isGroupInvite', 'isCall', 'isFile']) {
      const env = makeEnv();
      const resp = await handleMsgSend({ ...base, payload: uniquePayload(), [flag]: true }, ip, env, req());
      expect(resp.status).toBe(200);
      const inbox = await inboxFor(env, base.to);
      expect(inbox[0][flag]).toBe(true);
    }
  });

  it('flagless messages get no phantom flags', async () => {
    const env = makeEnv();
    await handleMsgSend({ ...base, payload: uniquePayload() }, ip, env, req());
    const inbox = await inboxFor(env, base.to);
    expect(inbox[0].isSignal).toBeUndefined();
    expect(inbox[0].isGroupLeave).toBeUndefined();
    expect(inbox[0].isGroupMeta).toBeUndefined();
  });

  it('companion metadata still rides along (groupId + selfSync + acctRoot + nrn + disappearAt + sig)', async () => {
    const env = makeEnv();
    const body = {
      ...base, payload: uniquePayload(), isSignal: true, groupId: 'grp-1', acctRoot: 'ROOTPUB', nrn: true,
      selfSync: true, sfFor: 'conv-1', sfPub: 'SFPUB', sfName: 'me',
      disappearAt: Date.now() + 1000, sig: 'SIG', sigPub: 'SIGPUB',
    };
    await handleMsgSend(body, ip, env, req());
    const m = (await inboxFor(env, base.to))[0];
    expect(m.isSignal).toBe(true);
    expect(m.groupId).toBe('grp-1');
    expect(m.selfSync).toBe(true);
    expect(m.sfFor).toBe('conv-1');
    expect(m.acctRoot).toBe('ROOTPUB');
    expect(m.nrn).toBe(true);
    expect(m.disappearAt).toBe(body.disappearAt);
    expect(m.sig).toBe('SIG');
    expect(m.sigPub).toBe('SIGPUB');
  });
});
