import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCloudflareLink, CLOUDFLARE_LINK_KEY } from '../src/app/cloudflare.js';
import { settingsPanelHtml } from '../src/app/settings-panel.js';
import worker from '../_worker.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const TOKEN = 'cf_test_token_secret_123';

class FakeControl {
  constructor() { this.listeners = {}; this.disabled = false; this.textContent = ''; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn({ preventDefault: () => {} }); }
}

class FakeSection {
  constructor() {
    this.dataset = {};
    this.input = { value: '' };
    this.status = { textContent: '' };
    this.setupStatus = { textContent: '' };
    this.save = new FakeControl();
    this.verify = new FakeControl();
    this.setup = new FakeControl();
    this.disconnect = new FakeControl();
  }
  querySelector(sel) {
    if (sel === '.cloudflare-token-input') return this.input;
    if (sel === '[data-cloudflare-status]') return this.status;
    if (sel === '[data-cloudflare-setup-status]') return this.setupStatus;
    if (sel === '[data-action="cloudflare-save"]') return this.save;
    if (sel === '[data-action="cloudflare-verify"]') return this.verify;
    if (sel === '[data-action="cloudflare-setup"]') return this.setup;
    if (sel === '[data-action="cloudflare-disconnect"]') return this.disconnect;
    return null;
  }
}

class FakeBody {
  constructor(section) { this.section = section; }
  querySelector(sel) {
    if (sel === '.cmd-panel-mono') return this;
    if (sel === '[data-cloudflare-section]') return this.section;
    return null;
  }
  querySelectorAll(sel) { return sel === '[data-cloudflare-section]' ? [this.section] : []; }
}

function cfResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function makeLink(fetchImpl) {
  const store = new Map();
  const section = new FakeSection();
  const body = new FakeBody(section);
  const calls = { put: [], get: [], del: [], toast: [], fetch: [], dbg: [] };
  const deps = {
    t: (key, ...args) => args.length ? `${key}(${args.join('|')})` : key,
    esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
    dbPut: async (storeName, value, key) => {
      calls.put.push({ storeName, value, key });
      if (storeName !== 'settings') throw new Error('wrong store');
      store.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    },
    dbGet: async (storeName, key) => {
      calls.get.push({ storeName, key });
      if (storeName !== 'settings') throw new Error('wrong store');
      return store.has(key) ? JSON.parse(JSON.stringify(store.get(key))) : null;
    },
    dbDel: async (storeName, key) => {
      calls.del.push({ storeName, key });
      if (storeName !== 'settings') throw new Error('wrong store');
      store.delete(key);
    },
    showToast: (msg, type) => calls.toast.push({ msg, type }),
    safeSetHTML: (el, value) => { el.html = value; el.textContent = value; },
    domGet: (id) => id === 'settings-body' ? body : null,
    fetch: async (url, opts) => {
      calls.fetch.push({ url, opts });
      return fetchImpl(url, opts);
    },
    dbg: (...args) => calls.dbg.push(args),
  };
  const link = createCloudflareLink(deps);
  link.scan();
  return { link, store, section, calls };
}

