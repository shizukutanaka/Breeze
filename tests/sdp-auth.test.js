import { describe, it, expect } from 'vitest';
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
const receive = slice('                let sdpJson = s.data;', '\n                // v3.6: Perfect Negotiation collision');
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
