import { shallowRef } from 'vue';
import { hashOfTab } from './route';

/*
 * Filters of "My Hangar" without a button of their own, turned on from the sidebar: "Show" of the
 * notification about marked pledges that can be melted now (#144), and the filter button of the
 * Paint Discount Consultant's box (#146). One at a time; turning one on clears search and the
 * other filters. "Reset filters" turns it off, and the list turns it off once nothing matches
 * (see `ManagerList`'s `filterRequest`).
 */

export type HangarViewFilter = 'meltReady' | 'paintRebuy';

/** The filter that is on, and when it was turned on (each time is a new request). */
export const hangarViewFilter = shallowRef<{ id: HangarViewFilter; at: number } | null>(null);

/** Turns the filter on and shows "My Hangar". */
export function showHangarFilter(id: HangarViewFilter): void {
  hangarViewFilter.value = { id, at: Date.now() };
  location.hash = hashOfTab('hangar');
}

/** Turns the filter off, if it is on. */
export function clearHangarFilter(id?: HangarViewFilter): void {
  if (!id || hangarViewFilter.value?.id === id) hangarViewFilter.value = null;
}
