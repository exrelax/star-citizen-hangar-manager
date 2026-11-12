import { openTabAt } from '@/hangar/open-tab-at';
import { ref } from 'vue';

/** Counts the requests to show the current warbond CCUs; the Pledge Store tab selects them. */
export const currentWarbondsRequest = ref(0);

/**
 * Opens the Pledge Store tab at its warbond CCUs (e.g. from a notification about new ones, #164),
 * with "Current Warbond CCUs" selected even if "Warbond CCU History" was shown (#297).
 */
export function openCurrentWarbonds(): void {
  currentWarbondsRequest.value++;
  openTabAt('store', 'shm-store-title', { highlight: true });
}
