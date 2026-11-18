import { describe, expect, it } from 'vitest';
import { sortOwnedCcus, type OwnedCcuColumn } from './owned-ccu-sort';
import type { OwnedCcu } from './warbond';
import type { SortDirection } from '@/shared/table-sort';

/* The order of "Your CCUs between $1 and $2" of a warbond CCU (#395). */

const ccu = (
  title: string,
  from: [string, number],
  to: [string, number],
  count: number,
  valueUsd: number,
  discount?: { amount: number; percent: number },
): OwnedCcu => ({
  title,
  from: { name: from[0], price: from[1] },
  to: { name: to[0], price: to[1] },
  ids: Array.from({ length: count }, (_, index) => index + 1),
  valueUsd,
  ...(discount && {
    discount: { ...discount, original: valueUsd + discount.amount, paid: valueUsd, ships: [] },
  }),
});

const ccus = [
  ccu('A', ['Cutlass Black', 110], ['Constellation', 225], 1, 100, { amount: 15, percent: 13 }),
  ccu('B', ['Avenger', 75], ['Cutlass Black', 110], 3, 45, { amount: -10, percent: -29 }),
  ccu('C', ['Avenger', 75], ['Constellation', 225], 2, 130, { amount: 20, percent: 13.3 }),
  ccu('D', ['Aurora', 25], ['Constellation', 225], 1, 200),
];
const order = (column: OwnedCcuColumn, direction: SortDirection) =>
  sortOwnedCcus(ccus, { column, direction }).map((entry) => entry.title);

describe('sortOwnedCcus', () => {
  it('keeps the default order until a column is chosen', () => {
    expect(sortOwnedCcus(ccus, null).map((entry) => entry.title)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('sorts the CCU by its base ship, then its target ship', () => {
    // Avenger → Constellation before Avenger → Cutlass Black.
    expect(order('ccu', 'asc')).toEqual(['D', 'C', 'B', 'A']);
    expect(order('ccu', 'desc')).toEqual(['A', 'B', 'C', 'D']);
  });

  it("sorts the ship prices by the target's, then the base ship's", () => {
    expect(order('shipPrices', 'desc')).toEqual(['A', 'C', 'D', 'B']);
    expect(order('shipPrices', 'asc')).toEqual(['B', 'D', 'C', 'A']);
  });

  it('sorts count and value by their number', () => {
    expect(order('count', 'desc')).toEqual(['B', 'C', 'A', 'D']);
    expect(order('value', 'desc')).toEqual(['D', 'C', 'A', 'B']);
    expect(order('value', 'asc')).toEqual(['B', 'A', 'C', 'D']);
  });

  it('sorts a surcharge as a negative discount, a CCU without a discount last', () => {
    expect(order('discount', 'desc')).toEqual(['C', 'A', 'B', 'D']);
    expect(order('discount', 'asc')).toEqual(['B', 'A', 'C', 'D']);
    expect(order('percent', 'desc')).toEqual(['C', 'A', 'B', 'D']);
    expect(order('percent', 'asc')).toEqual(['B', 'A', 'C', 'D']);
  });
});
