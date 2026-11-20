import { describe, expect, it } from 'vitest';
import type { StoreItem } from '../items/store-items';
import { cartPaintDiscount, fillerLinesOf } from './cart-discount';

const item = (
  id: number,
  name: string,
  price: number,
  extra: Partial<StoreItem> = {},
): StoreItem => ({
  id,
  category: 'Paints',
  name,
  price,
  isWarbond: false,
  available: true,
  ...extra,
});

const store: StoreItem[] = [
  item(1, 'Sabre - Blue Steel Paint', 10),
  item(2, 'Avenger - Skullcrusher Paint', 5),
  item(3, 'Nova - Tundra Paint', 6),
  item(4, 'Polaris - Black Ice Paint', 20),
  item(5, 'Holiday Paint Pack', 3),
  item(6, 'Mustang - Warbond Paint', 2, { isWarbond: true }),
  item(9, 'Aurora MR', 25, { category: 'Standalone Ships' }),
];

describe('the paint discount of RSI’s cart (#458)', () => {
  it('counts the paints of the cart, not other items', () => {
    const result = cartPaintDiscount(
      [
        { skuId: 1, qty: 1 },
        { skuId: 4, qty: 2 },
        { skuId: 9, qty: 1 },
      ],
      store,
      100,
    )!;
    expect([result.paints, result.price, result.current]).toEqual([
      3,
      50,
      { paints: 3, percent: 20 },
    ]);
  });

  it('fills each higher tier with the cheapest paints, at most 5 of one in the cart', () => {
    const result = cartPaintDiscount([{ skuId: 2, qty: 2 }], store, 1000)!;
    expect(result.current).toEqual({ paints: 2, percent: 15 });
    const top = result.options.at(-1)!;
    expect(top.tier).toEqual({ paints: 10, percent: 35 });
    // 8 fillers: 3 more of the cheapest (5 in the cart then), 5 of the next, never packs or warbond.
    expect(fillerLinesOf(top)).toEqual([
      { skuId: 2, name: 'Avenger - Skullcrusher Paint', qty: 3 },
      { skuId: 3, name: 'Nova - Tundra Paint', qty: 5 },
    ]);
    expect(top.fillerCount).toBe(8);
    // Cart $10 + fillers $15 + $30 = $55, 35 % off.
    expect(top.cost).toBe(35.75);
    // On the cart's own $10: 35 % instead of 15 %.
    expect(top.saves).toBe(2);
    expect(result.best?.tier.percent).toBe(35);
  });

  it('pays the best tier the store credit allows, and tells what is missing', () => {
    const result = cartPaintDiscount([{ skuId: 4, qty: 1 }], store, 20)!;
    expect(result.current).toBeUndefined();
    expect(result.options.map((o) => [o.tier.paints, o.cost, o.missing])).toEqual([
      [2, 21.25, 1.25],
      // 2 × Avenger ($5): $30, 20 % off.
      [3, 24, 4],
      [5, 30, 10],
      // 5 × Avenger and 1 × Nova ($6): $51, 30 % off.
      [7, 35.7, 15.7],
      [10, 44.85, 24.85],
    ]);
    expect(result.best).toBeUndefined();
    const more = cartPaintDiscount([{ skuId: 4, qty: 1 }], store, 28)!;
    expect(more.best?.tier).toEqual({ paints: 3, percent: 20 });
  });

  it('works without a known store credit, and says nothing at the best tier or without paints', () => {
    const unknown = cartPaintDiscount([{ skuId: 1, qty: 1 }], store)!;
    expect(unknown.best).toBeUndefined();
    expect(unknown.options[0]!.missing).toBeUndefined();
    expect(
      cartPaintDiscount(
        [
          { skuId: 1, qty: 5 },
          { skuId: 4, qty: 5 },
        ],
        store,
      ),
    ).toBeUndefined();
    expect(cartPaintDiscount([{ skuId: 9, qty: 1 }], store)).toBeUndefined();
  });
});

describe('the plan the cart’s fillers start (#458)', () => {
  it('keeps only the fillers, to mark them to melt once bought', async () => {
    const { storedPlanOf } = await import('./rebuy-plan-storage');
    const option = cartPaintDiscount([{ skuId: 4, qty: 1 }], store, 100)!.best!;
    const plan = storedPlanOf(
      {
        tier: option.tier,
        own: [],
        fillers: option.fillers,
        cartPrice: option.cost,
        cartCost: option.cost,
        meltValue: 0,
        storeCreditNeeded: option.cost,
        storeCreditFreed: 0,
      },
      1,
      'buy',
      100,
    );
    expect(plan).toMatchObject({ version: 2, way: 'buy', own: [], tier: { paints: 10 } });
    expect(plan.fillers.reduce((sum, filler) => sum + filler.quantity, 0)).toBe(9);
  });
});
