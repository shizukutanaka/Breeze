// Poll-vote handlers scanned dbGetAll('messages') — the WHOLE store, deserialized —
// for EVERY wire vote frame (P2P + sealed-relay paths): a spamming peer could force
// repeated full-store scans (CWE-400 asymmetric cost). Both paths now use the
// existing 'contact' conversation index (dbGetByIndex), which also makes the
// conversation binding inherent. dbGetByIndex already degrades to [] on error, so
// votes simply drop on a missing index — graceful.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// The two poll_vote blocks: sealed-relay group path and the P2P DataChannel path.
function block(marker) {
  const i = html.indexOf(marker);
  if (i < 0) throw new Error('block not found: ' + marker);
  return html.slice(i, i + 3000);
}
const relay = block("signal.type === 'poll_vote'");
const p2p   = block("msg.type === 'poll_vote'");

describe('poll_vote lookup uses the conversation index, not a full-store scan', () => {
  it('wire-site: relay path uses dbGetByIndex on the group id', () => {
    expect(relay).toContain("dbGetByIndex('messages', 'contact', msg.groupId)");
    expect(relay).not.toContain("dbGetAll('messages')");
  });

  it('wire-site: P2P path uses dbGetByIndex on the contact id', () => {
    expect(p2p).toContain("dbGetByIndex('messages', 'contact', contact.id)");
    expect(p2p).not.toContain("dbGetAll('messages')");
  });

  it('conversation binding is still enforced after the lookup', () => {
    expect(relay).toContain('pollMsg.contactId === msg.groupId');
    expect(p2p).toContain('pollMsg.contactId === contact.id');
  });

  it('dbGetByIndex degrades to [] on error (votes drop, never throw)', () => {
    const src = html.slice(html.indexOf('async function dbGetByIndex'));
    expect(src).toContain('req.onerror = () => r([])');
    expect(src).toContain('catch(e) { _dbg(e');
  });

  it('both lookups still filter on isPoll + JSON.parse the stored text', () => {
    for (const b of [relay, p2p]) {
      expect(b).toContain('m.isPoll');
      expect(b).toContain('JSON.parse(m.text).pollId');
    }
  });
});
