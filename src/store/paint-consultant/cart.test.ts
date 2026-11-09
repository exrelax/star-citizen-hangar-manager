// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { addLinesToCart, addToCart, cartLinesOf, readCart } from './cart';
import { storedPlanOf } from './rebuy-plan-storage';
import type { PaintRebuyPlan } from './calculation';

const paint = (id: number, name: string, price: number) => ({ id, name, price });

const plan: PaintRebuyPlan = {
  tier: { paints: 10, percent: 35 },
  own: [
    {
      pledgeId: 1,
      title: 'Paints - A',
      meltValue: 5,
      storePaint: paint(11, 'A', 5),
      discount: 0,
      giftable: false,
    },
    {
      pledgeId: 2,
      title: 'Paints - A',
      meltValue: 5,
      storePaint: paint(11, 'A', 5),
      discount: 0,
      giftable: false,
    },
    {
      pledgeId: 3,
      title: 'Paints - B',
      meltValue: 22,
      storePaint: paint(12, 'B', 22),
      discount: 0,
      giftable: false,
    },
  ],
  fillers: [
    { paint: paint(20, 'Cheap', 3), quantity: 5 },
    { paint: paint(21, 'Cheaper', 3), quantity: 2 },
  ],
  cartPrice: 53,
  cartCost: 34.45,
  meltValue: 32,
  storeCreditNeeded: 2.45,
  storeCreditFreed: 11.2,
};

describe('cartLinesOf', () => {
  it('puts own paints of the same SKU together, then the fillers', () => {
    expect(cartLinesOf(plan)).toEqual([
      { skuId: 11, name: 'A', qty: 2 },
      { skuId: 12, name: 'B', qty: 1 },
      { skuId: 20, name: 'Cheap', qty: 5 },
      { skuId: 21, name: 'Cheaper', qty: 2 },
    ]);
  });
});

describe('readCart', () => {
  it("reads the cart's lines", async () => {
    const post = vi.fn().mockResolvedValue({
      data: { store: { cart: { lineItems: [{ skuId: '13524', qty: 1 }] } } },
    });
    expect(await readCart(post)).toEqual([{ skuId: 13524, qty: 1 }]);
    expect(post).toHaveBeenCalledWith('/graphql', { query: expect.stringContaining('lineItems') });
  });

  it('reads an empty cart', async () => {
    const post = vi.fn().mockResolvedValue({ data: { store: { cart: { lineItems: null } } } });
    expect(await readCart(post)).toEqual([]);
  });

  it("fails with RSI's reason", async () => {
    const post = vi.fn().mockResolvedValue({ errors: [{ message: 'Not signed in' }] });
    await expect(readCart(post)).rejects.toThrow('Not signed in');
  });
});

describe('addToCart', () => {
  it("adds a SKU with its quantity and the page's CSRF token, as RSI's paint pages do", async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="token-1">';
    const post = vi.fn().mockResolvedValue({ data: {} });
    await addToCart({ skuId: 20, qty: 5 }, post);
    expect(post).toHaveBeenCalledWith(
      '/graphql',
      { query: expect.stringContaining('add(skuId: 20, qty: 5)') },
      { 'x-csrf-token': 'token-1' },
    );
  });

  it('refuses anything but whole numbers', async () => {
    const post = vi.fn();
    await expect(addToCart({ skuId: Number('1) { x'), qty: 1 }, post)).rejects.toThrow();
    await expect(addToCart({ skuId: 20, qty: 0 }, post)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });

  it("fails with RSI's reason and its details", async () => {
    const post = vi.fn().mockResolvedValue({
      errors: [
        {
          message: 'Invalid cart',
          extensions: { details: { skus: 'You do not have access to this item.' } },
        },
      ],
    });
    await expect(addToCart({ skuId: 20, qty: 1 }, post)).rejects.toThrow(
      'Invalid cart: You do not have access to this item.',
    );
  });
});

describe('addLinesToCart', () => {
  it('adds the other lines when RSI refuses one', async () => {
    const lines = cartLinesOf(plan);
    const add = vi.fn(async (line: { skuId: number }) => {
      if (line.skuId === 12) throw new Error('No longer available');
    });
    const result = await addLinesToCart(lines, add);
    expect(add).toHaveBeenCalledTimes(4);
    expect(result.added.map((line) => line.skuId)).toEqual([11, 20, 21]);
    expect(result.failed).toEqual([
      { line: { skuId: 12, name: 'B', qty: 1 }, reason: 'No longer available' },
    ]);
  });
});

describe('storedPlanOf', () => {
  it('keeps the own paints and the probable filler paints', () => {
    const stored = storedPlanOf(plan, 1000);
    expect(stored.at).toBe(1000);
    expect(stored.tier).toEqual({ paints: 10, percent: 35 });
    expect(stored.own).toEqual([
      { pledgeId: 1, title: 'Paints - A', skuId: 11, meltValue: 5 },
      { pledgeId: 2, title: 'Paints - A', skuId: 11, meltValue: 5 },
      { pledgeId: 3, title: 'Paints - B', skuId: 12, meltValue: 22 },
    ]);
    expect(stored.fillers).toEqual([
      { skuId: 20, name: 'Cheap', quantity: 5, price: 3 },
      { skuId: 21, name: 'Cheaper', quantity: 2, price: 3 },
    ]);
  });
});
