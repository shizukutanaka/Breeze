'use strict';
/**
 * Breeze Desktop — Electron main process
 *
 * Features:
 *   - Single-instance lock with deep-link forwarding
 *   - System tray with badge count
 *   - Window bounds persistence
 *   - Auto-update via electron-updater
 *   - CSP enforcement in session
 *   - breeze:// protocol handler
 *   - Native notifications
 *   - Global shortcut (Ctrl+Shift+B)
 *   - macOS: dock badge, activate, hide-to-dock
 *   - Windows: taskbar flash, NSIS protocol handler
 *   - Linux: AppIndicator tray
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, Notification,
        globalShortcut, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Constants ───────────────────────────────────────────────
const APP_NAME = 'Breeze';
const PROTOCOL = 'breeze';
const isDev = !app.isPackaged;
const WEB_ROOT = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'bounds.json');

// ── Single instance lock ────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// ── Protocol registration ───────────────────────────────────
if (process.defaultApp) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// ── State ───────────────────────────────────────────────────
let win = null;
let tray = null;
let isQuitting = false;

// ── Window ──────────────────────────────────────────────────
function createWindow() {
  let bounds = { width: 960, height: 720, x: undefined, y: undefined };
  try { bounds = { ...bounds, ...JSON.parse(fs.readFileSync(BOUNDS_FILE(), 'utf8')) }; } catch {}

  win = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 400,
    title: APP_NAME,
    icon: loadIcon(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
      webgl: false,
      enableWebSQL: false,
    },
  });

  // Load web app
  loadApp();

  // Show when ready (avoid white flash)
  win.once('ready-to-show', () => win.show());

  // Save bounds on move/resize (debounced)
  let boundsTimer = null;
  const saveBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      try { fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(win.getBounds())); } catch {}
    }, 500);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // Hide to tray instead of closing
  win.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); win.hide(); }
  });

  // Block new window/tab creation — open external URLs in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Block navigation away from app
  win.webContents.on('will-navigate', (e, url) => {
    const appOrigin = new URL(win.webContents.getURL()).origin;
    if (!url.startsWith(appOrigin) && !url.startsWith('file://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

function loadApp(search) {
  const remoteUrl = process.env.BREEZE_URL;
  if (remoteUrl) {
    win.loadURL(remoteUrl + (search || ''));
  } else {
    win.loadFile(path.join(WEB_ROOT, 'index.html'), search ? { search } : undefined);
  }
}

// ── CSP ─────────────────────────────────────────────────────
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline';" +
          "connect-src 'self' https: wss: stun: turn:;" +
          "img-src 'self' blob: data: https:;" +
          "media-src 'self' blob:;" +
          "worker-src 'self' blob:;"
        ],
      },
    });
  });
}

// ── System tray ─────────────────────────────────────────────
function createTray() {
  const icon = loadIcon().resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  const menu = Menu.buildFromTemplate([
    { label: 'Open Breeze', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

// ── IPC handlers ────────────────────────────────────────────
function setupIPC() {
  // Native notification (bypasses browser permission)
  ipcMain.on('notify', (_, { title, body, tag }) => {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: title || APP_NAME, body: body || '', silent: false });
    n.on('click', showWindow);
    n.show();
  });

  // Badge count
  ipcMain.on('badge', (_, count) => {
    const n = parseInt(count) || 0;
    if (process.platform === 'darwin') app.dock?.setBadge(n > 0 ? String(n) : '');
    if (process.platform === 'win32' && n > 0) win?.flashFrame(true);
    if (process.platform === 'linux') app.setBadgeCount?.(n);
    tray?.setToolTip(n > 0 ? `${APP_NAME} (${n})` : APP_NAME);
  });

  // Window controls
  ipcMain.on('win-minimize', () => win?.minimize());
  ipcMain.on('win-close', () => win?.close());
  ipcMain.on('win-fullscreen', () => win?.setFullScreen(!win.isFullScreen()));

  // App info
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('get-platform', () => process.platform);
  ipcMain.handle('get-data-path', () => app.getPath('userData'));
}

// ── Auto-update ─────────────────────────────────────────────
function setupAutoUpdate() {
  if (isDev) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      win?.webContents.send('update-available', { version: info.version });
    });
    autoUpdater.on('update-downloaded', (info) => {
      win?.webContents.send('update-downloaded', { version: info.version });
    });
    autoUpdater.on('error', () => {}); // Silent

    ipcMain.on('check-update', () => autoUpdater.checkForUpdates().catch(() => {}));
    ipcMain.on('install-update', () => { isQuitting = true; autoUpdater.quitAndInstall(); });

    // Check 10s after launch, then every 4 hours
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  } catch {} // electron-updater not installed in dev
}

// ── Deep link handling ──────────────────────────────────────
function handleDeepLink(url) {
  try {
    const parsed = new URL(url);
    const query = parsed.pathname ? '?' + parsed.pathname.replace(/^\/+/, '') : '';
    if (query) loadApp(query);
    showWindow();
  } catch {}
}

// ── Icon loader ─────────────────────────────────────────────
function loadIcon() {
  const names = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : ['icon.png', 'icon-512.png', 'icon-192.png'];
  for (const name of names) {
    const p = path.join(__dirname, name);
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  }
  // Fallback: 1px transparent PNG
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
    'Nl7BcQAAAABJRU5ErkJggg=='
  );
}

// ── App lifecycle ───────────────────────────────────────────
app.whenReady().then(() => {
  setupCSP();
  setupIPC();
  createWindow();
  createTray();
  setupAutoUpdate();

  // Global shortcut: Ctrl+Shift+B toggle window
  globalShortcut.register('CommandOrControl+Shift+B', () => {
    if (win?.isVisible() && win.isFocused()) win.hide();
    else showWindow();
  });
});

// Second instance → forward deep link
app.on('second-instance', (_, argv) => {
  const deepLink = argv.find(a => a.startsWith(PROTOCOL + '://'));
  if (deepLink) handleDeepLink(deepLink);
  else showWindow();
});

// macOS: handle URL scheme
app.on('open-url', (e, url) => { e.preventDefault(); handleDeepLink(url); });

// Platform behavior
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('activate', () => showWindow()); // macOS dock click
