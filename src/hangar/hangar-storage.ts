import type { HangarSnapshot } from './pledge';

/**
 * The whole snapshot lives in a single key, so a sync replaces it atomically and readers never
 * see a mix of old and new pledges.
 */
export const hangarSnapshot = storage.defineItem<HangarSnapshot | null>('local:hangar.snapshot', {
  fallback: null,
});

/** Outcome of the last smart update check, shown in the status line. */
export interface CheckOutcome {
  /** Epoch milliseconds. */
  at: number;
  status: 'unchanged' | 'updated' | 'needsFullSync' | 'failed';
  added: number;
  removed: number;
  changed: number;
}

export interface CheckState {
  /** Epoch milliseconds of the last check (or full sync); 0 if there was none. */
  lastCheckAt: number;
  /** Rotation of the spot check pages. */
  cursor: number;
  lastOutcome: CheckOutcome | null;
}

/** Small and separate from the snapshot, so a check without changes doesn't rewrite all pledges. */
export const hangarCheckState = storage.defineItem<CheckState>('local:hangar.checkState', {
  fallback: { lastCheckAt: 0, cursor: 0, lastOutcome: null },
});
