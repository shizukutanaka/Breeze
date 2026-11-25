// SHARE_PLAN stage 6 step 3 — TURN self-hosting budget + measurement.
// The completion conditions: the TURN-relayed share of call traffic
// is continuously measurable (on-device counters, per the no-
// telemetry rule), and a spent budget becomes a NOTIFICATION, not a
// silent degradation. The worker's enforceable lever is credential
// issuance (it never sees media bytes): metered modes count
// issuances per month and refuse past the operator's cap with a
// turnQuota flag the client surfaces.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createP2pStats, extractPairSample } from '../src/app/p2p-stats.js';
import { handleTurn } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const callJs = readFileSync(new URL('../src/app/call.js', import.meta.url), 'utf8');
const gcallJs = readFileSync(new URL('../src/app/group-call.js', import.meta.url), 'utf8');
const panels = readFileSync(new URL('../src/app/info-panels.js', import.meta.url), 'utf8');

function memStats() {
  const m = new Map();
  return createP2pStats({ load: (k) => m.get(k) || null, save: (k, v) => m.set(k, v), _map: m });
}

describe('extractPairSample', () => {
  const pair = (over = {}) => ({ id: 'p1', type: 'candidate-pair', state: 'succeeded', nominated: true, localCandidateId: 'l1', bytesSent: 1000, bytesReceived: 2000, ...over });
  const cand = (type) => ({ id: 'l1', type: 'local-candidate', candidateType: type });

  it('classifies a relay pair and totals its bytes', () => {
    expect(extractPairSample([pair(), cand('relay')])).toEqual({ relayed: true, route: 'turn', bytes: 3000 });
  });

  it('classifies direct and srflx pairs as not relayed', () => {
    expect(extractPairSample([pair(), cand('host')])).toMatchObject({ relayed: false, route: 'direct' });
    expect(extractPairSample([pair(), cand('srflx')])).toMatchObject({ relayed: false, route: 'srflx' });
  });

  it('returns null without a succeeded pair (nothing measured)', () => {
    expect(extractPairSample([pair({ state: 'checking' }), cand('relay')])).toBeNull();
    expect(extractPairSample([])).toBeNull();
    expect(extractPairSample(null)).toBeNull();
  });
});

describe('call sample counters', () => {
  it('accumulates lifetime and monthly totals with a byte share', () => {
    const st = memStats();
    st.noteCallSample({ seconds: 60, relayed: true, bytes: 3_000_000 });
    st.noteCallSample({ seconds: 120, relayed: false, bytes: 1_000_000 });
    const turn = st.snapshot().turn;
    expect(turn.calls).toBe(2);
    expect(turn.callSeconds).toBe(180);
    expect(turn.relaySeconds).toBe(60);
    expect(turn.mRelayShare).toBeCloseTo(0.75);
    expect(turn.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('the monthly window rolls over without erasing lifetime totals', () => {
    const m = new Map();
    const st = createP2pStats({ load: (k) => m.get(k) || null, save: (k, v) => m.set(k, v) });
    m.set('brz-turn-usage', { month: '2020-01', calls: 5, callSeconds: 500, relayCalls: 5, relaySeconds: 500, relayBytes: 900, totalBytes: 1000, mCallSeconds: 500, mRelaySeconds: 500, mRelayBytes: 900, mTotalBytes: 1000 });
    st.noteCallSample({ seconds: 10, relayed: false, bytes: 100 });
    const turn = st.snapshot().turn;
    expect(turn.calls).toBe(6); // lifetime kept
    expect(turn.mTotalBytes).toBe(100); // monthly reset
    expect(turn.mRelayShare).toBe(0);
  });

  it('ignores malformed samples', () => {
    const st = memStats();
    st.noteCallSample(null);
    st.noteCallSample({ seconds: -5, bytes: NaN });
    expect(st.snapshot().turn.calls).toBe(1); // the object sample counts once, values floored to 0
    expect(st.snapshot().turn.mRelayShare).toBeNull();
  });
});

describe('worker: TURN issuance budget', () => {
  const turnReq = () => apiRequest('/api/turn', {});

  it('open-relay issuance is counted; past the cap the answer is STUN-only plus the flag', async () => {
    const env = makeEnv({ TURN_REQUIRE_AUTH: 'false', TURN_MONTHLY_ISSUE_CAP: '1' });
    const first = await (await handleTurn({ userId: 'u'.repeat(12) }, env, turnReq())).json();
    expect(first.provider).toBe('openrelay');
    const second = await (await handleTurn({ userId: 'u'.repeat(12) }, env, turnReq())).json();
    expect(second.provider).toBe('none');
    expect(second.turnQuota.exceeded).toBe(true);
    expect(second.iceServers.every(s => String(s.urls).startsWith('stun:'))).toBe(true);
  });

  it('no cap configured means issuance is never refused', async () => {
    const env = makeEnv({ TURN_REQUIRE_AUTH: 'false' });
    for (let i = 0; i < 3; i++) {
      const r = await (await handleTurn({ userId: 'u'.repeat(12) }, env, turnReq())).json();
      expect(r.provider).toBe('openrelay');
    }
  });

  it('health reports the budget state', () => {
    expect(worker).toContain('turnIssuedThisMonth: await turnIssueCount(env)');
    expect(worker).toContain('turnIssueCap: parseInt(env.TURN_MONTHLY_ISSUE_CAP) || 0');
  });
});

describe('stage 6 step 3 client wiring', () => {
  it('both call paths sample before closing the pc', () => {
    expect(callJs).toContain('D.noteCallSample?.(_callPC,');
    expect(gcallJs).toContain('D.noteCallSample?.(leg.pc,');
    expect(html.split('noteCallSample: (pc, seconds) => _p2pStats?.sampleCall(pc, seconds),').length - 1).toBe(2);
    expect(html).toContain('extractPairSample } from \'./src/app/p2p-stats.js\';');
  });

  it('a spent budget is announced to the user', () => {
    const turn = readFileSync(new URL('../src/app/turn.js', import.meta.url), 'utf8');
    expect(turn).toContain('cred?.turnQuota?.exceeded');
    expect(turn).toContain("D.showToast(D.t('toastTurnQuota'), 'error', 9000);");
    expect(html).toContain('_turnFetch?.fetchCredentials();');
    expect(sw).toContain("'/src/app/turn.js'");
  });

  it('/security shows the measured TURN share', () => {
    expect(panels).toContain('_turnUseLine');
    expect(panels).toContain("D.t('secTurnUsage')");
  });
});
