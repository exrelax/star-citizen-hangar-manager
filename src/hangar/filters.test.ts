import { describe, expect, it } from 'vitest';
import { matchesFilters, type PledgeFilter } from './filters';
import type { PledgeView } from './pledge-view';

const pledge = (overrides: Partial<PledgeView>) =>
  ({
    hasLti: false,
    isPaint: false,
    isCcu: false,
    isStandaloneShip: false,
    hasGameAccess: false,
    isGiftable: false,
    isMeltable: false,
    ...overrides,
  }) as PledgeView;

const passes = (view: PledgeView, ...filters: PledgeFilter[]) =>
  matchesFilters(view, new Set(filters));

describe('matchesFilters', () => {
  it('lets everything pass without active filters', () => {
    expect(passes(pledge({}))).toBe(true);
  });

  it('combines categories with OR', () => {
    expect(passes(pledge({ isPaint: true }), 'paints', 'ccus')).toBe(true);
    expect(passes(pledge({ isCcu: true }), 'paints', 'ccus')).toBe(true);
    expect(passes(pledge({ isStandaloneShip: true }), 'paints', 'ccus')).toBe(false);
  });

  it('combines properties with AND', () => {
    expect(passes(pledge({ isGiftable: true, isMeltable: true }), 'giftable', 'meltable')).toBe(
      true,
    );
    expect(passes(pledge({ isGiftable: true }), 'giftable', 'meltable')).toBe(false);
  });

  it('requires properties within the selected categories', () => {
    const ltiShip = pledge({ isStandaloneShip: true, hasLti: true });
    const plainShip = pledge({ isStandaloneShip: true });
    const ltiPackage = pledge({ hasGameAccess: true, hasLti: true });

    expect(passes(ltiShip, 'standaloneShips', 'lti')).toBe(true);
    expect(passes(plainShip, 'standaloneShips', 'lti')).toBe(false);
    expect(passes(ltiPackage, 'standaloneShips', 'lti')).toBe(false);
  });
});
