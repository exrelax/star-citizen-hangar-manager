import { storeStatus, type StoreCatalog, type StoreStatus } from './store-status';
import { isStoreItem, type WatchItem } from './watchlists';

/*
 * What a watchlist's Pledge Store items cost now (#531), e.g. to rebuy melted pledges with store
 * credit: their standard prices now (`storeStatus`) times their counts, and which of them can't be
 * bought at the price they had when they were put on the watchlist any more – no longer on sale,
 * RSI can't sell them at all, or pricier now. Warbond prices don't count: they are for new money.
 */

const CENT = 0.005;
const round = (value: number) => Math.round(value * 100) / 100;

/** How the price of one has changed since it was put on the watchlist; none while the same. */
export function priceChangeOf(
  item: WatchItem,
  status: StoreStatus | undefined,
): { was: number; now: number; higher: boolean } | undefined {
  if (!isStoreItem(item) || item.value === undefined || status?.price === undefined) return;
  const change = status.price - item.value;
  if (Math.abs(change) < CENT) return undefined;
  return { was: item.value, now: status.price, higher: change > 0 };
}

export interface StoreCost {
  /** The store items on the watchlist. */
  items: number;
  /** What those on sale cost now in all, in USD, by their counts. */
  total: number;
  /** Those that can't be bought at the price they had when added: off sale, or pricier now. */
  changed: number;
  /** Those whose price or availability isn't known now (the store wasn't read). */
  unknown: number;
}

export function storeCostOf(items: readonly WatchItem[], catalog: StoreCatalog): StoreCost {
  const cost: StoreCost = { items: 0, total: 0, changed: 0, unknown: 0 };
  for (const item of items) {
    if (!isStoreItem(item)) continue;
    cost.items += 1;
    const status = storeStatus(item, catalog);
    if (status.impossible || status.onSale === false) {
      cost.changed += 1;
      continue;
    }
    if (status.price === undefined) {
      cost.unknown += 1;
      continue;
    }
    cost.total += status.price * (item.count ?? 1);
    if (priceChangeOf(item, status)?.higher) cost.changed += 1;
  }
  cost.total = round(cost.total);
  return cost;
}
