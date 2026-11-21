// Wave-1 defect fixes (2026-11-21 ledger) — client-side wiring pins.
//
// The worker-side halves of D06/D15/D14 live in worker.test.js /
// recovery-simple.test.js / presence tests, where the handlers can be
// driven directly. The client halves live inside index.html's monolith
// closure, which no harness executes whole; following the repo's wiring-pin
// convention (share-surface / history-wiring), these tests pin the exact
// source shapes the fixes rely on, so a refactor that silently drops one
// fails here instead of in production.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const infoPanels = readFileSync(new URL('../src/app/info-panels.js', import.meta.url), 'utf8');
const callJs = readFileSync(new URL('../src/app/call.js', import.meta.url), 'utf8');
const LOCALES = ['es', 'id', 'ja', 'ko', 'pt-BR', 'th', 'zh-TW'];

describe('D19 — image-send previews carry alt text', () => {
  it('the shared preview builder renders the img with an alt attribute', () => {
    expect(html).toContain('class="i-img-preview" alt="${esc(altText)}"');
  });

  it('no i-img-preview img remains without alt', () => {
    for (const m of html.matchAll(/<img[^>]*i-img-preview[^>]*>/g)) {
      expect(m[0]).toContain('alt=');
    }
  });

  it('both paste and drag-drop flows route through the shared builder', () => {
    expect(html.match(/_confirmImageSend\(/g)?.length).toBeGreaterThanOrEqual(3); // def + 2 call sites
  });
});

describe('D14 — device-list caches expire fast and yield to presence-pushed revisions', () => {
  it('all three device caches use the 1-minute TTL (was 5 minutes)', () => {
    expect(html).toContain('now - contact._devCacheTs < MS.MIN');
    expect(html).toContain('now - _myDevCacheTs < MS.MIN');
    expect(html).toContain('Date.now() - devs.ts > MS.MIN');
    expect(html).not.toContain('_devCacheTs < 5 * MS.MIN');
    expect(html).not.toContain('_myDevCacheTs < 5 * MS.MIN');
  });

  it('the registry fetch returns the signed revision ts and tracks our own', () => {
    expect(html).toContain('return { list: rec.devices.map(d => d.pub), ts: rec.ts || 0 };');
    expect(html).toContain('if (accountId === myId && rec.ts) _ownRegistryTs = rec.ts;');
  });

  it('the presence beat advertises our registry revision', () => {
    expect(html).toContain('devTs: _ownRegistryTs || undefined');
  });

  it('the presence poll invalidates both caches on a newer advertised revision', () => {
    expect(html).toContain('if (d.devTs) for (const c of contacts)');
    expect(html).toContain('_attribDevCache.delete(c.id)');
  });
});

describe('D20 — persistence failures are recorded, not swallowed', () => {
  it('the dead-letter store failure logs and bumps the diagnostics counter', () => {
    expect(html).toContain("catch(e) { _dbg(e, 'dead-letter-store'); _diagBump('deadLetterStoreFail'); }");
  });

  it('the retry-queue restore failure logs and bumps the diagnostics counter', () => {
    expect(html).toContain("catch(e) { _dbg(e, 'retry-restore'); _diagBump('retryRestoreFail'); }");
  });

  it('/security surfaces the counters via secDiagPersist (all locales)', () => {
    expect(infoPanels).toContain("D.t('secDiagPersist')");
    expect(html).toContain('secDiagPersist:');
    for (const loc of LOCALES) {
      const json = JSON.parse(readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8'));
      expect(typeof json.secDiagPersist, loc).toBe('string');
    }
  });
});

describe('D18 — reply-preview close control is a real button', () => {
  it('no span carries the close-reply action anymore', () => {
    expect(html).not.toMatch(/<span[^>]*data-action="close-reply"/);
  });

  it('both preview builders emit a labelled button (delegated handler unchanged)', () => {
    const buttons = html.match(/<button type="button"[^>]*data-action="close-reply"[^>]*aria-label="\$\{esc\(t\('close'\)\)\}"/g) || [];
    expect(buttons.length).toBe(2);
    expect(html).toContain("e.target.closest('[data-action=\"close-reply\"]')");
  });
});

describe('D10 — fresh installs default to relay-only; own STUN leads the ICE list', () => {
  it('fresh-install default is relayOnly: true', () => {
    expect(html).toMatch(/relayOnly:\s*true,/);
    expect(html).not.toMatch(/relayOnly:\s*false,/);
  });

  it("the relay's own STUN is in the default ICE list (call module + stub)", () => {
    expect(callJs).toContain("stun:stun.cloudflare.com:3478");
    expect(html).toContain("stun:stun.cloudflare.com:3478");
    // …and it precedes the third-party entries in the call module's list.
    expect(callJs.indexOf('stun.cloudflare.com')).toBeLessThan(callJs.indexOf('stun.l.google.com'));
  });
});

describe('D01 — read receipts delayed by default; sealed-sender note is honest', () => {
  it('fresh-install default holds read receipts for 120s', () => {
    expect(html).toMatch(/readReceiptDelay:\s*120,/);
    expect(html).not.toMatch(/readReceiptDelay:\s*0,/);
  });

  it('/security renders the sealed-sender ≠ unlinkability note', () => {
    expect(infoPanels).toContain("D.t('secSealedSenderNote')");
  });

  it('secSealedSenderNote exists in en (inline) and every shipped locale', () => {
    expect(html).toContain('secSealedSenderNote:');
    for (const loc of LOCALES) {
      const json = JSON.parse(readFileSync(new URL(`../locales/${loc}.json`, import.meta.url), 'utf8'));
      expect(typeof json.secSealedSenderNote, loc).toBe('string');
      expect(json.secSealedSenderNote.length, loc).toBeGreaterThan(20);
    }
  });
});
