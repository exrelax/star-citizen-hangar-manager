import { openTabAt } from '@/hangar/open-tab-at';
import { ref } from 'vue';

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
