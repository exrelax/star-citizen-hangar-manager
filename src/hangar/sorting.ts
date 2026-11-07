/*
 * The orders of the hangar and buy back lists. Pledge ids grow over time, so they give the order
 * of purchase. The buy back knows neither value nor discount, so it sorts by date only.
 */

export const HANGAR_SORTS = ['newest', 'oldest', 'valueDesc', 'valueAsc', 'discountDesc'] as const;
export const BUYBACK_SORTS = ['newest', 'oldest'] as const;

export type HangarSort = (typeof HANGAR_SORTS)[number];
export type BuybackSort = (typeof BUYBACK_SORTS)[number];
export type ListSort = HangarSort;

interface Sortable {
  id: number;
  valueUsd?: number;
  discount?: { amount: number };
}

const newest = (a: Sortable, b: Sortable) => b.id - a.id;

const COMPARE: Record<ListSort, (a: Sortable, b: Sortable) => number> = {
  newest,
  oldest: (a, b) => a.id - b.id,
  valueDesc: (a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0) || newest(a, b),
  valueAsc: (a, b) => (a.valueUsd ?? 0) - (b.valueUsd ?? 0) || newest(a, b),
  // Pledges without a known discount come last.
  discountDesc: (a, b) =>
    (b.discount?.amount ?? -Infinity) - (a.discount?.amount ?? -Infinity) || newest(a, b),
};

/** The entries in the given order (a new array). */
export function sortEntries<T extends Sortable>(entries: readonly T[], sort: ListSort): T[] {
  return [...entries].sort(COMPARE[sort]);
}
