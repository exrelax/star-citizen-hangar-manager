import { hasPriceChange } from '@/price-increases/price-change-filter';
import { isRewardWithPaint, type PledgeView } from './pledge-view';

/*
 * Filters of the manager lists. Each filter is a property of an entry and has three states: off,
 * `include` (only entries with the property) and `exclude` (only entries without it). All active
 * filters combine with AND.
 */

export type FilterState = 'include' | 'exclude';
export type FilterStates<F extends string> = ReadonlyMap<F, FilterState>;

/** The property behind each filter of a list. */
export type FilterPredicates<T, F extends string> = Record<F, (entry: T) => boolean>;

/** A click on a filter: off → include → exclude → off. */
export function nextFilterState(state: FilterState | undefined): FilterState | undefined {
  if (!state) return 'include';
  return state === 'include' ? 'exclude' : undefined;
}

/** Whether the entry passes all active filters (no active filter lets everything pass). */
export function matchesFilterStates<T, F extends string>(
  entry: T,
  states: FilterStates<F>,
  predicates: FilterPredicates<T, F>,
): boolean {
  for (const [filter, state] of states) {
    if (predicates[filter](entry) !== (state === 'include')) return false;
  }
  return true;
}

/**
 * For each filter, how many of `entries` have its property while passing all *other* active
 * filters. For a filter that is off this is the number of entries left after including it (0:
 * it would empty the list), for an included one the current number, for an excluded one the
 * number it hides. One pass over the entries, however many filters there are.
 */
export function filterCounts<T, F extends string>(
  entries: readonly T[],
  filters: readonly F[],
  states: FilterStates<F>,
  predicates: FilterPredicates<T, F>,
): Map<F, number> {
  const counts = new Map<F, number>(filters.map((filter) => [filter, 0]));
  for (const entry of entries) {
    const has = filters.map((filter) => predicates[filter](entry));
    // The active filters this entry fails; with more than one, no single filter can change that.
    let failing: F | undefined;
    let failures = 0;
    filters.forEach((filter, index) => {
      const state = states.get(filter);
      if (state && has[index] !== (state === 'include')) {
        failing = filter;
        failures++;
      }
    });
    if (failures > 1) continue;
    filters.forEach((filter, index) => {
      if (has[index] && (failures === 0 || failing === filter)) {
        counts.set(filter, counts.get(filter)! + 1);
      }
    });
  }
  return counts;
}

/**
 * A finer choice of a filter while it is included (#419), e.g. "Paints" narrowed down to the
 * paints for owned ships (#336). The first option is "all": the filter as it is. The others narrow
 * it down, each by its own `matches`, also in opposite directions. An excluded filter has none.
 */
export interface RefinementOption<T> {
  id: string;
  /** Its name in the list of options, e.g. "For owned ships". */
  label: string;
  /** Its name in the pill after the filter's, e.g. "Owned ships"; the label if none. */
  short?: string;
  /** The heading of the options it is among, if the options come in sections (#566). */
  section?: string;
  /** Narrows the filter down; none for the first option, "all". */
  matches?: (entry: T) => boolean;
}

/** The refinements of a list's filters; filters without one aren't in it. */
export type FilterRefinements<T, F extends string> = Partial<
  Record<F, readonly RefinementOption<T>[]>
>;

/** The option chosen per filter, by its id; a filter not in it is at "all". */
export type RefinementStates<F extends string> = ReadonlyMap<F, string>;

/** The option of a filter chosen in `chosen`, if it narrows the filter down (not "all"). */
export function chosenRefinement<T, F extends string>(
  filter: F,
  refinements: FilterRefinements<T, F> | undefined,
  chosen: RefinementStates<F>,
): RefinementOption<T> | undefined {
  const options = refinements?.[filter];
  const id = chosen.get(filter);
  if (!options || id === undefined) return undefined;
  const index = options.findIndex((option) => option.id === id);
  return index > 0 ? options[index] : undefined;
}

/**
 * The predicates with each refined filter narrowed down to its chosen option, for the list and
 * the counts (`filterCounts`) alike. The same object while nothing is refined.
 */
export function refinedPredicates<T, F extends string>(
  predicates: FilterPredicates<T, F>,
  refinements: FilterRefinements<T, F> | undefined,
  chosen: RefinementStates<F>,
): FilterPredicates<T, F> {
  let refined: FilterPredicates<T, F> | undefined;
  for (const filter of chosen.keys()) {
    const matches = chosenRefinement(filter, refinements, chosen)?.matches;
    if (!matches) continue;
    refined ??= { ...predicates };
    const base = predicates[filter];
    refined[filter] = (entry) => base(entry) && matches(entry);
  }
  return refined ?? predicates;
}

