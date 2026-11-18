import { describe, expect, it } from 'vitest';
import type { AllShipsRow } from './all-ships';
import {
  ALL_SHIPS_COLUMNS,
  allShipsView,
  priceBounds,
  valueBand,
  valueHistogram,
  type AllShipsColumn,
  type AllShipsFilter,
  type AllShipsQuery,
} from './all-ships-view';

/* Sorting, search, price range and filters of the table of all ships (#406). */

const row = (
  id: number,
  name: string,
  msrp: number,
  extra: Partial<AllShipsRow> = {},
): AllShipsRow => ({
  ship: { id, name, msrp },
  hangarFrom: 0,
  hangarTo: 0,
  buybackFrom: 0,
  buybackTo: 0,
  hangarShips: 0,
  buybackShips: 0,
  ...extra,
});
const ROWS = [
  row(1, 'Polaris', 975, { manufacturer: 'Roberts Space Industries', hangarTo: 3 }),
  row(2, 'Liberator', 600, {
    manufacturer: 'Anvil Aerospace',
    warbondPrice: 525,
    warbondSkuId: 9,
    skuId: 8,
    hangarFrom: 1,
    buybackTo: 4,
  }),
  row(3, 'Prospector', 155, {
    manufacturer: 'MISC',
    alwaysAvailable: true,
    purchasable: true,
    skuId: 7,
    hangarFrom: 31,
    buybackShips: 2,
  }),
  row(4, 'Aurora Mk I ES', 20, {
    manufacturer: 'Roberts Space Industries',
    alwaysAvailable: false,
    purchasable: false,
    hangarShips: 1,
  }),
];
const all: AllShipsQuery = { search: '', min: 0, max: 10_000, filters: new Set() };
const names = (query: Partial<AllShipsQuery> = {}, column?: AllShipsColumn, desc = false) =>
  allShipsView(
    ROWS,
    { ...all, ...query },
    column && { column, direction: desc ? 'desc' : 'asc' },
  ).map((entry) => entry.ship.name);

describe('allShipsView: sorting', () => {
  it('sorts by value, lowest first, by default', () => {
    expect(names()).toEqual(['Aurora Mk I ES', 'Prospector', 'Liberator', 'Polaris']);
  });

  it('sorts by every column in both directions', () => {
    for (const column of ALL_SHIPS_COLUMNS) {
      const up = names({}, column);
      const down = names({}, column, true);
      expect(up, column).toHaveLength(4);
      expect(down, column).toHaveLength(4);
    }
    expect(names({}, 'name')).toEqual(['Aurora Mk I ES', 'Liberator', 'Polaris', 'Prospector']);
    expect(names({}, 'hangarFrom', true)).toEqual([
      'Prospector',
      'Liberator',
      'Polaris',
      'Aurora Mk I ES',
    ]);
    expect(names({}, 'buybackTo', true)[0]).toBe('Liberator');
    expect(names({}, 'buybackShips', true)[0]).toBe('Prospector');
    expect(names({}, 'hangarShips', true)[0]).toBe('Aurora Mk I ES');
  });

  it('sorts ships without a value last in both directions', () => {
    expect(names({}, 'warbond', true)).toEqual([
      'Liberator',
      'Polaris',
      'Prospector',
      'Aurora Mk I ES',
    ]);
    expect(names({}, 'warbond').at(0)).toBe('Liberator');
    // Unknown facts last, yes before no on the first click.
    expect(names({}, 'alwaysAvailable', true)).toEqual([
      'Prospector',
      'Aurora Mk I ES',
      'Polaris',
      'Liberator',
    ]);
    // Equal rows keep the order they come in (by value, highest first).
    expect(names({}, 'onSale', true).slice(0, 2)).toEqual(['Liberator', 'Prospector']);
  });
});

describe('allShipsView: search, price range and filters', () => {
  it('finds ships by name and by manufacturer, word starts as the lists do', () => {
    expect(names({ search: 'lib' })).toEqual(['Liberator']);
    expect(names({ search: 'roberts' })).toEqual(['Aurora Mk I ES', 'Polaris']);
    expect(names({ search: 'roberts pol' })).toEqual(['Polaris']);
    expect(names({ search: 'erator' })).toEqual([]);
  });

  it('keeps the ships within the price range, both ends included', () => {
    expect(names({ min: 155, max: 600 })).toEqual(['Prospector', 'Liberator']);
    expect(priceBounds(ROWS)).toEqual({ min: 20, max: 975 });
    expect(priceBounds([])).toEqual({ min: 0, max: 0 });
  });

  it('narrows by each filter, and by several together', () => {
    const only = (...filters: AllShipsFilter[]) => names({ filters: new Set(filters) });
    expect(only('alwaysAvailable')).toEqual(['Prospector']);
    expect(only('onSale')).toEqual(['Prospector', 'Liberator']);
    expect(only('warbond')).toEqual(['Liberator']);
    expect(only('onSale', 'warbond')).toEqual(['Liberator']);
    expect(only('alwaysAvailable', 'warbond')).toEqual([]);
    // Something of it in the hangar or the buy back.
    expect(only('owned')).toEqual(['Aurora Mk I ES', 'Prospector', 'Liberator', 'Polaris']);
    expect(
      allShipsView([...ROWS, row(5, 'Idris-P', 1900)], { ...all, filters: new Set(['owned']) }),
    ).toHaveLength(4);
  });

  it('combines search, range and filters', () => {
    expect(names({ search: 'p', min: 100, filters: new Set(['onSale']) })).toEqual(['Prospector']);
  });
});

describe('the value scale (#385 layout)', () => {
  it('counts the ships per $50, all of $1,000 and more in the last bar', () => {
    const bars = valueHistogram([...ROWS, row(5, 'Idris-P', 1900), row(6, 'Pioneer', 1000)]);
    expect(bars).toHaveLength(21);
    expect(bars[0]).toBe(1); // $20
    expect(bars[3]).toBe(1); // $155
    expect(bars[12]).toBe(1); // $600
    expect(bars[19]).toBe(1); // $975
    expect(bars[20]).toBe(2); // $1,000 and $1,900
  });

  it('puts the lines between the $100 bands', () => {
    expect([20, 99, 100, 155, 999, 1000, 1900].map(valueBand)).toEqual([0, 0, 1, 1, 9, 10, 10]);
  });
});
