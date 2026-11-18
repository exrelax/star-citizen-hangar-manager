import { describe, expect, it } from 'vitest';
import { isTableSort, nextSort, sortRows, type SortColumn } from './table-sort';

/* Sorting a table by its columns (#395). */

interface Row {
  name: string;
  amount?: number;
}
const rows: Row[] = [
  { name: 'b', amount: 5 },
  { name: 'a' },
  { name: 'C', amount: -10 },
  { name: 'd', amount: 20 },
];
const columns: Record<'name' | 'amount', SortColumn<Row>> = {
  name: { key: (row) => row.name, first: 'asc' },
  amount: { key: (row) => row.amount, first: 'desc' },
};
const names = (list: Row[]) => list.map((row) => row.name);

describe('nextSort', () => {
  it('starts a column in its first direction and reverses it on a second click', () => {
    expect(nextSort(null, 'amount', 'desc')).toEqual({ column: 'amount', direction: 'desc' });
    const first = nextSort(undefined, 'name', 'asc');
    expect(nextSort(first, 'name', 'asc')).toEqual({ column: 'name', direction: 'desc' });
    expect(nextSort(nextSort(first, 'name', 'asc'), 'name', 'asc').direction).toBe('asc');
    // Another column starts in its own first direction.
    expect(nextSort(first, 'amount', 'desc')).toEqual({ column: 'amount', direction: 'desc' });
  });
});

describe('sortRows', () => {
  it('keeps the order without a sort', () => {
    expect(names(sortRows(rows, null, columns))).toEqual(['b', 'a', 'C', 'd']);
  });

  it('sorts names A–Z and back, without regard to case', () => {
    expect(names(sortRows(rows, { column: 'name', direction: 'asc' }, columns))).toEqual([
      'a',
      'b',
      'C',
      'd',
    ]);
    expect(names(sortRows(rows, { column: 'name', direction: 'desc' }, columns))).toEqual([
      'd',
      'C',
      'b',
      'a',
    ]);
  });

  it('sorts numbers, negative ones below zero, rows without a value last in both directions', () => {
    expect(names(sortRows(rows, { column: 'amount', direction: 'desc' }, columns))).toEqual([
      'd',
      'b',
      'C',
      'a',
    ]);
    expect(names(sortRows(rows, { column: 'amount', direction: 'asc' }, columns))).toEqual([
      'C',
      'b',
      'd',
      'a',
    ]);
  });

  it('breaks ties with the next key and keeps the order of equal rows', () => {
    const pairs = [
      { name: 'x', amount: 1, second: 2 },
      { name: 'y', amount: 1, second: 3 },
      { name: 'z', amount: 1, second: 3 },
    ];
    const sorted = sortRows(
      pairs,
      { column: 'pair', direction: 'desc' },
      { pair: { key: (row) => [row.amount, row.second], first: 'desc' } },
    );
    expect(sorted.map((row) => row.name)).toEqual(['y', 'z', 'x']);
  });
});

describe('isTableSort', () => {
  it('accepts a sort of a known column only', () => {
    expect(isTableSort({ column: 'name', direction: 'asc' }, ['name'])).toBe(true);
    expect(isTableSort({ column: 'other', direction: 'asc' }, ['name'])).toBe(false);
    expect(isTableSort({ column: 'name', direction: 'up' }, ['name'])).toBe(false);
    expect(isTableSort(null, ['name'])).toBe(false);
  });
});
