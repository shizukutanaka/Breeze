import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGroupCreate } from '../src/app/group-create.js';

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
  'setInterval', 'setTimeout', '_powerPresenceOff', '_powerPollFloorMs',
  'let _presencePollTimer = null;\n' + pollingBlock + '\nreturn startPresencePolling;');

function presenceHarness(settings) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const postAPIRaw = vi.fn(async () => ({ ok: true, json: async () => ({ online: { c1: true } }) }));
  const dbGetAll = vi.fn(async () => [{ id: 'c1', pubB64: 'pub1', isGroup: false }]);
  const timers = [];
  const renderContacts = vi.fn();
  const start = createPolling(
    'https://api.test',
    dbGetAll,
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
    (fn, ms) => { timers.push({ fn, ms, type: 'interval' }); return timers.length; },
    (fn, ms) => { timers.push({ fn, ms, type: 'timeout' }); return timers.length; },
    power._powerPresenceOff,
    power._powerPollFloorMs,
  );
  start();
  return { postAPIRaw, dbGetAll, renderContacts, timers };
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
    expect(h.timers[0].ms).toBe(60000);
    // The pre-fix request-only gate still read IndexedDB and re-rendered in saver;
    // presence polling must now return before every one of those side effects.
    expect(h.dbGetAll).not.toHaveBeenCalled();
    expect(h.renderContacts).not.toHaveBeenCalled();
    expect(h.postAPIRaw).not.toHaveBeenCalled();

    await h.timers[0].fn();
    expect(h.dbGetAll).not.toHaveBeenCalled();
    expect(h.renderContacts).not.toHaveBeenCalled();
    expect(h.postAPIRaw).not.toHaveBeenCalled();

    settings.powerMode = 'normal';
    await h.timers.at(-1).fn();
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.postAPIRaw).toHaveBeenLastCalledWith('/presence', { ids: ['c1'], check: true });
    const dbCallsInNormal = h.dbGetAll.mock.calls.length;
    const renderCallsInNormal = h.renderContacts.mock.calls.length;

    settings.powerMode = 'emergency';
    await h.timers.at(-1).fn();
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.dbGetAll).toHaveBeenCalledTimes(dbCallsInNormal);
    expect(h.renderContacts).toHaveBeenCalledTimes(renderCallsInNormal);
  });

  it('keeps the immediate check in normal mode', async () => {
    const h = presenceHarness({ powerMode: 'normal' });
    await flushMicrotasks();
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.postAPIRaw).toHaveBeenLastCalledWith('/presence', { ids: ['c1'], check: true });
  });

  it.each([
    ['normal', 30000],
    ['saver', 60000],
    ['emergency', 600000],
  ])('schedules the first tick in %s mode at %i ms', async (mode, ms) => {
    const h = presenceHarness({ powerMode: mode });
    await flushMicrotasks();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(ms);
    expect(h.timers[0].type).toBe('timeout');
  });

  it('reschedules through emergency and re-evaluates back down to normal', async () => {
    const settings = { powerMode: 'emergency' };
    const h = presenceHarness(settings);
    await flushMicrotasks();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(600000);

    await h.timers[0].fn();
    expect(h.timers).toHaveLength(2);
    expect(h.timers[1].ms).toBe(600000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();

    settings.powerMode = 'normal';
    await h.timers[1].fn();
    expect(h.timers).toHaveLength(3);
    expect(h.timers[2].ms).toBe(30000);
  });

  it('keeps the chain alive when a poll tick throws', async () => {
    const h = presenceHarness({ powerMode: 'normal' });
    await flushMicrotasks();
    h.dbGetAll.mockRejectedValueOnce(Error('idb unavailable'));
    await h.timers[0].fn();
    expect(h.timers).toHaveLength(2);
    expect(h.timers[1].ms).toBe(30000);
  });

  it('clears the chain timer explicitly on account switch', () => {
    const cleanup = slice('_messengerCleanup = () => {', '\n      // Discard this account');
    expect(cleanup).toContain('if (_presencePollTimer) { clearTimeout(_presencePollTimer); _presencePollTimer = null; }');
  });
});

const networkBlock = slice('  // ===== v3.3: Network quality tracking =====', '\n  // ===== Share ID');
const createNetworkQuality = new Function(
  'API', '_isOffline', 'fetchT', '_DOM', 'activeContact', 'peers', '_intervals',
  'setInterval', 'MS', '_powerPresenceOff',
  networkBlock + '\nreturn measureNetworkQuality;');

