import { describe, it, expect } from 'vitest';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { handleGroupCreate, handleGroupJoin, handlePreKeyUpload } from '../_worker.js';

const toB64 = (bytes) => Buffer.from(bytes).toString('base64');
const req = (path, body) => apiRequest(path, body);

async function sha256Short(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeUser(env, id) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edIdentityKey = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
  const pub = `${id}PubKeyMaterial`;
  const up = await handlePreKeyUpload({
    userId: id,
    identityKey: pub,
    edIdentityKey,
    signedPreKey: 'SPKtest',
    oneTimePreKeys: ['o0'],
  }, env, req('/api/prekey/upload', {}));
  expect(up.status).toBe(200);
  return { id, pub, ed, edIdentityKey };
}

async function signJoin(user, token, { memberPub, memberName = '', caps = [] }, ts = Date.now()) {
  const bind = await sha256Short(JSON.stringify([memberPub, memberName, caps]));
  const challenge = `breeze-group-join:${token}:${user.id}:${ts}:${bind}`;
  const sig = toB64(new Uint8Array(await crypto.subtle.sign(
    { name: 'Ed25519' },
    user.ed.privateKey,
    new TextEncoder().encode(challenge),
  )));
  return { ts, sig };
}

describe('handleGroupJoin Ed25519 authentication (checkGroupAuth parity)', () => {
  it('rejects unsigned join and impersonated cap-downgrade when GROUP_REQUIRE_AUTH=true', async () => {
    const env = makeEnv({ GROUP_REQUIRE_AUTH: 'true' });
    const alice = await makeUser(env, 'alice0000001');
    const bob = await makeUser(env, 'bob000000001');

    // Create group as alice (signed)
    const cTs = Date.now();
    const cBind = await sha256Short(JSON.stringify([alice.pub, 'Team', 'Alice', ['group-v5']]));
    const cSig = toB64(new Uint8Array(await crypto.subtle.sign(
      { name: 'Ed25519' },
      alice.ed.privateKey,
      new TextEncoder().encode(`breeze-group-create::${alice.id}:${cTs}:${cBind}`),
    )));
    const created = await handleGroupCreate({
      name: 'Team',
      creatorId: alice.id,
      creatorPub: alice.pub,
      creatorName: 'Alice',
      caps: ['group-v5'],
      ts: cTs,
      sig: cSig,
    }, env, req('/api/group/create', {}));
    expect(created.status).toBe(201);
    const { token } = await created.json();

    // Unsigned join is rejected under GROUP_REQUIRE_AUTH=true
    const unsigned = await handleGroupJoin({
      token, memberId: bob.id, memberPub: bob.pub, memberName: 'Bob', caps: ['group-v5'],
    }, env, req('/api/group/join', {}));
    expect(unsigned.status).toBe(403);
    expect((await unsigned.json()).code).toBe('AUTH_REQUIRED');

    // Properly signed join succeeds
    const bobAuth = await signJoin(bob, token, { memberPub: bob.pub, memberName: 'Bob', caps: ['group-v5'] });
    const joined = await handleGroupJoin({
      token, memberId: bob.id, memberPub: bob.pub, memberName: 'Bob', caps: ['group-v5'], ...bobAuth,
    }, env, req('/api/group/join', {}));
    expect(joined.status).toBe(200);

    // Malicious peer tries to impersonate Alice to strip group-v5 caps (downgrade attack)
    const downgrade = await handleGroupJoin({
      token, memberId: alice.id, memberPub: alice.pub, memberName: 'Alice', caps: [],
    }, env, req('/api/group/join', {}));
    expect(downgrade.status).toBe(403);
    expect((await downgrade.json()).code).toBe('AUTH_REQUIRED');
  });

  it('rejects tampered caps/name/pub or wrong-key signature even when GROUP_REQUIRE_AUTH is unset', async () => {
    const env = makeEnv();
    const alice = await makeUser(env, 'alice0000002');
    const mallory = await makeUser(env, 'mallory00002');

    const created = await handleGroupCreate({
      name: 'Room',
      creatorId: alice.id,
      creatorPub: alice.pub,
      creatorName: 'Alice',
      caps: ['group-v5'],
    }, env, req('/api/group/create', {}));
    const { token } = await created.json();

    // Mallory signs a join claiming to be Alice
    const forgedAuth = await signJoin(
      { ...alice, ed: mallory.ed },
      token,
      { memberPub: alice.pub, memberName: 'Pwned', caps: [] },
    );
    const forged = await handleGroupJoin({
      token, memberId: alice.id, memberPub: alice.pub, memberName: 'Pwned', caps: [], ...forgedAuth,
    }, env, req('/api/group/join', {}));
    expect(forged.status).toBe(403);
    expect((await forged.json()).code).toBe('SIG_INVALID');

    // Alice signs with caps=['group-v5'], MITM strips caps to [] in flight → SIG_INVALID
    const validAuth = await signJoin(alice, token, { memberPub: alice.pub, memberName: 'Alice', caps: ['group-v5'] });
    const tampered = await handleGroupJoin({
      token, memberId: alice.id, memberPub: alice.pub, memberName: 'Alice', caps: [], ...validAuth,
    }, env, req('/api/group/join', {}));
    expect(tampered.status).toBe(403);
    expect((await tampered.json()).code).toBe('SIG_INVALID');

    // Untampered signed rejoin succeeds
    const ok = await handleGroupJoin({
      token, memberId: alice.id, memberPub: alice.pub, memberName: 'Alice', caps: ['group-v5'], ...validAuth,
    }, env, req('/api/group/join', {}));
    expect(ok.status).toBe(200);
  });
});
