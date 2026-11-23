import type { InjectionKey } from 'vue';
import type { WatchItemRef } from './watchlists';

/**
 * Provided by a watchlist's view (#467) to the rows of My Hangar and the Buy Back shown in it: their
 * details then offer to remove the pledge from the watchlist. The Buy Back's rows and groups select
 * their pledges for the watchlist (`select`, #620); those of My Hangar use the hangar's selection.
 */
export const WATCHLIST_ROW: InjectionKey<{
  remove: (ref: WatchItemRef) => void;
  select?: {
    has: (ref: WatchItemRef) => boolean;
    set: (refs: readonly WatchItemRef[], on: boolean) => void;
  };
}> = Symbol('watchlist-row');