function networkHarness(settings) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const fetchT = vi.fn(async () => ({ ok: true }));
  const timers = [];
  const measure = createNetworkQuality(
    'https://api.test',
    false,
    fetchT,
    { get: () => null },
    null,
    {},
    [],
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    { MIN: 60000 },
    power._powerPresenceOff,
  );
  return { fetchT, timers, measure };
}

describe('power mode — network quality probe', () => {
  it('skips only the periodic /health probe outside normal mode, re-evaluates every tick, and keeps direct calls live', async () => {
    const settings = { powerMode: 'emergency' };
    const h = networkHarness(settings);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(60000);

    h.timers[0].fn();
    await flushMicrotasks();
    expect(h.fetchT).not.toHaveBeenCalled();

    await h.measure();
    expect(h.fetchT).toHaveBeenCalledTimes(1);
    expect(h.fetchT.mock.calls[0][0]).toBe('https://api.test/health');

    settings.powerMode = 'normal';
    h.timers[0].fn();
    await flushMicrotasks();
    expect(h.fetchT).toHaveBeenCalledTimes(2);

    settings.powerMode = 'saver';
    h.timers[0].fn();
    await flushMicrotasks();
    expect(h.fetchT).toHaveBeenCalledTimes(2);
  });
});

const signalPollBlock = slice('  function startSignalPoll(', '\n  async function connectPeer(');
function signalPollHarness(floor, poll = vi.fn(async () => false)) {
  const start = new Function('MS', '_dbg', '_powerPollFloorMs',
    signalPollBlock + '\nreturn startSignalPoll;')({ SEC: 1000, MIN: 60000 }, () => {}, () => floor);
  return { controller: start(poll, () => false), poll };
}

