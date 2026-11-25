// CLDR 49 added Vietnamese one; keep shipped locale validation stable across ICU versions.
// https://github.com/unicode-org/cldr/blob/release-49/common/supplemental/plurals.xml
export function categoriesFor(loc) {
  if (loc === 'vi') return new Set(['one', 'other']);
  const pr = new Intl.PluralRules(loc);
  // Dense endings catch tl's other category (4/6/9); fractions catch decimal rules.
  const samples = [];
  for (let n = 0; n <= 120; n++) samples.push(n);
  samples.push(201, 1001, 0.5, 1.5);
  return new Set(samples.map(n => pr.select(n)));
}
