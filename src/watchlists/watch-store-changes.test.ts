import { describe, expect, it } from 'vitest';
import type { StoreCatalog } from './store-status';
import {
  changeKey,
  seenKey,
  storeChangesOf,
  withoutGone,
  withSeen,
  type SeenStore,
} from './watch-store-changes';
import { addItem, createWatchlist, updateWatchlist } from './watchlists';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const ccu = { kind: 'storeCcu' as const, fromShipId: 1, toShipId: 2, name: 'Upgrade - A to B' };
const paint = { kind: 'storePaint' as const, skuId: 7, name: 'Dusk' };
const list = addItem(addItem(createWatchlist({ name: 'IAE' }, NOW, 'l1'), ccu, NOW), paint, NOW);

const catalog = (bPrice: number, onSale: boolean, paintOnSale = true): StoreCatalog => ({
  ships: [
    { id: 1, name: 'A', msrp: 50 },
    { id: 2, name: 'B', msrp: bPrice },
  ],
  buyable: onSale ? [{ shipId: 2, skuId: 20, title: 'B', price: bPrice }] : [],
  warbonds: [],
  items: [
    {
      id: 7,
      name: 'Dusk',
      category: 'Paints',
      price: 10,
      isWarbond: false,
      available: paintOnSale,
    },
  ],
});

describe('changes of store items on watchlists (#472)', () => {
  it('only notes an item seen for the first time', () => {
    const { changed, noted } = storeChangesOf([list], catalog(100, true), {});
    expect(changed).toEqual([]);
    expect(noted).toEqual({
      [seenKey(list, list.items[0]!)]: { price: 50, onSale: true },
      [seenKey(list, list.items[1]!)]: { price: 10, onSale: true },
    });
  });

  it('tells a new price, no longer for sale and for sale again', () => {
    const seen: SeenStore = withSeen({}, list, catalog(100, true, false));
    const { changed } = storeChangesOf([list], catalog(120, false, true), seen);
    expect(changed[0]?.changes).toEqual([
      { kind: 'gone', item: list.items[0] },
      { kind: 'back', item: list.items[1] },
    ]);
    const priced = storeChangesOf([list], catalog(120, true, false), seen).changed[0]?.changes;
    expect(priced).toEqual([{ kind: 'price', item: list.items[0], from: 50, to: 70 }]);
    expect(changeKey(list, priced![0]!)).toBe('l1|c:1-2|price:70');
  });

  it('forgets a change once it is gone or the watchlist was seen', () => {
    const seen = withSeen({}, list, catalog(100, true));
    expect(storeChangesOf([list], catalog(100, true), seen).changed).toEqual([]);
    const now = catalog(130, true);
    expect(storeChangesOf([list], now, withSeen(seen, list, now)).changed).toEqual([]);
  });

  it('watches only watchlists with notifications on', () => {
    const off = updateWatchlist(list, { storeAlerts: false }, NOW);
    const seen = withSeen({}, off, catalog(100, true));
    expect(storeChangesOf([off], catalog(130, true), seen)).toEqual({ changed: [], noted: {} });
  });

  it('keeps only items still on a watchlist', () => {
    const seen = { ...withSeen({}, list, catalog(100, true)), 'gone|p:1': { price: 1 } };
    expect(Object.keys(withoutGone(seen, [list]))).toHaveLength(2);
  });
});