describe('power mode — signal poll discovery floor', () => {
  it('holds the not-connected discovery loop at the floor instead of the backoff cadence', async () => {
    vi.useFakeTimers();
    try {
      const h = signalPollHarness(600000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(h.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(58000);
      expect(h.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(541999);
      expect(h.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(h.poll).toHaveBeenCalledTimes(2);
      h.controller.stop();
    } finally { vi.useRealTimers(); }
  });

  it('keeps the two-second active discovery cadence when the floor is zero', async () => {
    vi.useFakeTimers();
    try {
      const h = signalPollHarness(0, vi.fn(async () => true));
      await vi.advanceTimersByTimeAsync(2000);
      expect(h.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1999);
      expect(h.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(h.poll).toHaveBeenCalledTimes(2);
      h.controller.stop();
    } finally { vi.useRealTimers(); }
  });

  it('keeps wake immediate while a floor is set', async () => {
    vi.useFakeTimers();
    try {
      const h = signalPollHarness(600000);
      await vi.advanceTimersByTimeAsync(2000);
      expect(h.poll).toHaveBeenCalledTimes(1);
      h.controller.wake();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.poll).toHaveBeenCalledTimes(2);
      h.controller.stop();
    } finally { vi.useRealTimers(); }
  });

  it('applies the floor to a failed not-connected retry but not to a connected retry', async () => {
    vi.useFakeTimers();
    try {
      const offline = signalPollHarness(600000, vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(false));
      await vi.advanceTimersByTimeAsync(2000);
      expect(offline.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(58000);
      expect(offline.poll).toHaveBeenCalledTimes(1);
      offline.controller.stop();

      const connected = signalPollHarness(600000, vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(false));
      connected.controller.setConnected(true);
      await vi.advanceTimersByTimeAsync(15000);
      expect(connected.poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(connected.poll).toHaveBeenCalledTimes(2);
      connected.controller.stop();
    } finally { vi.useRealTimers(); }
  });
});


function lineContaining(needle) {
  const at = html.indexOf(needle);
  if (at < 0) throw Error('device-alerts registration moved');
  const start = html.lastIndexOf('\n', at) + 1;
  const end = html.indexOf('\n', at);
  return html.slice(start, end < 0 ? undefined : end).trim();
}

// The device-alerts check is periodic network work, so its one-minute timer must
// honour the same power gate as the network-quality probe. Extract the deployed
// registration line verbatim and drive its ticks with the real power-mode helpers.
const deviceAlertsRegistration = lineContaining('_deviceAlerts?.check(); _intervals.push(setInterval(');
const runDeviceAlertsRegistration = new Function(
  '_deviceAlerts', '_intervals', 'setInterval', 'MS', '_powerPresenceOff',
  deviceAlertsRegistration + '\nreturn true;');

function deviceAlertsHarness(settings) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const check = vi.fn();
  const timers = [];
  runDeviceAlertsRegistration(
    { check },
    [],
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    { MIN: 60000 },
    power._powerPresenceOff,
  );
  return { check, timers };
}

describe('power mode — device alerts check', () => {
  it('skips only the periodic tick outside normal mode and re-evaluates every tick', () => {
    const settings = { powerMode: 'emergency' };
    const h = deviceAlertsHarness(settings);
    expect(h.check).toHaveBeenCalledTimes(1);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(60000);

    h.timers[0].fn();
    expect(h.check).toHaveBeenCalledTimes(1);

    settings.powerMode = 'normal';
    h.timers[0].fn();
    expect(h.check).toHaveBeenCalledTimes(2);

    settings.powerMode = 'saver';
    h.timers[0].fn();
    expect(h.check).toHaveBeenCalledTimes(2);
  });

  it('keeps the immediate session-start call direct, ungated, and ahead of the timer', () => {
    const directCall = deviceAlertsRegistration.indexOf('_deviceAlerts?.check();');
    const timer = deviceAlertsRegistration.indexOf('setInterval(');
    expect(directCall).toBe(0);
    expect(timer).toBeGreaterThan(directCall);
    expect(deviceAlertsRegistration.slice(0, timer)).not.toContain('_powerPresenceOff');

    const h = deviceAlertsHarness({ powerMode: 'emergency' });
    expect(h.check).toHaveBeenCalledTimes(1);
  });
});

// The disappearing-message cleanup is local periodic work, but it still wakes the
// CPU and scans the whole message store. Slice the deployed registration verbatim
// and drive its self-rescheduling chain with the real power-mode helpers.
const disappearBlock = slice('  // Disappearing message cleanup: run every 10s', '\n\n  // GROUP CHAT');
const runDisappearRegistration = new Function(
  'setTimeout', 'db', 'activeContact', '_DOM', '_dbg', 'CONFIG', '_powerPresenceOff', '_powerPollFloorMs', '_vault',
  'let _disappearCleanupTimer = null;\n' + disappearBlock + '\nreturn { pendingTimer: () => _disappearCleanupTimer };');

function disappearHarness(settings, rows = [], ui = null) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const timers = [];
  const store = {
    getAll: vi.fn(() => {
      const req = {
        result: rows,
        set onsuccess(fn) { queueMicrotask(() => fn()); },
        set onerror(fn) {},
      };
      return req;
    }),
    delete: vi.fn(),
  };
  const db = {
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => store),
    })),
  };
  const registration = runDisappearRegistration(
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    db,
    ui?.activeContact || null,
    ui?.dom || { get: () => null },
    vi.fn(),
    { DISAPPEAR_CHECK_MS: 10000, FADE_OUT_MS: 250 },
    power._powerPresenceOff,
    power._powerPollFloorMs,
    { isBlocked: () => false },
  );
  return { timers, db, store, registration };
}

