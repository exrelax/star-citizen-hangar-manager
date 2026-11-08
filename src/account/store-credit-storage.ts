import { defineMeta } from '@/storage/meta';
import type { StoreCredit } from './store-credit';

/** Format version of the stored store credit; others are ignored and read again. */
export const STORE_CREDIT_VERSION = 1;

export interface StoreCreditSnapshot {
  version: number;
  credit: StoreCredit;
}

export const storeCreditItem = storage.defineItem<StoreCreditSnapshot | null>(
  'local:account.credit',
  { fallback: null },
);

/** Last read and check of the store credit (see `storage/meta.ts`). */
export const storeCreditMeta = defineMeta('local:account.credit');
