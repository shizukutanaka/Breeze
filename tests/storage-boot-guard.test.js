import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Find storage refs that run on the boot path without a covering try:
//   eval-executed  — module-level statements + immediately-invoked (() => {})() bodies
//   init-executed  — statements inside initMessenger's own body (direct, or via an
//                    immediately-invoked function nested in it)
// A throw at either point deads boot/init on storage-disabled browsers (CWE-248).
function scan(js) {
  const list = [{ id: 0, kind: 'block', fname: null, parent: -1, istTry: false, invoked: false }]; // 0 = root
  const stack = [0];
  const refs = [];
  const KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'new', 'delete', 'typeof', 'throw', 'in', 'of', 'instanceof', 'do', 'else', 'try', 'finally', 'void', 'await', 'yield']);
  const nonWs = (j) => { while (j < js.length && /\s/.test(js[j])) j++; return j; };
  const wordBefore = (pos) => { let e = pos; while (e > 0 && /\s/.test(js[e - 1])) e--; let s = e; while (s > 0 && /[\w$]/.test(js[s - 1])) s--; return js.slice(s, e); };
  const parBefore = (pos) => { let j = pos; while (j > 0 && /\s/.test(js[j - 1])) j--; if (js[j - 1] !== ')') return -1; let d = 1; j -= 2; while (j >= 0 && d > 0) { if (js[j] === ')') d++; else if (js[j] === '(') d--; j--; } return j + 1; };
  let i = 0, state = 'code', q = '';
  const tplExpr = []; // brace ids opened by ${ in a template
  while (i < js.length) {
    const c = js[i], n = js[i + 1];
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && n === '*') { state = 'blk'; i += 2; continue; }
      if (c === '/') {
        // regex literal iff prev significant token can't end an expression
        let j = i - 1; while (j >= 0 && /\s/.test(js[j])) j--;
        const pc = j >= 0 ? js[j] : '';
        const pw = wordBefore(j + 1);
        if (j < 0 || '([{,;:!&|?+-*%^~<>='.includes(pc) || /^(return|typeof|case|new|delete|void|throw|instanceof|do|else|yield|await|in|of)$/.test(pw)) state = 're';
        i++; continue;
      }
      if (c === "'" || c === '"') { state = 'str'; q = c; i++; continue; }
      if (c === '`') { state = 'tpl'; i++; continue; }
      if (c === '{') {
        const w = wordBefore(i);
        let kind = 'block', fname = null, istTry = false;
        if (w === 'try' || w === 'finally' || w === 'catch') { istTry = true; }
        else if (/=>\s*$/.test(js.slice(Math.max(0, i - 80), i))) { kind = 'fn'; }
        else if (w === 'else' || w === 'do') { /* block */ }
        else {
          const pb = parBefore(i);
          if (pb >= 0) {
            const w2 = wordBefore(pb);
            if (!KW.has(w2)) { kind = 'fn'; fname = w2 === 'function' ? null : (w2 || null); }
          }
        }
        const b = { id: list.length, kind, fname, parent: stack[stack.length - 1], istTry, invoked: false };
        list.push(b); stack.push(b.id); i++; continue;
      }
      if (c === '}') {
        const id = stack.pop();
        if (id === undefined) { i++; continue; }
        if (tplExpr.length && tplExpr[tplExpr.length - 1] === id) { tplExpr.pop(); state = 'tpl'; i++; continue; }
        if (list[id].kind === 'fn') {
          let j = nonWs(i + 1);
          while (js[j] === ')') j = nonWs(j + 1);
          if (js[j] === '(') list[id].invoked = true;
        }
        i++; continue;
      }
      if (js.startsWith('localStorage.', i) || js.startsWith('sessionStorage.', i)) {
        let guarded = false;
        for (let k = stack.length - 1; k >= 0; k--) if (list[stack[k]].istTry) { guarded = true; break; }
        let fnId = -1;
        for (let k = stack.length - 1; k >= 0; k--) if (list[stack[k]].kind === 'fn') { fnId = stack[k]; break; }
        refs.push({ pos: i, brace: stack[stack.length - 1], fnId, guarded });
      }
      i++;
    } else if (state === 'line') { if (c === '\n') state = 'code'; i++; }
    else if (state === 'blk') { if (c === '*' && n === '/') { state = 'code'; i += 2; } else i++; }
    else if (state === 'str') { if (c === '\\') i += 2; else { if (c === q) state = 'code'; i++; } }
    else if (state === 're') {
      let inCls = false, j = i;
      while (j < js.length) {
        if (js[j] === '\\') { j += 2; continue; }
        if (js[j] === '[') inCls = true;
        else if (js[j] === ']') inCls = false;
        else if (js[j] === '/' && !inCls) break;
        else if (js[j] === '\n') break; // malformed — bail as division
        j++;
      }
      i = j + 1; while (i < js.length && /[a-z]/i.test(js[i])) i++; // flags
      state = 'code'; continue;
    }
    else if (state === 'tpl') {
      if (c === '\\') i += 2;
      else if (c === '`') { state = 'code'; i++; }
      else if (c === '$' && n === '{') {
        const b = { id: list.length, kind: 'block', fname: null, parent: stack[stack.length - 1], istTry: false, invoked: false };
        list.push(b); stack.push(b.id); tplExpr.push(b.id); state = 'code'; i += 2;
      } else i++;
    }
  }
  const nearestFn = (bid) => { let b = bid; while (b > 0) { if (list[b].kind === 'fn') return b; b = list[b].parent; } return -1; };
  const evalMemo = {};
  const isEval = (bid) => {
    if (bid === 0) return true;
    if (bid in evalMemo) return evalMemo[bid];
    const b = list[bid];
    if (!b) return false;
    return evalMemo[bid] = b.kind === 'block' ? isEval(b.parent) : (b.invoked && isEval(b.parent));
  };
  const initPath = (r) => {
    let f = r.fnId;
    while (f !== -1) {
      if (list[f].fname === 'initMessenger') return true;
      if (!list[f].invoked) return false;
      f = nearestFn(list[f].parent);
    }
    return false;
  };
  return { refs, bootRefs: refs.filter(r => !r.guarded && (isEval(r.brace) || initPath(r))), list };
}

