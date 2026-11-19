const PREFIX = 'breeze-sdp1:';
const COMPRESSED_PREFIX = 'breeze-sdp1z:';
export const MAX_CODE_SIZE = 65536;
export const MAX_ENVELOPE_SIZE = 65536;
const noncePattern = /^[A-Za-z0-9_-]{22}$/;
const fail = key => { throw new Error(key); };
const encode = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function inflate(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ENVELOPE_SIZE) fail('rvInvalid');
      chunks.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  } finally { reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function encodeEnvelope(envelope) {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  if (bytes.length > MAX_ENVELOPE_SIZE) fail('rvInvalid');
  let prefix = PREFIX, encoded = bytes;
  if (typeof CompressionStream !== 'undefined') {
    try {
      encoded = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
      prefix = COMPRESSED_PREFIX;
    } catch { /* Older browsers retain the copy/paste format. */ }
  }
  const code = prefix + encode(encoded);
  if (code.length > MAX_CODE_SIZE) fail('rvInvalid');
  return code;
}

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

export function createEnvelopeCodec({ sign, verify, MS, now = Date.now, random = bytes => crypto.getRandomValues(bytes) }) {
  const seen = new Set();
  async function build({ kind, from, to, desc, sigPub, offerNonce }) {
    const envelope = { v: 1, kind, from, to, nonce: encode(random(new Uint8Array(16))), exp: now() + 10 * MS.MIN,
      desc: { type: desc.type, sdp: desc.sdp }, sigPub };
    if (kind === 'answer') envelope.offerNonce = offerNonce;
    envelope.sig = await sign(canonical(envelope));
    if (!envelope.sig) fail('rvTrust');
    return { code: await encodeEnvelope(envelope), envelope };
  }
  async function parse(code, { kind, from, to, sigPub, offerNonce }) {
    let e;
    try {
      if (typeof code !== 'string' || code.length > MAX_CODE_SIZE) fail('rvInvalid');
      const compressed = code.startsWith(COMPRESSED_PREFIX);
      if (!compressed && !code.startsWith(PREFIX)) fail('rvInvalid');
      const body = code.slice(compressed ? COMPRESSED_PREFIX.length : PREFIX.length);
      if (!/^[A-Za-z0-9_-]+$/.test(body)) fail('rvInvalid');
      let bytes = Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      if (compressed) bytes = await inflate(bytes);
      if (bytes.length > MAX_ENVELOPE_SIZE) fail('rvInvalid');
      e = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch { fail('rvInvalid'); }
    const fields = ['v', 'kind', 'from', 'to', 'nonce', 'exp', 'desc', 'sigPub', 'sig', ...(kind === 'answer' ? ['offerNonce'] : [])].sort();
    if (!e || canonical(Object.keys(e).sort()) !== canonical(fields) || e.v !== 1 || e.kind !== kind ||
        !noncePattern.test(e.nonce) || !e.desc || e.desc.type !== kind || typeof e.desc.sdp !== 'string' ||
        canonical(Object.keys(e.desc).sort()) !== canonical(['sdp', 'type']) || !e.desc.sdp ||
        !Number.isSafeInteger(e.exp) || typeof e.sig !== 'string' || !e.sig) fail('rvInvalid');
    if (e.from !== from || e.to !== to || !sigPub || e.sigPub !== sigPub) fail('rvTrust');
    if (e.exp <= now() || e.exp > now() + 10 * MS.MIN) fail('rvExpired');
    if (seen.has(e.nonce)) fail('rvReplay');
    if (kind === 'answer' && (!noncePattern.test(offerNonce) || e.offerNonce !== offerNonce)) fail('rvInvalid');
    const { sig, ...signed } = e;
    if (await verify(canonical(signed), sig, sigPub) !== true) fail('rvTrust');
    if (seen.has(e.nonce)) fail('rvReplay');
    seen.add(e.nonce);
    return e;
  }
  return { build, parse };
}

export function gatherDescription(pc, { MS, relayOnly, timeout = MS.MIN }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      pc.removeEventListener('connectionstatechange', closed);
      if (error) { reject(new Error(error)); return; }
      const desc = pc.localDescription;
      let candidates = 0;
      const sdp = desc.sdp.split(/\r?\n/).filter(line => {
        if (!line.startsWith('a=candidate:')) return true;
        const parts = line.split(/\s+/), type = parts[7], address = parts[4];
        if ((type === 'host' && address && !address.includes('.local')) || (relayOnly && (type === 'srflx' || type === 'prflx'))) return false;
        candidates++;
        return true;
      }).join('\r\n');
      if (!candidates) { reject(new Error('rvCandidates')); return; }
      resolve({ type: desc.type, sdp });
    };
    const check = () => { if (pc.iceGatheringState === 'complete') finish(); };
    const closed = () => { if (pc.connectionState === 'closed') finish('rvRedo'); };
    const timer = setTimeout(() => finish('rvTimeout'), timeout);
    pc.addEventListener('icegatheringstatechange', check);
    pc.addEventListener('connectionstatechange', closed);
    if (pc.connectionState === 'closed') closed(); else check();
  });
}

