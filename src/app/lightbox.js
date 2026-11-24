// ============================================================================
// Image Lightbox + Lazy Image Observer
// Extracted verbatim from index.html's initMessenger() to relieve the 16k-line
// cap without changing behavior. Loaded as an ESM bridge (window.__breezeLightbox);
// if the module is absent, index.html degrades cleanly to a no-op stub.
// ============================================================================

export function createLightbox({ t, isTouch = false, signal } = {}) {
  // v3.2: IntersectionObserver for lazy image loading in chat
  const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target.dataset.src) {
        entry.target.src = entry.target.dataset.src;
        delete entry.target.dataset.src;
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '200px' }) : null;

  function showLightbox(src) {
    // v3.3: XSS-safe: use DOM API, validate URL scheme
    if (!src || (!src.startsWith('blob:') && !src.startsWith('data:') && !src.startsWith('https:'))) return;
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    const img = document.createElement('img');
    img.decoding = 'async';
    img.src = src;
    img.alt = t('fullSizeImage');
    // Closing via backdrop click or an image load error used to leave this keydown
    // listener attached to document forever — same leak class as showContextMenu/
    // showMsgMenu. Route every exit path through one cleanup.
    const handler = (e) => { if (e.key === 'Escape') cleanup(); };
    function cleanup() { lb.remove(); document.removeEventListener('keydown', handler); }
    img.onerror = cleanup;
    lb.appendChild(img);
    lb.onclick = (e) => { if (e.target === lb) cleanup(); };
    document.body.appendChild(lb);
    document.addEventListener('keydown', handler, signal ? { signal } : undefined);

    // v3.6: Mobile pinch-to-zoom + drag
    if (isTouch) {
      let scale = 1, lastScale = 1, posX = 0, posY = 0, lastDist = 0;
      let startX = 0, startY = 0, isDragging = false;

      img.classList.add('i-no-touch');

      const getDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

      img.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          lastDist = getDistance(e.touches);
        } else if (e.touches.length === 1 && scale > 1) {
          isDragging = true;
          startX = e.touches[0].clientX - posX;
          startY = e.touches[0].clientY - posY;
        }
      }, { passive: false });

      img.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const dist = getDistance(e.touches);
          scale = Math.max(0.5, Math.min(5, lastScale * (dist / lastDist)));
          img.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        } else if (e.touches.length === 1 && isDragging && scale > 1) {
          posX = e.touches[0].clientX - startX;
          posY = e.touches[0].clientY - startY;
          img.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        }
      }, { passive: false });

      img.addEventListener('touchend', (e) => {
        isDragging = false;
        if (e.touches.length < 2) lastScale = scale;
        // Reset if zoomed out too far
        if (scale < 0.8) { scale = 1; lastScale = 1; posX = 0; posY = 0; img.style.transform = ''; }
        // Swipe down to dismiss (when not zoomed)
        if (scale <= 1 && posY > 80) cleanup();
      }, { passive: true });

      // Double-tap to zoom
      let lastTap = 0;
      img.addEventListener('touchend', (e) => {
        if (e.touches.length > 0) return;
        const now = Date.now();
        if (now - lastTap < 300) {
          if (scale > 1) { scale = 1; lastScale = 1; posX = 0; posY = 0; img.style.transform = ''; }
          else { scale = 2.5; lastScale = 2.5; img.style.transform = `scale(${scale})`; }
        }
        lastTap = now;
      }, { passive: true });
    }
  }

  return { observer, showLightbox };
}
