import { openTabAt } from '@/hangar/open-tab-at';
import { ref, shallowRef } from 'vue';

/** Counts the requests to show the current discount CCUs; the Pledge Store tab selects them. */
export const currentWarbondsRequest = ref(0);

/**
 * Opens the Pledge Store tab at its warbond CCUs (e.g. from a notification about new ones, #164),
 * with "Current Discount CCUs" selected even if "Warbond CCU History" was shown (#297).
 */
export function openCurrentWarbonds(): void {
  currentWarbondsRequest.value++;
  openTabAt('store', 'shm-store-title', { highlight: true });
}

/**
 * Opens the Pledge Store tab at the CCUs to secure before a price increase (#253, from the
 * sidebar), in "Current Discount CCUs", where they are (#305).
 */
export function openCcusToSecure(): void {
  currentWarbondsRequest.value++;
  openTabAt('store', 'shm-store-secure-title', { highlight: true });
}

/** Opens the Pledge Store tab at the ships leaving the Pledge Store (#288), e.g. from a notification. */
export function openShipRemovals(): void {
  openTabAt('store', 'shm-store-removals-title', { highlight: true });
}

/** The ship to expand in "Ships leaving the Pledge Store"; a new object for every request. */
export const shipRemovalRequest = shallowRef<{ shipId: number }>();

/**
 * Opens the Pledge Store tab at a ship leaving the Pledge Store (#381, from a CCU of My Hangar with
 * it as base ship), expanded with its CCUs from and to it (#380).
 */
export function openShipRemoval(shipId: number): void {
  shipRemovalRequest.value = { shipId };
  openTabAt('store', removalRowId(shipId), { highlight: true });
}

/** The id of a ship's row in "Ships leaving the Pledge Store". */
export const removalRowId = (shipId: number) => `shm-store-removal-${shipId}`;
