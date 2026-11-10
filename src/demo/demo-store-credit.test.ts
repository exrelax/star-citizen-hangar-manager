import { describe, expect, it } from 'vitest';
import { planPaintRebuy } from '@/store/paint-consultant/calculation';
import { FALLBACK_CATALOG } from './catalog';
import { generatedHangar } from './demo';
import { caseOf, creditForCases, type CreditCase } from './demo-store-credit';

const TODAY = '2026-11-10';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const OPTIONS = { useFillers: true, skipGiftable: false };

// key-b's lower tiers cost more than its best one: buying first never reaches only a lower tier.
describe.each<[string, CreditCase[]]>([
  ['key-a', ['impossible', 'lowerTier', 'none', 'same']],
  ['key-b', ['impossible', 'none', 'same']],
  ['key-c', ['impossible', 'lowerTier', 'none', 'same']],
])('the store credit cases of the demo %s (#179)', (key, expected) => {
  const pledges = generatedHangar(FALLBACK_CATALOG, key, TODAY, NOW);
  const items = FALLBACK_CATALOG.items;
  const cases = creditForCases(pledges, items, OPTIONS);

  it('finds a store credit for each case the hangar allows, and each shows its case', () => {
    expect(Object.keys(cases).sort()).toEqual(expected);
    for (const kind of ['same', 'lowerTier', 'impossible'] as const) {
      if (cases[kind] === undefined) continue;
      const result = planPaintRebuy({
        pledges,
        storeItems: items,
        storeCredit: cases[kind],
        ...OPTIONS,
        guessRebought: false,
      });
      expect(caseOf(result)).toBe(kind);
    }
    expect(cases.none).toBe(0);
  });
});
