import { shallowRef } from 'vue';
import type { PledgeFilter } from './filters';
import { hashOfTab } from './route';

/*
 * A filter button of "My Hangar" turned on from outside – the Price Increase Advisor's sidebar
 * notification (#254) turns on "Price change ahead": My Hangar opens with only this filter
 * included, without search, like the buy back's (`buyback-filter-request.ts`). Each request
 * (`at`) applies once; the button then works as usual.
 */

export const hangarFilterRequest = shallowRef<{ filter: PledgeFilter; at: number } | null>(null);

/** Includes the filter and shows "My Hangar". */
export function includeHangarFilter(filter: PledgeFilter): void {
  hangarFilterRequest.value = { filter, at: Date.now() };
  location.hash = hashOfTab('hangar');
}
