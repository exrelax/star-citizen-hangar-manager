import type { InjectionKey } from 'vue';
import type { WatchItemRef } from './watchlists';

/**
 * Provided by a watchlist's view (#467) to the rows of My Hangar and the Buy Back shown in it: their
 * details then offer to remove the pledge from the watchlist.
 */
export const WATCHLIST_ROW: InjectionKey<{ remove: (ref: WatchItemRef) => void }> =
  Symbol('watchlist-row');
