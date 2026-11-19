import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('SDP authentication markers moved');
  return html.slice(a, b);
}
const verifier = slice('  async function verifySignature(', '\n  // ===== Server health check');
const signer = slice('  async function signMessage(', '\n  // Ed25519 ownership proof');
const send = slice('  async function _sendSignedSDP(', '\n  // v3.6 SECURITY: call-signaling');
const receive = slice('                let sdpJson = s.data;', '\n                if (description.type !== s.type');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function harness(hasEd25519 = true) {
  const key = await webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pub = Buffer.from(await webcrypto.subtle.exportKey('raw', key.publicKey)).toString('base64');
  let data;
  const emit = new AsyncFunction('crypto', '_signingKey', '_signingPubB64', '_dbg', '_signal', signer + send + '\nawait _sendSignedSDP("room", "offer", {type: "offer", sdp: "test"});');
  await emit(webcrypto, key, pub, () => {}, (_room, _type, payload) => { data = payload; });
  const consume = new AsyncFunction('crypto', '_hasEd25519', '_dbg', 'dbPut', 'contact', 's', 'isStopped', verifier + '\nconst accepted = []; for (const unused of [0]) {\n' + receive + '\naccepted.push(description); } return accepted;');
  const writes = [];
  return {
    pub, data, writes,
    signed: async (description) => {
      const sdp = JSON.stringify(description);
      const sig = Buffer.from(await webcrypto.subtle.sign('Ed25519', key.privateKey, new TextEncoder().encode(sdp))).toString('base64');
      return JSON.stringify({ sdp, sig, sigPub: pub });
    },
    read: (payload, contact = {}) => consume(webcrypto, hasEd25519, () => {}, async (...args) => { writes.push(args); }, contact, { data: payload }, () => false),
  };
}

describe('deployed signed SDP authentication', () => {
  it('verifies the actual sender wrapper and pins its signing public key', async () => {
    const h = await harness();
    const contact = { id: 'peer' };
    expect(await h.read(h.data, contact)).toEqual([{ type: 'offer', sdp: 'test' }]);
    expect(contact.sigPub).toBe(h.pub);
    expect(h.writes).toHaveLength(1);
  });
  it('rejects tampered payloads, malformed signatures and key-pin mismatches without pinning', async () => {
    const h = await harness();
    const wrapper = JSON.parse(h.data);
    for (const modified of [{ ...wrapper, sdp: JSON.stringify({ type: 'offer', sdp: 'tampered' }) }, { ...wrapper, sig: 'not base64!' }]) {
      expect(await h.read(JSON.stringify(modified))).toEqual([]);
    }
    expect(await h.read(h.data, { sigPub: 'another-key' })).toEqual([]);
    expect(h.writes).toHaveLength(0);
  });
  it('rejects signed SDP when verification is unavailable but keeps unsigned legacy SDP', async () => {
    const h = await harness(false);
    expect(await h.read(h.data)).toEqual([]);
    expect(await h.read(JSON.stringify({ type: 'offer', sdp: 'legacy' }))).toEqual([{ type: 'offer', sdp: 'legacy' }]);
    expect(h.writes).toHaveLength(0);
  });
});

const pollSetup = slice('      peerState._sigPoll = startSignalPoll(', '\n      peerState._sigPoll.setConnected(');
async function connectedPoll({ polite = true, state = 'stable', makingOffer = false } = {}) {
  const h = await harness();
  const controller = { resetFast: vi.fn(), setConnected: vi.fn() };
  const pc = {
    signalingState: state,
    setRemoteDescription: vi.fn(async description => { pc.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }),
    setLocalDescription: vi.fn(async description => {
      pc.signalingState = 'stable';
      pc.localDescription = description || { type: 'answer', sdp: 'answer' };
    }),
    addIceCandidate: vi.fn(),
  };
  const contact = { id: 'peer', sigPub: h.pub };
  const peerState = { connected: true, dc: { readyState: 'open' } };
  const answer = vi.fn();
  let messages = [];
  const create = new AsyncFunction('crypto', 'pc', 'contact', 'peerState', 'polite', 'makingOffer', '_signalAwait', '_sendSignedSDP', 'controller', verifier + `
    const _hasEd25519 = true, _dbg = () => {}, dbPut = async () => {}, myId = 'self', sigRoom = 'room';
    const showTyping = () => {}, showReadReceipt = () => {}, _p2pStats = null;
    let ignoreOffer = false, poll;
    const seenSDP = new Set();
    let remoteSDPOrigin = null;
    const startSignalPoll = callback => { poll = callback; return controller; };
    ${pollSetup}
    return poll;
  `);
  const poll = await create(webcrypto, pc, contact, peerState, polite, makingOffer,
    async () => ({ ok: true, json: async () => ({ messages }) }), answer, controller);
  return { ...h, pc, contact, controller, answer,
    poll: async signals => { messages = signals; return poll(() => false); },
    offer: async (sdp = 'restart') => ({ sender: 'peer', type: 'offer', data: await h.signed({ type: 'offer', sdp }) }),
  };
}

