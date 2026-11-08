import { BUYBACK_FILTER_CATEGORIES, BUYBACK_FILTERS } from '@/buyback/buyback-view';
import { paintRebuys } from '@/store/paint-consultant/use-paint-consultant';
import { FILTERS } from '@/config';
import { afterEach, describe, expect, it } from 'vitest';
import {
  filterCounts,
  matchesFilterStates,
  nextFilterState,
  normalizeFilterGroups,
  normalizeFilterLayout,
  PLEDGE_FILTER_CATEGORIES,
  PLEDGE_FILTER_PREDICATES,
  PLEDGE_FILTERS,
  shownFilters,
  type FilterLayout,
  type FilterState,
  type PledgeFilter,
} from './filters';
import type { PledgeView } from './pledge-view';

const pledge = (id: number, overrides: Partial<PledgeView> = {}) =>
  ({
    id,
    items: [],
    hasLti: false,
    isPaint: false,
    isCcu: false,
    hasGameAccess: false,
    isGiftable: false,
    isMeltable: false,
    valueUsd: 10,
    ...overrides,
  }) as PledgeView;

const ship = { title: 'Polaris', kind: 'Ship' };
const pledges = [
  pledge(1, { items: [ship], hasLti: true, isGiftable: true }),
  pledge(2, { items: [ship], isGiftable: false }),
  pledge(3, { isCcu: true, isGiftable: true }),
  pledge(4, { isPaint: true, valueUsd: 0, reward: 'event' }),
];

const states = (entries: [PledgeFilter, FilterState][]) => new Map(entries);
const shown = (entries: [PledgeFilter, FilterState][]) =>
  pledges
    .filter((entry) => matchesFilterStates(entry, states(entries), PLEDGE_FILTER_PREDICATES))
    .map((entry) => entry.id);

describe('nextFilterState', () => {
  it('cycles off → include → exclude → off', () => {
    expect(nextFilterState(undefined)).toBe('include');
    expect(nextFilterState('include')).toBe('exclude');
    expect(nextFilterState('exclude')).toBeUndefined();
  });
});

describe('matchesFilterStates', () => {
  it('shows only entries with an included property, and only those without an excluded one', () => {
    expect(shown([])).toEqual([1, 2, 3, 4]);
    expect(shown([['ships', 'include']])).toEqual([1, 2]);
    expect(shown([['ships', 'exclude']])).toEqual([3, 4]);
  });

  it('combines all filters with AND', () => {
    expect(
      shown([
        ['ships', 'include'],
        ['giftable', 'include'],
      ]),
    ).toEqual([1]);
    expect(
      shown([
        ['giftable', 'include'],
        ['ccus', 'exclude'],
      ]),
    ).toEqual([1]);
    // Ships and CCUs at once: no pledge is both.
    expect(
      shown([
        ['ships', 'include'],
        ['ccus', 'include'],
      ]),
    ).toEqual([]);
    expect(
      shown([
        ['rewards', 'exclude'],
        ['valuable', 'include'],
      ]),
    ).toEqual([1, 2, 3]);
  });
});

describe('discount filter', () => {
  const discount = (amount: number) => ({
    original: 50,
    paid: 50 - amount,
    amount,
    percent: 0,
    ships: [],
  });

  it('matches only pledges bought for less than the original price', () => {
    const matches = PLEDGE_FILTER_PREDICATES.discount;
    expect(matches(pledge(1, { discount: discount(25) }))).toBe(true);
    expect(matches(pledge(2, { discount: discount(0) }))).toBe(false);
    expect(matches(pledge(3, { discount: discount(-5) }))).toBe(false);
    expect(matches(pledge(4))).toBe(false);
  });

  it('joins the stored layouts of existing users, shown after the others', () => {
    const stored = { order: ['valuable', 'lti'], shown: ['lti'] };
    const layout = normalizeFilterLayout(
      stored,
      PLEDGE_FILTER_CATEGORIES.features,
      FILTERS.hangar.features,
    );
    expect(layout.order.slice(-2)).toEqual(['discount', 'paintRebuy']);
    expect(layout.shown).toEqual(expect.arrayContaining(['discount', 'paintRebuy']));
  });
});

