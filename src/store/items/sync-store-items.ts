import { PLEDGE_STORE, STORE_ITEMS } from '@/config';
import type { RefreshResult } from '@/ships/sync-upgrade-tool';
import { withLease } from '@/storage/lease';
import { settingsItem, withDefaults } from '@/settings/settings';
import { hashOf, recordCheck, recordSync } from '@/storage/meta';
import { storeItemsMaxAgeMs } from '../refresh-schedule';
import { fetchStoreItems, type StoreItemsRead } from './fetch-store-items';
import { storeItemsItem, storeItemsMeta, STORE_ITEMS_VERSION } from './store-items-storage';

/*
 * Keeps the stored items of the Pledge Store current: read with every full refresh, from the
 * settings, and by smart updates at fixed minutes of every hour (`STORE_ITEMS.readAtMinutes`;
 * without smart updates once a day). An unchanged answer (same fingerprint) is not written again.
 */

/** The lease of the automatic reads, shared with the background script (see `withLease`). */
const LEASE_KEY = 'local:storeItems.readLease';

let running: Promise<RefreshResult> | undefined;

/**
 * Reads the items if the stored ones are older than `maxAgeMs` (0: in any case). An automatic read
 * (`maxAgeMs` > 0) is skipped while another tab or the background script reads.
 */
export function refreshStoreItems({
  maxAgeMs = 0,
  fetchItems = fetchStoreItems,
  now = Date.now,
}: {
  maxAgeMs?: number;
  fetchItems?: () => Promise<StoreItemsRead>;
  now?: () => number;
} = {}): Promise<RefreshResult> {
  running ??= (async () => {
    const [stored, meta] = await Promise.all([
      storeItemsItem.getValue(),
      storeItemsMeta.getValue(),
    ]);
    const current = stored?.version === STORE_ITEMS_VERSION;
    if (current && now() - meta.checkedAt < maxAgeMs) return 'skipped' as const;
    const read = () => readStoreItems(fetchItems, now, current, meta);
    if (!maxAgeMs) return read();
    return (await withLease(LEASE_KEY, PLEDGE_STORE.readLeaseMs, read, now)) ?? 'skipped';
  })().finally(() => (running = undefined));
  return running;
}

async function readStoreItems(
  fetchItems: () => Promise<StoreItemsRead>,
  now: () => number,
  current: boolean,
  meta: Awaited<ReturnType<typeof storeItemsMeta.getValue>>,
): Promise<RefreshResult> {
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
    return 'read';
  } catch (error) {
    console.warn('[star-citizen-hangar-manager] Pledge Store items unavailable', error);
    await recordCheck(storeItemsMeta, { status: 'failed' }, { at: now() });
    return 'failed';
  }
}

/**
 * The automatic refresh: at the fixed minutes of every hour (a read missed meanwhile runs once at
 * the next chance), once a day without smart updates.
 */
export async function maybeRefreshStoreItems(
  options: { fetchItems?: () => Promise<StoreItemsRead>; now?: () => number } = {},
): Promise<RefreshResult> {
  const settings = withDefaults(await settingsItem.getValue());
  const maxAgeMs = settings.smartUpdates
    ? storeItemsMaxAgeMs((options.now ?? Date.now)())
    : STORE_ITEMS.maxAgeWithoutSmartUpdatesMs;
  return refreshStoreItems({ ...options, maxAgeMs });
}
