import { createFingerprint } from '../crypto/fingerprint.js';

export const SAFETY_NUMBER_CAP = 'safety-number-v2';
const fingerprint = createFingerprint();

export async function legacySafetyNumber(local, remote) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode([local, remote].sort().join(''))));
  return Array.from({ length: 6 }, (_, i) => String(hash[i * 2] * 256 + hash[i * 2 + 1]).padStart(5, '0')).join(' ');
}

export async function negotiatedSafetyNumber(local, remote, { localCaps = [], remoteCaps = [] } = {}) {
  if (!localCaps.includes(SAFETY_NUMBER_CAP) || !remoteCaps.includes(SAFETY_NUMBER_CAP)) return legacySafetyNumber(local, remote);
  return fingerprint.safetyNumber(local, remote, { localId: local.slice(0, 12), remoteId: remote.slice(0, 12) });
}

export function comparisonQR(number, bothKeys) {
  if (!/^(?:\d{5} ){5}(?:\d{5})(?:(?: \d{5}){6})?$/.test(number) || !/^(?:[0-9a-f]{4} ){15}[0-9a-f]{4}$/.test(bothKeys)) throw new Error('verification comparison unavailable');
  return 'breeze-verify:' + JSON.stringify({ v: number.split(' ').length === 12 ? 2 : 1, number, bothKeys });
}

export function compareQR(scanned, expected) {
  if (typeof scanned !== 'string' || scanned.length > 512 || !scanned.startsWith('breeze-verify:')) return 'invalid';
  try {
    const a = JSON.parse(scanned.slice(14)), b = JSON.parse(expected.slice(14));
    if (![1, 2].includes(a.v) || comparisonQR(a.number, a.bothKeys) !== scanned) return 'invalid';
    if (a.v !== b.v) return 'version';
    return a.number === b.number && a.bothKeys === b.bothKeys ? 'match' : 'mismatch';
  } catch { return 'invalid'; }
}
