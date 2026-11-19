// SHARE_PLAN stage 5 step 6 — location sharing: coordinate
// validation, wire payloads, live-session shapes, wiring pins,
// and the server-blindness audit.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAPS_LOC, sanitizeLoc, buildLocationPayload, parseLocationPayload,
  groupTextForLocation, parseGroupLocationText, osmUrl, locLabel, liveRecordId,
} from '../src/app/location.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('coordinate validation', () => {
  it('accepts and rounds real coordinates', () => {
    expect(sanitizeLoc({ lat: 35.68123456, lng: 139.76712344, acc: 12.6 }))
      .toEqual({ lat: 35.681235, lng: 139.767123, acc: 13 });
    expect(sanitizeLoc({ lat: -33.86, lng: 151.21 })).toEqual({ lat: -33.86, lng: 151.21 });
  });

  it('rejects out-of-range and non-numeric input', () => {
    expect(sanitizeLoc({ lat: 91, lng: 0 })).toBeNull();
    expect(sanitizeLoc({ lat: 0, lng: -181 })).toBeNull();
    expect(sanitizeLoc({ lat: 'x', lng: 0 })).toBeNull();
    expect(sanitizeLoc({ lat: NaN, lng: 0 })).toBeNull();
    expect(sanitizeLoc(null)).toBeNull();
    // An absurd accuracy is dropped, not fatal.
    expect(sanitizeLoc({ lat: 1, lng: 2, acc: 999999 })).toEqual({ lat: 1, lng: 2 });
  });
});

describe('wire payloads', () => {
  it('one-shot round-trips', () => {
    const wire = buildLocationPayload({ loc: { lat: 35.68, lng: 139.77, acc: 10 } });
    expect(parseLocationPayload(wire)).toEqual({ loc: { lat: 35.68, lng: 139.77, acc: 10 } });
    expect(parseLocationPayload('{"type":"sticker","v":1}')).toBeNull();
  });

  it('live payloads carry the session; stopped needs no coordinates', () => {
    const wire = buildLocationPayload({ loc: { lat: 1, lng: 2 }, live: 'abc123', seq: 3, until: 9999 });
    expect(parseLocationPayload(wire)).toEqual({ loc: { lat: 1, lng: 2 }, live: 'abc123', seq: 3, until: 9999 });
    const stop = buildLocationPayload({ live: 'abc123', stopped: true });
    expect(parseLocationPayload(stop)).toEqual({ live: 'abc123', stopped: true });
    expect(buildLocationPayload({ stopped: true })).toBeNull();
  });

  it('group text round-trips; ordinary text never parses', () => {
    const wire = groupTextForLocation({ loc: { lat: 1, lng: 2 } });
    expect(wire.startsWith('{"loc":')).toBe(true);
    expect(parseGroupLocationText(wire)).toEqual({ loc: { lat: 1, lng: 2 } });
    expect(parseGroupLocationText('{"stk":{}}')).toBeNull();
    expect(parseGroupLocationText('hello')).toBeNull();
  });

  it('labels, map links and deterministic live record ids', () => {
    expect(locLabel({ lat: 35.68123, lng: 139.76712 })).toBe('📍 35.68123, 139.76712');
    expect(osmUrl({ lat: 35.68, lng: 139.77 })).toContain('openstreetmap.org/?mlat=35.68&mlon=139.77');
    expect(liveRecordId('alice1234567', 's1')).toBe('live:alice1234567:s1');
  });
});

describe('stage 5 step 6 wiring + server-blindness audit', () => {
  it('the capability is advertised and gates sending', () => {
    expect(html).toContain("const CAPS_LOC = 'loc-v1';");
    expect(html).toContain('caps.push(CAPS_LOC);');
    expect(CAPS_LOC).toBe('loc-v1');
  });

  it('the relay never sees location fields', () => {
    expect(worker).not.toContain('isLocation');
    expect(worker).not.toContain('loc-v1');
  });

  it('live sessions are in-memory with a stop path that clears the timer first', () => {
    const mod = readFileSync(new URL('../src/app/location.js', import.meta.url), 'utf8');
    expect(mod).toContain('const _liveShares = new Map();');
    expect(mod).toContain('function _stopLiveShare(contactId, silent)');
    const stop = mod.slice(mod.indexOf('function _stopLiveShare'), mod.indexOf('function _stopLiveShare') + 900);
    expect(stop.indexOf('clearInterval')).toBeLessThan(stop.indexOf('stopped: true'));
  });

  it('the module is bridged and precached', () => {
    expect(html).toContain("from './src/app/location.js';");
    expect(sw).toContain("'/src/app/location.js'");
  });
});
