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

  describe('a standalone ship with an insurance (#531)', () => {
    const standalone = (id: number, name: string, price: number, available = true) => ({
      id,
      name,
      category: 'Standalone Ships',
      price,
      isWarbond: false,
      available,
    });
    const withItems = (...items: ReturnType<typeof standalone>[]): StoreCatalog => ({
      ...catalog,
      items: [...catalog.items!, ...items],
    });

    it('is the store item naming that insurance or a better one, with its SKU', () => {
      const store = withItems(
        standalone(40, 'Cutlass Black - 10 Year', 115),
        standalone(41, 'Cutlass Black - LTI', 120),
        standalone(42, 'Cutlass Black', 110),
      );
      expect(storeStatus({ kind: 'storeShip', shipId: 2, insurance: 120 }, store)).toEqual({
        price: 115,
        onSale: true,
        skuId: 40,
      });
      expect(storeStatus({ kind: 'storeShip', shipId: 2, insurance: 'lti' }, store)).toEqual({
        price: 120,
        onSale: true,
        skuId: 41,
      });
    });

    it('is not on sale while the store sells the ship only without it', () => {
      const store = withItems(
        standalone(41, 'Cutlass Black - LTI', 120, false),
        standalone(42, 'Cutlass Black', 110),
      );
      expect(storeStatus({ kind: 'storeShip', shipId: 2, insurance: 'lti' }, store)).toEqual({
        onSale: false,
      });
    });

    it('is the standard edition while the store has no item of the ship', () => {
      expect(storeStatus({ kind: 'storeShip', shipId: 2, insurance: 'lti' }, catalog)).toEqual({
        price: 110,
        onSale: true,
      });
    });
  });
});
