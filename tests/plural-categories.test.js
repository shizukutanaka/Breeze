import { describe, it, expect, vi } from 'vitest';
import { categoriesFor } from '../tools/plural-categories.mjs';

describe('locale plural categories', () => {
  it('keeps CLDR 49 Vietnamese forms on older ICU releases', () => {
    const pluralRules = vi.spyOn(Intl, 'PluralRules').mockImplementation(function () {
      return { select: () => 'other' };
    });
    try { expect([...categoriesFor('vi')]).toEqual(['one', 'other']); }
    finally { pluralRules.mockRestore(); }
  });

  it('samples dense endings and fractions for other locales', () => {
    expect([...categoriesFor('tl')].sort()).toEqual(['one', 'other']);
    expect([...categoriesFor('ja')]).toEqual(['other']);
    expect([...categoriesFor('en')].sort()).toEqual(['one', 'other']);
    expect([...categoriesFor('ar')].sort()).toEqual(['few', 'many', 'one', 'other', 'two', 'zero']);
  });
});
