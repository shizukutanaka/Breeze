// PWA one-click install prompt + iOS/Desktop install banner extracted from index.html.
//
// Initialized once after module bridges load (_appModulesReady).
// Absent module ⇒ no-op in index.html so the rest of the app still boots.

export function initInstallBanner(D) {
  const { DOM, MS, t, esc, safeSetHTML, showToast } = D;

  let _installPrompt = null;
  let _installBannerDismissed = false;

  // v3.6: Engagement gate (3+ msgs or 2+ visits), computed once so this + the fallback below don't double-count a visit.
  const _visits = parseInt(localStorage.getItem('brz-visit-count') || '0') + 1;
  localStorage.setItem('brz-visit-count', String(_visits));
  const _isEngagedVisitor = _visits >= 2 || parseInt(localStorage.getItem('brz-msgs-sent') || '0') >= 3;

  function showInstallBanner() {
    if (document.querySelector('.install-banner')) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMac = /Macintosh|Mac OS/.test(navigator.userAgent);
    const isWin = /Windows/.test(navigator.userAgent);
    const isLinux = /Linux/.test(navigator.userAgent) && !isAndroid;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isElectron = typeof window !== 'undefined' && window.process?.versions?.electron;
    if (isStandalone || isElectron) return;

    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'alert');

    if (_installPrompt) {
      // Chrome/Edge on Android, Windows, Mac, Linux — one-click install
      const platform = isAndroid ? t('installPlatformPhone') : isMac ? 'Mac' : isWin ? 'PC' : t('installPlatformDevice');
      safeSetHTML(banner, `
        <div class="icon">B</div>
        <div class="text"><b>${esc(t('installBannerTitle'))}</b>${esc(t('installBannerPlatform', platform))}</div>
        <button class="btn btn-g btn-sm" id="install-btn">${esc(t('installBannerInstallBtn'))}</button>
        <button class="dismiss">&times;</button>
      `);
      banner.querySelector('.dismiss').setAttribute('aria-label', t('dismiss'));
      banner.querySelector('#install-btn').onclick = async () => {
        banner.remove();
        _installPrompt.prompt();
        const result = await _installPrompt.userChoice;
        _installPrompt = null;
        if (result.outcome === 'accepted') showToast(t('toastInstalling'), 'success');
      };
    } else if (isIOS) {
      safeSetHTML(banner, `
        <div class="icon">B</div>
        <div class="text"><b>${esc(t('installBannerTitle'))}</b>${esc(t('installBannerIOSTip'))}</div>
        <button class="dismiss">&times;</button>
      `);
      banner.querySelector('.dismiss').setAttribute('aria-label', t('dismiss'));
    } else if (isMac || isWin || isLinux) {
      // Desktop browsers without beforeinstallprompt (Safari, Firefox)
      // Show download option for native app
      const os = isMac ? 'macOS' : isWin ? 'Windows' : 'Linux';
      safeSetHTML(banner, `
        <div class="icon">B</div>
        <div class="text"><b>${esc(t('installBannerDesktopTitle', os))}</b>${esc(t('installBannerDesktopSub'))}</div>
        <button class="btn btn-g btn-sm" id="install-dl-btn">${esc(t('installBannerDownload'))}</button>
        <button class="dismiss">&times;</button>
      `);
      banner.querySelector('.dismiss').setAttribute('aria-label', t('dismiss'));
      banner.querySelector('#install-dl-btn').onclick = () => {
        const base = 'https://github.com/shizukutanaka/Breeze/releases/latest/download/';
        const file = isMac ? 'Breeze-mac.dmg' : isWin ? 'Breeze-win-x64.exe' : 'Breeze-linux-x64.AppImage';
        window.open(base + file, '_blank', 'noopener,noreferrer');
        banner.remove();
      };
    } else {
      return;
    }

    banner.querySelector('.dismiss').onclick = () => {
      banner.remove();
      _installBannerDismissed = true;
      try { localStorage.setItem('brz-install-dismissed', String(Date.now())); } catch {}
    };

    // v3.6: Check cooldown (7 days) instead of session-only
    try {
      const dismissed = parseInt(localStorage.getItem('brz-install-dismissed') || '0');
      if (dismissed && Date.now() - dismissed < MS.WEEK) return;
    } catch {}
    document.body.appendChild(banner);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _installPrompt = e;
    const setupBtn = DOM.get('setup-install-btn');
    if (setupBtn) {
      setupBtn.classList.remove('hidden');
      setupBtn.onclick = async () => {
        _installPrompt.prompt();
        const r = await _installPrompt.userChoice;
        _installPrompt = null;
        if (r.outcome === 'accepted') showToast(t('toastInstalling'), 'success');
        setupBtn.classList.add('hidden');
      };
    }
    if (!window.matchMedia('(display-mode: standalone)').matches && !_installBannerDismissed && _isEngagedVisitor) {
      setTimeout(() => showInstallBanner(), 5 * MS.SEC);
    }
  });

  // Fallback for iOS/Safari/Firefox (no beforeinstallprompt); also gated on _isEngagedVisitor.
  if (!window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone && _isEngagedVisitor) {
    setTimeout(() => {
      if (!_installBannerDismissed && !_installPrompt) showInstallBanner();
    }, 3000);
  }

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    _installPrompt = null;
    document.querySelector('.install-banner')?.remove();
    showToast(t('toastInstalled'), 'success');
  });

  return { showInstallBanner };
}
