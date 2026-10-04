import { describe, it, expect } from 'vitest';
import { makeKV } from './helpers/mockKV.js';

// The mock now enforces TTLs like real KV. These tests pin the fidelity contract:
// expired keys are invisible to get/list (the paths the worker's expiry-aware
// logic — presence freshness, OTP-count reconciliation, sig: cleanup — depends on),
// and tests advance the clock by backdating `exp` rather than sleeping.
describe('mockKV TTL fidelity', () => {
  it('expired keys are invisible to get() and lazily purged', async () => {
    const kv = makeKV();
    await kv.put('k:short', 'v', { expirationTtl: 60 });
    expect(await kv.get('k:short')).toBe('v');
    kv.exp.set('k:short', Date.now() - 1); // backdate past expiry
    expect(await kv.get('k:short')).toBeNull();
    expect(kv.store.has('k:short')).toBe(false);
  });

  it('an overwrite without a TTL clears a prior expiry (real KV semantics)', async () => {
    const kv = makeKV();
    await kv.put('k:perm', 'v1', { expirationTtl: 60 });
    kv.exp.set('k:perm', Date.now() - 1); // entry is now stale...
    await kv.put('k:perm', 'v2');          // ...but the overwrite clears the expiry record
    expect(kv.exp.has('k:perm')).toBe(false);
    expect(await kv.get('k:perm')).toBe('v2');
  });

  it('list() skips expired keys and reports real-KV expiration metadata', async () => {
    const kv = makeKV();
    await kv.put('p:a', '1', { expirationTtl: 60 });
    await kv.put('p:b', '2', { expirationTtl: 60 });
    kv.exp.set('p:b', Date.now() - 1);
    const { keys } = await kv.list({ prefix: 'p:' });
    expect(keys.map(k => k.name)).toEqual(['p:a']);
    expect(typeof keys[0].expiration).toBe('number'); // unix seconds, like real KV
  });

  it('initial fixtures (raw strings, no TTL) never expire', async () => {
    const kv = makeKV({ 'fix:k': 'val' });
    expect(await kv.get('fix:k')).toBe('val');
    expect((await kv.list({ prefix: 'fix:' })).keys[0].expiration).toBeUndefined();
  });
});
