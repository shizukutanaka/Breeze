import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { canonical, createEnvelopeCodec, gatherDescription, attachManualPeer, createRendezvous, MAX_CODE_SIZE, MAX_ENVELOPE_SIZE } from '../src/app/rendezvous.js';

const MS = { SEC: 1000, MIN: 60000 };
const desc = { type: 'offer', sdp: 'v=0\r\na=candidate:1 1 udp 1 abc.local 123 typ host\r\n' };
async function identity() {
  const key = await webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pub = Buffer.from(await webcrypto.subtle.exportKey('raw', key.publicKey)).toString('base64');
  return { pub, sign: async text => Buffer.from(await webcrypto.subtle.sign('Ed25519', key.privateKey, Buffer.from(text))).toString('base64') };
}
async function harness() {
  const id = await identity();
  let now = 1000000;
  const verify = async (text, sig, pub) => {
    const key = await webcrypto.subtle.importKey('raw', Buffer.from(pub, 'base64'), 'Ed25519', false, ['verify']);
    return webcrypto.subtle.verify('Ed25519', key, Buffer.from(sig, 'base64'), Buffer.from(text));
  };
  const codec = createEnvelopeCodec({ MS, sign: id.sign, verify, now: () => now, random: b => webcrypto.getRandomValues(b) });
  const make = extra => codec.build({ kind: 'offer', from: 'alice-full-id', to: 'bob-full-id', desc, sigPub: id.pub, ...extra });
  const read = (code, extra) => codec.parse(code, { kind: 'offer', from: 'alice-full-id', to: 'bob-full-id', sigPub: id.pub, ...extra });
  return { id, codec, make, read, advance: ms => { now += ms; } };
}
const pack = e => 'breeze-sdp1:' + Buffer.from(JSON.stringify(e)).toString('base64url');

