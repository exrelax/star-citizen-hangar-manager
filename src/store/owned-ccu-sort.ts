import { sortRows, type SortColumn, type TableSort } from '@/shared/table-sort';
import type { OwnedCcu } from './warbond';

/*
 * The columns of "Your CCUs between $1 and $2" of a warbond CCU (#395), by which it sorts: the
 * CCU by its base ship, then its target ship; the ship prices by the target's, then the base
 * ship's; the others by their number. A surcharge is a negative discount; CCUs without a known
 * discount sort last.
 */

export const OWNED_CCU_COLUMNS = [
  'ccu',
  'shipPrices',
  'count',
  'value',
  'discount',
  'percent',
] as const;
export type OwnedCcuColumn = (typeof OWNED_CCU_COLUMNS)[number];
export type OwnedCcuSort = TableSort<OwnedCcuColumn>;

export const OWNED_CCU_SORT_COLUMNS: Record<OwnedCcuColumn, SortColumn<OwnedCcu>> = {
  ccu: { key: (ccu) => [ccu.from.name, ccu.to.name], first: 'asc' },
  shipPrices: { key: (ccu) => [ccu.to.price, ccu.from.price], first: 'desc' },
  count: { key: (ccu) => ccu.ids.length, first: 'desc' },
  value: { key: (ccu) => ccu.valueUsd, first: 'desc' },
  discount: { key: (ccu) => ccu.discount?.amount, first: 'desc' },
  percent: { key: (ccu) => ccu.discount?.percent, first: 'desc' },
};

/** The hangar's CCUs in the chosen order, as they come without one. */
export const sortOwnedCcus = (
  ccus: readonly OwnedCcu[],
  sort: OwnedCcuSort | null | undefined,
): OwnedCcu[] => sortRows(ccus, sort, OWNED_CCU_SORT_COLUMNS);
