// Connect-your-own-Cloudflare account linking and server provisioning. The
// token is device-local state only: this module sends it solely to
// api.cloudflare.com as a Bearer token, never to a Breeze relay or the
// provisioned server, and never exposes it through state or UI.
export const CLOUDFLARE_LINK_KEY = 'cloudflareLink';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SECTION_SEL = '[data-cloudflare-section]';
const KV_TITLE = 'breeze-presence';
const SCRIPT_NAME = 'breeze';
const WORKER_SOURCE_PATH = '/server/breeze-worker.js';
const JSON_HEADERS = Object.freeze({ 'Content-Type': 'application/json' });
const STEP_KEYS = Object.freeze({
  account: 'cfStepAccount',
  kv: 'cfStepKv',
  source: 'cfStepSource',
  upload: 'cfStepUpload',
  subdomain: 'cfStepSubdomain',
  health: 'cfStepHealth',
});

function cleanDeployment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {
    serverUrl: typeof raw.serverUrl === 'string' ? raw.serverUrl : '',
    accountId: typeof raw.accountId === 'string' ? raw.accountId : '',
    scriptName: typeof raw.scriptName === 'string' ? raw.scriptName : '',
    kvNamespaceId: typeof raw.kvNamespaceId === 'string' ? raw.kvNamespaceId : '',
    deployedAt: Number.isFinite(raw.deployedAt) ? raw.deployedAt : 0,
    verified: raw.verified === true,
  };
  return out.serverUrl && out.accountId && out.scriptName && out.kvNamespaceId ? out : null;
}

function cleanRecord(raw) {
  if (typeof raw === 'string' && raw) return { v: 1, token: raw, verified: null, deployment: null };
  if (!raw || typeof raw !== 'object' || typeof raw.token !== 'string' || !raw.token) return null;
  const out = { v: 1, token: raw.token, verified: null, deployment: cleanDeployment(raw.deployment) };
  const v = raw.verified;
  if (v && typeof v === 'object') {
    out.verified = {
      at: Number.isFinite(v.at) ? v.at : 0,
      status: typeof v.status === 'string' ? v.status : '',
      accounts: Array.isArray(v.accounts) ? v.accounts.filter((a) => typeof a === 'string' && a).slice(0, 50) : [],
      accountId: typeof v.accountId === 'string' ? v.accountId : '',
      accountName: typeof v.accountName === 'string' ? v.accountName : '',
    };
  }
  return out;
}

const emptySetup = () => ({ state: 'idle', step: '', reason: '', serverUrl: '' });

