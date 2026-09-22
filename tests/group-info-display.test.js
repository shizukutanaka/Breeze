// /group/info response name display — creator-supplied group/creator names shown
// pre-consent (setup preview + join confirm dialog) must pass _safeDisplayName like
// every other name ingest (TR39 invisible-twin: 'Team Alpha'+ZWSP renders identical
// to the real group), and members.length must be array-guarded.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the real sanitizer + its unsafe-char regex from the source.
const RE_M = SRC.match(/const _UNSAFE_DISPLAY_RE\s*=\s*(\/[^;]+);/);
const _UNSAFE_DISPLAY_RE = new Function('return ' + RE_M[1])();
const SDN_START = SRC.indexOf('const _safeDisplayName =');
const SDN_SRC = SRC.slice(SDN_START, SRC.indexOf(';', SDN_START) + 1);
const _safeDisplayName = new Function('_UNSAFE_DISPLAY_RE', SDN_SRC + ' return _safeDisplayName;')(_UNSAFE_DISPLAY_RE);

// Extract the two display statements from the ?join= setup-preview block.
const TITLE_LINE = SRC.slice(SRC.indexOf("if (title) title.textContent = t('joinGroup'"),
  SRC.indexOf(';', SRC.indexOf("if (title) title.textContent = t('joinGroup'")) + 1);
const DESC_LINE = SRC.slice(SRC.indexOf("if (desc) desc.textContent = t('invitedBy'"),
  SRC.indexOf(';', SRC.indexOf("if (desc) desc.textContent = t('invitedBy'")) + 1);
// Extract the ?join= confirm-dialog statement.
const CONFIRM_LINE = SRC.slice(SRC.indexOf("if (await showConfirm(t('joinGroup'"),
  SRC.indexOf(';', SRC.indexOf("if (await showConfirm(t('joinGroup'")) + 1);

const drive = (stmt, ctx) => {
  const t = (...args) => args;
  return new Function('t', '_safeDisplayName', ...Object.keys(ctx), stmt)(t, _safeDisplayName, ...Object.values(ctx));
};

describe('/group/info display sanitization (TR39)', () => {
  it('title line sanitizes the creator-supplied group name', () => {
    const title = {};
    const data = { name: 'TeamAlpha' };
    drive(TITLE_LINE, { title, data });
    expect(title.textContent).toEqual(['joinGroup', 'TeamAlpha']);
  });
  it('title strips invisible/bidi chars (invisible-twin prevention)', () => {
    const title = {};
    const data = { name: 'TeamAlpha‍Troll‮elppeA' };
    drive(TITLE_LINE, { title, data });
    expect(title.textContent).toEqual(['joinGroup', 'TeamAlpha‍TrollelppeA']);
  });
  it('desc line sanitizes creatorName and array-guards members.length', () => {
    const desc = {};
    const data = { creatorName: 'Alice', members: 'not-an-array' };
    drive(DESC_LINE, { desc, data });
    expect(desc.textContent).toEqual(['invitedBy', 'Alice', 0]);
  });
  it('desc strips invisible chars from creatorName', () => {
    const desc = {};
    const data = { creatorName: 'Alice\u200B', members: [1, 2, 3] };
    drive(DESC_LINE, { desc, data });
    expect(desc.textContent).toEqual(['invitedBy', 'Alice', 3]);
  });
  it('join confirm dialog sanitizes gi.name before asking consent', async () => {
    let askedWith = null;
    const showConfirm = async (titleArg) => { askedWith = titleArg; return false; };
    const processJoinToken = async () => { throw new Error('must not reach'); };
    const gi = { name: 'Club‮xela' };
    await new Function('showConfirm', 'processJoinToken', 't', '_safeDisplayName', 'gi',
      `return (async () => { ${CONFIRM_LINE} })()`)(showConfirm, processJoinToken, (...a) => a, _safeDisplayName, gi);
    expect(askedWith).toEqual(['joinGroup', 'Clubxela']);
  });
  it('wire-site tripwires: raw interpolations are gone from all /group/info display sites', () => {
    expect(SRC).not.toContain("t('joinGroup', data.name)");
    expect(SRC).not.toContain('data.creatorName, data.members.length');
    expect(SRC).not.toContain("t('joinGroup', gi?.name || '…')");
    expect(SRC).toContain('_safeDisplayName(data.name, 64)');
    expect(SRC).toContain('_safeDisplayName(data.creatorName, 64)');
    expect(SRC).toContain('_safeDisplayName(gi?.name, 64)');
  });
});
