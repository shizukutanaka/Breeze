import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// Power saving (emergency design phase 1): the decision logic lives inline in
// index.html next to _adaptiveConfig. Extract it verbatim and exercise it —
// listening is throttled by battery, sending never is.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('power-mode markers moved');
  return html.slice(a, b);
}
const block = slice('const _powerState', '\nfunction _updateNetInfo()');
const create = new Function('MS', '_settings', 'navigator', '_dbg',
  block + '\nreturn { _powerState, _powerModeFromBattery, _effectivePowerMode, _powerPollFloorMs, _powerPresenceOff };');

function harness(powerMode = 'auto') {
  return create({ MIN: 60000 }, { powerMode }, {}, () => {});
}

describe('power mode — auto follows the battery', () => {
  it('no battery info resolves to normal', () => {
    const p = harness();
    expect(p._effectivePowerMode()).toBe('normal');
    expect(p._powerPollFloorMs()).toBe(0);
    expect(p._powerPresenceOff()).toBe(false);
  });
  it('>50% is normal, 50% boundary drops to saver', () => {
    const p = harness();
    p._powerState.level = 0.8;
    expect(p._effectivePowerMode()).toBe('normal');
    p._powerState.level = 0.5;
    expect(p._effectivePowerMode()).toBe('saver');
    expect(p._powerPollFloorMs()).toBe(60000);
    expect(p._powerPresenceOff()).toBe(true);
  });
  it('20% boundary drops to emergency with a 10-minute floor', () => {
    const p = harness();
    p._powerState.level = 0.35;
    expect(p._effectivePowerMode()).toBe('saver');
    p._powerState.level = 0.2;
    expect(p._effectivePowerMode()).toBe('emergency');
    expect(p._powerPollFloorMs()).toBe(600000);
    p._powerState.level = 0.05;
    expect(p._effectivePowerMode()).toBe('emergency');
  });
  it('charging steps one level back toward normal', () => {
    const p = harness();
    p._powerState.level = 0.1; p._powerState.charging = true;
    expect(p._effectivePowerMode()).toBe('saver');
    p._powerState.level = 0.35;
    expect(p._effectivePowerMode()).toBe('normal');
    p._powerState.level = 0.9;
    expect(p._effectivePowerMode()).toBe('normal');
  });
});

describe('power mode — manual setting wins over the battery', () => {
  it('manual emergency applies on a full battery', () => {
    const p = harness('emergency');
    p._powerState.level = 0.95;
    expect(p._effectivePowerMode()).toBe('emergency');
    expect(p._powerPollFloorMs()).toBe(600000);
  });
  it('manual normal ignores a nearly empty battery', () => {
    const p = harness('normal');
    p._powerState.level = 0.05;
    expect(p._effectivePowerMode()).toBe('normal');
    expect(p._powerPresenceOff()).toBe(false);
  });
  it('manual saver floors polling at one minute', () => {
    const p = harness('saver');
    expect(p._powerPollFloorMs()).toBe(60000);
    expect(p._powerPresenceOff()).toBe(true);
  });
  it('an unknown stored value falls back to auto', () => {
    const p = harness('bogus');
    p._powerState.level = 0.1;
    expect(p._effectivePowerMode()).toBe('emergency');
  });
});

// The presence CHECK is listening, not sending, so the same power gate applies.
// Slice the deployed polling loop and drive it with the real power-mode helpers.
const pollingBlock = slice('  function startPresencePolling() {', '\n  startPresencePolling();');
const createPolling = new Function(
  'API', 'dbGetAll', 'peers', '_presenceCache', '_lastSeenCache', 'renderContacts', 'postAPIRaw', '_dbg', '_devRegTs',
  '_attribDevCache', 'deliverPeerRelayQueue', 'connectPeer', 'CONFIG', '_intervals',
  'setInterval', '_powerPresenceOff',
  pollingBlock + '\nreturn startPresencePolling;');

function presenceHarness(settings) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const postAPIRaw = vi.fn(async () => ({ ok: true, json: async () => ({ online: { c1: true } }) }));
  const timers = [];
  const renderContacts = vi.fn();
  const start = createPolling(
    'https://api.test',
    async () => [{ id: 'c1', pubB64: 'pub1', isGroup: false }],
    {},
    {},
    {},
    renderContacts,
    postAPIRaw,
    () => {},
    {},
    new Map(),
    () => {},
    () => {},
    { PRESENCE_INTERVAL_MS: 30000 },
    [],
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    power._powerPresenceOff,
  );
  start();
  return { postAPIRaw, renderContacts, timers };
}
async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('power mode — presence checks', () => {
  it('skips the /presence request in saver and emergency, then resumes live in normal', async () => {
    const settings = { powerMode: 'saver' };
    const h = presenceHarness(settings);
    await flushMicrotasks();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(30000);
    expect(h.renderContacts).toHaveBeenCalled();
    expect(h.postAPIRaw).not.toHaveBeenCalled();

    await h.timers[0].fn();
    expect(h.postAPIRaw).not.toHaveBeenCalled();

    settings.powerMode = 'normal';
    await h.timers[0].fn();
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.postAPIRaw).toHaveBeenLastCalledWith('/presence', { ids: ['c1'], check: true });

    settings.powerMode = 'emergency';
    await h.timers[0].fn();
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps the immediate check in normal mode', async () => {
    const h = presenceHarness({ powerMode: 'normal' });
    await flushMicrotasks();
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.postAPIRaw).toHaveBeenLastCalledWith('/presence', { ids: ['c1'], check: true });
  });
});
