import type { CheckState } from '@/hangar/hangar-storage';
import type { BuybackSnapshot } from './buyback';

/** The whole buy back in a single key, replaced atomically like the hangar snapshot. */
export const buybackSnapshot = storage.defineItem<BuybackSnapshot | null>('local:buyback.items', {
  fallback: null,
});

/** Smart update state of the buy back, separate from the hangar's. */
export const buybackCheckState = storage.defineItem<CheckState>('local:buyback.check', {
  fallback: { lastCheckAt: 0, cursor: 0, lastOutcome: null },
});
