// SHARE_PLAN stage 4 step 3 — history-sync packing/validation units.
// The step's completion condition is byte-for-byte equality of the
// transferred conversation, so the centrepiece here is the round trip:
// stored records -> chunks -> parsed chunks -> import plan against an
// empty store -> canonical serialization must equal the sender's.
import { describe, it, expect } from 'vitest';
import {
  HISTORY_CHUNK_MAX, HISTORY_MAX_CHUNKS,
  chunkHistoryRecords, parseHistoryChunk, historyRecordOk,
  planHistoryImport, canonicalHistory,
} from '../src/app/history-sync.js';

const CID = 'contact-abc';
const rec = (i, extra = {}) => ({
  msgId: `sender1:${1700000000000 + i * 1000}`,
  contactId: CID,
  text: `message ${i}`,
  mine: i % 2 === 0,
  ts: 1700000000000 + i * 1000,
  ...extra,
});

describe('chunkHistoryRecords', () => {
  it('packs small histories into one chunk', () => {
    const { chunks, skipped } = chunkHistoryRecords([rec(0), rec(1), rec(2)]);
    expect(skipped).toBe(0);
    expect(chunks).toHaveLength(1);
    expect(JSON.parse(chunks[0]).records).toHaveLength(3);
  });

  it('respects the size budget across many records', () => {
    const big = Array.from({ length: 60 }, (_, i) => rec(i, { text: 'x'.repeat(5000) }));
    const { chunks, skipped } = chunkHistoryRecords(big, 50000);
    expect(skipped).toBe(0);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50000);
    expect(chunks.flatMap(c => JSON.parse(c).records)).toHaveLength(60);
  });

  it('skips a record too large to travel, and counts it', () => {
    const huge = rec(9, { fileData: 'A'.repeat(400000) });
    const { chunks, skipped } = chunkHistoryRecords([rec(0), huge, rec(1)]);
    expect(skipped).toBe(1);
    expect(chunks.flatMap(c => JSON.parse(c).records).map(r => r.msgId))
      .toEqual([rec(0).msgId, rec(1).msgId]);
  });

  it('empty input packs to nothing', () => {
    expect(chunkHistoryRecords([])).toEqual({ chunks: [], skipped: 0 });
    expect(chunkHistoryRecords(undefined)).toEqual({ chunks: [], skipped: 0 });
  });
});

describe('parseHistoryChunk', () => {
  it('accepts a chunk produced by the packer', () => {
    const { chunks } = chunkHistoryRecords([rec(0)]);
    expect(parseHistoryChunk(chunks[0])).toHaveLength(1);
  });
  it('rejects non-chunks', () => {
    expect(parseHistoryChunk('not json')).toBeNull();
    expect(parseHistoryChunk('{"h":2,"records":[]}')).toBeNull();
    expect(parseHistoryChunk('{"h":1}')).toBeNull();
    expect(parseHistoryChunk('')).toBeNull();
    expect(parseHistoryChunk(null)).toBeNull();
  });
});

describe('historyRecordOk', () => {
  it('returns a valid record unchanged (same object)', () => {
    const r = rec(0, { reactions: { '👍': ['u1'] }, replyTo: { id: 'x', text: 'y' } });
    expect(historyRecordOk(r, CID)).toBe(r);
  });
  it('rejects another conversation, bad ids, bad timestamps', () => {
    expect(historyRecordOk(rec(0, { contactId: 'other' }), CID)).toBeNull();
    expect(historyRecordOk(rec(0, { msgId: '' }), CID)).toBeNull();
    expect(historyRecordOk(rec(0, { msgId: 'x'.repeat(300) }), CID)).toBeNull();
    expect(historyRecordOk(rec(0, { ts: NaN }), CID)).toBeNull();
    expect(historyRecordOk(null, CID)).toBeNull();
    expect(historyRecordOk([1, 2], CID)).toBeNull();
  });
  it('refuses an expired disappearing message but keeps a live one', () => {
    const now = 1700000100000;
    expect(historyRecordOk(rec(0, { disappearAt: now - 1 }), CID, now)).toBeNull();
    expect(historyRecordOk(rec(0, { disappearAt: now + 60000 }), CID, now)).not.toBeNull();
  });
});

describe('planHistoryImport', () => {
  it('imports everything into an empty store', () => {
    const records = [rec(0), rec(1)];
    expect(planHistoryImport(records, CID, new Set())).toEqual(records);
  });
  it('never overwrites an existing record', () => {
    const records = [rec(0), rec(1), rec(2)];
    const out = planHistoryImport(records, CID, new Set([rec(1).msgId]));
    expect(out.map(r => r.msgId)).toEqual([rec(0).msgId, rec(2).msgId]);
  });
  it('drops invalid and foreign records, and in-transfer duplicates', () => {
    const records = [rec(0), rec(0), rec(1, { contactId: 'nope' }), null, rec(2)];
    const out = planHistoryImport(records, CID, []);
    expect(out.map(r => r.msgId)).toEqual([rec(0).msgId, rec(2).msgId]);
  });
});

describe('byte-identity round trip (the step completion condition)', () => {
  it('sender conversation == receiver conversation after transfer', () => {
    const sender = Array.from({ length: 120 }, (_, i) => rec(i, {
      ...(i % 7 === 0 ? { edited: true } : {}),
      ...(i % 11 === 0 ? { reactions: { '❤️': ['peer1'] } } : {}),
      ...(i % 13 === 0 ? { fileData: JSON.stringify({ name: 'a.png', data: 'B'.repeat(3000) }) } : {}),
    }));
    const { chunks, skipped } = chunkHistoryRecords(sender, 30000);
    expect(skipped).toBe(0);
    expect(chunks.length).toBeLessThanOrEqual(HISTORY_MAX_CHUNKS);
    const received = [];
    for (const c of chunks) {
      const parsed = parseHistoryChunk(c);
      expect(parsed).not.toBeNull();
      received.push(...planHistoryImport(parsed, CID, new Set(received.map(r => r.msgId))));
    }
    expect(canonicalHistory(received)).toBe(canonicalHistory(sender));
  });

  it('chunk budget default stays well under the relay envelope cap', () => {
    // 200K chars of plaintext base64-expands to ~267K in the deposit —
    // comfortably below the worker's 512KB envelope limit.
    expect(HISTORY_CHUNK_MAX).toBeLessThanOrEqual(200000);
  });
});
