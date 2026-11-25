// Selected Latin/Greek/Cyrillic mappings from Unicode security 16.0.0 confusables.txt.
// Unicode License v3: docs/UNICODE-LICENSE.txt. This is not full UTS #39 conformance.
const folds = new Map();
for (const [target, chars] of Object.entries({
  a: 'ΑАαаɑ', b: 'ΒВЬ', c: 'ϹСϲс', d: 'ԁ', e: 'ΕЕе', h: 'ΗНһ',
  i: 'ΙІӀіı', j: 'Јјϳ', k: 'ΚКκ', l: 'ІӀ', m: 'ΜМ', n: 'Ν',
  o: 'ΟОοоՕօ', p: 'ΡРρр', s: 'Ѕѕ', t: 'ΤТτ', v: 'νѵ',
  x: 'ΧХχх', y: 'ΥҮуү', z: 'Ζ',
})) for (const char of chars) folds.set(char, target);

const controls = /[\p{Default_Ignorable_Code_Point}\p{Cc}]/gu;
export const safeName = value => typeof value === 'string' ? value.replace(controls, '') : '';
const canonical = value => safeName(value).normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
export function nameSkeleton(value) {
  return Array.from(safeName(value).normalize('NFKC'), c => folds.get(c) || c).join('')
    .toLowerCase().normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .replace(/\s+/gu, '').replace(/[i1|]/g, 'l').replace(/0/g, 'o').replace(/m/g, 'rn').replace(/w/g, 'vv');
}
export function riskyName(value) {
  if (typeof value !== 'string') return false;
  if (safeName(value) !== value) return true;
  return [/\p{Script=Latin}/u, /\p{Script=Greek}/u, /\p{Script=Cyrillic}/u].filter(re => re.test(value)).length > 1;
}
const values = c => [...new Set([c?.name, c?.profileName, c?.alias].filter(v => typeof v === 'string' && v.trim()).map(v => v.slice(0, 64)))];
const fuzzy = s => /^[a-z]{4,12}$/.test(s);
const variants = s => [s, ...Array.from(s, (_, i) => s.slice(0, i) + s.slice(i + 1))];
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function indexNames(contacts) {
  const exact = new Map(), near = new Map();
  const append = (map, key, item) => { if (!map.has(key)) map.set(key, []); map.get(key).push(item); };
  for (const contact of contacts.filter(c => c && !c.isGroup)) for (const value of values(contact)) {
    const sk = nameSkeleton(value);
    if (!sk || ['contact', 'unknown'].includes(canonical(value))) continue;
    const item = { contact, value, sk };
    append(exact, sk, item);
    if (fuzzy(sk)) for (const key of variants(sk)) append(near, key, item);
  }
  return { exact, near };
}
function lookup(candidate, index) {
  const found = new Map();
  for (const value of values(candidate)) {
    const sk = nameSkeleton(value);
    if (!sk || ['contact', 'unknown'].includes(canonical(value))) continue;
    const items = [...(index.exact.get(sk) || []), ...(fuzzy(sk) ? variants(sk).flatMap(v => index.near.get(v) || []) : [])];
    for (const item of items) {
      const other = item.contact;
      if (candidate.id && candidate.id === other.id || candidate.pubB64 && candidate.pubB64 === other.pubB64) continue;
      if (sk !== item.sk && !oneEdit(sk, item.sk)) continue;
      if (!found.has(other.id || other.pubB64)) found.set(other.id || other.pubB64, { contact: other, value });
      if (found.size === 3) return [...found.values()];
    }
  }
  return [...found.values()];
}
export const findLookalikes = (candidate, contacts = []) => lookup(candidate, indexNames(contacts));

export function createNameTools(D) {
  let index = indexNames([]);
  const contactDisplayName = c => safeName(c?.name);
  function contactPeerName(c) {
    if (!c || c.isGroup || !c.nameLocked) return '';
    const p = safeName(c.profileName);
    return p && p !== contactDisplayName(c) ? p : '';
  }
  function contactPeerNameHtml(c) {
    const p = D.settings().showPeerName === false ? '' : contactPeerName(c);
    return p ? ' <span class="i-t3-10">(' + D.esc(p) + ')</span>' : '';
  }
  function warningText(c) {
    if (!c) return '';
    if (c.isGroup) return (c.members || []).map(warningText).filter(Boolean).slice(0, 3).join('\n');
    const matches = lookup(c, index), out = matches.map(m => D.t('lnSimilar', safeName(m.value), contactDisplayName(m.contact) || safeName(m.contact.alias), safeName(m.contact.id)));
    if (values(c).some(riskyName)) out.push(D.t('lnUnsafe', contactDisplayName(c) || safeName(c.alias)));
    return out.join('\n');
  }
  const warningHtml = c => { const text = warningText(c); return text ? '<span class="ln-warning" role="note">⚠ ' + D.esc(text) + '</span>' : ''; };
  function _setConvName(contact) {
    const el = D.dom('msg-conv-name');
    if (!el || !contact) return;
    const badge = contact.isGroup && contact.members ? ' <span class="enc-badge">' + contact.members.length + ' ' + D.esc(D.t('cmdMembersLabel')) + '</span>' : ' <span class="enc-badge">E2E</span>';
    D.html(el, (contact.blocked ? '🚫 ' : '') + (contact.muted ? '🔇 ' : '') + D.esc(contactDisplayName(contact)) + contactPeerNameHtml(contact) + badge + warningHtml(contact));
    D.verification?.(contact);
  }
  async function setContactNickname(c, name) {
    const clean = (name || '').trim().slice(0, 64);
    if (clean) { c.name = clean; c.nameLocked = true; }
    else { c.nameLocked = false; if (c.profileName) c.name = c.profileName; }
    await D.put('contacts', c);
    D.render();
    if (D.active()?.id === c.id) _setConvName(c);
  }
  function setContacts(contacts) {
    index = indexNames(contacts.flatMap(c => [c, ...(c.isGroup ? c.members || [] : [])]));
    const active = D.active();
    if (active) _setConvName(contacts.find(c => c.id === active.id) || active);
  }
  async function confirm(candidate) {
    try {
      setContacts(await D.list());
      const text = warningText(candidate);
      return !text || await D.confirm(text, { okText: D.t('lnContinue') });
    } catch(e) { D.dbg(e, 'name-check'); D.toast(D.t('toastModulesFailed'), 'error'); return false; }
  }
  async function added(candidate) {
    try {
      setContacts(await D.list());
      const text = warningText(candidate);
      if (text) D.toast(text, 'warn');
    } catch(e) { D.dbg(e, 'name-check'); D.toast(D.t('toastModulesFailed'), 'error'); }
  }
  return { contactDisplayName, contactPeerName, contactPeerNameHtml, _setConvName, setContactNickname, setContacts, warningHtml, warningText, confirm, added };
}