/** Order of a list's filter buttons and which of them are shown (settings, `FILTERS` in config). */
export interface FilterLayout<F extends string> {
  order: F[];
  shown: F[];
}

/**
 * A complete, valid layout from a stored one: unknown filters are dropped, missing ones (e.g.
 * added in a later version) follow at the end with their preset visibility from `defaults`.
 */
export function normalizeFilterLayout<F extends string>(
  stored: Partial<FilterLayout<string>> | null | undefined,
  all: readonly F[],
  defaults: FilterLayout<F>,
): FilterLayout<F> {
  const known = (filter: unknown): filter is F => all.includes(filter as F);
  const storedOrder = Array.isArray(stored?.order) ? [...new Set(stored.order.filter(known))] : [];
  const storedShown = Array.isArray(stored?.shown) ? stored.shown.filter(known) : [];
  const missing = [...defaults.order, ...all].filter(
    (filter, index, list) => list.indexOf(filter) === index && !storedOrder.includes(filter),
  );
  const order = [...storedOrder, ...missing];
  const shown = order.filter((filter) =>
    storedOrder.includes(filter) ? storedShown.includes(filter) : defaults.shown.includes(filter),
  );
  return { order, shown };
}

/**
 * Filters come in two categories, shown as separate groups: `types` say what a pledge is (a
 * ship, a CCU, …), `features` what it has or allows (LTI, gift, melt, …).
 */
export const FILTER_CATEGORIES = ['types', 'features'] as const;
export type FilterCategory = (typeof FILTER_CATEGORIES)[number];

/** Order and selection of each category's filters. */
export type FilterGroups<F extends string> = Record<FilterCategory, FilterLayout<F>>;

/** `normalizeFilterLayout` for each category; `categories` says which filters belong to which. */
export function normalizeFilterGroups<F extends string>(
  stored: Partial<Record<FilterCategory, Partial<FilterLayout<string>>>> | null | undefined,
  categories: Record<FilterCategory, readonly F[]>,
  defaults: FilterGroups<F>,
): FilterGroups<F> {
  return {
    types: normalizeFilterLayout(stored?.types, categories.types, defaults.types),
    features: normalizeFilterLayout(stored?.features, categories.features, defaults.features),
  };
}

/** The filter buttons of a layout, in their order. */
export function shownFilters<F extends string>(layout: FilterLayout<F>): F[] {
  return layout.order.filter((filter) => layout.shown.includes(filter));
}

/** All filters of the hangar list (their order and selection: `FILTERS` in config). */
export const PLEDGE_FILTERS = [
  'ships',
  'ccus',
  'paints',
  'gameAccess',
  'lti',
  'warbond',
  'giftable',
  'meltable',
  'valuable',
  'discount',
  'priceChange',
  'rewards',
] as const;
export type PledgeFilter = (typeof PLEDGE_FILTERS)[number];

export const PLEDGE_FILTER_CATEGORIES: Record<FilterCategory, readonly PledgeFilter[]> = {
  types: ['ships', 'ccus', 'paints', 'gameAccess', 'rewards'],
  features: ['lti', 'warbond', 'giftable', 'meltable', 'valuable', 'discount', 'priceChange'],
};

export const PLEDGE_FILTER_PREDICATES: FilterPredicates<PledgeView, PledgeFilter> = {
  // Any pledge with a ship: standalone ships, packages, upgraded ships.
  ships: (pledge) => pledge.items.some((item) => item.kind === 'Ship'),
  ccus: (pledge) => pledge.isCcu,
  // Also a reward with a paint (#581).
  paints: (pledge) => pledge.isPaint || isRewardWithPaint(pledge),
  gameAccess: (pledge) => pledge.hasGameAccess,
  lti: (pledge) => pledge.hasLti,
  // Bought with money: the pledge has an order paid with money (see src/orders).
  warbond: (pledge) => pledge.order !== undefined,
  giftable: (pledge) => pledge.isGiftable,
  meltable: (pledge) => pledge.isMeltable,
  valuable: (pledge) => pledge.valueUsd > 0,
  // Bought for less than the original price (see ship-prices.ts); unknown or higher: no match.
  discount: (pledge) => (pledge.discount?.amount ?? 0) > 0,
  rewards: (pledge) => pledge.reward !== undefined,
  // Any upcoming price change; the list limits it to the period of the settings (#256).
  priceChange: hasPriceChange,
};
