import { defineMeta } from '@/storage/meta';
import type { StoreItem } from './store-items';

/** Format version of the stored items; others are ignored and read again. */
export const STORE_ITEMS_VERSION = 1;

export interface StoreItemsSnapshot {
  version: number;
  items: StoreItem[];
}

export const storeItemsItem = storage.defineItem<StoreItemsSnapshot | null>('local:store.items', {
  fallback: null,
});

/** Last read, check and fingerprint of the store items (see `storage/meta.ts`). */
export const storeItemsMeta = defineMeta('local:store.items');
