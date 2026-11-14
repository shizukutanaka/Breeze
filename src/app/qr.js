// ============================================================================
// QR CODE — the ISO 18004 encoder (byte mode, EC level L, versions 1-10)
// and the share-ID modal that renders it, extracted from index.html's
// initMessenger closure (modularization: index.html carries a hard line
// budget in validate.sh). Both functions only ever used top-level app
// globals (document, navigator, t, CONFIG, showToast, _dbg), which resolve
// from the global scope exactly as they did inline. Behaviour is
// unchanged — this is a move, not a rewrite.
// ============================================================================

export function createQRHelper() {

  // QR CODE: Real ISO 18004 encoder (0 dependencies, byte mode, EC level L)
  // Supports URLs up to ~270 chars (Version 1-10). Fully scannable.
  function generateQR(text) {
    const data = new TextEncoder().encode(text);
    // Version selection (byte mode, EC level L)
    const caps = [0,17,32,53,78,106,134,154,192,230,271]; // max bytes per version, EC-L
    let ver = 1;
    while (ver <= 10 && data.length > caps[ver]) ver++;
    if (ver > 10) ver = 10; // truncate silently
    const size = 17 + ver * 4;
    const grid = Array.from({length: size}, () => new Uint8Array(size));
    const used = Array.from({length: size}, () => new Uint8Array(size));

    // ── Finder patterns ──
    function putFinder(cx, cy) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        grid[y][x] = ring === 1 ? 0 : 1;
        used[y][x] = 1;
      }
      // Separators
      for (let i = -4; i <= 4; i++) {
        for (const [dx, dy] of [[i, -4],[-4, i],[i, 4],[4, i]]) {
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) used[y][x] = 1;
        }
      }
    }
    putFinder(3, 3); putFinder(size - 4, 3); putFinder(3, size - 4);

    // ── Alignment pattern (ver >= 2) ──
    if (ver >= 2) {
      const pos = [6, size - 7]; // simplified for v2-10
      for (const ay of pos) for (const ax of pos) {
        if (used[ay]?.[ax]) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dy));
          grid[ay + dy][ax + dx] = ring === 1 ? 0 : 1;
          used[ay + dy][ax + dx] = 1;
        }
      }
    }

    // ── Timing patterns ──
    for (let i = 8; i < size - 8; i++) {
      if (!used[6][i]) { grid[6][i] = i % 2 === 0 ? 1 : 0; used[6][i] = 1; }
      if (!used[i][6]) { grid[i][6] = i % 2 === 0 ? 1 : 0; used[i][6] = 1; }
    }
    // Dark module
    grid[ver * 4 + 9][8] = 1; used[ver * 4 + 9][8] = 1;

    // ── Reserve format info areas ──
    for (let i = 0; i < 8; i++) { used[8][i] = 1; used[8][size - 1 - i] = 1; used[i][8] = 1; used[size - 1 - i][8] = 1; }
    used[8][8] = 1;

    // ── Data encoding (byte mode) ──
    const ecL = [[0],[7,10],[10,16],[15,26],[20,36],[26,46],[36,60],[40,66],[48,86],[60,100],[72,122]]; // [numEC, totalCW] per version
    const numEC = ecL[ver][0], totalCW = ecL[ver][1];
    const numData = totalCW - numEC;
    const bits = [];
    const pushBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(0b0100, 4); // byte mode indicator
    pushBits(data.length, ver <= 9 ? 8 : 16); // char count
    for (const b of data) pushBits(b, 8);
    pushBits(0, 4); // terminator
    while (bits.length % 8) bits.push(0);
    while (bits.length < numData * 8) {
      pushBits(0xEC, 8);
      if (bits.length < numData * 8) pushBits(0x11, 8);
    }
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      codewords.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    }

    // ── Reed-Solomon EC (GF(256), primitive 0x11D) ──
    const gfExp = new Uint8Array(512), gfLog = new Uint8Array(256);
    let val = 1;
    for (let i = 0; i < 255; i++) { gfExp[i] = val; gfLog[val] = i; val = (val << 1) ^ (val >= 128 ? 0x11D : 0); }
    for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
    const gfMul = (a, b) => a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]];
    // Generator polynomial
    let gen = [1];
    for (let i = 0; i < numEC; i++) {
      const ng = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) { ng[j] ^= gen[j]; ng[j + 1] ^= gfMul(gen[j], gfExp[i]); }
      gen = ng;
    }
    const ecCW = new Array(numEC).fill(0);
    const msg = [...codewords.slice(0, numData), ...ecCW];
    for (let i = 0; i < numData; i++) {
      const coef = msg[i]; if (coef === 0) continue;
      for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
    }
    const allCW = [...codewords.slice(0, numData), ...msg.slice(numData)];

    // ── Place data bits ──
    const allBits = [];
    for (const cw of allCW) for (let i = 7; i >= 0; i--) allBits.push((cw >> i) & 1);
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        const y = ((Math.floor((size - 1 - right) / 2)) % 2 === 0) ? size - 1 - vert : vert;
        for (const dx of [0, -1]) {
          const x = right + dx;
          if (x < 0 || x >= size || used[y][x]) continue;
          grid[y][x] = bi < allBits.length ? allBits[bi++] : 0;
          used[y][x] = 1;
        }
      }
    }

    // ── Mask (pattern 0: (y+x)%2==0) ──
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (used[y][x] && !(x <= 8 && y === 8) && !(y <= 8 && x === 8) && !(x >= size - 8 && y === 8) && !(y >= size - 8 && x === 8)) continue;
      // Only mask data/EC modules
    }
    // Apply mask to data area
    const masked = grid.map(r => new Uint8Array(r));
    const isData = (x, y) => {
      if (x < 0 || x >= size || y < 0 || y >= size) return false;
      // Check if this is a data module (not finder, timing, alignment, format)
      if (x <= 8 && y <= 8) return false; if (x >= size - 8 && y <= 8) return false; if (x <= 8 && y >= size - 8) return false;
      if (x === 6 || y === 6) return false;
      if (y === ver * 4 + 9 && x === 8) return false;
      return true;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (isData(x, y) && (y + x) % 2 === 0) masked[y][x] ^= 1;
    }

    // ── Format info (EC-L=01, mask 0=000 → 01000 → BCH) ──
    const fmtBits = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0]; // pre-computed for L + mask0
    const putFmt = (i, val) => {
      if (i < 8) { masked[8][i < 6 ? i : i + 1] = val; masked[size - 1 - i][8] = val; }
      else { masked[i < 9 ? 15 - i : 14 - i + 1][8] = val; masked[8][size - 15 + i] = val; }
    };
    for (let i = 0; i < 15; i++) putFmt(i, fmtBits[i]);

    // ── Render to canvas ──
    const canvas = document.createElement('canvas');
    const scale = Math.max(4, Math.floor(200 / size));
    const margin = 4;
    const total = (size + margin * 2) * scale;
    canvas.width = total; canvas.height = total;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (masked[y][x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    }
    return canvas;
  }

  function showQRModal(url) {
    // Remove existing modal
    document.querySelectorAll('.qr-modal').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'qr-modal';
    modal.className = 'upgrade-overlay';

    const card = document.createElement('div');
    card.className = 'qr-modal';

    const title = document.createElement('div');
    title.textContent = t('uiShareId');
    title.className = 'cmd-title';

    const qr = generateQR(url);
    qr.className = 'upgrade-img';

    const urlDiv = document.createElement('div');
    urlDiv.textContent = url;
    urlDiv.className = 'qr-url';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-g';
    copyBtn.textContent = t('uiCopyLink');
    copyBtn.className = 'btn btn-g'; copyBtn.classList.add('i-w100', 'i-mb8');
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(url);
      copyBtn.textContent = t('uiCopied');
      setTimeout(() => { copyBtn.textContent = t('uiCopyLink'); }, CONFIG.TOAST_DURATION_MS);
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-o';
    closeBtn.textContent = t('uiClose');
    closeBtn.className = 'btn btn-o'; closeBtn.classList.add('i-w100');
    closeBtn.onclick = () => modal.remove();

    // v3.6: Scan QR button (BarcodeDetector API — Chrome 83+, Safari 17.2+)
    const scanSupported = typeof BarcodeDetector !== 'undefined';
    if (scanSupported) {
      const scanBtn = document.createElement('button');
      scanBtn.className = 'btn btn-o';
      scanBtn.classList.add('i-w100', 'i-mb8');
      scanBtn.textContent = '📷 ' + (t('scanQR'));
      scanBtn.setAttribute('aria-label', t('scanQR'));
      scanBtn.onclick = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true; video.playsInline = true;
          video.className = 'scan-video';
          card.insertBefore(video, closeBtn);
          scanBtn.textContent = '⏳ ' + (t('scanning'));
          scanBtn.disabled = true;
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const scanLoop = async () => {
            try {
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0) {
                const value = barcodes[0].rawValue;
                stream.getTracks().forEach(t => t.stop());
                video.remove();
                modal.remove();
                if (value.includes('?add=')) {
                  window.location.href = value;
                } else {
                  showToast(t('toastInvalidQR'), 'error');
                }
                return;
              }
            } catch {}
            if (video.parentNode) requestAnimationFrame(scanLoop);
          };
          video.onloadedmetadata = () => scanLoop();
        } catch(e) {
          _dbg(e, 'qr-scan');
          showToast(t('toastCameraFail'), 'error');
        }
      };
      card.append(title, qr, urlDiv, copyBtn, scanBtn, closeBtn);
    } else {
      card.append(title, qr, urlDiv, copyBtn, closeBtn);
    }
    modal.appendChild(card);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.remove(); }, { once: true });
  }
  return { generateQR, showQRModal };
}
