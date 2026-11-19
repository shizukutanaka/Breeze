// SHARE_PLAN stage 4 step 2 — device linking without copy-paste.
// /link showed the device key as text only, and both halves of the
// ceremony (primary adds the key, secondary binds to the root) took a
// pasted base64 string. The step replaces the paste with the existing
// QR display/scan machinery while keeping the trust anchor unchanged:
// the extracted _linkDevicePub / _linkToRoot are called verbatim by
// both the paste commands and the scan callbacks, so a scanned key
// runs the identical checks and the identical signed registry write.
// These pins keep that construction honest in the deployed file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('device link QR wiring (deployed inline)', () => {
  it('defines the two shared link functions exactly once', () => {
    expect(html.match(/async function _linkDevicePub\(/g)).toHaveLength(1);
    expect(html.match(/async function _linkToRoot\(/g)).toHaveLength(1);
  });

  it('the paste commands delegate to the shared functions', () => {
    expect(html).toContain('await _linkDevicePub(arg);');
    expect(html).toContain('await _linkToRoot(rootPub);');
  });

  it('the signed registry write lives in the shared function, not the handlers', () => {
    const start = html.indexOf('async function _linkDevicePub(');
    const end = html.indexOf('async function _linkToRoot(');
    const body = html.slice(start, end);
    expect(body).toContain("postAPIRaw('/device/set'");
    expect(body).toContain('breeze-device-set:');
    expect(body).toContain('signMessage');
  });

  it('/link panel renders the device key as a QR and offers the primary-side scan', () => {
    expect(html).toContain('globalThis.__breezeQR?.generateQR(myPubB64)');
    expect(html).toContain("_deviceScanButton('devScanAdd', (v) => { _linkDevicePub(v); })");
  });

  it('/linkto without an argument opens a scan panel for the root code', () => {
    expect(html).toContain("if (val === '/linkto' || val.startsWith('/linkto ')) {");
    expect(html).toContain('if (rootPub) { await _linkToRoot(rootPub); return; }');
    expect(html).toContain("_deviceScanButton('devScanRoot', (v) => { _linkToRoot(v); })");
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
