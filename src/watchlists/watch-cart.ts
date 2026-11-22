import { storeStatus, type StoreCatalog } from './store-status';
import { isStoreItem, type WatchItem } from './watchlists';

/*
 * A watchlist's Pledge Store items for RSI's cart (#529): paints by their SKU, standalone ships by
 * the SKU of their standard edition on sale, each with its count and price now. CCUs don't go in
 * this way yet – RSI's ship upgrade dialog sells them (#540) –, nor items not on sale or of unknown
 * price.
 */

/** RSI takes at most this many of one SKU per "Add to cart". */
export const CART_QTY_MAX = 5;

export interface WatchCartLine {
  skuId: number;
  name: string;
  qty: number;
  /** The price of one in USD now. */
  price: number;
}

export type WatchCartSkip = 'ccu' | 'notOnSale' | 'unknown';

export interface WatchCart {
  lines: WatchCartLine[];
  /** The items that don't go in, with why. */
  skipped: { item: WatchItem; reason: WatchCartSkip }[];
  /** What the lines cost in all, in USD. */
  total: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function watchCartOf(items: readonly WatchItem[], catalog: StoreCatalog): WatchCart {
  const cart: WatchCart = { lines: [], skipped: [], total: 0 };
  for (const item of items) {
    if (!isStoreItem(item)) continue;
    if (item.kind === 'storeCcu') {
      cart.skipped.push({ item, reason: 'ccu' });
      continue;
    }
    const status = storeStatus(item, catalog);
    if (status.onSale === false) {
      cart.skipped.push({ item, reason: 'notOnSale' });
      continue;
    }
    const skuId =
      item.kind === 'storePaint'
        ? item.skuId
        : catalog.buyable?.find((sku) => sku.shipId === item.shipId)?.skuId;
    if (skuId === undefined || status.price === undefined || status.onSale !== true) {
      cart.skipped.push({ item, reason: 'unknown' });
      continue;
    }
    const qty = item.count ?? 1;
    cart.lines.push({ skuId, name: item.name, qty, price: status.price });
    cart.total += status.price * qty;
  }
  cart.total = round(cart.total);
  return cart;
}

/** The lines as RSI takes them: at most `CART_QTY_MAX` of a SKU each. */
export function cartChunksOf(lines: readonly WatchCartLine[]): WatchCartLine[] {
  return lines.flatMap((line) => {
    const chunks: WatchCartLine[] = [];
    for (let left = line.qty; left > 0; left -= CART_QTY_MAX) {
      chunks.push({ ...line, qty: Math.min(left, CART_QTY_MAX) });
    }
    return chunks;
  });
}
