// SHARE_PLAN stage 6 (client side) — relay quota refusals must be told
// apart from burst rate limits. The server has answered a spent
// fair-use budget with 429 USAGE_QUOTA_EXCEEDED all along; the client
// classified only MAILBOX_RATE_LIMITED, so a quota refusal fell through
// to the plain fallback (a second deposit against the same budget) or
// showed a "retrying in N seconds" toast for a window that resets in
// hours. src/app/quota.js is the pure half of the fix; the wiring pins
// below keep the deployed half honest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyRelayRejection, createQuotaNotice } from '../src/app/quota.js';

describe('classifyRelayRejection', () => {
  it('classifies a spent quota with its scope, limit and retry delay', () => {
    expect(classifyRelayRejection({ code: 'USAGE_QUOTA_EXCEEDED', quotaScope: 'daily', quotaLimit: 10000, retryAfter: 3600 }))
      .toEqual({ kind: 'quota', scope: 'daily', limit: 10000, retryAfterSec: 3600 });
  });

  it('tolerates a quota body with missing or garbled fields', () => {
    expect(classifyRelayRejection({ code: 'USAGE_QUOTA_EXCEEDED' }))
      .toEqual({ kind: 'quota', scope: null, limit: null, retryAfterSec: null });
    expect(classifyRelayRejection({ code: 'USAGE_QUOTA_EXCEEDED', quotaScope: 7, quotaLimit: '10000', retryAfter: 'soon' }))
      .toEqual({ kind: 'quota', scope: null, limit: null, retryAfterSec: null });
  });

  it('classifies a burst limit separately', () => {
    expect(classifyRelayRejection({ code: 'MAILBOX_RATE_LIMITED', retryAfter: 5 }))
      .toEqual({ kind: 'limited', retryAfterSec: 5 });
  });

  it('returns null for anything else, so callers keep their old fallback', () => {
    expect(classifyRelayRejection({ code: 'RATE_LIMITED' })).toBeNull();
    expect(classifyRelayRejection({})).toBeNull();
    expect(classifyRelayRejection(null)).toBeNull();
    expect(classifyRelayRejection('USAGE_QUOTA_EXCEEDED')).toBeNull();
    expect(classifyRelayRejection(undefined)).toBeNull();
  });
});

describe('createQuotaNotice', () => {
  it('shows once per episode, then again only after the cooldown', () => {
    let clock = 1000000;
    const shown = [];
    const notice = createQuotaNotice({ notify: (info) => shown.push(info), now: () => clock, cooldownMs: 3600000 });
    const info = { kind: 'quota', scope: 'daily', limit: 10000, retryAfterSec: 3600 };
    expect(notice.note(info)).toBe(true);
    expect(notice.note(info)).toBe(false);
    clock += 3599999;
    expect(notice.note(info)).toBe(false);
    clock += 1;
    expect(notice.note(info)).toBe(true);
    expect(shown).toEqual([info, info]);
  });

  it('keeps independent instances independent', () => {
    const a = [];
    const b = [];
    const na = createQuotaNotice({ notify: (i) => a.push(i), now: () => 0, cooldownMs: 1000 });
    const nb = createQuotaNotice({ notify: (i) => b.push(i), now: () => 0, cooldownMs: 1000 });
    na.note({ kind: 'quota' });
    expect(nb.note({ kind: 'quota' })).toBe(true);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});

describe('deployed wiring', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

  it('index.html imports the quota module and classifies at every deposit path', () => {
    expect(html).toContain("from './src/app/quota.js'");
    expect(html).toContain('window.__breezeQuota = { classifyRelayRejection, createQuotaNotice }');
    // _depositCopy (sealed + plain) and both primary-path 429 handlers.
    expect(html.match(/_classifyRejection\(d\)/g).length).toBe(4);
    expect(html).toContain('_noteQuota(r)');
    expect(html).toContain("t('toastQuotaExceeded')");
  });

  it('the English quota string exists and names the way out', () => {
    const line = html.split('\n').find((l) => l.includes('toastQuotaExceeded:'));
    expect(line).toBeDefined();
    expect(line).toContain('free quota is used up');
    expect(line).toContain('Home relays');
  });

  it('sw.js precaches the module like every other src/app module', () => {
    expect(sw).toContain("'/src/app/quota.js'");
  });

  it('every shipped locale carries the quota string', () => {
    for (const lang of ['ja', 'es', 'id', 'ko', 'pt-BR', 'th', 'zh-TW']) {
      const loc = JSON.parse(readFileSync(new URL(`../locales/${lang}.json`, import.meta.url), 'utf8'));
      expect(typeof loc.toastQuotaExceeded, lang).toBe('string');
      expect(loc.toastQuotaExceeded.length, lang).toBeGreaterThan(10);
    }
  });
});
