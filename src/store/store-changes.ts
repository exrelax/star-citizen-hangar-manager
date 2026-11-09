import type { WarbondSku } from '@/ships/ships';
import type { StoreItem } from './items/store-items';

/*
 * What changed in the Pledge Store between the stored read and a new one (#162), for the
 * notifications of #164. Without a stored read there is nothing to compare: the first read never
 * counts as a change.
 */

export interface WarbondChanges {
  added: WarbondSku[];
  removed: WarbondSku[];
}

export interface StoreItemChange {
  item: StoreItem;
  /** The stored item, with the price and sale price before. */
  before: StoreItem;
}

export interface StoreItemChanges {
  added: StoreItem[];
  removed: StoreItem[];
  /** The price or the sale price changed. */
  repriced: StoreItemChange[];
}

/** Entries of `next` missing in `previous` and the other way round, by `key`. */
function addedAndRemoved<T>(previous: readonly T[], next: readonly T[], key: (entry: T) => number) {
  const before = new Map(previous.map((entry) => [key(entry), entry]));
  const after = new Map(next.map((entry) => [key(entry), entry]));
  return {
    added: next.filter((entry) => !before.has(key(entry))),
    removed: previous.filter((entry) => !after.has(key(entry))),
    both: next.flatMap((entry) => {
      const old = before.get(key(entry));
      return old ? [{ item: entry, before: old }] : [];
    }),
  };
}

const isEmpty = (changes: object) =>
  Object.values(changes).every((list: unknown[]) => list.length === 0);

/** The warbond CCUs added and removed; none on the first read or when nothing changed. */
export function warbondChanges(
  previous: readonly WarbondSku[] | undefined,
  next: readonly WarbondSku[],
): WarbondChanges | undefined {
  if (!previous) return undefined;
  const { added, removed } = addedAndRemoved(previous, next, (sku) => sku.skuId);
  const changes = { added, removed };
  return isEmpty(changes) ? undefined : changes;
}

/** The Pledge Store items added, removed and repriced; none on the first read or without change. */
export function storeItemChanges(
  previous: readonly StoreItem[] | undefined,
  next: readonly StoreItem[],
): StoreItemChanges | undefined {
  if (!previous) return undefined;
  const { added, removed, both } = addedAndRemoved(previous, next, (item) => item.id);
  const repriced = both.filter(
    ({ item, before }) =>
      item.price !== before.price || item.discountedPrice !== before.discountedPrice,
  );
  const changes = { added, removed, repriced };
  return isEmpty(changes) ? undefined : changes;
}
