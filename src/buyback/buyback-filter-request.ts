import { hashOfTab } from '@/hangar/route';
import { shallowRef } from 'vue';
import type { BuybackFilter } from './buyback-view';

/*
 * A filter button of the buy back turned on from outside – the sidebar's notification about
 * expected price increases and its browser notification (#193): the buy back opens with only this
 * filter included, without search. Each request (`at`) applies once; the button then works as
 * usual.
 */

export const buybackFilterRequest = shallowRef<{ filter: BuybackFilter; at: number } | null>(null);

/** Includes the filter and shows the buy back. */
export function showBuybackFilter(filter: BuybackFilter): void {
  buybackFilterRequest.value = { filter, at: Date.now() };
  location.hash = hashOfTab('buyback');
}
