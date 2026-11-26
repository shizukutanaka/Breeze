// Settings-view controller extraction (modularization): the controller
// behind #settings-view lives in src/app/settings-view.js as a factory;
// index.html only bridges it, instantiates it with the closure's live
// bindings, and keeps the three historical wrapper names for the rest of
// the app. These tests pin that contract plus the moved behaviours whose
// assertions used to read the inline body.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(HERE, '..', 'src', 'app', 'settings-view.js');
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');
const src = existsSync(MODULE_PATH) ? readFileSync(MODULE_PATH, 'utf8') : '';

describe('settings-view module contract', () => {
  it('exists as an ES module exporting createSettingsView', async () => {
    expect(existsSync(MODULE_PATH)).toBe(true);
    const mod = await import('../src/app/settings-view.js');
    expect(typeof mod.createSettingsView).toBe('function');
    const instance = mod.createSettingsView({});
    for (const key of ['renderPanel', 'open', 'close', 'isOpen']) expect(typeof instance[key]).toBe('function');
    expect(instance.isOpen()).toBe(false);
  });

  it('is statically imported and exposed through the __breezeSettingsView bridge', () => {
    expect(html).toContain("import { createSettingsView } from './src/app/settings-view.js';");
    expect(html).toContain('window.__breezeSettingsView = { createSettingsView };');
    expect(sw).toContain("'/src/app/settings-view.js'");
  });

  it('index.html instantiates the factory with live getters for reassigned bindings', () => {
    const start = html.indexOf('globalThis.__breezeSettingsView?.createSettingsView({');
    expect(start).toBeGreaterThan(-1);
    const wiring = html.slice(start, html.indexOf('function _renderSettingsPanel(d)', start));
    expect(wiring).toContain('settings: () => _settings');
    expect(wiring).toContain('myName: () => myName');
    expect(wiring).toContain('activeContact: () => activeContact');
    expect(wiring).toContain('listTab: () => _listTab');
  });

  it('the historical wrapper names remain and delegate to the instance', () => {
    expect(html).toContain('function _renderSettingsPanel(d) { _settingsView?.renderPanel(d); }');
    expect(html).toContain('function openSettingsView() { _settingsView?.open(); }');
    expect(html).toContain('function closeSettingsView() { _settingsView?.close(); }');
  });

  it('the entry, back, and popstate listeners stay in index.html', () => {
    expect(html).toContain("_DOM.get('b-msg-settings')?.addEventListener('click', () => openSettingsView());");
    expect(html).toContain("_DOM.get('b-settings-back')?.addEventListener('click', () => {");
    expect(html).toContain('if (history.state?.breezeSettings) history.back();');
    expect(html).toContain('window.addEventListener(\'popstate\', () => { if (_settingsView?.isOpen()) closeSettingsView(); }, { signal: _ac.signal });');
  });
});

describe('settings-view moved behaviour', () => {
  it('open renders into the dedicated body, activates the settings tab, and pushes history once', () => {
    expect(src).toContain("deps._DOM.get('settings-view')");
    expect(src).toContain("deps._DOM.get('settings-body')");
    expect(src).toContain('deps._renderSettingsPanel(d); deps._setActiveTab(\'settings\');');
    expect(src).toContain('if (!_settingsViewOpen) {');
    expect(src).toContain('_settingsViewOpen = true;');
    expect(src).toContain("history.pushState({ breezeSettings: true }, '');");
    const openStart = src.indexOf('function open()');
    const openSrc = src.slice(openStart, src.indexOf('function close()', openStart));
    expect(openSrc).not.toContain('msg-messages');
    expect(openSrc).not.toContain('_cmdPanelEl');
  });

  it('close hides the view and restores the list tab', () => {
    expect(src).toContain('if (!_settingsViewOpen) return;');
    expect(src).toContain('_settingsViewOpen = false;');
    expect(src).toContain("deps._DOM.get('settings-view')?.classList.add('hidden');");
    expect(src).toContain('deps._setActiveTab(deps.listTab());');
  });

  it('the automatic-backup status wording switch moved with the controller', () => {
    for (const fragment of [
      "case 'off': return deps.t('autoBackupOff');",
      "case 'ineligible': return deps.t('toastRecoveryNoneBackup');",
      "case 'noserver': return deps.t('autoBackupNoServer');",
      "case 'needpass': return deps.t('autoBackupNeedPass');",
      "case 'error': return deps.t('autoBackupError');",
      "case 'pending': return deps.t('autoBackupPending');",
      "case 'ok': return deps.t('autoBackupLast', new Date(st.lastOkAt).toLocaleString());",
      "default: return deps.t('autoBackupNever');",
    ]) expect(src).toContain(fragment);
  });
});
