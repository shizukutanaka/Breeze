import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const RC = SRC.match(/async function renderContacts\(\) \{[\s\S]+?\n  \}\n/)[0];

describe('dead-context contact-list writes on account switch', () => {
  it('renderContacts returns immediately on an aborted context', () => {
    // First statement must be the abort guard — _renderContactsThrottled's
    // module-level throttle timer and dc.onclose both fire after the switch.
    expect(RC).toContain('async function renderContacts() { if (_ac.signal.aborted) return;');
    expect(RC.indexOf('_ac.signal.aborted')).toBeLessThan(RC.indexOf('msg-contacts'));
  });
  it('re-checks the signal after the contacts read — a mid-flight render must not land stale data', () => {
    expect(RC).toContain("await dbGetAll('contacts'); if (_ac.signal.aborted) return;");
    expect(RC.indexOf('_ac.signal.aborted')).toBeLessThan(RC.indexOf('dbGetAll'));
    expect(RC.indexOf('dbGetAll')).toBeLessThan(RC.lastIndexOf('_ac.signal.aborted'));
  });
  it('guard references the per-init AbortController declared inside initMessenger', () => {
    expect(SRC.indexOf('const _ac = new AbortController()')).toBeLessThan(SRC.indexOf('function renderContacts()'));
  });
  it('functional: the shipped guard shape suppresses the list write once aborted', () => {
    const render = new Function('_ac', 'dbGetAll', 'el', "if (_ac.signal.aborted) return; return dbGetAll('contacts').then(() => { if (_ac.signal.aborted) return; el.push('stale'); });");
    const ac = new AbortController();
    const el = [];
    // Aborted before entry — nothing runs.
    ac.abort();
    render(ac, async () => ['c'], el);
    // Live entry, abort during the read — continuation must bail.
    const ac2 = new AbortController();
    const el2 = [];
    return render(ac2, async () => { ac2.abort(); return ['c']; }, el2).then(() => {
      expect(el).toEqual([]);
      expect(el2).toEqual([]);
    });
  });
});
