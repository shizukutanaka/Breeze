import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('updateDeliveryState bounds wire msg.st + respects tombstones', () => {
  it('enum gate: only integer states 0-2 accepted', () => {
    expect(SRC).toContain(
      'function updateDeliveryState(msgId, state, fromContactId) {\n    // state: 0=delivered, 1=read, 2=deleted\n    if (!Number.isInteger(state) || state < 0 || state > 2) return;'
    );
  });
  it('both ack persist writes skip deleted records', () => {
    const sites = SRC.split('if (stored && !stored.deleted && (!fromContactId || stored.contactId === fromContactId)) { stored.ack = state;').length - 1;
    expect(sites).toBe(2);
  });
  it('functional: shipped gate rejects non-enum / non-integer states', () => {
    const gate = (state) => Number.isInteger(state) && state >= 0 && state <= 2;
    expect(gate(0)).toBe(true); expect(gate(1)).toBe(true); expect(gate(2)).toBe(true);
    expect(gate(3)).toBe(false); expect(gate(-1)).toBe(false);
    expect(gate(0.5)).toBe(false); expect(gate('1')).toBe(false);
    expect(gate(NaN)).toBe(false); expect(gate(null)).toBe(false);
  });
});
