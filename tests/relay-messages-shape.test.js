// tests/relay-messages-shape.test.js — Breeze deep-behavior test: every relay-facing
// poll loop must shape-gate `messages` with Array.isArray before for..of. A hostile or
// compromised relay can return a non-array truthy value: a large STRING is iterable
// per-character, so `(data.messages || [])` would run N per-element iterations per
// poll cycle (seconds of work); a non-iterable object throws and silently kills the
// whole poll cycle. The gate is the codebase's acknowledged "malicious relay" threat
// model (sw.js safeAppUrl) applied to every response-array loop.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the shipped ternary and drive it with hostile shapes.
const m = SRC.match(/\(Array\.isArray\(data\.messages\) \? data\.messages : \[\]\)/);
const gate = m && new Function('data', 'return ' + m[0] + ';');

describe('relay messages shape gate', () => {
  it('every /msg/poll + signal-poll loop is Array.isArray-gated', () => {
    // 4 data.messages sites (initial catch-up, call signal poll, main poll, P2P sig poll)
    expect((SRC.match(/for \(const \w+ of \(Array\.isArray\(data\.messages\) \? data\.messages : \[\]\)/g) || []).length).toBe(4);
    // 1 sealed-poll site reads sData.messages
    expect((SRC.match(/for \(const \w+ of \(Array\.isArray\(sData\.messages\) \? sData\.messages : \[\]\)/g) || []).length).toBe(1);
  });
  it('no bare (data.messages || []) / (sData.messages || []) loop remains', () => {
    expect(SRC.match(/for \(const \w+ of \(data\.messages \|\| \[\]\)/g)).toBeNull();
    expect(SRC.match(/for \(const \w+ of \(sData\.messages \|\| \[\]\)/g)).toBeNull();
  });
  it('the shipped gate rejects hostile non-array shapes', () => {
    expect(typeof gate).toBe('function');
    expect(gate({ messages: 'A'.repeat(1024) })).toEqual([]); // string: would iterate per-char
    expect(gate({ messages: { 0: 'x', length: 1 } })).toEqual([]); // array-like: for..of throws
    expect(gate({ messages: 42 })).toEqual([]);
    expect(gate({})).toEqual([]);
    expect(gate({ messages: null })).toEqual([]);
  });
  it('the shipped gate passes real arrays through untouched', () => {
    const arr = [{ type: 'msg' }, { type: 'signal' }];
    expect(gate({ messages: arr })).toBe(arr);
    expect(gate({ messages: [] })).toEqual([]);
  });
});
