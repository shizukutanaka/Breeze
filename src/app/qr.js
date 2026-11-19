// ISO 18004 byte-mode QR, ECC M, versions 1–40. No runtime dependencies.
const eccWords = [0,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
const blockCounts = [0,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];
function rawModules(version) {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}
export function encodeQR(text) {
  const data = new TextEncoder().encode(text);
  let version = 1, dataWords;
  for (; version <= 40; version++) {
    dataWords = Math.floor(rawModules(version) / 8) - eccWords[version] * blockCounts[version];
    if (4 + (version < 10 ? 8 : 16) + data.length * 8 <= dataWords * 8) break;
  }
  if (version > 40) throw new Error('rvQRTooLarge');
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(4, 4); push(data.length, version < 10 ? 8 : 16);
  for (const b of data) push(b, 8);
  push(0, Math.min(4, dataWords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const words = [];
  for (let i = 0; i < bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => a * 2 + b, 0));
  for (let pad = 0; words.length < dataWords; pad++) words.push(pad % 2 ? 0x11 : 0xec);
  const mul = (x, y) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z;
  };
  const degree = eccWords[version], blocks = blockCounts[version];
  let generator = [1], root = 1;
  for (let i = 0; i < degree; i++) {
    const next = new Array(generator.length + 1).fill(0);
    generator.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= mul(c, root); });
    generator = next; root = mul(root, 2);
  }
  const totalWords = Math.floor(rawModules(version) / 8);
  const shortLength = Math.floor(totalWords / blocks), shortBlocks = blocks - totalWords % blocks;
  const groups = [];
  let offset = 0;
  for (let i = 0; i < blocks; i++) {
    const length = shortLength - degree + (i < shortBlocks ? 0 : 1);
    const block = words.slice(offset, offset + length); offset += length;
    const rem = [...block, ...new Array(degree).fill(0)];
    for (let j = 0; j < length; j++) {
      const c = rem[j];
      generator.forEach((g, k) => { rem[j + k] ^= mul(g, c); });
    }
    groups.push({ data: block, ec: rem.slice(length) });
  }
  const all = [];
  for (let i = 0; i < shortLength - degree + 1; i++) for (const g of groups) if (i < g.data.length) all.push(g.data[i]);
  for (let i = 0; i < degree; i++) for (const g of groups) all.push(g.ec[i]);
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const used = modules.map(r => new Uint8Array(r.length));
  const put = (x, y, value) => { modules[y][x] = Number(!!value); used[y][x] = 1; };
  for (let i = 0; i < size; i++) { put(6, i, i % 2 === 0); put(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, ring = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && y >= 0 && x < size && y < size) put(x, y, ring !== 2 && ring !== 4);
    }
  }
  if (version >= 2) {
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
    const positions = [6];
    for (let p = size - 7; positions.length < count; p -= step) positions.splice(1, 0, p);
    for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) {
      if ((i === 0 && (j === 0 || j === count - 1)) || (i === count - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(positions[i] + dx, positions[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const format = mask => {
    let remainder = mask;
    for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const value = ((mask << 10) | remainder) ^ 0x5412;
    const bit = i => (value >>> i) & 1;
    for (let i = 0; i <= 5; i++) put(8, i, bit(i));
    put(8, 7, bit(6)); put(8, 8, bit(7)); put(7, 8, bit(8));
    for (let i = 9; i < 15; i++) put(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) put(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) put(8, size - 15 + i, bit(i));
    put(8, size - 8, 1);
  };
  format(0);
  if (version >= 7) {
    let remainder = version;
    for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    const value = (version << 12) | remainder;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + i % 3, b = Math.floor(i / 3);
      put(a, b, (value >>> i) & 1); put(b, a, (value >>> i) & 1);
    }
  }
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let dx = 0; dx < 2; dx++) {
      const x = right - dx, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (used[y][x]) continue;
      modules[y][x] = index < all.length * 8 ? (all[index >>> 3] >>> (7 - (index & 7))) & 1 : 0;
      index++;
    }
  }
  const masks = [(x,y)=>(x+y)%2===0, (x,y)=>y%2===0, x=>x%3===0, (x,y)=>(x+y)%3===0,
    (x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0, (x,y)=>x*y%2+x*y%3===0,
    (x,y)=>(x*y%2+x*y%3)%2===0, (x,y)=>((x+y)%2+x*y%3)%2===0];
  const applyMask = mask => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!used[y][x] && masks[mask](x,y)) modules[y][x] ^= 1; };
  const penalty = () => {
    let score = 0, dark = 0;
    for (let axis = 0; axis < 2; axis++) for (let a = 0; a < size; a++) {
      let run = 0, last = -1, history = '';
      for (let b = 0; b < size; b++) {
        const v = axis ? modules[b][a] : modules[a][b];
        run = v === last ? run + 1 : 1; last = v;
        if (run === 5) score += 3; else if (run > 5) score++;
        history = (history + v).slice(-11);
        if (history === '00001011101' || history === '10111010000') score += 40;
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = modules[y][x]; dark += v;
      if (x && y && v === modules[y-1][x] && v === modules[y][x-1] && v === modules[y-1][x-1]) score += 3;
    }
    return score + Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
  };
  let best = 0, minimum = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask); format(mask);
    const score = penalty();
    if (score < minimum) { minimum = score; best = mask; }
    applyMask(mask);
  }
  applyMask(best); format(best);
  return { modules, version, ecc: 'M' };
}

