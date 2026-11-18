import { matchesSearch, normalizeSearchText, parseSearchQuery } from '@/hangar/search';
import { sortRows, type SortColumn, type TableSort } from '@/shared/table-sort';
import type { AllShipsRow } from './all-ships';

/*
 * What the table of all ships (#385) shows (#406): sorted by any column (by default by value,
 * lowest first), found by name and manufacturer, within a price range, and only the ships always
 * available, on sale or with a warbond, as chosen.
 */

export const ALL_SHIPS_COLUMNS = [
  'name',
  'value',
  'warbond',
  'alwaysAvailable',
  'purchasable',
  'hangarFrom',
  'hangarTo',
  'hangarShips',
  'buybackFrom',
  'buybackTo',
  'buybackShips',
  'onSale',
] as const;
export type AllShipsColumn = (typeof ALL_SHIPS_COLUMNS)[number];
export type AllShipsSort = TableSort<AllShipsColumn>;

export const DEFAULT_ALL_SHIPS_SORT: AllShipsSort = { column: 'value', direction: 'asc' };

/** On sale now: RSI's upgrade tool sells the ship, as standard or warbond edition. */
export const isOnSale = (row: AllShipsRow) =>
  row.skuId !== undefined || row.warbondSkuId !== undefined;

/** A yes/no column: yes first on the first click, unknown last. */
const flag = (value: boolean | undefined) => (value === undefined ? undefined : Number(value));

export const ALL_SHIPS_SORT_COLUMNS: Record<AllShipsColumn, SortColumn<AllShipsRow>> = {
  name: { key: (row) => [row.ship.name, row.manufacturer], first: 'asc' },
  value: { key: (row) => row.ship.msrp, first: 'desc' },
  warbond: { key: (row) => row.warbondPrice, first: 'desc' },
  alwaysAvailable: { key: (row) => flag(row.alwaysAvailable), first: 'desc' },
  purchasable: { key: (row) => flag(row.purchasable), first: 'desc' },
  hangarFrom: { key: (row) => row.hangarFrom, first: 'desc' },
  hangarTo: { key: (row) => row.hangarTo, first: 'desc' },
  hangarShips: { key: (row) => row.hangarShips, first: 'desc' },
  buybackFrom: { key: (row) => row.buybackFrom, first: 'desc' },
  buybackTo: { key: (row) => row.buybackTo, first: 'desc' },
  buybackShips: { key: (row) => row.buybackShips, first: 'desc' },
  onSale: { key: (row) => flag(isOnSale(row)), first: 'desc' },
};

export const ALL_SHIPS_FILTERS = ['alwaysAvailable', 'onSale', 'warbond'] as const;
export type AllShipsFilter = (typeof ALL_SHIPS_FILTERS)[number];

const FILTER_PREDICATES: Record<AllShipsFilter, (row: AllShipsRow) => boolean> = {
  alwaysAvailable: (row) => row.alwaysAvailable === true,
  onSale: isOnSale,
  warbond: (row) => row.warbondPrice !== undefined,
};

export interface AllShipsQuery {
  /** Words of the ship's name or manufacturer, all of them. */
  search: string;
  /** The value range, both ends included. */
  min: number;
  max: number;
  /** Each one chosen narrows the table: a ship has to meet all. */
  filters: ReadonlySet<AllShipsFilter>;
}

/** The lowest and highest value of the ships, for the price range. */
export function priceBounds(rows: readonly AllShipsRow[]): { min: number; max: number } {
  if (!rows.length) return { min: 0, max: 0 };
  const values = rows.map((row) => row.ship.msrp);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** The ships of the query in the order of `sort`. */
export function allShipsView(
  rows: readonly AllShipsRow[],
  query: AllShipsQuery,
  sort: AllShipsSort = DEFAULT_ALL_SHIPS_SORT,
): AllShipsRow[] {
  const words = parseSearchQuery(query.search);
  const filters = [...query.filters].map((filter) => FILTER_PREDICATES[filter]);
  const shown = rows.filter((row) => {
    if (row.ship.msrp < query.min || row.ship.msrp > query.max) return false;
    if (!filters.every((matches) => matches(row))) return false;
    // As the lists' search: each word starts a word of the name or the manufacturer.
    return matchesSearch(normalizeSearchText(`${row.ship.name} ${row.manufacturer ?? ''}`), words);
  });
  return sortRows(shown, sort, ALL_SHIPS_SORT_COLUMNS);
}
