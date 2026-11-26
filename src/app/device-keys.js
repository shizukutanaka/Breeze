const encoder = new TextEncoder();
const encode = bytes => btoa(String.fromCharCode(...bytes));
function bytes(value, length) {
  if (typeof value !== 'string' || value.length !== Math.ceil(length / 3) * 4) throw new Error('device key encoding');
  const result = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (result.length !== length || encode(result) !== value) throw new Error('device key length');
  return result;
}
function offerFields(o) {
  if (o?.v !== 1 || typeof o.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(o.nonce)) throw new Error('device offer version');
  bytes(o.pub, 32); bytes(o.ed, 32);
  return [o.pub, o.ed, o.nonce];
}
export const offerText = o => 'BreezeDeviceOffer/v1:' + JSON.stringify(offerFields(o));
export function bindingText(b) {
  const fields = offerFields(b);
  bytes(b.root, 32); bytes(b.rootEd, 32);
  if (b.pub === b.root || !Number.isSafeInteger(b.issuedAt) || b.issuedAt <= 0) throw new Error('device binding fields');
  return 'BreezeDeviceBinding/v1:' + JSON.stringify([b.root, b.rootEd, ...fields, b.issuedAt]);
}
async function verify(text, signature, pub) {
  const key = await crypto.subtle.importKey('raw', bytes(pub, 32), 'Ed25519', false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, bytes(signature, 64), encoder.encode(text));
}
export async function verifyOffer(offer) {
  try { return await verify(offerText(offer), offer.sig, offer.ed); } catch { return false; }
}
export async function verifyBinding(binding, expected) {
  try {
    if (!expected?.root || !expected.rootEd || Object.entries(expected).some(([key, value]) => binding?.[key] !== value)) return false;
    return await verify(bindingText(binding), binding.sig, expected.rootEd);
  } catch { return false; }
}
export function deviceToken(kind, value) {
  if (!['offer', 'binding'].includes(kind)) throw new Error('device token kind');
  return 'breeze-device-' + kind + ':v1:' + encode(encoder.encode(JSON.stringify(value)));
}
export function readDeviceToken(kind, token) {
  const prefix = 'breeze-device-' + kind + ':v1:';
  if (typeof token !== 'string' || token.length > 65536 || !token.startsWith(prefix)) throw new Error('device token');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(token.slice(prefix.length)), c => c.charCodeAt(0))));
}
export async function verifyBindingRegistry(rec, binding) {
  try {
    if (!await verifyBinding(binding, { root: binding.root, rootEd: binding.rootEd })) return false;
    if (rec?.root !== binding.root || !Array.isArray(rec.devices) || rec.devices.length < 2 || rec.devices.length > 10 || !Number.isSafeInteger(rec.ts) || rec.ts < binding.issuedAt) return false;
    const pubs = rec.devices.map(d => d?.pub);
    for (const pub of pubs) bytes(pub, 32);
    if (new Set(pubs).size !== pubs.length || !pubs.includes(binding.pub) || !pubs.includes(binding.root)) return false;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(pubs))));
    const digest = [...hash.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
    return await verify(`breeze-device-set:${binding.root.slice(0, 12)}:${rec.ts}:${digest}`, rec.sig, binding.rootEd);
  } catch { return false; }
}
