/*
 * The order of the current warbond CCUs (#628). By default the offer expected to end first is on
 * top (#569); offers without a known end follow, by ship value ascending – so without any known end
 * the cheapest ship is on top. The menu shows only with more than `WARBOND_SORT_MIN` offers.
 */

export const WARBOND_SORTS = [
  'endAsc',
  'endDesc',
  'valueAsc',
  'valueDesc',
  'discountDesc',
] as const;
export type WarbondSort = (typeof WARBOND_SORTS)[number];

export const DEFAULT_WARBOND_SORT: WarbondSort = 'endAsc';

/** More offers than this show the sort menu. */
export const WARBOND_SORT_MIN = 2;

export const isWarbondSort = (value: unknown): value is WarbondSort =>
  WARBOND_SORTS.includes(value as WarbondSort);

/** What the order needs of an offer (`WarbondOffer`). */
interface Offer {
  target: { ship: { name: string; msrp: number } };
  discount: number;
  history: { expectedEnd?: number };
}

const valueOf = (offer: Offer) => offer.target.ship.msrp;
const byValue = (a: Offer, b: Offer) => valueOf(a) - valueOf(b);
const byName = (a: Offer, b: Offer) => a.target.ship.name.localeCompare(b.target.ship.name);

/** Offers with a known end first, in the given direction; the others after them, by value. */
function byEnd(descending: boolean) {
  return (a: Offer, b: Offer) => {
    const endA = a.history.expectedEnd;
    const endB = b.history.expectedEnd;
    if (endA === undefined || endB === undefined) {
      if (endA !== endB) return endA === undefined ? 1 : -1;
      return byValue(a, b);
    }
    return descending ? endB - endA : endA - endB;
  };
}

const COMPARE: Record<WarbondSort, (a: Offer, b: Offer) => number> = {
  endAsc: byEnd(false),
  endDesc: byEnd(true),
  valueAsc: byValue,
  valueDesc: (a, b) => byValue(b, a),
  discountDesc: (a, b) => b.discount - a.discount,
};

/** The offers in the chosen order; ties by ship name. */
export function sortWarbondOffers<T extends Offer>(offers: readonly T[], sort: WarbondSort): T[] {
  const compare = COMPARE[sort];
  return [...offers].sort((a, b) => compare(a, b) || byName(a, b));
}
