import { describe, it, expect, vi, afterEach } from 'vitest';
import jsQR from 'jsqr';
import { readFileSync } from 'node:fs';
import { encodeQR, createQRHelper } from '../src/app/qr.js';

function decode(text) {
  const result = encodeQR(text), scale = 4, margin = 4;
  const size = result.modules.length, width = (size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!result.modules[y][x]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const p = (((y + margin) * scale + dy) * width + (x + margin) * scale + dx) * 4;
      pixels[p] = pixels[p + 1] = pixels[p + 2] = 0;
    }
  }
  expect(jsQR(pixels, width, width)?.data).toBe(text);
  return result;
}

describe('ISO QR encoder and real decoder', () => {
  it('round-trips existing invite URLs, UTF-8 and empty data', () => {
    for (const value of ['', 'https://breeze.example/?add=' + 'a'.repeat(44), '連絡先を追加 🌬️']) decode(value);
  });
  it('round-trips measured browser offer/answer codes at ECC M', () => {
    // Gathered browser envelopes (host + srflx offer); public, expired test identities only.
    const codes = JSON.parse(readFileSync(new URL('./vectors/rendezvous-codes.json', import.meta.url)));
    for (const code of Object.values(codes)) {
      const qr = decode(code);
      expect(qr.ecc).toBe('M');
      expect(qr.version).toBeLessThanOrEqual(30);
      expect(code.length).toBeGreaterThan(900);
    }
  });
  it('round-trips multi-block, alignment and version-information boundaries', () => {
    for (const length of [100, 200, 400, 700, 1100, 1500, 2000, 2331]) {
      decode(Array.from({ length }, (_, i) => String.fromCharCode(33 + (i * 31) % 90)).join(''));
    }
  }, 20_000);
  it('never truncates oversized input, including UTF-8 byte count', () => {
    expect(() => encodeQR('x'.repeat(2332))).toThrow('rvQRTooLarge');
    expect(() => encodeQR('界'.repeat(778))).toThrow('rvQRTooLarge');
  });
});

function node(tag = 'div') {
  return { tag, children: [], removed: false, disabled: false,
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.append(child); if (child.tag === 'video') queueMicrotask(() => child.onloadedmetadata()); },
    remove() { this.removed = true; },
  };
}
afterEach(() => vi.unstubAllGlobals());
function scannerHarness() {
  const tracks = [{ stop: vi.fn() }], stream = { getTracks: () => tracks };
  const container = node(), onResult = vi.fn(), onError = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  vi.stubGlobal('document', { createElement: tag => node(tag) });
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 0));
  vi.stubGlobal('cancelAnimationFrame', id => clearTimeout(id));
  vi.stubGlobal('BarcodeDetector', class { async detect() { return [{ rawValue: 'breeze-sdp1z:raw' }]; } });
  return { tracks, container, onResult, onError };
}
describe('camera raw-value callback and cleanup', () => {
  it('delivers a non-invite raw value and stops camera/video', async () => {
    const h = scannerHarness();
    createQRHelper().startScan(h);
    await vi.waitFor(() => expect(h.onResult).toHaveBeenCalledWith('breeze-sdp1z:raw'));
    expect(h.tracks[0].stop).toHaveBeenCalledOnce(); expect(h.container.children[0].removed).toBe(true);
    expect(h.onError).not.toHaveBeenCalled();
  });
  it('keeps scanning empty frames until a value arrives', async () => {
    const h = scannerHarness(); let count = 0;
    vi.stubGlobal('BarcodeDetector', class { async detect() { return ++count === 1 ? [] : [{ rawValue: 'next' }]; } });
    createQRHelper().startScan(h);
    await vi.waitFor(() => expect(h.onResult).toHaveBeenCalledWith('next'));
    expect(count).toBe(2);
  });
  it('surfaces permission and detector errors, stopping acquired tracks', async () => {
    const h = scannerHarness();
    vi.stubGlobal('BarcodeDetector', class { async detect() { throw new Error('detector'); } });
    createQRHelper().startScan(h);
    await vi.waitFor(() => expect(h.onError).toHaveBeenCalledOnce());
    expect(h.tracks[0].stop).toHaveBeenCalledOnce();
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('permission'));
    createQRHelper().startScan(h);
    await vi.waitFor(() => expect(h.onError).toHaveBeenCalledTimes(2));
  });
  it('stops a stream acquired after the caller cancels', async () => {
    const h = scannerHarness(); let finish;
    navigator.mediaDevices.getUserMedia.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const stop = createQRHelper().startScan(h); stop();
    finish({ getTracks: () => h.tracks });
    await vi.waitFor(() => expect(h.tracks[0].stop).toHaveBeenCalledOnce());
    expect(h.onResult).not.toHaveBeenCalled(); expect(h.container.children).toHaveLength(0);
  });
  it('invite QR oversize retains copy/paste and invite scan still navigates', async () => {
    scannerHarness();
    const body = node();
    Object.assign(document, { body, addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('window', { location: { href: '' } });
    vi.stubGlobal('t', key => key); vi.stubGlobal('showToast', vi.fn()); vi.stubGlobal('_dbg', vi.fn());
    const helper = createQRHelper(); helper.showQRModal('x'.repeat(2332));
    const card = body.children[0].children[0];
    expect(card.children.find(child => child.textContent === 'rvQRTooLarge')).toBeTruthy();
    expect(card.children.find(child => child.textContent === 'uiCopyLink')).toBeTruthy();
    vi.stubGlobal('BarcodeDetector', class { async detect() { return [{ rawValue: 'https://breeze.example/?add=abc' }]; } });
    card.children.find(child => child.textContent === 'scanQR').onclick();
    await vi.waitFor(() => expect(window.location.href).toBe('https://breeze.example/?add=abc'));
  });
  // A scanned code is attacker-supplied. With the app's handler wired, the value goes
  // to the in-app add flow and the page never navigates; without one, only http(s)
  // may be navigated to.
  function openModal(onScan) {
    scannerHarness();
    const body = node();
    Object.assign(document, { body, addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('window', { location: { href: '' } });
    const showToast = vi.fn();
    vi.stubGlobal('t', key => key); vi.stubGlobal('showToast', showToast); vi.stubGlobal('_dbg', vi.fn());
    createQRHelper().showQRModal('x'.repeat(2332), onScan);
    return { card: body.children[0].children[0], showToast };
  }
  const scanValue = (card, rawValue) => {
    vi.stubGlobal('BarcodeDetector', class { async detect() { return [{ rawValue }]; } });
    card.children.find(child => child.textContent === 'scanQR').onclick();
  };
  it('hands a scanned invite to the in-app handler instead of navigating', async () => {
    const onScan = vi.fn();
    const { card } = openModal(onScan);
    scanValue(card, 'https://evil.example/?add=abc');
    await vi.waitFor(() => expect(onScan).toHaveBeenCalledWith('https://evil.example/?add=abc'));
    expect(window.location.href).toBe('');
  });
  it.each(['javascript:alert(1)//?add=abc', 'data:text/html,<p>?add=abc', 'intent://x?add=abc'])(
    'never navigates to a non-http(s) scanned value: %s', async (value) => {
      const { card, showToast } = openModal();
      scanValue(card, value);
      await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('toastInvalidQR', 'error'));
      expect(window.location.href).toBe('');
    });
});
