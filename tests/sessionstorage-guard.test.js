import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The openConversation shared-text block must not propagate a sessionStorage throw —
// a SecurityError would otherwise reject openConversation and the chat never opens.
const BLOCK = SRC.match(/let shared = null;[\s\S]+?shared-text'\); \} \}/)[0];
const drive = (sessionStorage, inputVal = '') => {
  const input = { value: inputVal };
  const fn = new Function('sessionStorage', '_msgInput', '_dbg',
    `${BLOCK} return { shared, input: _msgInput.value };`);
  return fn(sessionStorage, input, () => {});
};

describe('sessionStorage throw safety', () => {
  it('storage-disabled: getItem throws → openConversation continues, shared=null', () => {
    const throwing = { getItem() { throw new Error('SecurityError'); } };
    const r = drive(throwing);
    expect(r.shared).toBe(null);
    expect(r.input).toBe('');
  });
  it('stored shared text pastes into empty input', () => {
    const store = { 'brz-shared-text': 'hello' };
    const ss = { getItem: k => store[k] ?? null, removeItem: k => { delete store[k]; } };
    const r = drive(ss);
    expect(r.input).toBe('hello');
    expect(store['brz-shared-text']).toBeUndefined();
  });
  it('removeItem throw is contained after a successful paste', () => {
    const ss = { getItem: () => 'x', removeItem() { throw new Error('SecurityError'); } };
    expect(() => drive(ss)).not.toThrow();
    expect(drive(ss).input).toBe('x');
  });
  it('non-empty input is never clobbered', () => {
    const ss = { getItem: () => 'x', removeItem() {} };
    const r = drive(ss, 'typed');
    expect(r.input).toBe('typed');
  });
  it('tripwire: the converted sites stay guarded', () => {
    // openConversation shared-text read/remove are inside try; remote-wipe clear is inside try.
    expect(SRC).toContain("try { shared = sessionStorage.getItem('brz-shared-text'); } catch");
    expect(SRC).toContain("sessionStorage.removeItem('brz-shared-text'); } catch");
    expect(SRC).toContain("try { localStorage.clear(); sessionStorage.clear(); } catch");
    expect(SRC).not.toContain("const shared = sessionStorage.getItem('brz-shared-text');");
  });
});
