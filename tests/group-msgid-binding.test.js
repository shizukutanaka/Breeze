// P2P group_msg dedup keyed the replay cache on the peer-CLAIMED `msg.msgId` with
// no binding to the sender. A member could pre-plant other members' future ids
// ('victimB:1234') — when the victim's real message later arrived it hit
// _replayCache/dbGet and was silently dropped: targeted message suppression
// (CWE-345, missing sender-authenticity binding). gmsgId is now bound: a claimed
// msgId is honored only when it starts with '<sender12>:' — everything else is
// rebuilt as '<sender12>:<ts>'. Same-site fix: the per-message
// dbGetAll('contacts') scan became dbGet('contacts', groupId).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const SRC = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function gmsgIdFor(msg) {
  const i = SRC.indexOf('const gSender = typeof msg.sender');
  const j = SRC.indexOf('\n', SRC.indexOf('const gmsgId =', i));
  if (i < 0 || j < 0) throw new Error('gmsgId block not found');
  const src = SRC.slice(i, j);
  return new Function('msg', `${src}\nreturn gmsgId;`)(msg);
}

const PUB_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // 43 chars like pubB64
const PUB_B = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

describe('P2P group_msg replay-key sender binding', () => {
  it('wire-site: claimed msgId must start with <sender12>:, contacts lookup is keyed', () => {
    expect(SRC).toContain("msg.msgId.startsWith(gSender + ':')");
    expect(SRC).toContain("const group = await dbGet('contacts', msg.groupId)");
    expect(SRC).not.toContain("dbGetAll('contacts')).find(c => c.id === msg.groupId)");
    expect(SRC).not.toContain("const gmsgId = msg.msgId ||");
  });

  it('honors a legit claimed msgId (<sender12>:ts:seq)', () => {
    expect(gmsgIdFor({ sender: PUB_A, ts: 100, msgId: PUB_A.slice(0, 12) + ':100:3' }))
      .toBe(PUB_A.slice(0, 12) + ':100:3');
  });

  it("rejects a msgId claiming ANOTHER member's id — replants can't poison the cache", () => {
    const out = gmsgIdFor({ sender: PUB_A, ts: 999, msgId: PUB_B.slice(0, 12) + ':999:1' });
    expect(out).toBe(PUB_A.slice(0, 12) + ':999');   // falls back to sender-bound key
    expect(out).not.toContain(PUB_B.slice(0, 12));
  });

  it('rejects non-string/missing msgId — falls back to <sender12>:ts', () => {
    expect(gmsgIdFor({ sender: PUB_A, ts: 7 })).toBe(PUB_A.slice(0, 12) + ':7');
    expect(gmsgIdFor({ sender: PUB_A, ts: 7, msgId: 12345 })).toBe(PUB_A.slice(0, 12) + ':7');
    expect(gmsgIdFor({ sender: PUB_A, ts: 7, msgId: { x: 1 } })).toBe(PUB_A.slice(0, 12) + ':7');
  });

  it('caps claimed msgId length at 64 (long-string key bloat guard)', () => {
    const long = PUB_A.slice(0, 12) + ':' + 'x'.repeat(200);
    expect(gmsgIdFor({ sender: PUB_A, ts: 5, msgId: long }).length).toBe(64);
  });

  it('non-string sender degrades without throwing', () => {
    expect(gmsgIdFor({ sender: 42, ts: 1, msgId: 'x:1' })).toBe(':1');
  });
});
