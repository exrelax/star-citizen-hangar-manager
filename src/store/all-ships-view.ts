import {
  filterCounts,
  matchesFilterStates,
  type FilterPredicates,
  type FilterStates,
} from '@/hangar/filters';
import { matchesSearch, normalizeSearchText, parseSearchQuery } from '@/hangar/search';
import { sortRows, type SortColumn, type TableSort } from '@/shared/table-sort';
import type { AllShipsRow } from './all-ships';

/*
 * What the table of all ships (#385) shows (#406): sorted by any column (by default by value,
 * lowest first), found by name and manufacturer, within a price range, and only the ships always
 * available, on sale, with a warbond, with a price increase ahead, leaving the Pledge Store (#410)
 * or in the hangar or buy back, as chosen. Each filter has the three states of My Hangar's filters
 * (#413): off, only ships with it, only ships without it.
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

export const ALL_SHIPS_FILTERS = [
  'alwaysAvailable',
  'onSale',
  'warbond',
  'priceIncrease',
  'leaving',
  'owned',
] as const;
export type AllShipsFilter = (typeof ALL_SHIPS_FILTERS)[number];

const FILTER_PREDICATES: FilterPredicates<AllShipsRow, AllShipsFilter> = {
  alwaysAvailable: (row) => row.alwaysAvailable === true,
  onSale: isOnSale,
  warbond: (row) => row.warbondPrice !== undefined,
  priceIncrease: (row) => row.priceIncrease !== undefined,
  leaving: (row) => row.removal !== undefined,
  owned: (row) => ownsAny(row),
};

/** The hangar or the buy back has the ship, or a CCU from or to it. */
export const ownsAny = (row: AllShipsRow) =>
  !!(
    row.hangarFrom ||
    row.hangarTo ||
    row.hangarShips ||
    row.buybackFrom ||
    row.buybackTo ||
    row.buybackShips
  );

/** The slider's scale: $0 to $1,000 in steps of $50; its end means "$1,000 and more". */
export const VALUE_SCALE = { step: 50, end: 1000 } as const;

/** How many ships each $50 of the scale has, the last one "$1,000 and more" (21 bars). */
export function valueHistogram(rows: readonly AllShipsRow[]): number[] {
  const bars = Array.from({ length: VALUE_SCALE.end / VALUE_SCALE.step + 1 }, () => 0);
  for (const row of rows) {
    const bar = Math.floor(Math.min(row.ship.msrp, VALUE_SCALE.end) / VALUE_SCALE.step);
    bars[bar]!++;
  }
  return bars;
}

/** The $100 band of a value, the table's lines between them; $1,000 and more is one band. */
export const valueBand = (value: number) => Math.min(Math.floor(value / 100), 10);

export interface AllShipsQuery {
  /** Words of the ship's name or manufacturer, all of them. */
  search: string;
  /** The value range, both ends included; `Infinity` for no upper end. */
  min: number;
  max: number;
  /** The active filters, included or excluded: a ship has to pass all. */
  filters: FilterStates<AllShipsFilter>;
}

/** The lowest and highest value of the ships, for the price range. */
export function priceBounds(rows: readonly AllShipsRow[]): { min: number; max: number } {
  if (!rows.length) return { min: 0, max: 0 };
  const values = rows.map((row) => row.ship.msrp);
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** The ships within the query's search and value range, before the filters. */
function searched(rows: readonly AllShipsRow[], query: AllShipsQuery): readonly AllShipsRow[] {
  const words = parseSearchQuery(query.search);
  return rows.filter(
    (row) =>
      row.ship.msrp >= query.min &&
      row.ship.msrp <= query.max &&
      // As the lists' search: each word starts a word of the name or the manufacturer.
      matchesSearch(normalizeSearchText(`${row.ship.name} ${row.manufacturer ?? ''}`), words),
  );
}

/** The ships of the query in the order of `sort`. */
export function allShipsView(
  rows: readonly AllShipsRow[],
  query: AllShipsQuery,
  sort: AllShipsSort = DEFAULT_ALL_SHIPS_SORT,
): AllShipsRow[] {
  const shown = searched(rows, query).filter((row) =>
    matchesFilterStates(row, query.filters, FILTER_PREDICATES),
  );
  return sortRows(shown, sort, ALL_SHIPS_SORT_COLUMNS);
}

/**
 * The count of each filter button, as My Hangar counts them (`filterCounts`): the ships with the
 * filter's property among those within the search, the value range and the other active filters.
 */
export const allShipsFilterCounts = (
  rows: readonly AllShipsRow[],
  query: AllShipsQuery,
): Map<AllShipsFilter, number> =>
  filterCounts(searched(rows, query), ALL_SHIPS_FILTERS, query.filters, FILTER_PREDICATES);
