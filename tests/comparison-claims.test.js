// SHARE_PLAN stage 7 step 1 — the public comparison page cannot
// silently go stale. docs/COMPARISON.md makes load-bearing claims
// about the code (group maximum, call-signalling default, PQ
// default, group-call cap, self-hosting, import formats); these
// pins tie each claim to the code fact it rests on, so a code
// change that invalidates a claim fails the suite until the page
// is updated with it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const html = read('index.html');
const page = read('docs/COMPARISON.md');

describe('comparison page claims match the code', () => {
  it('group maximum 1,000', () => {
    expect(html).toContain('GROUP_MAX: 1000');
    expect(page).toContain('groups up to 1,000');
  });

  it('call signalling is E2EE by default', () => {
    expect(html).toContain('CALL_E2E_SIGNAL: true');
    expect(page).toContain('Call signalling is end-to-end encrypted by default');
  });

  it('post-quantum is on by default', () => {
    expect(html).toContain('PQXDH_ENABLED: true,');
    expect(page).toContain('On by default: PQXDH');
  });

  it('group calls cap at 8, mesh', () => {
    expect(read('src/app/group-call.js')).toContain('GCALL_MAX_PARTICIPANTS = 8');
    expect(page).toContain('group voice calls up to 8');
  });

  it('self-hosting with a registration allowlist exists', () => {
    expect(read('_worker.js')).toContain('REGISTRATION_ALLOWLIST');
    expect(page).toContain('registration can be closed with an allowlist');
  });

  it('the three import parsers exist', () => {
    const parsers = read('src/app/import-parsers.js');
    for (const fn of ['parseLINE', 'parseWhatsApp', 'parseTelegram']) expect(parsers).toContain(`export function ${fn}`);
    expect(page).toContain('LINE / WhatsApp / Telegram exports');
  });

  it('the page states its losses and the audit status honestly', () => {
    expect(page).toContain('Where Breeze loses');
    expect(page).toContain('has **not** had an independent');
    expect(page).toContain('external audit. Treat it accordingly.');
    expect(page).toContain('how to check every claim');
  });
});
