import type { PledgeView } from './pledge-view';

/** Filters of the manager list, in display order. */
export const PLEDGE_FILTERS = [
  'lti',
  'paints',
  'ccus',
  'standaloneShips',
  'gameAccess',
  'giftable',
  'meltable',
] as const;
export type PledgeFilter = (typeof PLEDGE_FILTERS)[number];

/** Predicates of the filters of a list: categories combine with OR, properties with AND. */
export interface FilterDefinition<T, F extends string> {
  /** An entry belongs to at most one category, so active categories combine with OR. */
  categories: Partial<Record<F, (entry: T) => boolean>>;
  /** Properties narrow the result, so they combine with AND (also with the categories). */
  properties: Partial<Record<F, (entry: T) => boolean>>;
}

/** Whether the entry passes the active filters (no active filter lets everything pass). */
export function matchesFilterDefinition<T, F extends string>(
  entry: T,
  active: ReadonlySet<F>,
  definition: FilterDefinition<T, F>,
): boolean {
  let hasCategory = false;
  let inCategory = false;
  for (const filter of active) {
    const property = definition.properties[filter];
    if (property && !property(entry)) return false;

    const category = definition.categories[filter];
    if (category) {
      hasCategory = true;
      inCategory ||= category(entry);
    }
  }
  return !hasCategory || inCategory;
}

export const PLEDGE_FILTER_DEFINITION: FilterDefinition<PledgeView, PledgeFilter> = {
  categories: {
    paints: (pledge) => pledge.isPaint,
    ccus: (pledge) => pledge.isCcu,
    standaloneShips: (pledge) => pledge.isStandaloneShip,
    gameAccess: (pledge) => pledge.hasGameAccess,
  },
  properties: {
    lti: (pledge) => pledge.hasLti,
    giftable: (pledge) => pledge.isGiftable,
    meltable: (pledge) => pledge.isMeltable,
  },
};

/** Whether the pledge passes the active filters of the hangar list. */
export function matchesFilters(pledge: PledgeView, active: ReadonlySet<PledgeFilter>): boolean {
  return matchesFilterDefinition(pledge, active, PLEDGE_FILTER_DEFINITION);
}
