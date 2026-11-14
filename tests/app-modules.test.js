// App-module contracts: the subsystems extracted from index.html into
// src/app/ (modularization) are REAL ES modules now, so they are imported
// and exercised directly — the factory shape (deps in, names out), the
// pure parsers, the QR encoder, and the sound helper. The backup bodies'
// behaviour stays pinned by the slice suites (backup-keymaterial,
// recovery-seed, recovery-disposable, first-run-restore, data-principle),
// which now slice from src/app/backup.js; this file pins that the modules
// load, wire their deps/globals, and answer their contracts in isolation.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBackupTools } from '../src/app/backup.js';
import { createCallManager } from '../src/app/call.js';
import { createQRHelper } from '../src/app/qr.js';
import { createSoundHelper } from '../src/app/sound.js';
import { parseLINE, parseWhatsApp, parseTelegram, detectAndParse } from '../src/app/import-parsers.js';

const saved = {};
beforeAll(() => {
  // Snapshot property descriptors, not just values: `navigator` is a
  // getter-only accessor on globalThis (Node >= 21) and the sound suite
  // below redefines it via Object.defineProperty (non-writable), so a
  // plain assignment in afterAll cannot put the original back and throws
  // "Cannot assign to read only property 'navigator'". Restoring by
  // descriptor handles data and accessor globals alike.
  for (const k of ['t', '_dbg', 'showToast', 'CONFIG', 'MS', '_DOM', 'API', '_turnCredential', 'document', 'window', 'localStorage', 'navigator']) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  globalThis.t = (k) => k;
  globalThis._dbg = () => {};
  globalThis.showToast = (msg, type) => { (globalThis.__toasts ||= []).push({ msg, type }); };
  globalThis.CONFIG = { ICE_CANDIDATE_POOL_SIZE: 10, CALL_TIMEOUT_MS: 60000 };
  globalThis.MS = { SEC: 1000 };
  globalThis._DOM = { get: () => null };
  globalThis.API = '';
  globalThis._turnCredential = null;
  globalThis.document = { addEventListener: () => {}, hidden: true, createElement: () => ({ width: 0, height: 0, className: '', getContext: () => ({ fillRect: () => {} }) }) };
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: () => null };
});
afterAll(() => { for (const k of Object.keys(saved)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; } });

describe('import parsers (src/app/import-parsers.js)', () => {
  it('parses a LINE export and detects the format', () => {
    const r = detectAndParse('2024/01/15 Mon\n14:23\tAlice\tHello!');
    expect(r.source).toBe('LINE');
    expect(r.msgs).toHaveLength(1);
    expect(r.msgs[0].sender).toBe('Alice');
    expect(r.msgs[0].text).toBe('Hello!');
    expect(r.msgs[0].ts).toBe(new Date('2024-01-15T14:23:00').getTime());
  });
  it('parses a WhatsApp export', () => {
    const r = detectAndParse('1/15/24, 2:23 PM - Alice: Hi there');
    expect(r.source).toBe('WhatsApp');
    expect(r.msgs[0].sender).toBe('Alice');
  });
  it('parses a Telegram JSON export, unknown sender via t()', () => {
    const msgs = parseTelegram('{"messages":[{"type":"message","text":"yo","date":"2024-01-15T14:23:00"}]}');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe('unknown'); // t('unknown') stub returns the key
  });
  it('unrecognised text is the parsers own Unknown result', () => {
    expect(detectAndParse('just some prose')).toEqual({ source: 'Unknown', msgs: [] });
    expect(parseLINE('no dates here')).toEqual([]);
    expect(parseWhatsApp('no dates here')).toEqual([]);
    expect(parseTelegram('not json')).toEqual([]);
  });
});

describe('QR helper (src/app/qr.js)', () => {
  it('encodes a URL to a rendered canvas', () => {
    const { generateQR, showQRModal } = createQRHelper();
    expect(typeof showQRModal).toBe('function');
    const canvas = generateQR('https://breeze.example/?add=abc');
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.width).toBe(canvas.height);
  });
});

describe('sound helper (src/app/sound.js)', () => {
  it('exposes the two sounds and the haptic patterns without throwing', () => {
    const vib = [];
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (p) => vib.push(p) }, configurable: true });
    const s = createSoundHelper();
    expect(() => s.playNotif()).not.toThrow(); // no AudioContext in Node — caught inside
    expect(() => s.playSendSound()).not.toThrow();
    s.haptic.tap(); s.haptic.notify();
    expect(vib).toEqual([8, [12, 50, 8, 50, 12]]);
  });
});

describe('call manager factory (src/app/call.js)', () => {
  const deps = () => ({
    _wrapCallSignal: async () => ({}), _unwrapCallSignal: async () => null,
    _signal: () => {}, _signalAwait: async () => ({ ok: false }), relaySend: async () => {},
    _intervals: [], _ac: { signal: undefined }, _settings: {},
    myId: () => 'me000000000', myPubB64: () => 'PUB', myName: () => 'Me',
  });
  it('starts idle; ICE config is the STUN base without a TURN credential', () => {
    const m = createCallManager(deps());
    expect(m.state()).toBe('idle');
    const cfg = m.getCallICEConfig();
    expect(cfg.iceServers.length).toBe(2);
    expect(cfg.iceTransportPolicy).toBeUndefined();
    expect(() => m.endCall()).not.toThrow(); // idle endCall is a guarded no-op
    expect(m.state()).toBe('idle');
  });
  it('relay-only settings force relay transport (IP privacy mode)', () => {
    const d = deps(); d._settings.relayOnly = true;
    const m = createCallManager(d);
    expect(m.getCallICEConfig().iceTransportPolicy).toBe('relay');
  });
  it('startCall refuses groups and missing contacts before touching media', async () => {
    const m = createCallManager(deps());
    await m.startCall(null, false);
    await m.startCall({ isGroup: true, id: 'g' }, false);
    expect(m.state()).toBe('idle');
  });
});

describe('backup tools factory (src/app/backup.js)', () => {
  it('returns the seven entries and routes through deps + globals', async () => {
    globalThis.__toasts = [];
    const tools = createBackupTools({
      db: {}, dbGet: async () => null, dbPut: async () => true, dbGetAll: async () => [],
      authFields: async () => ({}), homeRelays: () => [], postAPIRelay: async () => null,
      signMessage: async () => null, myId: () => 'me000000000', adoptRestoredSigning: () => {},
    });
    for (const name of ['backupToFile', 'restoreFromFilePicker', 'restoreBackup', 'createRecoveryKit', 'restoreFromPhrase', 'createCloudBackup', 'restoreCloudBackup']) {
      expect(typeof tools[name], name).toBe('function');
    }
    await tools.backupToFile(); // no identity in the mock IDB → the no-identity toast
    expect(globalThis.__toasts).toEqual([{ msg: 'toastNoIdentityBackup', type: 'error' }]);
  });
});
