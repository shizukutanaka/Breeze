// In-memory stand-in for the MAILBOX_DO Durable Object namespace, sufficient
// for the worker's mailbox store and queue handlers. Unlike a hand-written
// stub, this fake instantiates the REAL MailboxDO class from _worker.js on
// top of a Map-backed state.storage, so the drain/seeding and TTL logic under
// test is the production code — only the storage medium and the RPC transport
// (direct method dispatch instead of a network fetch) are faked.
//
// The DO instance receives the same env object as the worker under test, so
// its drain seeding reads the test's mock KV exactly as production would.
import { MailboxDO } from '../../_worker.js';
import { makeEnv } from './mockKV.js';

// The subset of DurableObjectState.storage MailboxDO uses. `map` is exposed
// so tests can inspect what the DO actually holds (entry shape { v, exp }).
export function makeDOStorage() {
  const map = new Map();
  return {
    map,
    async get(key) { return map.has(key) ? map.get(key) : undefined; },
    async put(key, value) { map.set(key, value); },
    async delete(key) { return map.delete(key); },
    async deleteAll() { map.clear(); },
  };
}

// A MAILBOX_DO namespace: idFromName is deterministic per name and get()
// returns a stub for the single instance of that name (one DO per
// recipient, like the real runtime). `instances` maps name → MailboxDO so
// tests can assert how many mailboxes were materialised.
export function makeMailboxNamespace(env) {
  const instances = new Map();
  return {
    instances,
    idFromName(name) { return { name: String(name) }; },
    get(id) {
      const name = id.name;
      if (!instances.has(name)) {
        const state = { storage: makeDOStorage(), id: { name } };
        instances.set(name, new MailboxDO(state, env));
      }
      const instance = instances.get(name);
      return { fetch: (url, init) => instance.fetch(new Request(url, init)) };
    },
  };
}

// Build an env wired for the DO backend: mock KV + MAILBOX_DO namespace
// bound to that same env (so seeding drains the very KV the test seeded),
// with MAILBOX_BACKEND=do unless overridden in `extra`.
export function makeDOEnv(extra = {}) {
  const env = makeEnv({ MAILBOX_BACKEND: 'do', ...extra });
  env.MAILBOX_DO = makeMailboxNamespace(env);
  return env;
}

// Same wiring for the stage-1 step-4 presence backend: PRESENCE_BACKEND=do
// with the mailbox backend left at its KV default unless overridden — the
// two flags (and their drain migrations) are independent by design.
export function makePresenceDOEnv(extra = {}) {
  const env = makeEnv({ PRESENCE_BACKEND: 'do', ...extra });
  env.MAILBOX_DO = makeMailboxNamespace(env);
  return env;
}
