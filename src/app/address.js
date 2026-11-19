// Breeze stage 6 step 2 — contact addresses.
// An address is how a user on one relay finds a user on another
// without the default relay and without an invite link:
//   @alice              — resolve on my own relays (the record may
//                         itself carry her home relays)
//   @alice@relay.host   — resolve the alias ON that relay, then
//                         adopt the record's home list
// The host part is a relay origin host (optionally with a port);
// anything else falls through to the existing input kinds.

export function parseContactAddress(input) {
  if (typeof input !== 'string') return null;
  const m = input.trim().match(/^@?([a-z0-9_]{3,20})@([a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?)$/i);
  if (!m) return null;
  const host = m[2].toLowerCase();
  if (host.includes('..') || host.startsWith('.') || host.endsWith('.')) return null;
  return { alias: m[1].toLowerCase(), relayUrl: 'https://' + host };
}
