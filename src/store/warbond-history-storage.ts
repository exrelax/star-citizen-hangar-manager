import type { WarbondHistorySnapshot } from './warbond-history';

/**
 * The warbond offers seen so far (#4, see `warbond-history.ts`), added to by every read of the
 * upgrade tool. Kept in this browser only; it can't be read again from RSI.
 */
export const warbondHistoryItem = storage.defineItem<WarbondHistorySnapshot | null>(
  'local:store.warbondHistory',
  { fallback: null },
);