const { bootRefs } = scan(src);
const lineOf = (pos) => src.slice(0, pos).split('\n').length;

describe('boot-path storage accesses are throw-guarded (storage-disabled browsers)', () => {
  it('pins: engagement-gate block wrapped with let + safe defaults', () => {
    expect(src).toContain('let _visits = 1, _isEngagedVisitor = false;');
    expect(src).toContain("try { _visits = parseInt(localStorage.getItem('brz-visit-count') || '0') + 1; localStorage.setItem('brz-visit-count', String(_visits)); _isEngagedVisitor = _visits >= 2 || parseInt(localStorage.getItem('brz-msgs-sent') || '0') >= 3; } catch(e) { _dbg(e, 'visits'); }");
  });
  it('pins: consent banner read + accept wrapped (banner always dismisses)', () => {
    expect(src).toContain("try { if (localStorage.getItem('brz-consent')) return; } catch(e) { _dbg(e, 'consent-read'); }");
    expect(src).toContain("acceptBtn.onclick = () => { try { localStorage.setItem('brz-consent', Date.now()); } catch(e) { _dbg(e, 'consent-save'); } banner.remove(); };");
  });
  it('pins: auto-theme, theme IIFE, img-compress, compact restore wrapped', () => {
    expect(src).toContain("try { if (localStorage.getItem('brz-theme') === 'auto' || !localStorage.getItem('brz-theme')) { document.documentElement.classList.add('auto-theme'); } } catch(e) { _dbg(e, 'theme'); document.documentElement.classList.add('auto-theme'); }");
    expect(src).toContain("const saved = (() => { try { return localStorage.getItem('brz-theme'); } catch(e) { _dbg(e, 'theme'); return null; } })();");
    expect(src).toContain("let _imgCompress = (() => { try { return localStorage.getItem('brz-img-compress') || 'off'; } catch(e) { _dbg(e, 'img-compress'); return 'off'; } })();");
    expect(src).toContain("try { if (localStorage.getItem('brz-compact') === '1') document.body.classList.add('compact'); } catch(e) { _dbg(e, 'compact'); }");
  });
  it('pins: migrate uid, getActiveAccountId, privacy flags wrapped', () => {
    expect(src).toContain("const uid = (() => { try { return localStorage.getItem('brz-uid'); } catch { return null; } })();");
    expect(src).toContain("try { return localStorage.getItem('brz-active') || '0'; } catch { return '0'; }");
    expect(src).toContain("try { _privacyHideReadReceipts = localStorage.getItem('brz-hide-rr') === '1'; _privacyHideTyping = localStorage.getItem('brz-hide-typing') === '1'; } catch(e) { _dbg(e, 'privacy'); }");
  });
  it('sweep: zero unguarded storage refs on module-eval / initMessenger-direct paths', () => {
    // Sites already guarded by an unmerged PR (its diff must not be touched here):
    const PENDING_PR_SITES = [/sessionStorage\.setItem\('brz-shared-text'/]; // #184 quota-guard
    const found = bootRefs.filter(r => !PENDING_PR_SITES.some(re => re.test(src.slice(r.pos, r.pos + 60))));
    expect(found.map(r => 'line ' + lineOf(r.pos) + ': ' + src.slice(r.pos, r.pos + 50))).toEqual([]);
  });
  it('sweep fires: reverting the visits guard re-flags the site', () => {
    const broken = src
      .replace("try { _visits = parseInt(localStorage.getItem('brz-visit-count')", "_visits = parseInt(localStorage.getItem('brz-visit-count')")
      .replace("} catch(e) { _dbg(e, 'visits'); }", "");
    expect(scan(broken).bootRefs.length).toBeGreaterThan(0);
  });
  it('functional: throwing storage leaves safe engagement defaults', () => {
    const badStore = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
    const fn = new Function('localStorage', '_dbg', `
      let _visits = 1, _isEngagedVisitor = false;
      try { _visits = parseInt(localStorage.getItem('brz-visit-count') || '0') + 1; localStorage.setItem('brz-visit-count', String(_visits)); _isEngagedVisitor = _visits >= 2 || parseInt(localStorage.getItem('brz-msgs-sent') || '0') >= 3; } catch(e) { _dbg(e, 'visits'); }
      return { _visits, _isEngagedVisitor };
    `);
    expect(fn(badStore, () => {})).toEqual({ _visits: 1, _isEngagedVisitor: false });
  });
  it('functional: accept click removes the banner even when setItem throws', () => {
    const banner = { removed: false, remove() { this.removed = true; } };
    new Function('localStorage', 'banner', '_dbg',
      `(() => { try { localStorage.setItem('brz-consent', Date.now()); } catch(e) { _dbg(e, 'consent-save'); } banner.remove(); })()`)({ setItem() { throw new Error('x'); } }, banner, () => {});
    expect(banner.removed).toBe(true);
  });
});
