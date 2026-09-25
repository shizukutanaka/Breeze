// Regression: the health-check clock-drift correction clamped _clockOffset to ±1h,
// but the worker rejects every message whose ts drifts more than ±5min
// (TIMEOUT_MS.REQ_TS). A hostile or broken /health response reporting serverTime
// 5+min off therefore put correctedNow() permanently outside the acceptance window:
// EVERY outgoing send got INVALID_TIMESTAMP — a total send outage from one fetch.
// The cap must sit strictly inside the worker's ±5min window (margin for transit).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleMsgSend } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Shipped line: _clockOffset = Math.max(-CAP, Math.min(CAP, rawDrift));
const m = html.match(/_clockOffset = (Math\.max\([^;]*rawDrift\)*);/);
const MS = { MIN: 60000 };
const clampFn = m ? new Function('MS', 'rawDrift', `return ${m[1]};`) : () => NaN;
const clamp = (rawDrift) => clampFn(MS, rawDrift);

const ip = '203.0.113.7';
const req = () => apiRequest('/api/msg/send', {});
const base = { to: 'bob00001', from: 'alice001', fromPub: 'P', fromName: 'A' };
let n = 0;

describe('clock-drift correction cap must stay inside the worker ±5min window', () => {
  it('clamp line exists in shipped source', () => {
    expect(m, 'expected _clockOffset Math.max/Math.min clamp').toBeTruthy();
  });

  it('cap is strictly below 5 min (300000ms)', () => {
    expect(Math.abs(clamp(86400000))).toBeLessThan(300000);
    expect(Math.abs(clamp(-86400000))).toBeLessThan(300000);
  });

  it('a hostile +55min serverTime cannot push outgoing ts out of the worker window', async () => {
    const env = makeEnv();
    const ts = Date.now() + clamp(55 * 60 * 1000); // old cap → +55min → rejected
    const resp = await handleMsgSend({ ...base, payload: 'X' + (n++), ts }, ip, env, req());
    expect(resp.status).toBe(200);
  });

  it('a hostile -55min serverTime cannot push outgoing ts out of the worker window', async () => {
    const env = makeEnv();
    const ts = Date.now() - clamp(55 * 60 * 1000);
    const resp = await handleMsgSend({ ...base, payload: 'X' + (n++), ts }, ip, env, req());
    expect(resp.status).toBe(200);
  });

  it('old ±1h cap demonstrates the DoS: +55min offset → INVALID_TIMESTAMP', async () => {
    const env = makeEnv();
    const ts = Date.now() + 3300000; // under the old ±3600000 cap
    const resp = await handleMsgSend({ ...base, payload: 'X' + (n++), ts }, ip, env, req());
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.code).toBe('INVALID_TIMESTAMP');
  });

  it('honest small drift still corrects (2min offset lands inside the window)', async () => {
    const env = makeEnv();
    const ts = Date.now() + clamp(120000); // real +2min drift → full correction
    const resp = await handleMsgSend({ ...base, payload: 'X' + (n++), ts }, ip, env, req());
    expect(resp.status).toBe(200);
  });
});
