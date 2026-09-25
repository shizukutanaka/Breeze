// Regression test: receive-side executable block (round 120).
// The send side blocks executables via isBlockedMagicBytes, but every receive path
// stored peer-supplied file bytes without re-checking magic bytes — a modified client
// ships an EXE straight to a download link. The fix: shared _isDangerousBytes +
// _dangerousB64 helpers, enforced on the 1:1 file path (chunked + base64) and the
// group fileDataG path.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');

function extract(fnName) {
  const re = new RegExp(`function ${fnName}\\([^)]*\\) \\{[^\\n]*\\n?`, 'm');
  const m = src.match(re);
  // Absent helper (pre-fix) → stub so each test fails individually rather than the file aborting.
  if (!m) return `function ${fnName}() { return undefined; }`;
  return m[0];
}

const env = `
  const DANGEROUS_SIGNATURES = [
    [0x4D, 0x5A],
    [0x7F, 0x45, 0x4C, 0x46],
    [0x23, 0x21],
  ];
  ${extract('_isDangerousBytes')}
  ${extract('_dangerousB64')}
`;
const mk = (body) => new Function(env + body);

const MZ = btoa(String.fromCharCode(0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00));
const PNG = btoa(String.fromCharCode(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A));

describe('receive-side executable block', () => {
  it('_isDangerousBytes flags MZ/ELF/shebang, passes images and null', () => {
    const f = mk('return (buf) => _isDangerousBytes(buf);')();
    expect(f(new Uint8Array([0x4D, 0x5A, 0x90]))).toBe(true);
    expect(f(new Uint8Array([0x7F, 0x45, 0x4C, 0x46]))).toBe(true);
    expect(f(new Uint8Array([0x89, 0x50, 0x4E, 0x47]))).toBe(false);
    expect(f(null)).toBe(false);
    expect(f(undefined)).toBe(false);
  });

  it('_dangerousB64 decodes and checks; invalid b64 is not dangerous', () => {
    const f = mk('return (s) => _dangerousB64(s);')();
    expect(f(MZ + 'AAAA')).toBe(true);
    expect(f(PNG + 'AAAA')).toBe(false);
    expect(f('%%%not-base64%%%')).toBe(false);
    expect(f('')).toBe(false);
  });

  it('1:1 file path drops a chunked EXE (fileBytes)', () => {
    const cond = src.match(/if \(_isDangerousBytes\(_localFile \? msg\.fileBytes : null\) \|\| \(typeof _fp\.data === 'string' && _dangerousB64\(_fp\.data\)\)\) \{ showToast\(t\('blockedFileType'\), 'error'\); return; \}/);
    expect(cond).toBeTruthy();
    const sim = mk(`
      let dropped = false;
      const showToast = () => { dropped = true; };
      const t = (k) => k;
      return ({_localFile, msg, _fp}) => {
        if (_isDangerousBytes(_localFile ? msg.fileBytes : null) || (typeof _fp.data === 'string' && _dangerousB64(_fp.data))) { showToast(t('blockedFileType'), 'error'); return 'DROPPED'; }
        return 'STORED';
      };
    `)();
    const exeBytes = new Uint8Array([0x4D, 0x5A, 0x90, 0, 3, 0, 0, 0]);
    expect(sim({_localFile: true, msg: {fileBytes: exeBytes}, _fp: {name: 'x.exe'}})).toBe('DROPPED');
    expect(sim({_localFile: true, msg: {fileBytes: new Uint8Array([0x89,0x50,0x4E,0x47])}, _fp: {name: 'x.png'}})).toBe('STORED');
    expect(sim({_localFile: false, msg: {}, _fp: {data: MZ}})).toBe('DROPPED');
    expect(sim({_localFile: false, msg: {}, _fp: {data: PNG}})).toBe('STORED');
  });

  it('group fileDataG path drops an executable payload', () => {
    const cond = src.match(/if \(fileDataG && _dangerousB64\(fileDataG\.data\)\) \{ showToast\(t\('blockedFileType'\), 'error'\); return; \}/);
    expect(cond).toBeTruthy();
    const sim = mk(`
      const showToast = () => {};
      const t = (k) => k;
      return (fileDataG) => {
        if (fileDataG && _dangerousB64(fileDataG.data)) { showToast(t('blockedFileType'), 'error'); return 'DROPPED'; }
        return 'STORED';
      };
    `)();
    expect(sim({name: 'evil.exe', data: MZ})).toBe('DROPPED');
    expect(sim({name: 'ok.png', data: PNG})).toBe('STORED');
    expect(sim(null)).toBe('STORED');
  });

  it('pins: send-side still calls isBlockedMagicBytes at 3+ sites and it delegates to _isDangerousBytes', () => {
    expect((src.match(/isBlockedMagicBytes\(file\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/async function isBlockedMagicBytes\(file\) \{\s*try \{ return _isDangerousBytes/);
  });

  it('pins: receive checks use the existing i18n key + toast', () => {
    expect(src).toContain("_dangerousB64(_fp.data))) { showToast(t('blockedFileType'), 'error'); return; }");
    expect(src).toContain("_dangerousB64(fileDataG.data)) { showToast(t('blockedFileType'), 'error'); return; }");
  });
});
