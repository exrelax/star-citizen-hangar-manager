import { describe, expect, it } from 'vitest';
import { createItemPriceLookup, storeNameOf } from './item-prices';
import type { StoreItem } from './store-items';

const item = (name: string, price: number, overrides: Partial<StoreItem> = {}): StoreItem => ({
  id: price,
  name,
  category: 'Paints',
  price,
  isWarbond: false,
  available: true,
  ...overrides,
});

describe('storeNameOf', () => {
  it("leaves out RSI's category in front of the title", () => {
    expect(storeNameOf('Paints - Eclipse - Desmodus Paint')).toBe('eclipse desmodus paint');
    expect(storeNameOf('Standalone Ship - Avenger Titan')).toBe('avenger titan');
    expect(storeNameOf('Gear - Morozov-SH Armor')).toBe('morozov sh armor');
  });
});

describe('createItemPriceLookup', () => {
  const priceOf = createItemPriceLookup([
    item('Eclipse - Desmodus Paint', 6.5),
    item('Constellation Mk V Centaurus', 275, { isWarbond: true, category: 'Standalone Ships' }),
    item('Constellation Mk V Centaurus', 300, { category: 'Standalone Ships' }),
  ]);

  it('finds an item by the pledge title, ignoring case and punctuation', () => {
    expect(priceOf('Paints - Eclipse - Desmodus Paint')).toEqual({
      name: 'Eclipse - Desmodus Paint',
      price: 6.5,
    });
    expect(priceOf('Paints - eclipse – desmodus paint')?.price).toBe(6.5);
  });

  it('takes the standard price of several editions', () => {
    expect(priceOf('Standalone Ship - Constellation Mk V Centaurus')?.price).toBe(300);
  });

  it('knows nothing the store does not sell now', () => {
    expect(priceOf('Paints - Sabre - Ashcloud Paint')).toBeUndefined();
  });
});