describe('cloudflare account linking module', () => {
  it('saves the token only under its settings key, clears the input, and never exposes it in state or notices', async () => {
    const { link, store, section, calls } = makeLink(async () => { throw new Error('unused'); });
    section.input.value = ' ' + TOKEN + ' ';
    section.save.click();
    await vi.waitFor(() => expect(store.get(CLOUDFLARE_LINK_KEY)?.token).toBe(TOKEN));
    expect(calls.put).toHaveLength(1);
    expect(calls.put[0].storeName).toBe('settings');
    expect(calls.put[0].key).toBe(CLOUDFLARE_LINK_KEY);
    expect(store.get(CLOUDFLARE_LINK_KEY)?.token).toBe(TOKEN);
    expect(section.input.value).toBe('');
    expect(JSON.stringify(link.snapshot())).not.toContain(TOKEN);
    expect(JSON.stringify(calls.toast)).not.toContain(TOKEN);
    expect(JSON.stringify(calls.dbg)).not.toContain(TOKEN);
    expect(link.snapshot().kind).toBe('saved');
  });

  it('verifies successfully, sends the Bearer token only to api.cloudflare.com, and shows account names plus token status', async () => {
    const { link, store, section, calls } = makeLink(async (url) => {
      if (url === 'https://api.cloudflare.com/client/v4/user/tokens/verify') {
        return cfResponse({ success: true, result: { id: 'tokid', status: 'active' }, errors: [], messages: [] });
      }
      if (url === 'https://api.cloudflare.com/client/v4/accounts') {
        return cfResponse({ success: true, result: [{ id: 'acct-first', name: 'Example Account' }, { id: 'acct-second', name: 'Second Account' }], errors: [], messages: [] });
      }
      throw new Error('unexpected URL');
    });
    await link.saveToken(TOKEN);
    const result = await link.verify();
    expect(result).toMatchObject({ ok: true, tokenStatus: 'active', accounts: ['Example Account', 'Second Account'] });
    expect(calls.fetch.map((c) => c.url)).toEqual([
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      'https://api.cloudflare.com/client/v4/accounts',
    ]);
    for (const call of calls.fetch) {
      expect(call.url.startsWith('https://api.cloudflare.com/')).toBe(true);
      expect(call.opts).toEqual({ method: 'GET', headers: { Authorization: 'Bearer ' + TOKEN } });
    }
    expect(link.snapshot()).toMatchObject({ kind: 'connected', tokenStatus: 'active', accounts: ['Example Account', 'Second Account'] });
    expect(store.get(CLOUDFLARE_LINK_KEY)?.verified).toMatchObject({ status: 'active', accounts: ['Example Account', 'Second Account'], accountId: 'acct-first', accountName: 'Example Account' });
    expect(section.status.textContent).toContain('Example Account, Second Account');
    expect(section.status.textContent).toContain('active');
    expect(JSON.stringify(link.snapshot())).not.toContain(TOKEN);
    expect(section.status.textContent).not.toContain(TOKEN);
  });


  it('escapes API-returned account names in the rendered status HTML', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { link, section } = makeLink(async (url) => {
      if (url.endsWith('/user/tokens/verify')) return cfResponse({ success: true, result: { status: 'active' }, errors: [], messages: [] });
      return cfResponse({ success: true, result: [{ name: evil }], errors: [], messages: [] });
    });
    await link.saveToken(TOKEN);
    const result = await link.verify();
    expect(result.ok).toBe(true);
    expect(section.status.html).toContain('&#60;img');
    expect(section.status.html).not.toContain('<img');
  });

  it('shows an honest invalid/expired-token error for a 401 failure and no fake account state', async () => {
    const { link, store, section } = makeLink(async () => cfResponse(
      { success: false, errors: [{ code: 1000, message: 'Invalid API token' }], messages: [], result: null },
      { ok: false, status: 401 },
    ));
    await link.saveToken(TOKEN);
    const result = await link.verify();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cfErrInvalidToken');
    expect(link.snapshot()).toMatchObject({ kind: 'error', accounts: [], reason: 'cfErrInvalidToken' });
    expect(store.get(CLOUDFLARE_LINK_KEY)?.verified).toBe(null);
    expect(section.status.textContent).toBe('cfStatusError(cfErrInvalidToken)');
  });

  it('shows Cloudflare API error messages honestly without ever echoing the token', async () => {
    const echoed = 'Token ' + TOKEN + ' was rejected';
    const { link, section } = makeLink(async () => cfResponse(
      { success: false, errors: [{ code: 9109, message: echoed }], messages: [], result: null },
      { ok: false, status: 400 },
    ));
    await link.saveToken(TOKEN);
    const result = await link.verify();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cfErrApi');
    expect(section.status.textContent).toBe('cfStatusError(cfErrApi)');
    expect(section.status.textContent).not.toContain(TOKEN);
  });

  it('does not show an expired or disabled token as connected even when the API verifies it structurally', async () => {
    const { link, store, section, calls } = makeLink(async (url) => {
      if (url.endsWith('/user/tokens/verify')) return cfResponse({ success: true, result: { status: 'expired' }, errors: [], messages: [] });
      return cfResponse({ success: true, result: [{ name: 'Example Account' }], errors: [], messages: [] });
    });
    await link.saveToken(TOKEN);
    const result = await link.verify();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cfErrTokenNotActive(expired)');
    expect(calls.fetch).toHaveLength(2);
    expect(link.snapshot()).toMatchObject({ kind: 'error', accounts: [] });
    expect(store.get(CLOUDFLARE_LINK_KEY)?.verified).toBe(null);
    expect(section.status.textContent).toContain('expired');
    expect(section.status.textContent).not.toContain('Example Account');
  });

  it('shows an honest network-error state when fetch throws', async () => {
    const { link, section } = makeLink(async () => { throw new TypeError('network down'); });
    await link.saveToken(TOKEN);
    const result = await link.verify();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cfErrNetwork');
    expect(link.snapshot().kind).toBe('error');
    expect(section.status.textContent).toBe('cfStatusError(cfErrNetwork)');
  });

  it('disconnect deletes the stored record with dbDel and resets the visible state', async () => {
    const { link, store, section, calls } = makeLink(async () => { throw new Error('unused'); });
    await link.saveToken(TOKEN);
    expect(store.has(CLOUDFLARE_LINK_KEY)).toBe(true);
    const result = await link.disconnect();
    expect(result.ok).toBe(true);
    expect(calls.del).toEqual([{ storeName: 'settings', key: CLOUDFLARE_LINK_KEY }]);
    expect(store.has(CLOUDFLARE_LINK_KEY)).toBe(false);
    expect(link.snapshot()).toMatchObject({ kind: 'none', accounts: [], tokenStatus: '', reason: '' });
    expect(section.status.textContent).toBe('cfStatusNone');
    expect(JSON.stringify(calls.toast)).not.toContain(TOKEN);
  });

  it('verify with no stored token does not call fetch', async () => {
    const fetchImpl = vi.fn(async () => cfResponse({ success: true, result: {} }));
    const { link, calls } = makeLink(fetchImpl);
    const result = await link.verify();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cfErrNoToken');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(calls.fetch).toHaveLength(0);
  });

  it('restores saved-but-unverified and verified connection state without retaining the token in the public snapshot', async () => {
    const { link, store } = makeLink(async () => { throw new Error('unused'); });
    await link.saveToken(TOKEN);
    expect((await link.refresh()).kind).toBe('saved');
    store.set(CLOUDFLARE_LINK_KEY, { v: 1, token: TOKEN, verified: { at: 1, status: 'active', accounts: ['Example Account'] } });
    const state = await link.refresh();
    expect(state).toMatchObject({ kind: 'connected', tokenStatus: 'active', accounts: ['Example Account'] });
    expect(JSON.stringify(state)).not.toContain(TOKEN);
  });
});

