import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync('index.html', 'utf8');

function extract(re, name) {
  const m = html.match(re);
  if (!m) throw new Error('marker not found: ' + name);
  return m[0];
}

// The pending-queue helpers (map + _groupKeyPending + _pendGroupMsg + _drainGroupPending).
const helpersBlock = () => extract(/  const _groupPending = new Map\(\);[\s\S]*?_dbg\(err, 'group-pending-drain'\); \}\n    \}\n  \}/, 'pending helpers');

function makeHelpers({ store = {}, MS_HOUR = 3600000 } = {}) {
  const calls = { incoming: [] };
  const env = {
    dbGet: async (s, k) => store[`${s}:${k}`] ?? null,
    MS: { HOUR: MS_HOUR },
    _dbg: () => {},
    handleIncoming: async (m) => { calls.incoming.push(m); },
  };
  const fn = new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; ' + helpersBlock() + ' return { _groupKeyPending, _pendGroupMsg, _drainGroupPending, _groupPending };');
  return { h: fn(env), calls, store };
}

const GID = 'g_tok', SID = 'peer87654321', PUB = 'peer87654321pub';
const v5msg = (ep) => JSON.stringify({ g: true, v: 5, ep, c: 3, i: [1], d: [2] });

describe('_groupKeyPending — is the failure a "key in flight" case?', () => {
  it('pends when no peer sender key exists at all', async () => {
    const { h } = makeHelpers();
    expect(await h._groupKeyPending(GID, SID, v5msg(1))).toBe(true);
  });

  it('pends when the payload epoch is AHEAD of the stored key (rotation in flight)', async () => {
    const { h } = makeHelpers({ store: { [`identity:gsk-peer:${GID}:${SID}`]: { v: 5, epoch: 2, chainKey: [1] } } });
    expect(await h._groupKeyPending(GID, SID, v5msg(3))).toBe(true);
  });

  it('does NOT pend for same or older epoch (forgery/stale — no key will fix it)', async () => {
    const { h } = makeHelpers({ store: { [`identity:gsk-peer:${GID}:${SID}`]: { v: 5, epoch: 2, chainKey: [1] } } });
    expect(await h._groupKeyPending(GID, SID, v5msg(2))).toBe(false);
    expect(await h._groupKeyPending(GID, SID, v5msg(1))).toBe(false);
  });

  it('pends a v5 payload when only a v3 (raw) key is stored — an upgraded key can still land', async () => {
    const { h } = makeHelpers({ store: { [`identity:gsk-peer:${GID}:${SID}`]: { raw: 'k', epoch: 1 } } });
    expect(await h._groupKeyPending(GID, SID, v5msg(1))).toBe(true);
  });

  it('does NOT pend v3 payloads (static key already present or message malformed)', async () => {
    const { h } = makeHelpers({ store: { [`identity:gsk-peer:${GID}:${SID}`]: { raw: 'k', epoch: 0 } } });
    expect(await h._groupKeyPending(GID, SID, JSON.stringify({ g: true, v: 3, c: 1, i: [1], d: [2] }))).toBe(false);
  });
});

describe('_pendGroupMsg / _drainGroupPending', () => {
  const msg = (from, ts) => ({ from, fromPub: PUB, fromName: 'P', ts, isGroupSK: true, payload: v5msg(1) });

  it('stores under groupId:senderId and dedups by msgId', () => {
    const { h } = makeHelpers();
    const m = msg('peer87654321', 100);
    h._pendGroupMsg(m, GID, SID);
    h._pendGroupMsg(m, GID, SID); // same msgId — no double entry
    h._pendGroupMsg(msg('peer87654321', 200), GID, SID);
    expect(h._groupPending.get(GID + ':' + SID).length).toBe(2);
  });

  it('drain re-dispatches every stashed message through handleIncoming and clears the key', async () => {
    const { h, calls } = makeHelpers();
    h._pendGroupMsg(msg('peer87654321', 100), GID, SID);
    h._pendGroupMsg(msg('peer87654321', 200), GID, SID);
    await h._drainGroupPending(GID, SID);
    expect(calls.incoming.length).toBe(2);
    expect(calls.incoming[0].ts).toBe(100);
    expect(h._groupPending.has(GID + ':' + SID)).toBe(false);
  });

  it('drain skips entries older than 2h (relay TTL window)', async () => {
    const { h, calls } = makeHelpers();
    const k = GID + ':' + SID;
    h._groupPending.set(k, [
      { msg: msg('peer87654321', 111), ts: Date.now() - 3 * 3600000 },
      { msg: msg('peer87654321', 222), ts: Date.now() },
    ]);
    await h._drainGroupPending(GID, SID);
    expect(calls.incoming.length).toBe(1);
    expect(calls.incoming[0].ts).toBe(222);
  });

  it('caps the per-sender backlog at 40 (a key that never arrives cannot grow memory)', () => {
    const { h } = makeHelpers();
    for (let i = 0; i < 60; i++) h._pendGroupMsg(msg('peer87654321', i), GID, SID);
    expect(h._groupPending.get(GID + ':' + SID).length).toBe(40);
  });
});

