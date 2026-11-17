import { SHIP_REMOVALS } from '@/config';
import { createSiteDataSync, fetchSiteFile, type RefreshOptions } from '@/site-data/sync-site-data';
import { parseShipRemovals, type ShipRemoval } from './ship-removals';
import {
  SHIP_REMOVALS_VERSION,
  shipRemovalsItem,
  shipRemovalsMeta,
  type ShipRemovalsSnapshot,
} from './ship-removals-storage';

/*
 * Keeps the stored ship removals of the project website (#285) current, like every data file of
 * the website (`site-data/sync-site-data.ts`): at the times of `SITE_DATA.schedule`; offline the
 * stored ones stay.
 */

/**
 * The ship removals of the website's file, checked; throws if it can't be read. The development
 * build reads the file of the working copy (`site/public/data/ship-removals.json`), so entries can
 * be tried before they go live; "Stored data" in the settings reads it again at once.
 */
export async function fetchShipRemovals(): Promise<ShipRemoval[] | undefined> {
  if (import.meta.env.DEV) {
    const local = await import('../../site/public/data/ship-removals.json');
    return parseShipRemovals(local.default);
  }
  return parseShipRemovals(await fetchSiteFile(SHIP_REMOVALS.url));
}

const refresh = createSiteDataSync({
  name: 'Ship removals',
  item: shipRemovalsItem,
  meta: shipRemovalsMeta,
  version: SHIP_REMOVALS_VERSION,
  fetch: () => fetchShipRemovals(),
  toSnapshot: (shipRemovals: ShipRemoval[]) => ({ version: SHIP_REMOVALS_VERSION, shipRemovals }),
  fromSnapshot: (snapshot: ShipRemovalsSnapshot) => snapshot.shipRemovals,
});

/** Reads the ship removals if due (`force`: in any case). */
export async function maybeRefreshShipRemovals(
  options: RefreshOptions<ShipRemoval[]> = {},
): Promise<void> {
  await refresh(options);
}
