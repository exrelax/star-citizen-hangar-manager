import { settingsItem, withDefaults } from '@/settings/settings';
import { reactive, readonly } from 'vue';
import { fetchStoreData } from './fetch-store';
import { STORE_SNAPSHOT_VERSION, storeSnapshot, type StoreSnapshot } from './store-storage';
import type { StoreData } from './warbond';

/*
 * Keeps the stored offers of the pledge store current. They are read again from RSI once they are
 * older than the interval of the settings (smart updates), and always with a full refresh.
 */

const state = reactive({
  /** The offers are being read from RSI. */
  loading: false,
  /** Message of the last failed read; cleared by the next successful one. */
  error: undefined as string | undefined,
});

/** Shared by all mounts, like the sync state of hangar and buy back. */
export const storeSyncState = readonly(state);

/** Whether the stored offers are missing, of an older format or older than `maxAgeMs`. */
export function isStoreDue(
  snapshot: StoreSnapshot | null,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  if (snapshot?.version !== STORE_SNAPSHOT_VERSION) return true;
  return now - Date.parse(snapshot.fetchedAt) >= maxAgeMs;
}

let running: Promise<void> | undefined;

/**
 * Reads the offers from RSI and stores them, if the stored ones are older than `maxAgeMs` (0: in
 * any case). A failure keeps the stored offers. Calls during a read wait for that read.
 */
export function refreshStore({
  maxAgeMs = 0,
  fetchData = fetchStoreData,
  now = Date.now,
}: {
  maxAgeMs?: number;
  fetchData?: () => Promise<StoreData>;
  now?: () => number;
} = {}): Promise<void> {
  running ??= (async () => {
    if (!isStoreDue(await storeSnapshot.getValue(), maxAgeMs, now())) return;
    state.loading = true;
    try {
      const data = await fetchData();
      await storeSnapshot.setValue({
        version: STORE_SNAPSHOT_VERSION,
        fetchedAt: new Date(now()).toISOString(),
        data,
      });
      state.error = undefined;
    } catch (cause) {
      console.warn('[star-citizen-hangar-manager] Pledge store unavailable', cause);
      state.error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      state.loading = false;
    }
  })().finally(() => (running = undefined));
  return running;
}

/**
 * The automatic refresh: with smart updates on, once the stored offers are older than the
 * interval of the settings. Without them, only if nothing is stored yet.
 */
export async function maybeRefreshStore(
  options: { fetchData?: () => Promise<StoreData>; now?: () => number } = {},
): Promise<void> {
  const settings = withDefaults(await settingsItem.getValue());
  const maxAgeMs = settings.smartUpdates ? settings.storeRefreshMinutes * 60_000 : Infinity;
  await refreshStore({ ...options, maxAgeMs });
}
