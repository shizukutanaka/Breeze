// Receive-side file gating: sender-side isBlockedFile/isBlockedMagicBytes only stop OUR
// client from attaching — a malicious peer crafts {type:'file',name,mime,data} directly
// on the wire. The ingest path must re-check extension + magic bytes, and the render
// path must not offer a download link for a stored blocked-extension name.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('receive-side file gate (peer-crafted payloads)', () => {
  it('shares one signature checker between send and receive paths', () => {
    expect(html).toMatch(/function _hasDangerousSig\(buf\)/);
    expect(html).toMatch(/isBlockedMagicBytes[\s\S]*?_hasDangerousSig/); // send path uses it
    expect(html).toMatch(/_hasDangerousSig\(head\)/); // receive path uses it
  });

  it('ingest drops a blocked-extension name before storing', () => {
    const gate = html.match(/if \(typeof _fp\.name === 'string' && isBlockedFile\(_fp\.name\)\) return;/);
    expect(gate, 'blocked-extension check missing on the incoming file path').toBeTruthy();
    // the gate must run before the IDB write
    const gateIdx = html.indexOf("isBlockedFile(_fp.name)) return;");
    const storeIdx = html.indexOf("storedFileData = _localFile ? { ..._fp, blob: msg.fileBytes } : fileMsg;");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(storeIdx);
  });

  it('ingest checks magic bytes from both wire sources (base64 + P2P fileBytes)', () => {
    const head = html.match(/const head = _localFile && msg\.fileBytes \? msg\.fileBytes\.slice\(0, 8\) : Uint8Array\.from\(atob\(\(_fp\.data \|\| ''\)\.slice\(0, 12\)\)/);
    expect(head, 'magic-byte check must cover base64 and P2P-binary payloads').toBeTruthy();
  });

  it('render side offers no download link for a stored blocked-extension name', () => {
    expect(html).toMatch(/if \(href && !\(f\.name && isBlockedFile\(f\.name\)\)\) \{/);
  });

  it('invariant: the gate is inside the incoming msg.isFile handler', () => {
    const fileIdx = html.indexOf('if (msg.isFile)');
    const gateIdx = html.indexOf('Receive-side file gate');
    expect(fileIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(fileIdx);
  });
});
