import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import { buyableShipsItem, current, shipsItem } from '@/ships/ships-storage';
import { useShipFacts } from '@/ships/use-ship-facts';
import { useNow } from '@/shared/use-now';
import { useStored } from '@/storage/use-stored';
import { computed, inject, shallowRef, type InjectionKey, type Ref } from 'vue';
import { limitedSales, type LimitedSale } from './removal-availability';
import { removalCcus, type RemovalCcus } from './removal-ccus';
import { shipRemovalsItem, storedShipRemovals } from './ship-removals-storage';

/*
 * The ship removals (#285) with the CCUs of the shown hangar and buy back from and to each ship
 * (#287), for My Hangar's rows (#289), the sidebar (#290) and the Pledge Store tab (#288), and
 * which of them are on sale now but not always available (#293). Built once by the manager view
 * (`App.vue`) and provided to the rows. The removals are public data, but the demo shows them only
 * with the real Pledge Store data (#310), like the Pledge Store tab; its own come with #292.
 */

export interface RemovalCcusState {
  /** Every upcoming removal with its CCUs, the next first. */
  list: readonly RemovalCcus[];
  /** The removal of a hangar CCU's base ship, by the pledge's id. */
  byHangarCcu: ReadonlyMap<number, RemovalCcus>;
  /** The removed ships on sale now but not always available (#293), by ship id. */
  limited: ReadonlyMap<number, LimitedSale>;
}

const NONE: RemovalCcusState = { list: [], byHangarCcu: new Map(), limited: new Map() };

/** The removals with each hangar CCU's removal by its pledge id; the next removal wins. */
export function removalCcusState(
  list: readonly RemovalCcus[],
  limited: ReadonlyMap<number, LimitedSale> = new Map(),
): RemovalCcusState {
  const byHangarCcu = new Map<number, RemovalCcus>();
  for (const entry of list) {
    for (const ccu of entry.from) {
      if (ccu.source === 'hangar' && !byHangarCcu.has(ccu.id)) byHangarCcu.set(ccu.id, entry);
    }
  }
  return { list, byHangarCcu, limited };
}

export function useRemovalCcus(
  pledges: () => readonly PledgeView[],
  buyback: () => readonly BuybackView[],
  shown: () => boolean,
): Readonly<Ref<RemovalCcusState>> {
  const storedRemovals = useStored(shipRemovalsItem);
  const storedShips = useStored(shipsItem);
  const storedBuyable = useStored(buyableShipsItem);
  const storedEvents = useStored(eventsItem);
  const shipFacts = useShipFacts();
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
    const events = storedEvents.value;
    const limited = limitedSales({
      removals,
      onSale: new Set(current(storedBuyable.value ?? null)?.skus.map((sku) => sku.shipId) ?? []),
      alwaysAvailable: (id) => shipFacts.value?.isAlwaysAvailable(id),
      events: events?.version === EVENTS_VERSION ? events.events : [],
      now: now.value,
    });
    return removalCcusState(list, limited);
  });
}

export const REMOVAL_CCUS: InjectionKey<Readonly<Ref<RemovalCcusState>>> =
  Symbol('shm-removal-ccus');

/** The removals provided by the manager view (see `App.vue`); none outside of it. */
export function useProvidedRemovalCcus(): Readonly<Ref<RemovalCcusState>> {
  return inject(REMOVAL_CCUS, shallowRef(NONE));
}
