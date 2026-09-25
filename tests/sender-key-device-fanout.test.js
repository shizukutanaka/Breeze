import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync('index.html', 'utf8');

function extract(re) {
  const m = html.match(re);
  if (!m) throw new Error('marker not found: ' + re);
  return m[0];
}

const MPUB = 'memberpub000' + 'M'.repeat(78);
const DEV2 = 'memberdev2000' + 'D'.repeat(76);
const MID = MPUB.slice(0, 12);
const GID = 'g_tok';

// Run the shipped distributeSenderKey once against a stub env.
function makeDist({ contact = { id: MID, pubB64: MPUB }, devices = [MPUB], sk = { v: 5, chainKey: [1, 2, 3], epoch: 1 }, encFailFor = [] } = {}) {
  const sent = [];
  const store = { [`contacts:${MID}`]: contact };
  const env = {
    CONFIG: { GROUP_RATCHET_V5: true },
    myId: 'myid00000000', myPubB64: 'myid00000000' + 'A'.repeat(76), myName: 'Me',
    _signingPubB64: 'sigpub',
    getGroupSenderKey: async () => sk,
    encryptFor: async (text, pub) => encFailFor.includes(pub) ? null : `enc:${pub}`,
    relaySend: async (to, payload, sealPub) => { sent.push({ to, isSenderKey: payload.isSenderKey, from: payload.from, sealPub, enc: payload.payload }); },
    dbGet: async (s, k) => store[`${s}:${k}`],
    _devicesFor: async (c) => devices,
    _dbg: () => {},
  };
  const block = extract(/  async function distributeSenderKey\(groupId, memberPubB64\) \{[\s\S]*?_dbg\(_e, 'distributeSenderKey'\); \}\n  \}/);
  const runner = new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; ' + block + ' return distributeSenderKey;');
  return { run: () => runner(env)(GID, MPUB), sent };
}

describe('distributeSenderKey — per-device mailbox fan-out', () => {
  it('sends to the member root mailbox for a single-device member', async () => {
    const { run, sent } = makeDist({ devices: [MPUB] });
    await run();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe(MPUB.slice(0, 12));
    expect(sent[0].isSenderKey).toBe(true);
  });

  it('sends a copy to EVERY device mailbox of a multi-device member', async () => {
    const { run, sent } = makeDist({ devices: [MPUB, DEV2] });
    await run();
    expect(sent.length).toBe(2);
    expect(sent.map(s => s.to).sort()).toEqual([DEV2.slice(0, 12), MPUB.slice(0, 12)].sort());
    // Each device gets a ciphertext encrypted to ITS OWN pub — not a shared root copy.
    expect(sent.find(s => s.to === MPUB.slice(0, 12)).enc).toBe('enc:' + MPUB);
    expect(sent.find(s => s.to === DEV2.slice(0, 12)).enc).toBe('enc:' + DEV2);
    // And each copy is sealed for that device's pub.
    expect(sent.find(s => s.to === DEV2.slice(0, 12)).sealPub).toBe(DEV2);
  });

  it('falls back to the root mailbox when the member contact is missing', async () => {
    const { run, sent } = makeDist({ contact: null, devices: [MPUB] });
    await run();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe(MPUB.slice(0, 12));
  });

  it('falls back to the root mailbox when the device list is empty', async () => {
    const { run, sent } = makeDist({ devices: [] });
    await run();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe(MPUB.slice(0, 12));
  });

  it('still reaches a device when encryption fails for another', async () => {
    const { run, sent } = makeDist({ devices: [MPUB, DEV2], encFailFor: [MPUB] });
    await run();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe(DEV2.slice(0, 12));
  });

  it('v3 groups distribute the raw key, not chainKey', async () => {
    const { run, sent } = makeDist({ devices: [MPUB], sk: { raw: 'rawkey', epoch: 2 } });
    // encryptFor records what plaintext it received via the enc stub — assert via a capture.
    const env = [];
    const captured = [];
    const store = { [`contacts:${MID}`]: { id: MID, pubB64: MPUB } };
    const env2 = {
      CONFIG: { GROUP_RATCHET_V5: true }, myId: 'myid00000000', myPubB64: 'P', myName: 'Me', _signingPubB64: 'sig',
      getGroupSenderKey: async () => ({ raw: 'rawkey', epoch: 2 }),
      encryptFor: async (text, pub) => { captured.push(JSON.parse(text)); return 'e'; },
      relaySend: async () => {}, dbGet: async (s, k) => store[`${s}:${k}`], _devicesFor: async () => [MPUB], _dbg: () => {},
    };
    const block = extract(/  async function distributeSenderKey\(groupId, memberPubB64\) \{[\s\S]*?_dbg\(_e, 'distributeSenderKey'\); \}\n  \}/);
    const dsk = new Function('env', 'const {' + Object.keys(env2).join(',') + '} = env; ' + block + ' return distributeSenderKey;')(env2);
    await dsk(GID, MPUB);
    expect(captured[0].key).toBe('rawkey');
    expect(captured[0].chainKey).toBeUndefined();
    expect(captured[0].v).toBeUndefined();
  });
});
