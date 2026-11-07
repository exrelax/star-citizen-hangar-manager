import { UPGRADE_TOOL } from '@/config';
import { settingsItem, withDefaults } from '@/settings/settings';
import { reactive, readonly } from 'vue';
import { fetchUpgradeTool } from './fetch-upgrade-tool';
import type { UpgradeToolData } from './ships';
import { buyableShipsItem, shipsItem, SHIPS_VERSION, warbondsItem } from './ships-storage';

/*
 * Keeps the data of the upgrade tool current: ships, ships on sale and warbond editions, read
 * with one request and stored in three storages. They are read again once older than the interval
 * of the settings (smart updates; otherwise once a day), and always with a full refresh.
 */

const state = reactive({
  /** The upgrade tool is being read. */
  loading: false,
  /** Message of the last failed read; cleared by the next successful one. */
  error: undefined as string | undefined,
});

/** Shared by all mounts, like the sync state of hangar and buy back. */
export const upgradeToolState = readonly(state);

/** Whether the stored data is missing, of an older format or older than `maxAgeMs`. */
export async function isUpgradeToolDue(maxAgeMs: number, now = Date.now()): Promise<boolean> {
  const stored = await Promise.all([
    shipsItem.getValue(),
    buyableShipsItem.getValue(),
    warbondsItem.getValue(),
  ]);
  return stored.some(
    (value) => value?.version !== SHIPS_VERSION || now - Date.parse(value.fetchedAt) >= maxAgeMs,
  );
}

let running: Promise<void> | undefined;

/**
 * Reads the upgrade tool and stores its three parts, if the stored ones are older than `maxAgeMs`
 * (0: in any case). A failure keeps the stored data. Calls during a read wait for that read.
 */
export function refreshUpgradeTool({
  maxAgeMs = 0,
  fetchData = fetchUpgradeTool,
  now = Date.now,
}: {
  maxAgeMs?: number;
  fetchData?: () => Promise<UpgradeToolData>;
  now?: () => number;
} = {}): Promise<void> {
  running ??= (async () => {
    if (!(await isUpgradeToolDue(maxAgeMs, now()))) return;
    state.loading = true;
    try {
      const { ships, buyable, warbonds } = await fetchData();
      const meta = { version: SHIPS_VERSION, fetchedAt: new Date(now()).toISOString() };
      await Promise.all([
        shipsItem.setValue({ ...meta, ships }),
        buyableShipsItem.setValue({ ...meta, skus: buyable }),
        warbondsItem.setValue({ ...meta, warbonds }),
      ]);
      state.error = undefined;
    } catch (cause) {
      console.warn('[star-citizen-hangar-manager] Ship upgrade tool unavailable', cause);
      state.error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      state.loading = false;
    }
  })().finally(() => (running = undefined));
  return running;
}

/**
 * The automatic refresh: with smart updates on, once the stored data is older than the interval
 * of the settings; without them, once a day (see `UPGRADE_TOOL`).
 */
export async function maybeRefreshUpgradeTool(
  options: { fetchData?: () => Promise<UpgradeToolData>; now?: () => number } = {},
): Promise<void> {
  const settings = withDefaults(await settingsItem.getValue());
  const maxAgeMs = settings.smartUpdates
    ? settings.storeRefreshMinutes * 60_000
    : UPGRADE_TOOL.maxAgeWithoutSmartUpdatesMs;
  await refreshUpgradeTool({ ...options, maxAgeMs });
}