describe('cloudflare server provisioning', () => {
  const CF = 'https://api.cloudflare.com/client/v4';
  const ACCOUNT = 'acct-1';
  const WORKER_SOURCE = 'export default { async fetch() { return new Response("ok"); } };\n';

  async function seedVerified(link, store, deployment = null) {
    store.set(CLOUDFLARE_LINK_KEY, {
      v: 1,
      token: TOKEN,
      verified: { at: 1, status: 'active', accounts: ['Example Account'], accountId: ACCOUNT, accountName: 'Example Account' },
      deployment,
    });
    await link.refresh();
  }

  function happyProvisionFetch(options = {}) {
    const subdomain = options.subdomain || 'example';
    const serverUrl = `https://breeze.${subdomain}.workers.dev`;
    return async (url, opts = {}) => {
      if (url === '/server/breeze-worker.js') {
        if (options.sourceThrows) throw new TypeError('source network down');
        return { ok: options.sourceOk !== false, status: options.sourceStatus || 200, text: async () => options.source || WORKER_SOURCE };
      }
      if (url === serverUrl + '/api/health') {
        if (options.healthThrows) throw new TypeError('health network down');
        return cfResponse(options.healthBody || { ok: true }, { ok: options.healthOk !== false, status: options.healthStatus || 200 });
      }
      if (!url.startsWith(CF)) throw new Error('unexpected non-Cloudflare URL: ' + url);
      const path = url.slice(CF.length);
      if (path.startsWith(`/accounts/${ACCOUNT}/storage/kv/namespaces`)) {
        if (opts.method === 'POST') {
          if (options.kvCreateError) return cfResponse({ success: false, errors: [{ message: 'kv create denied' }], messages: [], result: null }, { ok: false, status: 403 });
          return cfResponse({ success: true, result: { id: options.createdKvId || 'kv-created' }, errors: [], messages: [] });
        }
        if (options.kvListError) return cfResponse({ success: false, errors: [{ message: 'kv list denied' }], messages: [], result: null }, { ok: false, status: 500 });
        const q = new URL(url).searchParams.get('page');
        const page = q ? Number(q) : 1;
        const rows = options.kvRowsForPage ? options.kvRowsForPage(page) : (options.kvRows ?? [{ id: 'kv-existing', title: 'breeze-presence' }]);
        const info = options.kvInfoForPage ? options.kvInfoForPage(page) : { page, total_pages: 1 };
        return cfResponse({ success: true, result: rows, result_info: info, errors: [], messages: [] });
      }
      if (path === `/accounts/${ACCOUNT}/workers/scripts/breeze` && opts.method === 'PUT') {
        if (options.uploadError) return cfResponse({ success: false, errors: [{ message: 'workers edit denied' }], messages: [], result: null }, { ok: false, status: 403 });
        return cfResponse({ success: true, result: { id: 'script-id' }, errors: [], messages: [] });
      }
      if (path === `/accounts/${ACCOUNT}/workers/scripts/breeze/subdomain` && opts.method === 'POST') {
        return cfResponse({ success: true, result: { enabled: true }, errors: [], messages: [] });
      }
      if (path === `/accounts/${ACCOUNT}/workers/subdomain`) {
        return cfResponse({ success: true, result: { subdomain }, errors: [], messages: [] });
      }
      throw new Error('unexpected Cloudflare API path: ' + path);
    };
  }

  function nonCloudflareCalls(calls) {
    return calls.fetch.filter((c) => !c.url.startsWith(CF));
  }

  it('reuses an existing KV namespace, uploads the exact multipart shape, forms the workers.dev URL, verifies health, and saves the deployment', async () => {
    const { link, store, section, calls } = makeLink(happyProvisionFetch());
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result).toMatchObject({ ok: true, serverUrl: 'https://breeze.example.workers.dev' });
    expect(calls.fetch.some((c) => c.url === CF + '/accounts')).toBe(false);

    const kvBase = CF + `/accounts/${ACCOUNT}/storage/kv/namespaces`;
    expect(calls.fetch.some((c) => c.url === kvBase && c.opts.method === 'GET')).toBe(true);
    expect(calls.fetch.some((c) => c.url === kvBase && c.opts.method === 'POST')).toBe(false);

    const upload = calls.fetch.find((c) => c.opts.method === 'PUT');
    expect(upload.url).toBe(CF + `/accounts/${ACCOUNT}/workers/scripts/breeze`);
    expect(upload.opts.headers).toEqual({ Authorization: 'Bearer ' + TOKEN });
    const metadata = JSON.parse(upload.opts.body.get('metadata'));
    expect(metadata).toEqual({
      main_module: 'worker.js',
      bindings: [{ type: 'kv_namespace', name: 'KV', namespace_id: 'kv-existing' }],
      compatibility_date: '2024-12-01',
    });
    const workerPart = upload.opts.body.get('worker.js');
    expect(workerPart.type).toBe('application/javascript+module');
    expect(await workerPart.text()).toBe(WORKER_SOURCE);

    const enable = calls.fetch.find((c) => c.url === CF + `/accounts/${ACCOUNT}/workers/scripts/breeze/subdomain`);
    expect(enable.opts.method).toBe('POST');
    expect(JSON.parse(enable.opts.body)).toEqual({ enabled: true });
    expect(calls.fetch.some((c) => c.url === CF + `/accounts/${ACCOUNT}/workers/subdomain` && c.opts.method === 'GET')).toBe(true);

    const rec = store.get(CLOUDFLARE_LINK_KEY);
    expect(rec.deployment).toMatchObject({
      serverUrl: 'https://breeze.example.workers.dev',
      accountId: ACCOUNT,
      scriptName: 'breeze',
      kvNamespaceId: 'kv-existing',
      verified: true,
    });
    expect(Number.isFinite(rec.deployment.deployedAt)).toBe(true);
    expect(link.snapshot().deployment).toMatchObject({ serverUrl: 'https://breeze.example.workers.dev', verified: true });
    expect(section.setupStatus.textContent).toContain('cfSetupDone(https://breeze.example.workers.dev)');
    expect(JSON.stringify(link.snapshot())).not.toContain(TOKEN);
    expect(section.setupStatus.textContent).not.toContain(TOKEN);
    for (const call of nonCloudflareCalls(calls)) expect(call.opts?.headers?.Authorization).toBeUndefined();
  });

  it('creates breeze-presence when absent and uses the returned namespace id in the upload metadata', async () => {
    const { link, store, calls } = makeLink(happyProvisionFetch({ kvRows: [] }));
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result.ok).toBe(true);
    const kvBase = CF + `/accounts/${ACCOUNT}/storage/kv/namespaces`;
    const create = calls.fetch.find((c) => c.url === kvBase && c.opts.method === 'POST');
    expect(create).toBeTruthy();
    expect(JSON.parse(create.opts.body)).toEqual({ title: 'breeze-presence' });
    const upload = calls.fetch.find((c) => c.opts.method === 'PUT');
    expect(JSON.parse(upload.opts.body.get('metadata')).bindings[0].namespace_id).toBe('kv-created');
    expect(store.get(CLOUDFLARE_LINK_KEY).deployment.kvNamespaceId).toBe('kv-created');
  });

  it('follows KV result_info pagination and reuses a matching title on a later page without creating a namespace', async () => {
    const fetchImpl = happyProvisionFetch({
      kvRowsForPage: (page) => page === 1 ? [{ id: 'other', title: 'other-namespace' }] : [{ id: 'kv-page2', title: 'breeze-presence' }],
      kvInfoForPage: (page) => ({ page, total_pages: 2 }),
    });
    const { link, store, calls } = makeLink(fetchImpl);
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result.ok).toBe(true);
    const kvBase = CF + `/accounts/${ACCOUNT}/storage/kv/namespaces`;
    expect(calls.fetch.some((c) => c.url === kvBase + '?page=2')).toBe(true);
    expect(calls.fetch.some((c) => c.url === kvBase && c.opts.method === 'POST')).toBe(false);
    expect(store.get(CLOUDFLARE_LINK_KEY).deployment.kvNamespaceId).toBe('kv-page2');
  });

  it('resolves and stores the first account id for a legacy verified record before provisioning', async () => {
    const base = happyProvisionFetch();
    const fetchImpl = async (url, opts) => {
      if (url === CF + '/accounts') return cfResponse({ success: true, result: [{ id: ACCOUNT, name: 'Example Account' }], errors: [], messages: [] });
      return base(url, opts);
    };
    const { link, store, calls } = makeLink(fetchImpl);
    store.set(CLOUDFLARE_LINK_KEY, { v: 1, token: TOKEN, verified: { at: 1, status: 'active', accounts: ['Example Account'] }, deployment: null });
    await link.refresh();
    const result = await link.setupServer();
    expect(result.ok).toBe(true);
    expect(calls.fetch[0].url).toBe(CF + '/accounts');
    expect(store.get(CLOUDFLARE_LINK_KEY).verified.accountId).toBe(ACCOUNT);
  });

  it('stops at the KV step with the API error when listing namespaces fails and does not save a deployment', async () => {
    const { link, store, section } = makeLink(happyProvisionFetch({ kvListError: true }));
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result).toMatchObject({ ok: false, step: 'kv', reason: 'kv list denied' });
    expect(store.get(CLOUDFLARE_LINK_KEY).deployment).toBe(null);
    expect(link.snapshot().setup).toMatchObject({ state: 'error', step: 'kv', reason: 'kv list denied' });
    expect(section.setupStatus.textContent).toBe('cfSetupFailed(cfStepKv|kv list denied)');
  });

  it('stops at the source step honestly when the same-origin worker source cannot be fetched', async () => {
    const { link, store, section } = makeLink(happyProvisionFetch({ sourceOk: false, sourceStatus: 404 }));
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result).toMatchObject({ ok: false, step: 'source', reason: 'cfErrHttp(404)' });
    expect(store.get(CLOUDFLARE_LINK_KEY).deployment).toBe(null);
    expect(section.setupStatus.textContent).toBe('cfSetupFailed(cfStepSource|cfErrHttp(404))');
  });

  it('stops at upload with the Cloudflare API error and does not save a deployment as verified', async () => {
    const { link, store, section } = makeLink(happyProvisionFetch({ uploadError: true }));
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result).toMatchObject({ ok: false, step: 'upload', reason: 'workers edit denied' });
    expect(store.get(CLOUDFLARE_LINK_KEY).deployment).toBe(null);
    expect(section.setupStatus.textContent).toBe('cfSetupFailed(cfStepUpload|workers edit denied)');
    expect(section.setupStatus.textContent).not.toContain('cfSetupDone');
  });

  it('reports deployed-but-unverified distinctly when health does not answer and never sends the token off the Cloudflare API', async () => {
    const { link, store, section, calls } = makeLink(happyProvisionFetch({ healthThrows: true }));
    await seedVerified(link, store);
    const result = await link.setupServer();
    expect(result).toMatchObject({ ok: false, deployed: true, unverified: true, step: 'health', serverUrl: 'https://breeze.example.workers.dev' });
    const deployment = store.get(CLOUDFLARE_LINK_KEY).deployment;
    expect(deployment).toMatchObject({ serverUrl: 'https://breeze.example.workers.dev', verified: false });
    expect(link.snapshot().setup).toMatchObject({ state: 'unverified', step: 'health' });
    expect(section.setupStatus.textContent).toBe('cfSetupUnverified(https://breeze.example.workers.dev|cfErrNetwork)');
    expect(section.setupStatus.textContent).not.toContain('cfSetupDone');
    const health = calls.fetch.find((c) => c.url === 'https://breeze.example.workers.dev/api/health');
    expect(health.opts).toEqual({ method: 'GET' });
    expect(health.opts.headers).toBeUndefined();
    for (const call of nonCloudflareCalls(calls)) {
      expect(call.opts?.headers?.Authorization).toBeUndefined();
      expect(JSON.stringify(call.opts?.headers || {})).not.toContain(TOKEN);
    }
  });

  it('restores a saved deployment, switches the action label to update, and never exposes the token', async () => {
    const deployment = { serverUrl: 'https://breeze.example.workers.dev', accountId: ACCOUNT, scriptName: 'breeze', kvNamespaceId: 'kv-existing', deployedAt: 123, verified: true };
    const { link, store, section } = makeLink(async () => { throw new Error('unused'); });
    await seedVerified(link, store, deployment);
    expect(link.snapshot().deployment).toMatchObject(deployment);
    expect(section.setup.textContent).toBe('cfUpdate');
    expect(section.setupStatus.textContent).toBe('cfSetupDone(https://breeze.example.workers.dev)');
    expect(JSON.stringify(link.snapshot())).not.toContain(TOKEN);
  });
});

