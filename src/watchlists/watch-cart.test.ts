import { describe, expect, it } from 'vitest';
import type { StoreCatalog } from './store-status';
import { cartChunksOf, watchCartOf } from './watch-cart';
import type { WatchItem } from './watchlists';

const catalog: StoreCatalog = {
  ships: [
    { id: 1, name: 'Aurora', msrp: 25 },
    { id: 2, name: 'Cutlass Black', msrp: 110 },
  ],
  buyable: [{ shipId: 2, skuId: 20, title: 'Cutlass Black', price: 110 }],
  warbonds: [],
  items: [
    { id: 7, name: 'Dusk', category: 'Paints', price: 10, isWarbond: false, available: true },
    { id: 8, name: 'Dawn', category: 'Paints', price: 5, isWarbond: false, available: false },
  ],
};
const at = { addedAt: 1 };

describe('a watchlist’s store items for the cart (#529)', () => {
  it('puts paints and ships on sale in, with their counts and prices now', () => {
    const items: WatchItem[] = [
      { kind: 'storePaint', skuId: 7, name: 'Dusk', count: 3, ...at },
      { kind: 'storeShip', shipId: 2, name: 'Cutlass Black', count: 1, ...at },
      { kind: 'hangar', pledgeId: 5, name: 'A pledge', ...at },
    ];
    expect(watchCartOf(items, catalog)).toEqual({
      lines: [
        { skuId: 7, name: 'Dusk', qty: 3, price: 10 },
        { skuId: 20, name: 'Cutlass Black', qty: 1, price: 110 },
      ],
      skipped: [],
      total: 140,
    });
  });

  it('leaves out CCUs, items not on sale and those it knows too little of', () => {
    const ccu: WatchItem = { kind: 'storeCcu', fromShipId: 1, toShipId: 2, name: 'CCU', ...at };
    const off: WatchItem = { kind: 'storePaint', skuId: 8, name: 'Dawn', ...at };
    const ship: WatchItem = { kind: 'storeShip', shipId: 1, name: 'Aurora', ...at };
    expect(watchCartOf([ccu, off, ship], catalog).skipped).toEqual([
      { item: ccu, reason: 'ccu' },
      { item: off, reason: 'notOnSale' },
      { item: ship, reason: 'notOnSale' },
    ]);
    expect(watchCartOf([ship], { ...catalog, buyable: undefined }).skipped).toEqual([
      { item: ship, reason: 'unknown' },
    ]);
  });

  it('splits a line into what RSI takes at once', () => {
    expect(
      cartChunksOf([{ skuId: 7, name: 'Dusk', qty: 12, price: 10 }]).map((l) => l.qty),
    ).toEqual([5, 5, 2]);
  });
});
