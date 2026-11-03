import { describe, expect, it } from 'vitest';
import {
  filterCounts,
  matchesFilterStates,
  nextFilterState,
  normalizeFilterLayout,
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