describe('served worker source', () => {
  it('is byte-identical to _worker.js and deliberately not precached', () => {
    const served = readFileSync(join(root, 'server', 'breeze-worker.js'));
    const worker = readFileSync(join(root, '_worker.js'));
    expect(Buffer.compare(served, worker)).toBe(0);
    expect(sw).not.toContain("'/server/breeze-worker.js'");
  });
});


describe('unconfigured first-run quickstart and brand-new account setup', () => {
  const CF = 'https://api.cloudflare.com/client/v4';
  const ACCOUNT = 'acct-new';
  const WORKER_SOURCE = 'export default { async fetch() { return new Response("ok"); } };\n';

  function fullFreshFetch({ missingSubdomain = false, registerFails = false } = {}) {
    let registeredSub = missingSubdomain ? null : 'fresh-acct';
    return async (url, opts = {}) => {
      if (url === '/server/breeze-worker.js') {
        return { ok: true, status: 200, text: async () => WORKER_SOURCE };
      }
      if (registeredSub && url === `https://breeze.${registeredSub}.workers.dev/api/health`) {
        return cfResponse({ ok: true });
      }
      if (!url.startsWith(CF)) throw new Error('unexpected URL: ' + url);
      const path = url.slice(CF.length);
      if (path === '/user/tokens/verify') {
        return cfResponse({ success: true, result: { id: 'tok-1', status: 'active' }, errors: [], messages: [] });
      }
      if (path === '/accounts') {
        return cfResponse({ success: true, result: [{ id: ACCOUNT, name: 'Fresh Account' }], errors: [], messages: [] });
      }
      if (path.startsWith(`/accounts/${ACCOUNT}/storage/kv/namespaces`)) {
        if (opts.method === 'POST') return cfResponse({ success: true, result: { id: 'kv-new' }, errors: [], messages: [] });
        return cfResponse({ success: true, result: [], result_info: { page: 1, total_pages: 1 }, errors: [], messages: [] });
      }
      if (path === `/accounts/${ACCOUNT}/workers/scripts/breeze` && opts.method === 'PUT') {
        return cfResponse({ success: true, result: { id: 'script-new' }, errors: [], messages: [] });
      }
      if (path === `/accounts/${ACCOUNT}/workers/scripts/breeze/subdomain` && opts.method === 'POST') {
        if (!registeredSub) {
          return cfResponse({ success: false, errors: [{ message: 'workers.dev subdomain not found' }], messages: [], result: null }, { ok: false, status: 404 });
        }
        return cfResponse({ success: true, result: { enabled: true }, errors: [], messages: [] });
      }
      if (path === `/accounts/${ACCOUNT}/workers/subdomain`) {
        if (opts.method === 'PUT') {
          if (registerFails) return cfResponse({ success: false, errors: [{ message: 'subdomain denied' }], messages: [], result: null }, { ok: false, status: 403 });
          const body = JSON.parse(opts.body);
          registeredSub = body.subdomain;
          return cfResponse({ success: true, result: { subdomain: registeredSub }, errors: [], messages: [] });
        }
        if (!registeredSub) {
          return cfResponse({ success: false, errors: [{ message: 'subdomain not found' }], messages: [], result: null }, { ok: false, status: 404 });
        }
        return cfResponse({ success: true, result: { subdomain: registeredSub }, errors: [], messages: [] });
      }
      throw new Error('unexpected Cloudflare path: ' + path);
    };
  }

  it('connectAndSetup provisions end-to-end from a completely unconfigured state and invokes onServerReady', async () => {
    const ready = [];
    const store = new Map();
    const calls = { fetch: [], toast: [] };
    const setupSection = new FakeSection();
    setupSection.quickstart = new FakeControl();
    const origQs = setupSection.querySelector.bind(setupSection);
    setupSection.querySelector = (sel) => sel === '[data-action="cloudflare-quickstart"]' ? setupSection.quickstart : origQs(sel);
    const setupToggle = new FakeControl();
    const panelClasses = new Set(['hidden']);
    const setupPanel = {
      classList: {
        toggle: (cls) => { if (panelClasses.has(cls)) { panelClasses.delete(cls); return false; } panelClasses.add(cls); return true; },
      },
    };
    const setupEntry = {
      querySelector: (sel) => {
        if (sel === '[data-action="cloudflare-setup-toggle"]') return setupToggle;
        if (sel === '[data-cloudflare-setup-panel]') return setupPanel;
        if (sel === '[data-cloudflare-section]') return setupSection;
        return null;
      },
    };
    const setupRoot = {
      querySelector: (sel) => sel === '[data-cloudflare-setup-entry]' ? setupEntry : sel === '[data-cloudflare-section]' ? setupSection : null,
      querySelectorAll: (sel) => sel === '[data-cloudflare-section]' ? [setupSection] : [],
    };
    const link = createCloudflareLink({
      t: (key, ...args) => args.length ? `${key}(${args.join('|')})` : key,
      esc: (s) => String(s ?? ''),
      dbPut: async (_s, v, k) => { store.set(k, JSON.parse(JSON.stringify(v))); return true; },
      dbGet: async (_s, k) => store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null,
      dbDel: async (_s, k) => { store.delete(k); },
      showToast: (msg, type) => calls.toast.push({ msg, type }),
      safeSetHTML: (el, v) => { el.textContent = v; },
      domGet: (id) => id === 'msg-setup' ? setupRoot : null,
      fetch: async (url, opts) => { calls.fetch.push({ url, opts }); return fullFreshFetch()(url, opts); },
      onServerReady: async (dep) => { ready.push(dep); },
    });
    link.scan();
    // Toggle opens the panel on the unconfigured first-run screen
    setupToggle.click();
    expect(panelClasses.has('hidden')).toBe(false);

    const res = await link.connectAndSetup(TOKEN);
    expect(res).toMatchObject({ ok: true, serverUrl: 'https://breeze.fresh-acct.workers.dev' });
    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ serverUrl: 'https://breeze.fresh-acct.workers.dev', verified: true });
    expect(setupSection.setupStatus.textContent).toBe('cfSetupDone(https://breeze.fresh-acct.workers.dev)');
    for (const c of calls.fetch.filter((x) => !x.url.startsWith(CF))) {
      expect(c.opts?.headers?.Authorization).toBeUndefined();
    }
  });

  it('connectAndSetup with empty token and no saved record fails without network calls', async () => {
    const { link, calls } = makeLink(async () => { throw new Error('must not call fetch'); });
    const res = await link.connectAndSetup('   ');
    expect(res).toMatchObject({ ok: false, reason: 'cfErrTokenRequired' });
    expect(calls.fetch).toHaveLength(0);
  });

  it('automatically registers a workers.dev subdomain for a brand-new Cloudflare account', async () => {
    const { link, calls } = makeLink(fullFreshFetch({ missingSubdomain: true }));
    const res = await link.connectAndSetup(TOKEN);
    expect(res.ok).toBe(true);
    expect(res.serverUrl).toMatch(/^https:\/\/breeze\.breeze-[0-9a-f]{8}\.workers\.dev$/);
    const putSub = calls.fetch.find((c) => c.url === CF + `/accounts/${ACCOUNT}/workers/subdomain` && c.opts.method === 'PUT');
    expect(putSub).toBeTruthy();
    expect(JSON.parse(putSub.opts.body).subdomain).toMatch(/^breeze-[0-9a-f]{8}$/);
  });

  it('reports the Cloudflare API error honestly if registering a workers.dev subdomain fails', async () => {
    const { link } = makeLink(fullFreshFetch({ missingSubdomain: true, registerFails: true }));
    const res = await link.connectAndSetup(TOKEN);
    expect(res).toMatchObject({ ok: false, step: 'subdomain', reason: 'subdomain denied' });
  });
});

