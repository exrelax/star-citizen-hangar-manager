import { SMART_UPDATE } from '@/config';
import { settingsItem, withDefaults } from '@/settings/settings';
import { reactive, readonly } from 'vue';
import { hangarCheckState } from './hangar-storage';
import { runSmartUpdate } from './smart-update/run';
import { syncHangar, type SyncProgress } from './sync';

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

/** Starts a hangar sync unless one is already running. */
export async function startSync(): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.progress = null;
  const startedAt = performance.now();
  let pages = 0;
  try {
    const snapshot = await syncHangar({
      onProgress: (progress) => {
        state.progress = progress;
        pages = progress.total;
      },
    });
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    console.info(
      `[sc-hangar-manager] Hangar synced: ${snapshot.pledges.length} pledges from ` +
        `${pages} pages in ${seconds} s`,
    );
    // A full sync is the most thorough check there is.
    const { cursor } = await hangarCheckState.getValue();
    const at = Date.now();
    await hangarCheckState.setValue({
      lastCheckAt: at,
      cursor,
      lastOutcome: { at, status: 'unchanged', added: 0, removed: 0, changed: 0 },
    });
  } catch (error) {
    console.error('[sc-hangar-manager] Hangar sync failed', error);
  } finally {
    state.running = false;
    state.progress = null;
  }
}

/**
 * Runs a smart update if it is enabled and due (see `SMART_UPDATE.checkIntervalMs`).
 * `force` skips the interval, e.g. when returning from "My Gear", where pledges may have changed.
 */
export async function maybeRunSmartUpdate({ force = false } = {}): Promise<void> {
  if (state.running || state.checking) return;
  // Claimed right away, so triggers firing at the same time don't start two checks.
  state.checking = true;
  try {
    const settings = withDefaults(await settingsItem.getValue());
    if (!settings.smartUpdates) return;
    const { lastCheckAt } = await hangarCheckState.getValue();
    if (!force && Date.now() - lastCheckAt < SMART_UPDATE.checkIntervalMs) return;

    const startedAt = performance.now();
    const outcome = await runSmartUpdate();
    if (outcome) {
      const ms = Math.round(performance.now() - startedAt);
      console.info(
        `[sc-hangar-manager] Smart update: ${outcome.status} ` +
          `(+${outcome.added} / -${outcome.removed} / ~${outcome.changed}) in ${ms} ms`,
      );
    }
  } catch (error) {
    console.error('[sc-hangar-manager] Smart update failed', error);
    // Counts as a check, so a broken connection isn't retried on every trigger.
    const current = await hangarCheckState.getValue();
    const at = Date.now();
    await hangarCheckState.setValue({
      ...current,
      lastCheckAt: at,
      lastOutcome: { at, status: 'failed', added: 0, removed: 0, changed: 0 },
    });
  } finally {
    state.checking = false;
  }
}
