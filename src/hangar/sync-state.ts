import { SMART_UPDATE } from '@/config';
import { buybackCheckState } from '@/buyback/buyback-storage';
import { runBuybackSmartUpdate } from '@/buyback/run';
import { prepareBuybackSync } from '@/buyback/sync-buyback';
import { settingsItem, withDefaults } from '@/settings/settings';
import { reactive, readonly } from 'vue';
import { hangarCheckState, type CheckOutcome, type CheckState } from './hangar-storage';
import { runSmartUpdate } from './smart-update/run';
import { refreshShipPrices } from './ship-prices';
import { prepareHangarSync } from './sync';
import { SyncProgressTracker, type SyncProgress } from './sync-progress';

const state = reactive({
  /** A full sync is running. */
  running: false,
  progress: null as SyncProgress | null,
  /** A smart update check is running. */
  checking: false,
});

/**
 * Sync state shared by all mounts of the manager view, so switching to "My Gear" and back
 * neither aborts nor duplicates a running sync.
 */
export const syncState = readonly(state);

type CheckStateItem = {
  getValue(): Promise<CheckState>;
  setValue(value: CheckState): Promise<void>;
};

async function recordOutcome(item: CheckStateItem, status: CheckOutcome['status']) {
  const current = await item.getValue();
  const at = Date.now();
  await item.setValue({
    ...current,
    lastCheckAt: at,
    lastOutcome: { at, status, added: 0, removed: 0, changed: 0 },
  });
}

/**
 * Starts a full sync of the hangar and then the buy back, unless one is already running. The
 * first pages of both are read up front, so the progress counts all their pages from the start.
 */
export async function startSync(): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.progress = null;
  const startedAt = performance.now();
  try {
    // Small and optional: loads alongside, a failure keeps the stored prices.
    const shipPrices = refreshShipPrices({ maxAgeMs: 0 });
    // Reported only once both totals are known; the detail pages of the buy back join later.
    const progress = new SyncProgressTracker();
    const [runHangar, runBuyback] = await Promise.all([
      prepareHangarSync({ progress }),
      prepareBuybackSync({ progress }),
    ]);
    progress.start();
    progress.onChange = (value) => (state.progress = value);
    state.progress = progress.progress;

    const hangar = await runHangar();
    // A full sync is the most thorough check there is.
    await recordOutcome(hangarCheckState, 'unchanged');
    const buyback = await runBuyback();
    await recordOutcome(buybackCheckState, 'unchanged');
    await shipPrices;

    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    console.info(
      `[sc-hangar-manager] Synced ${hangar.pledges.length} hangar and ` +
        `${buyback.pledges.length} buy back pledges in ${seconds} s`,
    );
  } catch (error) {
    console.error('[sc-hangar-manager] Sync failed', error);
  } finally {
    state.running = false;
    state.progress = null;
  }
}

/**
 * Runs a smart update of hangar and buy back if it is enabled and due (see
 * `SMART_UPDATE.checkIntervalMs`). Both run together: pledges melted in the hangar show up in
 * the buy back. `force` skips the interval, e.g. when returning from "My Gear".
 */
export async function maybeRunSmartUpdate({ force = false } = {}): Promise<void> {
  if (state.running || state.checking) return;
  // Claimed right away, so triggers firing at the same time don't start two checks.
  state.checking = true;
  try {
    // Independent of the smart update setting: one small request a day.
    await refreshShipPrices();
    const settings = withDefaults(await settingsItem.getValue());
    if (!settings.smartUpdates) return;
    const { lastCheckAt } = await hangarCheckState.getValue();
    if (!force && Date.now() - lastCheckAt < SMART_UPDATE.checkIntervalMs) return;

    await runLogged('Smart update', hangarCheckState, () => runSmartUpdate());
    await runLogged('Buy back smart update', buybackCheckState, () => runBuybackSmartUpdate());
  } finally {
    state.checking = false;
  }
}

async function runLogged(
  label: string,
  checkState: CheckStateItem,
  run: () => Promise<CheckOutcome | null>,
) {
  const startedAt = performance.now();
  try {
    const outcome = await run();
    if (!outcome) return;
    const ms = Math.round(performance.now() - startedAt);
    console.info(
      `[sc-hangar-manager] ${label}: ${outcome.status} ` +
        `(+${outcome.added} / -${outcome.removed} / ~${outcome.changed}) in ${ms} ms`,
    );
  } catch (error) {
    console.error(`[sc-hangar-manager] ${label} failed`, error);
    // Counts as a check, so a broken connection isn't retried on every trigger.
    await recordOutcome(checkState, 'failed');
  }
}