describe('power mode — disappearing message cleanup', () => {
  it.each([
    ['normal', 10000],
    ['saver', 60000],
    ['emergency', 600000],
  ])('schedules the first tick in %s mode at %i ms', (mode, ms) => {
    const h = disappearHarness({ powerMode: mode });
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(ms);
    expect(h.db.transaction).not.toHaveBeenCalled();
  });

  it.each(['saver', 'emergency'])('performs no db work in %s mode, even over multiple ticks', async (mode) => {
    const h = disappearHarness({ powerMode: mode });
    expect(h.timers).toHaveLength(1);

    await h.timers[0].fn();
    expect(h.timers).toHaveLength(2);
    await h.timers[1].fn();
    expect(h.timers).toHaveLength(3);
    await flushMicrotasks();

    expect(h.db.transaction).not.toHaveBeenCalled();
    expect(h.store.getAll).not.toHaveBeenCalled();
    expect(h.store.delete).not.toHaveBeenCalled();
  });

  it('re-evaluates the delay after every tick when the mode changes', async () => {
    const settings = { powerMode: 'emergency' };
    const h = disappearHarness(settings);
    expect(h.timers[0].ms).toBe(600000);

    await h.timers[0].fn();
    expect(h.timers).toHaveLength(2);
    expect(h.timers[1].ms).toBe(600000);
    expect(h.db.transaction).not.toHaveBeenCalled();

    settings.powerMode = 'normal';
    await h.timers[1].fn();
    expect(h.timers).toHaveLength(3);
    expect(h.timers[2].ms).toBe(10000);
    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.db.transaction).toHaveBeenLastCalledWith('messages', 'readwrite');
  });

  it('still deletes only expired messages in normal mode', async () => {
    const now = Date.now();
    const h = disappearHarness({ powerMode: 'normal' }, [
      { msgId: 'expired', disappearAt: now - 1 },
      { msgId: 'unexpired', disappearAt: now + 60000 },
      { msgId: 'plain' },
    ]);

    await h.timers[0].fn();

    expect(h.db.transaction).toHaveBeenCalledTimes(1);
    expect(h.db.transaction).toHaveBeenLastCalledWith('messages', 'readwrite');
    expect(h.store.getAll).toHaveBeenCalledTimes(1);
    expect(h.store.delete).toHaveBeenCalledTimes(1);
    expect(h.store.delete).toHaveBeenLastCalledWith('expired');
  });

  it('keeps the chain alive when a tick throws', async () => {
    const h = disappearHarness({ powerMode: 'normal' }, [], {
      activeContact: { id: 'c1' },
      dom: { get: () => ({ querySelectorAll() { throw Error('dom gone'); } }) },
    });

    await expect(h.timers[0].fn()).rejects.toThrow('dom gone');
    expect(h.timers).toHaveLength(2);
    expect(h.timers[1].ms).toBe(10000);
  });

  it('clears the chain timer explicitly on account switch', () => {
    const cleanup = slice('_messengerCleanup = () => {', '\n      // Discard this account');
    expect(cleanup).toContain('if (_disappearCleanupTimer) { clearTimeout(_disappearCleanupTimer); _disappearCleanupTimer = null; }');
  });
});


describe('power mode — group member poll', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function groupPollHarness(powerOff, powerFloorMs) {
    const groupId = 'g_test';
    const postAPIRaw = vi.fn(() => ({ ok: true, json: async () => ({ members: [] }) }));
    const delays = [];
    const deps = {
      hasApi: () => true,
      postAPIRaw,
      dbGet: async () => ({ id: groupId, members: [{ id: 'me' }] }),
      pushInterval: () => {},
      minMs: () => 60000,
      myId: () => 'me',
      dbg: () => {},
    };
    if (powerOff) deps.powerOff = powerOff;
    if (powerFloorMs) deps.powerFloorMs = powerFloorMs;
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...args) => {
      delays.push(ms);
      return originalSetTimeout(fn, ms, ...args);
    };
    try {
      createGroupCreate(deps).startGroupMemberPoll('token123', groupId);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    return { postAPIRaw, delays };
  }

  it('never calls /group/info while power mode keeps background presence off', async () => {
    vi.useFakeTimers();
    const h = groupPollHarness(() => true);
    await vi.advanceTimersByTimeAsync(20000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();
  });

  it('calls /group/info on the normal tick when power is on', async () => {
    vi.useFakeTimers();
    const h = groupPollHarness(() => false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'token123' });
  });

  it('keeps polling when the optional powerOff dep is absent', async () => {
    vi.useFakeTimers();
    const h = groupPollHarness();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'token123' });
  });

  it('schedules the first wake at the saver floor while the power gate stays on', async () => {
    vi.useFakeTimers();
    const h = groupPollHarness(() => true, () => 60000);
    expect(h.delays[0]).toBe(60000);
    await vi.advanceTimersByTimeAsync(20000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();
  });

  it('waits for the saver floor before the first /group/info call when power is on', async () => {
    vi.useFakeTimers();
    const h = groupPollHarness(() => false, () => 60000);
    expect(h.delays[0]).toBe(60000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40000);
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'token123' });
  });

  it('waits for the emergency floor before the first /group/info call', async () => {
    vi.useFakeTimers();
    const h = groupPollHarness(() => false, () => 600000);
    expect(h.delays[0]).toBe(600000);
    await vi.advanceTimersByTimeAsync(60000);
    expect(h.postAPIRaw).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(540000);
    expect(h.postAPIRaw).toHaveBeenCalledTimes(1);
    expect(h.postAPIRaw).toHaveBeenCalledWith('/group/info', { token: 'token123' });
  });

  it('wires the deployed power-presence gate and poll floor into the group-create deps', () => {
    const depsBlock = slice('globalThis.__breezeGroupCreate?.createGroupCreate({', '\n  });');
    expect(depsBlock).toContain('powerOff: () => _powerPresenceOff()');
    expect(depsBlock).toContain('hasApi: () => (globalThis.__brzApiReady?.() ?? !!API), powerOff: () => _powerPresenceOff(), powerFloorMs: () => _powerPollFloorMs(),');
  });
});