export function createCloudflareLink(D) {
  const { t, esc, dbPut, dbGet, dbDel, showToast, safeSetHTML, domGet } = D;
  const cfFetch = D.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const wired = new WeakSet();
  let observer = null;
  let view = { kind: 'none', hasToken: false, accounts: [], tokenStatus: '', reason: '', setup: emptySetup(), deployment: null };

  function sectionHtml() {
    return `<b class="i-g">${esc(t('settingsCloudflare'))}</b><br><span class="i-t3-10">${esc(t('cfNote'))}</span><br>`
      + `<label class="i-cur">${esc(t('cfTokenLabel'))} <input type="password" class="cloudflare-token-input" autocomplete="off" placeholder="${esc(t('cfTokenPlaceholder'))}"></label><br>`
      + `<button type="button" class="btn btn-g btn-sm" data-action="cloudflare-save">${esc(t('cfSave'))}</button> `
      + `<button type="button" class="btn btn-o btn-sm" data-action="cloudflare-verify">${esc(t('cfVerify'))}</button> `
      + `<button type="button" class="btn btn-o btn-sm" data-action="cloudflare-setup">${esc(t('cfSetup'))}</button> `
      + `<button type="button" class="btn btn-o btn-sm" data-action="cloudflare-disconnect">${esc(t('cfDisconnect'))}</button><br>`
      + '<span class="i-t3-10" data-cloudflare-status></span><br><span class="i-t3-10" data-cloudflare-setup-status></span>';
  }

  const body = () => domGet?.('settings-body') || null;
  const sections = () => {
    const b = body();
    return b ? [...b.querySelectorAll(SECTION_SEL)] : [];
  };

  function stepLabel(step) {
    return STEP_KEYS[step] ? t(STEP_KEYS[step]) : '';
  }

  function statusText() {
    if (view.kind === 'verifying') return t('cfStatusVerifying');
    if (view.kind === 'saved') return t('cfStatusSaved');
    if (view.kind === 'error') return t('cfStatusError', view.reason);
    if (view.kind === 'connected') {
      return view.accounts.length
        ? t('cfStatusConnected', view.accounts.join(', '), view.tokenStatus)
        : t('cfStatusConnectedNoAccounts', view.tokenStatus);
    }
    return t('cfStatusNone');
  }

  function setupStatusText() {
    const setup = view.setup || emptySetup();
    const dep = view.deployment;
    const url = setup.serverUrl || dep?.serverUrl || '';
    if (setup.state === 'running') return t('cfSetupRunning', stepLabel(setup.step));
    if (setup.state === 'error') return t('cfSetupFailed', stepLabel(setup.step), setup.reason);
    if (setup.state === 'done') return t('cfSetupDone', url);
    if (setup.state === 'unverified') return t('cfSetupUnverified', url, setup.reason || t('cfErrHealth'));
    if (dep?.serverUrl) return dep.verified ? t('cfSetupDone', dep.serverUrl) : t('cfSetupUnverified', dep.serverUrl, t('cfErrHealth'));
    return '';
  }

  function render(section) {
    const status = section?.querySelector('[data-cloudflare-status]');
    if (status) safeSetHTML(status, esc(statusText()));
    const setupStatus = section?.querySelector('[data-cloudflare-setup-status]');
    if (setupStatus) safeSetHTML(setupStatus, esc(setupStatusText()));
    const busy = view.kind === 'verifying' || view.setup?.state === 'running';
    const disconnected = !view.hasToken;
    const verifyBtn = section?.querySelector('[data-action="cloudflare-verify"]');
    const setupBtn = section?.querySelector('[data-action="cloudflare-setup"]');
    const disconnectBtn = section?.querySelector('[data-action="cloudflare-disconnect"]');
    if (verifyBtn) verifyBtn.disabled = busy || disconnected;
    if (setupBtn) {
      setupBtn.disabled = busy || disconnected;
      setupBtn.textContent = view.deployment ? t('cfUpdate') : t('cfSetup');
    }
    if (disconnectBtn) disconnectBtn.disabled = busy || disconnected;
  }

  function renderAll() { for (const section of sections()) render(section); }

  function clearInputs() {
    for (const section of sections()) {
      const input = section.querySelector('.cloudflare-token-input');
      if (input) input.value = '';
    }
  }

  function scan() {
    const b = body();
    if (!b) return;
    const container = b.querySelector('.cmd-panel-mono') || b;
    let section = container.querySelector(SECTION_SEL);
    if (!section && typeof document !== 'undefined') {
      section = document.createElement('div');
      section.setAttribute('data-cloudflare-section', '');
      safeSetHTML(section, sectionHtml());
      container.appendChild(section);
    }
    if (!section) return;
    if (!wired.has(section)) {
      wired.add(section);
      section.querySelector('[data-action="cloudflare-save"]')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        const input = section.querySelector('.cloudflare-token-input');
        saveToken(input?.value || '');
      });
      section.querySelector('[data-action="cloudflare-verify"]')?.addEventListener('click', (ev) => { ev.preventDefault(); verify(); });
      section.querySelector('[data-action="cloudflare-setup"]')?.addEventListener('click', (ev) => { ev.preventDefault(); setupServer(); });
      section.querySelector('[data-action="cloudflare-disconnect"]')?.addEventListener('click', (ev) => { ev.preventDefault(); disconnect(); });
    }
    render(section);
  }

  async function readRecord() {
    const raw = await dbGet('settings', CLOUDFLARE_LINK_KEY);
    return cleanRecord(raw);
  }

  async function writeRecord(rec) {
    try {
      const written = await dbPut('settings', rec, CLOUDFLARE_LINK_KEY);
      return written !== false;
    } catch {
      return false;
    }
  }

  function setError(reason, hasToken = view.hasToken) {
    view = { kind: 'error', hasToken, accounts: [], tokenStatus: '', reason, setup: view.setup || emptySetup(), deployment: view.deployment || null };
    renderAll();
    return { ok: false, reason };
  }

  function cloudflareMessage(data, token) {
    const parts = [];
    for (const list of [data?.errors, data?.messages]) {
      if (!Array.isArray(list)) continue;
      for (const item of list) if (typeof item?.message === 'string' && item.message) parts.push(item.message);
    }
    const msg = parts[0] || '';
    if (!msg || msg.includes(token)) return '';
    return msg.slice(0, 240);
  }

  async function cfRequest(path, token, opts = {}, honestStatus = false) {
    if (!cfFetch) return { errorKey: 'cfErrNetwork' };
    const init = { method: opts.method || 'GET', headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } };
    if (opts.body !== undefined) init.body = opts.body;
    let resp;
    try {
      resp = await cfFetch(CF_API + path, init);
    } catch {
      return { errorKey: 'cfErrNetwork' };
    }
    if (!resp || typeof resp !== 'object') return { errorKey: 'cfErrApi' };
    let data = null;
    try { data = await resp.json(); } catch { data = null; }
    if (!resp.ok || !data || data.success !== true) {
      const errorKey = (resp.status === 401 || resp.status === 403) ? 'cfErrInvalidToken' : 'cfErrApi';
      let errorDetail = errorKey === 'cfErrInvalidToken' && !honestStatus ? '' : cloudflareMessage(data, token);
      if (!errorDetail && honestStatus) errorDetail = t('cfErrHttp', resp.status || t('unknown'));
      return { errorKey, errorDetail };
    }
    return { data };
  }

  const cfGet = (path, token) => cfRequest(path, token, { method: 'GET' });
  const reasonFor = (r) => r.errorDetail || t(r.errorKey || 'cfErrApi');

  async function saveToken(rawToken) {
    const token = String(rawToken || '').trim();
    if (!token) {
      showToast(t('cfErrTokenRequired'), 'error');
      return setError(t('cfErrTokenRequired'));
    }
    try {
      const written = await dbPut('settings', { v: 1, token, verified: null, deployment: null }, CLOUDFLARE_LINK_KEY);
      if (written === false) {
        showToast(t('cfErrStorage'), 'error');
        return setError(t('cfErrStorage'));
      }
    } catch {
      showToast(t('cfErrStorage'), 'error');
      return setError(t('cfErrStorage'));
    }
    view = { kind: 'saved', hasToken: true, accounts: [], tokenStatus: '', reason: '', setup: emptySetup(), deployment: null };
    clearInputs();
    renderAll();
    showToast(t('cfSaved'), 'success');
    return { ok: true };
  }

  async function verify() {
    if (view.kind === 'verifying') return { ok: false, reason: t('cfStatusVerifying') };
    let rec = null;
    try {
      rec = await readRecord();
    } catch {
      return setError(t('cfErrStorage'));
    }
    if (!rec?.token) return setError(t('cfErrNoToken'), false);
    view = { kind: 'verifying', hasToken: true, accounts: [], tokenStatus: '', reason: '', setup: view.setup || emptySetup(), deployment: view.deployment || null };
    renderAll();

    let tokenRes;
    try {
      tokenRes = await cfGet('/user/tokens/verify', rec.token);
    } catch {
      return setError(t('cfErrApi'));
    }
    if (tokenRes.errorKey) return setError(reasonFor(tokenRes));
    let accountRes;
    try {
      accountRes = await cfGet('/accounts', rec.token);
    } catch {
      return setError(t('cfErrApi'));
    }
    if (accountRes.errorKey) return setError(reasonFor(accountRes));

    const result = tokenRes.data?.result;
    const tokenStatus = typeof result?.status === 'string' && result.status ? result.status : t('unknown');
    const accountObjs = (Array.isArray(accountRes.data?.result) ? accountRes.data.result : []).filter((a) => a && typeof a === 'object').slice(0, 50);
    const accounts = accountObjs.map((a) => typeof a?.name === 'string' ? a.name : '').filter(Boolean);
    const firstWithId = accountObjs.find((a) => typeof a?.id === 'string' && a.id);
    if (tokenStatus !== 'active') return setError(t('cfErrTokenNotActive', tokenStatus));
    const verified = {
      at: Date.now(),
      status: tokenStatus,
      accounts,
      accountId: firstWithId?.id || '',
      accountName: typeof firstWithId?.name === 'string' ? firstWithId.name : '',
    };
    const written = await writeRecord({ v: 1, token: rec.token, verified, deployment: rec.deployment || null });
    if (!written) return setError(t('cfErrStorage'));
    view = { kind: 'connected', hasToken: true, accounts, tokenStatus, reason: '', setup: view.setup || emptySetup(), deployment: rec.deployment || null };
    renderAll();
    return { ok: true, accounts, tokenStatus };
  }

  async function resolveAccount(rec) {
    if (rec.verified?.accountId) return { accountId: rec.verified.accountId, accountName: rec.verified.accountName || '' };
    let res;
    try {
      res = await cfRequest('/accounts', rec.token, { method: 'GET' }, true);
    } catch {
      return { error: t('cfErrApi') };
    }
    if (res.errorKey) return { error: reasonFor(res) };
    const rows = Array.isArray(res.data?.result) ? res.data.result : [];
    const first = rows.find((a) => typeof a?.id === 'string' && a.id);
    if (!first) return { error: t('cfErrNoAccount') };
    const accountName = typeof first.name === 'string' ? first.name : '';
    rec.verified = {
      at: rec.verified?.at || 0,
      status: rec.verified?.status || '',
      accounts: Array.isArray(rec.verified?.accounts) ? rec.verified.accounts : rows.map((a) => typeof a?.name === 'string' ? a.name : '').filter(Boolean).slice(0, 50),
      accountId: first.id,
      accountName,
    };
    if (!(await writeRecord(rec))) return { error: t('cfErrStorage') };
    return { accountId: first.id, accountName };
  }

  async function findOrCreateKv(accountId, token) {
    const base = `/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces`;
    for (let page = 1; page <= 100; page++) {
      let res;
      try {
        res = await cfRequest(page === 1 ? base : `${base}?page=${page}`, token, { method: 'GET' }, true);
      } catch {
        return { error: t('cfErrApi') };
      }
      if (res.errorKey) return { error: reasonFor(res) };
      const rows = Array.isArray(res.data?.result) ? res.data.result : [];
      const found = rows.find((ns) => ns?.title === KV_TITLE && typeof ns?.id === 'string' && ns.id);
      if (found) return { id: found.id, created: false };
      const info = res.data?.result_info;
      const totalPages = Number(info?.total_pages || 1);
      const currentPage = Number(info?.page || page);
      if (!info || !(totalPages > currentPage)) break;
    }
    let created;
    try {
      created = await cfRequest(base, token, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: KV_TITLE }) }, true);
    } catch {
      return { error: t('cfErrApi') };
    }
    if (created.errorKey) return { error: reasonFor(created) };
    const id = created.data?.result?.id;
    return typeof id === 'string' && id ? { id, created: true } : { error: t('cfErrApi') };
  }

  async function fetchWorkerSource() {
    if (!cfFetch) return { error: t('cfErrNetwork') };
    let resp;
    try {
      resp = await cfFetch(WORKER_SOURCE_PATH, { method: 'GET' });
    } catch {
      return { error: t('cfErrNetwork') };
    }
    if (!resp?.ok) return { error: t('cfErrHttp', resp?.status || t('unknown')) };
    try {
      const source = await resp.text();
      return source ? { source } : { error: t('cfErrWorkerSource') };
    } catch {
      return { error: t('cfErrNetwork') };
    }
  }

  async function uploadWorker(accountId, token, namespaceId, source) {
    const metadata = {
      main_module: 'worker.js',
      bindings: [{ type: 'kv_namespace', name: 'KV', namespace_id: namespaceId }],
      compatibility_date: '2024-12-01',
    };
    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata));
    form.append('worker.js', new Blob([source], { type: 'application/javascript+module' }), 'worker.js');
    let res;
    try {
      res = await cfRequest(`/accounts/${encodeURIComponent(accountId)}/workers/scripts/${SCRIPT_NAME}`, token, { method: 'PUT', body: form }, true);
    } catch {
      return { error: t('cfErrApi') };
    }
    return res.errorKey ? { error: reasonFor(res) } : { ok: true };
  }

  async function enableSubdomain(accountId, token) {
    const base = `/accounts/${encodeURIComponent(accountId)}`;
    let enable;
    try {
      enable = await cfRequest(`${base}/workers/scripts/${SCRIPT_NAME}/subdomain`, token, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ enabled: true }) }, true);
    } catch {
      return { error: t('cfErrApi') };
    }
    if (enable.errorKey) return { error: reasonFor(enable) };
    let sub;
    try {
      sub = await cfRequest(`${base}/workers/subdomain`, token, { method: 'GET' }, true);
    } catch {
      return { error: t('cfErrApi') };
    }
    if (sub.errorKey) return { error: reasonFor(sub) };
    const subdomain = sub.data?.result?.subdomain;
    if (typeof subdomain !== 'string' || !/^[a-z0-9-]+$/i.test(subdomain)) return { error: t('cfErrNoSubdomain') };
    return { serverUrl: `https://${SCRIPT_NAME}.${subdomain}.workers.dev` };
  }

  async function checkHealth(serverUrl) {
    if (!cfFetch) return { ok: false, reason: t('cfErrNetwork') };
    let resp;
    try {
      resp = await cfFetch(serverUrl + '/api/health', { method: 'GET' });
    } catch {
      return { ok: false, reason: t('cfErrNetwork') };
    }
    if (!resp?.ok) return { ok: false, reason: t('cfErrHttp', resp?.status || t('unknown')) };
    try {
      const data = await resp.json();
      return data?.ok === true ? { ok: true, reason: '' } : { ok: false, reason: t('cfErrHealth') };
    } catch {
      return { ok: false, reason: t('cfErrHealth') };
    }
  }

  function startSetupStep(step) {
    view.setup = { state: 'running', step, reason: '', serverUrl: view.deployment?.serverUrl || '' };
    renderAll();
  }

  function failSetup(step, reason) {
    view.setup = { state: 'error', step, reason, serverUrl: view.deployment?.serverUrl || '' };
    renderAll();
    return { ok: false, step, reason };
  }

  async function setupServer() {
    if (view.setup?.state === 'running') return { ok: false, reason: t('cfSetupRunning', stepLabel(view.setup.step)) };
    let rec = null;
    try {
      rec = await readRecord();
    } catch {
      return failSetup('account', t('cfErrStorage'));
    }
    if (!rec?.token) return failSetup('account', t('cfErrNoToken'));

    startSetupStep('account');
    let account;
    try {
      account = await resolveAccount(rec);
    } catch {
      account = { error: t('cfErrApi') };
    }
    if (account.error) return failSetup('account', account.error);

    startSetupStep('kv');
    let kv;
    try {
      kv = await findOrCreateKv(account.accountId, rec.token);
    } catch {
      kv = { error: t('cfErrApi') };
    }
    if (kv.error) return failSetup('kv', kv.error);

    startSetupStep('source');
    let sourceRes;
    try {
      sourceRes = await fetchWorkerSource();
    } catch {
      sourceRes = { error: t('cfErrNetwork') };
    }
    if (sourceRes.error) return failSetup('source', sourceRes.error);

    startSetupStep('upload');
    let upload;
    try {
      upload = await uploadWorker(account.accountId, rec.token, kv.id, sourceRes.source);
    } catch {
      upload = { error: t('cfErrApi') };
    }
    if (upload.error) return failSetup('upload', upload.error);

    startSetupStep('subdomain');
    let sub;
    try {
      sub = await enableSubdomain(account.accountId, rec.token);
    } catch {
      sub = { error: t('cfErrApi') };
    }
    if (sub.error) return failSetup('subdomain', sub.error);

    startSetupStep('health');
    let health;
    try {
      health = await checkHealth(sub.serverUrl);
    } catch {
      health = { ok: false, reason: t('cfErrNetwork') };
    }
    const deployment = { serverUrl: sub.serverUrl, accountId: account.accountId, scriptName: SCRIPT_NAME, kvNamespaceId: kv.id, deployedAt: Date.now(), verified: health.ok === true };
    const next = { v: 1, token: rec.token, verified: rec.verified || null, deployment };
    let saved = false;
    try {
      saved = await writeRecord(next);
    } catch {
      saved = false;
    }
    if (!saved) return failSetup('health', t('cfErrStorage'));
    view.deployment = deployment;
    view.setup = health.ok
      ? { state: 'done', step: 'health', reason: '', serverUrl: sub.serverUrl }
      : { state: 'unverified', step: 'health', reason: health.reason || t('cfErrHealth'), serverUrl: sub.serverUrl };
    renderAll();
    return health.ok
      ? { ok: true, serverUrl: sub.serverUrl, deployment }
      : { ok: false, deployed: true, unverified: true, step: 'health', reason: health.reason || t('cfErrHealth'), serverUrl: sub.serverUrl, deployment };
  }

  async function disconnect() {
    try {
      await dbDel('settings', CLOUDFLARE_LINK_KEY);
    } catch {
      showToast(t('cfErrStorage'), 'error');
      return setError(t('cfErrStorage'));
    }
    view = { kind: 'none', hasToken: false, accounts: [], tokenStatus: '', reason: '', setup: emptySetup(), deployment: null };
    clearInputs();
    renderAll();
    showToast(t('cfDisconnected'), 'success');
    return { ok: true };
  }

  async function refresh() {
    let rec = null;
    try {
      rec = await readRecord();
    } catch {
      view = { kind: 'error', hasToken: view.hasToken, accounts: [], tokenStatus: '', reason: t('cfErrStorage'), setup: view.setup || emptySetup(), deployment: view.deployment || null };
      renderAll();
      return snapshot();
    }
    const setup = view.setup?.state === 'running' ? view.setup : emptySetup();
    if (!rec) view = { kind: 'none', hasToken: false, accounts: [], tokenStatus: '', reason: '', setup: emptySetup(), deployment: null };
    else if (rec.verified?.status) {
      view = { kind: 'connected', hasToken: true, accounts: [...rec.verified.accounts], tokenStatus: rec.verified.status, reason: '', setup, deployment: rec.deployment || null };
    } else view = { kind: 'saved', hasToken: true, accounts: [], tokenStatus: '', reason: '', setup, deployment: rec.deployment || null };
    renderAll();
    return snapshot();
  }

  function snapshot() {
    return {
      kind: view.kind,
      hasToken: view.hasToken,
      accounts: [...view.accounts],
      tokenStatus: view.tokenStatus,
      reason: view.reason,
      setup: { ...(view.setup || emptySetup()) },
      deployment: view.deployment ? { ...view.deployment } : null,
    };
  }

  function install() {
    scan();
    refresh();
    const b = body();
    if (b && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(scan);
      observer.observe(b, { childList: true });
    }
    return api;
  }

  const api = {
    install,
    scan,
    refresh,
    saveToken,
    save: saveToken,
    verify,
    verifyConnection: verify,
    setupServer,
    setup: setupServer,
    disconnect,
    snapshot,
    statusText,
    setupStatusText,
    destroy: () => observer?.disconnect(),
  };
  return api;
}
