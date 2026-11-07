import { defineMeta } from '@/storage/meta';
import type { BuybackSnapshot } from './buyback';

/** The whole buy back in a single key, replaced atomically like the hangar snapshot. */
export const buybackSnapshot = storage.defineItem<BuybackSnapshot | null>('local:buyback.items', {
  fallback: null,
});

/** When the buy back was last read, changed and checked (see `storage/meta.ts`). */
export const buybackMeta = defineMeta('local:buyback.items');