// The focus-mode countdown banner is display-only — expiry is enforced by the
// _focusActive() timestamp checks in _shouldAlert, not by this timer — so its
// self-rescheduling setTimeout chain is pure wake cost. Extract the deployed
// _updateFocusBanner verbatim and drive it with a controllable power floor.
const focusBannerBlock = slice('  function _updateFocusBanner() {', '\n\n  // ═══ Quiet messenger');

function focusBannerHarness(floor) {
  const state = { active: true };
  const timers = [];
  const bar = {
    classList: { add: vi.fn(), remove: vi.fn() },
    textContent: '',
    onclick: null,
  };
  const run = new Function(
    '_DOM', '_focusActive', '_settings', '_focusRemainingMin', 't', 'MS',
    'setTimeout', 'clearTimeout', 'saveSettings', 'showToast', '_powerPollFloorMs',
    'let _focusTimer = null;\n' + focusBannerBlock + '\nreturn { update: _updateFocusBanner };',
  );
  const { update } = run(
    { get: () => bar },
    () => state.active,
    { focusStrict: false, focusUntil: 0 },
    () => 42,
    (key) => key,
    { MIN: 60000 },
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    () => {},
    async () => {},
    () => {},
    () => floor,
  );
  update();
  return { state, timers, bar, update };
}

describe('power mode — focus banner countdown floor', () => {
  it('reschedules every minute in normal mode (floor 0)', () => {
    const h = focusBannerHarness(0);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(60000);
  });

  it('reschedules every minute in saver mode (floor MS.MIN)', () => {
    const h = focusBannerHarness(60000);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(60000);
  });

  it('stretches the reschedule to ten minutes in emergency mode', () => {
    const h = focusBannerHarness(600000);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(600000);
  });

  it('keeps the chain alive in emergency mode — the timer is rescheduled, not skipped', () => {
    const h = focusBannerHarness(600000);
    expect(h.timers).toHaveLength(1);
    expect(typeof h.timers[0].fn).toBe('function');
    h.timers[0].fn();
    expect(h.timers).toHaveLength(2);
    expect(h.timers[1].ms).toBe(600000);
  });

  it('schedules no timer and deactivates the banner when focus is inactive', () => {
    const h = focusBannerHarness(600000);
    expect(h.timers).toHaveLength(1); // active run still reschedules
    h.state.active = false;
    h.timers.length = 0;
    h.update();
    expect(h.timers).toHaveLength(0);
    expect(h.bar.classList.remove).toHaveBeenCalledWith('active');
    expect(h.bar.textContent).toBe('');
  });
});
// The conversation-status refresh is display-only periodic work bundled into
// the presence heartbeat tick. Extract the deployed tick line verbatim and
// drive it with the real power helpers.
const presenceTickRegistration = lineContaining('_presenceTimer = setTimeout(() => { if (!_powerPresenceOff()) { beat();');
const runPresenceTickRegistration = new Function(
  '_presenceTimer', 'setTimeout', 'document', 'CONFIG', 'interval', '_powerPresenceOff', 'beat', 'activeContact', 'updateConvStatus', 'schedulePresence',
  presenceTickRegistration + '\nreturn true;');

function presenceTickHarness(settings) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const beat = vi.fn();
  const updateConvStatus = vi.fn();
  const schedulePresence = vi.fn();
  const activeContact = { id: 'c1' };
  const timers = [];
  let interval = 30000;
  runPresenceTickRegistration(
    null,
    (fn, ms) => { timers.push({ fn, ms }); return 1; },
    { hidden: false },
    { PRESENCE_INTERVAL_MS: 30000, PRESENCE_BG_INTERVAL_MS: 120000 },
    interval,
    power._powerPresenceOff,
    beat,
    activeContact,
    updateConvStatus,
    schedulePresence,
  );
  return { beat, updateConvStatus, schedulePresence, activeContact, timers };
}

