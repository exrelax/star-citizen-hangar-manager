import { reactive, readonly } from 'vue';
import { syncHangar, type SyncProgress } from './sync';

const state = reactive({
  running: false,
  progress: null as SyncProgress | null,
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
  } catch (error) {
    console.error('[sc-hangar-manager] Hangar sync failed', error);
  } finally {
    state.running = false;
    state.progress = null;
  }
}
