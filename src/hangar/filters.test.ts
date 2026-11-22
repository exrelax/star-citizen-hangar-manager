import { BUYBACK_FILTER_CATEGORIES, BUYBACK_FILTERS } from '@/buyback/buyback-view';
import { FILTERS } from '@/config';
import { describe, expect, it } from 'vitest';
import {
  chosenRefinement,
  filterCounts,
  matchesFilterStates,
  nextFilterState,
  normalizeFilterGroups,
  normalizeFilterLayout,
  refinedPredicates,
  PLEDGE_FILTER_CATEGORIES,
  PLEDGE_FILTER_PREDICATES,
  PLEDGE_FILTERS,
  shownFilters,
  type FilterLayout,
  type FilterState,
  type PledgeFilter,
} from './filters';
import type { PledgeView } from './pledge-view';
import type { AlwaysAvailableList } from '@/ccu-consultant/always-available';
import { ccuRefinement } from '@/ccu-consultant/base-ship-list';
import {
  BUYBACK_FILTER_PREDICATES,
  type BuybackFilter,
  type BuybackView,
} from '@/buyback/buyback-view';
import type { BuybackPledge } from '@/buyback/buyback';
import { createBuybackShipKind, pledgeShipKind, shipKindRefinement } from './ship-kind';
import {
  allCcus,
  buybackCcuContents,
  ccuRefinementWithContents,
  hangarCcuContents,
} from './ccu-contents';
import type { CcuCoverage } from '@/ccu-consultant/coverage';

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
    expect(layout.order.slice(-3)).toEqual(['meltable', 'discount', 'priceChange']);
    expect(layout.shown).toEqual(expect.arrayContaining(['discount']));
  });
});

describe('price increase filter', () => {
  it('joins the stored buy back layouts of existing users, shown (#192)', () => {
    const stored = { order: ['available', 'lti'], shown: ['lti', 'available'] };
    const layout = normalizeFilterLayout(
      stored,
      BUYBACK_FILTER_CATEGORIES.features,
      FILTERS.buyback.features,
    );
    expect(layout.order.at(-1)).toBe('priceIncrease');
    expect(layout.shown).toContain('priceIncrease');
  });
});

describe('price change filter', () => {
  it('joins the stored hangar layouts of existing users, shown (#256)', () => {
    const stored = { order: ['discount', 'lti'], shown: ['lti', 'discount'] };
    const layout = normalizeFilterLayout(
      stored,
      PLEDGE_FILTER_CATEGORIES.features,
      FILTERS.hangar.features,
    );
    expect(layout.order.at(-1)).toBe('priceChange');
    expect(layout.shown).toContain('priceChange');
  });
});