describe('power mode — presence tick conversation status', () => {
  it('skips beat and the status refresh outside normal mode while continuing to re-schedule', () => {
    const settings = { powerMode: 'emergency' };
    const h = presenceTickHarness(settings);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(30000);

    h.timers[0].fn();
    h.timers[0].fn();
    h.timers[0].fn();
    expect(h.beat).not.toHaveBeenCalled();
    expect(h.updateConvStatus).not.toHaveBeenCalled();
    expect(h.schedulePresence).toHaveBeenCalledTimes(3);

    settings.powerMode = 'normal';
    h.timers[0].fn();
    expect(h.beat).toHaveBeenCalledTimes(1);
    expect(h.updateConvStatus).toHaveBeenCalledTimes(1);
    expect(h.updateConvStatus).toHaveBeenLastCalledWith(h.activeContact);
    expect(h.schedulePresence).toHaveBeenCalledTimes(4);

    settings.powerMode = 'saver';
    h.timers[0].fn();
    h.timers[0].fn();
    expect(h.beat).toHaveBeenCalledTimes(1);
    expect(h.updateConvStatus).toHaveBeenCalledTimes(1);
    expect(h.schedulePresence).toHaveBeenCalledTimes(6);
  });

  it('keeps every tick live in normal mode', () => {
    const h = presenceTickHarness({ powerMode: 'normal' });
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(30000);

    h.timers[0].fn();
    h.timers[0].fn();
    h.timers[0].fn();
    expect(h.beat).toHaveBeenCalledTimes(3);
    expect(h.updateConvStatus).toHaveBeenCalledTimes(3);
    expect(h.updateConvStatus).toHaveBeenNthCalledWith(1, h.activeContact);
    expect(h.updateConvStatus).toHaveBeenNthCalledWith(2, h.activeContact);
    expect(h.updateConvStatus).toHaveBeenNthCalledWith(3, h.activeContact);
    expect(h.schedulePresence).toHaveBeenCalledTimes(3);
  });
});

// The heartbeat interval itself is wake-up cost: even when the tick body is
// power-gated, a short self-rescheduling chain still wakes the CPU just to check
// the gate. Extract the deployed schedulePresence verbatim and drive it with the
// real power helpers, mutable visibility, and controllable timers.
const presenceScheduleBlock = slice('    function schedulePresence() {', '\n    schedulePresence();');
const createPresenceSchedule = new Function(
  'document', 'CONFIG', 'setTimeout', 'clearTimeout', '_powerPresenceOff', '_powerPollFloorMs', 'beat', 'activeContact', 'updateConvStatus',
  'let _presenceTimer = null;\n' + presenceScheduleBlock + '\nreturn schedulePresence;');

function presenceScheduleHarness(settings, hidden = false) {
  const power = create({ MIN: 60000 }, settings, {}, () => {});
  const timers = [];
  let nextTimer = 0;
  const beat = vi.fn();
  const updateConvStatus = vi.fn();
  const schedule = createPresenceSchedule(
    { hidden },
    { PRESENCE_INTERVAL_MS: 30000, PRESENCE_BG_INTERVAL_MS: 120000 },
    (fn, ms) => { timers.push({ fn, ms }); return ++nextTimer; },
    vi.fn(),
    power._powerPresenceOff,
    power._powerPollFloorMs,
    beat,
    null,
    updateConvStatus,
  );
  schedule();
  return { beat, updateConvStatus, timers };
}

