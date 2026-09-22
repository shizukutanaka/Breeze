// Inbound file metadata is peer-controlled on both wire sources (P2P DataChannel — no
// server-side bound at all — and the relay's 256 KB envelope). The preview text was
// already capped (name slice 255/128), but the PERSISTED fileData record kept the raw
// payload: a hostile peer could plant an arbitrarily long name/mime that lands in IDB
// and re-renders into a giant DOM string on every paint. The persisted record must be
// normalized before dbPut, on the 1:1 path (storedFileData), the P2P-local path (blob),
// and the group path (fileDataG).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the real _capFileMeta from index.html (same slice technique as the other
// ingest-gate tests — no jsdom needed; the function is pure).
const fnSrc = html.slice(
  html.indexOf('function _capFileMeta'),
  html.indexOf('\n', html.indexOf('function _capFileMeta'))
);
const capFileMeta = new Function(fnSrc + '\nreturn _capFileMeta;')();

describe('inbound file metadata caps (persisted record, not just preview)', () => {
  it('caps name at 255 chars', () => {
    const out = capFileMeta({ type: 'file', name: 'a'.repeat(1000), data: 'x' });
    expect(out.name.length).toBe(255);
  });

  it('caps mime at 128 chars', () => {
    const out = capFileMeta({ type: 'file', name: 'n', mime: 'm'.repeat(500), data: 'x' });
    expect(out.mime.length).toBe(128);
  });

  it('defaults missing name to file and mime to empty', () => {
    const out = capFileMeta({ type: 'file', data: 'x' });
    expect(out.name).toBe('file');
    expect(out.mime).toBe('');
  });

  it('stringifies non-string peer fields (name number -> "42")', () => {
    const out = capFileMeta({ type: 'file', name: 42, mime: null });
    expect(out.name).toBe('42');
    expect(out.mime).toBe('');
  });

  it('preserves other payload fields (data, blob pass through)', () => {
    const blob = new Uint8Array([1, 2, 3]);
    const out = capFileMeta({ type: 'file', name: 'n', data: 'AAAA', blob, extra: 'e' });
    expect(out.data).toBe('AAAA');
    expect(out.blob).toBe(blob);
    expect(out.extra).toBe('e');
  });
});

describe('wire sites — every persisted fileData record goes through _capFileMeta', () => {
  it('1:1/P2P path caps _fp inside storedFileData (both branches)', () => {
    const site = html.slice(html.indexOf('storedFileData = _localFile'), html.indexOf('\n', html.indexOf('storedFileData = _localFile')));
    expect(site).toContain('_capFileMeta(_fp)');
    expect(site).not.toContain('{ ..._fp, blob'); // raw spread must be gone
  });

  it('group path caps _p into fileDataG', () => {
    expect(html).toContain('fileDataG = _capFileMeta(_p);');
  });

  it('preview-text caps unchanged (name 255 for 1:1, 128 for group)', () => {
    expect(html).toContain("_fp.name.slice(0, 255)");
    expect(html).toContain('String(_p.name).slice(0, 128)');
  });
});
