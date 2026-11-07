import { STORE_ITEMS } from '@/config';
import { hashOf, recordCheck, recordSync } from '@/storage/meta';
import { fetchStoreItems, type StoreItemsRead } from './fetch-store-items';
import { storeItemsItem, storeItemsMeta, STORE_ITEMS_VERSION } from './store-items-storage';

/*
 * Keeps the stored items of the Pledge Store current: read with every full refresh, from the
 * settings, and by smart updates once older than `STORE_ITEMS.maxAgeMs`. An unchanged answer
 * (same fingerprint) is not written again.
 */

let running: Promise<void> | undefined;

/** Reads the items if the stored ones are older than `maxAgeMs` (0: in any case). */
export function refreshStoreItems({
  maxAgeMs = 0,
  fetchItems = fetchStoreItems,
  now = Date.now,
}: {
  maxAgeMs?: number;
  fetchItems?: () => Promise<StoreItemsRead>;
  now?: () => number;
} = {}): Promise<void> {
  running ??= (async () => {
    const [stored, meta] = await Promise.all([
      storeItemsItem.getValue(),
      storeItemsMeta.getValue(),
    ]);
    const current = stored?.version === STORE_ITEMS_VERSION;
    if (current && now() - meta.checkedAt < maxAgeMs) return;
    const startedAt = performance.now();
    try {
      const { items, requests } = await fetchItems();
      const at = now();
      const value = { version: STORE_ITEMS_VERSION, items };
      const fingerprint = hashOf(value);
      const unchanged = current && meta.fingerprint === fingerprint;
      if (!unchanged) await storeItemsItem.setValue(value);
      await recordSync(storeItemsMeta, {
        at,
        fingerprint,
        ...(unchanged && { updatedAt: meta.updatedAt }),
      });
      const ms = Math.round(performance.now() - startedAt);
      console.info(
        `[star-citizen-hangar-manager] Pledge Store: ${items.length} items, ` +
          `${requests} requests in ${ms} ms${unchanged ? ' (unchanged)' : ''}`,
      );
    } catch (error) {
      console.warn('[star-citizen-hangar-manager] Pledge Store items unavailable', error);
      await recordCheck(storeItemsMeta, { status: 'failed' }, { at: now() });
    }
  })().finally(() => (running = undefined));
  return running;
}

/** The automatic refresh of smart updates. */
export const maybeRefreshStoreItems = () => refreshStoreItems({ maxAgeMs: STORE_ITEMS.maxAgeMs });
