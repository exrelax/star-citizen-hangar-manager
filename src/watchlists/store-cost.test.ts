import { describe, expect, it } from 'vitest';
import { priceChangeOf, storeCostOf } from './store-cost';
import type { StoreCatalog } from './store-status';
import type { WatchItem } from './watchlists';

const catalog: StoreCatalog = {
  ships: [
    { id: 1, name: 'Aurora', msrp: 25 },
    { id: 2, name: 'Cutlass Black', msrp: 110 },
    { id: 3, name: 'Carrack', msrp: 600 },
  ],
  buyable: [
    { shipId: 2, skuId: 20, title: 'Cutlass Black', price: 110 },
    { shipId: 3, skuId: 30, title: 'Carrack', price: 600 },
  ],
  warbonds: [{ shipId: 3, skuId: 31, price: 550 }],
  items: [
    { id: 7, name: 'Dusk', category: 'Paints', price: 10, isWarbond: false, available: true },
    { id: 8, name: 'Dawn', category: 'Paints', price: 5, isWarbond: false, available: false },
  ],
};
const at = { addedAt: 1 };

describe('what a watchlist’s store items cost (#531)', () => {
  it('adds up their prices now by their counts, without warbond prices or pledges', () => {
    const items: WatchItem[] = [
      { kind: 'storePaint', skuId: 7, name: 'Dusk', value: 10, count: 3, ...at },
      { kind: 'storeCcu', fromShipId: 1, toShipId: 3, name: 'CCU', value: 575, count: 1, ...at },
      { kind: 'hangar', pledgeId: 5, name: 'A pledge', value: 99, ...at },
    ];
    expect(storeCostOf(items, catalog)).toEqual({ items: 2, total: 605, changed: 0, unknown: 0 });
  });

  it('counts those off sale, impossible or pricier as changed, and leaves them out', () => {
    const items: WatchItem[] = [
      { kind: 'storePaint', skuId: 8, name: 'Dawn', value: 5, count: 1, ...at },
      { kind: 'storeCcu', fromShipId: 3, toShipId: 2, name: 'CCU', value: 10, count: 1, ...at },
      // Pricier now: still in the total.
      { kind: 'storeShip', shipId: 2, name: 'Cutlass Black', value: 100, count: 1, ...at },
      // Cheaper now: not changed for the worse.
      { kind: 'storePaint', skuId: 7, name: 'Dusk', value: 12, count: 1, ...at },
    ];
    expect(storeCostOf(items, catalog)).toEqual({ items: 4, total: 120, changed: 3, unknown: 0 });
  });

  it('counts those of unknown price apart', () => {
    const items: WatchItem[] = [
      { kind: 'storePaint', skuId: 7, name: 'Dusk', value: 10, count: 1, ...at },
    ];
    expect(storeCostOf(items, {})).toEqual({ items: 1, total: 0, changed: 0, unknown: 1 });
  });
});

describe('priceChangeOf (#531)', () => {
  const paint: WatchItem = { kind: 'storePaint', skuId: 7, name: 'Dusk', value: 10, ...at };

  it('tells the price when added and whether it is higher now', () => {
    expect(priceChangeOf(paint, { price: 12 })).toEqual({ was: 10, now: 12, higher: true });
    expect(priceChangeOf(paint, { price: 8 })).toEqual({ was: 10, now: 8, higher: false });
  });

  it('is none for the same price, an unknown one, or a pledge', () => {
    expect(priceChangeOf(paint, { price: 10.001 })).toBeUndefined();
    expect(priceChangeOf(paint, {})).toBeUndefined();
    expect(
      priceChangeOf({ kind: 'hangar', pledgeId: 1, name: 'A', value: 5, ...at }, { price: 9 }),
    ).toBeUndefined();
  });
});
