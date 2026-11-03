import type { PledgeView } from './pledge-view';

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
  'rewards',
] as const;
export type PledgeFilter = (typeof PLEDGE_FILTERS)[number];

export const PLEDGE_FILTER_PREDICATES: FilterPredicates<PledgeView, PledgeFilter> = {
  // Any pledge with a ship: standalone ships, packages, upgraded ships.
  ships: (pledge) => pledge.items.some((item) => item.kind === 'Ship'),
  ccus: (pledge) => pledge.isCcu,
  paints: (pledge) => pledge.isPaint,
  gameAccess: (pledge) => pledge.hasGameAccess,
  lti: (pledge) => pledge.hasLti,
  // Bought with money: the pledge has an order paid with money (see src/orders).
  warbond: (pledge) => pledge.order !== undefined,
  giftable: (pledge) => pledge.isGiftable,
  meltable: (pledge) => pledge.isMeltable,
  valuable: (pledge) => pledge.valueUsd > 0,
  rewards: (pledge) => pledge.reward !== undefined,
};