describe('paint rebuy filter', () => {
  afterEach(() => (paintRebuys.value = new Map()));

  it('matches the paints the Paint Discount Consultant would buy again', () => {
    paintRebuys.value = new Map([[1, { from: 0, to: 35, freed: 1.75 }]]);
    const matches = PLEDGE_FILTER_PREDICATES.paintRebuy;
    expect(matches(pledge(1))).toBe(true);
    expect(matches(pledge(2))).toBe(false);
  });
});

describe('filterCounts', () => {
  const counts = (entries: [PledgeFilter, FilterState][]) =>
    Object.fromEntries(
      filterCounts(pledges, PLEDGE_FILTERS, states(entries), PLEDGE_FILTER_PREDICATES),
    );

  it('counts the entries with each property when nothing is filtered', () => {
    expect(counts([])).toMatchObject({ ships: 2, ccus: 1, paints: 1, giftable: 2, rewards: 1 });
  });

  it('counts within the other active filters, so the numbers follow the selection', () => {
    // With ships included: of the ships, one is giftable, none is a CCU.
    expect(counts([['ships', 'include']])).toMatchObject({
      ships: 2,
      giftable: 1,
      ccus: 0,
      lti: 1,
    });
    // An excluded filter shows how many entries it hides: the two ships.
    expect(counts([['ships', 'exclude']])).toMatchObject({ ships: 2, ccus: 1, giftable: 1 });
  });
});

describe('normalizeFilterLayout', () => {
  const all = ['a', 'b', 'c', 'd'] as const;
  const defaults = { order: ['b', 'a', 'c', 'd'], shown: ['b', 'a', 'd'] } as FilterLayout<
    (typeof all)[number]
  >;

  it('uses the presets when nothing is stored', () => {
    expect(normalizeFilterLayout(undefined, all, defaults)).toEqual({
      order: ['b', 'a', 'c', 'd'],
      shown: ['b', 'a', 'd'],
    });
  });

  it('keeps the stored order and selection', () => {
    expect(
      normalizeFilterLayout({ order: ['d', 'c', 'b', 'a'], shown: ['c'] }, all, defaults),
    ).toEqual({ order: ['d', 'c', 'b', 'a'], shown: ['c'] });
  });

  it('drops unknown filters and appends missing ones with their preset visibility', () => {
    expect(
      normalizeFilterLayout({ order: ['x', 'c', 'b'], shown: ['x', 'c'] }, all, defaults),
    ).toEqual({ order: ['c', 'b', 'a', 'd'], shown: ['c', 'a', 'd'] });
  });

  it('shows the shown filters in their order', () => {
    expect(shownFilters({ order: ['c', 'a', 'b'], shown: ['b', 'c'] })).toEqual(['c', 'b']);
  });
});

describe('filter categories', () => {
  it('put every filter into exactly one category', () => {
    const categorized = [...PLEDGE_FILTER_CATEGORIES.types, ...PLEDGE_FILTER_CATEGORIES.features];
    expect([...categorized].sort()).toEqual([...PLEDGE_FILTERS].sort());
    const buyback = [...BUYBACK_FILTER_CATEGORIES.types, ...BUYBACK_FILTER_CATEGORIES.features];
    expect([...buyback].sort()).toEqual([...BUYBACK_FILTERS].sort());
  });

  it('normalize each category on its own', () => {
    const groups = normalizeFilterGroups(
      { types: { order: ['paints', 'ships'], shown: ['ships'] } },
      PLEDGE_FILTER_CATEGORIES,
      FILTERS.hangar,
    );
    expect(groups.types.order.slice(0, 2)).toEqual(['paints', 'ships']);
    expect(groups.types.shown).not.toContain('paints');
    expect(groups.features).toEqual(FILTERS.hangar.features);
  });
});
