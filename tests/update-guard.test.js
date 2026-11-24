import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isStrictlyNewerVersion, createUpdateController } = require('../desktop/update-guard.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

function fakeAutoUpdater() {
  const listeners = new Map();
  return {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    on(evt, fn) { listeners.set(evt, fn); },
    emit(evt, arg) { listeners.get(evt)?.(arg); },
    checkForUpdates: vi.fn(() => Promise.resolve()),
    downloadUpdate: vi.fn(() => Promise.resolve()),
    quitAndInstall: vi.fn(),
  };
}

describe('desktop/update-guard — fail-secure Electron auto-update', () => {
  it('isStrictlyNewerVersion rejects downgrades, equal versions, and malformed strings', () => {
    expect(isStrictlyNewerVersion('3.8.1', '3.8.0')).toBe(true);
    expect(isStrictlyNewerVersion('3.9.0', '3.8.0')).toBe(true);
    expect(isStrictlyNewerVersion('4.0.0', '3.8.0')).toBe(true);
    expect(isStrictlyNewerVersion('3.8.0', '3.8.0-rc.1')).toBe(true);

    expect(isStrictlyNewerVersion('3.8.0', '3.8.0')).toBe(false);
    expect(isStrictlyNewerVersion('3.7.9', '3.8.0')).toBe(false);
    expect(isStrictlyNewerVersion('2.9.9', '3.8.0')).toBe(false);
    expect(isStrictlyNewerVersion('3.8.0-rc.1', '3.8.0')).toBe(false);
    expect(isStrictlyNewerVersion('latest', '3.8.0')).toBe(false);
    expect(isStrictlyNewerVersion('', '3.8.0')).toBe(false);
    expect(isStrictlyNewerVersion(null, '3.8.0')).toBe(false);
  });

  it('pins autoDownload=false, autoInstallOnAppQuit=false, allowDowngrade=false', () => {
    const au = fakeAutoUpdater();
    createUpdateController({ autoUpdater: au, currentVersion: '3.8.0' });
    expect(au.autoDownload).toBe(false);
    expect(au.autoInstallOnAppQuit).toBe(false);
    expect(au.allowDowngrade).toBe(false);
  });

  it('refuses installUpdate() before downloadUpdate() + update-downloaded completes', () => {
    const au = fakeAutoUpdater();
    const onError = vi.fn();
    const onQuit = vi.fn();
    const ctrl = createUpdateController({
      autoUpdater: au,
      currentVersion: '3.8.0',
      onError,
      onQuit,
    });

    au.emit('update-available', { version: '3.9.0' });
    expect(ctrl.installUpdate()).toBe(false);
    expect(au.quitAndInstall).not.toHaveBeenCalled();
    expect(onQuit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: 'NOT_DOWNLOADED' });
  });

  it('rejects downgrade on update-available and notifies renderer', async () => {
    const au = fakeAutoUpdater();
    const onAvailable = vi.fn();
    const onError = vi.fn();
    const ctrl = createUpdateController({
      autoUpdater: au,
      currentVersion: '3.8.0',
      onAvailable,
      onError,
    });

    au.emit('update-available', { version: '3.7.0' });
    expect(onAvailable).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: 'DOWNGRADE_REJECTED' });
    expect(await ctrl.downloadUpdate()).toBe(false);
    expect(au.downloadUpdate).not.toHaveBeenCalled();
  });

  it('rejects swapped version on update-downloaded and blocks quitAndInstall', async () => {
    const au = fakeAutoUpdater();
    const onDownloaded = vi.fn();
    const onError = vi.fn();
    const ctrl = createUpdateController({
      autoUpdater: au,
      currentVersion: '3.8.0',
      onDownloaded,
      onError,
    });

    au.emit('update-available', { version: '3.9.0' });
    await ctrl.downloadUpdate();
    au.emit('update-downloaded', { version: '3.8.1' });

    expect(onDownloaded).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: 'VERSION_MISMATCH' });
    expect(ctrl.installUpdate()).toBe(false);
    expect(au.quitAndInstall).not.toHaveBeenCalled();
  });

  it('surfaces checksum and signature verification failures to renderer and clears verified state', async () => {
    const au = fakeAutoUpdater();
    const onError = vi.fn();
    const ctrl = createUpdateController({
      autoUpdater: au,
      currentVersion: '3.8.0',
      onError,
    });

    au.emit('update-available', { version: '3.9.0' });
    await ctrl.downloadUpdate();
    au.emit('error', new Error('sha512 checksum mismatch for Breeze-3.9.0.dmg'));
    expect(onError).toHaveBeenCalledWith({ code: 'CHECKSUM_FAILED' });
    expect(ctrl.installUpdate()).toBe(false);
    expect(au.quitAndInstall).not.toHaveBeenCalled();

    au.emit('error', new Error('Code signature validation failed'));
    expect(onError).toHaveBeenCalledWith({ code: 'SIGNATURE_FAILED' });
  });

  it('completes happy path: available -> downloadUpdate -> downloaded -> installUpdate', async () => {
    const au = fakeAutoUpdater();
    const onAvailable = vi.fn();
    const onDownloaded = vi.fn();
    const onQuit = vi.fn();
    const ctrl = createUpdateController({
      autoUpdater: au,
      currentVersion: '3.8.0',
      onAvailable,
      onDownloaded,
      onQuit,
    });

    au.emit('update-available', { version: '3.9.0' });
    expect(onAvailable).toHaveBeenCalledWith({ version: '3.9.0' });

    expect(await ctrl.downloadUpdate()).toBe(true);
    expect(au.downloadUpdate).toHaveBeenCalledTimes(1);

    au.emit('update-downloaded', { version: '3.9.0' });
    expect(onDownloaded).toHaveBeenCalledWith({ version: '3.9.0' });

    expect(ctrl.installUpdate()).toBe(true);
    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(au.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('wires download-update and update-error end-to-end across main.js, preload.js, and index.html', () => {
    const main = read('desktop/main.js');
    const preload = read('desktop/preload.js');
    const html = read('index.html');

    expect(main).toContain("require('./update-guard')");
    expect(main).toContain("ipcMain.on('download-update'");
    expect(main).not.toContain("autoUpdater.on('error', () => {})");
    expect(preload).toContain('downloadUpdate');
    expect(preload).toContain('onUpdateError');
    expect(html).toContain('window.breeze.downloadUpdate()');
    expect(html).toContain('window.breeze.onUpdateError');
  });
});