export function createQRHelper() {
  let closeCurrent;
  function generateQR(text) {
    const { modules, version, ecc } = encodeQR(text);
    const size = modules.length, scale = 4, margin = 4;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = (size + margin * 2) * scale;
    canvas.setAttribute?.('aria-label', t('scanQR'));
    if (canvas.dataset) { canvas.dataset.version = version; canvas.dataset.ecc = ecc; }
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    return canvas;
  }

  function startScan({ container, onResult, onError }) {
    let stopped = false, stream, video, frame;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
      video?.remove();
    };
    const start = async () => {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (stopped) { stop(); return; }
      video = document.createElement('video');
      video.autoplay = true; video.playsInline = true; video.className = 'scan-video';
      const scan = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          if (stopped) return;
          if (codes.length) { stop(); onResult(codes[0].rawValue); return; }
          frame = requestAnimationFrame(scan);
        } catch(e) { stop(); onError(e); }
      };
      video.onloadedmetadata = scan;
      video.srcObject = stream;
      container.appendChild(video);
    };
    start().catch(e => { if (!stopped) { stop(); onError(e); } });
    return stop;
  }

  function showQRModal(url) {
    closeCurrent?.();
    const modal = document.createElement('div'), card = document.createElement('div');
    modal.className = 'upgrade-overlay'; card.className = 'qr-modal';
    const title = document.createElement('div'); title.className = 'cmd-title'; title.textContent = t('uiShareId');
    let qr;
    try { qr = generateQR(url); }
    catch { qr = document.createElement('p'); qr.textContent = t('rvQRTooLarge'); }
    qr.className = 'qr-code';
    const urlDiv = document.createElement('div'); urlDiv.className = 'qr-url'; urlDiv.textContent = url;
    const copyBtn = document.createElement('button'); copyBtn.className = 'btn btn-g i-w100 i-mb8'; copyBtn.textContent = t('uiCopyLink');
    copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(url); copyBtn.textContent = t('uiCopied'); }
      catch(e) { _dbg(e, 'qr-copy'); showToast(t('rvCopyFallback'), 'info'); }
    };
    const closeBtn = document.createElement('button'); closeBtn.className = 'btn btn-o i-w100'; closeBtn.textContent = t('uiClose');
    let stop;
    const close = () => { stop?.(); modal.remove(); document.removeEventListener('keydown', key); };
    closeCurrent = close;
    const key = e => { if (e.key === 'Escape') close(); };
    closeBtn.onclick = close;
    card.append(title, qr, urlDiv, copyBtn);
    if (typeof BarcodeDetector !== 'undefined') {
      const scanBtn = document.createElement('button'); scanBtn.className = 'btn btn-o i-w100 i-mb8'; scanBtn.textContent = t('scanQR');
      scanBtn.onclick = () => {
        scanBtn.disabled = true;
        stop = startScan({ container: card, onResult: value => {
          close();
          if (value.includes('?add=')) window.location.href = value;
          else showToast(t('toastInvalidQR'), 'error');
        }, onError: e => { _dbg(e, 'qr-scan'); scanBtn.disabled = false; showToast(t('toastCameraFail'), 'error'); } });
      };
      card.appendChild(scanBtn);
    }
    card.appendChild(closeBtn); modal.appendChild(card);
    modal.onclick = e => { if (e.target === modal) close(); };
    document.body.appendChild(modal);
    document.addEventListener('keydown', key);
  }
  return { generateQR, showQRModal, startScan };
}
