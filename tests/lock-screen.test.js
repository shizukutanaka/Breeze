// The /lock screen used to be a <div> appended over the app and nothing else. Two ways
// past it without the password were reproduced in a real browser (tests/e2e/lock.spec.js
// drives the same two against the shipped page):
//   1. reload — the locked state lived only in the DOM, so the app booted unlocked;
//   2. Tab — focus walked to the composer behind the overlay, where '/lock reset'
//      deleted the lock password.
// These tests run the real showLockScreen() sliced out of index.html against a minimal
// DOM/localStorage, plus pins on the two wiring sites the slice cannot execute.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function slice(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

const SRC = slice('  function showLockScreen() {', '  // v3.3: Auto-lock on tab hide');
const ITERATIONS = 1000; // the real constant only costs time here

function makeEl(tag) {
  const listeners = {};
  return {
    tagName: tag.toUpperCase(), id: '', className: '', value: '', disabled: false,
    children: [], attrs: {}, isConnected: false, open: false, modalCalls: 0,
    classList: { add() {}, remove() {} },
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    fire(type, ev = {}) { (listeners[type] || []).forEach((fn) => fn(ev)); return ev; },
    showModal() { this.open = true; this.modalCalls++; },
    remove() { this.isConnected = false; this.open = false; env.shown = null; },
    focus() {},
  };
}

let env;
function boot() {
  const created = [];
  const fn = new Function(
    'document', 'localStorage', '_DOM', '_showDialog', 'safeSetHTML', '_iconSlot', 'esc', 't', 'crypto',
    'CONFIG', 'MS', 'auditLog', '_dbg', 'setTimeout', 'TextEncoder', 'btoa', 'atob',
    `${SRC}\n return showLockScreen;`
  );
  const show = fn(
    { createElement: (tag) => { const el = makeEl(tag); created.push(el); return el; } },
    env.storage,
    { get: (id) => (id === 'lock-screen' ? env.shown : null) },
    (dlg) => { dlg.isConnected = true; dlg.showModal(); env.shown = dlg; },
    () => {}, () => '', (s) => s, (k) => k, webcrypto,
    { PBKDF2_ITERATIONS: ITERATIONS, FOCUS_DELAY_MS: 0 }, { SEC: 1000, MIN: 60000 },
    () => {}, () => {}, () => 0, TextEncoder, btoa, atob
  );
  show();
  const overlay = env.shown;
  return overlay && { overlay, inp: overlay.children[0], btn: overlay.children[1] };
}

async function setPassword(pass) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const km = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, km, 256);
  env.storage.setItem('brz-lock-hash', JSON.stringify({
    hash: btoa(String.fromCharCode(...new Uint8Array(bits))),
    salt: btoa(String.fromCharCode(...salt)),
  }));
}

async function tryPassword(ui, pass) {
  ui.inp.value = pass;
  await ui.btn.onclick();
}

beforeEach(async () => {
  const map = new Map();
  env = {
    shown: null,
    storage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); },
    },
  };
  await setPassword('correct horse');
});

describe('lock screen cannot be dropped without the password', () => {
  it('is a modal <dialog> (inert background), not a covering <div>', () => {
    const ui = boot();
    expect(ui.overlay.tagName).toBe('DIALOG');
    expect(ui.overlay.id).toBe('lock-screen');
    expect(ui.overlay.open).toBe(true);
    expect(ui.overlay.modalCalls).toBe(1);
  });

  it('Esc does not dismiss it, and a forced close re-opens it', () => {
    const ui = boot();
    let prevented = false;
    ui.overlay.fire('cancel', { preventDefault() { prevented = true; } });
    expect(prevented).toBe(true);
    ui.overlay.open = false;
    ui.overlay.fire('close');
    expect(ui.overlay.open).toBe(true);
  });

  it('keeps document-level shortcuts from running behind it, except panic wipe', () => {
    const ui = boot();
    const key = (ev) => {
      let stopped = false;
      ui.overlay.fire('keydown', { ...ev, stopPropagation() { stopped = true; } });
      return stopped;
    };
    expect(key({ key: '?' })).toBe(true);
    expect(key({ key: 'k', ctrlKey: true })).toBe(true);
    expect(key({ key: 'Backspace', ctrlKey: true, shiftKey: true })).toBe(false);
  });

  it('persists the locked state, and only the right password clears it', async () => {
    const ui = boot();
    expect(env.storage.getItem('brz-locked')).not.toBeNull();
    await tryPassword(ui, 'wrong');
    expect(env.shown).toBe(ui.overlay);
    expect(env.storage.getItem('brz-locked')).not.toBeNull();
    await tryPassword(ui, 'correct horse');
    expect(env.shown).toBeNull();
    expect(env.storage.getItem('brz-locked')).toBeNull();
  });

  it('a reload re-shows the lock with the failed-attempt backoff intact', async () => {
    const first = boot();
    for (let i = 0; i < 5; i++) await tryPassword(first, 'wrong');
    const held = JSON.parse(env.storage.getItem('brz-locked'));
    expect(held.n).toBe(5);
    expect(held.until).toBeGreaterThan(Date.now());

    env.shown = null; // the page is gone; only localStorage survives
    const second = boot();
    expect(second.overlay).not.toBe(first.overlay);
    await tryPassword(second, 'correct horse'); // still inside the backoff window
    expect(env.shown).toBe(second.overlay);
    expect(second.inp.disabled).toBe(true);
    expect(env.storage.getItem('brz-locked')).not.toBeNull();
  });

  it('does nothing when no lock password is set', () => {
    env.storage.removeItem('brz-lock-hash');
    env.storage.setItem('brz-locked', '{"n":0,"until":0}');
    expect(boot()).toBeNull();
  });
});

describe('lock screen wiring', () => {
  it('initMessenger restores the lock before anything else runs', () => {
    const head = slice('async function initMessenger(dbName) {', 'await _appModulesReady');
    expect(head).toMatch(/localStorage\.getItem\('brz-locked'\)\)\s*showLockScreen\(\)/);
  });

  it('/lock reset clears the persisted locked state with the password', () => {
    const reset = slice("if (val === '/lock reset') {", "auditLog('security', 'Lock password removed')");
    expect(reset).toContain("localStorage.removeItem('brz-lock-hash')");
    expect(reset).toContain("localStorage.removeItem('brz-locked')");
  });
});
