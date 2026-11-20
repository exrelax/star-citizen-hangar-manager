import type { BuybackView } from '@/buyback/buyback-view';
import type { PledgeView } from '@/hangar/pledge-view';
import { EVENTS_VERSION, eventsItem } from '@/events/events-storage';
import { buyableShipsItem, current, shipsItem } from '@/ships/ships-storage';
import { useShipFacts } from '@/ships/use-ship-facts';
import { useNow } from '@/shared/use-now';
import { useStored } from '@/storage/use-stored';
import { computed, inject, shallowRef, type InjectionKey, type Ref } from 'vue';
import { limitedSales, obtainableRemovals, type LimitedSale } from './removal-availability';
import { removalCcus, type RemovalCcus } from './removal-ccus';
import { shipRemovalsItem, storedShipRemovals } from './ship-removals-storage';
import { upcomingShipRemovals, type ShipRemoval } from './ship-removals';
import type { StarCitizenEvent } from '@/events/events';

/*
 * The ship removals (#285) with the CCUs of the shown hangar and buy back from and to each ship
 * (#287), for My Hangar's rows (#289), the sidebar (#290) and the Pledge Store tab (#288), and
 * which of them are on sale now but not always available (#293). Built once by the manager view
 * (`App.vue`) and provided to the rows. The demo has removals of its own (#292), made for its hangar
 * and buy back, unless it shows the real Pledge Store data (#310), like the Pledge Store tab.
 */

/** The demo's removals instead of the website's (`demo-ship-removals.ts`). */
export interface DemoRemovalSource {
  removals: readonly ShipRemoval[];
  /** The ships on sale now but not always available. */
  limited: ReadonlySet<number>;
  /** The ships on sale now (#454); without it, those of `limited`. */
  onSale?: ReadonlySet<number>;
  /** The demo's events, for the note's running event. */
  events: readonly StarCitizenEvent[];
}

export interface RemovalCcusState {
  /** Every upcoming removal with its CCUs, the next first. */
  list: readonly RemovalCcus[];
  /** The removal of a hangar CCU's base ship, by the pledge's id. */
  byHangarCcu: ReadonlyMap<number, RemovalCcus>;
  /** The removed ships on sale now but not always available (#293), by ship id. */
  limited: ReadonlyMap<number, LimitedSale>;
  /**
   * The upcoming removals of ships that can still be had now – on sale or always available
   * (#454) –, by ship id.
   */
  obtainable: ReadonlyMap<number, ShipRemoval>;
}

const NONE: RemovalCcusState = {
  list: [],
  byHangarCcu: new Map(),
  limited: new Map(),
  obtainable: new Map(),
};

/** The removals with each hangar CCU's removal by its pledge id; the next removal wins. */
export function removalCcusState(
  list: readonly RemovalCcus[],
  limited: ReadonlyMap<number, LimitedSale> = new Map(),
  obtainable: ReadonlyMap<number, ShipRemoval> = new Map(),
): RemovalCcusState {
  const byHangarCcu = new Map<number, RemovalCcus>();
  for (const entry of list) {
    for (const ccu of entry.from) {
      if (ccu.source === 'hangar' && !byHangarCcu.has(ccu.id)) byHangarCcu.set(ccu.id, entry);
    }
  }
  return { list, byHangarCcu, limited, obtainable };
}

export function useRemovalCcus(
  pledges: () => readonly PledgeView[],
  buyback: () => readonly BuybackView[],
  /** The demo's removals while the demo shows them; else the website's. */
  demo: () => DemoRemovalSource | undefined,
): Readonly<Ref<RemovalCcusState>> {
  const storedRemovals = useStored(shipRemovalsItem);
  const storedShips = useStored(shipsItem);
  const storedBuyable = useStored(buyableShipsItem);
  const storedEvents = useStored(eventsItem);
  const shipFacts = useShipFacts();
  const now = useNow();
  return computed(() => {
    const source = demo();
    const removals = source?.removals ?? storedShipRemovals(storedRemovals.value ?? null);
    if (!removals.length) return NONE;
    const list = removalCcus({
      removals,
      ships: current(storedShips.value ?? null)?.ships ?? [],
      hangar: pledges(),
      buyback: buyback(),
      now: now.value,
    });
    const events = storedEvents.value;
    const sale = source
      ? {
          onSale: source.limited,
          alwaysAvailable: (id: number) => !source.limited.has(id),
          events: source.events,
        }
      : {
          onSale: new Set(
            current(storedBuyable.value ?? null)?.skus.map((sku) => sku.shipId) ?? [],
          ),
          alwaysAvailable: (id: number) => shipFacts.value?.isAlwaysAvailable(id),
          events: events?.version === EVENTS_VERSION ? events.events : [],
        };
    const limited = limitedSales({ removals, ...sale, now: now.value });
    // The demo knows which of its ships are on sale; none of them counts as always available.
    const obtainable = obtainableRemovals({
      ...(source
        ? { onSale: source.onSale ?? source.limited, alwaysAvailable: () => undefined }
        : sale),
      removals: upcomingShipRemovals(removals, now.value),
    });
    return removalCcusState(list, limited, obtainable);
  });
}

export const REMOVAL_CCUS: InjectionKey<Readonly<Ref<RemovalCcusState>>> =
  Symbol('shm-removal-ccus');

/** The removals provided by the manager view (see `App.vue`); none outside of it. */
export function useProvidedRemovalCcus(): Readonly<Ref<RemovalCcusState>> {
  return inject(REMOVAL_CCUS, shallowRef(NONE));
}