describe('wiring — the shipped call sites', () => {
  it('isSenderKey handler drains the pending queue after storing new key material', () => {
    const handler = extract(/  if \(msg\.isSenderKey\) \{[\s\S]*?_dbg\(e, 'sender-key'\); \}\n      return;\n    \}/, 'isSenderKey handler');
    const dbPutIdx = handler.indexOf("dbPut('identity', skEntry, peerKey)");
    const drainIdx = handler.indexOf('_drainGroupPending(skMsg.groupId');
    expect(dbPutIdx).toBeGreaterThan(-1);
    expect(drainIdx).toBeGreaterThan(dbPutIdx); // drain AFTER the key lands
  });

  it('the group-message drop point pends ONLY for isGroupSK + key-in-flight (forgery never pends)', () => {
    const tail = extract(/      let text;\n      \/\/ v3\.1: Try Sender Key[\s\S]*?        return;\n      \}/, 'group decrypt tail');
    expect(tail).toContain('_groupKeyPending(msg.groupId');
    expect(tail).toContain('_pendGroupMsg(msg, msg.groupId');
    expect(tail).toContain('msg.isGroupSK && await _groupKeyPending');
  });

  it('end-to-end: a message whose key is missing pends instead of dropping', async () => {
    const tail = extract(/      let text;\n      \/\/ v3\.1: Try Sender Key[\s\S]*?        return;\n      \}/, 'group decrypt tail');
    const pended = [];
    const env = {
      msg: { isGroupSK: true, groupId: GID, from: 'peer87654321', fromPub: PUB, fromName: 'P', ts: 42, payload: v5msg(1) },
      member: { id: 'peer87654321', pubB64: PUB },
      myId: 'me0000000000',
      decryptGroupMsg: async () => null,      // no key — decrypt fails
      decryptFrom: async () => null,           // legacy path can't help either
      _groupKeyPending: async () => true,      // key is still in flight
      _pendGroupMsg: (m, g, s) => pended.push([g, s, m.ts]),
    };
    const run = new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; return (async () => { ' + tail + ' })();');
    await run(env);
    expect(pended.length).toBe(1);
    expect(pended[0][0]).toBe(GID);
    expect(pended[0][1]).toBe('peer87654321');
  });

  it('end-to-end: a forged/failed message with NO key in flight still drops', async () => {
    const tail = extract(/      let text;\n      \/\/ v3\.1: Try Sender Key[\s\S]*?        return;\n      \}/, 'group decrypt tail');
    const pended = [];
    const env = {
      msg: { isGroupSK: true, groupId: GID, from: 'peer87654321', fromPub: PUB, ts: 42, payload: v5msg(1) },
      member: { id: 'peer87654321', pubB64: PUB },
      myId: 'me0000000000',
      decryptGroupMsg: async () => null,
      decryptFrom: async () => null,
      _groupKeyPending: async () => false,     // bad sig / stale epoch — nothing coming
      _pendGroupMsg: (m, g, s) => pended.push([g, s, m.ts]),
    };
    const run = new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; return (async () => { ' + tail + ' })();');
    await run(env);
    expect(pended.length).toBe(0);
  });
});
