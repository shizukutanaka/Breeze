'use strict';
/**
 * Breeze Desktop — Preload Script
 * Exposes minimal safe API via contextBridge.
 * Security: contextIsolation=true, nodeIntegration=false, sandbox=true
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breeze', {
  platform: process.platform,
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('get-version'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),

  notify: (title, body, tag) => ipcRenderer.send('notify', { title, body, tag }),
  setBadge: (count) => ipcRenderer.send('badge', count),

  minimize: () => ipcRenderer.send('win-minimize'),
  close: () => ipcRenderer.send('win-close'),
  toggleFullscreen: () => ipcRenderer.send('win-fullscreen'),

  checkForUpdates: () => ipcRenderer.send('check-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (_, info) => cb(info));
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on('update-downloaded', (_, info) => cb(info));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },
  onDeepLink: (cb) => {
    ipcRenderer.on('deep-link', (_, url) => cb(url));
    return () => ipcRenderer.removeAllListeners('deep-link');
  },
});
