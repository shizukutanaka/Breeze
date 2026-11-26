// PWA one-click install prompt + iOS/Desktop install banner extracted from index.html.
//
// Initialized once after module bridges load (_appModulesReady).
// Absent module ⇒ no-op in index.html so the rest of the app still boots.

export function initInstallBanner(D) {
  const { DOM, MS, t, esc, safeSetHTML, showToast, dbg } = D;

  let _installPrompt = null;
  let _installBannerDismissed = false;

  // v3.6: Engagement gate (3+ msgs or 2+ visits), computed once so this + the fallback below don't double-count a visit.
  const _visits = parseInt(localStorage.getItem('brz-visit-count') || '0') + 1;
  localStorage.setItem('brz-visit-count', String(_visits));
  const _isEngagedVisitor = _visits >= 2 || parseInt(localStorage.getItem('brz-msgs-sent') || '0') >= 3;

  function isInstalledRuntime() {
    if (typeof window === 'undefined') return false;
    const isStandalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || window.navigator?.standalone;
    const isElectron = window.process?.versions?.electron;
    return !!(isStandalone || isElectron);
  }

  async function runInstallPrompt() {
    const installPrompt = _installPrompt;
    if (!installPrompt) return false;
    document.querySelector('.install-banner')?.remove();
    try {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result?.outcome === 'accepted') showToast(t('toastInstalling'), 'success');
    } catch (e) { dbg?.(e, 'install-prompt'); }
    if (_installPrompt === installPrompt) _installPrompt = null;
    return true;
  }

  function requestInstall() {
    if (isInstalledRuntime()) return Promise.resolve(false);
    if (_installPrompt) return runInstallPrompt();
    if (showInstallBanner(true)) return Promise.resolve(true);
    showToast(t('toastInstallManual'));
    return Promise.resolve(false);
  }

  function hideSettingsInstallButtons() {
    document.querySelectorAll?.('#settings-install-btn')?.forEach((btn) => {
      (btn.closest?.('.settings-action-row') || btn).classList?.add('hidden');
    });
  }

  function showInstallBanner(force = false) {
    if (document.querySelector('.install-banner')) return true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMac = /Macintosh|Mac OS/.test(navigator.userAgent);
    const isWin = /Windows/.test(navigator.userAgent);
    const isLinux = /Linux/.test(navigator.userAgent) && !isAndroid;
    if (isInstalledRuntime()) return false;

    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'alert');

    if (_installPrompt) {
      // Chrome/Edge on Android, Windows, Mac, Linux — one-click install
      const platform = isAndroid ? t('installPlatformPhone') : isMac ? 'Mac' : isWin ? 'PC' : t('installPlatformDevice');
      safeSetHTML(banner, `
        <div class="icon"><img src="icon-192.png" alt="" width="44" height="44"></div>
        <div class="text"><b>${esc(t('installBannerTitle'))}</b>${esc(t('installBannerPlatform', platform))}</div>
        <button class="btn btn-g btn-sm" id="install-btn">${esc(t('installBannerInstallBtn'))}</button>
        <button class="dismiss">&times;</button>
      `);
      banner.querySelector('.dismiss').setAttribute('aria-label', t('dismiss'));
      banner.querySelector('#install-btn').onclick = () => { runInstallPrompt(); };
    } else if (isIOS) {
      safeSetHTML(banner, `
        <div class="icon"><img src="icon-192.png" alt="" width="44" height="44"></div>
        <div class="text"><b>${esc(t('installBannerTitle'))}</b>${esc(t('installBannerIOSTip'))}</div>
        <button class="dismiss">&times;</button>
      `);
      banner.querySelector('.dismiss').setAttribute('aria-label', t('dismiss'));
    } else if (isMac || isWin || isLinux) {
      // Desktop browsers without beforeinstallprompt (Safari, Firefox)
      // Show download option for native app
      const os = isMac ? 'macOS' : isWin ? 'Windows' : 'Linux';
      safeSetHTML(banner, `
        <div class="icon"><img src="icon-192.png" alt="" width="44" height="44"></div>
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
      return false;
    }

    banner.querySelector('.dismiss').onclick = () => {
      banner.remove();
      _installBannerDismissed = true;
      try { localStorage.setItem('brz-install-dismissed', String(Date.now())); } catch {}
    };

    // v3.6: Check cooldown (7 days) instead of session-only
    if (!force) try {
      const dismissed = parseInt(localStorage.getItem('brz-install-dismissed') || '0');
      if (dismissed && Date.now() - dismissed < MS.WEEK) return false;
    } catch {}
    document.body.appendChild(banner);
    return true;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _installPrompt = e;
    const setupBtn = DOM.get('setup-install-btn');
    if (setupBtn) {
      setupBtn.classList.remove('hidden');
      setupBtn.onclick = () => runInstallPrompt().then(() => setupBtn.classList.add('hidden'));
    }
    if (!isInstalledRuntime() && !_installBannerDismissed && _isEngagedVisitor) {
      setTimeout(() => showInstallBanner(), 5 * MS.SEC);
    }
  });

  // Fallback for iOS/Safari/Firefox (no beforeinstallprompt); also gated on _isEngagedVisitor.
  if (!isInstalledRuntime() && _isEngagedVisitor) {
    setTimeout(() => {
      if (!_installBannerDismissed && !_installPrompt) showInstallBanner();
    }, 3000);
  }

  document.addEventListener?.('click', (ev) => {
    if (!ev.target?.closest?.('#settings-install-btn')) return;
    ev.preventDefault?.();
    return requestInstall();
  });

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    _installPrompt = null;
    document.querySelector('.install-banner')?.remove();
    hideSettingsInstallButtons();
    showToast(t('toastInstalled'), 'success');
  });

  return { showInstallBanner, requestInstall };
}
