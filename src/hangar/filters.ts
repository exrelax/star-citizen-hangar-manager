import type { PledgeView } from './pledge-view';

/** Filters of the manager list, in display order. */
export const PLEDGE_FILTERS = [
  'lti',
  'paints',
  'ccus',
  'standaloneShips',
  'gamePackages',
  'giftable',
  'meltable',
] as const;
export type PledgeFilter = (typeof PLEDGE_FILTERS)[number];

// A pledge belongs to at most one category, so active categories combine with OR.
const CATEGORY_FILTERS: Partial<Record<PledgeFilter, (pledge: PledgeView) => boolean>> = {
  paints: (pledge) => pledge.isPaint,
  ccus: (pledge) => pledge.isCcu,
  standaloneShips: (pledge) => pledge.isStandaloneShip,
  gamePackages: (pledge) => pledge.isGamePackage,
};

// Properties narrow the result, so they combine with AND (also with the categories).
const PROPERTY_FILTERS: Partial<Record<PledgeFilter, (pledge: PledgeView) => boolean>> = {
  lti: (pledge) => pledge.hasLti,
  giftable: (pledge) => pledge.isGiftable,
  meltable: (pledge) => pledge.isMeltable,
};

/** Whether the pledge passes the active filters (no active filter lets everything pass). */
export function matchesFilters(pledge: PledgeView, active: ReadonlySet<PledgeFilter>): boolean {
  let hasCategory = false;
  let inCategory = false;
  for (const filter of active) {
    const property = PROPERTY_FILTERS[filter];
    if (property && !property(pledge)) return false;

    const category = CATEGORY_FILTERS[filter];
    if (category) {
      hasCategory = true;
      inCategory ||= category(pledge);
    }
  }
  return !hasCategory || inCategory;
}
