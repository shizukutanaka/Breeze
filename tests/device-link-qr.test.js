// SHARE_PLAN stage 4 step 2 — device linking without copy-paste.
// /link showed the device key as text only, and both halves of the
// ceremony (primary adds the key, secondary binds to the root) took a
// pasted base64 string. The step replaced the paste with the existing
// QR display/scan machinery while keeping the trust anchor unchanged:
// the shared linkDevicePub / linkToRoot are called verbatim by both
// the paste commands and the scan callbacks, so a scanned key runs
// the identical checks and the identical signed registry write.
// Since the stage 5 step 5 line-budget pass the ceremony lives in
// src/app/device-link.js; these pins follow it there and keep the
// construction honest in the deployed files.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mod = readFileSync(new URL('../src/app/device-link.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('device link QR wiring (module construction)', () => {
  it('defines the two shared link functions exactly once, in the module', () => {
    expect(mod.match(/async function linkDevicePub\(/g)).toHaveLength(1);
    expect(mod.match(/async function linkToRoot\(/g)).toHaveLength(1);
    expect(html).not.toContain('async function _linkDevicePub(');
    expect(html).not.toContain('async function _linkToRoot(');
  });

  it('the dispatcher delegates the four device commands to the module', () => {
    expect(html).toContain('await _deviceLink?.handleCommand(val);');
    expect(html).toContain("window.__breezeDeviceLink = { createDeviceLink };");
    expect(sw).toContain("'/src/app/device-link.js'");
  });

  it('the paste commands delegate to the shared functions', () => {
    expect(mod).toContain('await linkDevicePub(arg);');
    expect(mod).toContain('if (rootPub) { await linkToRoot(rootPub); return; }');
  });

  it('the signed registry write lives in the shared function, not the handlers', () => {
    const start = mod.indexOf('async function linkDevicePub(');
    const end = mod.indexOf('async function linkToRoot(');
    const body = mod.slice(start, end);
    expect(body).toContain("D.postAPIRaw('/device/set'");
    expect(body).toContain('breeze-device-set:');
    expect(body).toContain('D.signMessage');
  });

  it('/link panel renders the device key as a QR and offers the primary-side scan', () => {
    expect(mod).toContain('globalThis.__breezeQR?.generateQR(D.myPubB64())');
    expect(mod).toContain("D.deviceScanButton('devScanAdd', (v) => { linkDevicePub(v); })");
  });

  it('/linkto without an argument opens a scan panel for the root code', () => {
    expect(mod).toContain("if (val === '/linkto' || val.startsWith('/linkto ')) {");
    expect(mod).toContain("D.deviceScanButton('devScanRoot', (v) => { linkToRoot(v); })");
  });

  it('the scan button follows the rendezvous availability rule', () => {
    const start = html.indexOf('function _deviceScanButton(');
    const body = html.slice(start, start + 1600);
    expect(body).toContain("typeof BarcodeDetector !== 'undefined'");
    expect(body).toContain("t('rvScanUnavailable')");
    expect(body).toContain('__breezeQR.startScan');
  });

  it('the new strings exist in English and Japanese', () => {
    for (const key of ['devScanAdd', 'devScanRoot', 'devLinkToTitle', 'devLinkToHint']) {
      expect(html, `en ${key}`).toContain(key + ':');
    }
    const ja = JSON.parse(readFileSync(new URL('../locales/ja.json', import.meta.url), 'utf8'));
    for (const key of ['devScanAdd', 'devScanRoot', 'devLinkToTitle', 'devLinkToHint']) {
      expect(typeof ja[key], `ja ${key}`).toBe('string');
      expect(ja[key].length, `ja ${key}`).toBeGreaterThan(3);
    }
  });
});
