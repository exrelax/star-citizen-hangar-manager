import { describe, expect, it } from 'vitest';
import { storeStatus, type StoreCatalog } from './store-status';

const ships = [
  { id: 1, name: 'Aurora', msrp: 25 },
  { id: 2, name: 'Cutlass Black', msrp: 110 },
  { id: 3, name: 'Carrack', msrp: 600 },
];
const catalog: StoreCatalog = {
  ships,
  buyable: [{ shipId: 2, skuId: 20, title: 'Cutlass Black', price: 110 }],
  warbonds: [{ shipId: 3, skuId: 31, price: 550 }],
  items: [
    {
      id: 7,
      name: 'Dusk',
      category: 'Paints',
      price: 10,
      discountedPrice: 7.5,
      isWarbond: false,
      available: true,
    },
  ],
};

describe('storeStatus (#470)', () => {
  it('prices a CCU by the standard prices, on sale while its target is', () => {
    expect(storeStatus({ kind: 'storeCcu', fromShipId: 1, toShipId: 2 }, catalog)).toEqual({
      price: 85,
      onSale: true,
    });
  });

  it('adds the warbond price of a CCU to a warbond edition', () => {
    expect(storeStatus({ kind: 'storeCcu', fromShipId: 2, toShipId: 3 }, catalog)).toEqual({
      price: 490,
      warbondPrice: 440,
      onSale: false,
    });
  });

  it('knows a CCU RSI can’t sell any more', () => {
    expect(storeStatus({ kind: 'storeCcu', fromShipId: 3, toShipId: 2 }, catalog)).toEqual({
      impossible: true,
      onSale: false,
    });
  });

  it('prices a standalone ship, its warbond edition and its sale', () => {
    expect(storeStatus({ kind: 'storeShip', shipId: 2 }, catalog)).toEqual({
      price: 110,
      onSale: true,
    });
    expect(storeStatus({ kind: 'storeShip', shipId: 3, insurance: 'lti' }, catalog)).toEqual({
      price: 600,
      warbondPrice: 550,
      onSale: false,
    });
  });

  it('prices a paint by its sale price, and knows one no longer in the store', () => {
    expect(storeStatus({ kind: 'storePaint', skuId: 7 }, catalog)).toEqual({
      price: 7.5,
      onSale: true,
    });
    expect(storeStatus({ kind: 'storePaint', skuId: 8 }, catalog)).toEqual({ onSale: false });
  });

  it('knows nothing while the store wasn’t read', () => {
    expect(storeStatus({ kind: 'storePaint', skuId: 7 }, {})).toEqual({});
    expect(storeStatus({ kind: 'storeShip', shipId: 2 }, {})).toEqual({});
  });
});
