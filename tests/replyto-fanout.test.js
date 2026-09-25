// tests/replyto-fanout.test.js — Breeze deep-behavior test: replyTo must ride the
// _fanOut copies (peer's linked devices + my selfSync siblings) AND survive into the
// selfSync stored record — otherwise the same reply renders as a quote on one device
// and a context-free plain message on every other device.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the shipped envelopeReplyTo serializer and the shipped normalization block.
const serMatch = SRC.match(/function envelopeReplyTo\(rt\) \{[\s\S]*?\n  \}/);
const envelopeReplyTo = serMatch && new Function(serMatch[0] + '; return envelopeReplyTo;')();
// The receiver normalization: string -> {msgId,text,sender} -> capped {msgId,text}.
const normMatch = SRC.match(/if \(typeof msg\.replyTo === 'string'\) \{[\s\S]*?replyTo: cappedRt \};\n    \}/);
const normalize = normMatch && new Function('msg', normMatch[0] + '\nreturn msg;');

describe('wire contract: envelopeReplyTo -> receiver normalization', () => {
  it('extracts the shipped serializer and normalizer', () => {
    expect(typeof envelopeReplyTo).toBe('function');
    expect(typeof normalize).toBe('function');
  });
  it('round-trips a reply quote through both directions', () => {
    const wire = envelopeReplyTo({ msgId: 'peer:1700000000000', text: 'quoted words', sender: 'alice' });
    expect(typeof wire).toBe('string');
    const out = normalize({ replyTo: wire });
    expect(out.replyTo).toEqual({ msgId: 'peer:1700000000000', text: 'quoted words' });
  });
  it('truncated/malformed wire strings normalize to undefined, not a throw', () => {
    expect(normalize({ replyTo: '{"i":' }).replyTo).toBeUndefined();
    expect(normalize({ replyTo: '"str"' }).replyTo).toBeUndefined();
  });
  it('no-reply messages serialize to undefined (field omitted on wire)', () => {
    expect(envelopeReplyTo(null)).toBeUndefined();
    expect(envelopeReplyTo(undefined)).toBeUndefined();
  });
});

describe('_fanOut extras carry replyTo', () => {
  it('1:1 peerExtra + selfExtra both carry the serialized envelope.replyTo', () => {
    // Two occurrences in the 1:1 _fanOut call: one for the peer's other devices,
    // one for my own siblings.
    const hits = SRC.match(/replyTo: envelope\.replyTo \}/g) || [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(SRC).toContain('{ sig: envelope.sig, sigPub: envelope.sigPub, replyTo: envelope.replyTo }');
  });
  it('group selfExtra carries replyTo so my siblings keep the quote', () => {
    expect(SRC).toContain('sfName: contact.name, replyTo: envelopeReplyTo(meta.replyTo) }');
  });
});

describe('selfSync stored copy keeps replyTo', () => {
  // Drive the shipped record literal for the text path — the object must carry replyTo.
  const recMatch = SRC.match(/dbPut\('messages', (\{ msgId: syncId, contactId: target\.id, text: syncText[^}]*\})/);
  const mkRec = recMatch && new Function('syncId', 'target', 'msg',
    'return ' + recMatch[1].replace(/\bsyncText\b/g, '"txt"') + ';');
  const fileRecMatch = SRC.match(/dbPut\('messages', (\{ msgId: syncId, contactId: target\.id, text: fileText[^}]*\})/);
  const mkFileRec = fileRecMatch && new Function('syncId', 'target', 'msg', 'syncText', 'fileText',
    'return ' + fileRecMatch[1] + ';');

  it('extracts the shipped selfSync record literals', () => {
    expect(typeof mkRec).toBe('function');
    expect(typeof mkFileRec).toBe('function');
  });
  it('text record persists replyTo', () => {
    const rec = mkRec('sib:1', { id: 'c1' }, { ts: 1, replyTo: { msgId: 'a:2', text: 'q' } });
    expect(rec.replyTo).toEqual({ msgId: 'a:2', text: 'q' });
  });
  it('file record persists replyTo (uniform shape)', () => {
    const rec = mkFileRec('sib:1', { id: 'c1' }, { ts: 1, replyTo: { msgId: 'a:2', text: 'q' } }, 'fp', 'fn');
    expect(rec.replyTo).toEqual({ msgId: 'a:2', text: 'q' });
  });
  it('live render path gets replyTo in both appendMsg metas', () => {
    const hits = SRC.match(/\{ synced: true, replyTo: msg\.replyTo \}/g) || [];
    expect(hits.length).toBe(2);
  });
});