describe('signed manual SDP envelope', () => {
  it('imports legacy and compressed envelopes with the same canonical signature checks', async () => {
    const h = await harness(), result = await h.make();
    expect(result.code.startsWith('breeze-sdp1z:')).toBe(true);
    expect(await h.read(pack(result.envelope))).toEqual(result.envelope);
    await expect(h.read(result.code)).rejects.toThrow('rvReplay');
    const other = await h.make();
    expect(await h.read(other.code)).toEqual(other.envelope);
    const tampered = { ...other.envelope, nonce: 'abcdefghijklmnopqrstuv', desc: { ...desc, sdp: 'tampered' } };
    const code = 'breeze-sdp1z:' + deflateRawSync(Buffer.from(JSON.stringify(tampered))).toString('base64url');
    await expect(h.read(code)).rejects.toThrow('rvTrust');
  });
  it('rejects decompression bombs and corrupt or truncated compressed data', async () => {
    const h = await harness();
    const bomb = 'breeze-sdp1z:' + deflateRawSync(Buffer.alloc(MAX_ENVELOPE_SIZE + 1, 32)).toString('base64url');
    for (const code of [bomb, 'breeze-sdp1z:abcd', (await h.make()).code.slice(0, -5)]) {
      await expect(h.read(code)).rejects.toThrow('rvInvalid');
    }
  });
  it('round-trips canonical signed offers and bound answers with random 16B nonces', async () => {
    const h = await harness(), offer = await h.make();
    expect(await h.read(offer.code)).toEqual(offer.envelope);
    expect(Buffer.from(offer.envelope.nonce, 'base64url')).toHaveLength(16);
    const answer = await h.make({ kind: 'answer', offerNonce: offer.envelope.nonce, desc: { ...desc, type: 'answer' } });
    expect(await h.read(answer.code, { kind: 'answer', offerNonce: offer.envelope.nonce })).toEqual(answer.envelope);
    expect(answer.envelope.nonce).not.toBe(offer.envelope.nonce);
    expect(offer.envelope.exp).toBe(1000000 + 10 * MS.MIN);
  });
  it('canonicalizes recursively independent of field order and signs all fields except sig', async () => {
    expect(canonical({ z: { b: 2, a: 1 }, a: 0 })).toBe('{"a":0,"z":{"a":1,"b":2}}');
    const h = await harness(), { envelope } = await h.make();
    expect(await h.read(pack(Object.fromEntries(Object.entries(envelope).reverse())))).toEqual(envelope);
    for (const [field, value] of Object.entries({ from: 'other', to: 'other', kind: 'answer', nonce: 'abcdefghijklmnopqrstuv', exp: envelope.exp - 1,
      desc: { ...desc, sdp: desc.sdp + 'tampered' }, sigPub: (await identity()).pub, v: 2, sig: 'bad' })) {
      await expect(h.read(pack({ ...envelope, [field]: value }))).rejects.toThrow();
    }
  });
  it('rejects wrong key pins, wrong recipient and unsigned legacy input', async () => {
    const h = await harness(), { code, envelope } = await h.make();
    await expect(h.read(code, { sigPub: (await identity()).pub })).rejects.toThrow('rvTrust');
    await expect(h.read(code, { to: 'wrong-recipient' })).rejects.toThrow('rvTrust');
    const { sig, ...unsigned } = envelope;
    await expect(h.read(pack(unsigned))).rejects.toThrow('rvInvalid');
    const wrong = await identity();
    await expect(h.read(pack({ ...unsigned, sig: await wrong.sign(canonical(unsigned)) }))).rejects.toThrow('rvTrust');
  });
  it('rejects expired, future-lifetime and replayed nonces, including concurrent imports', async () => {
    const h = await harness(), first = await h.make();
    h.advance(-1);
    await expect(h.read(first.code)).rejects.toThrow('rvExpired');
    h.advance(1);
    const imports = await Promise.allSettled([h.read(first.code), h.read(first.code)]);
    expect(imports.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(h.read(first.code)).rejects.toThrow('rvReplay');
    const second = await h.make(); h.advance(10 * MS.MIN);
    await expect(h.read(second.code)).rejects.toThrow('rvExpired');
  });
  it('requires the current step and pending offer nonce for answers', async () => {
    const h = await harness(), offer = await h.make();
    const answer = await h.make({ kind: 'answer', desc: { ...desc, type: 'answer' }, offerNonce: offer.envelope.nonce });
    await expect(h.read(offer.code, { kind: 'answer' })).rejects.toThrow('rvInvalid');
    await expect(h.read(answer.code, { kind: 'answer', offerNonce: 'abcdefghijklmnopqrstuv' })).rejects.toThrow('rvInvalid');
    await expect(h.read(answer.code, { kind: 'answer' })).rejects.toThrow('rvInvalid');
  });
  it('rejects malformed, empty, oversized and extra-field input without verifier work', async () => {
    const h = await harness();
    for (const input of ['', null, 'breeze-sdp1:!', 'breeze-sdp1:e30', 'x'.repeat(MAX_CODE_SIZE + 1), pack(null), pack({})]) {
      await expect(h.read(input)).rejects.toThrow('rvInvalid');
    }
    const e = (await h.make()).envelope;
    await expect(h.read(pack({ ...e, unsigned: true }))).rejects.toThrow('rvInvalid');
    await expect(h.make({ desc: { type: 'offer', sdp: 'x'.repeat(MAX_CODE_SIZE) } })).rejects.toThrow('rvInvalid');
    const noSigner = createEnvelopeCodec({ MS, sign: async () => null });
    await expect(noSigner.build({ ...e })).rejects.toThrow('rvTrust');
  });
});

function fakePC(state = 'complete', sdp = desc.sdp) {
  return Object.assign(new EventTarget(), { iceGatheringState: state, localDescription: { ...desc, sdp },
    setLocalDescription: vi.fn(async () => {}), setRemoteDescription: vi.fn(async () => {}), restartIce: vi.fn() });
}
describe('manual peer and gathered ICE privacy', () => {
  it('waits for complete gathering and exports the current full description, not the initial snapshot', async () => {
    const pc = fakePC('gathering');
    const p = gatherDescription(pc, { MS });
    pc.localDescription = { ...desc, sdp: desc.sdp + 'a=end-of-candidates\r\n' };
    pc.iceGatheringState = 'complete'; pc.dispatchEvent(new Event('icegatheringstatechange'));
    expect(await p).toEqual(pc.localDescription);
  });
  it('strips raw host candidates and relayOnly srflx/prflx; fails closed without candidates', async () => {
    const lines = ['a=candidate:1 1 udp 1 192.168.1.1 123 typ host', 'a=candidate:2 1 udp 1 203.0.113.1 123 typ srflx', 'a=candidate:3 1 udp 1 203.0.113.2 123 typ prflx'];
    await expect(gatherDescription(fakePC('complete', lines.join('\r\n')), { MS, relayOnly: true })).rejects.toThrow('rvCandidates');
    const result = await gatherDescription(fakePC('complete', [...lines, 'a=candidate:4 1 udp 1 203.0.113.3 123 typ relay'].join('\r\n')), { MS, relayOnly: true });
    expect(result.sdp).not.toContain('typ host'); expect(result.sdp).not.toContain('typ srflx'); expect(result.sdp).not.toContain('typ prflx'); expect(result.sdp).toContain('typ relay');
    expect((await gatherDescription(fakePC(), { MS })).sdp).toContain('abc.local');
  });
  it('bounds gathering and cleans up listeners on timeout / cancellation', async () => {
    vi.useFakeTimers();
    try {
      const pc = fakePC('gathering'), remove = vi.spyOn(pc, 'removeEventListener');
      const pending = expect(gatherDescription(pc, { MS })).rejects.toThrow('rvTimeout');
      await vi.advanceTimersByTimeAsync(MS.MIN); await pending;
      expect(remove).toHaveBeenCalledTimes(2);
      const stopped = gatherDescription(pc, { MS });
      pc.connectionState = 'closed'; pc.dispatchEvent(new Event('connectionstatechange'));
      await expect(stopped).rejects.toThrow('rvRedo');
    } finally { vi.useRealTimers(); }
  });
  it('manually generates/applies SDP; recovery and negotiation never call relay signaling', async () => {
    const pc = fakePC(), originalRestart = pc.restartIce, notify = vi.fn();
    const peer = attachManualPeer({ pc }, { MS, notify });
    expect(await peer.manualOffer()).toEqual(desc);
    await peer.manualAnswer(desc);
    expect(pc.setRemoteDescription).toHaveBeenCalledWith(desc);
    await expect(peer.manualApply(desc)).rejects.toThrow('rvInvalid');
    pc.signalingState = 'have-local-offer'; await peer.manualApply({ type: 'answer', sdp: 'answer' });
    pc.onnegotiationneeded(); expect(notify).not.toHaveBeenCalled();
    peer.connected = true; pc.onnegotiationneeded(); pc.restartIce();
    expect(notify).toHaveBeenCalledOnce(); expect(originalRestart).not.toHaveBeenCalled();
  });
});

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
describe('deployed rendezvous wiring and relay preservation', () => {
  it('registers the deployed bridge, inert entry, localized command and help', () => {
    expect(html).toContain("import { createRendezvous, attachManualPeer } from './src/app/rendezvous.js'");
    expect(html).toContain('globalThis.__breezeRendezvous?.createRendezvous');
    expect(html).toContain("if (val === '/rendezvous')"); expect(html).toContain('/files · /print · /rendezvous');
    expect(html).toContain("await _rendezvous?.open(activeContact)");
    expect(readFileSync(new URL('../sw.js', import.meta.url), 'utf8')).toContain('/src/app/rendezvous.js');
  });
  it('exits manual setup before the API gate, perfect negotiation and sigPoll; relay paths stay intact', () => {
    const start = html.indexOf('  async function connectPeer('), end = html.indexOf('    // Signal', start);
    const setup = html.slice(start, end);
    expect(setup).toContain('if (manual) return globalThis.__breezeRendezvous.attachManualPeer');
    const trickle = setup.slice(setup.indexOf('    pc.onicecandidate ='));
    expect(trickle.indexOf('if (manual) return;')).toBeLessThan(trickle.indexOf('_signal('));
    expect(setup).toContain("if (manual && peerState.connState !== 'CLOSED') peerState.manualRecovery()");
    const relay = html.slice(end, html.indexOf('  // PRESENCE POLLING', end));
    expect(relay).toContain('if (!API) return;');
    expect(relay).toContain("await _sendSignedSDP(sigRoom, 'offer', pc.localDescription)");
    expect(relay).toContain('peerState._sigPoll = startSignalPoll(');
    expect(relay).toContain('contact.sigPub !== wrapper.sigPub');
    expect(relay).toContain('verifySignature(wrapper.sdp, wrapper.sig, wrapper.sigPub)');
    const untouched = html.slice(end, html.indexOf('  // ===== Presence heartbeat', end)) + '  // ===== Presence heartbeat (v3.3: adaptive — slower in background) =====\n';
    expect(createHash('sha256').update(untouched).digest('hex')).toBe('d9d1374cd37a67e4e26a45f084696aca429267bae9331e886c3ca7a010d28cd2');
  });
  it('runs actual connectPeer setup with no API and never trickles / starts polling in manual mode', async () => {
    vi.useFakeTimers();
    try {
      const peers = {}, signal = vi.fn(), notify = vi.fn();
      const setup = html.slice(html.indexOf('  async function connectPeer('), html.indexOf('    // Signal', html.indexOf('  async function connectPeer(')));
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const factory = new AsyncFunction('D', 'with (D) { ' + setup + '\n } return connectPeer; }');
      const D = { peers, myPubB64: 'me', MS, _ac: { signal: { aborted: false } }, _settings: {}, _dbg: vi.fn(),
        getCallICEConfig: () => ({}), getRTCCertificate: async () => ({}), CONFIG: {},
        globalThis: { __breezeRendezvous: { attachManualPeer } }, showToast: notify, t: s => s,
        _signal: signal, updateConvStatus: vi.fn(), renderContacts: vi.fn(),
        RTCPeerConnection: class extends EventTarget {
          constructor() { super(); this.createDataChannel = vi.fn(() => ({ readyState: 'connecting' })); this.close = vi.fn(); }
        },
      };
      const connect = await factory(D);
      const peer = await connect({ id: 'peer', pubB64: 'peer-full' }, { signalingMode: 'manual' });
      expect(peer.manual).toBe(true); expect(peer._sigPoll).toBeUndefined(); expect(peer.pc.createDataChannel).toHaveBeenCalledTimes(2);
      peer.pc.onicecandidate({ candidate: { type: 'host', address: 'private' } });
      peer.pc.connectionState = 'failed'; peer.pc.onconnectionstatechange(); peer.pc.restartIce();
      expect(signal).not.toHaveBeenCalled(); expect(notify).toHaveBeenCalledOnce();
      peer.transition('CLOSED');
    } finally { vi.useRealTimers(); }
  });
  it('refuses missing contact/group/pin/session before touching the old connection', async () => {
    const connect = vi.fn(), toast = vi.fn();
    const D = { MS, t: s => s, toast, connect, sign: vi.fn(), verify: vi.fn(), contact: async () => ({ sigPub: 'pin' }), session: async () => null, sigPub: () => 'me' };
    await createRendezvous(D).open(null); await createRendezvous(D).open({ isGroup: true });
    await createRendezvous(D).open({ id: 'peer' });
    await createRendezvous({ ...D, contact: async () => ({}) }).open({ id: 'peer' });
    expect(connect).not.toHaveBeenCalled(); expect(toast.mock.calls.map(c => c[0])).toEqual(['use1to1', 'use1to1', 'rvTrust', 'rvTrust']);
  });
});
