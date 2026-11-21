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
