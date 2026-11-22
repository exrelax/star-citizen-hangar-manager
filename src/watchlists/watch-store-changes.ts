import { storeStatus, type StoreCatalog } from './store-status';
import { isStoreItem, itemKey, type WatchItem, type Watchlist } from './watchlists';

/*
 * Changes of a watchlist's Pledge Store items (#472): a new price, no longer for sale, for sale
 * again. Each item is compared with how this browser last saw it (`SeenStore`): the first time it
 * is only noted. A change stays while it lasts – a price back where it was is no change any more –
 * until the watchlist is seen or its notification dismissed, which notes the item as it is now.
 * Only watchlists with `storeAlerts` on, and only what the store data tells (nothing while it
 * wasn't read).
 */

/** How an item was last seen: its price and whether it was for sale. */
export interface SeenItem {
  price?: number;
  onSale?: boolean;
}

/** The items as last seen, by `seenKey`. */
export type SeenStore = Readonly<Record<string, SeenItem>>;

/** A watchlist's item, as noted: the same item on two watchlists is noted twice. */
export const seenKey = (list: Pick<Watchlist, 'id'>, item: WatchItem): string =>
  `${list.id}|${itemKey(item)}`;

export type StoreChange =
  | { kind: 'price'; item: WatchItem; from: number; to: number }
  | { kind: 'gone'; item: WatchItem }
  | { kind: 'back'; item: WatchItem };

/** How the item is now, as far as the store data tells. */
function seenNow(item: WatchItem, catalog: StoreCatalog): SeenItem {
  const status = storeStatus(item, catalog);
  return {
    ...(status.price !== undefined && { price: status.price }),
    ...(status.onSale !== undefined && { onSale: status.onSale }),
  };
}

/** The change of one item since it was seen, if any. */
function changeOf(item: WatchItem, before: SeenItem, now: SeenItem): StoreChange | undefined {
  if (before.onSale === true && now.onSale === false) return { kind: 'gone', item };
  if (before.onSale === false && now.onSale === true) return { kind: 'back', item };
  if (before.price !== undefined && now.price !== undefined && before.price !== now.price) {
    return { kind: 'price', item, from: before.price, to: now.price };
  }
  return undefined;
}

export interface WatchlistChanges {
  list: Watchlist;
  changes: StoreChange[];
}

/**
 * The changes of each watchlist with `storeAlerts` on, and the items seen for the first time to
 * note (`noted`, empty when there are none).
 */
export function storeChangesOf(
  lists: readonly Watchlist[],
  catalog: StoreCatalog,
  seen: SeenStore,
): { changed: WatchlistChanges[]; noted: Record<string, SeenItem> } {
  const changed: WatchlistChanges[] = [];
  const noted: Record<string, SeenItem> = {};
  for (const list of lists) {
    if (!list.storeAlerts) continue;
    const changes: StoreChange[] = [];
    for (const item of list.items) {
      if (!isStoreItem(item)) continue;
      const now = seenNow(item, catalog);
      if (now.price === undefined && now.onSale === undefined) continue;
      const key = seenKey(list, item);
      const before = seen[key];
      if (!before) {
        noted[key] = now;
        continue;
      }
      const change = changeOf(item, before, now);
      if (change) changes.push(change);
    }
    if (changes.length) changed.push({ list, changes });
  }
  return { changed, noted };
}

/** `seen` with the watchlist's store items noted as they are now (seen, or dismissed). */
export function withSeen(seen: SeenStore, list: Watchlist, catalog: StoreCatalog): SeenStore {
  const next: Record<string, SeenItem> = { ...seen };
  for (const item of list.items) {
    if (!isStoreItem(item)) continue;
    const now = seenNow(item, catalog);
    if (now.price !== undefined || now.onSale !== undefined) next[seenKey(list, item)] = now;
  }
  return next;
}

/** `seen` without the items of watchlists or items that are gone, so it doesn't grow. */
export function withoutGone(seen: SeenStore, lists: readonly Watchlist[]): SeenStore {
  const keys = new Set(lists.flatMap((list) => list.items.map((item) => seenKey(list, item))));
  const kept = Object.entries(seen).filter(([key]) => keys.has(key));
  return kept.length === Object.keys(seen).length ? seen : Object.fromEntries(kept);
}

/** A change as one key, to tell it once in the browser. */
export const changeKey = (list: Watchlist, change: StoreChange): string =>
  `${seenKey(list, change.item)}|${change.kind}${change.kind === 'price' ? `:${change.to}` : ''}`;

/** The items as last seen in this browser; the demo's apart from the account's. */
export const storeSeenItem = storage.defineItem<SeenStore>('local:watchlists.storeSeen', {
  fallback: {},
});
export const demoStoreSeenItem = storage.defineItem<SeenStore>('local:demo.watchlists.storeSeen', {
  fallback: {},
});