describe('paint rebuy filter', () => {
  it('is no filter button any more: a stored layout drops it', () => {
    const stored = { order: ['paintRebuy', 'lti'], shown: ['paintRebuy', 'lti'] };
    const layout = normalizeFilterLayout(
      stored,
      PLEDGE_FILTER_CATEGORIES.features,
      FILTERS.hangar.features,
    );
    expect(layout.order).not.toContain('paintRebuy');
    expect(layout.shown).not.toContain('paintRebuy');
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

describe('refined filters (#419)', () => {
  type Entry = { id: number; paint: boolean; owned: boolean };
  type F = 'paints' | 'other';
  const entries: Entry[] = [
    { id: 1, paint: true, owned: true },
    { id: 2, paint: true, owned: false },
    { id: 3, paint: true, owned: true },
    { id: 4, paint: false, owned: true },
  ];
  const predicates = {
    paints: (entry: Entry) => entry.paint,
    other: (entry: Entry) => entry.owned,
  };
  const refinements = {
    paints: [
      { id: 'all', label: 'All paints' },
      {
        id: 'owned',
        label: 'For owned ships',
        short: 'Owned ships',
        matches: (e: Entry) => e.owned,
      },
      { id: 'notOwned', label: 'For ships not owned', matches: (e: Entry) => !e.owned },
    ],
  };

  it('narrows a filter down to the chosen option, "all" leaves it as it is', () => {
    expect(refinedPredicates(predicates, refinements, new Map())).toBe(predicates);
    expect(refinedPredicates(predicates, refinements, new Map([['paints', 'all']]))).toBe(
      predicates,
    );
    const owned = refinedPredicates<Entry, F>(
      predicates,
      refinements,
      new Map([['paints', 'owned']]),
    );
    expect(entries.filter(owned.paints).map((e) => e.id)).toEqual([1, 3]);
    const notOwned = refinedPredicates<Entry, F>(
      predicates,
      refinements,
      new Map([['paints', 'notOwned']]),
    );
    expect(entries.filter(notOwned.paints).map((e) => e.id)).toEqual([2]);
    // Other filters keep their predicate.
    expect(owned.other).toBe(predicates.other);
  });

  it('knows only options of the filter, never "all" as a refinement', () => {
    expect(
      chosenRefinement<Entry, F>('paints', refinements, new Map([['paints', 'owned']]))?.id,
    ).toBe('owned');
    expect(chosenRefinement<Entry, F>('paints', refinements, new Map([['paints', 'all']]))).toBe(
      undefined,
    );
    expect(chosenRefinement<Entry, F>('paints', refinements, new Map([['paints', 'gone']]))).toBe(
      undefined,
    );
    expect(chosenRefinement<Entry, F>('other', refinements, new Map([['other', 'owned']]))).toBe(
      undefined,
    );
  });

  it('counts by the refined filter, also for the other filters', () => {
    const states = new Map<F, FilterState>([['paints', 'include']]);
    const refined = refinedPredicates<Entry, F>(
      predicates,
      refinements,
      new Map([['paints', 'notOwned']]),
    );
    expect(filterCounts(entries, ['paints', 'other'], states, refined)).toEqual(
      new Map([
        ['paints', 1],
        ['other', 0],
      ]),
    );
  });
});

describe('the "CCUs" filter by base ship coverage (#461)', () => {
  const none = { ships: [], ccus: [] };
  const coverage = (id: number, base: number, buyback = false, hangar = false): CcuCoverage => ({
    id,
    baseShip: { id: base, name: `Ship ${base}` },
    hangar: hangar
      ? { ships: [{ source: 'hangar', kind: 'ship', id: 900, title: 'S' }], ccus: [] }
      : none,
    buyback: buyback
      ? { ships: [], ccus: [{ source: 'buyback', kind: 'ccu', id: 800, title: 'C' }] }
      : none,
    covered: buyback || hangar,
  });
  const coverages = new Map(
    [coverage(1, 7), coverage(2, 8), coverage(3, 8, true), coverage(4, 9, false, true)].map((c) => [
      c.id,
      c,
    ]),
  );
  const always: AlwaysAvailableList = {
    source: { id: 'wiki', name: 'Star Citizen Wiki', url: 'https://w', facts: [] },
    changedAt: '',
    has: (id) => id === 7,
  };
  const ccus = [1, 2, 3, 4].map((id) => pledge(id, { isCcu: true }));
  const states = new Map<PledgeFilter, FilterState>([['ccus', 'include']]);
  const listed = (option: string, list: AlwaysAvailableList | undefined) => {
    const refinements = { ccus: ccuRefinement<PledgeView>(coverages, list) };
    const predicates = refinedPredicates(
      PLEDGE_FILTER_PREDICATES,
      refinements,
      new Map<PledgeFilter, string>([['ccus', option]]),
    );
    return {
      ids: ccus.filter((entry) => matchesFilterStates(entry, states, predicates)).map((e) => e.id),
      count: filterCounts(ccus, ['ccus'], states, predicates).get('ccus'),
      options: refinements.ccus.map((o) => o.label),
    };
  };

  it('lists the CCUs without base ship and those with an always available one', () => {
    expect(listed('all', always)).toEqual({
      ids: [1, 2, 3, 4],
      count: 4,
      options: ['All CCUs', 'Without base ship', 'Base always available', 'Base limited'],
    });
    expect(listed('missing', always).ids).toEqual([2]);
    expect(listed('missing', always).count).toBe(1);
  });

  it('splits the CCUs by their base ship: always available or limited, covered or not', () => {
    const both = new Map(coverages);
    both.set(5, coverage(5, 7, true));
    const refinements = { ccus: ccuRefinement<PledgeView>(both, always) };
    const entries = [...ccus, pledge(5, { isCcu: true }), pledge(6, { isCcu: true })];
    const ids = (option: string) => {
      const predicates = refinedPredicates(
        PLEDGE_FILTER_PREDICATES,
        refinements,
        new Map<PledgeFilter, string>([['ccus', option]]),
      );
      return entries.filter((e) => matchesFilterStates(e, states, predicates)).map((e) => e.id);
    };
    // 5 is covered by the buy back, its base ship always available; 6 has no coverage known.
    expect(ids('always')).toEqual([1, 5]);
    expect(ids('limited')).toEqual([2, 3, 4]);
  });

  it('counts always available base ships as missing while they are not considered', () => {
    const off = listed('missing', undefined);
    expect(off.ids).toEqual([1, 2]);
    expect(off.options).toEqual(['All CCUs', 'Without base ship']);
    // A choice no longer offered falls back to all CCUs.
    expect(listed('always', undefined).ids).toEqual([1, 2, 3, 4]);
    expect(listed('limited', undefined).ids).toEqual([1, 2, 3, 4]);
  });
});

describe('the "Ships" filter by kind (#514)', () => {
  const insurance = { title: 'Lifetime Insurance', kind: 'Insurance' };
  const hangar = { title: 'Self-Land Hangar', kind: 'Hangar decoration' };
  const hangarPledges = [
    // Hangar decoration comes with the ship, without a kind or as such.
    pledge(1, {
      items: [
        { title: 'Avenger Titan', kind: 'Ship' },
        insurance,
        hangar,
        { title: 'Aegis Poster' },
        { title: 'Takuetsu Aegis Model', kind: 'Hangar decoration' },
      ],
    }),
    pledge(2, {
      items: [
        { title: 'Mustang Alpha', kind: 'Ship' },
        insurance,
        { title: 'Star Citizen Digital Download', kind: 'Downloadable' },
      ],
    }),
    pledge(3, {
      items: [
        { title: 'Cutlass Black', kind: 'Ship' },
        { title: 'Helmet', kind: 'FPS Equipment' },
      ],
    }),
    pledge(4, {
      items: [
        { title: 'Nox', kind: 'Ship' },
        { title: 'Nox Kue', kind: 'Ship' },
      ],
    }),
    // A pack with extras is a pack; an upgraded pack by its current ships.
    pledge(5, {
      isUpgraded: true,
      items: [
        { title: 'Carrack', kind: 'Ship' },
        { title: 'Pisces', kind: 'Ship' },
        { title: 'Carrack - Best In Show Paint', kind: 'Skin' },
      ],
    }),
    pledge(6, { isCcu: true }),
    // Gear without a kind is an extra.
    pledge(8, { items: [{ title: 'Gladius', kind: 'Ship' }, { title: 'ORC-mkX Helmet Iceborn' }] }),
    pledge(7, { isPaint: true, items: [{ title: 'Sabre - Ashcloud Paint', kind: 'Skin' }] }),
  ];
  const refinements = {
    ships: shipKindRefinement<PledgeView>((entry) => pledgeShipKind(entry.items)),
  };
  const states = new Map<PledgeFilter, FilterState>([['ships', 'include']]);
  const listed = (option: string) => {
    const predicates = refinedPredicates(
      PLEDGE_FILTER_PREDICATES,
      refinements,
      new Map<PledgeFilter, string>([['ships', option]]),
    );
    return {
      ids: hangarPledges.filter((e) => matchesFilterStates(e, states, predicates)).map((e) => e.id),
      count: filterCounts(hangarPledges, ['ships'], states, predicates).get('ships'),
    };
  };

  it('offers all ships, solo ships, ships with extras and ship packs', () => {
    expect(refinements.ships.map((option) => option.label)).toEqual([
      'All ships',
      'Solo ships',
      'Ships with extras',
      'Ship packs',
    ]);
    expect(refinements.ships.map((option) => option.short)).toEqual([
      undefined,
      'Solo',
      'With extras',
      'Packs',
    ]);
  });

  it('lists exactly the pledges of each kind in My Hangar, with their counts', () => {
    expect(listed('all')).toEqual({ ids: [1, 2, 3, 4, 5, 8], count: 6 });
    // Insurance and a hangar don't count as extras; game access and gear do.
    expect(listed('solo')).toEqual({ ids: [1], count: 1 });
    expect(listed('extras')).toEqual({ ids: [2, 3, 8], count: 3 });
    expect(listed('pack')).toEqual({ ids: [4, 5], count: 2 });
  });

  it('has no kind for a pledge without a ship', () => {
    expect(pledgeShipKind([])).toBeUndefined();
    expect(pledgeShipKind([{ title: 'Sabre - Ashcloud Paint', kind: 'Skin' }])).toBeUndefined();
  });

  describe('in the Buy Back', () => {
    const kindOf = createBuybackShipKind({
      ships: [{ name: 'Nox' }, { name: 'Pisces C8X' }],
      hangarPledges: [
        {
          items: [
            { title: 'Nox Kue', kind: 'Ship' },
            { title: 'Aegis Plaque', kind: 'Hangar decoration' },
          ],
        },
      ],
    });
    const buyback = (id: number, contained: string, items?: string[]): BuybackView => {
      const ships = contained ? [contained.replace(/ and \d+ items?$/, '')] : [];
      const source = { contained, ...(items && { items }) } as BuybackPledge;
      const shipKind = kindOf(source, ships);
      return {
        id,
        ships: ships.map((name) => ({ name })),
        ...(shipKind && { shipKind }),
      } as BuybackView;
    };
    const entries = [
      buyback(11, 'Avenger Titan'),
      buyback(12, 'Avenger Titan and 2 items', [
        'Avenger Titan',
        '120 Month Insurance',
        'VFG Industrial Hangar',
        'Aegis Plaque',
        'Argo Poster',
      ]),
      buyback(13, 'Mustang Alpha and 2 items', [
        'Mustang Alpha',
        'Lifetime Insurance',
        'Squadron 42 Digital Download',
      ]),
      // A ship of the catalog and one named as the hangar names it.
      buyback(14, 'Nox and 2 items', ['Nox', 'Nox Kue', 'Lifetime Insurance']),
      buyback(15, 'Carrack and 3 items', ['Carrack', 'Pisces C8X', 'Carrack - Paint', 'Helmet']),
      // Its items weren't read: no kind, only under "All ships".
      buyback(16, 'Fury and 4 items'),
    ];
    const buybackStates = new Map<BuybackFilter, FilterState>([['ships', 'include']]);
    const refined = { ships: shipKindRefinement<BuybackView>((entry) => entry.shipKind) };
    const ids = (option: string) => {
      const predicates = refinedPredicates(
        BUYBACK_FILTER_PREDICATES,
        refined,
        new Map<BuybackFilter, string>([['ships', option]]),
      );
      return {
        ids: entries
          .filter((e) => matchesFilterStates(e, buybackStates, predicates))
          .map((e) => e.id),
        count: filterCounts(entries, ['ships'], buybackStates, predicates).get('ships'),
      };
    };

    it('lists exactly the pledges of each kind, with their counts', () => {
      expect(ids('all')).toEqual({ ids: [11, 12, 13, 14, 15, 16], count: 6 });
      expect(ids('solo')).toEqual({ ids: [11, 12], count: 2 });
      expect(ids('extras')).toEqual({ ids: [13], count: 1 });
      expect(ids('pack')).toEqual({ ids: [14, 15], count: 2 });
    });

    it('has no kind for a pledge without a ship', () => {
      expect(kindOf({ contained: 'Sabre - Blue Steel Paint' }, [])).toBeUndefined();
    });
  });
});

describe('the "CCUs" filter by contents (#566)', () => {
  const target = (...names: string[]) => ({
    matchItems: [],
    type: 'R',
    targetItems: names.map((name, index) => ({ id: index + 1, name })),
  });
  const ccus = [
    pledge(1, { isCcu: true, upgrade: target('Carrack') }),
    // An insurance is no extra.
    pledge(2, { isCcu: true, upgrade: target('Polaris', 'Lifetime Insurance') }),
    pledge(3, { isCcu: true, upgrade: target('Hull C', '120 Month Insurance', 'Hull C - Paint') }),
    pledge(4, { isCcu: true, upgrade: target('Cutlass Black', 'Ballistic Rifle') }),
    pledge(5, { isCcu: true }),
    pledge(6, { items: [{ title: 'Gladius', kind: 'Ship' }] }),
  ];
  const states = new Map<PledgeFilter, FilterState>([['ccus', 'include']]);
  const byBase = ccuRefinement<PledgeView>(new Map(), undefined);
  const refinements = {
    ccus: ccuRefinementWithContents(byBase, (entry: PledgeView) =>
      hangarCcuContents(entry.upgrade),
    ),
  };
  const listed = (option: string) => {
    const predicates = refinedPredicates(
      PLEDGE_FILTER_PREDICATES,
      refinements,
      new Map<PledgeFilter, string>([['ccus', option]]),
    );
    return {
      ids: ccus.filter((e) => matchesFilterStates(e, states, predicates)).map((e) => e.id),
      count: filterCounts(ccus, ['ccus'], states, predicates).get('ccus'),
    };
  };

  it('adds solo CCUs and CCUs with extras in a section after those by base ship', () => {
    expect(refinements.ccus.map((option) => [option.label, option.short, option.section])).toEqual([
      ['All CCUs', undefined, undefined],
      ['Without base ship', undefined, 'Base ship'],
      ['Solo CCUs', 'Solo', 'Contents'],
      ['CCUs with extras', 'With extras', 'Contents'],
    ]);
  });

  it('lists exactly the CCUs of each kind in My Hangar, with their counts', () => {
    expect(listed('all')).toEqual({ ids: [1, 2, 3, 4, 5], count: 5 });
    expect(listed('solo')).toEqual({ ids: [1, 2], count: 2 });
    expect(listed('extras')).toEqual({ ids: [3, 4], count: 2 });
  });

  it('has no sections in the Buy Back, which has no options by base ship', () => {
    const options = ccuRefinementWithContents<BuybackView>(allCcus(), (e) => e.ccuContents);
    expect(options.map((option) => [option.id, option.section])).toEqual([
      ['all', undefined],
      ['solo', undefined],
      ['extras', undefined],
    ]);
  });

  it('tells what a CCU of the Buy Back brings by its items', () => {
    const ccu = (contained: string, items?: string[]) =>
      buybackCcuContents({ isUpgrade: true, contained, ...(items && { items }) });
    expect(ccu('Upgrade - Carrack to Polaris')).toBe('solo');
    expect(
      ccu('Upgrade - Avenger to Titan and 1 item', [
        'Upgrade - Avenger to Titan',
        'Lifetime Insurance',
      ]),
    ).toBe('solo');
    expect(
      ccu('Upgrade - Avenger to Titan and 1 item', ['Upgrade - Avenger to Titan', 'Titan - Paint']),
    ).toBe('extras');
    // Its items weren't read: no kind, only under "All CCUs".
    expect(ccu('Upgrade - Avenger to Titan and 2 items')).toBeUndefined();
    expect(buybackCcuContents({ isUpgrade: false, contained: 'Gladius' })).toBeUndefined();
  });
});
