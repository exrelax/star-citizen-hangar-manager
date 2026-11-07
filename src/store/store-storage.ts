import type { StoreData } from './warbond';

/** The pledge store's offers as read last from RSI's upgrade tool (see `sync-store.ts`). */
export interface StoreSnapshot {
  /** Format version; snapshots of other versions are ignored and read again. */
  version: number;
  /** ISO timestamp of the read. */
  fetchedAt: string;
  data: StoreData;
}

export const STORE_SNAPSHOT_VERSION = 1;

export const storeSnapshot = storage.defineItem<StoreSnapshot | null>('local:store.snapshot', {
  fallback: null,
});
