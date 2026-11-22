import { computed, inject, shallowRef, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { rebuyables, type Rebuy, type RebuyContext, type RebuyPledge } from './rebuyable';

/*
 * Melt and Rebuy (#528) for the shown hangar: worked out once by the manager view (`App.vue`) and
 * provided to the list, its List Shortcut, the rows (#530) and the watchlists (#531).
 */

export interface RebuyInput {
  /** The pledges of My Hangar as shown (the demo's in the demo mode). */
  pledges: readonly RebuyPledge[];
  context: RebuyContext;
}

/** `Rebuy` of every shown pledge, by its id, worked out again whenever its input changes. */
export const useRebuyables = (input: () => RebuyInput): ComputedRef<ReadonlyMap<number, Rebuy>> =>
  computed(() => {
    const { pledges, context } = input();
    return rebuyables(pledges, context);
  });

export const REBUYABLES: InjectionKey<Readonly<Ref<ReadonlyMap<number, Rebuy>>>> =
  Symbol('shm-rebuyables');

/** The results provided by the manager view (see `App.vue`); none outside of it. */
export function useProvidedRebuyables(): Readonly<Ref<ReadonlyMap<number, Rebuy>>> {
  return inject(REBUYABLES, shallowRef<ReadonlyMap<number, Rebuy>>(new Map()));
}
