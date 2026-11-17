import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { current, shipsItem } from '@/ships/ships-storage';
import { useNow } from '@/shared/use-now';
import { useStored } from '@/storage/use-stored';
import { computed, inject, shallowRef, type InjectionKey, type Ref } from 'vue';
import { removalCcus, type RemovalCcus } from './removal-ccus';
import { shipRemovalsItem, storedShipRemovals } from './ship-removals-storage';

/*
 * The ship removals (#285) with the CCUs of the shown hangar and buy back from and to each ship
 * (#287), for My Hangar's rows (#289) and the sidebar (#290). Built once by the manager view
 * (`App.vue`) and provided to the rows. The removals are public data, but the demo shows them only
 * with the real Pledge Store data (#310), like the Pledge Store tab; its own come with #292.
 */

export interface RemovalCcusState {
  /** Every upcoming removal with its CCUs, the next first. */
  list: readonly RemovalCcus[];
  /** The removal of a hangar CCU's base ship, by the pledge's id. */
  byHangarCcu: ReadonlyMap<number, RemovalCcus>;
}

const NONE: RemovalCcusState = { list: [], byHangarCcu: new Map() };

/** The removals with each hangar CCU's removal by its pledge id; the next removal wins. */
export function removalCcusState(list: readonly RemovalCcus[]): RemovalCcusState {
  const byHangarCcu = new Map<number, RemovalCcus>();
  for (const entry of list) {
    for (const ccu of entry.from) {
      if (ccu.source === 'hangar' && !byHangarCcu.has(ccu.id)) byHangarCcu.set(ccu.id, entry);
    }
  }
  return { list, byHangarCcu };
}

export function useRemovalCcus(
  pledges: () => readonly PledgeView[],
  buyback: () => readonly BuybackView[],
  shown: () => boolean,
): Readonly<Ref<RemovalCcusState>> {
  const storedRemovals = useStored(shipRemovalsItem);
  const storedShips = useStored(shipsItem);
  const now = useNow();
  return computed(() => {
    const removals = storedShipRemovals(storedRemovals.value ?? null);
    if (!shown() || !removals.length) return NONE;
    const list = removalCcus({
      removals,
      ships: current(storedShips.value ?? null)?.ships ?? [],
      hangar: pledges(),
      buyback: buyback(),
      now: now.value,
    });
    return removalCcusState(list);
  });
}

export const REMOVAL_CCUS: InjectionKey<Readonly<Ref<RemovalCcusState>>> =
  Symbol('shm-removal-ccus');

/** The removals provided by the manager view (see `App.vue`); none outside of it. */
export function useProvidedRemovalCcus(): Readonly<Ref<RemovalCcusState>> {
  return inject(REMOVAL_CCUS, shallowRef(NONE));
}
