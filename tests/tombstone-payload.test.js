import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const TOMBSTONE = "stored.deleted = true; stored.text = ''; delete stored.isPoll; delete stored.poll; delete stored.fileData; delete stored.voice; await dbPut('messages', stored);";

describe('delete tombstones purge payload-bearing fields', () => {
  it('all 4 delete sites drop isPoll + poll + fileData + voice', () => {
    expect(SRC.split(TOMBSTONE).length - 1).toBe(4);
    // No unpurged tombstone variant survived
    expect(SRC).not.toContain("delete stored.isPoll; await dbPut('messages', stored);");
  });
  it('functional: shipped sequence leaves no payload on the record', async () => {
    const drive = new Function('stored', 'dbPut', `return (async () => { ${TOMBSTONE} })();`);
    const saved = [];
    const stored = {
      msgId: 'x', deleted: false, isPoll: true, poll: { options: [] },
      fileData: JSON.stringify({ type: 'file', name: 's.pdf', data: 'QUJD' }),
      voice: 'QUJD',
      text: '{"pollId":"p"}', ts: 1,
    };
    await drive(stored, async (store, rec) => saved.push([store, rec]));
    const rec = saved[0][1];
    expect(rec.deleted).toBe(true);
    expect(rec.text).toBe('');
    expect('isPoll' in rec).toBe(false);
    expect('poll' in rec).toBe(false);
    expect('fileData' in rec).toBe(false);
    expect('voice' in rec).toBe(false);
    expect(rec.msgId).toBe('x');
    expect(rec.ts).toBe(1);
  });
});
