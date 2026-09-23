import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('all server-validated + peer-wire timestamps use correctedNow() — drifted clocks fail freshness/sig checks (same class as _ownerAuth)', () => {
  it('signed upload ts sites: prekey-upload x2 + backup-upload all use correctedNow', () => {
    const ups = SRC.match(/const upTs = correctedNow\(\);/g) || [];
    expect(ups.length).toBe(3); // first upload, replenish, backup
    const signed = SRC.match(/signMessage\(`breeze-(prekey|backup)-upload:\$\{myId\}:\$\{upTs\}`\)/g) || [];
    expect(signed.length).toBe(3);
    expect(SRC).not.toMatch(/const upTs = Date\.now\(\);/);
  });

  it('alias PoW challenge + signed ts sites use correctedNow()', () => {
    const pows = SRC.match(/generatePoW\([^)]*correctedNow\(\), CONFIG\.POW_DIFFICULTY\)/g) || [];
    expect(pows.length).toBe(2); // initial registration + rename
    expect(SRC).toMatch(/const aliasTs = correctedNow\(\);/);
    expect(SRC).toMatch(/const aTs = correctedNow\(\);/);
  });

  it('relaySend control ts + dm-sig seal ts + read/call/file wire ts use correctedNow()', () => {
    const relays = SRC.match(/ts: correctedNow\(\), isGroup|ts: correctedNow\(\), isSenderKey|ts: correctedNow\(\), isFile/g) || [];
    expect(relays.length).toBeGreaterThanOrEqual(5); // leave x2, kick, invite, meta, senderkey, file
    expect(SRC).toMatch(/const ts = correctedNow\(\);\n {6}const se = await sealMeta/);
    expect(SRC).toMatch(/type: 'read', sender: myId, ts: correctedNow\(\)/);
    expect(SRC).toMatch(/payload: callNotif, ts: correctedNow\(\)/);
  });

  it('ping pong ts stays Date.now() — RTT math needs the LOCAL clock, not the corrected one', () => {
    expect(SRC).toMatch(/type: 'ping', ts: Date\.now\(\)/);
    // and no outgoing relay/ts site was missed (only local-clock consumers remain)
    expect(SRC).not.toMatch(/ts: Date\.now\(\), is(SenderKey|Group|File|Call)/);
  });
});
