import { storePaintsOf } from '@/store/paint-consultant/calculation';
import type { CartLine } from '@/store/paint-consultant/cart';
import type { StoreItem } from '@/store/items/store-items';

/*
 * The cart of the demo for the paint discount note on RSI's cart page (#458, #459): made-up paints
 * of the Pledge Store instead of the real cart, which the demo never reads. Their number is set in
 * the demo settings: below the best tier the note shows, at it (10) it doesn't. The priciest paints,
 * so they aren't the cheapest ones the note fills up with.
 */

/** The most paints the demo's cart can hold: the best volume discount tier. */
export const DEMO_CART_MAX = 10;

/** The demo's cart: `count` different paints, one of each. */
export function demoCart(storeItems: readonly StoreItem[], count: number): CartLine[] {
  return storePaintsOf(storeItems)
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, Math.min(count, DEMO_CART_MAX)))
    .map((paint) => ({ skuId: paint.id, qty: 1 }));
}
