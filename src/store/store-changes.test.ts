import { describe, expect, it } from 'vitest';
import type { StoreItem } from './items/store-items';
import { storeItemChanges, warbondChanges } from './store-changes';

const warbond = (skuId: number) => ({ shipId: skuId, skuId, price: 100 });
const item = (id: number, price = 10, discountedPrice?: number): StoreItem => ({
  id,
  name: `Item ${id}`,
  category: 'Gear',
  price,
  ...(discountedPrice !== undefined && { discountedPrice }),
  isWarbond: false,
  available: true,
});

describe('warbondChanges', () => {
  it('lists the warbond CCUs added and removed', () => {
    expect(warbondChanges([warbond(1), warbond(2)], [warbond(2), warbond(3)])).toEqual({
      added: [warbond(3)],
      removed: [warbond(1)],
    });
  });

  it('has none without change or on the first read', () => {
    expect(warbondChanges([warbond(1)], [warbond(1)])).toBeUndefined();
    expect(warbondChanges(undefined, [warbond(1)])).toBeUndefined();
  });
});

describe('storeItemChanges', () => {
  it('lists the items added, removed and repriced (price or sale)', () => {
    const changes = storeItemChanges(
      [item(1), item(2), item(3), item(4)],
      [item(1), item(2, 12), item(3, 10, 8), item(5)],
    );
    expect(changes).toEqual({
      added: [item(5)],
      removed: [item(4)],
      repriced: [
        { item: item(2, 12), before: item(2) },
        { item: item(3, 10, 8), before: item(3) },
      ],
    });
  });

  it('has none without change or on the first read', () => {
    expect(storeItemChanges([item(1)], [item(1)])).toBeUndefined();
    expect(storeItemChanges(undefined, [item(1)])).toBeUndefined();
  });
});
