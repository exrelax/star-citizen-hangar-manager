import { shallowRef } from 'vue';
import type { FilterStates, PledgeFilter } from './filters';
import { hashOfTab } from './route';

/*
 * A filter button of "My Hangar" turned on from outside – the Price Increase Advisor's sidebar
 * notification (#254) turns on "Price change ahead": My Hangar opens with only this filter
 * included, without search, like the buy back's (`buyback-filter-request.ts`), and off again.
 * Each request (`at`) applies once; the button then works as usual. The states of My Hangar's
 * filter buttons come back here, so the sidebar shows whether its filter is on.
 */

export const hangarFilterRequest = shallowRef<{
  filter: PledgeFilter;
  at: number;
  clear?: boolean;
} | null>(null);

/** The states of My Hangar's filter buttons, while the list is shown. */
export const hangarFilterStates = shallowRef<FilterStates<PledgeFilter>>(new Map());

/** Includes the filter and shows "My Hangar". */
export function includeHangarFilter(filter: PledgeFilter): void {
  hangarFilterRequest.value = { filter, at: Date.now() };
  location.hash = hashOfTab('hangar');
}

/** Turns the filter off again, keeping the other filters and the search. */
export function clearHangarFilterInclude(filter: PledgeFilter): void {
  hangarFilterRequest.value = { filter, at: Date.now(), clear: true };
}
