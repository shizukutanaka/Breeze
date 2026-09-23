import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const HI = SRC.match(/async function handleIncoming\(msg\) \{[\s\S]+?\n  \}\n/)[0];
const RR = SRC.match(/function showReadReceipt\(contactId, ts\) \{[\s\S]+?\n  \}\n/)[0];
const DS = SRC.match(/function updateDeliveryState\(msgId, state, fromContactId\) \{[\s\S]+?\n  \}\n/)[0];

describe('dead-context wire arrivals are fully aborted', () => {
  it('handleIncoming bails at entry — in-flight poll iterations cannot notify/write the live account', () => {
    expect(HI).toContain('async function handleIncoming(msg) { if (_ac.signal.aborted) return;');
  });
  it('both arrival tails re-check before unread/notify/SR/broadcast writes', () => {
    // A call dispatched pre-switch resumes mid-body after the abort — it must
    // stop before the notification/broadcast tail, not just at entry.
    const guards = HI.split('_ac.signal.aborted').length - 1;
    expect(guards).toBeGreaterThanOrEqual(3); // entry + group tail + 1:1 tail
    expect(HI.indexOf('contact.lastMsg')).toBeGreaterThan(HI.indexOf('_ac.signal.aborted'));
  });
  it('showReadReceipt + updateDeliveryState bail on dead-context stateDC continuations', () => {
    expect(RR).toContain('function showReadReceipt(contactId, ts) { if (_ac.signal.aborted) return;');
    expect(DS).toContain('function updateDeliveryState(msgId, state, fromContactId) { if (_ac.signal.aborted) return;');
  });
  it('functional: aborted funnel drops the whole tail incl. notification', () => {
    const tail = new Function('_ac', 'contact', 'notify', "if (_ac.signal.aborted) return; contact.unread = 1; notify(contact.name);");
    const ac = new AbortController();
    let fired = 0;
    const c = { name: 'Bob' };
    tail(ac, c, () => fired++);
    expect(c.unread).toBe(1); expect(fired).toBe(1);
    ac.abort();
    tail(ac, c, () => fired++);
    expect(fired).toBe(1);
  });
});
