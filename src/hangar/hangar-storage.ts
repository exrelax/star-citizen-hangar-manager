import { defineMeta } from '@/storage/meta';
import type { HangarSnapshot } from './pledge';

/**
 * The whole snapshot lives in a single key, so a sync replaces it atomically and readers never
 * see a mix of old and new pledges.
 */
export const hangarSnapshot = storage.defineItem<HangarSnapshot | null>('local:hangar.items', {
  fallback: null,
});

/** When the hangar was last read, changed and checked (see `storage/meta.ts`). */
export const hangarMeta = defineMeta('local:hangar.items');
