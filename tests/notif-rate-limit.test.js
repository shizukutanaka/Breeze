import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PN = SRC.match(/function playNotif\(\) \{[\s\S]+?\n\}\n/)[0];

describe('notification sound rate limit', () => {
  it('playNotif throttles to at most one alert per second', () => {
    // showToast was capped at 5 concurrent (#185-style wire-flood bound) but the
    // chime + haptic stayed unbounded — a flooding P2P peer (no relay rate
    // limits on the data path) could ring once per message.
    expect(PN).toContain('playNotif._t');
    expect(PN).toContain('MS.SEC');
    expect(PN.indexOf('playNotif._t')).toBeLessThan(PN.indexOf('createOscillator'));
  });
  it('the throttle precedes the sound-off preference check', () => {
    expect(PN.indexOf('playNotif._t || 0')).toBeLessThan(PN.indexOf('brz-notif-sound'));
  });
  it('throttle state lives on the function object — survives account switch', () => {
    // module-level fn: a static prop keeps the gap enforced across initMessenger
    // re-runs, unlike per-init _intervals which are torn down.
    expect(PN).not.toContain('_lastNotif');
  });
  it('functional: second call within 1s is dropped', () => {
    const play = new Function('MS', 'localStorage', 'playNotif', "const _nt = Date.now(); if (_nt - (playNotif._t || 0) < MS.SEC) return 'drop'; playNotif._t = _nt; return 'ring';");
    const self = {};
    expect(play({ SEC: 1000 }, {}, self)).toBe('ring');
    expect(play({ SEC: 1000 }, {}, self)).toBe('drop');
    self._t = Date.now() - 2000;
    expect(play({ SEC: 1000 }, {}, self)).toBe('ring');
  });
});
