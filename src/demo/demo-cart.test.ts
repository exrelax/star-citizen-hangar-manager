import { describe, expect, it } from 'vitest';
import { cartPaintDiscount, fillerLinesOf } from '@/store/paint-consultant/cart-discount';
import { FALLBACK_CATALOG } from './catalog';
import { demoCart } from './demo-cart';

const items = FALLBACK_CATALOG.items;

describe('the demo’s cart for the paint discount note (#459)', () => {
  it('holds as many different paints as set, the priciest ones', () => {
    const cart = demoCart(items, 2);
    expect(cart).toHaveLength(2);
    expect(cart.every((line) => line.qty === 1)).toBe(true);
    expect(cart[0]!.skuId).toBe(12); // Polaris - Black Ice Paint, $20
    expect(demoCart(items, 10).length).toBeLessThanOrEqual(10);
  });

  it('shows every case of the note by its number of paints and the store credit', () => {
    // 2 paints: 8 fillers across two SKUs (5 + 3).
    const two = cartPaintDiscount(demoCart(items, 2), items, 1000)!;
    expect(fillerLinesOf(two.best!).map((line) => line.qty)).toEqual([5, 3]);
    // 6 paints: 4 fillers of one SKU.
    const six = cartPaintDiscount(demoCart(items, 6), items, 1000)!;
    expect(fillerLinesOf(six.best!).map((line) => line.qty)).toEqual([4]);
    // Enough store credit only for a lower tier, too little for any, none.
    const lower = cartPaintDiscount(demoCart(items, 2), items, two.options[0]!.cost)!;
    expect(lower.best?.tier.percent).toBe(two.options[0]!.tier.percent);
    expect(cartPaintDiscount(demoCart(items, 2), items, 1)!.best).toBeUndefined();
    expect(cartPaintDiscount(demoCart(items, 2), items, 0)!.best).toBeUndefined();
  });
});
