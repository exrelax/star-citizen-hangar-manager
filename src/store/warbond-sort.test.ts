import { describe, expect, it } from 'vitest';
import { DEFAULT_WARBOND_SORT, isWarbondSort, sortWarbondOffers } from './warbond-sort';

const offer = (name: string, msrp: number, discount: number, expectedEnd?: number) => ({
  target: { ship: { name, msrp } },
  discount,
  history: { expectedEnd },
});

const names = (offers: readonly { target: { ship: { name: string } } }[]) =>
  offers.map((entry) => entry.target.ship.name);

const offers = [
  offer('Corsair', 250, 40),
  offer('Perseus', 975, 75, 3_000),
  offer('M80', 60, 10),
  offer('Ironclad', 450, 60, 1_000),
];

describe('sortWarbondOffers', () => {
  it('puts the offer ending first on top by default, the ones without an end after by value', () => {
    expect(DEFAULT_WARBOND_SORT).toBe('endAsc');
    expect(names(sortWarbondOffers(offers, 'endAsc'))).toEqual([
      'Ironclad',
      'Perseus',
      'M80',
      'Corsair',
    ]);
  });

  it('sorts by the latest end first, still with the ones without an end last', () => {
    expect(names(sortWarbondOffers(offers, 'endDesc'))).toEqual([
      'Perseus',
      'Ironclad',
      'M80',
      'Corsair',
    ]);
  });

  it('sorts by ship value without any known end', () => {
    const none = offers.map((entry) => offer(entry.target.ship.name, entry.target.ship.msrp, 0));
    expect(names(sortWarbondOffers(none, 'endAsc'))).toEqual([
      'M80',
      'Corsair',
      'Ironclad',
      'Perseus',
    ]);
  });

  it('sorts by ship value both ways', () => {
    expect(names(sortWarbondOffers(offers, 'valueAsc'))).toEqual([
      'M80',
      'Corsair',
      'Ironclad',
      'Perseus',
    ]);
    expect(names(sortWarbondOffers(offers, 'valueDesc'))).toEqual([
      'Perseus',
      'Ironclad',
      'Corsair',
      'M80',
    ]);
  });

  it('sorts by the highest discount in USD first, ties by name', () => {
    const tied = [...offers, offer('Arrow', 75, 75)];
    expect(names(sortWarbondOffers(tied, 'discountDesc'))).toEqual([
      'Arrow',
      'Perseus',
      'Ironclad',
      'Corsair',
      'M80',
    ]);
  });

  it('leaves the given list as it is', () => {
    const copy = [...offers];
    sortWarbondOffers(offers, 'valueDesc');
    expect(offers).toEqual(copy);
  });
});

describe('isWarbondSort', () => {
  it('accepts the sortings only', () => {
    expect(isWarbondSort('discountDesc')).toBe(true);
    expect(isWarbondSort('discountAsc')).toBe(false);
    expect(isWarbondSort(undefined)).toBe(false);
  });
});