describe('same-origin /api/cf-proxy worker route and proxyBase client wiring', () => {
  it('routes Cloudflare API calls through proxyBase and never sends Authorization to worker source or health', async () => {
    const seen = [];
    const store = new Map();
    const link = createCloudflareLink({
      t: (k, ...a) => a.length ? `${k}(${a.join('|')})` : k,
      esc: (s) => String(s ?? ''),
      dbPut: async (_s, v, k) => { store.set(k, JSON.parse(JSON.stringify(v))); return true; },
      dbGet: async (_s, k) => store.has(k) ? JSON.parse(JSON.stringify(store.get(k))) : null,
      dbDel: async (_s, k) => { store.delete(k); },
      showToast: () => {},
      safeSetHTML: () => {},
      domGet: () => null,
      proxyBase: 'https://breeze.example/api/cf-proxy',
      fetch: async (url, opts = {}) => {
        seen.push({ url, opts });
        if (url === '/server/breeze-worker.js') return { ok: true, status: 200, text: async () => 'export default {};' };
        if (url === 'https://breeze.proxied.workers.dev/api/health') return cfResponse({ ok: true });
        if (url === 'https://breeze.example/api/cf-proxy/user/tokens/verify') return cfResponse({ success: true, result: { id: 't1', status: 'active' }, errors: [], messages: [] });
        if (url === 'https://breeze.example/api/cf-proxy/accounts') return cfResponse({ success: true, result: [{ id: 'acct-p1', name: 'Proxied' }], errors: [], messages: [] });
        if (url === 'https://breeze.example/api/cf-proxy/accounts/acct-p1/storage/kv/namespaces') return cfResponse({ success: true, result: [{ id: 'kv-p1', title: 'breeze-presence' }], result_info: { page: 1, total_pages: 1 }, errors: [], messages: [] });
        if (url === 'https://breeze.example/api/cf-proxy/accounts/acct-p1/workers/scripts/breeze') return cfResponse({ success: true, result: { id: 'breeze' }, errors: [], messages: [] });
        if (url === 'https://breeze.example/api/cf-proxy/accounts/acct-p1/workers/scripts/breeze/subdomain') return cfResponse({ success: true, result: { enabled: true }, errors: [], messages: [] });
        if (url === 'https://breeze.example/api/cf-proxy/accounts/acct-p1/workers/subdomain') return cfResponse({ success: true, result: { subdomain: 'proxied' }, errors: [], messages: [] });
        throw new Error('unexpected url: ' + url);
      },
    });
    const res = await link.connectAndSetup(TOKEN);
    expect(res).toMatchObject({ ok: true, serverUrl: 'https://breeze.proxied.workers.dev' });
    const proxyCalls = seen.filter((c) => c.url.startsWith('https://breeze.example/api/cf-proxy/'));
    expect(proxyCalls.length).toBeGreaterThanOrEqual(6);
    for (const c of seen.filter((x) => !x.url.startsWith('https://breeze.example/api/cf-proxy/'))) {
      expect(c.opts?.headers?.Authorization).toBeUndefined();
    }
  });

  it('rejects non-allowlisted paths (403) and missing Bearer tokens (401) in _worker.js /api/cf-proxy', async () => {
    const blocked = await worker.fetch(new Request('https://breeze.test/api/cf-proxy/zones/123/dns_records', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + TOKEN },
    }), {});
    expect(blocked.status).toBe(403);

    const noAuth = await worker.fetch(new Request('https://breeze.test/api/cf-proxy/user/tokens/verify', {
      method: 'GET',
    }), {});
    expect(noAuth.status).toBe(401);
  });

  it('forwards allowlisted /api/cf-proxy requests statelessly to api.cloudflare.com with no-store', async () => {
    const origFetch = globalThis.fetch;
    const forwarded = [];
    globalThis.fetch = async (url, init) => {
      forwarded.push({ url, init });
      return new Response(JSON.stringify({ success: true, result: { status: 'active' }, errors: [], messages: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    try {
      const res = await worker.fetch(new Request('https://breeze.test/api/cf-proxy/user/tokens/verify', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + TOKEN, 'CF-Connecting-IP': '198.51.100.10' },
      }), {});
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(forwarded).toHaveLength(1);
      expect(forwarded[0].url).toBe('https://api.cloudflare.com/client/v4/user/tokens/verify');
      expect(forwarded[0].init.headers.Authorization).toBe('Bearer ' + TOKEN);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('cloudflare linking wiring', () => {
  it('is bridged, installed with host deps, rendered in settings, and precached', () => {
    expect(html).toContain("import { createCloudflareLink } from './src/app/cloudflare.js'; window.__breezeCloudflare = { createCloudflareLink };");
    expect(html).toContain('globalThis.__breezeCloudflare?.createCloudflareLink({ t, esc, dbPut, dbGet, dbDel, showToast, safeSetHTML, domGet:');
    expect(html).toContain("proxyBase: (API || (location.origin + '/api')) + '/cf-proxy'");
    expect(html).toContain('onServerReady:');
    const panel = settingsPanelHtml({ t: (key) => key, esc: (x) => String(x), myName: '', fanout: 2, powerMode: 'auto', relays: [] });
    for (const action of ['cloudflare-quickstart', 'cloudflare-save', 'cloudflare-verify', 'cloudflare-setup', 'cloudflare-disconnect']) {
      expect(panel).toContain(`data-action="${action}"`);
    }
    expect(sw).toContain("'/src/app/cloudflare.js'");
  });
});