describe('connected DM perfect negotiation (deployed poll callback)', () => {
  it('authenticates a restart offer while connected, answers, and drops duplicate and own SDP', async () => {
    const h = await connectedPoll();
    const offer = await h.offer();
    await h.poll([{ ...offer, sender: 'self' }, offer, offer]);
    await h.poll([offer]);
    expect(h.pc.setRemoteDescription).toHaveBeenCalledOnce();
    expect(h.pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'restart' });
    expect(h.answer).toHaveBeenCalledWith('room', 'answer', { type: 'answer', sdp: 'answer' });
    expect(h.controller.resetFast).toHaveBeenCalledOnce();
    expect(h.controller.setConnected).toHaveBeenCalledWith(true);
  });
  it('rejects invalid signatures and mismatched pins while connected', async () => {
    const h = await connectedPoll();
    const offer = await h.offer();
    const wrapper = JSON.parse(offer.data);
    await h.poll([{ ...offer, data: JSON.stringify({ ...wrapper, sdp: JSON.stringify({ type: 'offer', sdp: 'tampered' }) }) }]);
    h.contact.sigPub = 'different-key';
    await h.poll([offer]);
    expect(h.pc.setRemoteDescription).not.toHaveBeenCalled();
    expect(h.answer).not.toHaveBeenCalled();
  });
  it('drops an older SDP origin version even if it has not been seen before', async () => {
    const h = await connectedPoll();
    await h.poll([await h.offer('v=0\r\no=- 123 2 IN IP4 0.0.0.0\r\n')]);
    await h.poll([await h.offer('v=0\r\no=- 123 1 IN IP4 0.0.0.0\r\n')]);
    expect(h.pc.setRemoteDescription).toHaveBeenCalledOnce();
    expect(h.answer).toHaveBeenCalledOnce();
  });
  it.each([true, false])('resolves connected glare with polite=%s', async polite => {
    const h = await connectedPoll({ polite, state: 'have-local-offer', makingOffer: true });
    await h.poll([await h.offer()]);
    if (polite) {
      expect(h.pc.setLocalDescription.mock.calls).toEqual([[{ type: 'rollback' }], []]);
      expect(h.pc.setLocalDescription.mock.invocationCallOrder[0]).toBeLessThan(h.pc.setRemoteDescription.mock.invocationCallOrder[0]);
      expect(h.answer).toHaveBeenCalledOnce();
    } else {
      expect(h.pc.setRemoteDescription).not.toHaveBeenCalled();
      expect(h.answer).not.toHaveBeenCalled();
    }
  });
  it('accepts a connected answer only with a pending offer; ignores stale answers, type mismatches and unknown signals', async () => {
    const h = await connectedPoll();
    const answer = { sender: 'peer', type: 'answer', data: await h.signed({ type: 'answer', sdp: 'answer' }) };
    await h.poll([answer, { ...await h.offer(), type: 'answer' }, { type: 'unknown', data: '{}' }]);
    expect(h.pc.setRemoteDescription).not.toHaveBeenCalled();
    h.pc.signalingState = 'have-local-offer';
    await h.poll([answer]);
    await h.poll([answer]);
    expect(h.pc.setRemoteDescription).toHaveBeenCalledOnce();
    expect(h.pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'answer' });
    expect(h.answer).not.toHaveBeenCalled();
  });
  it('ignores an empty poll and survives malformed SDP or a failed application', async () => {
    const h = await connectedPoll();
    expect(await h.poll([])).toBe(false);
    await h.poll([{ type: 'offer', data: '{' }]);
    h.pc.setRemoteDescription.mockRejectedValueOnce(new Error('closed'));
    await h.poll([await h.offer()]);
    expect(h.answer).not.toHaveBeenCalled();
  });
});
