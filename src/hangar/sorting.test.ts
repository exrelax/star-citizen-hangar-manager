import { describe, expect, it } from 'vitest';
import { sortEntries, type ListSort } from './sorting';

const ENTRIES = [
  { id: 2, valueUsd: 50, discount: { amount: 10 } },
  { id: 4, valueUsd: 15 },
  { id: 1, valueUsd: 50, discount: { amount: 25 } },
  { id: 3, valueUsd: 300, discount: { amount: -5 } },
];

const ids = (sort: ListSort) => sortEntries(ENTRIES, sort).map((entry) => entry.id);

describe('sortEntries', () => {
  it('sorts by date (pledge id)', () => {
    expect(ids('newest')).toEqual([4, 3, 2, 1]);
    expect(ids('oldest')).toEqual([1, 2, 3, 4]);
  });

  it('sorts by value, newest first for the same value', () => {
    expect(ids('valueDesc')).toEqual([3, 2, 1, 4]);
    expect(ids('valueAsc')).toEqual([4, 2, 1, 3]);
  });

  it('sorts by discount, pledges without one last', () => {
    expect(ids('discountDesc')).toEqual([1, 2, 3, 4]);
  });

  it('leaves the given entries as they are', () => {
    sortEntries(ENTRIES, 'oldest');
    expect(ENTRIES.map((entry) => entry.id)).toEqual([2, 4, 1, 3]);
  });
});