describe('power mode — presence heartbeat schedule floor', () => {
  it('keeps the 30-second foreground and 120-second background intervals in normal mode', () => {
    const foreground = presenceScheduleHarness({ powerMode: 'normal' });
    expect(foreground.timers).toHaveLength(1);
    expect(foreground.timers[0].ms).toBe(30000);

    const background = presenceScheduleHarness({ powerMode: 'normal' }, true);
    expect(background.timers).toHaveLength(1);
    expect(background.timers[0].ms).toBe(120000);
  });

  it('floors the foreground interval at one minute in saver mode while background stays at two minutes', () => {
    const foreground = presenceScheduleHarness({ powerMode: 'saver' });
    expect(foreground.timers).toHaveLength(1);
    expect(foreground.timers[0].ms).toBe(60000);

    const background = presenceScheduleHarness({ powerMode: 'saver' }, true);
    expect(background.timers).toHaveLength(1);
    expect(background.timers[0].ms).toBe(120000);
  });

  it('floors foreground and background intervals at ten minutes in emergency mode', () => {
    const foreground = presenceScheduleHarness({ powerMode: 'emergency' });
    expect(foreground.timers).toHaveLength(1);
    expect(foreground.timers[0].ms).toBe(600000);

    const background = presenceScheduleHarness({ powerMode: 'emergency' }, true);
    expect(background.timers).toHaveLength(1);
    expect(background.timers[0].ms).toBe(600000);
  });

  it('keeps the chain alive outside normal mode and re-evaluates the interval after returning to normal', () => {
    const settings = { powerMode: 'emergency' };
    const h = presenceScheduleHarness(settings);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(600000);

    h.timers[0].fn();
    expect(h.timers).toHaveLength(2);
    expect(h.timers[1].ms).toBe(600000);
    expect(h.beat).not.toHaveBeenCalled();
    expect(h.updateConvStatus).not.toHaveBeenCalled();

    settings.powerMode = 'normal';
    h.timers[1].fn();
    expect(h.timers).toHaveLength(3);
    expect(h.timers[2].ms).toBe(30000);
    expect(h.beat).toHaveBeenCalledTimes(1);
  });
});

// The per-message disappearing countdown is display-only — expiry is enforced by
// the gated DB sweep above — but each rendered message owns a self-rescheduling
// timer chain. Extract the deployed updateCountdown closure verbatim and drive it
// with controlled clocks, timers, DOM nodes, and power floors.
const countdownBlock = slice('        const updateCountdown = () => {', '\n        requestAnimationFrame(() => setTimeout(updateCountdown, MS.SEC));');
const createCountdown = new Function(
  '_DOM', 'CONFIG', 'MS', 'setTimeout', 'requestAnimationFrame', 'timerId', 'disappearAt', 'Date', '_powerPollFloorMs',
  countdownBlock + '\nreturn { updateCountdown };');

function countdownHarness(floor, remainingMs) {
  const now = 1000000;
  const timeouts = [];
  const msgEl = { classList: { add: vi.fn() }, remove: vi.fn() };
  const badge = {
    textContent: '',
    classList: { add: vi.fn() },
    closest: vi.fn(() => msgEl),
  };
  const { updateCountdown } = createCountdown(
    { get: vi.fn(() => badge) },
    { FADE_OUT_MS: 250 },
    { SEC: 1000, MIN: 60000 },
    (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
    () => 1,
    'ttl-test',
    now + remainingMs,
    { now: () => now },
    () => floor,
  );
  updateCountdown();
  return { timeouts, badge, msgEl };
}

describe('power mode — disappearing message countdown floor', () => {
  it('keeps the 30-second reschedule in normal mode while more than a minute remains', () => {
    const h = countdownHarness(0, 120000);
    expect(h.timeouts).toHaveLength(1);
    expect(h.timeouts[0].ms).toBe(30000);
  });

  it('keeps the one-second reschedule in normal mode during the final minute', () => {
    const h = countdownHarness(0, 60000);
    expect(h.timeouts).toHaveLength(1);
    expect(h.timeouts[0].ms).toBe(1000);
  });

  it('stretches the reschedule to one minute in saver mode', () => {
    const h = countdownHarness(60000, 120000);
    expect(h.timeouts).toHaveLength(1);
    expect(h.timeouts[0].ms).toBe(60000);
  });

  it('stretches the reschedule to ten minutes in emergency mode', () => {
    const h = countdownHarness(600000, 120000);
    expect(h.timeouts).toHaveLength(1);
    expect(h.timeouts[0].ms).toBe(600000);
  });

  it('keeps the chain alive in emergency mode — each tick reschedules rather than stopping', () => {
    const h = countdownHarness(600000, 120000);
    expect(h.timeouts).toHaveLength(1);
    expect(typeof h.timeouts[0].fn).toBe('function');
    h.timeouts[0].fn();
    expect(h.timeouts).toHaveLength(2);
    expect(h.timeouts[1].ms).toBe(600000);
  });

  it('still takes the expiry fade-out path when no time remains', () => {
    const h = countdownHarness(600000, -1);
    expect(h.badge.closest).toHaveBeenCalledWith('.msg');
    expect(h.msgEl.classList.add).toHaveBeenCalledWith('fade-out');
    expect(h.timeouts).toHaveLength(1);
    expect(h.timeouts[0].ms).toBe(250);
    h.timeouts[0].fn();
    expect(h.msgEl.remove).toHaveBeenCalledTimes(1);
  });
});
