import { defineMeta } from '@/storage/meta';
import type { ShipRemoval } from './ship-removals';

/** Format version of the stored ship removals; others are ignored and read again. */
export const SHIP_REMOVALS_VERSION = 1;

export interface ShipRemovalsSnapshot {
  version: number;
  shipRemovals: ShipRemoval[];
}

/** The ship removals of the project website (#285), as last read. */
export const shipRemovalsItem = storage.defineItem<ShipRemovalsSnapshot | null>(
  'local:shipRemovals',
  { fallback: null },
);

/** The stored ship removals, if of the current format; else none. */
export const storedShipRemovals = (snapshot: ShipRemovalsSnapshot | null): ShipRemoval[] =>
  snapshot?.version === SHIP_REMOVALS_VERSION ? snapshot.shipRemovals : [];

/** Last read, check and fingerprint of the ship removals (see `storage/meta.ts`). */
export const shipRemovalsMeta = defineMeta('local:shipRemovals');
