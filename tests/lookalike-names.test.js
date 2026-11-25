import { describe, it, expect, vi } from 'vitest';
import { safeName, nameSkeleton, riskyName, findLookalikes, createNameTools } from '../src/app/lookalike-names.js';
import { readFileSync } from 'node:fs';

const alice = { id: 'known-alice', pubB64: 'alice-pub', name: 'Alice', alias: 'alice_friend' };
const other = name => ({ id: 'new-person', pubB64: 'new-pub', name });
const match = name => findLookalikes(other(name), [alice]);
const en = { lnSimilar: '“{0}” resembles existing contact “{1}” ({2}). Compare fingerprints.', lnUnsafe: '“{0}” contains hidden/control characters or mixed scripts. Compare fingerprints.', lnContinue: 'Add anyway' };
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function fixture(contacts = [alice]) {
  const D = { t: (k, ...args) => (en[k] || k).replace(/\{(\d+)\}/g, (_, i) => args[i]), settings: () => ({}), esc,
    list: vi.fn(async () => contacts), dom: () => ({}), html: vi.fn(), active: () => null,
    confirm: vi.fn(async () => true), toast: vi.fn(), dbg: vi.fn(), put: vi.fn(), render: vi.fn() };
  const tools = createNameTools(D); tools.setContacts(contacts); return { D, tools };
}
describe('bounded confusable-name detection', () => {
  it.each(['Аlice', 'Αlice', 'Ａｌｉｃｅ', 'ALICE', ' A l i c e ', 'Alíce', 'A1ice', 'Alicе', 'Alicee', 'Aice', 'Alixe'])('warns for %s', name => {
    expect(match(name).map(m => m.contact.id)).toContain(alice.id);
  });
  it('matches rn/m and vv/w visual sequences', () => {
    expect(findLookalikes(other('rnoon'), [{ id: 'moon', name: 'moon' }])).toHaveLength(1);
    expect(nameSkeleton('vvill')).toBe(nameSkeleton('will'));
  });
  it('compares aliases and shadowed distributed profile names', () => {
    expect(findLookalikes({ id: 'new', alias: 'alice_friend' }, [alice])).toHaveLength(1);
    expect(findLookalikes({ id: 'new', name: 'Trusted nickname', profileName: 'Аlice' }, [alice])).toHaveLength(1);
  });
  it('does not compare an identity to itself or its alias', () => {
    expect(findLookalikes({ ...alice, name: 'Аlice' }, [alice])).toEqual([]);
    expect(findLookalikes({ ...other('Alice'), pubB64: alice.pubB64 }, [alice])).toEqual([]);
  });
  it.each(['山田太郎', '山田花子', '佐藤', '田中', 'たなか', '山田 Alice', 'Alice株式会社', 'Bob', 'Al'])('does not overflag %s', name => {
    expect(findLookalikes(other(name), [{ id: 'j', name: '山田次郎' }, alice])).toEqual([]);
    expect(riskyName(name)).toBe(false);
  });
  it('does not fuzzy-match kanji, kana, short two-letter names or long names', () => {
    for (const [a, b] of [['佐藤', '加藤'], ['たなか', 'たなこ'], ['Al', 'El'], ['abcdefghijklmnop', 'abcdefxhijklmnop']])
      expect(findLookalikes(other(a), [{ id: 'old', name: b }])).toEqual([]);
  });
  it('still matches identical Japanese names on different identities', () => {
    expect(findLookalikes(other('佐藤'), [{ id: 'old', name: '佐藤' }])).toHaveLength(1);
  });
  it('ignores default placeholders, empty names and group titles', () => {
    expect(findLookalikes(other('Contact'), [{ id: 'old', name: 'Contact' }])).toEqual([]);
    expect(findLookalikes({}, [null, { isGroup: true, name: 'Alice' }])).toEqual([]);
    expect(findLookalikes(null)).toEqual([]);
    expect(findLookalikes(other('Unknown'), [{ id: 'old', name: 'Unknown' }])).toEqual([]);
  });
  it('limits unique collision results and does not accept two substitutions', () => {
    expect(findLookalikes(other('Alice'), Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: 'Alice', profileName: 'Alice' })))).toHaveLength(3);
    expect(match('Elixe')).toEqual([]);
  });
});
describe('control stripping and local warning rendering', () => {
  it('strips bidi overrides/isolates/marks, zero width, variation selectors, soft hyphen and C0/C1', () => {
    const raw = 'A\u202e\u2066\u200f\u061c\u200b\u200c\u200d\ufeff\ufe0f\u00ad\u0000\u0085lice';
    expect(safeName(raw)).toBe('Alice');
    expect(riskyName(raw)).toBe(true);
    expect(match(raw)).toHaveLength(1);
    expect(safeName(null)).toBe('');
    expect(safeName('山田 がく')).toBe('山田 がく');
  });
  it('warns on Latin/Greek/Cyrillic mixing without a known collision', () => {
    expect(riskyName('Rоbоt')).toBe(true);
    expect(riskyName('Алексей')).toBe(false);
    const { tools } = fixture([]);
    expect(tools.warningText(other('Rоbоt'))).toContain('mixed scripts');
  });
  it('escapes both attacker-controlled and existing names and keeps IDs visible', () => {
    const { tools } = fixture([{ id: 'known<id>', name: '<Alice>' }]);
    const html = tools.warningHtml(other('<Аlice>'));
    expect(html).not.toContain('<Alice>');
    expect(html).toContain('&lt;Alice&gt;');
    expect(html).toContain('known&lt;id&gt;');
    expect(html).toContain('Compare fingerprints');
  });
  it('renders safe local/peer names, a persistent header warning and group-member warnings', () => {
    const { tools, D } = fixture();
    const c = { ...other('Аli\u202ece'), profileName: 'Peer\u200b', nameLocked: true };
    expect(tools.contactDisplayName(c)).toBe('Аlice');
    expect(tools.contactPeerNameHtml(c)).toContain('(Peer)');
    tools._setConvName(c);
    expect(D.html.mock.lastCall[1]).toContain('known-alice');
    expect(D.html.mock.lastCall[1]).not.toContain('\u202e');
    expect(tools.warningHtml({ isGroup: true, members: [c] })).toContain('known-alice');
  });
  it('recomputes after reload, rename and removal without trusting a persisted override', () => {
    const { tools } = fixture();
    expect(tools.warningText(other('Аlice'))).toContain('known-alice');
    expect(fixture().tools.warningText(other('Аlice'))).toContain('known-alice');
    tools.setContacts([]);
    expect(tools.warningText(other('Alice'))).toBe('');
    tools.setContacts([{ ...alice, name: 'Zoe', alias: '' }]);
    expect(tools.warningText(other('Alice'))).toBe('');
  });
  it('repaints verification after replacing the active header, but not an empty header', () => {
    const { tools, D } = fixture();
    D.verification = vi.fn(() => expect(D.html).toHaveBeenCalled());
    D.active = () => alice;
    tools.setContacts([alice]);
    expect(D.verification).toHaveBeenCalledWith(alice);
    tools._setConvName(null);
    expect(D.verification).toHaveBeenCalledTimes(1);
    D.dom = () => null;
    tools._setConvName(alice);
    expect(D.verification).toHaveBeenCalledTimes(1);
  });
  it('asks before adding, respects cancellation and does not prompt for ordinary/self adds', async () => {
    const { tools, D } = fixture();
    D.confirm.mockResolvedValue(false);
    expect(await tools.confirm(other('Аlice'))).toBe(false);
    expect(D.confirm.mock.lastCall[0]).toContain('known-alice');
    expect(await tools.confirm(alice)).toBe(true);
    expect(await tools.confirm(other('Zoe'))).toBe(true);
    expect(D.confirm).toHaveBeenCalledTimes(1);
    D.confirm.mockResolvedValue(true);
    expect(await tools.confirm(other('Аlice'))).toBe(true);
  });
  it('warns on first incoming add without prompting; comparison read failure refuses an interactive add', async () => {
    const { tools, D } = fixture();
    await tools.added(other('Аlice'));
    expect(D.toast).toHaveBeenCalledWith(expect.stringContaining('known-alice'), 'warn');
    expect(D.confirm).not.toHaveBeenCalled();
    D.list.mockRejectedValue(new Error('IDB failure'));
    expect(await tools.confirm(other('Alice'))).toBe(false);
    await expect(tools.added(other('Alice'))).resolves.toBeUndefined();
    expect(D.dbg).toHaveBeenCalled();
    expect(D.toast).toHaveBeenCalledWith('toastModulesFailed', 'error');
  });
  it('propagates nickname persistence failures without rendering success', async () => {
    const { tools, D } = fixture();
    D.put.mockRejectedValue(new Error('write failed'));
    await expect(tools.setContactNickname({ ...alice }, 'New')).rejects.toThrow('write failed');
    expect(D.render).not.toHaveBeenCalled();
  });
});
describe('deployed wiring', () => {
  it('ships and precaches the bridge and uses it at add, first incoming, header, members and sender labels', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('window.__breezeNames = { createNameTools, safeName }');
    expect(html).toContain('_nameTools.confirm({ id: pubB64.slice(0, 12), pubB64, name, alias })');
    expect(html).toContain('await _nameTools?.added({ id, pubB64: safePub, name: safeName, alias })');
    expect(html).toContain('_nameTools?.warningHtml(m)');
    expect(html).toContain('_nameTools?.warningHtml(sender)');
    expect(html).toContain('senderId: m.senderId');
    expect(readFileSync(new URL('../sw.js', import.meta.url), 'utf8')).toContain("'/src/app/lookalike-names.js'");
  });
});