export function attachManualPeer(peer, { MS, relayOnly, notify }) {
  const pc = peer.pc;
  peer.manual = true;
  peer.manualRecovery = () => { if (!peer._manualNotified) { peer._manualNotified = true; notify(); } };
  pc.restartIce = peer.manualRecovery;
  pc.onnegotiationneeded = () => { if (peer.connected) peer.manualRecovery(); };
  const local = async () => {
    await pc.setLocalDescription();
    return gatherDescription(pc, { MS, relayOnly });
  };
  peer.manualOffer = local;
  peer.manualAnswer = async desc => { await pc.setRemoteDescription(desc); return local(); };
  peer.manualApply = async desc => { if (pc.signalingState !== 'have-local-offer') fail('rvInvalid'); await pc.setRemoteDescription(desc); };
  return peer;
}

export function createRendezvous(D) {
  const codec = createEnvelopeCodec({ sign: D.sign, verify: D.verify, MS: D.MS });
  let showing = false;
  async function open(contact) {
    if (showing) return;
    if (!contact || contact.isGroup) { D.toast(D.t('use1to1')); return; }
    showing = true;
    try {
      const stored = await D.contact(contact.id);
      if (!stored?.sigPub || (!await D.session(contact.id) && !D.pending?.(stored)) || !D.sigPub()) fail('rvTrust');
      const dlg = document.createElement('dialog');
      dlg.className = 'rendezvous-dialog';
      const titleId = 'rv-' + crypto.randomUUID();
      dlg.setAttribute('aria-labelledby', titleId);
      D.safeSetHTML(dlg, `<div class="modal-title" id="${titleId}">${D.esc(D.t('rvTitle'))}</div>
        <p>${D.esc(D.t('rvScope'))}</p>
        <div class="modal-actions"><button class="btn btn-g btn-sm" data-rv="offer">${D.esc(D.t('rvCreate'))}</button>
        <button class="btn btn-o btn-sm" data-rv="paste">${D.esc(D.t('rvPaste'))}</button></div>
        <p data-rv="status" role="status"></p>
        <div class="rv-code"><div data-rv="output-wrap"></div><div data-rv="qr"></div></div>
        <button class="btn btn-o btn-sm" data-rv="copy">${D.esc(D.t('rvCopy'))}</button>
        <div data-rv="input-wrap"></div>
        <button class="btn btn-o btn-sm" data-rv="scan">${D.esc(D.t('scanQR'))}</button><p data-rv="scan-status" role="status"></p><div data-rv="camera"></div>
        <div class="modal-actions"><button class="btn btn-g btn-sm" data-rv="apply">${D.esc(D.t('rvApply'))}</button>
        <button class="btn btn-o btn-sm" data-rv="close">${D.esc(D.t('uiClose'))}</button></div>`);
      const el = name => dlg.querySelector(`[data-rv="${name}"]`);
      for (const name of ['output', 'input']) {
        const label = document.createElement('label'), field = document.createElement('textarea');
        label.textContent = D.t(name === 'output' ? 'rvOutput' : 'rvInput');
        field.className = 'modal-input'; field.dataset.rv = name; field.rows = 3;
        field.readOnly = name === 'output'; field.maxLength = MAX_CODE_SIZE;
        label.appendChild(field); el(name + '-wrap').appendChild(label);
      }
      let pending, peer, stopScan, step = 'offer', closed = false, busy = false;
      const output = code => {
        el('output').value = code;
        el('qr').replaceChildren();
        if (!code) return;
        try {
          if (!D.qr) fail('rvQRTooLarge');
          const canvas = D.qr.generateQR(code); canvas.className = 'qr-code'; el('qr').appendChild(canvas);
        } catch { el('qr').textContent = D.t('rvQRTooLarge'); }
      };
      const canScan = !!D.qr?.startScan && typeof BarcodeDetector !== 'undefined';
      el('scan').disabled = !canScan;
      if (!canScan) el('scan-status').textContent = D.t('rvScanUnavailable');
      peer = await D.connect(stored);
      const cleanup = () => { if (peer && !peer.connected && step !== 'done') D.closePeer(stored, peer); };
      const run = async action => {
        if (busy) return;
        busy = true;
        stopScan?.(); stopScan = null;
        for (const name of ['offer', 'paste', 'apply', 'scan']) el(name).disabled = true;
        el('status').textContent = D.t('rvWorking');
        try { await action(); if (!closed) el('status').textContent = D.t('rvReady'); }
        catch(e) { if (!closed) el('status').textContent = D.t(e.message.startsWith('rv') ? e.message : 'rvInvalid'); }
        finally { busy = false; if (!closed) { for (const name of ['offer', 'paste', 'apply']) el(name).disabled = false; el('scan').disabled = !canScan; } }
      };
      const build = async (kind, desc, offerNonce) => codec.build({ kind, desc, offerNonce, from: D.me(), to: stored.pubB64, sigPub: D.sigPub() });
      const parse = kind => codec.parse(el('input').value.trim(), { kind, from: stored.pubB64, to: D.me(), sigPub: stored.sigPub, offerNonce: pending?.nonce });
      el('offer').onclick = () => run(async () => {
        step = 'offer'; pending = null;
        peer = await D.connect(stored);
        if (closed) { cleanup(); return; }
        const result = await build('offer', await peer.manualOffer());
        if (closed) return;
        pending = result.envelope; step = 'answer'; output(result.code);
      });
      el('paste').onclick = () => { stopScan?.(); stopScan = null; cleanup(); peer = null; pending = null; step = 'offer'; output(''); el('input').value = ''; el('input').focus(); };
      el('apply').onclick = () => run(async () => {
        const envelope = await parse(step);
        if (closed) return;
        if (step === 'answer') { await peer.manualApply(envelope.desc); pending = null; step = 'done'; }
        else if (step === 'offer') {
          peer = await D.connect(stored);
          if (closed) { cleanup(); return; }
          const result = await build('answer', await peer.manualAnswer(envelope.desc), envelope.nonce);
          if (!closed) { output(result.code); step = 'done'; }
        } else fail('rvInvalid');
      });
      el('scan').onclick = () => {
        stopScan?.();
        el('scan').disabled = true;
        el('scan-status').textContent = D.t('scanning');
        stopScan = D.qr.startScan({ container: el('camera'), onResult: value => {
          if (closed) return;
          el('scan-status').textContent = ''; el('input').value = value; el('apply').click();
        }, onError: () => { if (!closed) { el('scan').disabled = false; el('scan-status').textContent = D.t('toastCameraFail'); } } });
      };
      el('copy').onclick = async () => {
        try { await navigator.clipboard.writeText(el('output').value); el('status').textContent = D.t('rvCopied'); }
        catch { el('output').focus(); el('output').select(); el('status').textContent = D.t('rvCopyFallback'); }
      };
      dlg.addEventListener('close', () => { closed = true; stopScan?.(); cleanup(); dlg.remove(); showing = false; });
      el('close').onclick = () => dlg.close();
      D.root().appendChild(dlg);
      dlg.showModal();
    } catch(e) { showing = false; D.toast(D.t(e.message === 'rvTrust' ? 'rvTrust' : 'rvInvalid')); }
  }
  return { open };
}
