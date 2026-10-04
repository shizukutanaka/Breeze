// Tauri plugin parity: every plugin registered in lib.rs must exist in
// Cargo.toml and vice versa, and plugins that REQUIRE tauri.conf.json
// `plugins.*` config (updater: pubkey + endpoints) must have it — otherwise
// the plugin init panics and the app never starts. The updater plugin was
// registered with no config at all: every Tauri launch aborted.
import { describe, it, expect } from 'vitest';
import fs from 'fs';

const lib = fs.readFileSync('tauri/src-tauri/src/lib.rs', 'utf8');
const cargo = fs.readFileSync('tauri/src-tauri/Cargo.toml', 'utf8');
const conf = JSON.parse(fs.readFileSync('tauri/src-tauri/tauri.conf.json', 'utf8'));

const registered = [...lib.matchAll(/tauri_plugin_([a-z_]+)::/g)].map(m => m[1]);
const deps = [...cargo.matchAll(/^tauri-plugin-([a-z-]+) = /gm)].map(m => m[1].replace(/-/g, '_'));

// Plugins that panic at init when conf.plugins.<name> is absent.
const CONF_REQUIRED = ['updater'];

describe('plugin registrations ⇄ Cargo deps parity', () => {
  it('every registered plugin is a Cargo dependency', () => {
    for (const p of registered) expect(deps, p).toContain(p);
  });

  it('every Cargo plugin dependency is registered (or removed)', () => {
    for (const d of deps) expect(registered, d).toContain(d);
  });
});

describe('conf-required plugins have their config', () => {
  for (const name of CONF_REQUIRED) {
    it(`plugins.${name} present iff registered`, () => {
      const isRegistered = registered.includes(name);
      const hasConf = Boolean(conf.plugins?.[name.replace(/_/g, '-')]);
      expect(hasConf, name).toBe(isRegistered);
      if (isRegistered) {
        const c = conf.plugins[name.replace(/_/g, '-')];
        if (name === 'updater') {
          expect(c.pubkey).toBeTruthy();
          expect(c.endpoints?.length).toBeGreaterThan(0);
        }
      }
    });
  }
});
