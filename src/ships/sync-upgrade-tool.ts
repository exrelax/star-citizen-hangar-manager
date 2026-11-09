import { PLEDGE_STORE, UPGRADE_TOOL } from '@/config';
import { RsiSignedOutError } from '@/shared/rsi-api';
import { withLease } from '@/storage/lease';
import { settingsItem, withDefaults } from '@/settings/settings';
import { hashOf, recordCheck, recordSync, type MetaItem } from '@/storage/meta';
import { reactive, readonly } from 'vue';
import { upgradeToolMaxAgeMs } from '@/store/refresh-schedule';
import { fetchUpgradeTool } from './fetch-upgrade-tool';
import type { UpgradeToolData } from './ships';
import {
  buyableShipsItem,
  buyableShipsMeta,
  shipsItem,
  shipsMeta,
  SHIPS_VERSION,
  warbondsItem,
  warbondsMeta,
} from './ships-storage';

/*
 * Keeps the data of the upgrade tool current: ships, ships on sale and warbond editions, read
 * with one request and stored in three storages. They are read again once older than the interval
 * of the settings, every 30 seconds around the full hour (smart updates; otherwise once a day),
 * and always with a full refresh. A part
 * whose answer is unchanged (same fingerprint) is not written again, only its check is recorded.
 */

const state = reactive({
  /** The upgrade tool is being read. */
  loading: false,
  /** Message of the last failed read; cleared by the next successful one. */
  error: undefined as string | undefined,
});

/** Shared by all mounts, like the sync state of hangar and buy back. */
export const upgradeToolState = readonly(state);

interface Part {
  item: { getValue(): Promise<{ version: number } | null> };
  meta: MetaItem;
}

const PARTS: Part[] = [
  { item: shipsItem, meta: shipsMeta },
  { item: buyableShipsItem, meta: buyableShipsMeta },
  { item: warbondsItem, meta: warbondsMeta },
];

/** Whether a part is missing, of an older format or last read longer than `maxAgeMs` ago. */
export async function isUpgradeToolDue(maxAgeMs: number, now = Date.now()): Promise<boolean> {
  const parts = await Promise.all(
    PARTS.map(async ({ item, meta }) => [await item.getValue(), await meta.getValue()] as const),
  );
  return parts.some(
    ([value, meta]) => value?.version !== SHIPS_VERSION || now - meta.checkedAt >= maxAgeMs,
  );
}

/** Stores a part if its answer changed; records the read either way. */
async function storePart<T extends { version: number }>(
  item: { getValue(): Promise<T | null>; setValue(value: T | null): Promise<void> },
  meta: MetaItem,
  value: NoInfer<T>,
  at: number,
) {
  // Every read of the upgrade tool reads everything: it counts as a full sync. An unchanged
  // answer is not written again and keeps the time of the last change.
  const fingerprint = hashOf(value);
  const [stored, previous] = await Promise.all([item.getValue(), meta.getValue()]);
  const unchanged = stored?.version === SHIPS_VERSION && previous.fingerprint === fingerprint;
  if (!unchanged) await item.setValue(value);
  await recordSync(meta, { at, fingerprint, ...(unchanged && { updatedAt: previous.updatedAt }) });
}

/**
 * How a refresh ended: read, not due (or read elsewhere right now), not signed in to RSI (nothing
 * stored, nothing logged: the next run tries again), or failed.
 */
export type RefreshResult = 'read' | 'skipped' | 'signedOut' | 'failed';

/** The lease of the automatic reads, shared with the background script (see `withLease`). */
const LEASE_KEY = 'local:ships.readLease';

let running: Promise<RefreshResult> | undefined;

/**
 * Reads the upgrade tool and stores its three parts, if the stored ones are older than `maxAgeMs`
 * (0: in any case). A failure keeps the stored data. Calls during a read wait for that read. An
 * automatic read (`maxAgeMs` > 0) is skipped while another tab or the background script reads.
 */
export function refreshUpgradeTool({
  maxAgeMs = 0,
  fetchData = fetchUpgradeTool,
  now = Date.now,
}: {
  maxAgeMs?: number;
  fetchData?: () => Promise<UpgradeToolData>;
  now?: () => number;
} = {}): Promise<RefreshResult> {
  const read = () => readUpgradeTool(fetchData, now);
  running ??= (async () => {
    if (!(await isUpgradeToolDue(maxAgeMs, now()))) return 'skipped' as const;
    if (!maxAgeMs) return read();
    return (await withLease(LEASE_KEY, PLEDGE_STORE.readLeaseMs, read, now)) ?? 'skipped';
  })().finally(() => (running = undefined));
  return running;
}

async function readUpgradeTool(
  fetchData: () => Promise<UpgradeToolData>,
  now: () => number,
): Promise<RefreshResult> {
  state.loading = true;
  try {
    const { ships, buyable, warbonds } = await fetchData();
    const at = now();
    const version = SHIPS_VERSION;
    await Promise.all([
      storePart(shipsItem, shipsMeta, { version, ships }, at),
      storePart(buyableShipsItem, buyableShipsMeta, { version, skus: buyable }, at),
      storePart(warbondsItem, warbondsMeta, { version, warbonds }, at),
    ]);
    state.error = undefined;
    return 'read';
  } catch (cause) {
    if (cause instanceof RsiSignedOutError) return 'signedOut';
    console.warn('[star-citizen-hangar-manager] Ship upgrade tool unavailable', cause);
    state.error = cause instanceof Error ? cause.message : String(cause);
    await Promise.all(
      PARTS.map(({ meta }) => recordCheck(meta, { status: 'failed' }, { at: now() })),
    );
    return 'failed';
  } finally {
    state.loading = false;
  }
}

/**
 * The automatic refresh: with smart updates on, once the stored data is older than the interval
 * of the settings, or 30 seconds around the full hour (see `upgradeToolMaxAgeMs`); without them,
 * once a day (see `UPGRADE_TOOL`).
 */
export async function maybeRefreshUpgradeTool(
  options: { fetchData?: () => Promise<UpgradeToolData>; now?: () => number } = {},
): Promise<RefreshResult> {
  const settings = withDefaults(await settingsItem.getValue());
  const maxAgeMs = settings.smartUpdates
    ? upgradeToolMaxAgeMs((options.now ?? Date.now)(), settings.storeRefreshMinutes)
    : UPGRADE_TOOL.maxAgeWithoutSmartUpdatesMs;
  return refreshUpgradeTool({ ...options, maxAgeMs });
}
